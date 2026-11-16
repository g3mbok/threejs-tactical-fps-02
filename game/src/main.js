import * as THREE from 'three';
import { createAgents } from './agents.js';
import { createAudio } from './audio.js';
import { createHud } from './hud.js';
import { createInput } from './input.js';
import { COLORS } from './palette.js';
import { createPlayer } from './player.js';
import { ARSENAL, createWeapon } from './weapon.js';
import { createWorld } from './world.js';

const FIXED_STEP = 1 / 60;
const ROUND_SECONDS = 90;
const PLANTED_SECONDS = 38;
const MAX_ROUNDS = 12;
const params = new URLSearchParams(location.search);
const shotMode = params.get('shot');
let seed = Number.parseInt(params.get('seed') ?? '1704', 10) || 1704;

function random() {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let value = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
  return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
}

const host = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance', alpha: false });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.12;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
host.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color('#102228');
scene.fog = new THREE.Fog(new THREE.Color('#102228'), 25, 62);
const camera = new THREE.PerspectiveCamera(72, window.innerWidth / window.innerHeight, 0.07, 110);
camera.rotation.order = 'YXZ';
scene.add(camera);

const world = createWorld(scene);
const initialSpawn = world.spawns.attack[1];
const player = createPlayer(world.colliders, world.bounds, initialSpawn, 0);
const weapon = createWeapon(camera);
weapon.equip('kestrel');
const agents = createAgents(scene, world);
const hud = createHud();
const audio = createAudio();
const input = createInput(renderer.domElement, onLockChange);
const playerTarget = { id: -1, position: player.state.position, side: 'attack', alive: true };
const bombGroup = new THREE.Group();
const bombShell = new THREE.Mesh(
  new THREE.BoxGeometry(0.5, 0.26, 0.34),
  new THREE.MeshStandardMaterial({ color: '#222c2d', roughness: 0.42, metalness: 0.63 }),
);
const bombCore = new THREE.Mesh(
  new THREE.BoxGeometry(0.17, 0.11, 0.12),
  new THREE.MeshStandardMaterial({ color: COLORS.red, emissive: '#e57767', emissiveIntensity: 1.6, roughness: 0.3 }),
);
bombCore.position.set(0, 0.19, 0);
bombGroup.add(bombShell, bombCore);
bombGroup.visible = false;
scene.add(bombGroup);
const bombLight = new THREE.PointLight(COLORS.red, 4, 8, 2);
bombGroup.add(bombLight);
bombLight.position.y = 0.48;

const grenade = {
  mesh: new THREE.Mesh(
    new THREE.SphereGeometry(0.16, 12, 10),
    new THREE.MeshStandardMaterial({ color: '#71817a', roughness: 0.43, metalness: 0.54, emissive: '#253d34', emissiveIntensity: 0.25 }),
  ),
  velocity: new THREE.Vector3(),
  position: new THREE.Vector3(),
  time: 0,
  active: false,
};
scene.add(grenade.mesh);
grenade.mesh.visible = false;
const grenadeLight = new THREE.PointLight(COLORS.amber, 2.5, 4, 2);
grenade.mesh.add(grenadeLight);

const raycaster = new THREE.Raycaster();
const aimDirection = new THREE.Vector3();
const shotDirection = new THREE.Vector3();
const toTarget = new THREE.Vector3();
const worldHits = [];
const allHitMeshes = [...world.shootables];
for (const bot of agents.bots) allHitMeshes.push(...bot.hitMeshes);
const state = {
  started: false,
  frozen: false,
  phase: 'briefing',
  phaseLeft: 0,
  round: 1,
  side: 'attack',
  score: { attack: 0, defend: 0 },
  timeLeft: ROUND_SECONDS,
  credits: 2500,
  kills: 0,
  grenades: 0,
  hasKit: false,
  buyOpen: false,
  plantProgress: 0,
  defuseProgress: 0,
  bomb: { planted: false, site: null, timeLeft: PLANTED_SECONDS, siteIndex: 0 },
  grenadeCooldown: 0,
  firingWasDown: false,
  hudIn: 0,
  elapsed: 0,
  accumulator: 0,
  lastTime: performance.now(),
};

