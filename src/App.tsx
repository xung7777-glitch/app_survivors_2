/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  Sword, 
  Shield, 
  Zap, 
  Flame, 
  Wind, 
  Heart, 
  Trophy, 
  Play, 
  RotateCcw,
  Sparkles,
  ChevronRight,
  ArrowLeft,
  Skull,
  Home,
  Pause,
  Volume2,
  VolumeX,
  AlertTriangle,
  Timer,
  BookOpen,
  Maximize,
  Expand,
  Search
} from "lucide-react";
import { 
  GameState, 
  Player, 
  Enemy, 
  Projectile, 
  Gem, 
  Weapon, 
  Upgrade, 
  UpgradeType,
  Point,
  Lightning,
  CharacterStyle
} from "./types";
import { CHARACTER_COORDINATES } from "./characterConfig";
import { ITEM_CONFIG } from "./itemConfig";
import { ENEMY_CONFIG } from "./enemyConfig";
import { getUpgradePool, getUpgradeValues } from "./upgradeConfig";
import { BACKGROUND_CONFIG } from "./backgroundConfig";
import { 
  GAME_BALANCE, 
  getRealmInfo, 
  getGreatRealm, 
  getNextLevelExp 
} from "./realmConfig";
import { getActiveConfig } from "./gameConfig";

// Constants
const CANVAS_WIDTH = 720;
const CANVAS_HEIGHT = 1280;
const HUD_HEIGHT = 280; // Area reserved for the status bar
const LOGICAL_WIDTH = CANVAS_WIDTH;
const LOGICAL_HEIGHT = CANVAS_HEIGHT;
const PLAYER_RADIUS = 12;
const ENEMY_SPAWN_RATE = 1000;

// Pre-calculated constants for performance
const TWO_PI = Math.PI * 2;
const HALF_PI = Math.PI / 2;

// Helper: Fast ID hash for visual variance
const fastHash = (id: string): number => {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash << 5) - hash + id.charCodeAt(i);
  }
  return Math.abs(hash);
};

// Helper: Squared distance between two points (faster for comparisons)
const getDistanceSq = (p1: Point, p2: Point) => {
  const dx = p1.x - p2.x;
  const dy = p1.y - p2.y;
  return dx * dx + dy * dy;
};

// Helper: Distance between two points
const getDistance = (p1: Point, p2: Point) => {
  return Math.sqrt(getDistanceSq(p1, p2));
};

// Helper: Apply character transformation
const applyCharTransform = (ctx: CanvasRenderingContext2D, cx: number, cy: number, sc: number, fr: boolean) => {
  ctx.translate(cx, cy);
  ctx.scale(fr ? 1 : -1, 1);
  ctx.scale(sc, sc);
};

// Simple Image Cache for Dynamic Styles
const imageCache: Record<string, HTMLImageElement> = {};

const parseScale = (s?: string) => {
  if (!s) return 1;
  const scaleMatch = s.match(/scale-\[?([\d.]+)\]?/);
  if (scaleMatch) return parseFloat(scaleMatch[1]);
  const percentMatch = s.match(/([\d.]+)%/);
  if (percentMatch) return parseFloat(percentMatch[1]) / 100;
  return 1;
};

const CHARACTER_STYLES: CharacterStyle[] = Object.entries(CHARACTER_COORDINATES).map(([id, config]: [string, any]) => ({
  id,
  name: config.name,
  description: config.description,
  image: config.image,
  btnPosition: config.btn?.position,
  btnScale: config.btn?.scale,
  gameScale: config.game?.scale,
  previewScale: config.preview?.scale,
  cutInPosition: config.cutIn?.position,
  cutInScale: config.cutIn?.scale,
  ultimateName: config.ultimate?.name,
  ultimateFontSize: config.ultimate?.fontSize,
  gender: config.gender,
  projectileType: config.projectileType,
  ultimateType: config.ultimateType,
  stats: config.stats,
  colors: config.colors || { hair: '#3b82f6', skin: '#fef3c7', eye: '#1d4ed8', clothes: '#60a5fa' }
}));

function drawPlayerNew(ctx: CanvasRenderingContext2D, player: Player, fr: boolean, sp: number, t: number, styleId: string = 'classic', isPreview: boolean = false) {
  const style = CHARACTER_STYLES.find(s => s.id === styleId) || CHARACTER_STYLES[0];
  ctx.save();
  let sc = CANVAS_HEIGHT * 0.065;
  const multiplier = isPreview ? (style.previewScale || 5.0) : (style.gameScale || 1.0);
  sc *= multiplier;
  applyCharTransform(ctx, player.x, player.y, sc / 130, fr);
  const bob = Math.sin(t / 400) * 5 + sp * Math.sin(t / 125) * 3;
  ctx.translate(0, bob);

  if (style.image) {
    if (!imageCache[style.image]) {
      const img = new Image();
      img.src = style.image;
      img.crossOrigin = "anonymous";
      imageCache[style.image] = img;
    }
    const img = imageCache[style.image];
    if (img.complete && img.naturalWidth !== 0) {
      const width = 140;
      const height = 140;
      ctx.drawImage(img, -width / 2, -height / 2 - 30, width, height);
    } else {
      ctx.fillStyle = 'rgba(255,255,255,0.2)';
      ctx.beginPath();
      ctx.arc(0, -30, 40, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    return;
  }
  
  if (style.colors) {
    ctx.fillStyle = style.colors.hair || '#3b82f6';
    ctx.beginPath();
    ctx.ellipse(0, -75, 45, 40, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = style.colors.skin || '#fef3c7';
    ctx.beginPath();
    ctx.ellipse(0, -68, 38, 36, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawProjectileCommon(
  ctx: CanvasRenderingContext2D, 
  p: any, 
  time: number, 
  renderType: 'sword' | 'palm' = 'sword',
  isUltimate: boolean = false
) {
  const alpha = p.life !== undefined ? Math.min(1, p.life / 200) : 1;
  ctx.globalAlpha = alpha;

  if (renderType === 'palm') {
    // Palm Print (掌印 - 虛擬手掌)
    ctx.save();
    
    const moveAngle = (p.vx === 0 && p.vy === 0) ? (p.phase === "HEAVENLY" ? Math.PI / 2 : 0) : Math.atan2(p.vy, p.vx);
    
    // 全域閃爍效果 (必殺技落地後)
    if (isUltimate && p.isImpacted && p.life < 250) {
      if (Math.floor(p.life / 30) % 2 === 0) {
        ctx.globalAlpha = 0;
      } else {
        ctx.globalAlpha = 1.0;
      }
    }

    if (isUltimate) {
      // 1. 閃電虛線 (必殺技專屬)：必須在「上方」也就是天邊
      ctx.save();
      ctx.globalAlpha *= 0.5; // 在當前 alpha 基礎上減半
      ctx.beginPath();
      ctx.strokeStyle = "#fff";
      ctx.setLineDash([15, 10]); 
      ctx.lineWidth = 2.5; 
      
      const seed = p.seed || 0;
      ctx.moveTo(0, 0);
      
      // 無論原本 moveAngle 旋轉到哪，閃電虛線都透過逆向旋轉指向天空 (-Y)
      ctx.rotate(-moveAngle);
      
      for (let j = 1; j <= 25; j++) {
        const skyY = -j * 80; 
        const jitter = Math.sin(seed + j * 91) * 20;
        ctx.lineTo(jitter, skyY);
      }
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();

      // 2. 必殺技手掌：跟一般的攻擊形式一樣：掌心向左右，手指向上
      // 直接抵消旋轉，回到手指朝向天邊 (本地 -Y) 的初始狀態
      ctx.rotate(-moveAngle); 
      
      const baseScale = 2.4; 
      ctx.scale(baseScale, baseScale);
    } else {
      // 一般攻擊鐵律：手指百分之百垂直朝上 (-PI/2)
      // 需要抵消外層已有的 moveAngle 旋轉
      ctx.rotate(-moveAngle); 
      
      // 此時本地 -Y 已經對齊世界 -Y (向上)
      if (p.vx < 0) ctx.scale(-1, 1);
      ctx.scale(0.65, 0.65);
    }
    
    // Golden theme
    const mainColor = isUltimate ? "#fbbf24" : "rgba(254, 240, 138, 0.95)";
    ctx.fillStyle = mainColor;
    ctx.shadowBlur = isUltimate ? 35 : 8;
    ctx.shadowColor = "#fbbf24";

    // 1. Forearm (RECOVERED ORIGINAL SIZES)
    ctx.save();
    const armGrad = ctx.createLinearGradient(0, 8, 0, 40);
    armGrad.addColorStop(0, mainColor);
    armGrad.addColorStop(1, "rgba(251, 191, 36, 0)");
    ctx.fillStyle = armGrad;
    ctx.globalAlpha = isUltimate ? 0.4 : 0.2;
    ctx.beginPath();
    ctx.moveTo(-9, 8); ctx.lineTo(9, 8);
    ctx.lineTo(7, 40); ctx.lineTo(-7, 40);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // 2. Palm Base (RECOVERED)
    ctx.beginPath();
    ctx.ellipse(0, 6, 12, 11, 0, 0, Math.PI * 2);
    ctx.fill();
    
    // 3. Fingers (RECOVERED)
    for (let i = 0; i < 4; i++) {
        const xOffset = -8 + i * 5.4;
        const flen = 12 + (1.5 - Math.abs(i - 1.5)) * 4;
        ctx.beginPath();
        ctx.roundRect(xOffset - 1.8, -10 - flen, 3.6, flen, 1.8);
        ctx.fill();
    }
    
    // 4. Thumb (RECOVERED)
    ctx.save();
    ctx.translate(-11, -1);
    ctx.rotate(-0.5);
    ctx.beginPath();
    ctx.roundRect(-1.8, -5, 3.6, 9, 1.8);
    ctx.fill();
    ctx.restore();

    ctx.restore();
    return;
  }

  // DEFAULT: Sword
  if (isUltimate) {
    // Golden Sword for Ultimate
    const swordLength = 60;
    const swordWidth = 12;
    const grad = ctx.createLinearGradient(-swordLength, 0, swordLength/2, 0);
    grad.addColorStop(0, "rgba(251, 191, 36, 0)");
    grad.addColorStop(0.3, "#fbbf24");
    grad.addColorStop(0.8, "#fff");
    grad.addColorStop(1, "#fff");
    ctx.fillStyle = grad;
    ctx.shadowBlur = 15; ctx.shadowColor = "#fbbf24";
    ctx.beginPath();
    ctx.moveTo(-swordLength, 0);
    ctx.lineTo(-swordLength * 0.2, -swordWidth);
    ctx.lineTo(swordLength * 0.4, -swordWidth * 0.5);
    ctx.lineTo(swordLength * 0.6, 0);
    ctx.lineTo(swordLength * 0.4, swordWidth * 0.5);
    ctx.lineTo(-swordLength * 0.2, swordWidth);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "rgba(255, 255, 255, 0.8)";
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(-swordLength * 0.5, 0); ctx.lineTo(swordLength * 0.4, 0); ctx.stroke();
  } else {
    // Normal Sword
    const sLen = 32;
    const sWid = 8;
    ctx.fillStyle = "#f8fafc";
    ctx.strokeStyle = "#60a5fa";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-sLen, 0);
    ctx.lineTo(-sLen * 0.4, -sWid);
    ctx.lineTo(sLen * 0.7, -sWid * 0.6);
    ctx.lineTo(sLen, 0);
    ctx.lineTo(sLen * 0.7, sWid * 0.6);
    ctx.lineTo(-sLen * 0.4, sWid);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = "#fff";
    ctx.beginPath(); ctx.moveTo(-sLen * 0.5, 0); ctx.lineTo(sLen * 0.5, 0); ctx.stroke();
  }
}

const CharacterAvatar = ({ style, size = "md", fill = false }: { style: CharacterStyle, size?: "sm" | "md" | "lg", fill?: boolean }) => {
  const scaleIn = size === "sm" ? 0.5 : size === "lg" ? 1.5 : 1;
  const containerStyle = fill ? { width: '100%', height: '100%' } : { width: 80 * scaleIn, height: 80 * scaleIn };

  const activeScaleStr = style.btnScale || "scale-100";
  const activePosition = style.btnPosition || "center";
  const zoom = parseScale(activeScaleStr);

  if (style.image) {
    return (
      <div 
        className="relative overflow-hidden flex items-center justify-center shrink-0" 
        style={{
          ...containerStyle,
          backgroundImage: `url(${style.image})`,
          backgroundPosition: activePosition,
          backgroundSize: `${zoom * 100}%`,
          backgroundRepeat: 'no-repeat',
        }}
      />
    );
  }

  return (
    <div className={`relative ${fill ? '' : 'rounded-full bg-slate-900'} overflow-hidden`} style={containerStyle}>
      {/* Hair Back */}
      <div 
        className="absolute top-[-15%] left-[-15%] w-[130%] h-[110%] rounded-[45%] opacity-90 shadow-sm" 
        style={{ backgroundColor: style.colors?.hair, transform: `scale(${zoom})`, transformOrigin: 'top center' }} 
      />
      <div className="absolute inset-0 rounded-full" style={{ backgroundColor: style.colors?.skin }} />
    </div>
  );
};

const UltimateAnimationView = ({ style, isLoop = false }: { style: CharacterStyle, isLoop?: boolean }) => {
  const duration = 2.0;
  const charEntryTime = 0.15 * duration;
  const textEntryStartTime = 0.2 * duration;
  const charExitStartTime = 0.85 * duration;
  const textExitStartTime = 0.8 * duration;

  return (
    <div className="relative w-full h-full flex items-center justify-center overflow-hidden bg-slate-950/40">
      <div className="absolute inset-x-0 bottom-1 z-20 flex flex-col items-center justify-center pointer-events-none">
        <motion.div
           initial={{ opacity: 0, x: -1200 }}
           animate={{ 
             opacity: [0, 0, 1, 1, 0, 0],
             x: [-1200, -300, 0, 100, 2000, 2000]
           }}
           transition={{
             duration: duration,
             repeat: isLoop ? Infinity : 0,
             times: [0, textEntryStartTime/duration, (textEntryStartTime+0.2)/duration, textExitStartTime/duration, (textExitStartTime+0.2)/duration, 1],
             ease: "easeOut"
           }}
           className="flex flex-col items-center"
        >
          <h2 
            style={{ fontSize: style.ultimateFontSize || 32 }}
            className="font-black text-yellow-400 italic tracking-[0.4em] drop-shadow-[0_0_25px_rgba(234,179,8,0.8)] uppercase whitespace-nowrap skew-x-[-8deg] select-none"
          >
            {style.ultimateName || ''}
          </h2>
        </motion.div>
      </div>
      <motion.div
        initial={{ x: -1400, opacity: 0 }}
        animate={{ x: [-1400, 0, 0, 2000], opacity: [0, 1, 1, 1] }}
        transition={{ duration: duration, repeat: isLoop ? Infinity : 0, times: [0, charEntryTime/duration, charExitStartTime/duration, 1], ease: "easeInOut" }}
        className="relative z-10 w-full h-full flex items-center justify-center"
      >
        {style.image && (
          <div 
            className="w-full h-full pointer-events-none"
            style={{ backgroundImage: `url(${style.image})`, backgroundPosition: style.cutInPosition || 'center', backgroundSize: `${parseScale(style.cutInScale) * 100}%`, backgroundRepeat: 'no-repeat' }}
          />
        )}
      </motion.div>
    </div>
  );
};

const CharacterGamePreview = ({ style, drawPlayer }: { style: CharacterStyle, drawPlayer: any }) => {
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef<number>(0);
  const projectilesRef = useRef<any[]>([]);

  useEffect(() => {
    const canvas = previewCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    let animationId: number;
    let lastShootTime = 0;
    
    const render = (time: number) => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const centerX = canvas.width / 2; 
      const centerY = canvas.height / 2 + 75; // Adjusted lower to center character visually in the box
      
      // Simulate shooting logic based on style stats
      if (time - lastShootTime > 600) {
        lastShootTime = time;
        const count = style.stats?.baseWeaponCount || 1;
        for (let i = 0; i < count; i++) {
            const angle = (i - (count - 1) / 2) * 0.15; // 0 is rightwards
            projectilesRef.current.push({
                x: 20, y: -75, 
                vx: Math.cos(angle) * (style.projectileType === 'palm' ? 4 : 7.5),
                vy: Math.sin(angle) * (style.projectileType === 'palm' ? 4 : 7.5),
                life: 1800
            });
        }
      }
      
      // Update and draw projectiles
      ctx.save();
      projectilesRef.current = projectilesRef.current.filter(p => p.life > 0);
      projectilesRef.current.forEach(p => {
        p.x += p.vx;
        p.y += p.vy;
        p.life -= 16;
        
        ctx.save();
        ctx.translate(centerX + p.x, centerY + p.y);
        ctx.rotate(Math.atan2(p.vy, p.vx));
        
        drawProjectileCommon(ctx, p, time, style.projectileType || 'sword', false);
        
        ctx.restore();
      });
      ctx.restore();

      ctx.save(); 
      ctx.translate(centerX, centerY);
      drawPlayer(ctx, { x: 0, y: 0, radius: 20 } as any, true, 0, frameRef.current * 16, style.id, true);
      ctx.restore(); 
      
      frameRef.current++; 
      animationId = requestAnimationFrame(render);
    };
    
    animationId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animationId);
  }, [style.id, drawPlayer, style.stats?.baseWeaponCount]);

  return (
    <div className="flex flex-col items-center gap-4 w-full">
      <div className="relative group w-full max-w-[280px]">
        <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 to-cyan-500 rounded-2xl blur opacity-25 group-hover:opacity-40 transition duration-1000"></div>
        <div className="relative bg-slate-900/90 border border-white/10 rounded-2xl overflow-hidden shadow-2xl aspect-square flex flex-col">
           <div className="absolute top-3 left-4 flex items-center gap-2 z-10">
             <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse shadow-[0_0_8px_rgba(59,130,246,0.8)]"></div>
             <span className="text-[10px] font-black text-slate-300 uppercase tracking-[0.2em]">遊戲形象預覽</span>
           </div>
           {/* Scanline Effect */}
           <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.1)_50%),linear-gradient(90deg,rgba(255,0,0,0.03),rgba(0,255,0,0.01),rgba(0,0,255,0.03))] bg-[length:100%_4px,3px_100%] z-10 opacity-30"></div>
           <canvas ref={previewCanvasRef} width={512} height={512} className="w-full h-full" />
        </div>
      </div>
    </div>
  );
};

