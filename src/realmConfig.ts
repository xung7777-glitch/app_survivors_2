export interface RealmInfo {
  name: string;
  desc: string;
}

export interface GreatRealmInfo {
  name: string;
  damage: number;
  swordCount: number;
}

export const REALM_LEVELS: Record<number, RealmInfo> = {
  10: { name: "煉氣初期", desc: "初步感知靈氣，開始引氣入體" },
  20: { name: "練氣中期", desc: "經脈逐漸打通，靈氣運行穩定" },
  30: { name: "練氣後期", desc: "靈氣充盈，準備突破築基" },
  40: { name: "築基初期", desc: "建立修行根基，靈氣轉為內息" },
  50: { name: "築基中期", desc: "根基穩固，體質大幅強化" },
  60: { name: "築基後期", desc: "內息圓滿，具備結丹條件" },
  70: { name: "結丹初期", desc: "金丹初成，能量凝聚成核" },
  80: { name: "結丹中期", desc: "金丹穩定運轉，力量持續增強" },
  90: { name: "結丹後期", desc: "金丹圓圓，準備破丹化嬰" },
  100: { name: "元嬰境", desc: "元嬰成形，可分神操控、短暫離體" },
};

export const GREAT_REALMS: { threshold: number; info: GreatRealmInfo }[] = [
  { threshold: 30, info: { name: "煉氣期", damage: 150, swordCount: 5 } },
  { threshold: 60, info: { name: "築基期", damage: 800, swordCount: 5 } },
  { threshold: 90, info: { name: "結丹期", damage: 4000, swordCount: 5 } },
  { threshold: 999, info: { name: "元嬰期", damage: 20000, swordCount: 5 } },
];

export const GAME_BALANCE = {
  BASE: {
    PLAYER_HP: 300,
    PLAYER_DAMAGE: 25,    // 稍微提高初始攻擊
    PLAYER_SWORDS: 1,
    UPGRADE_DAMAGE: 10,     // 提高升級攻擊力
    UPGRADE_SWORDS: 1,
    UPGRADE_COOLDOWN: 0.1, // 10% reduction
    ENEMY_HP: 12,          // 降低基礎怪物血量
    ENEMY_GROWTH: 1.06,    // 成長率降至 1.06 (極其重要，防止後期血量爆炸)
    EXP_REQUIRED: 50,      // 初始等級所需經驗
    EXP_INCREASE_BASE: 100, // 每次升級增加的基礎經驗
    EXP_INCREASE_RATIO: 15, // 降低經驗需求增速
    PLAYER_PICKUP_RANGE: 120, // 調大初始拾取範圍提高爽感
    UPGRADE_PICKUP_RANGE: 40,
  }
};

/**
 * 取得當前等級的詳細境界內容
 */
export const getRealmInfo = (level: number): RealmInfo => {
  const levels = Object.keys(REALM_LEVELS).map(Number).sort((a, b) => a - b);
  for (const threshold of levels) {
    if (level <= threshold) return REALM_LEVELS[threshold];
  }
  return { name: "化神境", desc: "神識完全覺識，意念可影響外界" };
};

/**
 * 取得當前大境界（影響必殺技數值）
 */
export const getGreatRealm = (level: number): GreatRealmInfo => {
  for (const entry of GREAT_REALMS) {
    if (level <= entry.threshold) return entry.info;
  }
  return GREAT_REALMS[GREAT_REALMS.length - 1].info;
};

/**
 * 計算升下一級所需的經驗值
 * 若需要「簡單版」有不同的經驗曲線，可在此調整
 */
export const getNextLevelExp = (currentLevel: number, currentNextLevelExp: number): number => {
  // 這裡維持原有的邏輯：player.nextLevelExp += 100 + (player.level * 20);
  return currentNextLevelExp + GAME_BALANCE.BASE.EXP_INCREASE_BASE + (currentLevel * GAME_BALANCE.BASE.EXP_INCREASE_RATIO);
};
