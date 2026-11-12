export type Point = { x: number; y: number };

export enum GameState {
  MENU = "MENU",
  PLAYING = "PLAYING",
  PAUSED = "PAUSED",
  UPGRADE = "UPGRADE",
  GAMEOVER = "GAMEOVER",
  WIN = "WIN",
  CONFIRM_EXIT = "CONFIRM_EXIT",
  CHARACTER_SELECT = "CHARACTER_SELECT",
  BESTIARY = "BESTIARY",
}

export interface CharacterStyle {
  id: string;
  name: string;
  description: string;
  image?: string;
  btnPosition?: string;
  btnScale?: string;
  gameScale?: number;
  previewScale?: number;
  cutInPosition?: string;
  cutInScale?: string;
  ultimateName?: string;
  ultimateFontSize?: number;
  gender?: 'male' | 'female';
  projectileType?: 'sword' | 'palm';
  ultimateType?: 'radial' | 'heavenly_impact';
  stats?: {
    baseAttack?: number;
    baseSpeed?: number;
    baseHealth?: number;
    baseUltCount?: number;
    maxUltCount?: number;
    baseWeaponCount?: number;
    baseUltWeaponCount?: number;
    basePickupRange?: number;
    baseAttackSpeed?: number;
    baseWeaponRange?: number;
    baseWeaponScale?: number;
  };
  colors?: {
    hair: string;
    skin: string;
    eye: string;
    clothes: string;
  };
}

export enum UpgradeType {
  WEAPON_SPEED = "WEAPON_SPEED",
  WEAPON_DAMAGE = "WEAPON_DAMAGE",
  WEAPON_COUNT = "WEAPON_COUNT",
  PLAYER_SPEED = "PLAYER_SPEED",
  MAX_HP = "MAX_HP",
  PICKUP_RANGE = "PICKUP_RANGE",
  NEW_WEAPON = "NEW_WEAPON",
  ULTIMATE_SWORDS = "ULTIMATE_SWORDS",
  WEAPON_RANGE = "WEAPON_RANGE",
  WEAPON_SCALE = "WEAPON_SCALE",
}

export interface Upgrade {
  id: string;
  name: string;
  description: string;
  type: UpgradeType;
  level: number;
  maxLevel: number;
  icon: string;
}

export interface Weapon {
  id: string;
  name: string;
  damage: number;
  cooldown: number;
  lastFired: number;
  range: number;
  count: number;
  level: number;
  scale?: number;
  type: "SWORD" | "TALISMAN" | "ELEMENTAL";
}

export interface Entity {
  id: string;
  x: number;
  y: number;
  radius: number;
  hp: number;
  maxHp: number;
  speed: number;
}

export interface Player extends Entity {
  exp: number;
  level: number;
  nextLevelExp: number;
  weapons: Weapon[];
  pickupRange: number;
}

export interface Enemy extends Entity {
  damage: number;
  expValue: number;
  type: "DEMON" | "SPIRIT" | "CULTIVATOR";
  color: string;
  level: number;
  isBoss?: boolean;
  visualType: number;
  dropChance?: number;
  lastAttackTime?: number;
  attackCooldown?: number;
  seed?: number;
}

export interface Projectile {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  damage: number;
  life: number; // time to live
  color: string;
  ownerId: string;
  isUltimate?: boolean;
  phase?: "BACK" | "PAUSE" | "FORWARD";
  phaseTimer?: number;
  type?: "PLAYER_SWORD" | "BOSS_ATTACK" | "BOSS_SILK" | "BOSS_SONIC" | "BOSS_FIRE" | "BOSS_ICE" | "BOSS_THUNDER" | "BOSS_BLADE";
  renderType?: 'sword' | 'palm';
  effectSize?: number;
  seed?: number;
}

export interface Gem {
  id: string;
  x: number;
  y: number;
  value: number;
  type: "SMALL" | "MEDIUM" | "LARGE";
}

export interface Lightning {
  id: string;
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  life: number;
}