const CharacterSelect = ({ 
  onSelect, 
  onBack,
  currentStyleId,
  playUltimateVoice,
  drawPlayer
}: { 
  onSelect: (id: string) => void, 
  onBack: () => void,
  currentStyleId: string,
  playUltimateVoice: (text?: string, gender?: 'male' | 'female') => void,
  drawPlayer: any,
  key?: string
}) => {
  const [previewId, setPreviewId] = useState(currentStyleId);
  const previewStyle = CHARACTER_STYLES.find(s => s.id === previewId) || CHARACTER_STYLES[0];
  
  return (
    <div className="absolute inset-0 z-[100] bg-slate-950 text-white overflow-hidden">
      {/* Layer 1: Fixed Background */}
      <div className="absolute inset-0 z-0">
        <div 
          className="absolute inset-0"
          style={{
            backgroundImage: `url("${BACKGROUND_CONFIG.characterSelectBackground}")`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat'
          }}
        />
        {/* Dark Overlay for readability */}
        <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-[2px]" />
      </div>

      {/* Layer 2: Scrollable Content */}
      <div className="absolute inset-0 z-10 overflow-y-auto">
        <button 
          onClick={onBack} 
          className="absolute top-6 right-6 z-[110] w-12 h-12 flex items-center justify-center bg-slate-900/80 hover:bg-slate-800 border border-slate-700 rounded-full shadow-xl transition-all active:scale-90 hover:scale-110 active:bg-slate-700"
          title="返回主選單"
        >
          <ArrowLeft className="w-7 h-7 text-white" />
        </button>

        <div className="relative flex flex-col items-center gap-8 py-12 px-8">
          <div className="flex flex-col items-center gap-2">
              <h2 className="text-4xl font-black text-white italic tracking-tighter drop-shadow-[0_0_20px_rgba(234,179,8,0.5)]">仙姿百態</h2>
              <div className="h-1 w-24 bg-yellow-500 rounded-full shadow-[0_0_10px_rgba(234,179,8,0.8)]"></div>
          </div>
          <button 
            onClick={() => { playUltimateVoice(previewStyle.ultimateName, previewStyle.gender); onSelect(previewId); onBack(); }}
            className="px-12 py-4 bg-blue-600 rounded-xl font-black transition-all active:scale-95 shadow-[0_4px_20px_rgba(37,99,235,0.4)]"
          >
            {previewId === currentStyleId ? '正在修行中' : '結緣此形象'}
          </button>

          <div className="grid grid-cols-2 gap-4 w-full max-w-lg">
            {CHARACTER_STYLES.map(s => (
              <button key={`style-${s.id}`} onClick={() => { setPreviewId(s.id); playUltimateVoice(s.ultimateName, s.gender); }} className={`aspect-square rounded-xl border-2 transition-all overflow-hidden relative ${previewId === s.id ? 'border-yellow-400 bg-yellow-400/10' : 'border-white/10 opacity-60'}`}>
                <CharacterAvatar style={s} fill={true} />
                <div className="absolute bottom-0 left-0 right-0 bg-black/60 p-2 text-xs font-bold text-center">{s.name}</div>
              </button>
            ))}
          </div>

          <h3 className="text-4xl font-black italic">{previewStyle.name}</h3>
          
          {/* Character Stats Display - Restored simple 3x3 Grid */}
          <div className="grid grid-cols-3 gap-2 w-full max-w-lg mb-4">
            <div className="bg-slate-900/60 p-2 rounded-xl border border-slate-800 flex flex-col items-center">
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">攻擊威力</span>
              <span className="text-lg font-black text-red-400">{previewStyle.stats?.baseAttack || '??'}</span>
            </div>
            <div className="bg-slate-900/60 p-2 rounded-xl border border-slate-800 flex flex-col items-center">
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">身法(速)</span>
              <span className="text-lg font-black text-blue-400">x{previewStyle.stats?.baseSpeed || '??'}</span>
            </div>
            <div className="bg-slate-900/60 p-2 rounded-xl border border-slate-800 flex flex-col items-center">
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">氣血(HP)</span>
              <span className="text-lg font-black text-green-400">{previewStyle.stats?.baseHealth || '??'}</span>
            </div>
            <div className="bg-slate-900/60 p-2 rounded-xl border border-slate-800 flex flex-col items-center">
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">攻擊頻率</span>
              <span className="text-lg font-black text-cyan-400">x{previewStyle.stats?.baseAttackSpeed || '??'}</span>
            </div>
            <div className="bg-slate-900/60 p-2 rounded-xl border border-slate-800 flex flex-col items-center">
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">法寶數量</span>
              <span className="text-lg font-black text-purple-400">{previewStyle.stats?.baseWeaponCount || '??'}</span>
            </div>
            <div className="bg-slate-900/60 p-2 rounded-xl border border-slate-800 flex flex-col items-center">
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">神識範圍</span>
              <span className="text-lg font-black text-teal-400">{previewStyle.stats?.basePickupRange || '??'}</span>
            </div>
            <div className="bg-slate-900/60 p-2 rounded-xl border border-slate-800 flex flex-col items-center">
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">起手必殺</span>
              <span className="text-lg font-black text-yellow-400">{previewStyle.stats?.baseUltCount || '??'}</span>
            </div>
            <div className="bg-slate-900/60 p-2 rounded-xl border border-slate-800 flex flex-col items-center">
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">絕技威力</span>
              <span className="text-lg font-black text-orange-400">{previewStyle.stats?.baseUltWeaponCount || '??'}</span>
            </div>
            <div className="bg-slate-900/60 p-2 rounded-xl border border-slate-800 flex flex-col items-center">
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">儲存上限</span>
              <span className="text-lg font-black text-yellow-600">{previewStyle.stats?.maxUltCount || '??'}</span>
            </div>
          </div>

          <div className="w-full max-w-lg space-y-6">
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <div className="h-[1px] flex-1 bg-gradient-to-r from-transparent to-slate-700"></div>
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em]">修行姿態</span>
                <div className="h-[1px] flex-1 bg-gradient-to-l from-transparent to-slate-700"></div>
              </div>
              <CharacterGamePreview style={previewStyle} drawPlayer={drawPlayer} />
            </div>

            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <div className="h-[1px] flex-1 bg-gradient-to-r from-transparent to-slate-700"></div>
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em]">絕技預覽</span>
                <div className="h-[1px] flex-1 bg-gradient-to-l from-transparent to-slate-700"></div>
              </div>
              <div className="relative w-full aspect-[21/9] rounded-xl overflow-hidden bg-black/40 border border-white/5 group">
                <div className="absolute top-3 left-4 flex items-center gap-2 z-10">
                   <div className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse shadow-[0_0_8px_rgba(234,179,8,0.8)]"></div>
                   <span className="text-[10px] font-black text-slate-300 uppercase tracking-[0.2em]">{previewStyle.ultimateName || '萬劍歸宗'}</span>
                </div>
                <UltimateAnimationView style={previewStyle} isLoop={true} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const BossAttackPreview = ({ visualType, color }: { visualType: number, color: string }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    let animationId: number;
    let startTime = Date.now();
    
    const render = () => {
      const time = Date.now();
      const elapsed = time - startTime;
      const cycle = elapsed % 3000;
      
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;
      
      ctx.save();
      ctx.translate(centerX, centerY);
      
      // Mimic attack patterns
      switch (visualType) {
        case 0: // Sonic Wave (Arcs)
          for (let i = 0; i < 3; i++) {
            const t = ((cycle - i * 400) % 2000) / 2000;
            if (t > 0) {
                ctx.beginPath();
                ctx.strokeStyle = color;
                ctx.lineWidth = 3;
                ctx.globalAlpha = 1 - t;
                ctx.arc(0, 0, t * 120, -Math.PI / 3, Math.PI / 3);
                ctx.stroke();
            }
          }
          break;
        case 1: // Silk (Web)
          ctx.strokeStyle = "rgba(255,255,255,0.6)";
          ctx.setLineDash([3, 3]);
          const silkT = (cycle % 2000) / 2000;
          for (let i = 0; i < 12; i++) {
            const angle = (i / 12) * Math.PI * 2;
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(Math.cos(angle) * silkT * 130, Math.sin(angle) * silkT * 130);
            ctx.stroke();
          }
          ctx.setLineDash([]);
          break;
        case 2: // Toxin Bubbles
          for (let i = -2; i <= 2; i++) {
             const t = (cycle % 1500) / 1500;
             const angle = (Math.PI / 2) + (i * 0.45);
             const dist = t * 130;
             ctx.fillStyle = "#22c55e";
             ctx.globalAlpha = 1 - t;
             ctx.beginPath();
             ctx.arc(Math.cos(angle) * dist, Math.sin(angle) * dist, 10, 0, Math.PI * 2);
             ctx.fill();
             ctx.fillStyle = "#fff";
             ctx.beginPath(); ctx.arc(Math.cos(angle) * dist - 3, Math.sin(angle) * dist - 3, 3, 0, Math.PI * 2); ctx.fill();
          }
          break;
        case 3: // Sonic Howl (Arcs)
          for (let i = 0; i < 4; i++) {
            const t = ((cycle - i * 300) % 1500) / 1500;
            if (t > 0) {
                ctx.strokeStyle = "#94a3b8";
                ctx.lineWidth = 3;
                ctx.globalAlpha = 1 - t;
                ctx.beginPath();
                ctx.arc(0, 0, t * 130, -Math.PI / 4, Math.PI / 4);
                ctx.stroke();
            }
          }
          break;
        case 4: // Lightning Projectile
          const boltT = (cycle % 1200) / 1200;
          ctx.strokeStyle = "#eab308";
          ctx.lineWidth = 3;
          ctx.globalAlpha = 1 - boltT;
          const boltX = -40 + boltT * 120;
          ctx.beginPath();
          ctx.moveTo(boltX, -10);
          ctx.lineTo(boltX + 10, 0);
          ctx.lineTo(boltX, 10);
          ctx.lineTo(boltX + 20, 0);
          ctx.stroke();
          break;
        case 5: // Ice Spikes (Triangle shards)
          for (let i = -2; i <= 2; i++) {
             const t = (cycle % 1800) / 1800;
             const angle = (Math.PI / 2) + (i * 0.4);
             const dist = t * 130;
             ctx.fillStyle = "#7dd3fc";
             ctx.globalAlpha = 1 - t;
             ctx.save();
             ctx.translate(Math.cos(angle) * dist, Math.sin(angle) * dist);
             ctx.rotate(angle);
             ctx.beginPath(); ctx.moveTo(15, 0); ctx.lineTo(-10, 8); ctx.lineTo(-10, -8); ctx.closePath(); ctx.fill();
             ctx.restore();
          }
          break;
        case 6: // Flame Trident (3 bursts)
          for (let i = -1; i <= 1; i++) {
            const t = (cycle % 1800) / 1800;
            const angle = (Math.PI / 2) + (i * 0.35);
            const x = Math.cos(angle) * t * 120;
            const y = Math.sin(angle) * t * 120;
            const grad = ctx.createRadialGradient(x, y, 0, x, y, 25);
            grad.addColorStop(0, "#fff"); grad.addColorStop(0.3, "#f97316"); grad.addColorStop(1, "transparent");
            ctx.fillStyle = grad;
            ctx.globalAlpha = 1 - t;
            ctx.beginPath(); ctx.arc(x, y, 25, 0, Math.PI * 2); ctx.fill();
          }
          break;
        case 7: // Twin Blades (Rotating)
          const bladeAngle = (elapsed / 200);
          for (let i = 0; i < 2; i++) {
            const t = (cycle % 1500) / 1500;
            const offsetAngle = (Math.PI / 2) + (i === 0 ? 0.3 : -0.3);
            const x = Math.cos(offsetAngle) * t * 130;
            const y = Math.sin(offsetAngle) * t * 130;
            ctx.save();
            ctx.translate(x, y); ctx.rotate(bladeAngle);
            ctx.fillStyle = "#4c1d95";
            ctx.beginPath(); ctx.ellipse(0, 0, 15, 5, 0, 0, Math.PI * 2); ctx.fill();
            ctx.strokeStyle = "#fff"; ctx.stroke();
            ctx.restore();
          }
          break;
        case 8: // Spinning Gold Shards (Rotating triangles)
          const spinA = (elapsed / 300) % (Math.PI * 2);
          for (let i = 0; i < 6; i++) {
            const angle = spinA + (i / 6) * Math.PI * 2;
            const dist = 60 + Math.sin(elapsed / 600) * 20;
            const x = Math.cos(angle) * dist;
            const y = Math.sin(angle) * dist;
            ctx.fillStyle = "#fbbf24";
            ctx.save();
            ctx.translate(x, y); ctx.rotate(angle);
            ctx.beginPath(); ctx.moveTo(15, 0); ctx.lineTo(-8, 6); ctx.lineTo(-8, -6); ctx.closePath(); ctx.fill();
            ctx.shadowBlur = 10; ctx.shadowColor = "#fbbf24"; ctx.fill();
            ctx.restore();
          }
          break;
        case 9: // Broken Roar Arcs
          for (let i = 0; i < 3; i++) {
            const t = ((cycle - i * 400) % 2000) / 2000;
            if (t > 0) {
                ctx.strokeStyle = "#991b1b";
                ctx.lineWidth = 10;
                ctx.globalAlpha = (1 - t) * 0.7;
                // Create broken arc segments
                for (let j = 0; j < 3; j++) {
                  const start = (j * 1.2) - 1.5;
                  ctx.beginPath();
                  ctx.arc(0, 0, t * 160, start, start + 0.8);
                  ctx.stroke();
                }
            }
          }
          break;
        case 10: // Spiral Void Shards
          const vs = (elapsed / 500);
          for (let i = 0; i < 12; i++) {
            const t = (cycle % 2500) / 2500;
            const angle = vs + (i / 12) * Math.PI * 2 + t * 4;
            const dist = t * 140;
            ctx.fillStyle = "#f8fafc";
            ctx.globalAlpha = 1 - t;
            const x = Math.cos(angle) * dist;
            const y = Math.sin(angle) * dist;
            ctx.save();
            ctx.translate(x, y); ctx.rotate(angle);
            ctx.beginPath(); ctx.moveTo(12, 0); ctx.lineTo(-6, 4); ctx.lineTo(-6, -4); ctx.closePath(); ctx.fill();
            ctx.restore();
          }
          break;
      }
      
      ctx.restore();
      animationId = requestAnimationFrame(render);
    };
    
    render();
    return () => cancelAnimationFrame(animationId);
  }, [visualType, color]);
  
  return <canvas ref={canvasRef} width={200} height={200} className="w-full h-full" />;
};



const Bestiary = ({ onBack }: { onBack: () => void }) => {
  return (
    <div className="absolute inset-0 z-[100] bg-slate-950 text-white overflow-hidden">
      {/* Layer 1: Fixed Background */}
      <div className="absolute inset-0 z-0">
        <div 
          className="absolute inset-0"
          style={{
            backgroundImage: `url("${BACKGROUND_CONFIG.bestiaryBackground}")`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat'
          }}
        />
        {/* Dark Overlay for readability */}
        <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-[2px]" />
      </div>

      <button 
        onClick={onBack} 
        className="absolute top-6 right-6 z-[110] w-12 h-12 flex items-center justify-center bg-slate-900/80 hover:bg-slate-800 border border-slate-700 rounded-full shadow-xl transition-all active:scale-90 hover:scale-110 active:bg-slate-700"
        title="返回主選單"
      >
        <ArrowLeft className="w-7 h-7 text-white" />
      </button>
      
      {/* Layer 2: Scrollable Content */}
      <div className="absolute inset-0 z-10 overflow-y-auto">
        <div className="relative flex flex-col items-center gap-12 py-12 px-8 mb-12">
        <div className="flex flex-col items-center gap-2">
            <h2 className="text-4xl font-black text-white italic tracking-tighter drop-shadow-[0_0_20px_rgba(234,179,8,0.5)]">妖獸百科</h2>
            <div className="h-1 w-24 bg-yellow-500 rounded-full shadow-[0_0_10px_rgba(234,179,8,0.8)]"></div>
        </div>

        <div className="flex flex-col gap-10 w-full max-w-lg">
          {ENEMY_CONFIG.map((enemy, idx) => (
            <div key={enemy.id} className="relative bg-slate-900/60 border border-slate-800 rounded-3xl p-6 flex flex-col gap-6 overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-5">
                    <span className="text-6xl font-black italic">{idx + 1}</span>
                </div>
                
                <div className="flex flex-col gap-1">
                    <span className="text-blue-400 font-bold tracking-[0.2em] text-xs uppercase">{enemy.realm}</span>
                    <h3 className="text-3xl font-black text-white italic">{enemy.name}</h3>
                </div>

                <div className="grid grid-cols-2 gap-6 relative z-10">
                    {/* Normal Form */}
                    <div className="flex flex-col items-center gap-3 group">
                        <div className="aspect-square w-full rounded-2xl bg-slate-800/40 border-2 border-slate-700/50 flex items-center justify-center relative overflow-hidden group-hover:border-blue-500/30 transition-all">
                             <div className="absolute inset-0 bg-gradient-to-b from-blue-500/5 to-transparent"></div>
                             {enemy.image && (
                                 <img 
                                    src={enemy.image} 
                                    alt={enemy.name} 
                                    loading="lazy"
                                    className="relative z-10 drop-shadow-[0_0_15px_rgba(255,255,255,0.2)]"
                                    style={{ width: '80%' }}
                                 />
                             )}
                        </div>
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-800 px-3 py-1 rounded-full">一般形態</span>
                    </div>

                    {/* Boss Form */}
                    <div className="flex flex-col items-center gap-3 group">
                        <div className="aspect-square w-full rounded-2xl bg-yellow-900/10 border-2 border-yellow-900/30 flex items-center justify-center relative overflow-hidden group-hover:border-yellow-500/30 transition-all">
                             <div className="absolute inset-0 bg-gradient-to-b from-yellow-500/5 to-transparent"></div>
                             {enemy.image && (
                                 <img 
                                    src={enemy.image} 
                                    alt={`${enemy.name} Boss`} 
                                    loading="lazy"
                                    className="relative z-10 drop-shadow-[0_0_20px_rgba(234,179,8,0.4)] scale-125"
                                    style={{ width: '80%' }}
                                 />
                             )}
                             {/* Mini Attack Visualizer Overlay */}
                             <div className="absolute inset-0 z-20 pointer-events-none">
                                <BossAttackPreview visualType={idx} color={enemy.color || "#eab308"} />
                             </div>
                        </div>
                        <span className="text-[10px] font-black text-yellow-500/80 uppercase tracking-widest bg-yellow-900/30 px-3 py-1 rounded-full">魔王形態</span>
                    </div>
                </div>

                <div className="grid grid-cols-3 gap-2 mt-2">
                    <div className="bg-black/20 p-2 rounded-xl flex flex-col items-center border border-white/5">
                        <span className="text-[8px] text-slate-500 font-bold uppercase tracking-tighter">基礎血量</span>
                        <span className="text-sm font-black text-green-400">{enemy.baseHealth}</span>
                    </div>
                    <div className="bg-black/20 p-2 rounded-xl flex flex-col items-center border border-white/5">
                        <span className="text-[8px] text-slate-500 font-bold uppercase tracking-tighter">基礎攻擊力</span>
                        <span className="text-sm font-black text-red-400">{enemy.baseAttack}</span>
                    </div>
                    <div className="bg-black/20 p-2 rounded-xl flex flex-col items-center border border-white/5">
                        <span className="text-[8px] text-slate-500 font-bold uppercase tracking-tighter">移動速度</span>
                        <span className="text-sm font-black text-blue-400">{enemy.baseSpeed.toFixed(1)}</span>
                    </div>
                </div>

                {/* Boss Specialized Skills & Dharma Treasures */}
                <div className="flex flex-col gap-3 p-4 rounded-2xl bg-gradient-to-br from-yellow-950/20 to-slate-900/40 border border-yellow-900/20">
                    <div className="flex items-center gap-2">
                        <Skull className="w-4 h-4 text-red-500" />
                        <span className="text-xs font-black text-slate-300">魔王必殺</span>
                    </div>
                    <div className="grid grid-cols-1 gap-3">
                        <div className="flex items-center justify-between bg-black/30 p-2.5 rounded-xl border border-white/5">
                           <div className="flex items-center gap-2">
                             <Zap className="w-3.5 h-3.5 text-yellow-500" />
                             <span className="text-xs text-slate-400 font-bold">攻擊模式</span>
                           </div>
                           <span className="text-sm font-black text-yellow-500 italic">{enemy.attackName}</span>
                        </div>
                        <div className="flex items-center justify-between bg-black/30 p-2.5 rounded-xl border border-white/5">
                           <div className="flex items-center gap-2">
                             <Sparkles className="w-3.5 h-3.5 text-blue-400" />
                             <span className="text-xs text-slate-400 font-bold">伴生法寶</span>
                           </div>
                           <span className="text-sm font-black text-blue-300 italic">{enemy.dharmaTreasure}</span>
                        </div>
                    </div>
                    <p className="text-[10px] text-slate-500 font-medium italic mt-1 leading-relaxed">
                        ※ 魔王形態下將施展遠程或大範圍攻擊，法寶威能不容小覷。
                    </p>
                </div>
            </div>
          ))}
        </div>

        <div className="h-20 w-full"></div>
      </div>
    </div>
  </div>
);
};

// New Player Design: Xiaoxue (Ice Cultivator)

