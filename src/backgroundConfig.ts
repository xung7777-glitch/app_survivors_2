export interface BackgroundConfig {
  menuBackground: string;
  gameBackground: string;
  characterSelectBackground?: string;
  bestiaryBackground?: string;
}

export const BACKGROUND_CONFIG: BackgroundConfig = {
  // 主選單介面背景圖
  menuBackground: '/assets/image/bg_survivors.png',
  
  // 遊戲內戰鬥背景圖
  gameBackground: '/assets/image/sbg1.png', 

  // 仙姿百態背景圖
  characterSelectBackground: '/assets/image/bg_character.png',

  // 妖獸百科背景圖
  bestiaryBackground: '/assets/image/bg_monster.png',
};
