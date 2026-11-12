export interface ItemSetting {
  id: string;
  name: string;
  image: string;
  expValue: number;
  size: number; // 顯示圖片的大小
  dropWeightNormal: number; // 普通模式掉落權重
  dropWeightSimple: number; // 簡單模式掉落權重
}

export const ITEM_CONFIG: Record<string, ItemSetting> = {
  SMALL: {
    id: 'SMALL',
    name: '小靈力',
    image: '/assets/image/exp1.png',
    expValue: 1,
    size: 40,
    dropWeightNormal: 70, 
    dropWeightSimple: 40,
  },
  MEDIUM: {
    id: 'MEDIUM',
    name: '中靈力',
    image: '/assets/image/exp2.png',
    expValue: 10,
    size: 32,
    dropWeightNormal: 25,
    dropWeightSimple: 40,
  },
  LARGE: {
    id: 'LARGE',
    name: '大靈力',
    image: '/assets/image/exp3.png',
    expValue: 100,
    size: 32,
    dropWeightNormal: 5,
    dropWeightSimple: 20,
  }
};