// Legacy Player Design (Backup)
const drawPlayerLegacy = (ctx: CanvasRenderingContext2D, player: Player, time: number, dx: number, dy: number) => {
    ctx.save();
    ctx.translate(player.x, player.y);
    
    // Calculate rotation based on movement
    let swordAngle = 0;
    if (dx !== 0 || dy !== 0) {
      swordAngle = Math.atan2(dy, dx);
    }

    // 1. Flying Sword (Under player)
    ctx.save();
    ctx.rotate(swordAngle);
    
    // Sword Glow & Shadow
    const swordGlow = Math.sin(time / 150) * 4;
    ctx.shadowBlur = 10 + swordGlow;
    ctx.shadowColor = "rgba(147, 197, 253, 0.8)";
    
    // --- Sword Body ---
    ctx.fillStyle = "#f8fafc";
    ctx.beginPath();
    ctx.moveTo(30, 0); ctx.lineTo(0, -3); ctx.lineTo(-22, -2); ctx.lineTo(-25, 0); ctx.lineTo(-22, 2); ctx.lineTo(0, 3);
    ctx.closePath();
    ctx.fill();
    
    ctx.strokeStyle = "rgba(148, 163, 184, 0.5)";
    ctx.lineWidth = 0.5;
    ctx.beginPath(); ctx.moveTo(28, 0); ctx.lineTo(-22, 0); ctx.stroke();

    ctx.fillStyle = "#334155";
    ctx.beginPath(); ctx.roundRect(-12, -6, 3, 12, 1); ctx.fill();
    
    ctx.fillStyle = "#3b82f6";
    ctx.beginPath(); ctx.moveTo(20, 0); ctx.lineTo(-10, -1); ctx.lineTo(-10, 1); ctx.closePath(); ctx.fill();
    
    const trailOpacity = 0.4 + Math.sin(time / 100) * 0.2;
    const gradientTrail = ctx.createLinearGradient(-25, 0, -50, 0);
    gradientTrail.addColorStop(0, `rgba(147, 197, 253, ${trailOpacity})`);
    gradientTrail.addColorStop(1, "rgba(147, 197, 253, 0)");
    ctx.fillStyle = gradientTrail;
    ctx.beginPath(); ctx.moveTo(-25, 0); ctx.lineTo(-45, -6); ctx.lineTo(-40, 0); ctx.lineTo(-45, 6); ctx.closePath(); ctx.fill();
    
    ctx.restore();

    // 2. Xiaoxue Character
    const auraPulse = Math.sin(time / 200) * 5;
    const auraRadius = player.radius * 2.5 + auraPulse;
    const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, auraRadius);
    gradient.addColorStop(0, "rgba(147, 197, 253, 0.2)");
    gradient.addColorStop(1, "rgba(147, 197, 253, 0)");
    ctx.fillStyle = gradient;
    ctx.beginPath(); ctx.arc(0, 0, auraRadius, 0, TWO_PI); ctx.fill();

    const hairSway = Math.sin(time / 300) * 4;
    ctx.fillStyle = "#1e293b";
    ctx.beginPath(); ctx.moveTo(-8, -5); ctx.bezierCurveTo(-10 + hairSway, 10, -8 + hairSway, 25, -4, 35); ctx.lineTo(4, 35); ctx.bezierCurveTo(8 + hairSway, 25, 10 + hairSway, 10, 8, -5); ctx.closePath(); ctx.fill();

    ctx.fillStyle = "#f8fafc";
    ctx.beginPath(); ctx.moveTo(-12, 0); ctx.lineTo(12, 0); ctx.lineTo(18, 25); ctx.lineTo(-18, 25); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = "rgba(96, 165, 250, 0.4)";
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = "#bae6fd";
    ctx.beginPath(); ctx.moveTo(-8, 0); ctx.lineTo(8, 0); ctx.lineTo(4, 20); ctx.lineTo(-4, 20); ctx.closePath(); ctx.fill();

    ctx.fillStyle = "#fee2e2";
    ctx.beginPath(); ctx.arc(0, -10, 8, 0, Math.PI * 2); ctx.fill();

    ctx.fillStyle = "#f472b6";
    ctx.beginPath(); ctx.arc(0, -12, 1.5, 0, Math.PI * 2); ctx.fill();

    ctx.fillStyle = "#1e293b";
    ctx.beginPath(); ctx.arc(0, -14, 10, Math.PI, 0); ctx.fill();
    ctx.beginPath(); ctx.arc(0, -24, 4, 0, Math.PI * 2); ctx.fill();
    
    ctx.fillStyle = "#0f172a";
    ctx.beginPath(); ctx.arc(-3, -11, 1, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(3, -11, 1, 0, Math.PI * 2); ctx.fill();

    ctx.restore();
};

