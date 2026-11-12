export interface EnemySetting {
  id: string;
  name: string;
  realm: string;      // 境界名稱 (對應遊戲內的等級階段)
  image: string;
  size: number;        // 顯示圖片的大小
  bossSize?: number;   // 魔王型態的大小 (選填，若未填則使用預設倍數)
  color: string;       // 預留顏色（作為載入失敗時的備用背景色或特效色）
  shape: string;       // 舊有的形狀標記（可留作參考）
  dropChance: number;  // 掉落機率 (0 ~ 1.0)
  baseHealth: number;  // 基礎血量
  baseAttack: number;  // 基礎攻擊力
  baseSpeed: number;   // 基礎移動速度
  attackName?: string; // 攻擊招式名稱
  dharmaTreasure?: string; // 使用的法寶名稱
}

export const ENEMY_CONFIG: EnemySetting[] = [
  // 1-10: 血翼妖蝠 (暗紅色)
  { 
    id: "blood_bat", 
    name: "血翼妖蝠", 
    realm: "煉氣初期",
    image: "/assets/image/monster01.png", 
    size: 80, 
    bossSize: 200, 
    color: "#991b1b", 
    shape: "DEMON", 
    dropChance: 1.0,
    baseHealth: 15,
    baseAttack: 5,
    baseSpeed: 2.0,
    attackName: "奪命音波",
    dharmaTreasure: "迴響震天鈴"
  },
  // 11-20: 冥絲魔蛛 (暗黑色)
  { 
    id: "void_spider", 
    name: "冥絲魔蛛", 
    realm: "煉氣中期",
    image: "/assets/image/monster02.png", 
    size: 90, 
    bossSize: 210, 
    color: "#0f172a", 
    shape: "DEMON", 
    dropChance: 1.0,
    baseHealth: 25,
    baseAttack: 8,
    baseSpeed: 2.1,
    attackName: "冥絲束縛",
    dharmaTreasure: "萬劫縛靈網"
  },
  // 21-30: 毒瘴蟾妖 (墨綠色)
  { 
    id: "poison_toad", 
    name: "毒瘴蟾妖", 
    realm: "煉氣後期",
    image: "/assets/image/monster03.png", 
    size: 100, 
    bossSize: 220,
    color: "#166534", 
    shape: "CIRCLE", 
    dropChance: 1.0,
    baseHealth: 60,
    baseAttack: 12,
    baseSpeed: 2.2,
    attackName: "毒涎噴吐",
    dharmaTreasure: "天罡毒火珠"
  },
  // 31-40: 玄影妖狼 (灰黑色)
  { 
    id: "shadow_wolf", 
    name: "玄影妖狼", 
    realm: "築基初期",
    image: "/assets/image/monster04.png", 
    size: 110, 
    bossSize: 230,
    color: "#1e293b", 
    shape: "TRIANGLE", 
    dropChance: 1.0,
    baseHealth: 120,
    baseAttack: 15,
    baseSpeed: 2.3,
    attackName: "幻影瞬殺",
    dharmaTreasure: "嗜血追魂刃"
  },
  // 41-50: 雷羽妖鷹 (金黃色)
  { 
    id: "thunder_hawk", 
    name: "雷羽妖鷹", 
    realm: "築基中期",
    image: "/assets/image/monster05.png", 
    size: 120, 
    bossSize: 240,
    color: "#eab308", 
    shape: "STAR", 
    dropChance: 1.0,
    baseHealth: 250,
    baseAttack: 20,
    baseSpeed: 2.4,
    attackName: "九天雷殛",
    dharmaTreasure: "奔雷引靈羽"
  },
  // 51-60: 寒淵蛟獸 (深藍色)
  { 
    id: "ice_naga", 
    name: "寒淵蛟獸", 
    realm: "築基後期",
    image: "/assets/image/monster06.png", 
    size: 130, 
    bossSize: 250,
    color: "#1e40af", 
    shape: "SNAKE", 
    dropChance: 1.0,
    baseHealth: 500,
    baseAttack: 30,
    baseSpeed: 2.5,
    attackName: "極地冰刺",
    dharmaTreasure: "玄冰裂魂戟"
  },
  // 61-70: 赤炎夜叉 (橘紅色)
  { 
    id: "flame_yaksa", 
    name: "赤炎夜叉", 
    realm: "結丹初期",
    image: "/assets/image/monster07.png", 
    size: 140, 
    bossSize: 260,
    color: "#c2410c", 
    shape: "SQUARE", 
    dropChance: 1.0,
    baseHealth: 600,
    baseAttack: 50,
    baseSpeed: 2.6,
    attackName: "業火紅蓮",
    dharmaTreasure: "烈焰修羅叉"
  },
  // 71-80: 幽冥刺客 (紫黑色)
  { 
    id: "hades_assassin", 
    name: "幽冥刺客", 
    realm: "結丹中期",
    image: "/assets/image/monster08.png", 
    size: 150, 
    bossSize: 270,
    color: "#4c1d95", 
    shape: "DIAMOND", 
    dropChance: 1.0,
    baseHealth: 1000,
    baseAttack: 80,
    baseSpeed: 2.7,
    attackName: "暗影追魂",
    dharmaTreasure: "幽冥匿形針"
  },
  // 81-90: 金甲天衛 (金白色)
  { 
    id: "heaven_guard", 
    name: "金甲天衛", 
    realm: "結丹後期",
    image: "/assets/image/monster09.png", 
    size: 160, 
    bossSize: 280,
    color: "#fef3c7", 
    shape: "HEXAGON", 
    dropChance: 1.0,
    baseHealth: 2000,
    baseAttack: 120,
    baseSpeed: 2.8,
    attackName: "驚龍斬天",
    dharmaTreasure: "鎮妖八寶塔"
  },
  // 91-100: 萬劫獸尊 (暗紫紅)
  { 
    id: "calamity_beast", 
    name: "萬劫獸尊", 
    realm: "元嬰境",
    image: "/assets/image/monster10.png", 
    size: 170, 
    bossSize: 290,
    color: "#701a75", 
    shape: "BEAST", 
    dropChance: 1.0,
    baseHealth: 4000,
    baseAttack: 200,
    baseSpeed: 2.9,
    attackName: "獸王哮天",
    dharmaTreasure: "混元碎星印"
  },
  // 101: 最終大魔王 (虛天魔君)
  { 
    id: "void_lord", 
    name: "虛天魔君", 
    realm: "化神境",
    image: "/assets/image/monster11.png", 
    size: 200, 
    bossSize: 360,
    color: "#f8fafc", 
    shape: "BOSS", 
    dropChance: 1.0,
    baseHealth: 10000,
    baseAttack: 500,
    baseSpeed: 3.0,
    attackName: "虛空崩滅",
    dharmaTreasure: "斷天虛空鏡"
  },
];
