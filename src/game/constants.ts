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

export type PlayerConfig = CharacterDef &
  SlotDef & {
    type: PlayerType;
  };

export interface SeatConfig {
  on: boolean;
  char: CharKey;
  type: PlayerType;
}

export type GamePhase =
  | 'idle'
  | 'awaitRoll'
  | 'rolling'
  | 'awaitMove'
  | 'moving'
  | 'aiWait'
  | 'over';

export type CameraMode = 'follow' | 'top' | 'free';

export interface HudPlayerSnapshot {
  charKey: CharKey;
  name: string;
  species: Species;
  type: PlayerType;
  colorHex: string;
  uiColor: string;
  doneCount: number;
  active: boolean;
}

export interface GameHudSnapshot {
  phase: GamePhase;
  turn: number;
  die: number | null;
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
  splashText: string | null;
  splashAvatar: string;
  splashCharKey: CharKey;
  splashColor: string;
  splashVisible: boolean;
  shakeKey: number;
  winnerPid: number | null;
  gmDie: number | null;
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
    body: 0xf6cfc9,
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
    body: 0xd9cde9,
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