agents.reset(state.side, state.round);

const cameraForward = new THREE.Vector3();
const spawnYaw = { attack: 0, defend: Math.PI };

function counts() {
  return {
    attack: agents.aliveCount('attack') + Number(state.side === 'attack' && player.state.alive),
    defend: agents.aliveCount('defend') + Number(state.side === 'defend' && player.state.alive),
  };
}

function currentSite(position) {
  let nearest = null;
  let best = Infinity;
  for (const site of world.sites) {
    const distance = Math.hypot(position.x - site.position.x, position.z - site.position.z);
    if (distance < best) {
      best = distance;
      nearest = site;
    }
  }
  return best <= 3.65 ? nearest : null;
}

function siteForBot(bot) {
  const key = bot.routeKey.endsWith('B') ? 1 : 0;
  return world.sites[key];
}

function syncCamera() {
  const speed = player.speed();
  const bob = player.state.alive && player.state.grounded ? Math.sin(state.elapsed * 11) * Math.min(0.025, speed * 0.004) : 0;
  camera.position.set(player.state.position.x, player.state.position.y + player.state.eye + bob, player.state.position.z);
  camera.rotation.set(player.state.pitch, player.state.yaw, 0, 'YXZ');
}

function showRoundStart() {
  hud.phaseAlert(`ROUND ${String(state.round).padStart(2, '0')}`, state.side === 'attack' ? 'ASHLINE / SECURE A SITE' : 'TIDEGUARD / HOLD THE INTAKE');
  hud.message(state.side === 'attack' ? 'DEVICE CARRIED / TWO SITES OPEN' : 'DEFUSE SPOOL CHECK / COVER BOTH SITES');
}

function startMatch() {
  if (state.started) return;
  audio.unlock();
  state.started = true;
  state.phase = 'prep';
  state.phaseLeft = 12;
  state.timeLeft = ROUND_SECONDS;
  state.side = 'attack';
  player.state.side = state.side;
  player.reset(world.spawns.attack[1], spawnYaw.attack);
  agents.reset(state.side, state.round);
  hud.hideIntro();
  input.requestLock();
  showRoundStart();
}

function onLockChange(locked) {
  if (shotMode) return;
  if (locked) hud.hideIntro();
  else if (state.started && state.phase !== 'result') hud.message('CLICK THE VIEW TO RESUME', 'var(--cyan)', 2200);
}

function updatePlayerTarget() {
  playerTarget.position = player.state.position;
  playerTarget.side = state.side;
  playerTarget.alive = player.state.alive;
}

function lineOfSight(shooter, target, distance) {
  const startY = shooter.position.y + 1.5;
  const endY = target.position.y + (target === playerTarget ? player.state.eye * 0.75 : 1.3);
  toTarget.set(target.position.x - shooter.position.x, endY - startY, target.position.z - shooter.position.z);
  const length = toTarget.length();
  if (length <= 0.01) return true;
  aimDirection.copy(toTarget).multiplyScalar(1 / length);
  raycaster.set({ x: shooter.position.x, y: startY, z: shooter.position.z }, aimDirection);
  raycaster.far = Math.max(0, distance - 0.45);
  worldHits.length = 0;
  raycaster.intersectObjects(world.shootables, false, worldHits);
  return worldHits.length === 0;
}

function damagePlayer(amount, attacker) {
  if (!player.state.alive) return;
  const absorbed = Math.min(player.state.armor, amount * 0.58);
  player.state.armor -= absorbed;
  player.state.health -= amount - absorbed;
  if (player.state.health <= 0) {
    player.state.health = 0;
    player.state.alive = false;
    input.state.firing = false;
    hud.message('OPERATOR DOWN / SPECTATING SQUAD', 'var(--red)', 2600);
    hud.addFeed(attacker, 'YOU', 'defend', true);
  }
}

