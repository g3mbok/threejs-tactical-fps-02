export const COLORS = {
  void: '#07151c',
  deep: '#0c252c',
  steel: '#18383d',
  concrete: '#446065',
  salt: '#c4c6b8',
  mist: '#83aaa7',
  amber: '#f0a958',
  cyan: '#66d6cf',
  red: '#e57767',
  white: '#eff4e9',
};

export const TEAM = {
  attack: { name: 'ASHLINE', color: COLORS.amber, accent: COLORS.red },
  defend: { name: 'TIDEGUARD', color: COLORS.cyan, accent: COLORS.salt },
};

export function material(THREE, color, roughness = 0.78, metalness = 0.08) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness });
}
