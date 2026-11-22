export type Point2D = [number, number];

export interface RectTile {
  kind: 'rect';
  x: number;
  z: number;
  w: number;
  d: number;
  cx: number;
  cz: number;
}

export interface TriTile {
  kind: 'tri';
  pts: Point2D[];
  cx: number;
  cz: number;
}

export type RingTile = RectTile | TriTile;

export type Species = 'panda' | 'bear';
export type CharKey = 'yier' | 'caomei' | 'xiangyu' | 'bubu' | 'mocha' | 'haiyan';
export type PlayerType = 'human' | 'ai';

export interface CharacterDef {
  key: CharKey;
  name: string;
  species: Species;
  body: number;
  ear: number;
  foot: number;
  blush: number;
  color: number;
  colorLight: number;
  baseTint: number;
  uiColor: string;
}

export interface SlotDef {
  slotId: number;
  start: number;
  court: Point2D;
  launch: Point2D;
  gate: Point2D;
  gateAxis: 'x' | 'z';
  home: Point2D[];
  final: Point2D;
  base: Point2D[];
  toy: Point2D;
  finalYaw: number;
}

export type AiPersonality = 'vengeful' | 'chill' | 'rusher' | 'tactician';

export interface AiPersonalityDef {
  id: AiPersonality;
  name: string;
  badge: string;
  icon: string;
  color: string;
  desc: string;
  shopPriority: ItemType[];
}

export const AI_PERSONALITY_ORDER: AiPersonality[] = [
  'vengeful',
  'chill',
  'rusher',
  'tactician',
];

export const AI_PERSONALITIES: Record<AiPersonality, AiPersonalityDef> = {
  vengeful: {
    id: 'vengeful',
    name: '记仇型',
    badge: '记仇',
    icon: '😠',
    color: '#e11d48',
    desc: '记小本本！被踩或被炸必记仇，优先导弹与追击报复',
    shopPriority: ['missile', 'shield', 'sixDie', 'refuel', 'twinDice'],
  },
  chill: {
    id: 'chill',
    name: '佛系型',
    badge: '佛系',
    icon: '🍵',
    color: '#0d9488',
    desc: '随缘出行，偏爱护盾保平安，极少主动踩人与乱放导弹',
    shopPriority: ['shield', 'refuel', 'twinDice', 'sixDie', 'missile'],
  },
  rusher: {
    id: 'rusher',
    name: '激进速通',
    badge: '激进',
    icon: '⚡',
    color: '#ea580c',
    desc: '只想最快通关！狂抢加速道具，挡路敌机一律踩回起点',
    shopPriority: ['sixDie', 'refuel', 'twinDice', 'missile', 'shield'],
  },
  tactician: {
    id: 'tactician',
    name: '精算稳健',
    badge: '精算',
    icon: '🧠',
    color: '#6366f1',
    desc: '讲究收益与节奏，擅长叠机推进与精准打击领跑者',
    shopPriority: ['sixDie', 'missile', 'shield', 'twinDice', 'refuel'],
  },
};

export type PlayerConfig = CharacterDef &
  SlotDef & {
    type: PlayerType;
    personality?: AiPersonality;
  };

export interface SeatConfig {
  on: boolean;
  char: CharKey;
  type: PlayerType;
  personality?: AiPersonality;
}

export type ItemType = 'sixDie' | 'twinDice' | 'refuel' | 'shield' | 'missile';
export type ItemCategory = 'attack' | 'defense' | 'counter';

export interface ItemDef {
  type: ItemType;
  name: string;
  category: ItemCategory;
  categoryLabel: string;
  icon: string;
  shortEffect: string;
  limitNote: string;
  desc: string;
  accentColor: string;
}

export const ITEM_ORDER: ItemType[] = ['sixDie', 'twinDice', 'refuel', 'shield', 'missile'];