function botFire(bot, target, distance) {
  const movement = Math.hypot(bot.velocity.x, bot.velocity.z);
  const chance = THREE.MathUtils.clamp(0.8 - distance * 0.022 - movement * 0.045, 0.2, 0.78);
  if (random() > chance) return;
  const headshot = random() < 0.12;
  const damage = headshot ? 42 : 23;
  if (target === playerTarget) {
    damagePlayer(damage, bot.side === 'attack' ? 'ASHLINE' : 'TIDEGUARD');
  } else {
    const killed = agents.damage(target, headshot ? 60 : damage);
    if (killed) {
      bot.kills += 1;
      hud.addFeed(bot.side === 'attack' ? 'ASHLINE' : 'TIDEGUARD', `OP-${String(target.id + 1).padStart(2, '0')}`, bot.side, true);
    }
  }
}

function showHit(killed) {
  hud.hit(killed);
  audio.hit();
}

function firePlayer() {
  if (!weapon.takeRound()) {
    if (weapon.state.mag === 0 && weapon.state.reserve > 0) hud.message('MAG EMPTY / PRESS R TO RELOAD', 'var(--red)', 850);
    return false;
  }
  const definition = weapon.definition;
  const spread = weapon.spread(player.speed(), input.state.aiming);
  camera.getWorldDirection(aimDirection);
  scene.updateMatrixWorld(true);
  for (let pellet = 0; pellet < definition.pellets; pellet += 1) {
    shotDirection.set(
      aimDirection.x + (random() * 2 - 1) * spread,
      aimDirection.y + (random() * 2 - 1) * spread,
      aimDirection.z + (random() * 2 - 1) * spread,
    ).normalize();
    raycaster.set(camera.position, shotDirection);
    raycaster.far = definition.id === 'osprey' ? 100 : 75;
    worldHits.length = 0;
    raycaster.intersectObjects(allHitMeshes, false, worldHits);
    const hit = worldHits[0];
    if (!hit || !hit.object.userData.agent) continue;
    const target = hit.object.userData.agent;
    if (target.side === state.side || !target.alive) continue;
    const distanceScale = THREE.MathUtils.clamp(1 - hit.distance / (definition.id === 'osprey' ? 170 : 115), 0.55, 1);
    const amount = (hit.object.userData.part === 'head' ? definition.head : definition.damage) * distanceScale;
    const killed = agents.damage(target, amount);
    showHit(killed);
    if (killed) {
      state.kills += 1;
      state.credits += 300;
      hud.addFeed('YOU', `OP-${String(target.id + 1).padStart(2, '0')}`, state.side, true);
      hud.message(`ELIMINATION / +$300`, 'var(--amber)', 900);
    }
  }
  player.recoil(definition.recoil + Math.min(0.02, player.speed() * 0.0025), (random() * 2 - 1) * definition.recoil * 0.42);
  hud.setPlayer({ health: player.state.health, armor: player.state.armor, credits: state.credits, kills: state.kills, weapon: definition, mag: weapon.state.mag, reserve: weapon.state.reserve });
  audio.shot(definition.id === 'breaker' ? 'shotgun' : 'rifle');
  return true;
}

function plant(site) {
  state.bomb.planted = true;
  state.bomb.site = site;
  state.bomb.timeLeft = PLANTED_SECONDS;
  state.phase = 'planted';
  state.timeLeft = PLANTED_SECONDS;
  state.plantProgress = 0;
  state.defuseProgress = 0;
  bombGroup.position.set(site.position.x, 0.2, site.position.z);
  bombGroup.rotation.y = Math.PI * random();
  bombGroup.visible = true;
  hud.setAction('');
  hud.phaseAlert(`DEVICE PLANTED / ${site.id}`, 'DEFEND THE SIGNAL UNTIL IT BREAKS');
  hud.message(`CHARGE ARMED / ${site.name}`, 'var(--red)', 2400);
  audio.plant();
}

