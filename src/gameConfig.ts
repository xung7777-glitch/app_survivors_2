/**
 * 遊戲平衡設定檔 - 小雪在邊疆修仙
 * 控制簡單與普通模式的連動邏輯
 */

// --- 核心平衡設定 (簡單版為基礎) ---
// 當你想調整遊戲平衡（血量、速度、經驗等），請修改此 SIMPLE 部分
export const BASE_GAME_CONFIG = {
  SIMPLE: {
    ENEMY_HP_MULT: 0.15,      // 怪物血量倍率 (相對於 enemyConfig 中的基礎值)
    ENEMY_SPEED_MULT: 0.35,   // 怪物移動速度倍率
    SPAWN_INTERVAL: 1000,     // 怪物生成間隔 (毫秒)
    ENEMY_DAMAGE_MULT: 0.4,   // 怪物傷害倍率
    EXP_GAIN_MULT: 3.0,       // 經驗獲得倍率
    PLAYER_GROWTH_MULT: 2.0,  // 玩家升級成長率
    ULT_CHARGE_THRESHOLD: 10,  // 必殺技充能門檻 (擊殺數)
  }
};

// --- 普通模式連動係數 (Normal Mode linked to Simple) ---
// 根據使用者策略：普通版是簡單版的純強化版本
export const DIFFICULTY_MULTIPLIERS = {
  NORMAL: {
    HP: 1.5,         // 怪物血量：加強到簡單版的 1.5 倍
    SPAWN_COUNT: 1.2, // 怪物數量/頻率倍率：簡單版的 1.2 倍
    SPEED: 1.2,      // 怪物速度：簡單版的 1.2 倍
  }
};

/**
 * 根據難度獲取最終遊戲數值
 * @param difficulty 當前難度 ('SIMPLE' | 'NORMAL')
 * @returns 應用的平衡數值
 */
export const getActiveConfig = (difficulty: 'SIMPLE' | 'NORMAL') => {
  const s = BASE_GAME_CONFIG.SIMPLE;
  
  if (difficulty === 'SIMPLE') {
    return {
      enemyHpMult: s.ENEMY_HP_MULT,
      enemySpeedMult: s.ENEMY_SPEED_MULT,
      spawnInterval: s.SPAWN_INTERVAL,
      enemyDamageMult: s.ENEMY_DAMAGE_MULT,
      expGainMult: s.EXP_GAIN_MULT,
      playerGrowthMult: s.PLAYER_GROWTH_MULT,
      ultChargeThreshold: s.ULT_CHARGE_THRESHOLD,
    };
  }
  
  // 普通模式：基於簡單版連動調整
  const m = DIFFICULTY_MULTIPLIERS.NORMAL;
  return {
    enemyHpMult: s.ENEMY_HP_MULT * m.HP,           // 1.5倍血量
    enemySpeedMult: s.ENEMY_SPEED_MULT * m.SPEED,  // 1.2倍速度
    spawnInterval: s.SPAWN_INTERVAL / m.SPAWN_COUNT, // 頻率 1.2 倍意即間隔縮短
    enemyDamageMult: s.ENEMY_DAMAGE_MULT,          // 其他保持連動或固定
    expGainMult: s.EXP_GAIN_MULT,                  // 使用者說「其他的都不用動」，所以基於簡單版連動
    playerGrowthMult: s.PLAYER_GROWTH_MULT,
    ultChargeThreshold: s.ULT_CHARGE_THRESHOLD * 2, // 必殺技門檻通常在較難模式會高一點，維持平衡感
  };
};