export const ITEM_DEFS: Record<ItemType, ItemDef> = {
  sixDie: {
    type: 'sixDie',
    name: '幸运草莓蛋糕',
    category: 'attack',
    categoryLabel: '加速甜点',
    icon: '🍰',
    shortEffect: '下次必出 6 点',
    limitNote: '没有连投效果',
    desc: '吃一口幸运草莓蛋糕，下一次掷骰必定掷出 6 点（本次 6 点不触发奖励连投）。',
    accentColor: '#e85d75',
  },
  twinDice: {
    type: 'twinDice',
    name: '双倍珍珠奶茶',
    category: 'attack',
    categoryLabel: '加速饮品',
    icon: '🧋',
    shortEffect: '同时掷两颗骰子',
    limitNote: '投出 6 无连投',
    desc: '吨吨炫完双倍珍珠奶茶，同时掷两颗骰子按点数之和前进（点数之和 ≥ 5 即可起飞）。',
    accentColor: '#c97b3e',
  },
  refuel: {
    type: 'refuel',
    name: '再来一口小饼干',
    category: 'attack',
    categoryLabel: '元气零食',
    icon: '🍪',
    shortEffect: '额外多一次投骰',
    limitNote: '连 6 仍计入上限',
    desc: '嚼一口香喷喷的小饼干，本回合移动后额外获得 1 次投骰机会（连 6 计入上限）。',
    accentColor: '#d98a2b',
  },
  shield: {
    type: 'shield',
    name: '软绵绵泡泡罩',
    category: 'counter',
    categoryLabel: '反制守护',
    icon: '🫧',
    shortEffect: '抵挡一次恶作剧或被踩',
    limitNote: '不可叠加',
    desc: '为己方场上小熊套上软绵绵泡泡罩，可抵挡 1 次奶油派炸弹或被踩（同格挤脸站立）。',
    accentColor: '#3b9ae1',
  },
  missile: {
    type: 'missile',
    name: '奶油派炸弹',
    category: 'attack',
    categoryLabel: '俏皮恶作剧',
    icon: '🥧',
    shortEffect: '敌方棋子后退 6 格',
    limitNote: '起点终点除外 · 无大跳飞机',
    desc: '向场上敌方小熊丢出奶油派炸弹（起点与终点除外），使其后退 6 格。',
    accentColor: '#9b6bff',
  },
};

export type ProgressStage = 0 | 1 | 2 | 3;

/** 按阶段（全场最多完赛棋子数 0/1/2/3）配置「一二的馈赠」各道具权重/概率 */
export const GIFT_QUEST_ITEM_WEIGHTS: Record<ProgressStage, Record<ItemType, number>> = {
  // 阶段 0：奶油派 0%、泡泡罩 10%，其余 3 种平分剩余 90%
  0: { sixDie: 30, twinDice: 30, refuel: 30, shield: 10, missile: 0 },
  // 阶段 1：奶油派 5%、泡泡罩 10%，其余 3 种平分剩余 85%
  1: { sixDie: 85 / 3, twinDice: 85 / 3, refuel: 85 / 3, shield: 10, missile: 5 },
  // 阶段 2~3：奶油派 10%，其余 4 种平分剩余 90%
  2: { sixDie: 22.5, twinDice: 22.5, refuel: 22.5, shield: 22.5, missile: 10 },
  3: { sixDie: 18.75, twinDice: 18.75, refuel: 18.75, shield: 18.75, missile: 25 },
};

/** 按阶段（全场最多完赛棋子数 0/1/2/3）配置「道具商店」各道具出现权重/概率 */
export const SHOP_ITEM_WEIGHTS: Record<ProgressStage, Record<ItemType, number>> = {
  // 阶段 0：奶油派 0%，其余 4 种平均分配
  0: { sixDie: 25, twinDice: 25, refuel: 25, shield: 25, missile: 0 },
  // 阶段 1：奶油派 10%，其余 4 种平分剩余 90%
  1: { sixDie: 20, twinDice: 20, refuel: 20, shield: 20, missile: 20 },
  // 阶段 2~3：所有道具概率平均分配
  2: { sixDie: 20, twinDice: 20, refuel: 20, shield: 20, missile: 20 },
  3: { sixDie: 20, twinDice: 20, refuel: 20, shield: 20, missile: 20 },
};

export interface PlayerQuestState {
  roll1: number;
  roll2: number;
  stomped: number;
}

export interface PlayerKdaStats {
  stomps: number;
  stomped: number;
  shieldBreaks: number;
}

export interface ItemTargetChoice {
  pid: number;
  idx: number;
  ownerName: string;
  ownerColor: string;
  pos: number;
  shielded: boolean;
  stackCount: number;
}

export type GamePhase =
  | 'idle'
  | 'awaitRoll'
  | 'rolling'
  | 'awaitMove'
  | 'moving'
  | 'shopChoice'
  | 'aiWait'
  | 'over';