function finishRound(winner, reason) {
  if (state.phase === 'result') return;
  state.phase = 'result';
  state.phaseLeft = 5.2;
  state.bomb.planted = false;
  bombGroup.visible = false;
  state.score[winner] += 1;
  const playerWon = winner === state.side;
  state.credits += playerWon ? 3250 : 1400;
  const title = playerWon ? 'ROUND SECURED' : 'ROUND LOST';
  const color = winner === 'attack' ? 'var(--amber)' : 'var(--cyan)';
  hud.phaseAlert(title, reason.toUpperCase(), 2600);
  hud.message(`${winner === 'attack' ? 'ASHLINE' : 'TIDEGUARD'} / ${reason}`, color, 2500);
  hud.setAction('');
  audio.round(playerWon);
}

function prepareNextRound() {
  if (state.round >= MAX_ROUNDS || state.score.attack >= 7 || state.score.defend >= 7) {
    state.phase = 'matchover';
    hud.phaseAlert('SHIFT COMPLETE', `${state.score.attack} : ${state.score.defend} / SALTGLASS TERMINAL`, 6000);
    hud.message('PRESS DEPLOY TO RUN ANOTHER SHIFT', 'var(--amber)', 5000);
    return;
  }
  state.round += 1;
  state.side = Math.floor((state.round - 1) / 4) % 2 === 0 ? 'attack' : 'defend';
  player.state.side = state.side;
  const spawn = world.spawns[state.side][1];
  player.reset(spawn, spawnYaw[state.side]);
  player.state.side = state.side;
  state.bomb.planted = false;
  state.bomb.site = null;
  state.timeLeft = ROUND_SECONDS;
  state.phase = 'prep';
  state.phaseLeft = 12;
  state.plantProgress = 0;
  state.defuseProgress = 0;
  state.grenades = Math.min(state.grenades, 1);
  weapon.refill();
  agents.reset(state.side, state.round);
  showRoundStart();
}

function buyItem(id) {
  if (state.phase !== 'prep' && state.phase !== 'result') {
    hud.message('ARMORY LOCKED DURING LIVE CONTACT', 'var(--red)');
    return;
  }
  if (id === 'armor') {
    if (player.state.armor >= 75) return hud.message('PLATE IS ALREADY FULL');
    if (state.credits < 650) return hud.message('INSUFFICIENT CREDITS', 'var(--red)');
    state.credits -= 650;
    player.state.armor = 75;
    hud.message('PLATE REINFORCED');
  } else if (id === 'frag') {
    if (state.grenades > 0) return hud.message('ONE BRINE CHARGE ALREADY EQUIPPED');
    if (state.credits < 450) return hud.message('INSUFFICIENT CREDITS', 'var(--red)');
    state.credits -= 450;
    state.grenades = 1;
    hud.message('BRINE CHARGE EQUIPPED');
  } else if (id === 'kit') {
    if (state.side !== 'defend') return hud.message('DEFUSE SPOOL / TIDEGUARD ONLY');
    if (state.hasKit) return hud.message('DEFUSE SPOOL ALREADY EQUIPPED');
    if (state.credits < 400) return hud.message('INSUFFICIENT CREDITS', 'var(--red)');
    state.credits -= 400;
    state.hasKit = true;
    hud.message('DEFUSE SPOOL EQUIPPED');
  } else {
    const next = id === 'kestrel' || id === 'current' || id === 'osprey' || id === 'breaker'
      ? id
      : null;
    if (!next) return;
    const purchase = ARSENAL.find((item) => item.id === next);
    if (next !== weapon.definition.id && state.credits < purchase.price) return hud.message('INSUFFICIENT CREDITS', 'var(--red)');
    if (next !== weapon.definition.id) {
      state.credits -= purchase.price;
      weapon.equip(next);
      hud.message(`EQUIPPED / ${purchase.name.toUpperCase()}`);
    } else {
      hud.message('LOADOUT READY');
    }
  }
  hud.updateBuyAvailability(state.credits);
  hud.setPlayer({ health: player.state.health, armor: player.state.armor, credits: state.credits, kills: state.kills, weapon: weapon.definition, mag: weapon.state.mag, reserve: weapon.state.reserve });
}

