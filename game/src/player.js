import * as THREE from 'three';

const RADIUS = 0.34;
const STAND_HEIGHT = 1.76;
const CROUCH_HEIGHT = 1.14;
const EYE_STAND = 1.62;
const EYE_CROUCH = 1.04;
const WALK_SPEED = 5.4;
const CROUCH_SPEED = 2.45;
const SPRINT_SPEED = 7.0;
const GRAVITY = 21;

export function createPlayer(colliders, bounds, spawn, yaw) {
  const state = {
    position: spawn.clone(),
    velocity: new THREE.Vector3(),
    yaw,
    pitch: 0,
    eye: EYE_STAND,
    height: STAND_HEIGHT,
    crouching: false,
    grounded: true,
    health: 100,
    armor: 75,
    alive: true,
    kills: 0,
    assists: 0,
  };
  const probe = new THREE.Box3();
  const wish = new THREE.Vector3();
  const desired = new THREE.Vector3();

  function overlaps(x, y, z, height, margin = 0.035) {
    probe.min.set(x - RADIUS + margin, y + margin, z - RADIUS + margin);
    probe.max.set(x + RADIUS - margin, y + height - margin, z + RADIUS - margin);
    for (const collider of colliders) {
      if (probe.intersectsBox(collider)) return collider;
    }
    return null;
  }

  function look(dx, dy, sensitivity = 0.00205) {
    state.yaw -= dx * sensitivity;
    state.pitch = THREE.MathUtils.clamp(state.pitch - dy * sensitivity, -1.42, 1.42);
  }

  function recoil(pitchKick, yawKick) {
    state.pitch = Math.min(1.42, state.pitch + pitchKick);
    state.yaw += yawKick;
  }

  function reset(nextSpawn, nextYaw) {
    state.position.copy(nextSpawn);
    state.velocity.set(0, 0, 0);
    state.yaw = nextYaw;
    state.pitch = 0;
    state.eye = EYE_STAND;
    state.height = STAND_HEIGHT;
    state.crouching = false;
    state.grounded = true;
    state.health = 100;
    state.armor = 75;
    state.alive = true;
  }

  function step(dt, keys) {
    const crouching = keys.has('ControlLeft') || keys.has('ControlRight') || keys.has('KeyC');
    if (crouching) {
      state.crouching = true;
      state.height = CROUCH_HEIGHT;
    } else if (state.crouching && !overlaps(state.position.x, state.position.y, state.position.z, STAND_HEIGHT)) {
      state.crouching = false;
      state.height = STAND_HEIGHT;
    }
    const eyeTarget = state.crouching ? EYE_CROUCH : EYE_STAND;
    state.eye += (eyeTarget - state.eye) * Math.min(1, dt * 13);

    const forward = Number(keys.has('KeyW')) - Number(keys.has('KeyS'));
    const strafe = Number(keys.has('KeyD')) - Number(keys.has('KeyA'));
    wish.set(0, 0, 0);
    if (forward || strafe) {
      const sin = Math.sin(state.yaw);
      const cos = Math.cos(state.yaw);
      wish.set(-sin * forward + cos * strafe, 0, -cos * forward - sin * strafe).normalize();
    }

    const sprinting = keys.has('ShiftLeft') || keys.has('ShiftRight');
    const speed = state.crouching ? CROUCH_SPEED : sprinting ? SPRINT_SPEED : WALK_SPEED;
    desired.copy(wish).multiplyScalar(speed);
    const acceleration = state.grounded ? 33 : 8;
    const blend = Math.min(1, acceleration * dt / Math.max(speed, 1));
    state.velocity.x += (desired.x - state.velocity.x) * blend;
    state.velocity.z += (desired.z - state.velocity.z) * blend;
    if (state.grounded && wish.lengthSq() === 0) {
      const friction = Math.max(0, 1 - (state.crouching ? 12 : 8) * dt);
      state.velocity.x *= friction;
      state.velocity.z *= friction;
    }

    if (keys.has('Space') && state.grounded) {
      state.velocity.y = 6.4;
      state.grounded = false;
    }
    state.velocity.y -= GRAVITY * dt;

    const nextX = THREE.MathUtils.clamp(state.position.x + state.velocity.x * dt, bounds.minX, bounds.maxX);
    if (!overlaps(nextX, state.position.y, state.position.z, state.height)) state.position.x = nextX;
    else state.velocity.x = 0;
    const nextZ = THREE.MathUtils.clamp(state.position.z + state.velocity.z * dt, bounds.minZ, bounds.maxZ);
    if (!overlaps(state.position.x, state.position.y, nextZ, state.height)) state.position.z = nextZ;
    else state.velocity.z = 0;

    state.position.y += state.velocity.y * dt;
    state.grounded = false;
    const hit = overlaps(state.position.x, state.position.y, state.position.z, state.height, 0);
    if (hit && state.velocity.y <= 0) {
      state.position.y = hit.max.y;
      state.velocity.y = 0;
      state.grounded = true;
    } else if (hit) {
      state.position.y = hit.min.y - state.height;
      state.velocity.y = 0;
    }
    if (state.position.y < 0) {
      state.position.y = 0;
      state.velocity.y = 0;
      state.grounded = true;
    }
    state.velocity.y = Math.max(-28, state.velocity.y);
  }

  return {
    state,
    look,
    recoil,
    reset,
    step,
    speed() {
      return Math.hypot(state.velocity.x, state.velocity.z);
    },
  };
}
