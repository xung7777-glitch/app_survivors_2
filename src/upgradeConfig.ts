import { Upgrade, UpgradeType } from "./types";

export interface UpgradeTemplate {
  id: string;
  name: string;
  description: string;
  type: UpgradeType;
  maxLevel: number;
  icon: string;
}

export const UPGRADE_TEMPLATES: UpgradeTemplate[] = [
  { id: "speed", name: "御劍速度提升", description: "增加御劍飛行速度", type: UpgradeType.PLAYER_SPEED, maxLevel: 999, icon: "Wind" },
  { id: "damage", name: "劍意增強", description: "增加飛劍攻擊的傷害", type: UpgradeType.WEAPON_DAMAGE, maxLevel: 999, icon: "Flame" },
  { id: "cooldown", name: "靈力充沛", description: "增加攻擊速度", type: UpgradeType.WEAPON_SPEED, maxLevel: 999, icon: "Timer" },
  { id: "range", name: "神識擴張", description: "增加拾取範圍", type: UpgradeType.PICKUP_RANGE, maxLevel: 999, icon: "Sparkles" },
  { id: "hp", name: "體質突破", description: "增加最大生命值", type: UpgradeType.MAX_HP, maxLevel: 999, icon: "Heart" },
  { id: "count", name: "劍意縱橫", description: "增加飛劍的數量", type: UpgradeType.WEAPON_COUNT, maxLevel: 999, icon: "Sword" },
  { id: "ult_swords", name: "必殺技強化", description: "增加必殺技的飛劍數量", type: UpgradeType.ULTIMATE_SWORDS, maxLevel: 999, icon: "Zap" },
];

/**
 * 升級數值設定
 * 您可以針對不同的難度開發不同的增幅數值
 */
export const UPGRADE_VALUES = {
  SIMPLE: {
    PLAYER_SPEED: 0.3,
    WEAPON_DAMAGE: 10,
    WEAPON_COOLDOWN_REDUCTION: 0.05, // 5% 減少
    PICKUP_RANGE: 40,
    MAX_HP: 100,
    WEAPON_COUNT: 1,
    ULTIMATE_SWORDS: 5,
  },
  NORMAL: {
    PLAYER_SPEED: 0.3,
    WEAPON_DAMAGE: 10,
    WEAPON_COOLDOWN_REDUCTION: 0.05,
    PICKUP_RANGE: 40,
    MAX_HP: 100,
    WEAPON_COUNT: 1,
    ULTIMATE_SWORDS: 5,
  }
};

/**
 * 根據難度獲取對應的升級數值
 */
export const getUpgradeValues = (difficulty: string) => {
  return difficulty === 'NORMAL' ? UPGRADE_VALUES.NORMAL : UPGRADE_VALUES.SIMPLE;
};

/**
 * 產生升級選項池，並根據傳入的必殺技名稱動態調整文字
 */
export const getUpgradePool = (ultName: string): Upgrade[] => {
  return UPGRADE_TEMPLATES.map(t => {
    let name = t.name;
    let description = t.description;

    if (t.id === "ult_swords") {
      name = `${ultName}強化`;
      description = `增加${ultName}的飛劍數量`;
    }

    return {
      ...t,
      name,
      description,
      level: 1, // 這裡的 level 通常代表升級選項本身的一次性等級（選了就加 1）
    };
  });
};