function setBuyVisible(visible) {
  if (visible && (state.phase === 'prep' || state.phase === 'result')) {
    state.buyOpen = true;
    hud.showBuy(state.credits);
    return;
  }
  state.buyOpen = false;
  hud.hideBuy();
}

function throwGrenade() {
  if (state.grenades <= 0 || state.grenadeCooldown > 0 || !player.state.alive) return;
  state.grenades -= 1;
  state.grenadeCooldown = 1;
  camera.getWorldDirection(cameraForward);
  grenade.position.copy(camera.position).addScaledVector(cameraForward, 0.62);
  grenade.velocity.copy(cameraForward).multiplyScalar(11.5);
  grenade.velocity.y += 3.6;
  grenade.time = 2.1;
  grenade.active = true;
  grenade.mesh.visible = true;
  hud.message('BRINE CHARGE OUT', 'var(--amber)', 900);
  audio.grenade();
}

function detonateGrenade() {
  grenade.active = false;
  grenade.mesh.visible = false;
  for (const bot of agents.bots) {
    if (!bot.alive || bot.side === state.side) continue;
    const distance = Math.hypot(bot.position.x - grenade.position.x, bot.position.z - grenade.position.z);
    if (distance > 5.4) continue;
    const killed = agents.damage(bot, Math.max(18, 92 * (1 - distance / 6)));
    if (killed) {
      state.kills += 1;
      state.credits += 300;
      hud.addFeed('YOU / BRINE', `OP-${String(bot.id + 1).padStart(2, '0')}`, state.side, true);
    }
  }
  hud.message('FRAGMENTATION / AREA CLEAR', 'var(--amber)', 1200);
}

function updateGrenade(dt) {
  if (!grenade.active) return;
  grenade.time -= dt;
  grenade.velocity.y -= 9.8 * dt;
  grenade.position.addScaledVector(grenade.velocity, dt);
  for (const obstacle of world.colliders) {
    if (grenade.position.y < 0.18 && obstacle.min.y <= 0.02) {
      grenade.position.y = 0.18;
      grenade.velocity.y = Math.abs(grenade.velocity.y) * 0.32;
    }
  }
  grenade.mesh.position.copy(grenade.position);
  if (grenade.time <= 0) detonateGrenade();
}

function updateObjective(dt) {
  if (state.phase === 'live' && state.side === 'attack') {
    const site = currentSite(player.state.position);
    const holding = input.state.keys.has('KeyE') && site && player.state.alive;
    state.plantProgress = holding ? state.plantProgress + dt : Math.max(0, state.plantProgress - dt * 2);
    if (holding) {
      hud.setAction(`PLANTING DEVICE / SITE ${site.id}`, state.plantProgress / 3.1);
      if (state.plantProgress >= 3.1) plant(site);
    } else hud.setAction('');
  } else if (state.phase === 'planted' && state.side === 'defend') {
    const site = currentSite(player.state.position);
    const close = site && site.id === state.bomb.site?.id && player.state.alive;
    const holding = input.state.keys.has('KeyE') && close;
    const duration = state.hasKit ? 2.35 : 4.6;
    state.defuseProgress = holding ? state.defuseProgress + dt : Math.max(0, state.defuseProgress - dt * 1.7);
    if (holding) {
      hud.setAction(`DISARMING / SITE ${site.id}`, state.defuseProgress / duration);
      if (state.defuseProgress >= duration) {
        state.bomb.planted = false;
        bombGroup.visible = false;
        audio.defuse();
        finishRound('defend', 'device neutralized');
      }
    } else hud.setAction('');
  } else {
    hud.setAction('');
  }

  if (state.phase === 'live' && state.side === 'defend') {
    for (const bot of agents.bots) {
      if (!bot.alive || bot.side !== 'attack') continue;
      const site = siteForBot(bot);
      const distance = Math.hypot(bot.position.x - site.position.x, bot.position.z - site.position.z);
      bot.plantProgress = distance < 3.2 ? bot.plantProgress + dt : Math.max(0, bot.plantProgress - dt * 1.5);
      if (bot.plantProgress >= 4.0) {
        plant(site);
        bot.plantProgress = 0;
        break;
      }
    }
  }
}

