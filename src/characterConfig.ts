/**
 * 此檔案用於調整「仙姿百態」中不同區域的角色顯示位置與大小。
 * 
 * 【 調整教學 】
 * 1. position: "X% Y%" (位置)
 *    - X 軸 (第一個數字): 增加 = 角色往左移, 減少 = 角色往右移 (50% 為中)
 *    - Y 軸 (第二個數字): 
 *        - 增加 (如 20%, 50%...): 角色會「往上抬」
 *        - 減少 (如 -20%, -50%...): 角色會「往下跳」
 *    - ※ 我已經修復了寫法，現在設定負數（如 -50%）一定會有劇烈的向下位移反應。
 * 
 * 2. scale: "scale-[數字]" 或 "數字%" (大小)
 *    - 數字越大 = 圖片越大 (越靠近)
 *    - 數字越小 = 圖片越小 (看越遠)
 * 
 * 區域說明:
 * - btn: 最下方的選擇按鈕
 * - cutIn: 中間必殺技發動時的眼部特寫
 * - game: 遊戲內實際戰鬥的小人形象倍率 (1.0 為原始大小)
 * - ultimate: 必殺技設定
 *    - name: 必殺技名稱 (如：萬劍歸宗)
 *    - fontSize: 字體大小 (數字，例如：64 代表 64px)
 * - stats: 基礎屬性 (選填)
 *    - baseAttack: 初始攻擊力
 *    - baseSpeed: 初始移動速度倍率 (1.0 為標準)
 *    - baseHealth: 初始血量
 *    - baseUltCount: 初始必殺技次數
 *    - maxUltCount: 最大必殺技次數 (預設 3)
 *    - baseWeaponCount: 初始武器數量 (幾把劍)
 *    - baseUltWeaponCount: 初始必殺技武器數量
 *    - basePickupRange: 初始拾取範圍 (像素)
 *    - baseAttackSpeed: 攻擊速度倍率 (1.0 為標準，越快冷卻越短)
 *    - baseWeaponRange: 初始武器攻擊距離
 *    - baseWeaponScale: 初始武器大小倍率
 */

export const CHARACTER_COORDINATES = {
  // 小雪 (sword_master) 的座標設定
  sword_master: {
    name: "凌波仙子 · 小雪",
    description: '身著淡藍仙裙，劍指凌波，清麗脫俗。',
    image: '/assets/image/XX_Sword2_2.png',
    btn: {
      position: "50% 10%",
      scale: "scale-[4.5]"
    },
    cutIn: {
      position: "78% 10%",
      scale: "153%"
    },
    game: {
      scale: 1.5
    },
    preview: {
      scale: 3.5
    },
    ultimate: {
      name: "萬劍歸宗",
      fontSize: 64
    },
    projectileType: 'sword',
    ultimateType: 'radial',
    stats: {
      baseAttack: 8,
      baseSpeed: 1.2,
      baseHealth: 80,
      baseUltCount: 1,
      maxUltCount: 3,
      baseWeaponCount: 1,
      baseUltWeaponCount: 5,
      basePickupRange: 200,
      baseAttackSpeed: 1.0,
      baseWeaponRange: 300,
      baseWeaponScale: 0.8
    },
    gender: 'female'
  },
  
  // 青衫劍尊 (moon_maiden) 的座標設定
  moon_maiden: {
    name: "青衫劍尊 · 月下",
    description: '翠綠羅衫，劍氣如風，瀟灑挺拔。',
    image: '/assets/image/moon2-3-2.png',
    btn: {
      position: "50% 3%",
      scale: "scale-[5.0]"
    },
    cutIn: {
      position: "78% 2%",
      scale: "153%"
    },
    game: {
      scale: 1.3
    },
    preview: {
      scale: 3.0
    },
    ultimate: {
      name: "君臨天下",
      fontSize: 64
    },
    projectileType: 'palm',
    ultimateType: 'heavenly_impact',
    stats: {
      baseAttack: 20,
      baseSpeed: 0.8,
      baseHealth: 180,
      baseUltCount: 1,
      maxUltCount: 3,
      baseWeaponCount: 1,
      baseUltWeaponCount: 5,
      basePickupRange: 80,
      baseAttackSpeed: 0.6,
      baseWeaponRange: 300,
      baseWeaponScale: 1.8
    },
    gender: 'male'
  }
  
  /* 
   * 【 新增角色教學 】
   * 只要在下方複製一組設定並修改名稱與參數，遊戲就會自動增加一個新角色！
   * 
   * [ID名稱]: {
   *   name: "顯示名稱",
   *   description: "角色描述",
   *   gender: "female" 或 "male" (性別：女生用 female, 男生用 male)
   *   image: "圖片網址",
   *   colors: { ... },
   *   btn: { ... },
   *   cutIn: { ... },
   *   game: { ... },
   *   ultimate: { ... }
   * }
   */
};
