import * as THREE from 'three';
import { TEAM } from './palette.js';

const BOT_COUNT = 7;
const BODY_HEIGHT = 1.68;
const BODY_RADIUS = 0.34;

export function createAgents(scene, world) {
  const torsoGeometry = new THREE.BoxGeometry(0.58, 0.76, 0.34);
  const headGeometry = new THREE.SphereGeometry(0.19, 14, 12);
  const helmetGeometry = new THREE.SphereGeometry(0.205, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2);
  const limbGeometry = new THREE.BoxGeometry(0.2, 0.62, 0.22);
  const padGeometry = new THREE.BoxGeometry(0.23, 0.24, 0.38);
  const gunGeometry = new THREE.BoxGeometry(0.08, 0.08, 0.62);
  const visorGeometry = new THREE.BoxGeometry(0.26, 0.065, 0.04);
  const bots = [];

  function makeBot(index) {
    const group = new THREE.Group();
    const mats = {
      attack: new THREE.MeshStandardMaterial({ color: '#b9854d', roughness: 0.82 }),
      dark: new THREE.MeshStandardMaterial({ color: '#17272a', roughness: 0.55, metalness: 0.24 }),
      cloth: new THREE.MeshStandardMaterial({ color: '#37474a', roughness: 0.96 }),
      glass: new THREE.MeshStandardMaterial({ color: '#b9f1dc', roughness: 0.25, metalness: 0.36, emissive: '#173a33' }),
    };
    const torso = new THREE.Mesh(torsoGeometry, mats.cloth);
    torso.position.y = 1.16;
    const vest = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.56, 0.38), mats.attack);
    vest.position.set(0, 1.2, 0.01);
    const head = new THREE.Mesh(headGeometry, mats.cloth);
    head.position.y = 1.79;
    const helmet = new THREE.Mesh(helmetGeometry, mats.dark);
    helmet.position.y = 1.86;
    helmet.rotation.x = -Math.PI / 2;
    const visor = new THREE.Mesh(visorGeometry, mats.glass);
    visor.position.set(0, 1.81, -0.17);
    const leftArm = new THREE.Mesh(limbGeometry, mats.cloth);
    leftArm.position.set(-0.4, 1.08, -0.02);
    leftArm.rotation.z = 0.12;
    const rightArm = new THREE.Mesh(limbGeometry, mats.cloth);
    rightArm.position.set(0.4, 1.08, -0.02);
    rightArm.rotation.z = -0.12;
    const leftPad = new THREE.Mesh(padGeometry, mats.dark);
    leftPad.position.set(-0.32, 1.42, 0);
    const rightPad = new THREE.Mesh(padGeometry, mats.dark);
    rightPad.position.set(0.32, 1.42, 0);
    const leftLeg = new THREE.Mesh(limbGeometry, mats.dark);
    leftLeg.scale.y = 0.78;
    leftLeg.position.set(-0.16, 0.43, 0);
    const rightLeg = new THREE.Mesh(limbGeometry, mats.dark);
    rightLeg.scale.y = 0.78;
    rightLeg.position.set(0.16, 0.43, 0);
    const gun = new THREE.Mesh(gunGeometry, mats.dark);
    gun.position.set(0.28, 1.0, -0.4);
    gun.rotation.x = -0.08;
    group.add(torso, vest, head, helmet, visor, leftArm, rightArm, leftPad, rightPad, leftLeg, rightLeg, gun);
    group.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
    scene.add(group);
    const bot = {
      id: index,
      group,
      torso,
      head,
      leftLeg,
      rightLeg,
      mats,
      side: 'defend',
      teamColor: TEAM.defend.color,
      position: new THREE.Vector3(),
      velocity: new THREE.Vector3(),
      health: 100,
      armor: 40,
      alive: true,
      routeKey: 'defendA',
      routeIndex: 0,
      targetId: null,
      thinkIn: 0,
      fireIn: 0.8 + (index % 4) * 0.22,
      strafe: index % 2 ? 1 : -1,
      phase: index * 1.3,
      kills: 0,
      assists: 0,
      probe: new THREE.Box3(),
      aimDestination: new THREE.Vector3(),
      plantProgress: 0,
    };
    torso.userData.agent = bot;
    torso.userData.part = 'body';
    head.userData.agent = bot;
    head.userData.part = 'head';
    bot.hitMeshes = [torso, head];
    bots.push(bot);
    return bot;
  }

  for (let index = 0; index < BOT_COUNT; index += 1) makeBot(index);

  function setSide(bot, side, spawn) {
    bot.side = side;
    bot.teamColor = TEAM[side].color;
    bot.mats.attack.color.set(side === 'attack' ? '#b9854d' : '#398d89');
    bot.position.copy(spawn);
    bot.velocity.set(0, 0, 0);
    bot.group.position.copy(bot.position);
    bot.group.visible = true;
    bot.health = 100;
    bot.armor = 40;
    bot.alive = true;
    bot.targetId = null;
    bot.thinkIn = 0;
    bot.fireIn = 0.6 + (bot.id % 5) * 0.24;
    bot.routeIndex = 0;
    bot.plantProgress = 0;
    bot.routeKey = side === 'attack' ? (bot.id % 2 ? 'attackA' : 'attackB') : (bot.id % 2 ? 'defendA' : 'defendB');
    bot.group.rotation.set(0, side === 'attack' ? Math.PI : 0, 0);
  }

  function reset(playerSide, round) {
    const side = playerSide === 'attack' ? 'defend' : 'attack';
    for (let index = 0; index < bots.length; index += 1) {
      const botSide = index < 3 ? playerSide : side;
      const spawn = world.spawns[botSide][index % world.spawns[botSide].length];
      setSide(bots[index], botSide, spawn);
      if (index >= 3) {
        const offset = index % 2 ? -1.5 : 1.5;
        bots[index].position.x += offset;
        bots[index].group.position.x += offset;
      }
      bots[index].phase = round * 0.31 + index * 1.3;
    }
  }

  function move(bot, vector, dt) {
    const speed = 2.45;
    const dx = vector.x - bot.position.x;
    const dz = vector.z - bot.position.z;
    const length = Math.hypot(dx, dz);
    if (length < 0.06) {
      bot.velocity.x *= 0.65;
      bot.velocity.z *= 0.65;
      return;
    }
    const desiredX = dx / length * speed;
    const desiredZ = dz / length * speed;
    const blend = Math.min(1, dt * 6.5);
    bot.velocity.x += (desiredX - bot.velocity.x) * blend;
    bot.velocity.z += (desiredZ - bot.velocity.z) * blend;
    const nextX = THREE.MathUtils.clamp(bot.position.x + bot.velocity.x * dt, world.bounds.minX, world.bounds.maxX);
    const nextZ = THREE.MathUtils.clamp(bot.position.z + bot.velocity.z * dt, world.bounds.minZ, world.bounds.maxZ);
    const probe = bot.probe;
    let blockedX = false;
    let blockedZ = false;
    for (const obstacle of world.colliders) {
      probe.min.set(nextX - BODY_RADIUS, 0.05, bot.position.z - BODY_RADIUS);
      probe.max.set(nextX + BODY_RADIUS, BODY_HEIGHT, bot.position.z + BODY_RADIUS);
      if (probe.intersectsBox(obstacle)) blockedX = true;
      probe.min.set(bot.position.x - BODY_RADIUS, 0.05, nextZ - BODY_RADIUS);
      probe.max.set(bot.position.x + BODY_RADIUS, BODY_HEIGHT, nextZ + BODY_RADIUS);
      if (probe.intersectsBox(obstacle)) blockedZ = true;
    }
    if (!blockedX) bot.position.x = nextX;
    else bot.velocity.x = 0;
    if (!blockedZ) bot.position.z = nextZ;
    else bot.velocity.z = 0;
    const moving = Math.hypot(bot.velocity.x, bot.velocity.z) > 0.2;
    if (moving) {
      bot.group.rotation.y = Math.atan2(-bot.velocity.x, -bot.velocity.z);
      bot.leftLeg.rotation.x = Math.sin(performance.now() * 0.012 + bot.phase) * 0.3;
      bot.rightLeg.rotation.x = -bot.leftLeg.rotation.x;
    } else {
      bot.leftLeg.rotation.x *= 0.75;
      bot.rightLeg.rotation.x *= 0.75;
    }
  }

  function step(dt, time, player, visible, fire, plantedSite) {
    for (const bot of bots) {
      if (!bot.alive) continue;
      bot.fireIn -= dt;
      bot.thinkIn -= dt;
      let target = null;
      let targetDistance = Infinity;
      if (bot.thinkIn <= 0) {
        bot.thinkIn = 0.16 + (bot.id % 3) * 0.04;
        if (player.alive && player.side !== bot.side) {
          const dx = player.position.x - bot.position.x;
          const dz = player.position.z - bot.position.z;
          const distance = Math.hypot(dx, dz);
          if (distance < targetDistance && distance <= 24 && visible(bot, player, distance)) {
            target = player;
            targetDistance = distance;
          }
        }
        for (const other of bots) {
          if (!other.alive || other.side === bot.side || other === bot) continue;
          const dx = other.position.x - bot.position.x;
          const dz = other.position.z - bot.position.z;
          const distance = Math.hypot(dx, dz);
          if (distance < targetDistance && distance <= 24 && visible(bot, other, distance)) {
            target = other;
            targetDistance = distance;
          }
        }
        bot.targetId = target?.id ?? (target === player ? -1 : null);
      } else if (bot.targetId !== null) {
        target = bot.targetId === -1
          ? player
          : bots.find((candidate) => candidate.id === bot.targetId && candidate.alive && candidate.side !== bot.side);
        if (target) targetDistance = Math.hypot(target.position.x - bot.position.x, target.position.z - bot.position.z);
      }

      const route = world.routes[bot.routeKey];
      let destination = route[Math.min(bot.routeIndex, route.length - 1)];
      if (target && targetDistance < 18) {
        const aimX = target.position.x - bot.position.x;
        const aimZ = target.position.z - bot.position.z;
        bot.group.rotation.y = Math.atan2(-aimX, -aimZ);
        if (targetDistance > 8) {
          destination = bot.aimDestination.set(
            target.position.x + (-aimZ / targetDistance) * 4 * bot.strafe,
            0,
            target.position.z + (aimX / targetDistance) * 4 * bot.strafe,
          );
        } else {
          destination = bot.position;
          if (targetDistance < 5 && (bot.id + Math.floor(time * 2)) % 2 === 0) {
            destination = bot.aimDestination.set(bot.position.x + aimZ * 0.6, 0, bot.position.z - aimX * 0.6);
          }
        }
        if (bot.fireIn <= 0 && targetDistance < 18 && visible(bot, target, targetDistance)) {
          bot.fireIn = 0.72 + (bot.id % 3) * 0.12;
          fire(bot, target, targetDistance);
        }
      } else if (bot.side === 'attack' && plantedSite && Math.hypot(bot.position.x - plantedSite.position.x, bot.position.z - plantedSite.position.z) > 4) {
        destination = plantedSite.position;
      }
      if (destination && Math.hypot(destination.x - bot.position.x, destination.z - bot.position.z) < 0.8) {
        if (bot.routeIndex < route.length - 1) bot.routeIndex += 1;
        else if (bot.side === 'defend') bot.routeIndex = Math.max(0, bot.routeIndex - 1);
        destination = route[Math.min(bot.routeIndex, route.length - 1)];
      }
      if (destination) move(bot, destination, dt);
      bot.group.position.set(bot.position.x, Math.abs(Math.sin(time * 8 + bot.phase)) * Math.min(0.04, Math.hypot(bot.velocity.x, bot.velocity.z) * 0.008), bot.position.z);
    }
  }

  function damage(bot, amount) {
    if (!bot || !bot.alive) return false;
    const absorbed = Math.min(bot.armor, amount * 0.42);
    bot.armor -= absorbed;
    bot.health -= amount - absorbed;
    if (bot.health > 0) return false;
    bot.alive = false;
    bot.group.visible = false;
    return true;
  }

  function aliveCount(side) {
    let count = 0;
    for (const bot of bots) if (bot.alive && bot.side === side) count += 1;
    return count;
  }

  return { bots, reset, step, damage, aliveCount };
}