function updateRound(dt) {
  const alive = counts();
  if (state.phase === 'prep') {
    state.phaseLeft -= dt;
    state.timeLeft = state.phaseLeft;
    if (state.phaseLeft <= 0) {
      state.phase = 'live';
      state.timeLeft = ROUND_SECONDS;
      hud.phaseAlert('MOVE OUT', 'CONTACT WINDOW OPEN');
    }
  } else if (state.phase === 'live') {
    state.timeLeft -= dt;
    if (alive.attack === 0) finishRound('defend', 'attackers eliminated');
    else if (alive.defend === 0) finishRound('attack', 'defenders eliminated');
    else if (state.timeLeft <= 0) finishRound('defend', 'terminal secured');
  } else if (state.phase === 'planted') {
    state.timeLeft -= dt;
    state.bomb.timeLeft = state.timeLeft;
    const afterDamage = counts();
    if (afterDamage.defend === 0) finishRound('attack', 'defenders eliminated');
    else if (state.timeLeft <= 0) finishRound('attack', 'device detonated');
  } else if (state.phase === 'result') {
    state.phaseLeft -= dt;
    state.timeLeft = state.phaseLeft;
    if (state.phaseLeft <= 0) prepareNextRound();
  }
}

function updateHud(dt) {
  state.hudIn -= dt;
  if (state.hudIn > 0) return;
  state.hudIn = 0.1;
  const alive = counts();
  hud.setRound({
    round: state.round,
    rounds: MAX_ROUNDS,
    attackScore: state.score.attack,
    defendScore: state.score.defend,
    seconds: state.timeLeft,
    side: state.side,
    phase: state.phase,
    attackAlive: alive.attack,
    defendAlive: alive.defend,
  });
  hud.setPlayer({
    health: player.state.health,
    armor: player.state.armor,
    credits: state.credits,
    kills: state.kills,
    weapon: weapon.definition,
    mag: weapon.state.mag,
    reserve: weapon.state.reserve,
  });
  hud.drawRadar(player.state, agents.bots, state.bomb.planted ? state.bomb.site : null);
}

function handleInput() {
  if (input.consume('KeyB')) setBuyVisible(!state.buyOpen);
  if (state.buyOpen && input.consume('Escape')) setBuyVisible(false);
  if (input.consume('KeyR') && player.state.alive) weapon.reload();
  if (input.consume('KeyG')) throwGrenade();
  if (input.consume('Tab')) {
    const alive = counts();
    hud.toggleScoreboard(true, alive.attack, alive.defend);
  }
  if (!input.state.keys.has('Tab')) {
    const alive = counts();
    hud.toggleScoreboard(false, alive.attack, alive.defend);
  }
}

function step(dt) {
  state.elapsed += dt;
  handleInput();
  if (state.started && !state.buyOpen && state.phase !== 'matchover') {
    if (player.state.alive && state.phase !== 'result') player.step(dt, input.state.keys);
    updatePlayerTarget();
    const look = input.takeLook();
    player.look(look.x, look.y);
    weapon.step(dt, player.speed(), input.state.aiming);
    agents.step(dt, state.elapsed, playerTarget, lineOfSight, botFire, state.bomb.planted ? state.bomb.site : null);
    updateObjective(dt);
    updateGrenade(dt);
    updateRound(dt);
    const targetFov = input.state.aiming ? 56 : 72;
    if (Math.abs(camera.fov - targetFov) > 0.05) {
      camera.fov += (targetFov - camera.fov) * Math.min(1, dt * 10);
      camera.updateProjectionMatrix();
    }
    const semi = !weapon.definition.auto;
    if (input.state.firing && player.state.alive && weapon.ready() && (!semi || !state.firingWasDown)) firePlayer();
    state.firingWasDown = input.state.firing;
  } else {
    weapon.step(dt, 0, false);
  }
  state.grenadeCooldown = Math.max(0, state.grenadeCooldown - dt);
  const flash = state.bomb.planted ? 0.25 + 0.75 * (0.5 + 0.5 * Math.sin(state.elapsed * 7)) : 0;
  bombCore.material.emissiveIntensity = 0.7 + flash * 2.4;
  bombLight.intensity = flash * 6;
  syncCamera();
  updateHud(dt);
}