export type GraphicsQuality = 'high' | 'medium' | 'low';

export type CameraMode = 'follow' | 'top' | 'free';

export interface HudPlayerSnapshot {
  charKey: CharKey;
  name: string;
  species: Species;
  type: PlayerType;
  colorHex: string;
  uiColor: string;
  doneCount: number;
  finishRank: number | null;
  active: boolean;
  items: Record<ItemType, number>;
  quest: PlayerQuestState;
  kda: PlayerKdaStats;
}

export type TimeOfDay = 'morning' | 'noon' | 'afternoon' | 'evening';

export interface TimeOfDayPreset {
  label: string;
  icon: string;
  skyBgHex: number;
  skyZenithHex: number;
  skyHorizonHex: number;
  fogHex: number;
  fogNear: number;
  fogFar: number;
  hemiSkyHex: number;
  hemiGroundHex: number;
  hemiIntensity: number;
  sunColorHex: number;
  sunIntensity: number;
  sunPosition: [number, number, number];
  fillColorHex: number;
  fillIntensity: number;
  envIntensity: number;
  exposure: number;
  lanternEmissive: number;
  lanternLightScale: number;
  fireflyOpacity: number;
  mistOpacity: number;
  cloudOpacity: number;
  leafOpacity: number;
  starOpacity: number;
  waterTintHex: number;
}

export type MapId = 'ancient_city';

export interface MapConfig {
  id: MapId;
  name: string;
  subtitle: string;
  icon: string;
  skyBgHex: number;
  fogHex: number;
  fogNear: number;
  fogFar: number;
  themeAccent: string;
  hemiSkyHex: number;
  hemiGroundHex: number;
  hemiIntensity: number;
  sunColorHex: number;
  sunIntensity: number;
  sunPosition: [number, number, number];
  fillColorHex: number;
  fillIntensity: number;
  enablePoemBubbles: boolean;
  enableCritterSpawns: boolean;
  timePresets: Record<TimeOfDay, TimeOfDayPreset>;
}

export const MAP_ORDER: MapId[] = ['ancient_city'];

