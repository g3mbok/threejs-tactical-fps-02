import * as THREE from 'three';
import { COLORS, material } from './palette.js';

function signTexture(title, subtitle, tint) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 192;
  const context = canvas.getContext('2d');
  context.fillStyle = '#091b20';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = tint;
  context.fillRect(0, 0, 12, canvas.height);
  context.strokeStyle = '#34545a';
  context.lineWidth = 2;
  context.strokeRect(22, 18, 468, 156);
  context.fillStyle = '#e9eee2';
  context.font = '700 58px system-ui, sans-serif';
  context.fillText(title, 40, 92);
  context.fillStyle = '#91b2ad';
  context.font = '500 23px ui-monospace, monospace';
  context.fillText(subtitle, 42, 139);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function floorTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const context = canvas.getContext('2d');
  context.fillStyle = '#203b3d';
  context.fillRect(0, 0, 512, 512);
  context.strokeStyle = 'rgba(177,196,177,.14)';
  context.lineWidth = 2;
  for (let x = 0; x <= 512; x += 64) {
    context.beginPath();
    context.moveTo(x, 0);
    context.lineTo(x, 512);
    context.stroke();
  }
  for (let y = 0; y <= 512; y += 64) {
    context.beginPath();
    context.moveTo(0, y);
    context.lineTo(512, y);
    context.stroke();
  }
  context.fillStyle = 'rgba(240,169,88,.12)';
  for (let y = 12; y < 512; y += 64) {
    context.fillRect(0, y, 512, 3);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(5, 5);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function createWorld(scene) {
  const colliders = [];
  const shootables = [];
  const geometry = new Map();
  const mats = {
    concrete: material(THREE, COLORS.concrete, 0.94),
    dark: material(THREE, COLORS.deep, 0.92),
    steel: material(THREE, COLORS.steel, 0.7, 0.25),
    salt: material(THREE, COLORS.salt, 0.88),
    amber: material(THREE, COLORS.amber, 0.52, 0.18),
    cyan: material(THREE, COLORS.cyan, 0.45, 0.28),
    floor: new THREE.MeshStandardMaterial({
      color: '#b8c2ad',
      map: floorTexture(),
      roughness: 0.97,
    }),
    signA: new THREE.MeshBasicMaterial({ map: signTexture('A / SEAWALL', 'PUMP ACCESS  |  EAST RUN', COLORS.amber) }),
    signB: new THREE.MeshBasicMaterial({ map: signTexture('B / INTAKE', 'NORTH GALLERY  |  DEEP WATER', COLORS.cyan) }),
  };
  const level = new THREE.Group();
  scene.add(level);

  function box(w, h, d, x, y, z, mat, solid = true) {
    const key = `${w}:${h}:${d}`;
    let shape = geometry.get(key);
    if (!shape) {
      shape = new THREE.BoxGeometry(w, h, d);
      geometry.set(key, shape);
    }
    const mesh = new THREE.Mesh(shape, mats[mat] ?? mat);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    level.add(mesh);
    if (solid) {
      colliders.push(new THREE.Box3().setFromObject(mesh));
      shootables.push(mesh);
    }
    return mesh;
  }

  function cylinder(rt, rb, h, x, y, z, mat, segments = 12) {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, segments), mats[mat]);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    level.add(mesh);
    return mesh;
  }

  function label(name, x, y, z, rotationY, which) {
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 1.65), mats[which]);
    mesh.position.set(x, y, z);
    mesh.rotation.y = rotationY;
    level.add(mesh);
    return mesh;
  }

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(42, 38), mats.floor);
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, -0.21, 0);
  floor.receiveShadow = true;
  level.add(floor);

  box(42, 0.35, 0.45, 0, 0, -19, 'concrete');
  box(42, 0.35, 0.45, 0, 0, 19, 'concrete');
  box(0.45, 0.35, 38, -21, 0, 0, 'concrete');
  box(0.45, 0.35, 38, 21, 0, 0, 'concrete');
  box(42, 5.2, 0.6, 0, 2.6, -19, 'dark');
  box(42, 5.2, 0.6, 0, 2.6, 19, 'dark');
  box(0.6, 5.2, 38, -21, 2.6, 0, 'dark');
  box(0.6, 5.2, 38, 21, 2.6, 0, 'dark');

  box(3.2, 3.7, 0.5, -12.8, 1.85, 7.1, 'concrete');
  box(3.2, 3.7, 0.5, 12.8, 1.85, 7.1, 'concrete');
  box(0.5, 3.7, 11.6, -7.7, 1.85, 11.1, 'steel');
  box(0.5, 3.7, 11.6, 7.7, 1.85, 11.1, 'steel');
  box(0.5, 3.7, 11.4, -7.7, 1.85, -12.1, 'steel');
  box(0.5, 3.7, 11.4, 7.7, 1.85, -12.1, 'steel');

  box(2.2, 3.5, 0.6, -3.4, 1.75, -9.1, 'concrete');
  box(2.2, 3.5, 0.6, 3.4, 1.75, -9.1, 'concrete');
  box(0.6, 3.5, 4.8, -4.7, 1.75, -5.8, 'steel');
  box(0.6, 3.5, 4.8, 4.7, 1.75, -5.8, 'steel');

  for (const [x, z, w, h, d] of [
    [-14.4, -5.6, 3.5, 1.65, 2.4], [-10.2, -10.6, 2.6, 1.15, 2.2],
    [14.5, -5.8, 3.3, 1.65, 2.4], [10.1, -10.2, 2.8, 1.15, 2.2],
    [-2.7, 1.7, 2.4, 1.35, 2.2], [2.8, 2.2, 2.6, 1.35, 2.3],
    [0, -14.1, 2.8, 1.25, 2.0], [-17.2, 3.3, 1.6, 1.25, 1.6],
    [17.2, 3.5, 1.6, 1.25, 1.6], [-9.7, 3.2, 1.5, 1.0, 1.5],
    [9.4, 3.2, 1.5, 1.0, 1.5],
  ]) {
    box(w, h, d, x, h / 2, z, 'steel');
    box(w * 0.84, 0.08, d * 0.86, x, h + 0.04, z, 'amber', false);
  }

  for (let x = -18; x <= 18; x += 6) {
    box(0.22, 2.3, 0.22, x, 1.15, -16.7, 'salt', false);
    box(0.22, 2.3, 0.22, x, 1.15, 16.7, 'salt', false);
  }
  for (const x of [-18.4, 18.4]) {
    box(0.18, 0.18, 35, x, 4.1, 0, 'amber', false);
    for (let z = -15; z <= 15; z += 5) cylinder(0.18, 0.18, 0.22, x, 4.1, z, 'amber', 8);
  }

  const signageA = label('A', -14.1, 3.1, -17.9, 0, 'signA');
  const signageB = label('B', 14.1, 3.1, -17.9, 0, 'signB');
  signageA.castShadow = false;
  signageB.castShadow = false;
  box(5.2, 0.18, 1.0, -12, 0.1, -4.0, 'amber', false);
  box(5.2, 0.18, 1.0, 12, 0.1, -4.0, 'cyan', false);
  box(0.8, 3.6, 0.8, -18.4, 1.8, -12.2, 'salt');
  box(0.8, 3.6, 0.8, 18.4, 1.8, -12.2, 'salt');
  box(0.8, 3.6, 0.8, -18.4, 1.8, 12.2, 'salt');
  box(0.8, 3.6, 0.8, 18.4, 1.8, 12.2, 'salt');

  const siteGeometry = new THREE.CylinderGeometry(3.0, 3.0, 0.035, 8);
  const sites = [
    { id: 'A', name: 'SEAWALL', position: new THREE.Vector3(-12, 0.03, -4), color: COLORS.amber, team: 'attack' },
    { id: 'B', name: 'INTAKE', position: new THREE.Vector3(12, 0.03, -4), color: COLORS.cyan, team: 'attack' },
  ];
  for (const site of sites) {
    const mesh = new THREE.Mesh(siteGeometry, new THREE.MeshBasicMaterial({ color: site.color, transparent: true, opacity: 0.12 }));
    mesh.position.copy(site.position);
    mesh.scale.set(1, 1, 0.84);
    level.add(mesh);
    const beacon = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.2, 1.1, 8), mats[site.id === 'A' ? 'amber' : 'cyan']);
    beacon.position.set(site.position.x, 0.55, site.position.z);
    level.add(beacon);
    site.marker = mesh;
    site.beacon = beacon;
  }

  for (let i = 0; i < 10; i += 1) {
    const x = -18 + i * 4;
    box(0.11, 0.11, 0.11, x, 5.0, 0, 'amber', false);
  }

  const ambient = new THREE.HemisphereLight('#abc7c0', '#17282a', 1.55);
  scene.add(ambient);
  const sun = new THREE.DirectionalLight('#f8dfb5', 2.35);
  sun.position.set(-11, 18, 8);
  sun.target.position.set(0, 0, -2);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1536, 1536);
  sun.shadow.camera.left = -25;
  sun.shadow.camera.right = 25;
  sun.shadow.camera.top = 24;
  sun.shadow.camera.bottom = -24;
  sun.shadow.camera.far = 54;
  sun.shadow.bias = -0.0007;
  scene.add(sun, sun.target);
  const rim = new THREE.DirectionalLight('#4ab5b5', 0.85);
  rim.position.set(14, 8, -15);
  scene.add(rim);

  const lights = [];
  for (const site of sites) {
    const light = new THREE.PointLight(site.color, 24, 11, 2);
    light.position.set(site.position.x, 3.0, site.position.z);
    scene.add(light);
    lights.push(light);
  }

  return {
    colliders,
    shootables,
    sites,
    lights,
    bounds: { minX: -20.1, maxX: 20.1, minZ: -18.1, maxZ: 18.1 },
    spawns: {
      attack: [new THREE.Vector3(-1.3, 0, 14), new THREE.Vector3(0, 0, 15), new THREE.Vector3(1.3, 0, 14)],
      defend: [new THREE.Vector3(-1.3, 0, -14), new THREE.Vector3(0, 0, -15), new THREE.Vector3(1.3, 0, -14)],
    },
    routes: {
      attackA: [new THREE.Vector3(0, 0, 11), new THREE.Vector3(-3.5, 0, 7), new THREE.Vector3(-7.1, 0, 2), new THREE.Vector3(-10.2, 0, -2.4)],
      attackB: [new THREE.Vector3(0, 0, 11), new THREE.Vector3(3.5, 0, 7), new THREE.Vector3(7.1, 0, 2), new THREE.Vector3(10.2, 0, -2.4)],
      defendA: [new THREE.Vector3(-1.5, 0, -11), new THREE.Vector3(-6.3, 0, -8), new THREE.Vector3(-10.2, 0, -4.3)],
      defendB: [new THREE.Vector3(1.5, 0, -11), new THREE.Vector3(6.3, 0, -8), new THREE.Vector3(10.2, 0, -4.3)],
    },
    materials: mats,
  };
}