function setBotDemoPosition(bot, x, z, side) {
  bot.position.set(x, 0, z);
  bot.group.position.set(x, 0, z);
  bot.group.visible = true;
  bot.side = side;
  bot.health = 100;
  bot.alive = true;
  bot.mats.attack.color.set(side === 'attack' ? '#b9854d' : '#398d89');
  bot.group.rotation.y = Math.PI;
}

function prepareShot(name) {
  state.started = true;
  state.frozen = true;
  state.side = name === 'defuse' ? 'defend' : 'attack';
  player.state.side = state.side;
  agents.reset(state.side, state.round);
  state.phase = name === 'briefing' || name === 'armory' ? 'prep' : 'live';
  state.phaseLeft = 10;
  state.timeLeft = name === 'briefing' || name === 'armory' ? 10 : 74;
  player.reset(name === 'defuse' ? new THREE.Vector3(-9.8, 0, 0.2) : new THREE.Vector3(0, 0, 8), name === 'defuse' ? 0.38 : 0);
  player.state.side = state.side;
  if (name === 'briefing') {
    hud.showIntro();
  } else {
    hud.hideIntro();
    const enemySide = state.side === 'attack' ? 'defend' : 'attack';
    setBotDemoPosition(agents.bots[3], -4.2, -3.8, enemySide);
    setBotDemoPosition(agents.bots[4], 4.4, -7.4, enemySide);
    setBotDemoPosition(agents.bots[5], -11.2, -9.0, enemySide);
    setBotDemoPosition(agents.bots[6], 11.5, -9.1, enemySide);
  }
  if (name === 'armory') {
    state.phase = 'prep';
    state.credits = 4200;
    hud.showBuy(state.credits);
  } else if (name === 'defuse') {
    state.phase = 'planted';
    state.timeLeft = 24;
    state.bomb.planted = true;
    state.bomb.site = world.sites[0];
    bombGroup.position.set(world.sites[0].position.x, 0.2, world.sites[0].position.z);
    bombGroup.visible = true;
    hud.setAction('DISARMING / SITE A', 0.42);
  }
  updatePlayerTarget();
  syncCamera();
  updateHud(0.1);
}

hud.onPlay(startMatch);
hud.onBuy(buyItem);
hud.onCloseBuy(() => setBuyVisible(false));
if (shotMode) prepareShot(shotMode);
else hud.showIntro();

function frame(now) {
  requestAnimationFrame(frame);
  const elapsed = Math.min((now - state.lastTime) / 1000, 0.1);
  state.lastTime = now;
  if (!state.frozen) {
    state.accumulator += elapsed;
    let steps = 0;
    while (state.accumulator >= FIXED_STEP && steps < 5) {
      step(FIXED_STEP);
      state.accumulator -= FIXED_STEP;
      steps += 1;
    }
    if (state.accumulator > FIXED_STEP * 5) state.accumulator = 0;
  }
  renderer.render(scene, camera);
  if (shotMode && !window.__shotReady) {
    state.paintCount = (state.paintCount ?? 0) + 1;
    if (state.paintCount >= 4) window.__shotReady = true;
  }
}

window.__breakwater = {
  get phase() { return state.phase; },
  get round() { return state.round; },
  get agents() { return agents.bots; },
  get player() { return player.state; },
  get bomb() { return state.bomb; },
};

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

requestAnimationFrame(frame);