export const MAPS: Record<MapId, MapConfig> = {
  ancient_city: {
    id: 'ancient_city',
    name: '古城 · 熊熊坊',
    subtitle: '护城河 · 熊熊坊 · 江南庭院',
    icon: '🏯',
    skyBgHex: 0xdbe8df,
    fogHex: 0xdbe8df,
    fogNear: 48,
    fogFar: 108,
    themeAccent: '#2c9a60',
    hemiSkyHex: 0xfff5e4,
    hemiGroundHex: 0x8ea874,
    hemiIntensity: 0.72,
    sunColorHex: 0xffdfb0,
    sunIntensity: 1.32,
    sunPosition: [8, 16, 7],
    fillColorHex: 0xd0e2f2,
    fillIntensity: 0.34,
    enablePoemBubbles: true,
    enableCritterSpawns: true,
    timePresets: {
      morning: {
        label: '清晨',
        icon: '🌅',
        skyBgHex: 0xfce0cf,
        skyZenithHex: 0x7cb8f0,
        skyHorizonHex: 0xfbe0d0,
        fogHex: 0xf9e2d2,
        fogNear: 38,
        fogFar: 96,
        hemiSkyHex: 0xfff0e6,
        hemiGroundHex: 0x87a872,
        hemiIntensity: 0.78,
        sunColorHex: 0xffbe88,
        sunIntensity: 1.48,
        sunPosition: [18, 5.2, 8],
        fillColorHex: 0xdce8ff,
        fillIntensity: 0.40,
        envIntensity: 0.36,
        exposure: 1.04,
        lanternEmissive: 0.35,
        lanternLightScale: 0.0,
        fireflyOpacity: 0.0,
        mistOpacity: 0.45,
        cloudOpacity: 0.32,
        leafOpacity: 0.0,
        starOpacity: 0.0,
        waterTintHex: 0xffeadc,
      },
      noon: {
        label: '中午',
        icon: '☀️',
        skyBgHex: 0xc5e6fc,
        skyZenithHex: 0x4b9ce8,
        skyHorizonHex: 0xcfeafd,
        fogHex: 0xd8ecf9,
        fogNear: 68,
        fogFar: 150,
        hemiSkyHex: 0xfff8e8,
        hemiGroundHex: 0x92ad77,
        hemiIntensity: 0.72,
        sunColorHex: 0xffe39a,
        sunIntensity: 1.28,
        sunPosition: [4, 24, 3],
        fillColorHex: 0xe2eff8,
        fillIntensity: 0.30,
        envIntensity: 0.34,
        exposure: 0.98,
        lanternEmissive: 0.05,
        lanternLightScale: 0.0,
        fireflyOpacity: 0.0,
        mistOpacity: 0.0,
        cloudOpacity: 0.92,
        leafOpacity: 0.0,
        starOpacity: 0.0,
        waterTintHex: 0xffffff,
      },
      afternoon: {
        label: '下午',
        icon: '🌇',
        skyBgHex: 0xf4b378,
        skyZenithHex: 0x4a66a6,
        skyHorizonHex: 0xf4ad72,
        fogHex: 0xefaa72,
        fogNear: 34,
        fogFar: 90,
        hemiSkyHex: 0xffc486,
        hemiGroundHex: 0x7b604b,
        hemiIntensity: 0.66,
        sunColorHex: 0xff7b36,
        sunIntensity: 1.88,
        sunPosition: [-19, 6.2, 8],
        fillColorHex: 0x9c90d0,
        fillIntensity: 0.36,
        envIntensity: 0.24,
        exposure: 1.03,
        lanternEmissive: 0.95,
        lanternLightScale: 0.38,
        fireflyOpacity: 0.16,
        mistOpacity: 0.0,
        cloudOpacity: 0.45,
        leafOpacity: 0.9,
        starOpacity: 0.1,
        waterTintHex: 0xffcfa4,
      },
      evening: {
        label: '夜晚',
        icon: '🌙',
        skyBgHex: 0x0f182e,
        skyZenithHex: 0x091024,
        skyHorizonHex: 0x18284a,
        fogHex: 0x14203d,
        fogNear: 28,
        fogFar: 82,
        hemiSkyHex: 0x3b5896,
        hemiGroundHex: 0x191e36,
        hemiIntensity: 0.40,
        sunColorHex: 0x89b0f5,
        sunIntensity: 0.68,
        sunPosition: [-12, 16, -10],
        fillColorHex: 0x2c4175,
        fillIntensity: 0.25,
        envIntensity: 0.12,
        exposure: 0.93,
        lanternEmissive: 2.9,
        lanternLightScale: 1.0,
        fireflyOpacity: 1.0,
        mistOpacity: 0.0,
        cloudOpacity: 0.0,
        leafOpacity: 0.14,
        starOpacity: 0.96,
        waterTintHex: 0x5c7ca8,
      },
    },
  },
};

export interface KillBannerEvent {
  key: number;
  kills: number;
  title: string;
  subtitle: string;
  playerName: string;
  playerCharKey: CharKey;
  playerColor: string;
}

export interface GiftQuestEvent {
  questType?: 'gift' | 'bubu';
  isLocalHuman: boolean;
  playerName: string;
  playerCharKey: CharKey;
  playerColor: string;
  item: ItemType;
  key: number;
}

export interface HudEmoteEvent {
  pid: number;
  text: string;
  key: number;
}

export interface GameHudSnapshot {
  mapId: MapId;
  timeOfDay: TimeOfDay;
  phase: GamePhase;
  turn: number;
  die: number | null;
  twinDice: [number, number] | null;
  hudDieFace: number;
  hudDieRolling: boolean;
  hudDiePopKey: number;
  sixChain: number;
  movableCount: number;
  paused: boolean;
  camMode: CameraMode;
  secondsLeft: number | null;
  message: string | null;
  messageColor: string | null;
  messageKey: number;
  latestEmote: HudEmoteEvent | null;
  splashText: string | null;
  splashAvatar: string;
  splashCharKey: CharKey;
  splashColor: string;
  splashVisible: boolean;
  splashItem: ItemType | null;
  splashKey: number;
  splashIsHuman: boolean;
  splashActorName: string | null;
  splashDetail: string | null;
  splashTargetCharKey: CharKey | null;
  splashTargetName: string | null;
  shakeKey: number;
  winnerPid: number | null;
  rankings: number[];
  gmDie: number | null;
  gmAutoPlay: boolean;
  gameSpeed: number;
  turnUsedAtkDef: boolean;
  turnUsedDef: boolean;
  armedSixDie: boolean;
  armedTwinDice: boolean;
  armedRefuel: boolean;
  pendingItemTarget: 'shield' | 'missile' | null;
  targetChoices: ItemTargetChoice[];
  shopOffer: ItemType[] | null;
  shopSecondsLeft: number | null;
  shopPid: number | null;
  giftQuestEvent: GiftQuestEvent | null;
  killBanner: KillBannerEvent | null;
  players: HudPlayerSnapshot[];
}

