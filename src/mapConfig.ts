
export const MAP_CONFIG = {
  // 當您生成好圖片後，請將網址貼在下方
  // 範例：'https://your-image-url.com/map.jpg'
  backgroundUrl: '', 
  
  // 網格設定（如果有了背景圖，我們可以把 alpha 調低或直接關閉）
  showGrid: true,
  gridColor: 'rgba(255, 255, 255, 0.05)', // 非常淡的網格，輔助對齊
  
  // 地圖氛圍
  atmosphere: {
    overlayColor: 'rgba(255, 223, 128, 0.05)', // 淡淡的金色氛圍覆蓋
    brightness: 1.1,
  }
};