enum Difficulty {
  NORMAL = "NORMAL",
  SIMPLE = "SIMPLE",
}

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [selectedStyleId, setSelectedStyleId] = useState<string>(CHARACTER_STYLES[0]?.id || "sword_master");
  
    // Pre-load Item Images
    useEffect(() => {
      Object.values(ITEM_CONFIG).forEach(item => {
        if (item.image && !imageCache[item.image]) {
          const img = new Image();
          img.src = item.image;
          imageCache[item.image] = img;
        }
      });
      // Pre-load Enemy Images
      ENEMY_CONFIG.forEach(enemy => {
        if (enemy.image && !imageCache[enemy.image]) {
          const img = new Image();
          img.src = enemy.image;
          imageCache[enemy.image] = img;
        }
      });
    }, []);

  const selectedStyleIdRef = useRef(selectedStyleId);

  useEffect(() => {
    selectedStyleIdRef.current = selectedStyleId;
  }, [selectedStyleId]);
  const [gameState, setGameState] = useState<GameState>(GameState.MENU);
  const [difficulty, setDifficulty] = useState<Difficulty>(Difficulty.SIMPLE);
  
  // 核心平衡配置：根據當前難度計算
  const gameConfig = useMemo(() => getActiveConfig(difficulty), [difficulty]);
  const gameConfigRef = useRef(gameConfig);
  useEffect(() => { gameConfigRef.current = gameConfig; }, [gameConfig]);
  const scoreRef = useRef(0);
  const totalKillsRef = useRef(0);
  const timerRef = useRef(0);
  const [availableUpgrades, setAvailableUpgrades] = useState<Upgrade[]>([]);
  const [ultimateCharges, setUltimateCharges] = useState(1);
  const ultimateChargesRef = useRef(1);
  const maxUltimateChargesRef = useRef(3);
  const ultimateSwordBonusRef = useRef(0);
  const killCountRef = useRef(0);
  const [tribulationActive, setTribulationActive] = useState(false);
  const [showMarquee, setShowMarquee] = useState(false);
  const [showUltimateCutIn, setShowUltimateCutIn] = useState(false);
  const flashOpacityRef = useRef(0);
  const [isMusicEnabled, setIsMusicEnabled] = useState(true);
  
  // Performance Optimization: HUD Throttling
  const [hudData, setHudData] = useState({
    score: 0,
    totalKills: 0,
    timer: 0,
    ultimateCharges: 1,
    ultimateSwords: 20,
    weaponCooldown: 1000,
    hp: GAME_BALANCE.BASE.PLAYER_HP,
    maxHp: GAME_BALANCE.BASE.PLAYER_HP,
    exp: 0,
    nextLevelExp: GAME_BALANCE.BASE.EXP_REQUIRED,
    level: 1
  });
  const lastHudUpdateTimeRef = useRef(0);

  // Performance Optimization: Background Cache
  const bgCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Pre-render background for performance
  useEffect(() => {
    const bgCanvas = document.createElement('canvas');
    bgCanvas.width = CANVAS_WIDTH;
    bgCanvas.height = CANVAS_HEIGHT;
    const bgCtx = bgCanvas.getContext('2d');
    if (!bgCtx) return;

    const drawDefaultBg = () => {
      bgCtx.fillStyle = "#0f172a";
      bgCtx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      
      bgCtx.strokeStyle = "rgba(255, 255, 255, 0.05)";
      bgCtx.lineWidth = 1;
      for (let i = 0; i < CANVAS_WIDTH; i += 50) {
        bgCtx.beginPath(); bgCtx.moveTo(i, HUD_HEIGHT); bgCtx.lineTo(i, CANVAS_HEIGHT); bgCtx.stroke();
      }
      for (let i = HUD_HEIGHT; i < CANVAS_HEIGHT; i += 50) {
        bgCtx.beginPath(); bgCtx.moveTo(0, i); bgCtx.lineTo(CANVAS_WIDTH, i); bgCtx.stroke();
      }
      bgCanvasRef.current = bgCanvas;
    };

    if (BACKGROUND_CONFIG.gameBackground) {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        bgCtx.drawImage(img, 0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        bgCanvasRef.current = bgCanvas;
      };
      img.onerror = () => {
        drawDefaultBg();
      };
      img.src = BACKGROUND_CONFIG.gameBackground;
    } else {
      drawDefaultBg();
    }
  }, []);
  const [screenSize, setScreenSize] = useState({ width: window.innerWidth, height: window.innerHeight });
  const [gameScale, setGameScale] = useState(1);
  const [gameOffset, setGameOffset] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const handleResize = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      setScreenSize({ width: w, height: h });

      const targetRatio = LOGICAL_WIDTH / LOGICAL_HEIGHT;
      const screenRatio = w / h;

      let scale, offsetX = 0, offsetY = 0;
      if (screenRatio > targetRatio) {
        // Screen is wider than 9:16
        scale = h / LOGICAL_HEIGHT;
        offsetX = (w - LOGICAL_WIDTH * scale) / 2;
      } else {
        // Screen is taller than 9:16
        scale = w / LOGICAL_WIDTH;
        offsetY = (h - LOGICAL_HEIGHT * scale) / 2;
      }
      setGameScale(scale);
      setGameOffset({ x: offsetX, y: offsetY });
    };

    window.addEventListener("resize", handleResize);
    handleResize();
    return () => window.removeEventListener("resize", handleResize);
  }, []);
  
  // --- Audio System ---
  const audioCtxRef = useRef<AudioContext | null>(null);
  const bgmIntervalRef = useRef<number | null>(null);
  const bgmGainRef = useRef<GainNode | null>(null);
  const activeBgmNodesRef = useRef<(OscillatorNode | AudioBufferSourceNode)[]>([]);
  const warningOscRef = useRef<OscillatorNode | null>(null);
  const warningGainRef = useRef<GainNode | null>(null);
  const isMusicEnabledRef = useRef(true);

  useEffect(() => {
    isMusicEnabledRef.current = isMusicEnabled;
    const now = audioCtxRef.current?.currentTime || 0;
    
    // Unified BGM Gain Control
    if (bgmGainRef.current) {
      const isVisible = isMusicEnabled && (gameState === GameState.PLAYING || gameState === GameState.MENU);
      const target = isVisible ? 1.5 : 0;
      bgmGainRef.current.gain.setTargetAtTime(target, now, 0.1);
    }
  }, [isMusicEnabled, gameState]);

  const initAudio = () => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    const ctx = audioCtxRef.current;
    if (ctx.state === 'suspended') {
      ctx.resume();
    }
    
    // Play a silent buffer to unlock audio on iOS/Mobile
    try {
      const buffer = ctx.createBuffer(1, 1, 22050);
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);
      source.start(0);
    } catch (e) {
      console.error("Audio unlock failed:", e);
    }
  };

  const playLightningSound = useCallback((isStart = false) => {
    if (!audioCtxRef.current) initAudio();
    if (!audioCtxRef.current) return;
    
    const ctx = audioCtxRef.current;
    if (ctx.state === 'suspended') ctx.resume();
    
    const now = ctx.currentTime;
    
    // 1. THE CRACK (High-frequency explosion)
    const crackDuration = 0.5;
    const crackBufferSize = ctx.sampleRate * crackDuration;
    const crackBuffer = ctx.createBuffer(1, crackBufferSize, ctx.sampleRate);
    const crackData = crackBuffer.getChannelData(0);
    
    for (let i = 0; i < crackBufferSize; i++) {
      // White noise with a very sharp exponential decay
      const white = Math.random() * 2 - 1;
      const envelope = Math.exp(-i / (crackBufferSize / 15));
      // Add some "crackling" by squaring the noise occasionally
      const crackle = Math.random() > 0.9 ? white * white * 2 : white;
      crackData[i] = crackle * envelope;
    }

    const crackSource = ctx.createBufferSource();
    crackSource.buffer = crackBuffer;
    
    const crackFilter = ctx.createBiquadFilter();
    crackFilter.type = 'highpass';
    crackFilter.frequency.setValueAtTime(1000, now);
    
    const crackGain = ctx.createGain();
    crackGain.gain.setValueAtTime(0, now);
    crackGain.gain.linearRampToValueAtTime(isStart ? 0.7 : 0.4, now + 0.002);
    crackGain.gain.exponentialRampToValueAtTime(0.001, now + crackDuration);

    crackSource.connect(crackFilter);
    crackFilter.connect(crackGain);
    crackGain.connect(ctx.destination);
    
    // 2. THE RUMBLE (Deep rolling thunder)
    const rumbleDuration = isStart ? 5.0 : 2.5;
    const rumbleBufferSize = ctx.sampleRate * rumbleDuration;
    const rumbleBuffer = ctx.createBuffer(1, rumbleBufferSize, ctx.sampleRate);
    const rumbleData = rumbleBuffer.getChannelData(0);
    
    let lastOut = 0.0;
    for (let i = 0; i < rumbleBufferSize; i++) {
      const white = Math.random() * 2 - 1;
      // Brown noise filter
      const brown = (lastOut + (0.02 * white)) / 1.02;
      lastOut = brown;
      
      // Add some "rolling" modulation
      const modulation = 1.0 + 0.3 * Math.sin(i / 1000) * Math.sin(i / 5000);
      rumbleData[i] = brown * modulation;
    }

    const rumbleSource = ctx.createBufferSource();
    rumbleSource.buffer = rumbleBuffer;
    
    const rumbleFilter = ctx.createBiquadFilter();
    rumbleFilter.type = 'lowpass';
    rumbleFilter.frequency.setValueAtTime(400, now);
    rumbleFilter.frequency.exponentialRampToValueAtTime(40, now + rumbleDuration);
    
    const rumbleGain = ctx.createGain();
    rumbleGain.gain.setValueAtTime(0, now);
    rumbleGain.gain.linearRampToValueAtTime(isStart ? 0.4 : 0.2, now + 0.05);
    rumbleGain.gain.exponentialRampToValueAtTime(0.001, now + rumbleDuration);

    rumbleSource.connect(rumbleFilter);
    rumbleFilter.connect(rumbleGain);
    rumbleGain.connect(ctx.destination);

    // 3. THE IMPACT (Sub-bass thump)
    const thump = ctx.createOscillator();
    const thumpGain = ctx.createGain();
    thump.type = 'sine';
    thump.frequency.setValueAtTime(isStart ? 60 : 80, now);
    thump.frequency.exponentialRampToValueAtTime(20, now + 0.4);
    
    thumpGain.gain.setValueAtTime(0, now);
    thumpGain.gain.linearRampToValueAtTime(isStart ? 0.3 : 0.2, now + 0.01);
    thumpGain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
    
    thump.connect(thumpGain);
    thumpGain.connect(ctx.destination);
    
    crackSource.start(now);
    rumbleSource.start(now);
    thump.start(now);
    
    crackSource.stop(now + crackDuration);
    rumbleSource.stop(now + rumbleDuration);
    thump.stop(now + 0.5);
  }, []);

  const playUpgradeSound = () => {
    if (!audioCtxRef.current) return;
    const ctx = audioCtxRef.current;
    const now = ctx.currentTime;
    
    const playNote = (freq: number, delay: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine'; // Sine is the softest possible wave
      osc.frequency.setValueAtTime(freq, now + delay);
      gain.gain.setValueAtTime(0, now + delay);
      gain.gain.linearRampToValueAtTime(0.01, now + delay + 0.1); // Much lower volume
      gain.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.6);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + delay);
      osc.stop(now + delay + 0.6);
    };

    // Lower octave (C4, E4, G4, C5) - much warmer and less piercing
    playNote(261.63, 0);    
    playNote(329.63, 0.1);  
    playNote(392.00, 0.2);  
    playNote(523.25, 0.3); 
  };

  const playUltimateSound = () => {
    if (!audioCtxRef.current) return;
    const ctx = audioCtxRef.current;
    const now = ctx.currentTime;
    
    // 1. Shimmering rise
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(200, now);
    osc.frequency.exponentialRampToValueAtTime(800, now + 0.5);
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.1, now + 0.1);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.5);

    // 2. Low impact
    const lowOsc = ctx.createOscillator();
    const lowGain = ctx.createGain();
    lowOsc.type = 'sine';
    lowOsc.frequency.setValueAtTime(100, now + 0.4);
    lowOsc.frequency.exponentialRampToValueAtTime(40, now + 0.8);
    lowGain.gain.setValueAtTime(0, now + 0.4);
    lowGain.gain.linearRampToValueAtTime(0.3, now + 0.45);
    lowGain.gain.exponentialRampToValueAtTime(0.001, now + 0.8);
    lowOsc.connect(lowGain);
    lowGain.connect(ctx.destination);
    lowOsc.start(now + 0.4);
    lowOsc.stop(now + 0.8);
  };

  const playUltimateVoice = useCallback((text?: string, gender?: 'male' | 'female') => {
    if (!('speechSynthesis' in window) || !text) return;
    
    // 立即停止所有進行中的語音
    window.speechSynthesis.cancel();

    const targetGender = gender || 'female';

    const doSpeak = () => {
      const utterance = new SpeechSynthesisUtterance(text);
      const voices = window.speechSynthesis.getVoices();
      
      // Duck BGM volume
      if (bgmGainRef.current && audioCtxRef.current) {
        const now = audioCtxRef.current.currentTime;
        bgmGainRef.current.gain.setTargetAtTime(0.2, now, 0.1); 
        // Restore volume after voice ends
        utterance.onend = () => {
          if (bgmGainRef.current && audioCtxRef.current) {
             const endNow = audioCtxRef.current.currentTime;
             bgmGainRef.current.gain.setTargetAtTime(isMusicEnabledRef.current ? 0.8 : 0, endNow, 0.5);
          }
        };
      }
      
      // 篩選中文語音 (台灣、中國、香港、普通話)
      const zhVoices = voices.filter(v => 
        v.lang.toLowerCase().includes('zh') || 
        v.lang.toLowerCase().includes('zho') ||
        v.lang.toLowerCase().includes('cmn')
      );
      
      if (zhVoices.length > 0) {
        let selectedVoice = null;
        
        // 擴大識別關鍵字
        const maleKeywords = [
          'male', 'david', 'liao', 'kangkang', 'yunxi', 'man', 'zhiwei', 'yunjian', 
          '國語男', '普通話男', '台灣男', 'google 國語', 'microsoft yunxi', 'microsoft kangkang', 
          'xiaoxuan', 'yunfeng', 'yunze', 'boy', 'guy', '男', 'male', 'yunjiao', 'yunye'
        ];
        const femaleKeywords = [
          'female', 'mei', 'yating', 'hanhan', 'xiaoxiao', 'woman', 'xiaoyi', 'xiaomo', 
          '國語女', '普通話女', '台灣女', 'google 國語 2', 'microsoft xiaoxiao', 'microsoft hhui',
          '女', 'female', 'xiaozhen', 'xiaoru'
        ];

        const lowerMaleKeywords = maleKeywords.map(k => k.toLowerCase());
        const lowerFemaleKeywords = femaleKeywords.map(k => k.toLowerCase());

        console.log(`TTS Debug: Target=${targetGender}, text=${text}, zhVoicesCount=${zhVoices.length}`);

        if (targetGender === 'male') {
          // 1. 先找名字包含男性關鍵字的
          selectedVoice = zhVoices.find(v => lowerMaleKeywords.some(k => v.name.toLowerCase().includes(k)));
          // 2. 如果沒找到，找不包含女性關鍵字的
          if (!selectedVoice) {
            selectedVoice = zhVoices.find(v => !lowerFemaleKeywords.some(k => v.name.toLowerCase().includes(k)));
          }
        } else {
          // 1. 先找名字包含女性關鍵字的
          selectedVoice = zhVoices.find(v => lowerFemaleKeywords.some(k => v.name.toLowerCase().includes(k)));
          // 2. 如果沒找到，取第一個
          if (!selectedVoice) {
            selectedVoice = zhVoices[0];
          }
        }

        // 最後保險
        if (!selectedVoice) {
          selectedVoice = zhVoices.find(v => v.lang.includes('TW')) || zhVoices[0];
        }

        if (selectedVoice) {
          console.log(`TTS Debug: Selected Voice="${selectedVoice.name}" (${selectedVoice.lang})`);
          utterance.voice = selectedVoice;
          utterance.lang = selectedVoice.lang;
        }
      } else {
        utterance.lang = 'zh-TW';
      }

      utterance.volume = 1.0;
      utterance.pitch = 1.05; // Slightly sharper for clarity
      utterance.rate = 1.1; // Slightly faster to feel more "ultimate"

      window.speechSynthesis.speak(utterance);
    };

    if (window.speechSynthesis.getVoices().length === 0) {
      window.speechSynthesis.onvoiceschanged = () => {
        doSpeak();
        window.speechSynthesis.onvoiceschanged = null;
      };
    } else {
      setTimeout(doSpeak, 100); // 增加一點延遲，確保 cancel() 徹底完成
    }
  }, []);

  const clearAllBgmNodes = () => {
    activeBgmNodesRef.current.forEach(node => {
      try {
        node.stop();
        node.disconnect();
      } catch (e) {
        // Ignore errors for already stopped nodes
      }
    });
    activeBgmNodesRef.current = [];
  };

  const stopBGM = () => {
    if (bgmIntervalRef.current) {
      window.clearInterval(bgmIntervalRef.current);
      bgmIntervalRef.current = null;
    }
    clearAllBgmNodes();
    if (bgmGainRef.current && audioCtxRef.current) {
      bgmGainRef.current.gain.setTargetAtTime(0, audioCtxRef.current.currentTime, 0.1);
    }
  };

  const startMenuBGM = () => {
    if (!audioCtxRef.current) initAudio();
    const ctx = audioCtxRef.current;
    if (!ctx) return;

    // Unified Stop: Clear any existing BGM interval or nodes
    stopBGM();

    if (!bgmGainRef.current) {
      bgmGainRef.current = ctx.createGain();
      bgmGainRef.current.connect(ctx.destination);
    }
    
    // Force set volume
    const now = ctx.currentTime;
    bgmGainRef.current.gain.setTargetAtTime(isMusicEnabledRef.current ? 0.8 : 0, now, 0.1);

    const playMenuMelody = (force = false) => {
      if (!isMusicEnabledRef.current || (!force && gameStateRef.current !== GameState.MENU)) return;
      const ctx = audioCtxRef.current;
      if (!ctx || !bgmGainRef.current) return;
      if (ctx.state === 'suspended') ctx.resume();
      
      clearAllBgmNodes(); 
      const now = ctx.currentTime;
      
      const notes = [261.63, 293.66, 329.63, 392.00, 440.00, 523.25]; 
      const tempo = 0.4; 
      
      const melody = [5, 3, 4, 2, 3, 0, 2, 3]; 
      for (let i = 0; i < 16; i++) {
        const mTime = now + 0.05 + i * tempo;
        const freq = notes[melody[i % melody.length]];
        
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, mTime);
        gain.gain.setValueAtTime(0, mTime);
        gain.gain.linearRampToValueAtTime(0.4, mTime + 0.02); 
        gain.gain.exponentialRampToValueAtTime(0.001, mTime + tempo * 0.8); 
        osc.connect(gain);
        gain.connect(bgmGainRef.current);
        osc.start(mTime);
        osc.stop(mTime + tempo * 0.8);
        activeBgmNodesRef.current.push(osc);
      }

      for (let i = 0; i < 16; i++) {
        const bTime = now + 0.05 + i * tempo;
        if (i % 4 === 0) {
          const kick = ctx.createOscillator();
          const kGain = ctx.createGain();
          kick.frequency.setValueAtTime(100, bTime);
          kick.frequency.exponentialRampToValueAtTime(40, bTime + 0.1);
          kGain.gain.setValueAtTime(0.6, bTime);
          kGain.gain.exponentialRampToValueAtTime(0.001, bTime + 0.2);
          kick.connect(kGain);
          kGain.connect(bgmGainRef.current);
          kick.start(bTime);
          kick.stop(bTime + 0.2);
          activeBgmNodesRef.current.push(kick);
        }
        if (i % 4 === 2) {
          const noise = ctx.createBufferSource();
          const buffer = ctx.createBuffer(1, ctx.sampleRate * 0.1, ctx.sampleRate);
          const data = buffer.getChannelData(0);
          for (let j = 0; j < data.length; j++) data[j] = Math.random() * 2 - 1;
          noise.buffer = buffer;
          const nFilter = ctx.createBiquadFilter();
          nFilter.type = 'bandpass';
          nFilter.frequency.setValueAtTime(1000, bTime);
          const nGain = ctx.createGain();
          nGain.gain.setValueAtTime(0.2, bTime);
          nGain.gain.exponentialRampToValueAtTime(0.001, bTime + 0.1);
          noise.connect(nFilter);
          nFilter.connect(nGain);
          nGain.connect(bgmGainRef.current);
          noise.start(bTime);
          noise.stop(bTime + 0.1);
          activeBgmNodesRef.current.push(noise);
        }
      }
    };

    bgmIntervalRef.current = window.setInterval(() => playMenuMelody(), 6400);
    playMenuMelody(true); // Start immediately
  };

  const startBGM = () => {
    if (!audioCtxRef.current) initAudio();
    const ctx = audioCtxRef.current;
    if (!ctx) return;
    
    // Unified Stop: Clear any existing BGM interval or nodes
    stopBGM();
    
    if (!bgmGainRef.current) {
      bgmGainRef.current = ctx.createGain();
      bgmGainRef.current.connect(ctx.destination);
    }
    
    // Force game BGM volume
    const now = ctx.currentTime;
    bgmGainRef.current.gain.setTargetAtTime(isMusicEnabledRef.current ? 0.8 : 0, now, 0.1);
    
    const playMelody = (force = false) => {
      if (!isMusicEnabledRef.current || (!force && gameStateRef.current !== GameState.PLAYING)) return;
      const ctx = audioCtxRef.current;
      if (!ctx || !bgmGainRef.current) return;
      
      const playActualMelody = () => {
        clearAllBgmNodes(); 
        const now = ctx.currentTime;
        const notes = [261.63, 293.66, 329.63, 392.00, 440.00, 523.25, 587.33, 659.25]; 
        const melody = [
          { n: 0, d: 2 }, { n: 2, d: 2 }, { n: 3, d: 4 }, 
          { n: 5, d: 2 }, { n: 4, d: 2 }, { n: 3, d: 4 },
          { n: 2, d: 2 }, { n: 4, d: 2 }, { n: 5, d: 2 }, { n: 7, d: 2 },
          { n: 5, d: 8 }
        ];
        const tempo = 0.15; 
        let mTime = now + 0.05;

        melody.forEach(item => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(notes[item.n], mTime);
          const duration = item.d * tempo;
          gain.gain.setValueAtTime(0, mTime);
          gain.gain.linearRampToValueAtTime(0.5, mTime + 0.03); 
          gain.gain.exponentialRampToValueAtTime(0.001, mTime + duration * 0.8);
          osc.connect(gain);
          gain.connect(bgmGainRef.current!);
          osc.start(mTime);
          osc.stop(mTime + duration);
          activeBgmNodesRef.current.push(osc);
          mTime += duration;
        });

        for (let i = 0; i < 64; i++) {
          const bTime = now + 0.05 + i * tempo;
          if ((i % 4 === 0) || (i % 4 === 2) || (i % 4 === 3)) {
            const bOsc = ctx.createOscillator();
            const bGain = ctx.createGain();
            bOsc.type = 'triangle';
            bOsc.frequency.setValueAtTime(i < 32 ? notes[0] * 0.5 : notes[3] * 0.5, bTime);
            bGain.gain.setValueAtTime(0, bTime);
            bGain.gain.linearRampToValueAtTime(2.4, bTime + 0.02); 
            bGain.gain.exponentialRampToValueAtTime(0.001, bTime + tempo * 0.6);
            bOsc.connect(bGain);
            bGain.connect(bgmGainRef.current!);
            bOsc.start(bTime);
            bOsc.stop(bTime + tempo * 0.6);
            activeBgmNodesRef.current.push(bOsc);
          }
        }
      };

      if (ctx.state === 'suspended') {
        ctx.resume().then(() => {
          if (force || gameStateRef.current === GameState.PLAYING) playActualMelody();
        });
      } else {
        playActualMelody();
      }
    };

    bgmIntervalRef.current = window.setInterval(() => playMelody(), 9600);
    playMelody(true); // Start immediately
  };

  useEffect(() => {
    if (gameState === GameState.UPGRADE) {
      playUpgradeSound();
    }
  }, [gameState]);

  useEffect(() => {
    return () => {
      if (bgmIntervalRef.current) clearInterval(bgmIntervalRef.current);
      clearAllBgmNodes();
    };
  }, []);
  
  // Game Refs (to avoid re-renders during game loop)
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<Player>({
    id: "player",
    x: CANVAS_WIDTH / 2,
    y: CANVAS_HEIGHT / 2,
    radius: PLAYER_RADIUS,
    hp: GAME_BALANCE.BASE.PLAYER_HP,
    maxHp: GAME_BALANCE.BASE.PLAYER_HP,
    speed: 4.0,
    exp: 0,
    level: 1,
    nextLevelExp: GAME_BALANCE.BASE.EXP_REQUIRED,
    pickupRange: GAME_BALANCE.BASE.PLAYER_PICKUP_RANGE,
    weapons: [
      {
        id: "sword-1",
        name: "青雲劍",
        damage: GAME_BALANCE.BASE.PLAYER_DAMAGE,
        cooldown: 400,
        lastFired: 0,
        range: 300,
        count: GAME_BALANCE.BASE.PLAYER_SWORDS,
        level: 1,
        type: "SWORD",
      },
    ],
  });

  const enemiesRef = useRef<Enemy[]>([]);
  const projectilesRef = useRef<Projectile[]>([]);
  const gemsRef = useRef<Gem[]>([]);
  const lightningRef = useRef<Lightning[]>([]);
  const lastLightningTimeRef = useRef(0);
  const lastLightningSoundTimeRef = useRef(0);
  const tribulationStartTimeRef = useRef(0);
  const keysRef = useRef<{ [key: string]: boolean }>({});
  const targetPosRef = useRef<Point | null>(null);
  const isPointerDownRef = useRef(false);
  const joystickBaseRef = useRef<Point | null>(null);
  const joystickCurrentRef = useRef<Point | null>(null);
  const lastSpawnTimeRef = useRef(0);
  const lastTimeRef = useRef(0);
  const lastSpacePressRef = useRef(0);
  const sessionStartTimeRef = useRef(0);
  const frameIdRef = useRef<number>(0);
  const lastClickTimeRef = useRef(0);
  const facingRightRef = useRef(true);

  const [selectedUpgradeIndex, setSelectedUpgradeIndex] = useState(0);

  const spawnEnemy = useCallback((time: number, forceBoss: boolean = false) => {
    const side = Math.floor(Math.random() * 4);
    let x, y;
    if (side === 0) { x = Math.random() * CANVAS_WIDTH; y = HUD_HEIGHT - 50; }
    else if (side === 1) { x = CANVAS_WIDTH + 50; y = Math.random() * (CANVAS_HEIGHT - HUD_HEIGHT) + HUD_HEIGHT; }
    else if (side === 2) { x = Math.random() * CANVAS_WIDTH; y = CANVAS_HEIGHT + 50; }
    else { x = -50; y = Math.random() * (CANVAS_HEIGHT - HUD_HEIGHT) + HUD_HEIGHT; }

    const player = playerRef.current;
    const bracket = Math.floor((player.level - 1) / 10);
    const isBossLevel = player.level % 10 === 0 || forceBoss;
    
    // Check if a boss already exists
    const bossExists = enemiesRef.current.some(e => e.isBoss);
    
    // 使用新的連動平衡配置
    const config_balance = gameConfig;

    if (isBossLevel && !bossExists) {
      // Spawn Boss
      const visualIdx = Math.min(bracket + 1, ENEMY_CONFIG.length - 1);
      const config = ENEMY_CONFIG[visualIdx];
      
      // Boss HP scales based on baseHealth and level
      const bossHp = (config.baseHealth * 15 + (Math.pow(player.level, 1.7) * 40)) * config_balance.enemyHpMult;
      
      const newEnemy: Enemy = {
        id: "boss-" + time + Math.random(),
        x, y,
        radius: 40, 
        hp: bossHp,
        maxHp: bossHp,
        speed: ((config.baseSpeed * 0.8) + (player.level * 0.005)) * config_balance.enemySpeedMult,
        damage: (config.baseAttack * 2 + player.level * 3) * config_balance.enemyDamageMult,
        expValue: 100 * player.level,
        type: "DEMON",
        color: config.color,
        level: player.level,
        isBoss: true,
        visualType: visualIdx,
        dropChance: config.dropChance,
        lastAttackTime: time,
        attackCooldown: 2000 + Math.random() * 1000, // 2-3 seconds base cooldown
        seed: fastHash("boss-" + visualIdx + time)
      };
      enemiesRef.current.push(newEnemy);
      return;
    }

    if (isBossLevel && bossExists) return; 
    if (isBossLevel && Math.random() > 0.3) return;

    const visualIdx = Math.min(bracket, ENEMY_CONFIG.length - 1);
    const config = ENEMY_CONFIG[visualIdx];
    
    const targetKillsPerLevel = 25;
    const scaledExp = Math.max(5, Math.floor(player.nextLevelExp / targetKillsPerLevel));

    // Enemy stats based on ENEMY_CONFIG and growth
    const healthGrowth = Math.pow(GAME_BALANCE.BASE.ENEMY_GROWTH, player.level - 1);
    const enemyHp = config.baseHealth * healthGrowth * config_balance.enemyHpMult;
    const enemySpeed = (config.baseSpeed + (player.level * 0.005)) * config_balance.enemySpeedMult;
    const enemyDamage = (config.baseAttack + player.level * 0.5) * config_balance.enemyDamageMult;

    const newEnemy: Enemy = {
      id: Math.random().toString(),
      x, y,
      radius: 15 + Math.random() * 5,
      hp: enemyHp,
      maxHp: enemyHp,
      speed: enemySpeed,
      damage: enemyDamage,
      expValue: scaledExp,
      type: "DEMON",
      color: config.color,
      level: player.level,
      visualType: visualIdx,
      dropChance: config.dropChance,
      seed: fastHash(visualIdx + "-" + time + "-" + Math.random())
    };
    enemiesRef.current.push(newEnemy);
  }, [difficulty]);

  const generateUpgrades = useCallback(() => {
    const selectedStyle = CHARACTER_STYLES.find(s => s.id === selectedStyleId) || CHARACTER_STYLES[0];
    const ultName = selectedStyle.ultimateName || "必殺技";
    
    const pool = getUpgradePool(ultName);
    // Shuffle and pick 3
    return pool.sort(() => Math.random() - 0.5).slice(0, 3);
  }, [selectedStyleId]);

  const applyUpgrade = useCallback((upgrade: Upgrade) => {
    const player = playerRef.current;
    
    // 從設定檔讀取對應難度的數值
    const values = getUpgradeValues(difficulty);
    const multiplier = 1; // 基礎倍率，目前維持 1

    switch (upgrade.type) {
      case UpgradeType.PLAYER_SPEED: 
        player.speed += values.PLAYER_SPEED * multiplier; 
        break;
      case UpgradeType.WEAPON_DAMAGE: 
        const dmgBonus = values.WEAPON_DAMAGE * multiplier;
        player.weapons.forEach(w => w.damage += dmgBonus); 
        (player as any).damage = (player as any).damage ? (player as any).damage + dmgBonus : dmgBonus;
        break;
      case UpgradeType.WEAPON_SPEED: 
        const reduction = 1 - (values.WEAPON_COOLDOWN_REDUCTION * multiplier);
        player.weapons.forEach(w => w.cooldown = Math.max(50, w.cooldown * reduction)); 
        break;
      case UpgradeType.PICKUP_RANGE: 
        player.pickupRange += values.PICKUP_RANGE * multiplier; 
        break;
      case UpgradeType.MAX_HP: 
        player.maxHp += values.MAX_HP * multiplier; 
        player.hp += values.MAX_HP * multiplier; 
        break;
      case UpgradeType.WEAPON_COUNT: 
        player.weapons.forEach(w => w.count += Math.round(values.WEAPON_COUNT * multiplier)); 
        break;
      case UpgradeType.ULTIMATE_SWORDS:
        ultimateSwordBonusRef.current += values.ULTIMATE_SWORDS * multiplier;
        break;
    }
    setGameState(GameState.PLAYING);
    
    // If we just leveled up to a boss level (10, 20, 30...), start the tribulation sequence
    if (player.level % 10 === 0 && !tribulationActive) {
      setTribulationActive(true);
      setShowMarquee(true);
      playLightningSound(true); // Play massive start thunder
      tribulationStartTimeRef.current = performance.now();
    }
  }, [tribulationActive, difficulty]);

  // Use refs for values needed in event listeners to avoid re-binding
  const gameStateRef = useRef(gameState);
  const availableUpgradesRef = useRef(availableUpgrades);
  const selectedUpgradeIndexRef = useRef(selectedUpgradeIndex);
  
  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  useEffect(() => {
    availableUpgradesRef.current = availableUpgrades;
  }, [availableUpgrades]);

  useEffect(() => {
    selectedUpgradeIndexRef.current = selectedUpgradeIndex;
  }, [selectedUpgradeIndex]);

  // Input Handling
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      
      // Always track keys for movement
      if (["w", "a", "s", "d", "arrowup", "arrowdown", "arrowleft", "arrowright"].includes(key)) {
        keysRef.current[key] = true;
        // Only prevent default if playing to avoid blocking browser shortcuts in other states
        if (gameStateRef.current === GameState.PLAYING) {
          e.preventDefault();
        }
      }

      // Pause Control
      if (gameStateRef.current === GameState.PLAYING || gameStateRef.current === GameState.PAUSED) {
        if (key === "p" || key === "escape") {
          e.preventDefault();
          setGameState(prev => prev === GameState.PAUSED ? GameState.PLAYING : GameState.PAUSED);
        }
      }

      // Ultimate Control (Double-tap Space)
      if (gameStateRef.current === GameState.PLAYING) {
        if (key === " ") {
          const now = performance.now();
          if (now - lastSpacePressRef.current < 300) {
            e.preventDefault();
            useUltimate();
            lastSpacePressRef.current = 0; // Reset to prevent triple-tap triggering twice
          } else {
            lastSpacePressRef.current = now;
          }
        }
      }

      // Menu Navigation & Game Control
      if (gameStateRef.current === GameState.UPGRADE) {
        if (key === "arrowup" || key === "w") {
          e.preventDefault();
          setSelectedUpgradeIndex(prev => (prev > 0 ? prev - 1 : availableUpgradesRef.current.length - 1));
        } else if (key === "arrowdown" || key === "s") {
          e.preventDefault();
          setSelectedUpgradeIndex(prev => (prev < availableUpgradesRef.current.length - 1 ? prev + 1 : 0));
        } else if (key === " " || key === "enter") {
          e.preventDefault();
          const currentUpgrades = availableUpgradesRef.current;
          const currentIndex = selectedUpgradeIndexRef.current;
          if (currentUpgrades[currentIndex]) {
            applyUpgrade(currentUpgrades[currentIndex]);
          }
        }
      } else if (gameStateRef.current === GameState.MENU || gameStateRef.current === GameState.GAMEOVER || gameStateRef.current === GameState.WIN) {
        if (key === " " || key === "enter") {
          e.preventDefault();
          startGame();
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      keysRef.current[e.key.toLowerCase()] = false;
    };
    
    const getPointerPos = (e: MouseEvent | TouchEvent): Point => {
      const canvas = canvasRef.current;
      if (!canvas) return { x: 0, y: 0 };
      const rect = canvas.getBoundingClientRect();
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
      
      // Convert screen coordinates to logical game coordinates
      return {
        x: (clientX - rect.left) * (LOGICAL_WIDTH / rect.width),
        y: (clientY - rect.top) * (LOGICAL_HEIGHT / rect.height)
      };
    };

    const handlePointerDown = (e: MouseEvent | TouchEvent) => {
      initAudio(); 
      if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') {
        audioCtxRef.current.resume().then(() => {
          // Re-check music after resume
          if (gameStateRef.current === GameState.MENU && !bgmIntervalRef.current) {
            startMenuBGM();
          } else if (gameStateRef.current === GameState.PLAYING && !bgmIntervalRef.current) {
            startBGM();
          }
        });
      }
      
      // Ensure BGM is running if game has started or in menu
      if (gameStateRef.current === GameState.PLAYING && !bgmIntervalRef.current) {
        startBGM();
      } else if (gameStateRef.current === GameState.MENU && !bgmIntervalRef.current) {
        startMenuBGM();
      }

      // Double-tap detection for mobile ultimate
      const now = performance.now();
      const diff = now - lastClickTimeRef.current;
      if (diff < 300 && gameStateRef.current === GameState.PLAYING) {
        useUltimate();
        lastClickTimeRef.current = 0; // Reset
      } else {
        lastClickTimeRef.current = now;
      }

      isPointerDownRef.current = true;
      const pos = getPointerPos(e);
      joystickBaseRef.current = pos;
      joystickCurrentRef.current = pos;
      // Prevent scrolling on touch
      if ('touches' in e) e.preventDefault();
    };

    const handlePointerMove = (e: MouseEvent | TouchEvent) => {
      if (isPointerDownRef.current) {
        joystickCurrentRef.current = getPointerPos(e);
      }
    };

    const handlePointerUp = () => {
      isPointerDownRef.current = false;
      joystickBaseRef.current = null;
      joystickCurrentRef.current = null;
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    
    const canvas = canvasRef.current;
    if (canvas) {
      canvas.addEventListener("mousedown", handlePointerDown);
      window.addEventListener("mousemove", handlePointerMove);
      window.addEventListener("mouseup", handlePointerUp);
      
      canvas.addEventListener("touchstart", handlePointerDown, { passive: false });
      window.addEventListener("touchmove", handlePointerMove, { passive: false });
      window.addEventListener("touchend", handlePointerUp);
    }

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      if (canvas) {
        canvas.removeEventListener("mousedown", handlePointerDown);
        window.removeEventListener("mousemove", handlePointerMove);
        window.removeEventListener("mouseup", handlePointerUp);
        canvas.removeEventListener("touchstart", handlePointerDown);
        window.removeEventListener("touchmove", handlePointerMove);
        window.removeEventListener("touchend", handlePointerUp);
      }
    };
  }, [applyUpgrade]); // Only re-bind if applyUpgrade changes (which is stable)

  const gameLoop = useCallback((time: number) => {
    if (gameState !== GameState.PLAYING) return;

    const deltaTime = time - lastTimeRef.current;
    lastTimeRef.current = time;
    
    // Cap deltaTime to avoid huge jumps after tab switch
    const dt = Math.min(deltaTime, 100);
    const dtFactor = dt / 16.66; // Normalized to 60fps

    // IF ULTIMATE CUT-IN IS SHOWING, FREEZE ALMOST EVERYTHING
    const isPausedByEffect = showUltimateCutIn;

    if (!isPausedByEffect) {
      timerRef.current += dt / 1000;
    }

    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;

    // 1. Update Player
    const player = playerRef.current;
    let dx = 0, dy = 0;
    
    if (!isPausedByEffect) {
      // Keyboard movement (Additive)
      if (keysRef.current["w"] || keysRef.current["arrowup"]) dy -= 1;
      if (keysRef.current["s"] || keysRef.current["arrowdown"]) dy += 1;
      if (keysRef.current["a"] || keysRef.current["arrowleft"]) dx -= 1;
      if (keysRef.current["d"] || keysRef.current["arrowright"]) dx += 1;

    // Mouse/Touch movement (Joystick - Additive)
    if (joystickBaseRef.current && joystickCurrentRef.current) {
      const jdx = joystickCurrentRef.current.x - joystickBaseRef.current.x;
      const jdy = joystickCurrentRef.current.y - joystickBaseRef.current.y;
      const distSq = jdx * jdx + jdy * jdy;
      
      if (distSq > 25) { // Deadzone (5^2)
        const dist = Math.sqrt(distSq);
        // Normalize joystick vector to -1 to 1 range for consistent speed
        dx += jdx / dist;
        dy += jdy / dist;
      }
    }

    if (dx !== 0 || dy !== 0) {
      const length = Math.sqrt(dx * dx + dy * dy);
      player.x += (dx / length) * player.speed * dtFactor;
      player.y += (dy / length) * player.speed * dtFactor;
      
      // Update facing direction
      if (dx > 0) facingRightRef.current = true;
      else if (dx < 0) facingRightRef.current = false;
    }
  }

    if (!isPausedByEffect) {
      // Keep player in bounds
      player.x = Math.max(player.radius, Math.min(CANVAS_WIDTH - player.radius, player.x));
      player.y = Math.max(HUD_HEIGHT + player.radius, Math.min(CANVAS_HEIGHT - player.radius, player.y));
    }

    // 2. Spawn Enemies & Tribulation Logic
    const isBossLevel = player.level % 10 === 0;
    const bossExists = enemiesRef.current.some(e => e.isBoss);

    if (!isPausedByEffect) {
      if (tribulationActive && showMarquee) {
      const tribulationElapsed = time - tribulationStartTimeRef.current;
      const minTribulationTime = 6000; // 6 seconds

      // Lightning phase: Rolling thunder
      if (time - lastLightningTimeRef.current > 80) {
        const smallEnemies = enemiesRef.current.filter(e => !e.isBoss && e.hp > 0);
        
        // Always strike somewhere for visual effect
        const strikeCount = Math.floor(Math.random() * 3) + 1;
        for (let i = 0; i < strikeCount; i++) {
          let targetX, targetY, targetEnemy: Enemy | null = null;
          
          if (smallEnemies.length > 0 && Math.random() > 0.2) {
            // Strike an enemy
            targetEnemy = smallEnemies[Math.floor(Math.random() * smallEnemies.length)];
            targetX = targetEnemy.x;
            targetY = targetEnemy.y;
          } else {
            // Strike a random spot
            targetX = Math.random() * CANVAS_WIDTH;
            targetY = Math.random() * (CANVAS_HEIGHT - HUD_HEIGHT) + HUD_HEIGHT;
          }

          lightningRef.current.push({
            id: Math.random().toString(),
            x: targetX + (Math.random() - 0.5) * 200,
            y: -50,
            targetX: targetX,
            targetY: targetY,
            life: 250,
          });

          // Play lightning sound with a cooldown to avoid overlapping distortion
          // Reduced cooldown for "many together" feel
          if (i === 0 && time - lastLightningSoundTimeRef.current > 250) {
            playLightningSound();
            lastLightningSoundTimeRef.current = time;
          }

          if (targetEnemy) {
            // Gradually kill enemies over the duration
            // We want them all dead by the end of minTribulationTime
            const progress = tribulationElapsed / minTribulationTime;
            const damageMult = progress > 0.8 ? 1.0 : 0.25; 
            targetEnemy.hp -= targetEnemy.maxHp * damageMult;
          }
        }
        lastLightningTimeRef.current = time;
      }

      // Check if we can proceed to boss
      // Must wait at least minTribulationTime AND clear small enemies
      if (tribulationElapsed > minTribulationTime) {
        const smallEnemiesRemaining = enemiesRef.current.filter(e => !e.isBoss && e.hp > 0).length;
        if (smallEnemiesRemaining === 0) {
          if (!bossExists) {
            spawnEnemy(time, true); // Force boss spawn
            playLightningSound(true); // Boss entrance sound
            setTribulationActive(false); // End lightning phase when boss appears
            setShowMarquee(false); // End marquee when boss appears
          }
        } else {
          // If time is up but enemies remain, strike them all down!
          enemiesRef.current.forEach(e => { if (!e.isBoss) e.hp = 0; });
        }
      }
    } else {
      const currentSpawnRate = Math.max(400, gameConfig.spawnInterval - (player.level * 2.5));
      if (time - lastSpawnTimeRef.current > currentSpawnRate) {
        // Only spawn small mobs if not in boss fight
        if (!isBossLevel) {
          // Spawn multiple enemies at once as level increases - Slowed down increase
          const spawnCount = 1 + Math.floor(player.level / 50);
          for (let i = 0; i < spawnCount; i++) {
            spawnEnemy(time);
          }
        }
        lastSpawnTimeRef.current = time;
      }
    }
  }

    // Update Lightning
    if (!isPausedByEffect) {
      lightningRef.current = lightningRef.current.filter(l => {
        l.life -= dt;
        return l.life > 0;
      });
    }

    // 3. Update Weapons & Projectiles
    if (!isPausedByEffect) {
      const eArr = enemiesRef.current;
      const eLen = eArr.length;
      player.weapons.forEach(weapon => {
        if (time - weapon.lastFired > weapon.cooldown) {
          const rangeSq = weapon.range * weapon.range;
          let targetsFound = 0;
          
          // Optimization: Simple pass to find targets without initial full sort
          for (let i = 0; i < eLen && targetsFound < weapon.count; i++) {
            const target = eArr[i];
            if (target.hp <= 0) continue;
            
            const dx = target.x - player.x;
            const dy = target.y - player.y;
            const distSq = dx * dx + dy * dy;
            
            if (distSq < rangeSq) {
              const angle = Math.atan2(dy, dx);
              const style = CHARACTER_STYLES.find(s => s.id === selectedStyleIdRef.current) || CHARACTER_STYLES[0];
              const projSpeed = style.projectileType === 'palm' ? 5 : 10;
              projectilesRef.current.push({
                id: Math.random().toString(),
                x: player.x,
                y: player.y,
                vx: Math.cos(angle) * projSpeed * dtFactor,
                vy: Math.sin(angle) * projSpeed * dtFactor,
                radius: 11, 
                damage: weapon.damage,
                life: 2000,
                color: "#60a5fa",
                ownerId: "player",
                renderType: style.projectileType,
                seed: Math.random() * 1000
              });
              targetsFound++;
            }
          }
          weapon.lastFired = time;
        }
      });
    }

    // 4. Update Projectiles
    if (!isPausedByEffect) {
      projectilesRef.current = projectilesRef.current.filter(p => {
      if (p.isUltimate) {
        if (!p.phase) {
          p.phase = "BACK";
          p.phaseTimer = 0;
        }

        p.phaseTimer = (p.phaseTimer || 0) + dt;

        if (p.phase === "BACK") {
          // Move slowly backwards
          const backSpeed = 2 * dtFactor;
          p.x -= (p.vx / (10 * dtFactor)) * backSpeed;
          p.y -= (p.vy / (10 * dtFactor)) * backSpeed;
          if (p.phaseTimer > 500) {
            p.phase = "PAUSE";
            p.phaseTimer = 0;
          }
          return p.life > 0; // Don't hit enemies in back phase
        } else if (p.phase === "PAUSE") {
          // Shake slightly
          p.x += (Math.random() - 0.5) * 1;
          p.y += (Math.random() - 0.5) * 1;
          if (p.phaseTimer > 300) {
            p.phase = "FORWARD";
            p.phaseTimer = 0;
          }
          return p.life > 0;
        } else if (p.phase === "FORWARD") {
          // FORWARD phase - slower, majestic speed with HOMING logic
          const forwardSpeed = 8 * dtFactor;
          
          // Find nearest enemy for this specific projectile
          let nearestEnemy: Enemy | null = null;
          let minDistSq = Infinity;
          
          enemiesRef.current.forEach(enemy => {
            if (enemy.hp > 0) {
              const dSq = getDistanceSq(p, enemy);
              if (dSq < minDistSq) {
                minDistSq = dSq;
                nearestEnemy = enemy;
              }
            }
          });

          if (nearestEnemy) {
            // Calculate angle to target
            const targetAngle = Math.atan2(nearestEnemy.y - p.y, nearestEnemy.x - p.x);
            const currentAngle = Math.atan2(p.vy, p.vx);
            
            // Gradually rotate current angle towards target angle (homing strength)
            let angleDiff = targetAngle - currentAngle;
            while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
            while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
            
            const rotationSpeed = 0.15 * dtFactor; 
            const newAngle = currentAngle + Math.sign(angleDiff) * Math.min(Math.abs(angleDiff), rotationSpeed);
            
            const mag = 18 * dtFactor;
            p.vx = Math.cos(newAngle) * mag;
            p.vy = Math.sin(newAngle) * mag;
          }

          p.x += (p.vx / (18 * dtFactor)) * forwardSpeed;
          p.y += (p.vy / (18 * dtFactor)) * forwardSpeed;
        } else if (p.phase === "HEAVENLY" && p.strikeTarget) {
          // Custom logic for Heavenly Impact: Explode and STAY on ground for a bit
          if (!p.isImpacted) {
            p.x += p.vx;
            p.y += p.vy;

            if (p.y >= p.strikeTarget.y) {
              p.x = p.strikeTarget.x;
              p.y = p.strikeTarget.y;
              p.vx = 0;
              p.vy = 0;
              p.isImpacted = true;
              p.life = 500; // 停留時間精確設定為 0.5 秒 (500ms)
              
              const impactX = p.strikeTarget.x;
              const impactY = p.strikeTarget.y;

              // Shockwave damage (震波傷害)
              enemiesRef.current.forEach(enemy => {
                const ex = enemy.x - impactX;
                const ey = enemy.y - impactY;
                const distSq = ex*ex + ey*ey;
                const shockRadius = 380; 
                
                if (distSq < shockRadius ** 2) {
                  const dist = Math.sqrt(distSq);
                  const damageMult = Math.max(0.2, 1 - (dist / shockRadius));
                  enemy.hp -= p.damage * damageMult; 
                  
                  const knockAngle = Math.atan2(enemy.y - impactY, enemy.x - impactX);
                  enemy.x += Math.cos(knockAngle) * 65 * damageMult;
                  enemy.y += Math.sin(knockAngle) * 65 * damageMult;
                }
              });
              flashOpacityRef.current = 0.6;
              setTimeout(() => { flashOpacityRef.current = 0; }, 40);
            }
          }
        } else {
          // Other phases: Straight movement
          p.x += p.vx;
          p.y += p.vy;
        }
      } else {
        p.x += p.vx;
        p.y += p.vy;
      }

      p.life -= dt;

      // Check collision
      let hit = false;
      const pRadius = p.radius;
      if (p.ownerId === "player") {
        // Hit enemies
        const enemies = enemiesRef.current;
        for (let i = 0; i < enemies.length; i++) {
          const enemy = enemies[i];
          const distSq = getDistanceSq(p, enemy);
          const collideDist = pRadius + enemy.radius;
          if (distSq < collideDist * collideDist) {
            enemy.hp -= p.damage;
            hit = true;
            break; // Stop after first hit to prevent multiple hits if not a piercing weapon
          }
        }
      } else {
        // Hit player (Enemy projectile)
        const distSq = getDistanceSq(p, player);
        const collideDist = pRadius + player.radius;
        if (distSq < collideDist * collideDist) {
          player.hp -= p.damage;
          hit = true;
          if (player.hp <= 0) {
            setGameState(GameState.GAMEOVER);
          }
        }
      }

      return !hit && p.life > 0 && p.x > -500 && p.x < CANVAS_WIDTH + 500 && p.y > -1200 && p.y < CANVAS_HEIGHT + 500;
    });
  }

    // 5. Update Enemies
    if (!isPausedByEffect) {
      let deathsThisFrame = 0;
      
      // Boss Attack Implementation
      const executeBossAttack = (boss: Enemy, playerEntity: Player, currentTime: number) => {
        const baseAngle = Math.atan2(playerEntity.y - boss.y, playerEntity.x - boss.x);
        const projDamage = boss.damage * 0.8; 
        
        const burstCount = difficulty === Difficulty.NORMAL ? 2 : 1;
        
        for (let b = 0; b < burstCount; b++) {
          const shift = (burstCount === 2) ? (b === 0 ? -0.15 : 0.15) : 0;
          const angleToPlayer = baseAngle + shift;

          switch (boss.visualType) {
            case 0: // Bat - Sonic wave (rings)
              for (let i = 0; i < 3; i++) {
                setTimeout(() => {
                  projectilesRef.current.push({
                     id: "boss-sonic-" + Math.random(),
                     x: boss.x, y: boss.y,
                     vx: Math.cos(angleToPlayer) * 5 * dtFactor,
                     vy: Math.sin(angleToPlayer) * 5 * dtFactor,
                     radius: 12, damage: projDamage, life: 1500,
                     color: "#ef4444", ownerId: "enemy",
                     type: "BOSS_SONIC"
                  });
                }, i * 200);
              }
              break;
              
            case 1: // Spider - Silk Net
              projectilesRef.current.push({
                 id: "boss-silk-" + Math.random(),
                 x: boss.x, y: boss.y,
                 vx: Math.cos(angleToPlayer) * 3 * dtFactor,
                 vy: Math.sin(angleToPlayer) * 3 * dtFactor,
                 radius: 40, damage: projDamage * 0.5, life: 3000,
                 color: "#ffffff", ownerId: "enemy",
                 type: "BOSS_SILK"
              });
              break;
              
            case 2: // Toad - Toxin Bubbles (Bubbles rotate slightly)
              for (let i = -2; i <= 2; i++) {
                 const angle = angleToPlayer + (i * 0.25);
                 projectilesRef.current.push({
                    id: "boss-toxin-" + Math.random(),
                    x: boss.x, y: boss.y,
                    vx: Math.cos(angle) * 4 * dtFactor,
                    vy: Math.sin(angle) * 4 * dtFactor,
                    radius: 14, damage: projDamage, life: 2000,
                    color: "#22c55e", ownerId: "enemy",
                    type: "BOSS_FIRE" // Reuse fire effect for toxin glow
                 });
              }
              break;
              
            case 3: // Wolf - Sonic Howl (Uses sonic rings like the bat, but faster)
               for (let i = 0; i < 4; i++) {
                 setTimeout(() => {
                   projectilesRef.current.push({
                      id: "boss-howl-" + Math.random(),
                      x: boss.x, y: boss.y,
                      vx: Math.cos(angleToPlayer) * 7 * dtFactor,
                      vy: Math.sin(angleToPlayer) * 7 * dtFactor,
                      radius: 15, damage: projDamage, life: 1200,
                      color: "#94a3b8", ownerId: "enemy",
                      type: "BOSS_SONIC"
                   });
                 }, i * 150);
               }
               break;
  
            case 4: // Hawk - Lightning Arrow (Projectile lightning)
              for (let i = -1; i <= 1; i++) {
                 const angle = angleToPlayer + (i * 0.2);
                 projectilesRef.current.push({
                    id: "boss-bolt-" + Math.random(),
                    x: boss.x, y: boss.y,
                    vx: Math.cos(angle) * 12 * dtFactor,
                    vy: Math.sin(angle) * 12 * dtFactor,
                    radius: 8, damage: projDamage * 1.5, life: 1000,
                    color: "#eab308", ownerId: "enemy",
                    type: "BOSS_THUNDER"
                 });
              }
              break;
  
            case 5: // Naga - Ice Spikes (Heavier shards)
               for (let i = -2; i <= 2; i++) {
                 const angle = angleToPlayer + (i * 0.4);
                 projectilesRef.current.push({
                    id: "boss-ice-" + Math.random(),
                    x: boss.x, y: boss.y,
                    vx: Math.cos(angle) * 8 * dtFactor,
                    vy: Math.sin(angle) * 8 * dtFactor,
                    radius: 12, damage: projDamage, life: 1800,
                    color: "#7dd3fc", ownerId: "enemy",
                    type: "BOSS_ICE"
                 });
               }
               break;
  
            case 6: // Yaksa - Flame Trident
              for (let i = -1; i <= 1; i++) {
                const angle = angleToPlayer + (i * 0.3);
                projectilesRef.current.push({
                   id: "boss-fire-" + Math.random(),
                   x: boss.x, y: boss.y,
                   vx: Math.cos(angle) * 6 * dtFactor,
                   vy: Math.sin(angle) * 6 * dtFactor,
                   radius: 20, damage: projDamage, life: 2000,
                   color: "#f97316", ownerId: "enemy",
                   type: "BOSS_FIRE"
                });
              }
              break;
  
            case 7: // Assassin - Rotating Twin Blades
              for (let i = 0; i < 2; i++) {
                const offsetAngle = angleToPlayer + (i === 0 ? 0.4 : -0.4);
                projectilesRef.current.push({
                   id: "boss-blade-" + Math.random(),
                   x: boss.x, y: boss.y,
                   vx: Math.cos(offsetAngle) * 9 * dtFactor,
                   vy: Math.sin(offsetAngle) * 9 * dtFactor,
                   radius: 18, damage: projDamage * 2, life: 1500,
                   color: "#4c1d95", ownerId: "enemy",
                   type: "BOSS_BLADE"
                });
              }
              break;
  
            case 8: // Heaven Guard - Rotating Gold Spears
              for (let i = 0; i < 6; i++) {
                const startAngle = ((i / 6) * Math.PI * 2) + shift;
                projectilesRef.current.push({
                   id: "boss-gold-" + Math.random(),
                   x: boss.x, y: boss.y,
                   vx: Math.cos(startAngle) * 4 * dtFactor,
                   vy: Math.sin(startAngle) * 4 * dtFactor,
                   radius: 12, damage: projDamage * 1.3, life: 2500,
                   color: "#fbbf24", ownerId: "enemy",
                   type: "BOSS_ICE"
                });
              }
              break;
  
            case 9: // Beast Lord - Broken Roar Arcs (Not closed loop)
              // Fires 3 waves of broken arcs
              for (let i = 0; i < 3; i++) {
                setTimeout(() => {
                  const curP = playerRef.current;
                  const currentAngle = Math.atan2(curP.y - boss.y, curP.x - boss.x) + shift;
                  // Create 3 segments with gaps
                  for (let j = -1; j <= 1; j++) {
                    const segmentAngle = currentAngle + (j * 0.8);
                     projectilesRef.current.push({
                        id: "boss-roar-" + Math.random(),
                        x: boss.x, y: boss.y,
                        vx: Math.cos(segmentAngle) * 6 * dtFactor,
                        vy: Math.sin(segmentAngle) * 6 * dtFactor,
                        radius: 15, damage: projDamage, life: 1500,
                        color: "#991b1b", ownerId: "enemy",
                        type: "BOSS_SONIC"
                     });
                  }
                }, i * 300);
              }
              break;
  
            case 10: // Void Lord - Void Collapse (Spiral Needles)
              for (let i = 0; i < 16; i++) {
                const angle = ((i / 16) * Math.PI * 2) + shift;
                 projectilesRef.current.push({
                    id: "boss-void-" + Math.random(),
                    x: boss.x, y: boss.y,
                    vx: Math.cos(angle) * 5 * dtFactor,
                    vy: Math.sin(angle) * 5 * dtFactor,
                    radius: 10, damage: projDamage * 2, life: 3000,
                    color: "#ffffff", ownerId: "enemy",
                    type: "BOSS_ICE"
                 });
              }
              break;
  
            default:
              projectilesRef.current.push({
                 id: "boss-generic-" + Math.random(),
                 x: boss.x, y: boss.y,
                 vx: Math.cos(angleToPlayer) * 7 * dtFactor,
                 vy: Math.sin(angleToPlayer) * 7 * dtFactor,
                 radius: 10, damage: projDamage, life: 2000,
                 color: boss.color, ownerId: "enemy",
                 type: "BOSS_ATTACK"
              });
              break;
          }
        }
      };

      enemiesRef.current = enemiesRef.current.filter(enemy => {
      const angle = Math.atan2(player.y - enemy.y, player.x - enemy.x);
      enemy.x += Math.cos(angle) * enemy.speed * dtFactor;
      enemy.y += Math.sin(angle) * enemy.speed * dtFactor;

      // Boss Attack Trigger
      if (enemy.isBoss) {
        if (time - (enemy.lastAttackTime || 0) > (enemy.attackCooldown || 3000)) {
          executeBossAttack(enemy, player, time);
          enemy.lastAttackTime = time;
        }
      }

      // Collision with player (Forgiving hitbox: 70% of radius sum)
      const collideDist = (enemy.radius + player.radius) * 0.7;
      if (getDistanceSq(enemy, player) < collideDist * collideDist) {
        player.hp -= enemy.damage * (dt / 1000);
        if (player.hp <= 0) {
          setGameState(GameState.GAMEOVER);
        }
      }

      if (enemy.hp <= 0) {
        deathsThisFrame++;
        if (enemy.isBoss) {
          setTribulationActive(false); // End tribulation
          if (player.level >= 100) {
            setGameState(GameState.WIN);
          } else {
            // Jump to next bracket
            player.level = Math.floor(player.level / 10) * 10 + 1; // e.g. 10 -> 11
            player.exp = 0;
            // Recalculate nextLevelExp for the new level using the new 1.15x curve
            let nextExp = GAME_BALANCE.BASE.EXP_REQUIRED;
            for (let i = 1; i < player.level; i++) {
              nextExp = Math.floor(nextExp * 1.15);
            }
            player.nextLevelExp = nextExp;
            
            // Only show upgrade if it's a multiple of 5
            if (player.level % 5 === 0) {
              setAvailableUpgrades(generateUpgrades());
              setSelectedUpgradeIndex(0);
              setGameState(GameState.UPGRADE);
            }
          }
        }
        
        // When boss is killed, clear all other enemies to give a breather
        if (enemy.isBoss) {
          enemiesRef.current = [];
        }

        // Decide WHICH item drops based on weights
        let medalType: "SMALL" | "MEDIUM" | "LARGE" = "SMALL";
        
        const isSimple = difficulty === Difficulty.SIMPLE;
        const expMultiplier = gameConfig.expGainMult;

        if (enemy.isBoss) {
          medalType = "LARGE";
        } else {
          // Use weights from ITEM_CONFIG based on difficulty
          const sWeight = isSimple ? ITEM_CONFIG.SMALL.dropWeightSimple : ITEM_CONFIG.SMALL.dropWeightNormal;
          const mWeight = isSimple ? ITEM_CONFIG.MEDIUM.dropWeightSimple : ITEM_CONFIG.MEDIUM.dropWeightNormal;
          const lWeight = isSimple ? ITEM_CONFIG.LARGE.dropWeightSimple : ITEM_CONFIG.LARGE.dropWeightNormal;

          const totalWeight = sWeight + mWeight + lWeight;
          const dropRoll = Math.random() * totalWeight;

          if (dropRoll < sWeight) {
            medalType = "SMALL";
          } else if (dropRoll < sWeight + mWeight) {
            medalType = "MEDIUM";
          } else {
            medalType = "LARGE";
          }
        }

        // Optimization: Limit gems to 30 (FIFO)
        if (gemsRef.current.length > 30) {
          gemsRef.current.shift();
        }

        // Only drop if roll succeeds
        const finalDropChance = enemy.dropChance ?? 1.0;
        if (Math.random() < finalDropChance) {
          const config = ITEM_CONFIG[medalType];
          const medalValue = (enemy.expValue * config.expValue) * expMultiplier;

          gemsRef.current.push({
            id: Math.random().toString(),
            x: enemy.x,
            y: enemy.y,
            value: medalValue,
            type: medalType,
          });
        }

        scoreRef.current += (enemy.isBoss ? 1000 : 10);
        return false;
      }
      return true;
    });

    if (deathsThisFrame > 0) {
      totalKillsRef.current += deathsThisFrame;
      killCountRef.current += deathsThisFrame;
    }

    // Banked Ultimate Charge Logic: Only consume kills if we have room for charges
    const chargeThreshold = gameConfig.ultChargeThreshold;
    
    // If we already have max charges, we shouldn't be accumulating more kills for future charges
    if (ultimateChargesRef.current >= maxUltimateChargesRef.current) {
      killCountRef.current = 0; 
    } else if (killCountRef.current >= chargeThreshold) {
      const canGain = maxUltimateChargesRef.current - ultimateChargesRef.current;
      const willGain = Math.min(canGain, Math.floor(killCountRef.current / chargeThreshold));
      if (willGain > 0) {
        ultimateChargesRef.current = Math.min(maxUltimateChargesRef.current, ultimateChargesRef.current + willGain);
        killCountRef.current -= willGain * chargeThreshold;
      }
      
      // Also cap remaining kill count to avoid infinite banking if we just hit the limit
      if (ultimateChargesRef.current >= maxUltimateChargesRef.current) {
        killCountRef.current = 0;
      }
    }
  }

    // 6. Update Gems
    if (!isPausedByEffect) {
      const pickupRangeSq = player.pickupRange ** 2;
    const collectRangeSq = (player.radius + 5) ** 2;
    gemsRef.current = gemsRef.current.filter(gem => {
      const dSq = getDistanceSq(gem, player);
      if (dSq < pickupRangeSq) {
        const angle = Math.atan2(player.y - gem.y, player.x - gem.x);
        gem.x += Math.cos(angle) * 8 * dtFactor;
        gem.y += Math.sin(angle) * 8 * dtFactor;
      }

      if (dSq < collectRangeSq) {
        const expMultiplier = gameConfig.expGainMult;
        player.exp += gem.value * expMultiplier;
        if (player.exp >= player.nextLevelExp) {
          // If we are at a boss level or in tribulation, don't level up past it until boss is dead
          const isAtBossLevel = player.level % 10 === 0;
          const bossExists = enemiesRef.current.some(e => e.isBoss);
          
          if (isAtBossLevel || tribulationActive || bossExists) {
            // Cap exp just before level up
            player.exp = player.nextLevelExp - 1;
          } else {
            // Level up logic
            player.level += 1;
            player.exp -= player.nextLevelExp;
            // Use config for next level exp calculation
            player.nextLevelExp = getNextLevelExp(player.level, player.nextLevelExp);
            
            // Only show upgrade screen every 5 levels as requested
            if (player.level % 5 === 0) {
              setAvailableUpgrades(generateUpgrades());
              setSelectedUpgradeIndex(0);
              setGameState(GameState.UPGRADE);
            }
          }
        }
        return false;
      }
      return true;
    });
  }

    // 7. Performance Optimization: Throttled HUD Update (10 FPS)
    if (time - lastHudUpdateTimeRef.current > 100) {
      const style = CHARACTER_STYLES.find(s => s.id === selectedStyleIdRef.current) || CHARACTER_STYLES[0];
      const stats = style.stats;
      const baseUltSwords = stats?.baseUltWeaponCount || 40;

      setHudData({
        score: scoreRef.current,
        totalKills: totalKillsRef.current,
        timer: timerRef.current,
        ultimateCharges: ultimateChargesRef.current,
        ultimateSwords: baseUltSwords + ultimateSwordBonusRef.current,
        weaponCooldown: player.weapons[0]?.cooldown || 1000,
        hp: player.hp,
        maxHp: player.maxHp,
        exp: player.exp,
        nextLevelExp: player.nextLevelExp,
        level: player.level
      });
      lastHudUpdateTimeRef.current = time;
    }

    // 8. Render
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Background (Cached)
    if (bgCanvasRef.current) {
      ctx.drawImage(bgCanvasRef.current, 0, 0);
    } else {
      ctx.fillStyle = "#0f172a";
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      
      // Grid/Stars
      ctx.strokeStyle = "rgba(255, 255, 255, 0.05)";
      for (let i = 0; i < CANVAS_WIDTH; i += 50) {
        ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, CANVAS_HEIGHT); ctx.stroke();
      }
      for (let i = 0; i < CANVAS_HEIGHT; i += 50) {
        ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(CANVAS_WIDTH, i); ctx.stroke();
      }
    }

    // Render Joystick
    if (joystickBaseRef.current && joystickCurrentRef.current) {
      const base = joystickBaseRef.current;
      const curr = joystickCurrentRef.current;
      const distSq = (curr.x - base.x) ** 2 + (curr.y - base.y) ** 2;
      const maxRadius = 50;
      const dist = Math.sqrt(distSq);
      const limitedDist = Math.min(dist, maxRadius);
      const angle = Math.atan2(curr.y - base.y, curr.x - base.x);
      
      const knobX = base.x + Math.cos(angle) * limitedDist;
      const knobY = base.y + Math.sin(angle) * limitedDist;

      ctx.save();
      // Outer ring
      ctx.beginPath();
      ctx.arc(base.x, base.y, maxRadius, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(255, 255, 255, 0.2)";
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = "rgba(255, 255, 255, 0.05)";
      ctx.fill();

      // Inner knob
      ctx.beginPath();
      ctx.arc(knobX, knobY, 20, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(59, 130, 246, 0.5)";
      ctx.fill();
      ctx.strokeStyle = "rgba(255, 255, 255, 0.5)";
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();
    }

    // Performance Optimization: Determine if we should use high quality effects
    const totalObjects = gemsRef.current.length + enemiesRef.current.length + projectilesRef.current.length;
    const useHighQuality = totalObjects < 60; // Disable heavy effects if too many objects

    // Render Pickup Range (Divine Sense Expansion / 神識擴張)
    ctx.save();
    ctx.beginPath();
    ctx.arc(player.x, player.y, player.pickupRange, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(251, 191, 36, 0.4)"; // Gold color
    ctx.setLineDash([10, 10]);
    ctx.lineWidth = 2;
    ctx.stroke();
    
    if (useHighQuality) {
      const rangeGrad = ctx.createRadialGradient(player.x, player.y, player.radius, player.x, player.y, player.pickupRange);
      rangeGrad.addColorStop(0, "rgba(251, 191, 36, 0.08)");
      rangeGrad.addColorStop(1, "rgba(251, 191, 36, 0)");
      ctx.fillStyle = rangeGrad;
    } else {
      ctx.fillStyle = "rgba(251, 191, 36, 0.04)";
    }
    ctx.fill();
    ctx.restore();

    // Render Gems (Medals / 靈力)
    gemsRef.current.forEach(gem => {
      const config = ITEM_CONFIG[gem.type] || ITEM_CONFIG.SMALL;
      const img = imageCache[config.image];
      const size = config.size;

      ctx.save();
      ctx.translate(gem.x, gem.y);

      if (img && img.complete && img.naturalWidth !== 0) {
        // Render Image
        ctx.drawImage(img, -size / 2, -size / 2, size, size);
      } else {
        // If image is still loading or failed, draw a themed diamond as backup
        // rather than using a color field.
        ctx.beginPath();
        const r = size * 0.4;
        ctx.moveTo(0, -r);
        ctx.lineTo(r, 0);
        ctx.lineTo(0, r);
        ctx.lineTo(-r, 0);
        ctx.closePath();
        ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
        ctx.fill();
        ctx.strokeStyle = "rgba(255, 255, 255, 0.8)";
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      // Optional Glow for Large gems or if high quality (Clean White Glow)
      if (useHighQuality && gem.type === "LARGE") {
        ctx.shadowBlur = 15;
        ctx.shadowColor = "white";
        ctx.beginPath();
        ctx.arc(0, 0, size / 3, 0, Math.PI * 2);
        ctx.stroke();
      }
      
      ctx.restore();
    });

    // Render Lightning
    lightningRef.current.forEach(l => {
      ctx.save();
      ctx.strokeStyle = "#fef08a";
      ctx.lineWidth = 4;
      if (useHighQuality) {
        ctx.shadowBlur = 15;
        ctx.shadowColor = "#facc15";
      }
      ctx.beginPath();
      ctx.moveTo(l.x, l.y);
      const segments = 5;
      for (let i = 1; i <= segments; i++) {
        const tx = l.x + (l.targetX - l.x) * (i / segments) + (Math.random() - 0.5) * 40;
        const ty = l.y + (l.targetY - l.y) * (i / segments);
        ctx.lineTo(tx, ty);
      }
      ctx.lineTo(l.targetX, l.targetY);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(l.targetX, l.targetY, 20 * (l.life / 200), 0, Math.PI * 2);
      ctx.fillStyle = "rgba(254, 240, 138, 0.4)";
      ctx.fill();
      ctx.restore();
    });

    // Render Projectiles
    projectilesRef.current.forEach(p => {
      ctx.save();
      ctx.translate(p.x, p.y);
      
      const moveAngle = (p.vx === 0 && p.vy === 0) ? (p.phase === "HEAVENLY" ? Math.PI / 2 : 0) : Math.atan2(p.vy, p.vx);
      ctx.rotate(moveAngle);
      
      if (p.ownerId === "enemy") {
        // Boss specialized attacks
        const pType = p.type;
        switch (pType) {
          case "BOSS_SONIC":
            ctx.strokeStyle = p.color;
            ctx.lineWidth = 3;
            const rStart = p.radius;
            for (let i = 0; i < 2; i++) {
              ctx.beginPath();
              ctx.arc(0, 0, (rStart + i * 15), -1.047, 1.047); // -PI/3 to PI/3
              ctx.stroke();
            }
            break;
          case "BOSS_SILK":
            ctx.strokeStyle = "rgba(255, 255, 255, 0.7)";
            ctx.lineWidth = 1;
            ctx.setLineDash([2, 5]);
            for (let i = 0; i < 8; i++) {
              const angle = (i / 8) * Math.PI * 2;
              ctx.beginPath();
              ctx.moveTo(0, 0);
              ctx.lineTo(Math.cos(angle) * p.radius, Math.sin(angle) * p.radius);
              ctx.stroke();
            }
            ctx.setLineDash([]);
            ctx.beginPath(); ctx.arc(0, 0, p.radius * 0.7, 0, Math.PI * 2); ctx.stroke();
            break;
          case "BOSS_FIRE":
            const fireGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, p.radius);
            fireGrad.addColorStop(0, "#fff");
            fireGrad.addColorStop(0.3, p.color);
            fireGrad.addColorStop(1, "transparent");
            ctx.fillStyle = fireGrad;
            ctx.beginPath(); ctx.arc(0, 0, p.radius, 0, Math.PI * 2); ctx.fill();
            break;
          case "BOSS_ICE":
            // Sharp shard (Needle/Spike)
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.moveTo(p.radius * 1.5, 0);
            ctx.lineTo(-p.radius * 0.5, p.radius * 0.4);
            ctx.lineTo(-p.radius * 0.2, 0);
            ctx.lineTo(-p.radius * 0.5, -p.radius * 0.4);
            ctx.closePath();
            ctx.fill();
            ctx.strokeStyle = "rgba(255,255,255,0.6)";
            ctx.stroke();
            break;
          case "BOSS_BLADE":
            // Rotating twin blades
            const spin = (time / 100) % (Math.PI * 2);
            ctx.rotate(spin);
            ctx.fillStyle = p.color;
            ctx.beginPath(); 
            ctx.ellipse(0, 0, p.radius, p.radius * 0.3, 0, 0, Math.PI * 2); 
            ctx.fill();
            ctx.strokeStyle = "#fff";
            ctx.lineWidth = 2;
            ctx.stroke();
            // Blade center
            ctx.fillStyle = "#fff";
            ctx.beginPath(); ctx.arc(0, 0, p.radius * 0.2, 0, Math.PI * 2); ctx.fill();
            break;
          case "BOSS_THUNDER":
            // Lightning bolt shape
            ctx.strokeStyle = "#eab308";
            ctx.lineWidth = 3;
            ctx.shadowBlur = 10; ctx.shadowColor = "#eab308";
            ctx.beginPath();
            ctx.moveTo(-p.radius, -p.radius);
            ctx.lineTo(0, 0);
            ctx.lineTo(-p.radius, 0);
            ctx.lineTo(p.radius, p.radius);
            ctx.stroke();
            break;
          default:
            ctx.fillStyle = p.color;
            ctx.shadowBlur = 10; ctx.shadowColor = p.color;
            ctx.beginPath(); ctx.arc(0, 0, p.radius, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
            ctx.beginPath(); ctx.arc(-p.radius/3, -p.radius/3, p.radius/3, 0, Math.PI * 2); ctx.fill();
            break;
        }
      } else {
        // Player projectiles
        drawProjectileCommon(ctx, p, time, p.renderType || 'sword', p.isUltimate);
      }
      ctx.restore();
    });

    // Render Enemies (Monsters)
    enemiesRef.current.forEach(enemy => {
      ctx.save();
      ctx.translate(enemy.x, enemy.y);
      
      const config = ENEMY_CONFIG[enemy.visualType] || ENEMY_CONFIG[0];
      const img = config.image ? imageCache[config.image] : null;
      const r = enemy.radius;
      
      // 呼吸感動畫 (1.0 到 1.2 倍縮放)
      // 使用 ID 產生偏移量，讓怪物不同步呼吸
      const seed = enemy.seed || 0;
      const breathingScale = 1.1 + Math.sin((time + seed * 50) / 400) * 0.1;
      
      // 套用呼吸縮放
      ctx.scale(breathingScale, breathingScale);

      if (img && img.complete && img.naturalWidth !== 0) {
        // 渲染圖片
        const displaySize = enemy.isBoss ? (config.bossSize || config.size * 1.8) : config.size;
        ctx.drawImage(img, -displaySize / 2, -displaySize / 2, displaySize, displaySize);
      } else {
        // Fallback to Vector Shape
        ctx.fillStyle = config.color;
        
        if (useHighQuality || enemy.isBoss) {
          ctx.shadowBlur = enemy.isBoss ? 20 : 5;
          ctx.shadowColor = config.color;
        }

        switch (config.shape) {
          case "SPIRIT":
            // Ghost fire
            const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
            grad.addColorStop(0, "#fff");
            grad.addColorStop(0.4, config.color);
            grad.addColorStop(1, "transparent");
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(0, 0, r, 0, Math.PI * 2);
            ctx.fill();
            break;
        case "DEMON":
          // Bat-like
          const wing = Math.sin(time / 100) * (r * 0.8);
          ctx.beginPath();
          ctx.ellipse(0, 0, r * 0.6, r * 0.8, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.beginPath();
          ctx.moveTo(r * 0.3, 0);
          ctx.quadraticCurveTo(r, -r + wing, r * 1.5, 0);
          ctx.lineTo(r, r * 0.3);
          ctx.fill();
          ctx.beginPath();
          ctx.moveTo(-r * 0.3, 0);
          ctx.quadraticCurveTo(-r, -r + wing, -r * 1.5, 0);
          ctx.lineTo(-r, r * 0.3);
          ctx.fill();
          ctx.fill();
          break;
        case "CIRCLE":
          ctx.beginPath();
          ctx.arc(0, 0, r, 0, Math.PI * 2);
          ctx.fill();
          break;
        case "TRIANGLE":
          ctx.beginPath();
          ctx.moveTo(0, -r);
          ctx.lineTo(r, r);
          ctx.lineTo(-r, r);
          ctx.closePath();
          ctx.fill();
          break;
        case "STAR":
          ctx.beginPath();
          for (let i = 0; i < 5; i++) {
            ctx.lineTo(Math.cos((18 + i * 72) / 180 * Math.PI) * r,
                       -Math.sin((18 + i * 72) / 180 * Math.PI) * r);
            ctx.lineTo(Math.cos((54 + i * 72) / 180 * Math.PI) * (r/2),
                       -Math.sin((54 + i * 72) / 180 * Math.PI) * (r/2));
          }
          ctx.closePath();
          ctx.fill();
          break;
          case "SNAKE":
            ctx.beginPath();
            ctx.moveTo(0, 0);
            for(let i=0; i<5; i++) {
              ctx.quadraticCurveTo(Math.sin(time/200 + i)*10, i*r/2, 0, (i+1)*r/2);
            }
            ctx.lineWidth = r/2;
            ctx.strokeStyle = config.color;
            ctx.stroke();
            break;
        case "SQUARE":
          ctx.fillRect(-r, -r, r*2, r*2);
          break;
        case "DIAMOND":
          ctx.beginPath();
          ctx.moveTo(0, -r);
          ctx.lineTo(r, 0);
          ctx.lineTo(0, r);
          ctx.lineTo(-r, 0);
          ctx.closePath();
          ctx.fill();
          break;
        case "HEXAGON":
          ctx.beginPath();
          for (let i = 0; i < 6; i++) {
            ctx.lineTo(Math.cos(i * Math.PI / 3) * r, Math.sin(i * Math.PI / 3) * r);
          }
          ctx.closePath();
          ctx.fill();
          break;
        case "BEAST":
          ctx.beginPath();
          ctx.roundRect(-r, -r, r*2, r*2, r/2);
          ctx.fill();
          // Horns
          ctx.fillStyle = "#fff";
          ctx.beginPath(); ctx.moveTo(-r, -r); ctx.lineTo(-r-10, -r-10); ctx.lineTo(-r+5, -r); ctx.fill();
          ctx.beginPath(); ctx.moveTo(r, -r); ctx.lineTo(r+10, -r-10); ctx.lineTo(r-5, -r); ctx.fill();
          break;
        case "BOSS":
          // Final Boss: Pulsing Sun
          const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
          g.addColorStop(0, "#fff");
          g.addColorStop(0.2, "#fde047");
          g.addColorStop(0.5, "#f97316");
          g.addColorStop(1, "transparent");
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.arc(0, 0, r, 0, Math.PI * 2);
          ctx.fill();
          break;
        default:
          ctx.beginPath();
          ctx.arc(0, 0, r, 0, Math.PI * 2);
          ctx.fill();
      }

      // Eyes for all (Vector fallback only)
      if (!img || !img.complete || img.naturalWidth === 0) {
        if (config.shape !== "SPIRIT" && config.shape !== "BOSS") {
          ctx.fillStyle = "#fff";
          ctx.beginPath(); ctx.arc(-r/3, -r/4, r/6, 0, Math.PI * 2); ctx.fill();
          ctx.beginPath(); ctx.arc(r/3, -r/4, r/6, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = "#000";
          ctx.beginPath(); ctx.arc(-r/3, -r/4, r/12, 0, Math.PI * 2); ctx.fill();
          ctx.beginPath(); ctx.arc(r/3, -r/4, r/12, 0, Math.PI * 2); ctx.fill();
        }
      }
    }
      
      ctx.shadowBlur = 0;
      ctx.restore();
      
      const displaySize = enemy.isBoss ? (config.bossSize || config.size * 1.8) : config.size;
      const barY = enemy.y - displaySize / 2 - 15;
      const barWidth = Math.max(30, displaySize * 0.6);
      
      // Level Text
      ctx.fillStyle = enemy.isBoss ? "#fbbf24" : "#fff";
      ctx.font = enemy.isBoss ? "bold 14px Inter" : "bold 10px Inter";
      ctx.textAlign = "right";
      ctx.fillText(enemy.isBoss ? "BOSS" : `Lv.${enemy.level}`, enemy.x - barWidth/2 - 4, barY + 4);
      
      // Bar background
      ctx.fillStyle = "#334155";
      ctx.fillRect(enemy.x - barWidth/2, barY, barWidth, 4);
      // Bar foreground
      ctx.fillStyle = "#ef4444";
      ctx.fillRect(enemy.x - barWidth/2, barY, barWidth * (enemy.hp / enemy.maxHp), 4);
      
      ctx.textAlign = "left"; // Reset
    });

    // Render Player (Xiaoxue)
    const isMoving = dx !== 0 || dy !== 0;
    const moveMagnitude = isMoving ? 1 : 0;
    
    // Toggle between designs here:
    // drawPlayerLegacy(ctx, player, time, dx, dy);
    drawPlayerNew(ctx, player, facingRightRef.current, moveMagnitude, time, selectedStyleId);

      // 10. Draw Flash Overlay
    if (flashOpacityRef.current > 0) {
      ctx.fillStyle = `rgba(255, 255, 255, ${flashOpacityRef.current})`;
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      flashOpacityRef.current = Math.max(0, flashOpacityRef.current - 0.015); // Slower fade
    }

    frameIdRef.current = requestAnimationFrame(gameLoop);
  }, [gameState, spawnEnemy, generateUpgrades, tribulationActive, showMarquee, showUltimateCutIn, selectedStyleId, difficulty]);

  useEffect(() => {
    const handleGlobalClick = () => {
      if (!audioCtxRef.current || audioCtxRef.current.state === 'suspended') {
        initAudio();
        if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') {
          audioCtxRef.current.resume().then(() => {
            if (gameStateRef.current === GameState.MENU && !bgmIntervalRef.current) {
              startMenuBGM();
            }
          });
        }
      }
      // Remove listener after first interaction
      window.removeEventListener('click', handleGlobalClick);
      window.removeEventListener('touchstart', handleGlobalClick);
    };

    window.addEventListener('click', handleGlobalClick);
    window.addEventListener('touchstart', handleGlobalClick);

    return () => {
      window.removeEventListener('click', handleGlobalClick);
      window.removeEventListener('touchstart', handleGlobalClick);
    };
  }, []);

  useEffect(() => {
    if (gameState === GameState.PLAYING) {
      lastTimeRef.current = performance.now();
      frameIdRef.current = requestAnimationFrame(gameLoop);
      stopBGM();
      if (!bgmIntervalRef.current) startBGM();
    } else if (gameState === GameState.PAUSED) {
      cancelAnimationFrame(frameIdRef.current);
      // Don't stop BGM interval, but playMelody will skip if not PLAYING
    } else if (gameState === GameState.MENU) {
      cancelAnimationFrame(frameIdRef.current);
      stopBGM();
      startMenuBGM();
    } else {
      cancelAnimationFrame(frameIdRef.current);
      stopBGM();
    }
    return () => cancelAnimationFrame(frameIdRef.current);
  }, [gameState, gameLoop]);

  const startGame = () => {
    initAudio();
    gameStateRef.current = GameState.PLAYING;
    setGameState(GameState.PLAYING);
    startBGM();
    const style = CHARACTER_STYLES.find(s => s.id === selectedStyleIdRef.current) || CHARACTER_STYLES[0];
    const stats = style.stats;

    // Reset Player
    playerRef.current = {
      id: "player",
      x: CANVAS_WIDTH / 2,
      y: (CANVAS_HEIGHT + HUD_HEIGHT) / 2,
      radius: PLAYER_RADIUS,
      hp: stats?.baseHealth || GAME_BALANCE.BASE.PLAYER_HP,
      maxHp: stats?.baseHealth || GAME_BALANCE.BASE.PLAYER_HP,
      speed: stats?.baseSpeed ? (4.0 * stats.baseSpeed) : 4.0,
      exp: 0,
      level: 1,
      nextLevelExp: GAME_BALANCE.BASE.EXP_REQUIRED,
      pickupRange: stats?.basePickupRange || GAME_BALANCE.BASE.PLAYER_PICKUP_RANGE,
      weapons: [
        {
          id: "sword-1",
          name: "青雲劍",
          damage: stats?.baseAttack || GAME_BALANCE.BASE.PLAYER_DAMAGE,
          cooldown: stats?.baseAttackSpeed ? (400 / stats.baseAttackSpeed) : 400,
          lastFired: 0,
          range: stats?.baseWeaponRange || 350,
          count: stats?.baseWeaponCount || GAME_BALANCE.BASE.PLAYER_SWORDS,
          level: 1,
          scale: stats?.baseWeaponScale || 1.0,
          type: "SWORD",
        },
      ],
    };

    setUltimateCharges(stats?.baseUltCount || 1);
    ultimateChargesRef.current = stats?.baseUltCount || 1;
    maxUltimateChargesRef.current = stats?.maxUltCount || 3;

    // Sync player.damage for convenience in loop
    (playerRef.current as any).damage = stats?.baseAttack || GAME_BALANCE.BASE.PLAYER_DAMAGE;

    // Reset Game State Refs
    enemiesRef.current = [];
    projectilesRef.current = [];
    gemsRef.current = [];
    lightningRef.current = [];
    keysRef.current = {};
    targetPosRef.current = null;
    isPointerDownRef.current = false;
    joystickBaseRef.current = null;
    joystickCurrentRef.current = null;
    
    // Reset Timing Refs
    const now = performance.now();
    lastSpawnTimeRef.current = now;
    lastTimeRef.current = now;
    sessionStartTimeRef.current = now;
    lastHudUpdateTimeRef.current = now;
    
    // Reset State
    scoreRef.current = 0;
    totalKillsRef.current = 0;
    timerRef.current = 0;
    // (Already set above via stats)
    killCountRef.current = 0;
    setTribulationActive(false);
    setShowMarquee(false);
    
    // Initial HUD Data
    setHudData({
      score: 0,
      totalKills: 0,
      timer: 0,
      ultimateCharges: stats?.baseUltCount || 1,
      hp: stats?.baseHealth || GAME_BALANCE.BASE.PLAYER_HP,
      maxHp: stats?.baseHealth || GAME_BALANCE.BASE.PLAYER_HP,
      exp: 0,
      nextLevelExp: GAME_BALANCE.BASE.EXP_REQUIRED,
      level: 1
    });
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const useUltimate = useCallback(() => {
    if (ultimateChargesRef.current <= 0 || showUltimateCutIn) return;
    
    // Trigger Cut-in
    setShowUltimateCutIn(true);
    playUltimateSound();
    
    const style = CHARACTER_STYLES.find(s => s.id === selectedStyleIdRef.current) || CHARACTER_STYLES[0];
    playUltimateVoice(style.ultimateName, style.gender);
    
    // Quick Flash instead of persistent dimming
    flashOpacityRef.current = 0.5;
    setTimeout(() => { flashOpacityRef.current = 0; }, 100);
    
    setTimeout(() => {
      setShowUltimateCutIn(false);
      ultimateChargesRef.current = Math.max(0, ultimateChargesRef.current - 1);
      setUltimateCharges(ultimateChargesRef.current);
      
      const player = playerRef.current;
      const isFacingRight = facingRightRef.current;
      const greatRealm = getGreatRealm(player.level);
      const style = CHARACTER_STYLES.find(s => s.id === selectedStyleIdRef.current) || CHARACTER_STYLES[0];
      const stats = style.stats;
      
      // Dynamic sword count based on realm + character base + bonus from upgrades
      let count = (stats?.baseUltWeaponCount || 40) + ultimateSwordBonusRef.current;
      
      // For Heavenly Impact, many palms can be visually overwhelming, cap to 20 but keep it meaningful
      if (style.ultimateType === "heavenly_impact") {
        count = Math.min(20, count);
      }
      
      const boss = enemiesRef.current.find(e => e.isBoss && e.hp > 0);
      const targets = enemiesRef.current.filter(e => e.hp > 0);

      if (style.ultimateType === "heavenly_impact") {
        // Heavenly Impact - 固定地面目標，直挺挺落下產生震波
        const strikeTargets = [];
        
        // 1. 完全隨機找地面上的座標點，不再鎖定怪物
        for (let i = 0; i < count; i++) {
          strikeTargets.push({ 
            x: 50 + Math.random() * (LOGICAL_WIDTH - 100), 
            y: HUD_HEIGHT + 200 + Math.random() * (LOGICAL_HEIGHT - HUD_HEIGHT - 350)
          });
        }
 
        // 執行落下
        strikeTargets.forEach((target, i) => {
          setTimeout(() => {
            // 從正上方降落，垂直路徑
            const startX = target.x; 
            const startY = -600; 
            
            const speed = 20; // 降速，更有重量感
            const dy = target.y - startY;
            
            const isRightSide = (i % 2 === 0);

            projectilesRef.current.push({
              id: "ult-" + (isRightSide ? "right" : "left") + "-" + i + "-" + Math.random(),
              x: startX,
              y: startY,
              vx: 0, // 垂直落下，VX 為 0
              vy: speed,
              radius: 60, 
              damage: greatRealm.damage * 1200, 
              life: 8000, 
              color: "#fbbf24",
              ownerId: "player",
              isUltimate: true,
              renderType: 'palm',
              phase: "HEAVENLY",
              strikeTarget: target,
            });
            
            flashOpacityRef.current = 0.4;
            setTimeout(() => { flashOpacityRef.current = 0; }, 40);
          }, i * 150); 
        });
      } else {
        // Default: Radial / Sword Launch
        for (let i = 0; i < count; i++) {
          const angleOffset = (Math.random() - 0.5) * 0.6; // Wider spread
          const angle = isFacingRight ? 0 + angleOffset : Math.PI + angleOffset;
          
          setTimeout(() => {
            projectilesRef.current.push({
              id: Math.random().toString(),
              x: player.x, 
              y: player.y + (Math.random() - 0.5) * 60,
              vx: Math.cos(angle) * 22, // Faster
              vy: Math.sin(angle) * 22,
              radius: 15, // Bigger
              damage: greatRealm.damage, 
              life: 5000, 
              color: "#fde047", // Golden color
              ownerId: "player",
              isUltimate: true,
              phase: "BACK",
              phaseTimer: 0,
              renderType: style.projectileType,
            });
          }, i * 30); // Faster launch
        }
      }
      
      playLightningSound(true); // Massive sound
    }, 2000); // EXACTLY 2 SECONDS
  }, [showUltimateCutIn, playLightningSound, selectedStyleId, playUltimateVoice, playUltimateSound]);

  const handleCanvasClick = (e: React.MouseEvent | React.TouchEvent) => {
    // Moved to handlePointerDown for mobile compatibility
  };

  const getIcon = (iconName: string) => {
    switch (iconName) {
      case "Wind": return <Wind className="w-8 h-8 text-blue-400" />;
      case "Flame": return <Flame className="w-8 h-8 text-orange-500" />;
      case "Zap": return <Zap className="w-8 h-8 text-yellow-400" />;
      case "Timer": return <Timer className="w-8 h-8 text-cyan-400" />;
      case "Sparkles": return <Sparkles className="w-8 h-8 text-purple-400" />;
      case "Heart": return <Heart className="w-8 h-8 text-red-500" />;
      case "Sword": return <Sword className="w-8 h-8 text-red-500" />;
      case "Expand": return <Expand className="w-8 h-8 text-blue-400" />;
      case "Maximize": return <Maximize className="w-8 h-8 text-yellow-500" />;
      default: return <Sparkles className="w-8 h-8 text-blue-400" />;
    }
  };

  return (
    <div className="fixed inset-0 bg-black flex items-center justify-center overflow-hidden font-sans select-none">
      {/* 9:16 Game Container */}
      <div 
        className="relative bg-slate-950 overflow-hidden shadow-[0_0_80px_rgba(0,0,0,0.8)]"
        style={{ 
          width: LOGICAL_WIDTH * gameScale, 
          height: LOGICAL_HEIGHT * gameScale,
        }}
      >
        {/* Main Game Canvas */}
        <canvas 
          ref={canvasRef} 
          width={LOGICAL_WIDTH} 
          height={LOGICAL_HEIGHT}
          className="absolute inset-0 w-full h-full block"
        />

        {/* UI Layer (Scaled to match logical resolution) */}
        <div 
          className="absolute inset-0 origin-top-left pointer-events-none"
          style={{ transform: `scale(${gameScale})`, width: LOGICAL_WIDTH, height: LOGICAL_HEIGHT }}
        >
          {/* UI Safety Zone (5% Margin) */}
          <div className="absolute inset-0 p-[5%] flex flex-col gap-4">
            
            {/* 1. HUD Panel (Compact for Vertical) */}
            <div className="w-full bg-slate-900/90 border border-slate-800/50 rounded-2xl backdrop-blur-xl shadow-2xl p-4 flex flex-col gap-3 pointer-events-auto">
              <div className="flex items-center justify-between">
                <div className="flex flex-col">
                  <div className="flex items-baseline gap-2">
                    <span className="text-xl font-black text-blue-400 uppercase tracking-tighter">境界</span>
                    <span className="text-3xl font-black text-white italic leading-none">{getRealmInfo(hudData.level || 1).name}</span>
                  </div>
                </div>
                <div className="flex items-center gap-6">
                  <span className="text-3xl font-mono font-black text-white leading-none tabular-nums">{formatTime(hudData.timer || 0)}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-500 uppercase">斬</span>
                    <span className="text-4xl font-mono font-black text-red-500 leading-none tabular-nums">{hudData.totalKills || 0}</span>
                  </div>
                </div>
              </div>

              {/* HP Bar */}
              <div className="flex items-center gap-3">
                <Heart className={`w-5 h-5 ${hudData.hp < hudData.maxHp * 0.3 ? 'text-red-500 animate-pulse' : 'text-red-500'}`} />
                <div className="flex-1 h-6 bg-slate-800 rounded-full overflow-hidden border border-slate-700/50 relative shadow-inner">
                  <motion.div 
                    className="h-full bg-gradient-to-r from-red-600 to-red-400"
                    initial={{ width: 0 }}
                    animate={{ width: `${(Math.max(0, hudData.hp || 0) / Math.max(1, hudData.maxHp || 1)) * 100}%` }}
                  />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-base font-black text-white drop-shadow-md">
                      {Math.ceil(hudData.hp || 0)} / {hudData.maxHp || 1}
                    </span>
                  </div>
                </div>
              </div>

              {/* XP Bar */}
              <div className="flex items-center gap-3">
                <Trophy className="w-5 h-5 text-blue-400" />
                <div className="flex-1 h-6 bg-slate-800 rounded-full overflow-hidden border border-slate-700/50 relative shadow-inner">
                  <motion.div 
                    className="h-full bg-gradient-to-r from-blue-600 via-cyan-400 to-blue-600 bg-[length:200%_100%]"
                    initial={{ width: 0 }}
                    animate={{ 
                      width: `${(Math.max(0, hudData.exp || 0) / Math.max(1, hudData.nextLevelExp || 1)) * 100}%`,
                      backgroundPosition: ["0% 0%", "100% 0%"]
                    }}
                    transition={{ 
                      width: { type: "spring", stiffness: 50, damping: 20 },
                      backgroundPosition: { duration: 3, repeat: Infinity, ease: "linear" }
                    }}
                  />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-base font-black text-blue-100 drop-shadow-md tracking-widest">
                      LV.{hudData.level || 1} | EXP {Math.floor(hudData.exp || 0)} / {hudData.nextLevelExp || 1}
                    </span>
                  </div>
                </div>
              </div>

              {/* Stats & Ultimate Row */}
              <div className="flex items-center justify-between scale-[0.75] origin-left w-[133.3%]">
                <div className="flex gap-4">
                  <div className="flex flex-col items-center bg-slate-950/40 px-3 py-1 rounded-xl border border-slate-800/50">
                    <div className="flex items-center gap-2">
                      <Flame className="w-5 h-5 text-orange-500" />
                      <span className="text-xl font-mono font-black text-slate-200">{playerRef.current.weapons[0]?.damage || 0}</span>
                    </div>
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">威力</span>
                  </div>

                  <div className="flex flex-col items-center bg-slate-950/40 px-3 py-1 rounded-xl border border-slate-800/50">
                    <div className="flex items-center gap-2">
                      <Sword className="w-5 h-5 text-red-500" />
                      <span className="text-xl font-mono font-black text-slate-200">{playerRef.current.weapons[0]?.count || 0}</span>
                    </div>
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">數量</span>
                  </div>

                  <div className="flex flex-col items-center bg-slate-950/40 px-3 py-1 rounded-xl border border-slate-800/50">
                    <div className="flex items-center gap-2">
                      <Wind className="w-5 h-5 text-blue-400" />
                      <span className="text-xl font-mono font-black text-slate-200">{playerRef.current.speed.toFixed(1)}</span>
                    </div>
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">移速</span>
                  </div>

                  <div className="flex flex-col items-center bg-slate-950/40 px-3 py-1 rounded-xl border border-slate-800/50">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-5 h-5 text-purple-400" />
                      <span className="text-xl font-mono font-black text-slate-200">{Math.round(playerRef.current.pickupRange)}</span>
                    </div>
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">神識</span>
                  </div>

                  <div className="flex flex-col items-center bg-slate-950/40 px-3 py-1 rounded-xl border border-slate-800/50">
                    <div className="flex items-center gap-2">
                      <Timer className="w-5 h-5 text-cyan-400" />
                      <span className="text-xl font-mono font-black text-slate-200">
                        {hudData.weaponCooldown > 0 ? (Math.round(1000 / hudData.weaponCooldown * 10) / 10 || 0) : 0}
                      </span>
                    </div>
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">頻率</span>
                  </div>

                  <div className="flex flex-col items-center bg-slate-950/40 px-3 py-1 rounded-xl border border-slate-800/50">
                    <div className="flex items-center gap-2">
                      <Zap className="w-5 h-5 text-yellow-400" />
                      <span className="text-xl font-mono font-black text-slate-200">{hudData.ultimateSwords}</span>
                    </div>
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">必殺</span>
                  </div>
                </div>
                
                <div className="flex items-center gap-3">
                  <div className="flex items-baseline gap-1">
                    <span className="text-lg font-black text-yellow-500 uppercase tracking-widest">
                      {CHARACTER_STYLES.find(s => s.id === selectedStyleId)?.ultimateName || ''}
                    </span>
                  </div>
                      <div className="flex gap-1" key="ult-charges-container">
                        {[...Array(maxUltimateChargesRef.current)].map((_, i) => (
                          <Zap 
                            key={`ult-charge-${i}`} 
                            className={`w-6 h-6 transition-all ${i < hudData.ultimateCharges ? 'text-yellow-400 drop-shadow-[0_0_8px_rgba(250,204,21,0.8)]' : 'text-slate-800'}`} 
                          />
                        ))}
                      </div>

                </div>
              </div>
            </div>

            {/* Overlays (Inside Scaled Area) */}
            <AnimatePresence>
              {showUltimateCutIn && (
                <div key="ultimate-cut-in" className="absolute inset-0 z-[60] flex items-center justify-center pointer-events-none">
                  <motion.div
                    initial={{ opacity: 0, scaleY: 0 }}
                    animate={{ opacity: 1, scaleY: 1 }}
                    exit={{ opacity: 0, scaleY: 0 }}
                    className="w-full aspect-[8/3] bg-slate-950/95 border-y border-blue-500/50 overflow-hidden"
                  >
                    <UltimateAnimationView style={CHARACTER_STYLES.find(s => s.id === selectedStyleId) || CHARACTER_STYLES[0]} />
                  </motion.div>
                </div>
              )}

              {gameState === GameState.PAUSED && (
                <div key="pause-overlay" className="absolute inset-0 z-[60] flex flex-col items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4 pointer-events-auto">
                  <motion.div 
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="bg-slate-900 border-2 border-blue-500/50 p-8 rounded-3xl shadow-[0_0_50px_rgba(59,130,246,0.3)] flex flex-col items-center gap-8 w-full max-w-sm"
                  >
                    <div className="w-24 h-24 rounded-full bg-blue-500/20 flex items-center justify-center border-2 border-blue-400/50">
                      <Pause className="w-12 h-12 text-blue-400" />
                    </div>
                    <h2 className="text-5xl font-black text-white tracking-widest italic">暫停中</h2>
                    <div className="flex flex-col gap-5 w-full">
                      <button 
                        onClick={() => setGameState(GameState.PLAYING)}
                        className="w-full py-8 bg-blue-600 hover:bg-blue-500 text-white font-black text-4xl rounded-3xl transition-all active:scale-95 flex items-center justify-center gap-6 shadow-lg shadow-blue-600/20"
                      >
                        <Play className="w-14 h-14" /> 繼續修行
                      </button>
                      <button 
                        onClick={() => setGameState(GameState.MENU)}
                        className="w-full py-8 bg-slate-800 hover:bg-slate-700 text-slate-300 font-black text-4xl rounded-3xl transition-all active:scale-95 flex items-center justify-center gap-6"
                      >
                        <Home className="w-14 h-14" /> 返回主頁
                      </button>
                    </div>
                  </motion.div>
                </div>
              )}

              {gameState === GameState.UPGRADE && (
                <div key="upgrade-overlay" className="absolute inset-0 z-[70] flex flex-col items-center justify-center bg-slate-950/90 backdrop-blur-xl p-4 pointer-events-auto">
                  <motion.div 
                    initial={{ y: 50, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    className="w-full max-w-md flex flex-col items-center gap-8"
                  >
                    <div className="flex flex-col items-center gap-6">
                      <motion.div 
                        animate={{ 
                          boxShadow: ["0 0 20px rgba(59,130,246,0.2)", "0 0 50px rgba(59,130,246,0.6)", "0 0 20px rgba(59,130,246,0.2)"],
                          scale: [1, 1.02, 1]
                        }}
                        transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                        className="px-16 py-6 bg-gradient-to-b from-blue-600/30 to-blue-900/40 border-2 border-blue-400/80 rounded-3xl shadow-[0_0_40px_rgba(59,130,246,0.5)] relative overflow-hidden group"
                      >
                        {/* Animated background shine */}
                        <motion.div 
                          animate={{ x: ['-100%', '200%'] }}
                          transition={{ duration: 2, repeat: Infinity, ease: "linear", repeatDelay: 1 }}
                          className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent skew-x-[-20deg]"
                        />
                        <span className="text-blue-100 text-5xl font-black tracking-[0.4em] uppercase drop-shadow-[0_0_15px_rgba(59,130,246,1)] relative z-10">境界突破</span>
                      </motion.div>
                      <h2 className="text-4xl font-black text-white italic tracking-[0.1em] drop-shadow-[0_0_10px_rgba(255,255,255,0.3)]">選擇您的機緣</h2>
                    </div>

                      <div className="flex flex-col gap-3 w-full" key="upgrades-list">
                        {availableUpgrades.map((upgrade, idx) => (
                          <motion.button
                            key={upgrade.id}

                          initial={{ x: -20, opacity: 0 }}
                          animate={{ x: 0, opacity: 1 }}
                          transition={{ delay: idx * 0.1 }}
                          onClick={() => applyUpgrade(upgrade)}
                          className="group relative w-full bg-slate-900/80 hover:bg-blue-900/30 border border-slate-800 hover:border-blue-500/50 p-4 rounded-2xl transition-all flex items-center gap-4 overflow-hidden"
                        >
                          <div className="w-20 h-20 rounded-2xl bg-slate-800/50 flex items-center justify-center border border-slate-700 transition-colors">
                            {getIcon(upgrade.icon)}
                          </div>
                          <div className="flex flex-col items-start">
                            <span className="text-xl font-black text-white group-hover:text-blue-400 transition-colors">{upgrade.name}</span>
                            <span className="text-sm text-slate-400 group-hover:text-slate-300 transition-colors">{upgrade.description}</span>
                          </div>
                          <ChevronRight className="ml-auto w-6 h-6 text-slate-600 group-hover:text-blue-400 transition-all group-hover:translate-x-1" />
                        </motion.button>
                      ))}
                    </div>
                  </motion.div>
                </div>
              )}

              {gameState === GameState.GAMEOVER && (
                <motion.div 
                  key="gameover-overlay"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="absolute inset-0 bg-red-950/90 backdrop-blur-xl flex flex-col items-center justify-center p-4 text-center z-[80] pointer-events-auto"
                >
                  <div className="p-4 bg-red-500/20 rounded-full mb-4">
                    <Skull className="w-16 h-16 text-red-500" />
                  </div>
                  <h2 className="text-6xl font-black mb-2 tracking-tighter text-red-500 italic">身死道消</h2>
                  <p className="text-red-200/60 mb-8 text-lg">
                    修行之路艱辛，請重新來過。
                  </p>
                  
                  <div className="grid grid-cols-2 gap-4 mb-8 w-full max-w-xs">
                    <div className="bg-red-900/30 p-4 rounded-2xl border border-red-800/50">
                      <span className="text-xs uppercase tracking-widest text-red-400 block mb-1">最終境界</span>
                      <span className="text-2xl font-bold">{getRealmInfo(playerRef.current.level).name}</span>
                    </div>
                    <div className="bg-red-900/30 p-4 rounded-2xl border border-red-800/50">
                      <span className="text-xs uppercase tracking-widest text-red-400 block mb-1">斬妖數量</span>
                      <span className="text-2xl font-bold">{hudData.totalKills}</span>
                    </div>
                  </div>

                  <button 
                    onClick={startGame}
                    className="flex flex-col items-center gap-2 group"
                  >
                    <div className="flex items-center gap-2 px-12 py-4 bg-red-600 text-white font-black rounded-xl hover:bg-red-500 transition-all active:scale-95 shadow-xl shadow-red-600/20">
                      <RotateCcw className="w-6 h-6" /> 重新投胎
                    </div>
                  </button>
                </motion.div>
              )}

              {gameState === GameState.WIN && (
                <motion.div 
                  key="win-overlay"
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="absolute inset-0 bg-yellow-950/90 backdrop-blur-xl flex flex-col items-center justify-center p-4 text-center z-[80] pointer-events-auto"
                >
                  <div className="p-4 bg-yellow-500/20 rounded-full mb-4">
                    <Trophy className="w-16 h-16 text-yellow-500" />
                  </div>
                  <h2 className="text-6xl font-black mb-2 tracking-tighter text-yellow-500">功德圓滿</h2>
                  <p className="text-yellow-200/60 mb-8 text-lg">
                    恭喜！您已突破戰鬥力極限，守護了天疆。
                  </p>
                  
                  <div className="grid grid-cols-2 gap-4 mb-8 w-full max-w-xs">
                    <div className="bg-yellow-900/30 p-4 rounded-2xl border border-yellow-800/50">
                      <span className="text-xs uppercase tracking-widest text-yellow-400 block mb-1">最終境界</span>
                      <span className="text-2xl font-bold">{getRealmInfo(playerRef.current.level).name}</span>
                    </div>
                    <div className="bg-yellow-900/30 p-4 rounded-2xl border border-yellow-800/50">
                      <span className="text-xs uppercase tracking-widest text-yellow-400 block mb-1">通關時間</span>
                      <span className="text-2xl font-bold">{formatTime(hudData.timer)}</span>
                    </div>
                  </div>

                  <button 
                    onClick={() => setGameState(GameState.MENU)}
                    className="flex flex-col items-center gap-2 group"
                  >
                    <div className="flex items-center gap-2 px-12 py-4 bg-yellow-500 text-yellow-950 font-black rounded-xl hover:bg-yellow-400 transition-all active:scale-95 shadow-xl shadow-yellow-500/20">
                      <Home className="w-6 h-6" /> 返回主選單
                    </div>
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Bottom Controls (Music & Pause) */}
            <div className="mt-auto flex justify-between items-center pointer-events-auto">
              <button 
                onClick={() => setIsMusicEnabled(prev => !prev)}
                className={`p-4 rounded-2xl transition-colors ${isMusicEnabled ? 'text-yellow-500 bg-yellow-500/10' : 'text-slate-600 bg-slate-800'} hover:text-white`}
              >
                {isMusicEnabled ? <Volume2 className="w-8 h-8" /> : <VolumeX className="w-8 h-8" />}
              </button>
              <button 
                onClick={() => setGameState(prev => prev === GameState.PAUSED ? GameState.PLAYING : GameState.PAUSED)}
                className="p-4 bg-slate-800 hover:bg-slate-700 rounded-2xl transition-colors text-slate-400 hover:text-white"
              >
                {gameState === GameState.PAUSED ? <Play className="w-8 h-8" /> : <Pause className="w-8 h-8" />}
              </button>
            </div>

          </div>
        </div>

        {/* Menu & Character Select (Full Screen) */}
        <AnimatePresence mode="wait">
          {gameState === GameState.MENU && (
            <motion.div 
              key="menu-screen"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-[100] flex flex-col items-center justify-start p-4 pt-16 sm:pt-24 overflow-y-auto"
              style={{
                backgroundImage: `url("${BACKGROUND_CONFIG.menuBackground}")`,
                backgroundSize: 'cover',
                backgroundPosition: 'center'
              }}
            >
              {/* Dark Overlay for better text readability */}
              <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-[1px]" />

              <div className="relative z-10 flex flex-col items-center gap-8 w-full max-w-sm">
                <div className="flex flex-col items-center text-center">
                  <motion.h1 
                    initial={{ y: -20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    className="text-4xl sm:text-5xl font-black text-white tracking-tighter drop-shadow-[0_0_30px_rgba(59,130,246,0.8)] px-2"
                  >
                    小雪在邊疆修仙
                  </motion.h1>
                  <p className="text-blue-400 font-bold tracking-[0.4em] mt-3 drop-shadow-md text-xs sm:text-sm">XIAOXUE SURVIVORS</p>
                </div>

                <div className="flex flex-col items-center gap-4 w-full">
                  {/* Difficulty Selection First */}
                  <div className="flex flex-col items-center gap-3 w-full mb-2">
                    <span className="text-slate-500 text-[10px] font-black uppercase tracking-[0.3em] opacity-80">選擇修行難度</span>
                    <div className="flex bg-slate-900/80 p-1.5 rounded-2xl border border-slate-800 backdrop-blur-sm w-full max-w-[280px]">
                      <button 
                        onClick={() => setDifficulty(Difficulty.SIMPLE)}
                        className={`flex-1 py-2.5 rounded-xl text-sm font-black transition-all ${difficulty === Difficulty.SIMPLE ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20' : 'text-slate-500 hover:text-slate-300'}`}
                      >
                        簡單
                      </button>
                      <button 
                        onClick={() => setDifficulty(Difficulty.NORMAL)}
                        className={`flex-1 py-2.5 rounded-xl text-sm font-black transition-all ${difficulty === Difficulty.NORMAL ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20' : 'text-slate-500 hover:text-slate-300'}`}
                      >
                        普通
                      </button>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex flex-col gap-4 w-full">
                    <button 
                      onClick={startGame}
                      className="w-full py-5 bg-blue-600 active:bg-blue-500 text-white font-black text-2xl rounded-3xl transition-all active:scale-95 flex items-center justify-center gap-3 shadow-[0_10px_30px_rgba(37,99,235,0.3)] active:shadow-none animate-pulse-subtle"
                    >
                      <Play className="w-8 h-8 fill-current" /> 開始修行
                    </button>
                    <button 
                      onClick={() => setGameState(GameState.CHARACTER_SELECT)}
                      className="w-full py-5 bg-slate-900/80 border border-slate-800 text-slate-200 font-bold text-xl rounded-3xl transition-all active:scale-95 flex items-center justify-center gap-3 hover:bg-slate-800"
                    >
                      <Sparkles className="w-7 h-7 text-blue-400" /> 仙姿百態
                    </button>
                    <button 
                      onClick={() => setGameState(GameState.BESTIARY)}
                      className="w-full py-5 bg-slate-900/80 border border-slate-800 text-slate-200 font-bold text-xl rounded-3xl transition-all active:scale-95 flex items-center justify-center gap-3 hover:bg-slate-800"
                    >
                      <BookOpen className="w-7 h-7 text-yellow-500" /> 妖獸百科
                    </button>
                  </div>
                </div>

                <div className="flex flex-row items-center justify-center gap-3 w-full mt-4">
                  <button 
                    onClick={() => window.location.href = "https://ais-pre-g5o6uhck5ifqagubrhuzby-381906535429.asia-northeast1.run.app/"}
                    className="group flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-slate-900/60 hover:bg-slate-800/80 rounded-2xl border border-slate-800 hover:border-blue-500/30 transition-all active:scale-95 shadow-lg"
                  >
                    <Home className="w-3.5 h-3.5 text-blue-400" /> 
                    <span className="text-[10px] font-bold text-slate-400 group-hover:text-slate-200 tracking-wider">回到修仙世界</span>
                  </button>
                  
                  <button 
                    onClick={() => window.location.href = "https://www.youtube.com/@XiaoXue168"}
                    className="group flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-slate-900/60 hover:bg-slate-800/80 rounded-2xl border border-slate-800 hover:border-red-500/30 transition-all active:scale-95 shadow-lg"
                  >
                    <Play className="w-3.5 h-3.5 text-red-500" /> 
                    <span className="text-[10px] font-bold text-slate-400 group-hover:text-slate-200 tracking-wider uppercase">YouTube</span>
                  </button>
                </div>

                {/* Refined Studio Footer Design */}
                <div className="mt-10 mb-8 px-4 text-center">
                  <div className="inline-flex flex-col items-center gap-3">
                    <div className="flex items-center gap-4">
                      <div className="h-[1px] w-8 bg-gradient-to-r from-transparent to-slate-500 opacity-30"></div>
                      <div className="flex items-center gap-3">
                        <span className="text-[11px] font-bold tracking-[0.2em] text-slate-200">小雪工作室</span>
                        <div className="w-[1px] h-3 bg-slate-700"></div>
                        <span className="text-[10px] font-medium tracking-[0.2em] text-slate-400 uppercase">XIAOXUE STUDIO</span>
                      </div>
                      <div className="h-[1px] w-8 bg-gradient-to-l from-transparent to-slate-500 opacity-30"></div>
                    </div>
                    <div className="px-3 py-1 rounded-full bg-slate-900/30 border border-slate-800/50">
                      <p className="text-[8px] font-black text-slate-500 tracking-[0.4em] uppercase">
                        Version 1.2
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {gameState === GameState.CHARACTER_SELECT && (
            <CharacterSelect 
              key="char-select-overlay"
              currentStyleId={selectedStyleId}
              playUltimateVoice={playUltimateVoice}
              drawPlayer={drawPlayerNew}
              onSelect={(id) => {
                setSelectedStyleId(id);
                setGameState(GameState.MENU);
              }}
              onBack={() => setGameState(GameState.MENU)}
            />
          )}

          {gameState === GameState.BESTIARY && (
            <Bestiary 
              onBack={() => setGameState(GameState.MENU)}
            />
          )}

        </AnimatePresence>
      </div>
    </div>
  );
}