export const rotCW = ([x, z]: Point2D, q: number): Point2D => {
  if (q === 0) return [x, z];
  if (q === 1) return [-z, x];
  if (q === 2) return [-x, -z];
  return [z, -x];
};

const QUAD0_TILES: RingTile[] = [
  { kind: 'rect', x: -6.30, z: 0.00, w: 1.16, d: 0.92, cx: -6.30, cz: 0.00 },
  { kind: 'rect', x: -6.30, z: -0.95, w: 1.16, d: 0.90, cx: -6.30, cz: -0.95 },
  { kind: 'rect', x: -6.30, z: -1.90, w: 1.16, d: 0.90, cx: -6.30, cz: -1.90 },
  { kind: 'tri', pts: [[-6.88, -2.40], [-5.72, -2.40], [-5.72, -3.56]], cx: -6.11, cz: -2.79 },
  { kind: 'rect', x: -5.17, z: -2.98, w: 1.00, d: 1.16, cx: -5.17, cz: -2.98 },
  { kind: 'rect', x: -4.12, z: -2.98, w: 1.00, d: 1.16, cx: -4.12, cz: -2.98 },
  { kind: 'tri', pts: [[-3.56, -3.50], [-3.56, -2.40], [-2.46, -2.40]], cx: -3.19, cz: -2.77 },
  { kind: 'tri', pts: [[-3.50, -3.56], [-2.40, -3.56], [-2.40, -2.46]], cx: -2.77, cz: -3.19 },
  { kind: 'rect', x: -2.98, z: -4.12, w: 1.16, d: 1.00, cx: -2.98, cz: -4.12 },
  { kind: 'rect', x: -2.98, z: -5.17, w: 1.16, d: 1.00, cx: -2.98, cz: -5.17 },
  { kind: 'tri', pts: [[-3.56, -5.72], [-2.40, -5.72], [-2.40, -6.88]], cx: -2.79, cz: -6.11 },
  { kind: 'rect', x: -1.90, z: -6.30, w: 0.90, d: 1.16, cx: -1.90, cz: -6.30 },
  { kind: 'rect', x: -0.95, z: -6.30, w: 0.90, d: 1.16, cx: -0.95, cz: -6.30 },
];

export const RING_TILES: RingTile[] = [];
for (let q = 0; q < 4; q++) {
  for (const t of QUAD0_TILES) {
    const [cx, cz] = rotCW([t.cx, t.cz], q);
    if (t.kind === 'rect') {
      const [x, z] = rotCW([t.x, t.z], q);
      const swap = q % 2 === 1;
      RING_TILES.push({
        kind: 'rect',
        x,
        z,
        w: swap ? t.d : t.w,
        d: swap ? t.w : t.d,
        cx,
        cz,
      });
    } else {
      RING_TILES.push({
        kind: 'tri',
        pts: t.pts.map((p) => rotCW(p, q)),
        cx,
        cz,
      });
    }
  }
}

export const RING: Point2D[] = RING_TILES.map((t) => [t.cx, t.cz]);
export const HOME_END = 56;
export const FLIGHT_FROM = 18;
export const FLIGHT_STEP = 12;

