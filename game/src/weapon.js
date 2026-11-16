import * as THREE from 'three';
import { COLORS, material } from './palette.js';

export const ARSENAL = [
  { id: 'kestrel', name: 'Kestrel R4', role: 'ASSAULT RIFLE', price: 2700, damage: 32, head: 96, gap: 0.115, reload: 1.85, mag: 28, reserve: 84, spread: 0.0022, moveSpread: 0.029, pellets: 1, auto: true, recoil: 0.013 },
  { id: 'current', name: 'Current-9', role: 'COMPACT SMG', price: 1700, damage: 23, head: 69, gap: 0.075, reload: 1.6, mag: 36, reserve: 108, spread: 0.0048, moveSpread: 0.036, pellets: 1, auto: true, recoil: 0.008 },
  { id: 'osprey', name: 'Osprey 7', role: 'MARKSMAN RIFLE', price: 3250, damage: 68, head: 100, gap: 0.33, reload: 2.1, mag: 12, reserve: 48, spread: 0.0011, moveSpread: 0.024, pellets: 1, auto: false, recoil: 0.026 },
  { id: 'breaker', name: 'Breaker 8', role: 'BREACH SHOTGUN', price: 2400, damage: 11, head: 19, gap: 0.72, reload: 2.2, mag: 8, reserve: 32, spread: 0.055, moveSpread: 0.085, pellets: 8, auto: false, recoil: 0.035 },
];

const MAG_SIZE = 30;

export function createWeapon(camera) {
  const model = new THREE.Group();
  const shell = material(THREE, '#24383b', 0.46, 0.56);
  const edge = material(THREE, '#71817a', 0.36, 0.72);
  const polymer = material(THREE, '#101e22', 0.77, 0.15);
  const brass = material(THREE, COLORS.amber, 0.34, 0.72);
  const sleeve = material(THREE, '#9a7d64', 0.92);
  const flash = new THREE.Mesh(
    new THREE.PlaneGeometry(0.28, 0.22),
    new THREE.MeshBasicMaterial({ color: '#ffd49a', transparent: true, opacity: 0.9, depthWrite: false, side: THREE.DoubleSide }),
  );
  flash.position.set(0.25, -0.17, -1.05);
  flash.visible = false;
  const flashLight = new THREE.PointLight(COLORS.amber, 0, 4);
  flashLight.position.set(0.25, -0.16, -0.72);
  camera.add(model, flash, flashLight);

  const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.15, 0.48), shell);
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.032, 0.54, 10), edge);
  barrel.rotation.x = Math.PI / 2;
  barrel.position.set(0, 0.03, -0.48);
  const handguard = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.12, 0.28), polymer);
  handguard.position.set(0, 0.01, -0.25);
  const stock = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.25), polymer);
  stock.position.set(0, -0.015, 0.34);
  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.18, 0.12), polymer);
  grip.position.set(0, -0.13, 0.12);
  grip.rotation.x = -0.2;
  const sight = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.1, 0.14), brass);
  sight.position.set(0, 0.13, -0.08);
  const frontSight = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.07, 0.04), edge);
  frontSight.position.set(0, 0.12, -0.57);
  const forearm = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.13, 0.39), sleeve);
  forearm.position.set(-0.15, -0.19, -0.19);
  forearm.rotation.z = 0.14;
  const supportHand = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.11, 0.16), sleeve);
  supportHand.position.set(-0.12, -0.15, -0.3);
  model.add(receiver, barrel, handguard, stock, grip, sight, frontSight, forearm, supportHand);
  model.position.set(0.29, -0.25, -0.46);
  model.rotation.y = -0.035;

  const state = {
    id: 'kestrel',
    mag: MAG_SIZE,
    reserve: 84,
    cooldown: 0,
    reloadLeft: 0,
    flashLeft: 0,
    kick: 0,
    sway: 0,
    ads: false,
  };
  let definition = ARSENAL[0];

  function equip(id, refill = true) {
    definition = ARSENAL.find((item) => item.id === id) ?? ARSENAL[0];
    state.id = definition.id;
    if (refill) {
      state.mag = definition.mag;
      state.reserve = definition.reserve;
      state.reloadLeft = 0;
      state.cooldown = 0;
    }
    const compact = definition.id === 'current';
    const long = definition.id === 'osprey';
    const heavy = definition.id === 'breaker';
    handguard.scale.z = compact ? 0.72 : long ? 1.4 : heavy ? 1.18 : 1;
    barrel.scale.y = long ? 1.28 : heavy ? 0.78 : compact ? 0.8 : 1;
    sight.visible = !heavy;
    stock.scale.z = compact ? 0.78 : 1;
  }

  function step(dt, speed, aiming) {
    state.cooldown = Math.max(0, state.cooldown - dt);
    state.flashLeft = Math.max(0, state.flashLeft - dt);
    state.kick += (0 - state.kick) * Math.min(1, dt * 13);
    state.ads = aiming;
    const swayTarget = Math.min(1, speed / 6);
    state.sway += (swayTarget - state.sway) * Math.min(1, dt * 7);
    model.position.x = (aiming ? 0.12 : 0.29) + Math.sin(performance.now() * 0.004) * state.sway * 0.006;
    model.position.y = (aiming ? -0.19 : -0.25) - state.kick * 0.2 + Math.abs(Math.sin(performance.now() * 0.009)) * state.sway * 0.008;
    model.position.z = -0.46 + state.kick;
    model.rotation.x = state.kick * 1.3;
    flash.visible = state.flashLeft > 0;
    flash.rotation.z += dt * 18;
    flashLight.intensity = state.flashLeft > 0 ? 13 : 0;
    if (state.reloadLeft > 0) {
      state.reloadLeft = Math.max(0, state.reloadLeft - dt);
      model.rotation.x = -0.5 * Math.sin((definition.reload - state.reloadLeft) / definition.reload * Math.PI);
      if (state.reloadLeft === 0) {
        const amount = Math.min(definition.mag - state.mag, state.reserve);
        state.mag += amount;
        state.reserve -= amount;
      }
    }
  }

  return {
    state,
    get definition() { return definition; },
    equip,
    step,
    ready() { return state.mag > 0 && state.cooldown <= 0 && state.reloadLeft <= 0; },
    takeRound() {
      if (!this.ready()) return false;
      state.mag -= 1;
      state.cooldown = definition.gap;
      state.kick = definition.id === 'osprey' ? 0.11 : definition.id === 'breaker' ? 0.09 : 0.055;
      state.flashLeft = 0.065;
      return true;
    },
    reload() {
      if (state.reloadLeft > 0 || state.mag === definition.mag || state.reserve <= 0) return false;
      state.reloadLeft = definition.reload;
      return true;
    },
    spread(speed, aiming) {
      const move = Math.min(1, speed / 5.4);
      return (definition.spread + definition.moveSpread * move) * (aiming ? 0.54 : 1);
    },
    refill() {
      state.mag = definition.mag;
      state.reserve = definition.reserve;
      state.cooldown = 0;
      state.reloadLeft = 0;
      state.flashLeft = 0;
      state.kick = 0;
    },
  };
}