export const CHARS: Record<CharKey, CharacterDef> = {
  yier: {
    key: 'yier',
    name: '奶白一二',
    species: 'panda',
    body: 0xf7f4ef,
    ear: 0x2b2b30,
    foot: 0x2b2b30,
    blush: 0xf7aa96,
    color: 0xf4f2ec,
    colorLight: 0xf7f5f0,
    baseTint: 0xf1ede6,
    uiColor: '#4a4a55',
  },
  caomei: {
    key: 'caomei',
    name: '草莓一二',
    species: 'panda',
    body: 0xf5bcc0,
    ear: 0x5a2e32,
    foot: 0x5a2e32,
    blush: 0xf0968c,
    color: 0xe2636e,
    colorLight: 0xf0a6ae,
    baseTint: 0xf8e3e0,
    uiColor: '#e2636e',
  },
  xiangyu: {
    key: 'xiangyu',
    name: '香芋一二',
    species: 'panda',
    body: 0xcebee7,
    ear: 0x41335a,
    foot: 0x41335a,
    blush: 0xe8a8c0,
    color: 0x9678d0,
    colorLight: 0xc3b2e2,
    baseTint: 0xede6f6,
    uiColor: '#8a68cb',
  },
  bubu: {
    key: 'bubu',
    name: '焦糖布布',
    species: 'bear',
    body: 0x9e6839,
    ear: 0x9e6839,
    foot: 0x6b4322,
    blush: 0xeab832,
    color: 0xc5863f,
    colorLight: 0xe6c797,
    baseTint: 0xf5ebd9,
    uiColor: '#c5863f',
  },
  mocha: {
    key: 'mocha',
    name: '抹茶布布',
    species: 'bear',
    body: 0xc9d8ac,
    ear: 0xc9d8ac,
    foot: 0x8a9a5b,
    blush: 0xf2f0d5,
    color: 0x7fa845,
    colorLight: 0xc9dda2,
    baseTint: 0xedf1dc,
    uiColor: '#6c9835',
  },
  haiyan: {
    key: 'haiyan',
    name: '海盐布布',
    species: 'bear',
    body: 0xc3d6e2,
    ear: 0xc3d6e2,
    foot: 0x7c9bb0,
    blush: 0xf3e6e0,
    color: 0x4e9cc9,
    colorLight: 0xa9cde4,
    baseTint: 0xe4edf4,
    uiColor: '#3f8dbb',
  },
};

export const CHAR_KEYS = Object.keys(CHARS) as CharKey[];

const BASE_YAWS = [Math.PI / 2, 0, -Math.PI / 2, Math.PI];

export const SLOTS: SlotDef[] = [0, 1, 2, 3].map((q) => ({
  slotId: q,
  start: q * 13,
  court: rotCW([-5.68, -5.68], q),
  launch: rotCW([-7.08, -3.28], q),
  gate: rotCW([-6.85, -3.77], q),
  gateAxis: q % 2 === 0 ? 'z' : 'x',
  home: (
    [
      [-5.32, 0],
      [-4.54, 0],
      [-3.76, 0],
      [-2.98, 0],
      [-2.20, 0],
    ] as Point2D[]
  ).map((p) => rotCW(p, q)),
  final: rotCW([-1.18, 0], q),
  base: (
    [
      [-6.88, -6.88],
      [-5.62, -6.88],
      [-6.88, -5.62],
      [-5.62, -5.62],
    ] as Point2D[]
  ).map((p) => rotCW(p, q)),
  toy: rotCW([-4.42, -4.42], q),
  finalYaw: BASE_YAWS[q],
}));

export const SEAT_ORDER: Record<number, number[]> = {
  2: [0, 2],
  3: [0, 1, 2],
  4: [0, 1, 2, 3],
};

export const SEAT_NAMES = ['左上', '右上', '右下', '左下'] as const;

export const DEFAULT_SEATS: SeatConfig[] = [
  { on: true, char: 'yier', type: 'human' },
  { on: false, char: 'caomei', type: 'ai' },
  { on: true, char: 'bubu', type: 'ai' },
  { on: false, char: 'haiyan', type: 'ai' },
];

export const STACK_OFF: Point2D[] = [
  [0, 0],
  [0.2, 0.2],
  [-0.2, 0.2],
  [0.2, -0.2],
  [-0.2, -0.2],
];

export const ORIENT: Record<number, [number, number, number]> = {
  1: [0, 0, 0],
  6: [Math.PI, 0, 0],
  2: [-Math.PI / 2, 0, 0],
  5: [Math.PI / 2, 0, 0],
  3: [0, 0, Math.PI / 2],
  4: [0, 0, -Math.PI / 2],
};

export const HUD_PIPS: Record<number, number[]> = {
  1: [4],
  2: [2, 6],
  3: [2, 4, 6],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
};

export const NEUTRAL_CELL = 0x8f979b;
export const lineOf = (P: PlayerConfig) => (P.key === 'yier' ? 0x4a4a55 : P.color);
export const ringColor = (P: PlayerConfig) => (P.key === 'yier' ? 0x4a4a55 : 0xffffff);
export const toColorHex = (c: number) => '#' + c.toString(16).padStart(6, '0');
