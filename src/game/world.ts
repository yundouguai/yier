import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {
  CHARS,
  FLIGHT_FROM,
  FLIGHT_STEP,
  MapId,
  NEUTRAL_CELL,
  PlayerConfig,
  Point2D,
  RING,
  RING_TILES,
  SLOTS,
  Species,
  lineOf,
  ringColor,
} from './constants';
import { buildPlaneMesh, makePlaneModel } from './pieces';
import {
  createAncientTileTexture,
  createBrickBankTexture,
  createCellMedallionTexture,
  createCourtyardGrassTexture,
  createDiceAltarTexture,
  createGatePlaqueTexture,
  createGoalTriangleTexture,
  createGrassTexture,
  createHardwoodFrameTexture,
  createHullFoamTexture,
  createMoatTexture,
  createRiverbedTexture,
  createShoreEarthTexture,
  createCrossDangerTexture,
  createFlightTakeoffTexture,
  createLandingPadTexture,
  createShopMedallionTexture,
  createStartPadTexture,
  createStoneDeckTexture,
  createWakeTexture,
  createWallBrickTexture,
  createWaterNormalTexture,
} from './textures';

export interface RideToyCakeEatRig {
  restArmGroup: THREE.Group;
  eatArmPivot: THREE.Group;
  cakeGroup: THREE.Group;
  cakeSlice1: THREE.Group;
  cakeSlice2: THREE.Group;
  mouthClosed: THREE.Mesh;
  mouthOpen: THREE.Group;
  jawPivot: THREE.Group;
  blushMeshes: THREE.Mesh[];
  normalEyes: THREE.Mesh[];
  happyEyes: THREE.Mesh[];
  eatStart: number;
  eatDur: number;
}

export interface RideToyAnim {
  root: THREE.Group;
  rockerPivot: THREE.Group;
  riderPivot: THREE.Group;
  headPivot: THREE.Group;
  phase: number;
  species: Species;
  charKey: string;
  cakeEat?: RideToyCakeEatRig;
}

export interface PetalAnim {
  m: THREE.Mesh;
  speed: number;
  sway: number;
  baseR: number;
  ang: number;
}

export interface LotusAnim {
  g: THREE.Group;
  phase: number;
}

export interface WillowAnim {
  g: THREE.Group;
  phase: number;
}

export interface MoatDuckAnim {
  g: THREE.Group;
  th: number;
  speed: number;
  rOff: number;
  bob: number;
}

export type FishSwimStyle = 'cruise' | 'burst' | 'dart' | 'hover';

export interface SwimKoiAnim {
  g: THREE.Group;
  th: number;
  speed: number;
  rOff: number;
  baseROff: number;
  phase: number;
  swimPhase: number;
  style: FishSwimStyle;
}

export interface BoatAnim {
  g: THREE.Group;
  th: number;
  rOff: number;
  speed: number;
  speedFactor: number;
  bob: number;
  role: 'scholar' | 'maiden';
  targetLookYaw: number;
  currentLookYaw: number;
  rowPhase: number;
}

export type BirdFlightMode = 'soar' | 'swoop' | 'bound' | 'circle';

export type BirdSpecies = 'egret' | 'swallow' | 'kingfisher' | 'oriole' | 'robin' | 'seagull';

export type BirdPerchPhase = 'approach' | 'perch' | 'depart';

export type RabbitState =
  | 'rest'
  | 'hop'
  | 'graze'
  | 'eatCarrot'
  | 'dig'
  | 'burrow'
  | 'emerge';

export type CritterAnim =
  | {
      kind: 'rabbit';
      g: THREE.Group;
      ttl: number;
      state: RabbitState;
      rest: number;
      stateT: number;
      stateDur: number;
      hopT: number;
      hopDur: number;
      dir: number;
      phase: number;
      hopH: number;
      baseScale: number;
    }
  | {
      kind: 'bird';
      g: THREE.Group;
      ttl: number;
      from: THREE.Vector3;
      to: THREE.Vector3;
      ctrl: THREE.Vector3;
      prog: number;
      dur: number;
      flap: number;
      mode: BirdFlightMode;
      phase: number;
      circleR: number;
      circleSpeed: number;
      species?: BirdSpecies;
      perchTarget?: RideToyAnim;
      perchPhase?: BirdPerchPhase;
      perchT?: number;
      perchDur?: number;
      perchYaw?: number;
      departCtrl?: THREE.Vector3;
      departTo?: THREE.Vector3;
    }
  | {
      kind: 'fly';
      g: THREE.Group;
      ttl: number;
      seed: number;
      flap: number;
      cx: number;
      cz: number;
    }
  | {
      kind: 'fish';
      g: THREE.Group;
      ttl: number;
      prog: number;
      h: number;
    };

export interface CourtFenceHighlight {
  woodMat: THREE.MeshStandardMaterial;
  trimMat: THREE.MeshStandardMaterial;
  capMat: THREE.MeshStandardMaterial;
  active: boolean;
  pulse: boolean;
  accentHex: number;
}

export interface SpawnBirdOptions {
  species?: BirdSpecies;
  perch?: boolean;
}

export interface WorldRefs {
  waterMesh?: THREE.Mesh;
  moatTex?: THREE.CanvasTexture;
  waterNormalTex?: THREE.DataTexture;
  waterUniforms?: { uTime: { value: number }; uWaveAmp: { value: number } };
  lanternMats?: THREE.MeshStandardMaterial[];
  nightLights?: { light: THREE.PointLight; baseIntensity: number }[];
  fireflyPoints?: THREE.Points;
  fireflyMat?: THREE.PointsMaterial;
  fireflyBase?: { x: number; y: number; z: number; phase: number; speed: number; radius: number }[];
  mistGroup?: THREE.Group;
  mistMat?: THREE.MeshBasicMaterial;
  mistData?: { mesh: THREE.Mesh; ang: number; rad: number; speed: number; yBase: number; phase: number }[];
  cloudGroup?: THREE.Group;
  cloudMat?: THREE.MeshStandardMaterial;
  cloudData?: { g: THREE.Group; xBase: number; zBase: number; yBase: number; speed: number; phase: number }[];
  leafPoints?: THREE.Points;
  leafMat?: THREE.PointsMaterial;
  leafData?: { x: number; y: number; z: number; vx: number; vy: number; vz: number; phase: number }[];
  nightSkyGroup?: THREE.Group;
  starMat?: THREE.PointsMaterial;
  moonMat?: THREE.MeshBasicMaterial;
  sunriseGroup?: THREE.Group;
  sunriseDiscMat?: THREE.MeshBasicMaterial;
  sunriseHaloMesh?: THREE.Mesh;
  sunriseHaloMat?: THREE.MeshBasicMaterial;
  heartTreeNight?: {
    waveMats: THREE.MeshStandardMaterial[];
    waveHaloMats: THREE.MeshBasicMaterial[];
    baseStripMesh: THREE.Mesh;
    baseStripMat: THREE.MeshBasicMaterial;
    baseStripGlowMesh: THREE.Mesh;
    baseStripGlowMat: THREE.MeshBasicMaterial;
    plaqueMat: THREE.MeshStandardMaterial;
    wishingPlaques: { group: THREE.Group; phase: number; baseRotZ: number }[];
    heartPoints: THREE.Points;
    heartMat: THREE.PointsMaterial;
    heartBase: { x: number; y: number; z: number; phase: number; speed: number }[];
    groundHalo: THREE.Mesh;
    groundHaloMat: THREE.MeshBasicMaterial;
    spotLight: THREE.SpotLight;
    projCanvas: HTMLCanvasElement;
    projTex: THREE.CanvasTexture;
    lastProjDraw: number;
    dioramaGroup: THREE.Group;
    yierMesh: THREE.Group;
    bubuMesh: THREE.Group;
    flashLight: THREE.PointLight;
    flashHalo: THREE.Mesh;
    flashHaloMat: THREE.MeshBasicMaterial;
  };
  waterY: number;
  rideToys: RideToyAnim[];
  planeMarks: THREE.Group[];
  courtFences: CourtFenceHighlight[];
  shopRingIndices: number[];
  lotusList: LotusAnim[];
  willowDrapeList: WillowAnim[];
  petals: PetalAnim[];
  moatDucks: MoatDuckAnim[];
  swimKois: SwimKoiAnim[];
  boats: BoatAnim[];
  critters: CritterAnim[];
  moatMid: (th: number) => number;
  moatOuterR: (th: number) => number;
  moatChannelR: (th: number, rOff: number, margin?: number) => number;
  hillH: (x: number, z: number) => number;
  spawnCritter?: (
    kind: 'rabbit' | 'bird' | 'fly' | 'fish',
    opts?: SpawnBirdOptions,
  ) => void;
  /** 新地图可挂载自定义每帧环境动画，无需修改主引擎 */
  onUpdate?: (t: number, dt: number) => void;
  /** 新地图可挂载自定义资源销毁逻辑 */
  onDispose?: () => void;
}

export type WorldBuilder = (
  scene: THREE.Scene,
  players: PlayerConfig[],
  anisotropy: number,
) => WorldRefs;

const rnd = (a: number, b: number) => a + Math.random() * (b - a);
const moatInnerR = (th: number) =>
  15.2 + 0.45 * Math.sin(4 * th + 1.25) + 0.25 * Math.sin(8 * th + 2.6);
const moatOuterR = (th: number) =>
  20.42 + 0.62 * Math.sin(4 * th + 0.7) + 0.34 * Math.sin(8 * th + 2.1);
const moatMid = (th: number) => (moatInnerR(th) + moatOuterR(th)) * 0.5;
const moatChannelR = (th: number, rOff: number, margin = 0.82) => {
  const rMin = Math.max(moatInnerR(th) + margin, 16.1);
  const rMax = moatOuterR(th) - margin;
  return THREE.MathUtils.clamp(moatMid(th) + rOff, rMin, rMax);
};

function mat(c: number, r = 0.62) {
  return new THREE.MeshStandardMaterial({ color: c, roughness: r });
}

function makeRockerBase(color: number) {
  const W = 0.58;
  const H = 0.068;
  const L = 0.9;
  const geo = new THREE.BoxGeometry(W, H, L, 18, 4, 32);
  const pos = geo.attributes.position;
  const hx = W / 2;
  const hz = L / 2;
  for (let i = 0; i < pos.count; i++) {
    let x = pos.getX(i);
    let y = pos.getY(i);
    let z = pos.getZ(i);
    const u = x / hx;
    const v = z / hz;
    const norm = Math.pow(Math.pow(Math.abs(u), 5) + Math.pow(Math.abs(v), 5), 0.2);
    if (norm > 1) {
      x /= norm;
      z /= norm;
    }
    const edge = Math.min(norm, 1);
    if (edge > 0.76) {
      const k = (edge - 0.76) / 0.24;
      y *= Math.sqrt(Math.max(0.14, 1 - 0.84 * k * k));
    }
    pos.setXYZ(i, x, y + H / 2 + 0.115 * Math.pow(z / hz, 2), z);
  }
  geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color, roughness: 0.42 }));
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

function buildToyRider(P: PlayerConfig) {
  const riderPivot = new THREE.Group();
  riderPivot.position.set(0, 0.26, -0.05);
  const panda = P.species === 'panda';
  const M = (c: number, r = 0.52) => new THREE.MeshStandardMaterial({ color: c, roughness: r });
  const furCol = P.key === 'yier' ? 0xf6f4ef : P.key === 'bubu' ? 0x9e6839 : P.body;
  const darkCol = panda ? (P.key === 'yier' ? 0x2a1d17 : P.ear) : 0x2a1a14;
  const furM = M(furCol, 0.58);
  const darkM = M(darkCol, 0.42);
  const legM = M(panda ? darkCol : furCol, 0.58);

  const raw = [
    [0.15, 0.19],
    [0.175, 0.196],
    [0.196, 0.212],
    [0.218, 0.232],
    [0.233, 0.258],
    [0.243, 0.288],
    [0.245, 0.32],
    [0.24, 0.4],
    [0.228, 0.5],
    [0.19, 0.585],
    [0.14, 0.63],
    [0.08, 0.665],
    [0.035, 0.68],
    [0, 0.683],
  ].map((p) => new THREE.Vector2(p[0], p[1]));

  const pts = new THREE.SplineCurve(raw)
    .getPoints(48)
    .map((p) => new THREE.Vector2(Math.max(0, p.x), p.y));
  const headGeo = new THREE.LatheGeometry(pts, 72, Math.PI, Math.PI * 2);
  const pos = headGeo.attributes.position;
  const vv = new THREE.Vector3();

  for (let i = 0; i < pos.count; i++) {
    vv.fromBufferAttribute(pos, i);
    const r = Math.sqrt(vv.x * vv.x + vv.z * vv.z) || 1;
    const f = vv.z / r;
    const band =
      THREE.MathUtils.smoothstep(vv.y, 0.215, 0.24) *
      (1 - THREE.MathUtils.smoothstep(vv.y, 0.285, 0.315));
    const bx = 0.98 + 0.02 * band;
    const bzBand = 1.028 + 0.022 * f;
    const bz = 1 + (bzBand - 1) * band;
    pos.setXYZ(i, vv.x * 1.12 * bx, 0.19 + (vv.y - 0.19) * 0.87, vv.z * 0.95 * bz);
  }
  headGeo.computeVertexNormals();

  const headPivot = new THREE.Group();
  headPivot.position.set(0, 0.25, 0);
  const headWrap = new THREE.Group();
  headWrap.position.set(0, -0.2, 0);
  headWrap.scale.setScalar(1.16);
  headPivot.add(headWrap);
  const head = new THREE.Mesh(headGeo, furM);
  head.castShadow = true;
  head.receiveShadow = true;
  headWrap.add(head);

  const spl = new THREE.SplineCurve(raw).getPoints(360);
  const radiusAt = (y: number) => {
    for (let i = 0; i < spl.length - 1; i++) {
      if (
        (spl[i].y <= y && y <= spl[i + 1].y) ||
        (spl[i].y >= y && y >= spl[i + 1].y)
      ) {
        const k = (y - spl[i].y) / (spl[i + 1].y - spl[i].y || 1e-6);
        return spl[i].x + (spl[i + 1].x - spl[i].x) * k;
      }
    }
    return 0;
  };
  const surfPt = (ang: number, hy: number, embed: number) => {
    const py = 0.19 + (hy - 0.19) / 0.87;
    const r = radiusAt(py);
    const f = Math.cos(ang);
    const band =
      THREE.MathUtils.smoothstep(py, 0.215, 0.24) *
      (1 - THREE.MathUtils.smoothstep(py, 0.285, 0.315));
    const bzBand = 1.028 + 0.022 * f;
    const bz = 1 + (bzBand - 1) * band;
    const Rx = r * 1.12 * (0.98 + 0.02 * band);
    const Rz = r * 0.95 * bz;
    return {
      x: Rx * Math.sin(ang) * (1 - embed / Rx),
      z: Rz * Math.cos(ang) * (1 - embed / Rz),
    };
  };

  for (const s of [-1, 1]) {
    const ear = new THREE.Mesh(
      new THREE.SphereGeometry(0.052, 18, 14),
      panda ? darkM : furM,
    );
    ear.scale.set(1.06, 0.96, 0.78);
    ear.position.set((panda ? 0.172 : 0.158) * s, panda ? 0.568 : 0.578, -0.01);
    ear.rotation.z = -s * (panda ? 0.42 : 0.35);
    headWrap.add(ear);
    if (!panda) {
      const inner = new THREE.Mesh(new THREE.SphereGeometry(0.032, 14, 10), darkM);
      inner.scale.set(1, 0.92, 0.45);
      inner.position.set(0, -0.002, 0.039);
      ear.add(inner);
    }
  }
  const normalEyes: THREE.Mesh[] = [];
  const happyEyes: THREE.Mesh[] = [];
  for (const s of [-1, 1]) {
    const th = 0.385 * s;
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.023, 18, 14), darkM);
    eye.scale.set(1, 1, 0.45);
    const ep = surfPt(th, 0.322, 0.002);
    eye.position.set(ep.x, 0.322, ep.z);
    eye.rotation.y = th;
    headWrap.add(eye);
    normalEyes.push(eye);

    if (panda) {
      const hPts = [
        new THREE.Vector3(surfPt(th - 0.11, 0.315, -0.002).x, 0.315, surfPt(th - 0.11, 0.315, -0.002).z),
        new THREE.Vector3(surfPt(th, 0.338, -0.0025).x, 0.338, surfPt(th, 0.338, -0.0025).z),
        new THREE.Vector3(surfPt(th + 0.11, 0.315, -0.002).x, 0.315, surfPt(th + 0.11, 0.315, -0.002).z),
      ];
      const hEye = new THREE.Mesh(
        new THREE.TubeGeometry(new THREE.CatmullRomCurve3(hPts), 16, 0.0055, 8, false),
        darkM,
      );
      hEye.visible = false;
      headWrap.add(hEye);
      happyEyes.push(hEye);
    }
  }
  const blushCol = panda
    ? P.key === 'yier'
      ? 0xf2937e
      : P.blush
    : P.key === 'bubu'
      ? 0xeab832
      : P.blush;
  const blushM = M(blushCol, 0.72);
  const blushMeshes: THREE.Mesh[] = [];
  for (const s of [-1, 1]) {
    const tb = 0.63 * s;
    const blush = new THREE.Mesh(new THREE.SphereGeometry(0.048, 20, 14), blushM);
    blush.scale.set(1.04, 1.0, 0.24);
    const bp = surfPt(tb, 0.258, 0.004);
    blush.position.set(bp.x, 0.258, bp.z);
    blush.rotation.y = tb;
    blush.rotation.x = (surfPt(tb, 0.3, 0).z - surfPt(tb, 0.22, 0).z) / 0.08;
    headWrap.add(blush);
    blushMeshes.push(blush);
  }
  let mouthClosed: THREE.Mesh | null = null;
  let mouthOpen: THREE.Group | null = null;
  if (panda) {
    const mz = surfPt(0, 0.308, 0).z;
    // 常态 ω 小嘴
    const wPts = [
      new THREE.Vector3(-0.024, 0.314, surfPt(-0.06, 0.314, 0).z + 0.003),
      new THREE.Vector3(-0.011, 0.305, surfPt(-0.03, 0.305, 0).z + 0.003),
      new THREE.Vector3(0, 0.313, surfPt(0, 0.313, 0).z + 0.003),
      new THREE.Vector3(0.011, 0.305, surfPt(0.03, 0.305, 0).z + 0.003),
      new THREE.Vector3(0.024, 0.314, surfPt(0.06, 0.314, 0).z + 0.003),
    ];
    mouthClosed = new THREE.Mesh(
      new THREE.TubeGeometry(new THREE.CatmullRomCurve3(wPts), 18, 0.005, 8, false),
      darkM,
    );
    headWrap.add(mouthClosed);

    // 3D 张嘴立体口腔结构（深色立体口腔内壁 + 上唇轮廓 + 可活动下颌 + 3D 舌头）
    mouthOpen = new THREE.Group();
    mouthOpen.position.set(0, 0.306, mz + 0.002);

    const cavityMat = M(0x22100b, 0.85);
    const cavity = new THREE.Mesh(new THREE.SphereGeometry(0.032, 18, 14), cavityMat);
    cavity.scale.set(1.02, 1.18, 0.68);
    cavity.position.set(0, -0.004, -0.004);
    mouthOpen.add(cavity);

    const upperLip = new THREE.Mesh(
      new THREE.TorusGeometry(0.028, 0.007, 10, 24, Math.PI),
      darkM,
    );
    upperLip.scale.set(1.04, 0.88, 0.9);
    upperLip.position.set(0, 0.006, 0.004);
    mouthOpen.add(upperLip);

    const jawPivot = new THREE.Group();
    jawPivot.position.set(0, 0.004, -0.008);

    const lowerRim = new THREE.Mesh(
      new THREE.TorusGeometry(0.028, 0.0072, 10, 24, Math.PI),
      darkM,
    );
    lowerRim.rotation.z = Math.PI;
    lowerRim.scale.set(1.02, 1.12, 0.95);
    lowerRim.position.set(0, -0.006, 0.013);
    jawPivot.add(lowerRim);

    const lowerChin = new THREE.Mesh(new THREE.SphereGeometry(0.027, 16, 12), furM);
    lowerChin.scale.set(1.06, 0.62, 0.72);
    lowerChin.position.set(0, -0.026, 0.014);
    jawPivot.add(lowerChin);

    const tongue = new THREE.Mesh(
      new THREE.SphereGeometry(0.021, 16, 12),
      M(0xf2798b, 0.52),
    );
    tongue.scale.set(0.92, 0.65, 1.15);
    tongue.position.set(0, -0.016, 0.014);
    jawPivot.add(tongue);

    mouthOpen.add(jawPivot);
    mouthOpen.userData.jawPivot = jawPivot;
    mouthOpen.visible = false;
    headWrap.add(mouthOpen);
  } else {
    const mPts = [
      new THREE.Vector3(-0.026, 0.314, surfPt(-0.06, 0.314, 0).z + 0.003),
      new THREE.Vector3(0, 0.31, surfPt(0, 0.31, 0).z + 0.003),
      new THREE.Vector3(0.026, 0.314, surfPt(0.06, 0.314, 0).z + 0.003),
    ];
    headWrap.add(
      new THREE.Mesh(
        new THREE.TubeGeometry(new THREE.CatmullRomCurve3(mPts), 12, 0.0065, 8, false),
        darkM,
      ),
    );
  }
  riderPivot.add(headPivot);

  const torso = new THREE.Mesh(new THREE.SphereGeometry(0.162, 22, 16), furM);
  torso.scale.set(1.02, 1.0, 0.95);
  torso.position.set(0, 0.16, -0.03);
  torso.castShadow = true;
  riderPivot.add(torso);
  if (panda) {
    const collar = new THREE.Mesh(new THREE.TorusGeometry(0.138, 0.022, 12, 28), darkM);
    collar.rotation.x = Math.PI / 2;
    collar.position.set(0, 0.27, -0.01);
    riderPivot.add(collar);
  }
  const gripY = panda ? 0.13 : 0.16;
  const gripZ = panda ? 0.17 : 0.18;
  let restArmGroup: THREE.Group | null = null;
  let eatArmPivot: THREE.Group | null = null;
  let cakeGroup: THREE.Group | null = null;
  let cakeSlice1: THREE.Group | null = null;
  let cakeSlice2: THREE.Group | null = null;

  for (const s of [-1, 1]) {
    const a = new THREE.Vector3(0.135 * s, 0.22, -0.01);
    const b = new THREE.Vector3(0.205 * s, gripY, gripZ);
    if (panda && s === 1) {
      // 常态握把右手
      const restGrp = new THREE.Group();
      const mid = a.clone().add(b).multiplyScalar(0.5);
      const dir = b.clone().sub(a).normalize();
      const rArm = new THREE.Mesh(
        new THREE.CylinderGeometry(0.044, 0.052, a.distanceTo(b), 12),
        furM,
      );
      rArm.position.copy(mid);
      rArm.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
      rArm.castShadow = true;
      restGrp.add(rArm);
      const rPaw = new THREE.Mesh(new THREE.SphereGeometry(0.052, 14, 12), furM);
      rPaw.position.copy(b);
      rPaw.castShadow = true;
      restGrp.add(rPaw);
      riderPivot.add(restGrp);
      restArmGroup = restGrp;

      // 吃蛋糕专用抬起手臂（YXZ旋转顺序，可准确从脸侧送入嘴口中心）
      const armPivot = new THREE.Group();
      armPivot.position.copy(a);
      armPivot.rotation.order = 'YXZ';
      armPivot.visible = false;
      const eatTarget = new THREE.Vector3(0.145, 0.04, 0.27);
      const eatMid = eatTarget.clone().multiplyScalar(0.5);
      const eatDir = eatTarget.clone().normalize();
      const eArm = new THREE.Mesh(
        new THREE.CylinderGeometry(0.044, 0.052, eatTarget.length(), 12),
        furM,
      );
      eArm.position.copy(eatMid);
      eArm.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), eatDir);
      eArm.castShadow = true;
      armPivot.add(eArm);

      const ePaw = new THREE.Mesh(new THREE.SphereGeometry(0.052, 14, 12), furM);
      ePaw.position.copy(eatTarget);
      ePaw.castShadow = true;
      armPivot.add(ePaw);

      // 图2款草莓小蛋糕（分成 3 瓣 120° 扇形，分 3 口吃掉且每口都有实心切面）
      const cake = new THREE.Group();
      cake.position.set(eatTarget.x, eatTarget.y + 0.088, eatTarget.z + 0.01);
      cake.scale.setScalar(1.45);
      cake.visible = true;

      const spongeM = new THREE.MeshStandardMaterial({ color: 0xfbe288, roughness: 0.65, side: THREE.DoubleSide });
      const creamM = new THREE.MeshStandardMaterial({ color: 0xfffdf8, roughness: 0.45, side: THREE.DoubleSide });
      const berryM = M(0xe63544, 0.35);
      const leafM = M(0x4ba648, 0.55);

      const slice1 = new THREE.Group();
      const slice2 = new THREE.Group();
      const slice3 = new THREE.Group();
      const segAngle = (Math.PI * 2) / 3;

      const addCutFace = (grp: THREE.Group, angle: number) => {
        const panel = new THREE.Group();
        panel.rotation.y = angle;
        const cSponge = new THREE.Mesh(new THREE.PlaneGeometry(0.06, 0.064), spongeM);
        cSponge.rotation.y = Math.PI / 2;
        cSponge.position.set(0, 0, 0.03);
        panel.add(cSponge);
        const cMid = new THREE.Mesh(new THREE.PlaneGeometry(0.062, 0.014), creamM);
        cMid.rotation.y = Math.PI / 2;
        cMid.position.set(0, 0, 0.031);
        panel.add(cMid);
        const cTop = new THREE.Mesh(new THREE.PlaneGeometry(0.063, 0.018), creamM);
        cTop.rotation.y = Math.PI / 2;
        cTop.position.set(0, 0.036, 0.031);
        panel.add(cTop);
        grp.add(panel);
      };

      const addWedge = (grp: THREE.Group, thetaStart: number) => {
        const sponge = new THREE.Mesh(
          new THREE.CylinderGeometry(0.062, 0.058, 0.064, 12, 1, false, thetaStart, segAngle),
          spongeM,
        );
        grp.add(sponge);
        const midCream = new THREE.Mesh(
          new THREE.CylinderGeometry(0.0635, 0.0635, 0.014, 12, 1, false, thetaStart, segAngle),
          creamM,
        );
        grp.add(midCream);
        const topCream = new THREE.Mesh(
          new THREE.CylinderGeometry(0.064, 0.065, 0.018, 12, 1, false, thetaStart, segAngle),
          creamM,
        );
        topCream.position.y = 0.036;
        grp.add(topCream);
        addCutFace(grp, thetaStart);
        addCutFace(grp, thetaStart + segAngle);
      };

      addWedge(slice1, 0);
      addWedge(slice2, segAngle);
      addWedge(slice3, segAngle * 2);

      // 波浪奶油花边球（平均分配到 3 瓣）
      for (let k = 0; k < 9; k++) {
        const ang = (k / 9) * Math.PI * 2 + 0.15;
        const dollop = new THREE.Mesh(new THREE.SphereGeometry(0.016, 10, 8), creamM);
        dollop.position.set(Math.sin(ang) * 0.056, 0.032, Math.cos(ang) * 0.056);
        if (k < 3) slice1.add(dollop);
        else if (k < 6) slice2.add(dollop);
        else slice3.add(dollop);
      }

      // 顶部红草莓放在最后一口 (slice3) 上
      const berry = new THREE.Mesh(new THREE.SphereGeometry(0.024, 14, 12), berryM);
      berry.scale.set(0.95, 1.15, 0.95);
      berry.position.set(0, 0.064, 0);
      slice3.add(berry);

      const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.014, 0.012, 5), leafM);
      leaf.position.set(0, 0.088, 0);
      leaf.rotation.x = Math.PI;
      slice3.add(leaf);

      cake.add(slice1);
      cake.add(slice2);
      cake.add(slice3);
      armPivot.add(cake);

      riderPivot.add(armPivot);
      eatArmPivot = armPivot;
      cakeGroup = cake;
      cakeSlice1 = slice1;
      cakeSlice2 = slice2;
    } else {
      const mid = a.clone().add(b).multiplyScalar(0.5);
      const dir = b.clone().sub(a).normalize();
      const arm = new THREE.Mesh(
        new THREE.CylinderGeometry(0.044, 0.052, a.distanceTo(b), 12),
        furM,
      );
      arm.position.copy(mid);
      arm.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
      arm.castShadow = true;
      riderPivot.add(arm);
      const paw = new THREE.Mesh(new THREE.SphereGeometry(0.052, 14, 12), furM);
      paw.position.copy(b);
      paw.castShadow = true;
      riderPivot.add(paw);
    }
  }
  for (const s of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.SphereGeometry(0.068, 16, 12), legM);
    leg.scale.set(0.85, 0.82, 1.28);
    leg.position.set(0.185 * s, -0.03, 0.1);
    leg.rotation.y = s * 0.25;
    leg.castShadow = true;
    riderPivot.add(leg);
  }
  return {
    riderPivot,
    headPivot,
    restArmGroup,
    eatArmPivot,
    cakeGroup,
    cakeSlice1,
    cakeSlice2,
    mouthClosed,
    mouthOpen,
    jawPivot: mouthOpen ? (mouthOpen.userData.jawPivot as THREE.Group) : null,
    blushMeshes,
    normalEyes,
    happyEyes,
  };
}

export function buildAncientWorld(
  scene: THREE.Scene,
  players: PlayerConfig[],
  anisotropy: number,
): WorldRefs {
  const slotPlayer = (j: number) => players.find((P) => P.slotId === j);

  const addBox = (
    x: number,
    z: number,
    w: number,
    h: number,
    d: number,
    color: number,
    y: number,
  ) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color));
    m.position.set(x, y, z);
    m.receiveShadow = true;
    scene.add(m);
    return m;
  };

  const batchStaticGroup = (group: THREE.Object3D, shadowMaxRadius?: number) => {
    group.updateMatrixWorld(true);
    const buckets = new Map<
      string,
      { mat: THREE.Material; castShadow: boolean; receiveShadow: boolean; geos: THREE.BufferGeometry[] }
    >();
    const toRemove: THREE.Mesh[] = [];
    const tmpPos = new THREE.Vector3();
    const skipSubtree = (obj: THREE.Object3D): boolean => {
      let cur: THREE.Object3D | null = obj;
      while (cur && cur !== group) {
        if (cur.userData.dynamic) return true;
        cur = cur.parent;
      }
      return false;
    };
    group.traverse((obj) => {
      if (!(obj instanceof THREE.Mesh) || obj instanceof THREE.InstancedMesh) return;
      if (skipSubtree(obj)) return;
      if (Array.isArray(obj.material)) return;
      const m = obj.material;
      if (!m) return;
      let cast = obj.castShadow;
      if (cast && shadowMaxRadius !== undefined) {
        obj.getWorldPosition(tmpPos);
        if (Math.hypot(tmpPos.x, tmpPos.z) > shadowMaxRadius) cast = false;
      }
      const recv = obj.receiveShadow;
      const key = `${m.uuid}|${cast ? 1 : 0}|${recv ? 1 : 0}`;
      let b = buckets.get(key);
      if (!b) {
        b = { mat: m, castShadow: cast, receiveShadow: recv, geos: [] };
        buckets.set(key, b);
      }
      const g = obj.geometry.index ? obj.geometry.toNonIndexed() : obj.geometry.clone();
      g.applyMatrix4(obj.matrixWorld);
      b.geos.push(g);
      toRemove.push(obj);
    });
    toRemove.forEach((m) => m.parent?.remove(m));
    buckets.forEach((b) => {
      if (b.geos.length === 0) return;
      const allHaveUv = b.geos.every((g) => !!g.getAttribute('uv'));
      if (!allHaveUv) {
        b.geos.forEach((g) => g.deleteAttribute('uv'));
      }
      const merged = mergeGeometries(b.geos, false);
      b.geos.forEach((g) => g.dispose());
      if (!merged) return;
      const mesh = new THREE.Mesh(merged, b.mat);
      mesh.castShadow = b.castShadow;
      mesh.receiveShadow = b.receiveShadow;
      group.add(mesh);
    });
  };

  /* ================= 1. 地形草地与护城河 ================= */
  const WATER_Y = -0.69;
  const grassTex = createGrassTexture(anisotropy);
  const shoreEarthTex = createShoreEarthTexture(anisotropy);
  const hillH = (x: number, z: number) => {
    const r = Math.hypot(x, z);
    const th = Math.atan2(z, x);
    const outerEdge = moatOuterR(th);
    if (r < outerEdge + 0.52) {
      const bankT = THREE.MathUtils.smoothstep(r, outerEdge - 0.55, outerEdge + 0.52);
      return THREE.MathUtils.lerp(-1.18, -0.66, bankT);
    }
    if (r < 22.2) return -0.66;
    const f = THREE.MathUtils.smoothstep(r, 22.2, 45.5);
    const n =
      Math.sin(x * 0.14) * Math.cos(z * 0.14) * 0.85 +
      Math.sin(x * 0.27 + z * 0.2) * 0.45;
    return -0.66 + f * (0.62 + Math.max(0, n) * 1.25);
  };
  {
    const radii = [
      0, 12, 15, 16.5, 18.2, 19.2, 19.8, 20.3, 20.7, 21.1, 21.5, 21.9, 22.3, 22.8, 23.6, 24.8, 26.4,
      28.4, 30.8, 33.6, 37.0, 41.0, 45.5, 50.5, 56.0,
    ];
    const RINGS = radii.length - 1;
    const SEGS = 128;
    const verts: number[] = [];
    const uvs: number[] = [];
    const cols: number[] = [];
    const idx: number[] = [];
    const cMeadow = new THREE.Color(0xf2faec);
    const cMoss = new THREE.Color(0xd1ebc0);
    const cPath = new THREE.Color(0xd5cbb4);
    const cHill = new THREE.Color(0xbce0ae);
    const tmp = new THREE.Color();

    for (let i = 0; i <= RINGS; i++) {
      const rad = radii[i];
      for (let j = 0; j <= SEGS; j++) {
        const th = (j / SEGS) * Math.PI * 2;
        const x = Math.cos(th) * rad;
        const z = Math.sin(th) * rad;
        const y = hillH(x, z);
        verts.push(x, y, z);
        uvs.push(x / 8, z / 8);
        const mossWave = 0.5 + 0.5 * Math.sin(x * 0.24) * Math.cos(z * 0.24);
        const onPath = rad > 21.0 && rad < 40 && Math.min(Math.abs(x), Math.abs(z)) < 0.92;
        tmp.copy(cMeadow).lerp(cMoss, mossWave * 0.45);
        if (rad > 21.6) tmp.lerp(cHill, THREE.MathUtils.smoothstep(rad, 21.6, 49.5) * 0.52);
        if (onPath) {
          const edge =
            1 - THREE.MathUtils.smoothstep(Math.min(Math.abs(x), Math.abs(z)), 0.42, 0.92);
          tmp.lerp(cPath, edge * 0.82);
        }
        cols.push(tmp.r, tmp.g, tmp.b);
      }
    }
    for (let i = 0; i < RINGS; i++) {
      for (let j = 0; j < SEGS; j++) {
        const a = i * (SEGS + 1) + j;
        const b = a + SEGS + 1;
        const c = a + 1;
        const d = b + 1;
        idx.push(a, c, b, b, c, d);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    const meadowMat = new THREE.MeshStandardMaterial({
      map: grassTex,
      vertexColors: true,
      roughness: 0.96,
    });
    meadowMat.onBeforeCompile = (shader) => {
      shader.uniforms.uEarthMap = { value: shoreEarthTex };
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vMeadowWorldPos;')
        .replace(
          '#include <begin_vertex>',
          '#include <begin_vertex>\nvMeadowWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;',
        );
      shader.fragmentShader = shader.fragmentShader
        .replace(
          '#include <common>',
          '#include <common>\nuniform sampler2D uEarthMap;\nvarying vec3 vMeadowWorldPos;',
        )
        .replace(
          '#include <color_fragment>',
          `#include <color_fragment>
          float mRad = length(vMeadowWorldPos.xz);
          float mTh = atan(vMeadowWorldPos.z, vMeadowWorldPos.x);
          float mOuterEdge = 20.42 + 0.62 * sin(4.0 * mTh + 0.7) + 0.34 * sin(8.0 * mTh + 2.1);
          float mNoise = 0.09 * sin(mTh * 11.0 + 0.5) + 0.06 * cos(mTh * 19.0 - 1.1) + 0.03 * sin(vMeadowWorldPos.x * 2.3 + vMeadowWorldPos.z * 1.9);
          float mDist = mRad - mOuterEdge;
          float mGrassMask = smoothstep(0.44, 0.88, mDist + mNoise);
          vec4 mEarth = texture2D(uEarthMap, vMeadowWorldPos.xz * 0.36);
          vec3 mSoftEarth = mix(mEarth.rgb, vec3(0.46, 0.44, 0.36), 0.48);
          float mWet = 1.0 - smoothstep(0.24, 0.56, mDist + mNoise * 0.3);
          mSoftEarth *= mix(1.0, 0.82, mWet);
          diffuseColor.rgb = mix(mSoftEarth, diffuseColor.rgb, mGrassMask);
          `,
        );
    };
    const meadow = new THREE.Mesh(g, meadowMat);
    meadow.receiveShadow = true;
    scene.add(meadow);
  }

  const waterUniforms = { uTime: { value: 0 }, uWaveAmp: { value: 1 } };

  // 凹槽式天然卵石河床 + 水底阳光焦散光斑
  {
    const riverbedTex = createRiverbedTexture(anisotropy);
    riverbedTex.repeat.set(8, 1.35);
    const RAD = 14;
    const ANG = 160;
    const pos: number[] = [];
    const uvs: number[] = [];
    const idx: number[] = [];
    for (let i = 0; i <= RAD; i++) {
      const u = i / RAD;
      const bedY = -0.80 - 0.32 * Math.sin(u * Math.PI);
      for (let j = 0; j <= ANG; j++) {
        const th = (j / ANG) * Math.PI * 2;
        const r = THREE.MathUtils.lerp(moatInnerR(th) + 0.18, moatOuterR(th) + 0.34, u);
        pos.push(Math.cos(th) * r, bedY, Math.sin(th) * r);
        uvs.push((j / ANG) * 6, u);
      }
    }
    for (let i = 0; i < RAD; i++) {
      for (let j = 0; j < ANG; j++) {
        const a = i * (ANG + 1) + j;
        const b = a + ANG + 1;
        const c = a + 1;
        const d = b + 1;
        idx.push(a, c, b, b, c, d);
      }
    }
    const bedGeo = new THREE.BufferGeometry();
    bedGeo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    bedGeo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    bedGeo.setIndex(idx);
    bedGeo.computeVertexNormals();
    const bedMat = new THREE.MeshStandardMaterial({ map: riverbedTex, roughness: 0.92 });
    bedMat.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = waterUniforms.uTime;
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec2 vBedUv;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvBedUv = uv;');
      shader.fragmentShader = shader.fragmentShader
        .replace(
          '#include <common>',
          '#include <common>\nuniform float uTime;\nvarying vec2 vBedUv;',
        )
        .replace(
          '#include <color_fragment>',
          `#include <color_fragment>
          float bAng = vBedUv.x * 1.04719755;
          float c1 = sin(bAng * 32.0 - uTime * 2.1 + sin(vBedUv.y * 16.0) * 1.5);
          float c2 = cos(bAng * 46.0 - uTime * 2.7 - sin(vBedUv.y * 22.0 + uTime * 1.3) * 1.6);
          float c3 = sin((bAng * 22.0 + vBedUv.y * 18.0) - uTime * 1.6);
          float caustic = pow(max(0.0001, clamp(1.0 - abs(c1 + c2 * 0.8 + c3 * 0.5) * 0.48, 0.0, 1.0)), 3.2);
          diffuseColor.rgb += vec3(0.14, 0.22, 0.18) * caustic * (0.42 + 0.58 * sin(vBedUv.y * 3.14159265));
          `,
        );
    };
    const bed = new THREE.Mesh(bedGeo, bedMat);
    bed.receiveShadow = false;
    scene.add(bed);
  }

  const moatTex = createMoatTexture(anisotropy);
  const waterNormalTex = createWaterNormalTexture(anisotropy);
  waterNormalTex.repeat.set(7, 2.8);
  const waterMesh = (() => {
    const RAD = 10;
    const ANG = 96;
    const pos: number[] = [];
    const uvs: number[] = [];
    const cols: number[] = [];
    const idx: number[] = [];
    const cEdge = new THREE.Color(0xc2f6ed);
    const cDeep = new THREE.Color(0x45afc2);
    const tmp = new THREE.Color();

    for (let i = 0; i <= RAD; i++) {
      const u = i / RAD;
      tmp.copy(cEdge).lerp(cDeep, Math.sin(u * Math.PI));
      for (let j = 0; j <= ANG; j++) {
        const th = (j / ANG) * Math.PI * 2;
        const r = THREE.MathUtils.lerp(moatInnerR(th) + 0.14, moatOuterR(th) + 0.42, u);
        pos.push(Math.cos(th) * r, WATER_Y, Math.sin(th) * r);
        uvs.push((j / ANG) * 6, u);
        cols.push(tmp.r, tmp.g, tmp.b);
      }
    }
    for (let i = 0; i < RAD; i++) {
      for (let j = 0; j < ANG; j++) {
        const a = i * (ANG + 1) + j;
        const b = a + ANG + 1;
        const c = a + 1;
        const d = b + 1;
        idx.push(a, c, b, b, c, d);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    const waterMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: moatTex,
      normalMap: waterNormalTex,
      normalScale: new THREE.Vector2(0.28, 0.28),
      vertexColors: true,
      roughness: 0.26,
      metalness: 0.06,
      envMapIntensity: 0.32,
      transparent: true,
      opacity: 0.78,
      depthWrite: false,
    });
    waterMat.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = waterUniforms.uTime;
      shader.uniforms.uWaveAmp = waterUniforms.uWaveAmp;
      shader.vertexShader = shader.vertexShader
        .replace(
          '#include <common>',
          `#include <common>
          uniform float uTime;
          uniform float uWaveAmp;
          varying vec2 vMoatUv;
          varying vec3 vWaterWorldPos;
          varying vec3 vRadView;
          varying vec3 vTanView;`,
        )
        .replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>
          vMoatUv = uv;
          float angW = atan(transformed.z, transformed.x);
          float envW = sin(clamp(uv.y, 0.0, 1.0) * 3.14159265);
          transformed.y += envW * uWaveAmp * (
            sin(angW * 10.0 - uTime * 1.9) * 0.009 +
            sin(angW * 18.0 - uTime * 2.6 + uv.y * 5.0) * 0.005 +
            cos(transformed.x * 0.55 + transformed.z * 0.45 - uTime * 1.4) * 0.003
          );
          vec3 wPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
          vWaterWorldPos = wPos;
          vec3 rDir = normalize(vec3(wPos.x, 0.0, wPos.z));
          vec3 tDir = vec3(-rDir.z, 0.0, rDir.x);
          vRadView = (viewMatrix * vec4(rDir, 0.0)).xyz;
          vTanView = (viewMatrix * vec4(tDir, 0.0)).xyz;`,
        );
      shader.fragmentShader = shader.fragmentShader
        .replace(
          '#include <common>',
          `#include <common>
          uniform float uTime;
          varying vec2 vMoatUv;
          varying vec3 vWaterWorldPos;
          varying vec3 vRadView;
          varying vec3 vTanView;`,
        )
        .replace(
          '#include <normal_fragment_maps>',
          `#include <normal_fragment_maps>
          float wAng = vMoatUv.x * 1.04719755;
          float wAcross = vMoatUv.y;
          float w1 = sin(wAng * 18.0 - uTime * 2.4 + sin(wAcross * 9.42477) * 1.5);
          float w2 = cos(wAng * 31.0 - uTime * 3.3 - wAcross * 18.84955);
          float w3 = sin(wAng * 39.0 - uTime * 3.2 + wAcross * 20.0);
          float wCross = cos(wAcross * 18.0 + uTime * 1.7 + wAng * 7.0);
          normal = normalize(
            normal +
            vTanView * (w1 * 0.075 + w2 * 0.055 + w3 * 0.025) +
            vRadView * (wCross * 0.05 + w2 * 0.035)
          );`,
        )
        .replace(
          '#include <clearcoat_normal_fragment_maps>',
          `#include <clearcoat_normal_fragment_maps>
          #ifdef USE_CLEARCOAT
            clearcoatNormal = normal;
          #endif`,
        )
        .replace(
          '#include <color_fragment>',
          `#include <color_fragment>
          float cAng = vMoatUv.x * 1.04719755;
          float cAcross = vMoatUv.y;
          float shoreDist = min(cAcross, 1.0 - cAcross);

          // 浅岸边缘自然羽化融入湿润泥沙，河心保持通透以便清晰看到水下锦鲤
          float centerDepth = sin(clamp(cAcross, 0.0, 1.0) * 3.14159265);
          float shoreFeather = smoothstep(0.0, 0.042, shoreDist);
          diffuseColor.a = mix(0.24, 0.54, pow(max(centerDepth, 0.0001), 0.72)) * shoreFeather;

          // 顺流蜿蜒流动的水流丝带
          float s1 = sin(cAng * 14.0 - uTime * 1.9 + sin(cAcross * 9.42477) * 1.5);
          float s2 = sin(cAng * 24.0 - uTime * 2.5 - cAcross * 15.70796 + cos(cAng * 6.0) * 1.1);
          float s3 = cos(cAng * 32.0 - uTime * 3.1 + sin(cAcross * 12.56637) * 1.2);
          float ribbon = smoothstep(0.54, 0.96, 0.45 * s1 + 0.35 * s2 + 0.25 * s3);
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.76, 0.95, 0.96), ribbon * 0.20 * centerDepth);

          // 偶尔随日光与波峰摇曳出现的波光粼粼
          float sunBurst = smoothstep(0.18, 0.82, 0.5 + 0.5 * sin(uTime * 0.55 + sin(cAng * 3.0) * 1.6))
                         * smoothstep(0.05, 0.75, 0.5 + 0.5 * cos(cAng * 5.0 - uTime * 0.42 + cAcross * 2.5));
          float glintA = sin(cAng * 28.0 - uTime * 2.8 + cAcross * 18.0);
          float glintB = cos(cAng * 37.0 - uTime * 3.5 - cAcross * 23.0);
          float glint = pow(max(0.0001, clamp(glintA * glintB, 0.0, 1.0)), 6.0);
          diffuseColor.rgb += vec3(0.92, 0.98, 0.90) * glint * sunBurst * 0.58 * centerDepth;

          // 极轻菲涅尔天光过渡（不遮挡水底与游鱼）
          vec3 viewDirW = normalize(cameraPosition - vWaterWorldPos);
          float fresnel = pow(max(0.0001, 1.0 - clamp(abs(viewDirW.y), 0.0, 1.0)), 3.2);
          float waveMod = 0.72 + 0.28 * s1;
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.80, 0.93, 0.95), fresnel * 0.11 * waveMod);

          // 浅水拍岸微沫（略退入水面内侧，避免死白边缘）
          float shoreWave = 0.010 * sin(cAng * 24.0 + uTime * 2.1) + 0.005 * cos(cAng * 36.0 - uTime * 2.7);
          float innerLap = smoothstep(0.018, 0.044 + shoreWave, shoreDist) * (1.0 - smoothstep(0.044 + shoreWave, 0.095 + shoreWave, shoreDist));
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.90, 0.97, 0.98), innerLap * 0.28);
          diffuseColor.a = max(diffuseColor.a, innerLap * 0.36);

          // 四座石桥墩旁顺流扩散的绕流涟漪
          float pierProx = pow(max(0.0001, cos(4.0 * cAng)), 12.0);
          float pierBand = 1.0 - smoothstep(0.04, 0.28, shoreDist);
          float pierRipple = 0.5 + 0.5 * sin(abs(sin(4.0 * cAng)) * 42.0 - uTime * 4.5);
          float pierWake = pierProx * pierBand * smoothstep(0.45, 0.95, pierRipple);
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.95, 0.99, 1.0), pierWake * 0.55);`,
        );
    };
    const m = new THREE.Mesh(g, waterMat);
    m.receiveShadow = true;
    m.renderOrder = 1;
    scene.add(m);
    m.userData.basePos = Float32Array.from(pos);
    return m;
  })();

  const willowDrapeList: WillowAnim[] = [];
  const lotusList: LotusAnim[] = [];

  {
    const rockGeo = new THREE.DodecahedronGeometry(0.22, 1);
    const rockMats = [mat(0x7c8589, 0.88), mat(0x90979a, 0.85), mat(0x6c7a72, 0.9)];
    // 河岸鹅卵石沿外岸草坡与内岸青砖石阶自然散布，不悬浮入水
    for (let i = 0; i < 104; i++) {
      const th = Math.random() * Math.PI * 2;
      const isInnerDeck = i % 3 === 0;
      const r = isInnerDeck
        ? moatInnerR(th) - rnd(0.32, 1.15)
        : moatOuterR(th) + rnd(0.54, 1.32);
      const x = Math.cos(th) * r;
      const z = Math.sin(th) * r;
      if (Math.min(Math.abs(x), Math.abs(z)) < 1.85) continue;
      if (isInnerDeck && Math.max(Math.abs(x), Math.abs(z)) < 10.05) continue;
      const rock = new THREE.Mesh(rockGeo, rockMats[i % 3]);
      const sc = rnd(0.56, 1.2);
      rock.scale.set(sc * rnd(0.85, 1.2), sc * rnd(0.4, 0.6), sc * rnd(0.85, 1.2));
      const baseY = isInnerDeck ? -0.644 : hillH(x, z) - 0.055;
      rock.position.set(x, baseY, z);
      rock.rotation.set(rnd(-0.14, 0.14), rnd(0, 6), rnd(-0.14, 0.14));
      rock.receiveShadow = true;
      scene.add(rock);
    }

    const padGeo = new THREE.CircleGeometry(0.21, 18, 0.22, Math.PI * 2 - 0.44);
    const padMat = new THREE.MeshStandardMaterial({
      color: 0x4b934c,
      roughness: 0.65,
      side: THREE.DoubleSide,
    });
    const lotusPetalGeo = new THREE.ConeGeometry(0.048, 0.125, 5);
    const lotusMats = [mat(0xffadc4, 0.5), mat(0xfff5f8, 0.5)];
    const lotusCoreMat = mat(0xf5cb42, 0.5);

    for (let i = 0; i < 34; i++) {
      const th = Math.random() * Math.PI * 2;
      const sideSign = i % 2 === 0 ? 1 : -1;
      const r = moatChannelR(th, sideSign * rnd(1.0, 1.75), 0.85);
      const x = Math.cos(th) * r;
      const z = Math.sin(th) * r;
      if (Math.min(Math.abs(x), Math.abs(z)) < 1.45) continue;
      const grp = new THREE.Group();
      const pad = new THREE.Mesh(padGeo, padMat);
      pad.rotation.x = -Math.PI / 2;
      pad.rotation.z = rnd(0, 6);
      pad.scale.setScalar(rnd(0.75, 1.2));
      pad.receiveShadow = true;
      grp.add(pad);
      if (i % 3 === 0) {
        const fl = new THREE.Group();
        const pm = lotusMats[i % 2];
        for (let k = 0; k < 7; k++) {
          const pa = (k / 7) * Math.PI * 2;
          const pt = new THREE.Mesh(lotusPetalGeo, pm);
          pt.position.set(Math.cos(pa) * 0.052, 0.036, Math.sin(pa) * 0.052);
          pt.rotation.set(Math.sin(pa) * 0.55, 0, -Math.cos(pa) * 0.55);
          fl.add(pt);
        }
        const core = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 8), lotusCoreMat);
        core.position.y = 0.04;
        fl.add(core);
        grp.add(fl);
      }
      grp.position.set(x, WATER_Y + 0.008, z);
      scene.add(grp);
      lotusList.push({ g: grp, phase: rnd(0, 6) });
    }
  }

  // 石拱桥（匹配缩小 15% 后的护城河跨度）
  {
    const stoneMat = mat(0xa0acb0, 0.78);
    const stoneDark = mat(0x7c888d, 0.82);
    const capGold = mat(0xd4b678, 0.55);
    const bridge = new THREE.Group();
    const NS = 15;
    const LEN = 7.6;
    const H = 0.88;
    const GY = -0.64;
    const HT = 0.09;

    for (let i = 0; i < NS; i++) {
      const um = (i + 0.5) / NS;
      const x = (um - 0.5) * LEN;
      const y = GY + HT + H * Math.sin(Math.PI * um);
      const slope = ((H * Math.PI) / LEN) * Math.cos(Math.PI * um);
      const seg = new THREE.Mesh(new THREE.BoxGeometry(LEN / NS + 0.08, 0.18, 1.92), stoneMat);
      seg.position.set(x, y, 0);
      seg.rotation.z = Math.atan(slope);
      seg.castShadow = true;
      seg.receiveShadow = true;
      bridge.add(seg);
      for (const sz of [-1, 1]) {
        const panel = new THREE.Mesh(
          new THREE.BoxGeometry(LEN / NS + 0.08, 0.2, 0.07),
          stoneDark,
        );
        panel.position.set(x, y + 0.14, 0.9 * sz);
        panel.rotation.z = Math.atan(slope);
        bridge.add(panel);
        const rail = new THREE.Mesh(
          new THREE.BoxGeometry(LEN / NS + 0.08, 0.08, 0.11),
          stoneDark,
        );
        rail.position.set(x, y + 0.28, 0.9 * sz);
        rail.rotation.z = Math.atan(slope);
        bridge.add(rail);
        if (i % 2 === 0) {
          const post = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.36, 0.12), stoneDark);
          post.position.set(x, y + 0.18, 0.9 * sz);
          post.rotation.z = Math.atan(slope);
          bridge.add(post);
          const bud = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 8), capGold);
          bud.position.set(x, y + 0.39, 0.9 * sz);
          bridge.add(bud);
        }
      }
    }
    for (const ex of [-1, 1]) {
      const pier = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.78, 1.98), stoneDark);
      pier.position.set(ex * (LEN / 2 - 0.3), GY - 0.24, 0);
      bridge.add(pier);
      for (const sz of [-1, 1]) {
        const cap = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.62, 0.2), stoneDark);
        cap.position.set(ex * (LEN / 2), GY + 0.3, 0.94 * sz);
        cap.castShadow = true;
        bridge.add(cap);
        const finial = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), capGold);
        finial.position.set(ex * (LEN / 2), GY + 0.65, 0.94 * sz);
        bridge.add(finial);
      }
    }
    for (let q = 0; q < 4; q++) {
      const b = bridge.clone();
      b.rotation.y = (q * Math.PI) / 2;
      const a = (q * Math.PI) / 2;
      b.position.set(Math.cos(a) * 18.4, 0, Math.sin(a) * 18.4);
      scene.add(b);
    }
  }

  // 内岸青砖步道 + 石质路缘压顶 + 阶梯式青石驳岸护坡（带涉水湿石暗化）
  {
    const bankTex = createBrickBankTexture(anisotropy);
    const SEGS = 128;
    const pos: number[] = [];
    const uvs: number[] = [];
    const idx: number[] = [];
    for (let j = 0; j <= SEGS; j++) {
      const th = (j / SEGS) * Math.PI * 2;
      const c = Math.cos(th);
      const s = Math.sin(th);
      const rIn = 8.2;
      const rOut = moatInnerR(th) - 0.08;
      pos.push(c * rIn, -0.63, s * rIn, c * rOut, -0.63, s * rOut);
      uvs.push(c * rIn / 32 + 0.5, s * rIn / 32 + 0.5, c * rOut / 32 + 0.5, s * rOut / 32 + 0.5);
    }
    for (let j = 0; j < SEGS; j++) {
      const a = j * 2;
      const b = a + 1;
      const c = a + 2;
      const d = a + 3;
      idx.push(a, c, b, b, c, d);
    }
    const bg = new THREE.BufferGeometry();
    bg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    bg.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    bg.setIndex(idx);
    bg.computeVertexNormals();
    const bank = new THREE.Mesh(
      bg,
      new THREE.MeshStandardMaterial({ map: bankTex, roughness: 0.88 }),
    );
    bank.receiveShadow = true;
    scene.add(bank);

    // 青砖外沿厚实条石路缘压顶
    const curbPos: number[] = [];
    const curbUvs: number[] = [];
    const curbIdx: number[] = [];
    for (let j = 0; j <= SEGS; j++) {
      const th = (j / SEGS) * Math.PI * 2;
      const c = Math.cos(th);
      const s = Math.sin(th);
      const r0 = moatInnerR(th) - 0.14;
      const r1 = moatInnerR(th) + 0.02;
      const r2 = moatInnerR(th) + 0.04;
      curbPos.push(
        c * r0, -0.616, s * r0,
        c * r1, -0.616, s * r1,
        c * r2, -0.642, s * r2,
      );
      curbUvs.push((j / SEGS) * 24, 0, (j / SEGS) * 24, 0.7, (j / SEGS) * 24, 1);
    }
    for (let j = 0; j < SEGS; j++) {
      for (let k = 0; k < 2; k++) {
        const a = j * 3 + k;
        const b = a + 1;
        const c = a + 3;
        const d = b + 3;
        curbIdx.push(a, c, b, b, c, d);
      }
    }
    const cg = new THREE.BufferGeometry();
    cg.setAttribute('position', new THREE.Float32BufferAttribute(curbPos, 3));
    cg.setAttribute('uv', new THREE.Float32BufferAttribute(curbUvs, 2));
    cg.setIndex(curbIdx);
    cg.computeVertexNormals();
    const innerCurb = new THREE.Mesh(
      cg,
      new THREE.MeshStandardMaterial({ map: bankTex, color: 0xdfe5e8, roughness: 0.84 }),
    );
    innerCurb.receiveShadow = true;
    scene.add(innerCurb);

    // 青石斜坡砌筑驳岸（从条石路缘外斜入水底，靠水线呈深润青苔湿石色）
    const REV_RINGS = 4;
    const REV_ANG = 160;
    const sPos: number[] = [];
    const sUvs: number[] = [];
    const sCols: number[] = [];
    const sIdx: number[] = [];
    const cDryStone = new THREE.Color(0xcfd7db);
    const cWetStone = new THREE.Color(0x637375);
    const sTmp = new THREE.Color();
    for (let i = 0; i <= REV_RINGS; i++) {
      const u = i / REV_RINGS;
      const wetT = THREE.MathUtils.smoothstep(u, 0.25, 0.75);
      sTmp.copy(cDryStone).lerp(cWetStone, wetT);
      for (let j = 0; j <= REV_ANG; j++) {
        const th = (j / REV_ANG) * Math.PI * 2;
        const c = Math.cos(th);
        const s = Math.sin(th);
        const dr = THREE.MathUtils.lerp(-0.02, 0.44, u);
        const y = THREE.MathUtils.lerp(-0.634, -0.88, Math.pow(u, 1.15));
        const r = moatInnerR(th) + dr;
        sPos.push(c * r, y, s * r);
        sUvs.push((j / REV_ANG) * 20, u * 1.4);
        sCols.push(sTmp.r, sTmp.g, sTmp.b);
      }
    }
    for (let i = 0; i < REV_RINGS; i++) {
      for (let j = 0; j < REV_ANG; j++) {
        const a = i * (REV_ANG + 1) + j;
        const b = a + REV_ANG + 1;
        const c = a + 1;
        const d = b + 1;
        sIdx.push(a, c, b, b, c, d);
      }
    }
    const sg = new THREE.BufferGeometry();
    sg.setAttribute('position', new THREE.Float32BufferAttribute(sPos, 3));
    sg.setAttribute('uv', new THREE.Float32BufferAttribute(sUvs, 2));
    sg.setAttribute('color', new THREE.Float32BufferAttribute(sCols, 3));
    sg.setIndex(sIdx);
    sg.computeVertexNormals();
    const innerStoneBank = new THREE.Mesh(
      sg,
      new THREE.MeshStandardMaterial({
        map: bankTex,
        vertexColors: true,
        roughness: 0.85,
      }),
    );
    innerStoneBank.receiveShadow = true;
    scene.add(innerStoneBank);
  }

  /* ================= 2. 森林、垂柳、樱花、灌木、野花与小蘑菇 ================= */
  const petals: PetalAnim[] = [];
  const lanternMats: THREE.MeshStandardMaterial[] = [];
  let heartTreeNightData: WorldRefs['heartTreeNight'];
  {
    const barkMat = mat(0x6e4b35, 0.9);
    const darkBarkMat = mat(0x523626, 0.92);
    const crownGeo = new THREE.IcosahedronGeometry(1, 2);
    const trunkGeo = new THREE.CylinderGeometry(0.11, 0.22, 1.15, 10);
    const branchGeo = new THREE.CylinderGeometry(0.045, 0.085, 0.72, 7);
    const rootButtressGeo = new THREE.ConeGeometry(0.13, 0.38, 6);
    const pineTierGeo = new THREE.ConeGeometry(1, 1.15, 9);
    const pineTipGeo = new THREE.ConeGeometry(0.55, 0.95, 9);
    const bushPuffGeo = new THREE.IcosahedronGeometry(0.36, 1);
    const forestStoneGeo = new THREE.DodecahedronGeometry(0.34, 1);

    const greens = [
      mat(0x46883c, 0.82),
      mat(0x5aa048, 0.8),
      mat(0x3a7335, 0.84),
      mat(0x70b455, 0.78),
    ];
    const pineMats = [
      mat(0x2f683a, 0.84),
      mat(0x3b7843, 0.82),
      mat(0x4a894f, 0.8),
      mat(0x5d9d5b, 0.78),
    ];
    const sakuras = [mat(0xffb7cc, 0.76), mat(0xffcadb, 0.74), mat(0xff9ebb, 0.78)];
    const warms = [mat(0xd96b43, 0.8), mat(0xe3963e, 0.78), mat(0xe8c448, 0.76)];
    const bushMats = [mat(0x4b8f42, 0.84), mat(0x5fa44f, 0.82)];
    const mossStoneMat = mat(0x6d7c70, 0.88);
    const willowCrownMat = mat(0x6fb04e, 0.8);
    const willowLeafMat = new THREE.MeshStandardMaterial({
      color: 0x7ec05a,
      roughness: 0.8,
      side: THREE.DoubleSide,
    });
    const treeGroup = new THREE.Group();

    const moatSafeOuter = (x: number, z: number, pad = 1.45) => {
      const r = Math.hypot(x, z);
      const th = Math.atan2(z, x);
      return r >= moatOuterR(th) + pad;
    };
    const moatSafeInner = (x: number, z: number, pad = 1.2) => {
      const r = Math.hypot(x, z);
      const th = Math.atan2(z, x);
      return (
        r <= moatInnerR(th) - pad &&
        Math.max(Math.abs(x), Math.abs(z)) >= 10.35 &&
        Math.min(Math.abs(x), Math.abs(z)) >= 2.25 &&
        !(Math.abs(x) > 8.8 && Math.abs(z) > 8.8)
      );
    };

    const addFluffyTree = (x: number, z: number, s: number, mats = greens, yBase?: number) => {
      const g = new THREE.Group();
      const tr = new THREE.Mesh(trunkGeo, barkMat);
      tr.position.y = 0.56;
      tr.rotation.z = 0.04;
      tr.castShadow = true;
      tr.receiveShadow = true;
      g.add(tr);

      for (let b = 0; b < 3; b++) {
        const ba = (b / 3) * Math.PI * 2 + 0.4;
        const rt = new THREE.Mesh(rootButtressGeo, barkMat);
        rt.position.set(Math.cos(ba) * 0.14, 0.14, Math.sin(ba) * 0.14);
        rt.rotation.set(Math.sin(ba) * 0.42, 0, -Math.cos(ba) * 0.42);
        g.add(rt);

        const br = new THREE.Mesh(branchGeo, barkMat);
        br.position.set(Math.cos(ba) * 0.2, 1.05, Math.sin(ba) * 0.2);
        br.rotation.set(Math.sin(ba) * 0.55, 0, -Math.cos(ba) * 0.55);
        g.add(br);
      }

      const lobes: [number, number, number, number, number, number][] = [
        [0, 1.56, 0, 0.72, 0.58, 0.72],
        [0.44, 1.38, 0.18, 0.52, 0.44, 0.52],
        [-0.42, 1.4, -0.18, 0.54, 0.45, 0.54],
        [0.14, 1.36, -0.42, 0.5, 0.42, 0.5],
        [-0.16, 1.42, 0.42, 0.48, 0.42, 0.48],
        [0.2, 1.82, 0.14, 0.44, 0.38, 0.44],
        [-0.14, 1.9, -0.1, 0.48, 0.4, 0.48],
      ];
      lobes.forEach(([px, py, pz, sx, sy, sz], i) => {
        const m = new THREE.Mesh(crownGeo, mats[i % mats.length]);
        m.position.set(px, py, pz);
        m.scale.set(sx, sy, sz);
        m.rotation.set(i * 0.5, i * 1.1, i * 0.3);
        m.castShadow = true;
        m.receiveShadow = true;
        g.add(m);
      });

      g.position.set(x, yBase ?? hillH(x, z) - 0.04, z);
      g.scale.setScalar(s);
      g.rotation.y = rnd(0, 6.28);
      treeGroup.add(g);
    };

    const addPineTree = (x: number, z: number, s: number) => {
      const g = new THREE.Group();
      const tr = new THREE.Mesh(trunkGeo, darkBarkMat);
      tr.position.y = 0.54;
      tr.castShadow = true;
      g.add(tr);
      for (let b = 0; b < 3; b++) {
        const ba = (b / 3) * Math.PI * 2;
        const rt = new THREE.Mesh(rootButtressGeo, darkBarkMat);
        rt.position.set(Math.cos(ba) * 0.13, 0.13, Math.sin(ba) * 0.13);
        rt.rotation.set(Math.sin(ba) * 0.38, 0, -Math.cos(ba) * 0.38);
        g.add(rt);
      }

      const tiers = [
        { y: 1.05, r: 0.92, h: 0.95 },
        { y: 1.56, r: 0.76, h: 0.88 },
        { y: 2.04, r: 0.58, h: 0.82 },
        { y: 2.46, r: 0.4, h: 0.72 },
      ];
      tiers.forEach((tier, i) => {
        const c = new THREE.Mesh(
          i === tiers.length - 1 ? pineTipGeo : pineTierGeo,
          pineMats[i % pineMats.length],
        );
        c.position.y = tier.y;
        c.scale.set(
          i === tiers.length - 1 ? tier.r * 1.8 : tier.r,
          tier.h,
          i === tiers.length - 1 ? tier.r * 1.8 : tier.r,
        );
        c.rotation.set((i % 2 === 0 ? 1 : -1) * 0.03, i * 0.68, (i % 2 === 0 ? -1 : 1) * 0.025);
        c.castShadow = true;
        c.receiveShadow = true;
        g.add(c);
      });

      g.position.set(x, hillH(x, z) - 0.04, z);
      g.scale.setScalar(s);
      g.rotation.y = rnd(0, 6.28);
      treeGroup.add(g);
    };

    const addBush = (x: number, z: number, s: number) => {
      const g = new THREE.Group();
      const puffs: [number, number, number, number][] = [
        [0, 0.24, 0, 1.05],
        [0.24, 0.18, 0.14, 0.78],
        [-0.22, 0.2, -0.12, 0.82],
        [0.05, 0.22, -0.24, 0.72],
      ];
      puffs.forEach(([px, py, pz, ps], i) => {
        const m = new THREE.Mesh(bushPuffGeo, bushMats[i % bushMats.length]);
        m.position.set(px, py, pz);
        m.scale.set(ps, ps * 0.78, ps);
        m.rotation.y = i * 1.3;
        m.receiveShadow = true;
        g.add(m);
      });
      g.position.set(x, hillH(x, z) - 0.03, z);
      g.scale.setScalar(s);
      treeGroup.add(g);
    };

    // 垂柳全部移至护城河外岸草坡（不再长进水里），并采用双枝干 + 多簇树冠 + 细长垂柳丝
    const drapeGeo = new THREE.CylinderGeometry(0.022, 0.006, 0.94, 5);
    const willowAngles = [0.44, 1.14, 1.98, 2.72, 3.58, 4.3, 5.14, 5.86];
    willowAngles.forEach((ang, idx) => {
      const r = moatOuterR(ang) + 1.55;
      const wx = Math.cos(ang) * r;
      const wz = Math.sin(ang) * r;
      const g = new THREE.Group();

      const tr = new THREE.Mesh(trunkGeo, barkMat);
      tr.position.set(0.06, 0.64, 0);
      tr.scale.set(1.1, 1.25, 1.1);
      tr.rotation.z = 0.16;
      tr.castShadow = true;
      g.add(tr);

      const tr2 = new THREE.Mesh(branchGeo, barkMat);
      tr2.position.set(-0.14, 1.08, 0.08);
      tr2.rotation.set(0.18, 0, 0.45);
      g.add(tr2);

      const crownLobes: [number, number, number, number, number][] = [
        [-0.08, 1.56, 0, 0.76, 0.56],
        [0.28, 1.44, 0.22, 0.56, 0.44],
        [-0.36, 1.46, -0.18, 0.58, 0.46],
        [0.05, 1.76, -0.1, 0.5, 0.4],
      ];
      crownLobes.forEach(([px, py, pz, rx, ry], cIdx) => {
        const cr = new THREE.Mesh(crownGeo, willowCrownMat);
        cr.position.set(px, py, pz);
        cr.scale.set(rx, ry, rx);
        cr.rotation.y = cIdx * 0.9;
        cr.castShadow = true;
        g.add(cr);
      });

      const drapes = new THREE.Group();
      drapes.position.set(-0.08, 1.44, 0);
      for (let k = 0; k < 20; k++) {
        const ka = (k / 20) * Math.PI * 2;
        const ringR = k % 2 === 0 ? 0.68 : 0.46;
        const lenScale = 0.8 + (k % 3) * 0.16;
        const strip = new THREE.Mesh(drapeGeo, willowLeafMat);
        strip.scale.set(1, lenScale, 1);
        strip.position.set(
          Math.cos(ka) * ringR,
          -0.44 * lenScale,
          Math.sin(ka) * ringR,
        );
        drapes.add(strip);
      }
      g.add(drapes);
      g.position.set(wx, hillH(wx, wz) - 0.04, wz);
      g.scale.setScalar(0.95);
      // 树枝朝护城河方向微倾
      g.rotation.y = -ang + Math.PI;
      treeGroup.add(g);
      drapes.userData.dynamic = true;
      willowDrapeList.push({ g: drapes, phase: idx * 1.3 });
    });

    // 外围郁郁葱葱的森林（严格远离护城河与四条通路）
    for (let i = 0; i < 145; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = rnd(22.1, 42.0);
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r;
      if (!moatSafeOuter(x, z, 1.55) || Math.min(Math.abs(x), Math.abs(z)) < 2.05) {
        i--;
        continue;
      }
      const pick = Math.random();
      if (pick < 0.46) addFluffyTree(x, z, rnd(0.9, 1.55), greens);
      else if (pick < 0.78) addPineTree(x, z, rnd(0.9, 1.55));
      else if (pick < 0.9) addFluffyTree(x, z, rnd(0.85, 1.35), sakuras);
      else addFluffyTree(x, z, rnd(0.85, 1.35), warms);
    }

    // 外林低矮灌木与林间苔石
    for (let i = 0; i < 42; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = rnd(22.0, 37.5);
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r;
      if (!moatSafeOuter(x, z, 1.35) || Math.min(Math.abs(x), Math.abs(z)) < 1.65) continue;
      if (i % 3 === 0) {
        const st = new THREE.Mesh(forestStoneGeo, mossStoneMat);
        st.scale.set(rnd(0.75, 1.35), rnd(0.45, 0.75), rnd(0.75, 1.3));
        st.position.set(x, hillH(x, z) + 0.04, z);
        st.rotation.set(rnd(-0.2, 0.2), rnd(0, 6), rnd(-0.2, 0.2));
        st.receiveShadow = true;
        treeGroup.add(st);
      } else {
        addBush(x, z, rnd(0.8, 1.35));
      }
    }

    // 护城河与城墙之间的内岸点缀樱花、秋叶与翠绿小树（均匀分布于四边八段内岸，严格不落入水中）
    const innerTreePts: [number, number][] = [];
    for (let q = 0; q < 4; q++) {
      const ca = Math.cos((q * Math.PI) / 2);
      const sa = Math.sin((q * Math.PI) / 2);
      for (const side of [-1, 1]) {
        let placed = 0;
        for (let attempt = 0; attempt < 40 && placed < 3; attempt++) {
          const along = side * rnd(2.2, 7.2);
          const out = rnd(10.45, 12.1);
          const x = along * ca - out * sa;
          const z = along * sa + out * ca;
          if (!moatSafeInner(x, z, 0.85)) continue;
          if (innerTreePts.some(([px, pz]) => Math.hypot(x - px, z - pz) < 1.35)) continue;
          innerTreePts.push([x, z]);
          const palette =
            (q + placed) % 3 === 0 ? sakuras : (q + placed) % 3 === 1 ? warms : greens;
          addFluffyTree(x, z, rnd(0.58, 0.8), palette, -0.63);
          placed++;
        }
      }
    }
    batchStaticGroup(treeGroup, 14.5);
    scene.add(treeGroup);

    const petalDropGeo = new THREE.CircleGeometry(0.055, 6);
    const petalDropMat = new THREE.MeshBasicMaterial({
      color: 0xffc2d6,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.88,
    });
    for (let i = 0; i < 28; i++) {
      const m = new THREE.Mesh(petalDropGeo, petalDropMat);
      const a = rnd(0, 6.28);
      const r = rnd(11.5, 27.5);
      m.position.set(Math.cos(a) * r, rnd(0.5, 4.2), Math.sin(a) * r);
      scene.add(m);
      petals.push({ m, speed: rnd(0.35, 0.65), sway: rnd(0, 6), baseR: r, ang: a });
    }

    const bladeGeo = new THREE.ConeGeometry(0.04, 1, 4);
    const tuftMats = [mat(0x4b8f42, 0.85), mat(0x63aa53, 0.85), mat(0x3d7b38, 0.85)];
    const pGeo = new THREE.SphereGeometry(0.09, 10, 8);
    const cGeo = new THREE.SphereGeometry(0.055, 10, 8);
    const stGeo = new THREE.CylinderGeometry(0.016, 0.024, 0.38, 6);
    const stMat = mat(0x4b8a3f, 0.8);
    const cMats = [mat(0xf5cf47, 0.6), mat(0xebae34, 0.6)];
    const pMats = [
      mat(0xff8eb3, 0.65),
      mat(0xffe066, 0.65),
      mat(0xfffaf0, 0.65),
      mat(0xb8a4ff, 0.65),
      mat(0xff9f7a, 0.65),
    ];

    for (let i = 0; i < 95; i++) {
      const a = rnd(0, 6.28);
      const r = rnd(21.7, 39.0);
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r;
      if (!moatSafeOuter(x, z, 0.9) || Math.min(Math.abs(x), Math.abs(z)) < 1.2) continue;
      const g = new THREE.Group();
      for (let k = 0; k < 6; k++) {
        const b = new THREE.Mesh(bladeGeo, tuftMats[(i + k) % 3]);
        const h = rnd(0.42, 0.8);
        const ba = (k / 6) * Math.PI * 2 + rnd(-0.3, 0.3);
        const br = rnd(0, 0.14);
        b.scale.set(1, h, 1);
        b.position.set(Math.cos(ba) * br, 0.45 * h, Math.sin(ba) * br);
        b.rotation.set(rnd(-0.35, 0.35), 0, rnd(-0.35, 0.35));
        g.add(b);
      }
      g.position.set(x, hillH(x, z) - 0.02, z);
      g.scale.setScalar(rnd(0.8, 1.3));
      scene.add(g);
    }

    for (let i = 0; i < 68; i++) {
      const a = rnd(0, 6.28);
      const r = rnd(21.7, 37.5);
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r;
      if (!moatSafeOuter(x, z, 0.9) || Math.min(Math.abs(x), Math.abs(z)) < 1.2) continue;
      const f = new THREE.Group();
      const st = new THREE.Mesh(stGeo, stMat);
      st.position.y = 0.19;
      f.add(st);
      const pm = pMats[i % pMats.length];
      for (let k = 0; k < 5; k++) {
        const pa = (k / 5) * Math.PI * 2;
        const p = new THREE.Mesh(pGeo, pm);
        p.scale.set(1, 0.35, 0.72);
        p.position.set(Math.cos(pa) * 0.1, 0.39, Math.sin(pa) * 0.1);
        p.rotation.set(0, -pa, 0.35);
        f.add(p);
      }
      const core = new THREE.Mesh(cGeo, cMats[i % 2]);
      core.position.y = 0.41;
      f.add(core);
      f.position.set(x, hillH(x, z) - 0.02, z);
      f.scale.setScalar(rnd(0.72, 1.12));
      scene.add(f);
    }

    const mushCapMat = mat(0xe04f47, 0.55);
    const mushStemMat = mat(0xf7efe4, 0.75);
    const mushDotMat = mat(0xffffff, 0.6);
    for (let i = 0; i < 24; i++) {
      const a = rnd(0, 6.28);
      const r = rnd(22.1, 35.5);
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r;
      if (!moatSafeOuter(x, z, 1.1) || Math.min(Math.abs(x), Math.abs(z)) < 1.5) continue;
      const mg = new THREE.Group();
      const st = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.055, 0.18, 10), mushStemMat);
      st.position.y = 0.09;
      mg.add(st);
      const cap = new THREE.Mesh(
        new THREE.SphereGeometry(0.12, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.55),
        mushCapMat,
      );
      cap.position.y = 0.16;
      mg.add(cap);
      for (let d = 0; d < 4; d++) {
        const da = d * 1.57;
        const dot = new THREE.Mesh(new THREE.SphereGeometry(0.022, 6, 6), mushDotMat);
        dot.position.set(Math.cos(da) * 0.07, 0.22, Math.sin(da) * 0.07);
        mg.add(dot);
      }
      mg.position.set(x, hillH(x, z) - 0.02, z);
      mg.scale.setScalar(rnd(0.8, 1.35));
      scene.add(mg);
    }
  }

  /* ================= 3. 古城石台、城墙、四向城门楼 & 角楼 ================= */
  const castleGroup = new THREE.Group();
  const stoneDeckTex = createStoneDeckTexture(anisotropy);
  const brickMat = (rx = 1, ry = 1) => {
    const t = createWallBrickTexture(anisotropy);
    t.repeat.set(rx, ry);
    return new THREE.MeshStandardMaterial({ map: t, roughness: 0.78 });
  };
  const addBrickBox = (
    x: number,
    z: number,
    w: number,
    h: number,
    d: number,
    y: number,
    rx: number,
    ry: number,
  ) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), brickMat(rx, ry));
    m.position.set(x, y, z);
    m.receiveShadow = true;
    m.castShadow = true;
    castleGroup.add(m);
    return m;
  };

  // 扩大内城台面与双层城台基座，使四角角楼与城墙完全稳落石台之内、杜绝悬空
  addBrickBox(0, 0, 19.28, 0.6, 19.28, -0.78, 7.6, 0.3);
  addBrickBox(0, 0, 18.76, 0.56, 18.76, -0.26, 6.6, 0.3);

  const deck = new THREE.Mesh(
    new THREE.BoxGeometry(18.6, 0.06, 18.6),
    new THREE.MeshStandardMaterial({ map: stoneDeckTex, roughness: 0.82 }),
  );
  deck.position.y = 0.05;
  deck.receiveShadow = true;
  castleGroup.add(deck);

  const wallMat = brickMat(4.5, 0.3);
  const merlonGeo = new THREE.BoxGeometry(0.62, 0.15, 0.3);
  const merlonMat = mat(0x8d969c, 0.72);
  for (const sz of [-1, 1]) {
    for (const sx of [-1, 1]) {
      const wh = new THREE.Mesh(new THREE.BoxGeometry(6.88, 0.26, 0.38), wallMat);
      wh.position.set(sx * 4.365, 0.21, sz * 8.38);
      wh.castShadow = true;
      wh.receiveShadow = true;
      castleGroup.add(wh);

      const wv = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.26, 6.88), wallMat);
      wv.position.set(sz * 8.38, 0.21, sx * 4.365);
      wv.castShadow = true;
      wv.receiveShadow = true;
      castleGroup.add(wv);

      for (let i = 0; i < 6; i++) {
        const mh = new THREE.Mesh(merlonGeo, merlonMat);
        mh.position.set(sx * (1.45 + i * 1.2), 0.415, sz * 8.38);
        mh.castShadow = true;
        castleGroup.add(mh);

        const mv = new THREE.Mesh(merlonGeo, merlonMat);
        mv.rotation.y = Math.PI / 2;
        mv.position.set(sz * 8.38, 0.415, sx * (1.45 + i * 1.2));
        mv.castShadow = true;
        castleGroup.add(mv);
      }
    }
  }

  const trimGold = new THREE.MeshStandardMaterial({
    color: 0xd1a836,
    roughness: 0.35,
    metalness: 0.55,
  });
  {
    const pillarMat = mat(0x9a362c, 0.58);
    const bracketMat = mat(0xb85838, 0.62);
    const roofTileMat = mat(0x444f59, 0.52);
    const eaveTrimMat = mat(0x5a6773, 0.58);
    const stoneDrumMat = mat(0xa3acb2, 0.68);
    const plaqueSideMat = mat(0x1e2a35, 0.44);
    const plaqueTex = createGatePlaqueTexture('熊熊坊', anisotropy);
    const plaqueFaceMat = new THREE.MeshStandardMaterial({
      map: plaqueTex,
      emissive: 0xffffff,
      emissiveMap: plaqueTex,
      emissiveIntensity: 0.32,
      roughness: 0.3,
      metalness: 0.12,
    });
    const plaqueMaterials = [
      plaqueSideMat,
      plaqueSideMat,
      plaqueSideMat,
      plaqueSideMat,
      plaqueFaceMat,
      plaqueFaceMat,
    ];
    const lantMat = new THREE.MeshStandardMaterial({
      color: 0xe5442b,
      emissive: 0xb83018,
      emissiveIntensity: 0.78,
      roughness: 0.4,
    });
      lanternMats.push(lantMat);
    // 预先旋转四棱锥使其底边严格平行于 X/Z 轴，避免缩放后旋转产生倾斜菱形畸变
    const hipRoofGeo = new THREE.ConeGeometry(1, 1, 4);
    hipRoofGeo.rotateY(Math.PI / 4);
    const makeHippedRoof = (w: number, h: number, d: number) => {
      const m = new THREE.Mesh(hipRoofGeo, roofTileMat);
      m.scale.set(w / Math.SQRT2, h, d / Math.SQRT2);
      m.castShadow = true;
      m.receiveShadow = true;
      return m;
    };

    for (let q = 0; q < 4; q++) {
      const gate = new THREE.Group();
      for (const sx of [-1, 1]) {
        // 阶梯柱础 + 八角抱鼓石
        const baseStone = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.09, 0.34), merlonMat);
        baseStone.position.set(0.82 * sx, 0.045, 0);
        baseStone.receiveShadow = true;
        gate.add(baseStone);

        const drum = new THREE.Mesh(
          new THREE.CylinderGeometry(0.115, 0.14, 0.08, 8),
          stoneDrumMat,
        );
        drum.position.set(0.82 * sx, 0.13, 0);
        gate.add(drum);

        // 朱红主立柱 + 金色柱箍（加高形成开阔牌坊造型）
        const pil = new THREE.Mesh(
          new THREE.CylinderGeometry(0.084, 0.096, 1.38, 14),
          pillarMat,
        );
        pil.position.set(0.82 * sx, 0.86, 0);
        pil.castShadow = true;
        gate.add(pil);

        for (const cy of [0.19, 1.50]) {
          const collar = new THREE.Mesh(
            new THREE.CylinderGeometry(0.104, 0.104, 0.04, 14),
            trimGold,
          );
          collar.position.set(0.82 * sx, cy, 0);
          gate.add(collar);
        }

        // 挑檐灯笼（外侧挂臂，不挡中央牌匾）
        const hook = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.032, 0.032), pillarMat);
        hook.position.set(0.95 * sx, 1.06, 0);
        gate.add(hook);

        const l = new THREE.Mesh(new THREE.SphereGeometry(0.088, 12, 10), lantMat);
        l.scale.set(1, 0.88, 1);
        l.position.set(1.03 * sx, 0.94, 0);
        gate.add(l);

        for (const ly of [1.02, 0.86]) {
          const cap = new THREE.Mesh(
            new THREE.CylinderGeometry(0.036, 0.036, 0.022, 10),
            trimGold,
          );
          cap.position.set(1.03 * sx, ly, 0);
          gate.add(cap);
        }
        const tassel = new THREE.Mesh(
          new THREE.CylinderGeometry(0.012, 0.022, 0.055, 6),
          trimGold,
        );
        tassel.position.set(1.03 * sx, 0.82, 0);
        gate.add(tassel);
      }

      // 牌坊下额枋与顶枋：中间留出充裕空间嵌入大号无遮挡牌匾
      const lowerBeam = new THREE.Mesh(new THREE.BoxGeometry(1.86, 0.1, 0.16), pillarMat);
      lowerBeam.position.set(0, 0.98, 0);
      lowerBeam.castShadow = true;
      gate.add(lowerBeam);

      const upperBeam = new THREE.Mesh(new THREE.BoxGeometry(1.98, 0.11, 0.18), pillarMat);
      upperBeam.position.set(0, 1.54, 0);
      upperBeam.castShadow = true;
      gate.add(upperBeam);

      for (const bx of [-0.62, 0, 0.62]) {
        const b1 = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.05, 0.24), bracketMat);
        b1.position.set(bx, 1.61, 0);
        gate.add(b1);
      }

      // 大号醒目金边牌匾（加宽加高，且上方无深挑檐遮挡）
      const plaqueFrame = new THREE.Mesh(new THREE.BoxGeometry(1.34, 0.44, 0.24), trimGold);
      plaqueFrame.position.set(0, 1.26, 0);
      gate.add(plaqueFrame);
      const plaqueCore = new THREE.Mesh(new THREE.BoxGeometry(1.24, 0.36, 0.27), plaqueMaterials);
      plaqueCore.position.set(0, 1.26, 0);
      gate.add(plaqueCore);

      // 轻薄牌坊挑檐顶盖（进深收窄至 0.48，俯视视角也绝不遮挡牌匾）
      const lowerSoffit = new THREE.Mesh(new THREE.BoxGeometry(2.14, 0.045, 0.44), eaveTrimMat);
      lowerSoffit.position.set(0, 1.66, 0);
      gate.add(lowerSoffit);

      const lowerRoof = makeHippedRoof(2.22, 0.26, 0.50);
      lowerRoof.position.set(0, 1.81, 0);
      gate.add(lowerRoof);

      for (const sx of [-1, 1]) {
        for (const sz of [-1, 1]) {
          const tip = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.05, 0.08), trimGold);
          tip.position.set(1.09 * sx, 1.69, 0.22 * sz);
          tip.rotation.z = 0.28 * sx;
          gate.add(tip);
        }
      }

      const ridge = new THREE.Mesh(new THREE.BoxGeometry(1.42, 0.065, 0.08), trimGold);
      ridge.position.set(0, 1.95, 0);
      gate.add(ridge);

      for (const sx of [-1, 1]) {
        const chiwen = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.11, 0.09), trimGold);
        chiwen.position.set(0.71 * sx, 2.0, 0);
        chiwen.rotation.z = -0.25 * sx;
        gate.add(chiwen);
      }

      const pearl = new THREE.Mesh(new THREE.SphereGeometry(0.052, 10, 8), trimGold);
      pearl.position.set(0, 2.02, 0);
      gate.add(pearl);

      const a = (q * Math.PI) / 2;
      gate.position.set(Math.sin(a) * 8.38, 0.08, Math.cos(a) * 8.38);
      gate.rotation.y = a;
      castleGroup.add(gate);
    }

    // 为其中三座城门修筑青石台阶与垂带石扶手（随机挑一门暂不放台阶，供后续处理）
    const skipStairGate = (Math.random() * 4) | 0;
    const stairRiserMat = brickMat(1.2, 0.35);
    const stairTreadMat = mat(0xabb5bb, 0.72);
    const stairSideMat = mat(0x889399, 0.78);
    const stairRailMat = mat(0x9ca7ad, 0.72);

    for (let q = 0; q < 4; q++) {
      if (q === skipStairGate) continue;
      const stairGrp = new THREE.Group();
      const baseLocalY = -0.73; // 略低于内岸青砖地面 (-0.71)，严丝合缝接地
      const stepCount = 6; // 顶部齐平踏台 + 5 级下阶
      const totalDrop = 0.71;
      const stepDepth = 0.32;
      const zStart = 0.90; // 紧贴扩大后内城台面外沿 (9.30 - 8.38 = 0.92)

      for (let k = 0; k < stepCount; k++) {
        const yTop = -(k / stepCount) * totalDrop;
        const h = yTop - baseLocalY;
        const zCenter = zStart + (k + 0.5) * stepDepth;

        const riser = new THREE.Mesh(new THREE.BoxGeometry(1.66, h, stepDepth + 0.01), stairRiserMat);
        riser.position.set(0, baseLocalY + h / 2, zCenter);
        riser.castShadow = true;
        riser.receiveShadow = true;
        stairGrp.add(riser);

        const tread = new THREE.Mesh(
          new THREE.BoxGeometry(1.7, 0.032, stepDepth + 0.03),
          stairTreadMat,
        );
        tread.position.set(0, yTop - 0.014, zCenter + 0.01);
        tread.castShadow = true;
        tread.receiveShadow = true;
        stairGrp.add(tread);
      }

      // 两侧垂带石挡墙与望柱圆雕柱头
      const topZ = zStart + stepDepth * 0.5;
      const botZ = zStart + (stepCount - 0.5) * stepDepth;
      const topWallY = 0.14;
      const botWallY = -((stepCount - 1) / stepCount) * totalDrop + 0.14;
      const slopeLen = Math.hypot(botZ - topZ, topWallY - botWallY);
      const slopeAng = Math.atan2(topWallY - botWallY, botZ - topZ);

      for (const sx of [-1, 1]) {
        const cheekX = 0.91 * sx;
        for (let k = 0; k < stepCount; k++) {
          const yTop = -(k / stepCount) * totalDrop + 0.14;
          const h = yTop - baseLocalY;
          const zCenter = zStart + (k + 0.5) * stepDepth;
          const wallSeg = new THREE.Mesh(
            new THREE.BoxGeometry(0.16, h, stepDepth + 0.02),
            stairSideMat,
          );
          wallSeg.position.set(cheekX, baseLocalY + h / 2, zCenter);
          wallSeg.castShadow = true;
          wallSeg.receiveShadow = true;
          stairGrp.add(wallSeg);
        }

        const railCap = new THREE.Mesh(
          new THREE.BoxGeometry(0.19, 0.055, slopeLen + 0.22),
          stairRailMat,
        );
        railCap.position.set(cheekX, (topWallY + botWallY) * 0.5 + 0.02, (topZ + botZ) * 0.5);
        railCap.rotation.x = slopeAng;
        railCap.castShadow = true;
        stairGrp.add(railCap);

        // 上下端望柱与小石球柱头
        for (const [pz, pyTop] of [
          [topZ - 0.04, 0.24],
          [botZ + 0.06, -totalDrop + 0.3],
        ] as const) {
          const ph = pyTop - baseLocalY;
          const post = new THREE.Mesh(new THREE.BoxGeometry(0.2, ph, 0.2), stairRailMat);
          post.position.set(cheekX, baseLocalY + ph / 2, pz);
          post.castShadow = true;
          post.receiveShadow = true;
          stairGrp.add(post);

          const knob = new THREE.Mesh(new THREE.SphereGeometry(0.075, 10, 8), trimGold);
          knob.position.set(cheekX, pyTop + 0.06, pz);
          stairGrp.add(knob);
        }
      }

      const a = (q * Math.PI) / 2;
      stairGrp.position.set(Math.sin(a) * 8.38, 0.08, Math.cos(a) * 8.38);
      stairGrp.rotation.y = a;
      castleGroup.add(stairGrp);
    }

    // 唯一无台阶的城门外：福州古风爱心榕树（短粗古干 + 低矮繁茂立体心形树冠 + 垂须气根 + 54 盏小巧红灯笼 + 防闪烁抬升树池）
  batchStaticGroup(castleGroup);
  scene.add(castleGroup);

    {
      const ha = (skipStairGate * Math.PI) / 2;
      const heartTree = new THREE.Group();

      // 1. 抬升青石树池围边 + 实心隆起培土（严格高于 -0.63 地面，杜绝共面闪烁）
      const curbMat = mat(0xaeb7bd, 0.8);
      const soilMat = mat(0x5c3e26, 0.94);
      const soilRimMat = mat(0x4c321d, 0.95);
      const banyanBarkMat = mat(0x5b3b24, 0.9);
      const aerialRootMat = mat(0x6b4e34, 0.88);

      const planterCurb = new THREE.Mesh(new THREE.TorusGeometry(1.04, 0.115, 14, 36), curbMat);
      planterCurb.rotation.x = Math.PI / 2;
      planterCurb.position.y = 0.055;
      planterCurb.castShadow = true;
      planterCurb.receiveShadow = true;
      heartTree.add(planterCurb);

      // 实心土壤圆台底面沉入 -0.02、顶面抬升至 +0.10，彻底脱离地面 y=0 平面
      const soilCollar = new THREE.Mesh(
        new THREE.CylinderGeometry(0.96, 0.99, 0.12, 28),
        soilRimMat,
      );
      soilCollar.position.y = 0.04;
      soilCollar.receiveShadow = true;
      heartTree.add(soilCollar);

      const soilMound = new THREE.Mesh(
        new THREE.SphereGeometry(0.96, 24, 14, 0, Math.PI * 2, 0, Math.PI * 0.46),
        soilMat,
      );
      soilMound.scale.set(1, 0.16, 1);
      soilMound.position.y = 0.085;
      soilMound.receiveShadow = true;
      heartTree.add(soilMound);

      // 2. 短粗稳健古榕主干与板根（衬托上方高挺饱满的心形树冠）
      const trunk = new THREE.Mesh(
        new THREE.CylinderGeometry(0.27, 0.45, 1.42, 16),
        banyanBarkMat,
      );
      trunk.position.y = 0.81;
      trunk.castShadow = true;
      trunk.receiveShadow = true;
      heartTree.add(trunk);

      for (let i = 0; i < 7; i++) {
        const ra = (i / 7) * Math.PI * 2 + 0.18;
        const root = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.44, 7), banyanBarkMat);
        root.position.set(Math.cos(ra) * 0.38, 0.27, Math.sin(ra) * 0.38);
        root.rotation.set(Math.sin(ra) * 0.58, 0, -Math.cos(ra) * 0.58);
        root.castShadow = true;
        heartTree.add(root);
      }

      for (const sx of [-1, 1]) {
        const limb = new THREE.Mesh(
          new THREE.CylinderGeometry(0.12, 0.2, 0.92, 10),
          banyanBarkMat,
        );
        limb.position.set(0.32 * sx, 1.56, 0);
        limb.rotation.z = -0.58 * sx;
        limb.castShadow = true;
        heartTree.add(limb);
      }
      for (const sz of [-1, 1]) {
        const subLimb = new THREE.Mesh(
          new THREE.CylinderGeometry(0.09, 0.15, 0.72, 8),
          banyanBarkMat,
        );
        subLimb.position.set(0, 1.52, 0.2 * sz);
        subLimb.rotation.x = 0.54 * sz;
        subLimb.castShadow = true;
        heartTree.add(subLimb);
      }

      // 12 缕榕树垂须气根（随高挑心形下缘自然垂落）
      const aerialPts: [number, number, number, number][] = [
        [-1.08, 1.92, 0.2, 0.68],
        [-0.82, 1.66, -0.24, 0.68],
        [-0.54, 1.44, 0.26, 0.54],
        [0.54, 1.46, -0.22, 0.56],
        [0.84, 1.68, 0.22, 0.66],
        [1.1, 1.94, -0.18, 0.66],
        [-1.32, 2.24, -0.12, 0.62],
        [1.32, 2.26, 0.12, 0.62],
        [-0.86, 1.82, 0.42, 0.54],
        [0.86, 1.82, -0.42, 0.54],
        [-0.5, 1.54, -0.44, 0.48],
        [0.5, 1.54, 0.44, 0.48],
      ];
      aerialPts.forEach(([ax, ay, az, len]) => {
        const rootStrand = new THREE.Mesh(
          new THREE.CylinderGeometry(0.013, 0.007, len, 5),
          aerialRootMat,
        );
        rootStrand.position.set(ax, ay - len * 0.5, az);
        heartTree.add(rootStrand);
      });

      // 3. 密密麻麻又平整蓬松的立体大爱心树冠（饱满弧度 + 细密小叶簇铺满正反面与边缘）
      let rngSeed = 73856093;
      const nextRand = () => {
        rngSeed = (rngSeed * 1664525 + 1013904223) >>> 0;
        return rngSeed / 4294967296;
      };

      const heartCenterY = 2.94;
      const heartScaleX = 1.98;
      const heartScaleY = 1.90;
      const heartPos = (t: number, s: number): [number, number, number] => {
        const rawX = heartScaleX * s * Math.pow(Math.sin(t), 3);
        const hy =
          heartCenterY +
          heartScaleY *
            s *
            ((13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)) /
              16);
        const lowFrac = THREE.MathUtils.clamp((heartCenterY + 0.14 - hy) / (heartScaleY * 1.18), 0, 1);
        const sideTuck = 1 - 0.28 * Math.sin(lowFrac * Math.PI * 0.85);
        return [rawX * sideTuck, hy, lowFrac];
      };

      // 内部深绿叶芯填充层（用小叶簇填实中空，不使用平直挤出板，确保全树都是自然树叶）

      // 细密蓬松的榕叶簇 InstancedMesh（550+ 枚小叶簇沿饱满弧面密铺，既有丰富叶感又平整柔和）
      interface LeafTuft {
        x: number;
        y: number;
        z: number;
        sx: number;
        sy: number;
        sz: number;
        rx: number;
        ry: number;
        rz: number;
        colHex: number;
      }
      const tufts: LeafTuft[] = [];
      const leafPalette = [0x1f5623, 0x286729, 0x32772f, 0x3d8836, 0x48963e];

      const pushTuft = (
        x: number,
        y: number,
        z: number,
        sizeBias = 1,
        zFlat = 0.62,
      ) => {
        const heightNorm = THREE.MathUtils.clamp((y - (heartCenterY - 1.85)) / 3.4, 0, 1);
        const shadeIdx = Math.min(
          leafPalette.length - 1,
          Math.max(0, Math.floor(heightNorm * 3.7 + nextRand() * 1.15)),
        );
        const baseR = (0.155 + nextRand() * 0.045) * sizeBias;
        tufts.push({
          x,
          y,
          z,
          sx: baseR * (1.02 + nextRand() * 0.16),
          sy: baseR * (0.94 + nextRand() * 0.14),
          sz: baseR * zFlat,
          rx: (nextRand() - 0.5) * 0.35,
          ry: (nextRand() - 0.5) * 0.45,
          rz: (nextRand() - 0.5) * 0.45,
          colHex: leafPalette[shadeIdx],
        });
      };

      // 1) 外缘一圈蓬松轮廓层（中线 z = 0 与前后肩线）
      for (let i = 0; i < 64; i++) {
        const t = ((i + (nextRand() - 0.5) * 0.18) / 64) * Math.PI * 2;
        const [hx, hy, lowFrac] = heartPos(t, 0.98);
        const isTip = hy < heartCenterY - 1.5;
        const zSpan = (isTip ? 0.14 : 0.28) * (1 - 0.30 * lowFrac);
        for (const zr of [-zSpan, 0, zSpan]) {
          pushTuft(
            hx + (nextRand() - 0.5) * 0.04,
            hy + (nextRand() - 0.5) * 0.04,
            zr,
            (isTip ? 0.78 : 1.02) * (1 - 0.22 * lowFrac),
            0.78,
          );
        }
      }

      // 2) 正反两面密密麻麻、沿饱满弧面整齐修平的蓬松小叶簇
      const cushionRings: { s: number; tCount: number }[] = [
        { s: 0.88, tCount: 54 },
        { s: 0.75, tCount: 44 },
        { s: 0.61, tCount: 36 },
        { s: 0.46, tCount: 26 },
        { s: 0.30, tCount: 16 },
        { s: 0.14, tCount: 8 },
      ];
      for (const ring of cushionRings) {
        for (let i = 0; i < ring.tCount; i++) {
          const t = ((i + (nextRand() - 0.5) * 0.22) / ring.tCount) * Math.PI * 2;
          const [hx, hy, lowFrac] = heartPos(t, ring.s);
          const inCleft = Math.abs(hx) < 0.34 && hy > heartCenterY + 0.28;
          if (inCleft && ring.s > 0.72) continue;
          const isTip = hy < heartCenterY - 1.52;
          const zDome =
            0.84 *
            Math.sqrt(Math.max(0.08, 1 - ring.s * ring.s * 0.86)) *
            (1 - 0.32 * lowFrac);
          const sizeScale = (isTip ? 0.76 : 0.96) * (1 - 0.18 * lowFrac);
          for (const side of [-1, 1]) {
            pushTuft(
              hx + (nextRand() - 0.5) * 0.05,
              hy + (nextRand() - 0.5) * 0.05,
              side * (zDome + (nextRand() - 0.5) * 0.025),
              sizeScale,
              0.56,
            );
          }
          // 内层实体叶芯防透光
          if (ring.s <= 0.78 && i % 2 === 0) {
            pushTuft(hx, hy, 0, sizeScale * 1.35, 1.8);
          }
        }
      }

      const leafGeo = new THREE.IcosahedronGeometry(1, 1);
      const leafMat = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        roughness: 0.80,
        flatShading: false,
      });
      const leafMesh = new THREE.InstancedMesh(leafGeo, leafMat, tufts.length);
      leafMesh.castShadow = true;
      leafMesh.receiveShadow = true;

      const dummy = new THREE.Object3D();
      const tmpCol = new THREE.Color();
      tufts.forEach((tf, idx) => {
        dummy.position.set(tf.x, tf.y, tf.z);
        dummy.rotation.set(tf.rx, tf.ry, tf.rz);
        dummy.scale.set(tf.sx, tf.sy, tf.sz);
        dummy.updateMatrix();
        leafMesh.setMatrixAt(idx, dummy.matrix);
        tmpCol.setHex(tf.colHex);
        leafMesh.setColorAt(idx, tmpCol);
      });
      leafMesh.instanceMatrix.needsUpdate = true;
      if (leafMesh.instanceColor) leafMesh.instanceColor.needsUpdate = true;
      heartTree.add(leafMesh);

      // 4. 沿心形下缘挂满 64 盏呼吸流光灯笼（4 组错峰呼吸 + 外圈暖光晕）
      const treeWaveMats = [0, 1, 2, 3].map(() => {
        const m = new THREE.MeshStandardMaterial({
          color: 0xff4626,
          emissive: 0xff5a1f,
          emissiveIntensity: 1.0,
          roughness: 0.32,
        });
        lanternMats.push(m);
        return m;
      });
      const waveHaloMats = [0, 1, 2, 3].map(() =>
        new THREE.MeshBasicMaterial({
          color: 0xff8547,
          transparent: true,
          opacity: 0,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        }),
      );
      const cordMat = mat(0x52341c, 0.7);
      const lanternBodyGeo = new THREE.SphereGeometry(0.082, 12, 9);
      const lanternHaloGeo = new THREE.SphereGeometry(0.135, 10, 8);
      const lanternCapGeo = new THREE.CylinderGeometry(0.032, 0.032, 0.015, 8);
      const lanternTasselGeo = new THREE.CylinderGeometry(0.012, 0.02, 0.068, 7);

      const lanternSpecs: [number, number, number, number][] = [];
      const zBandBase = [-0.56, -0.34, -0.14, 0.14, 0.34, 0.56];
      for (let i = 0; i < 64; i++) {
        const isLeft = i < 32;
        const idxInSide = isLeft ? i : i - 32;
        const frac = idxInSide / 31;
        const t = isLeft
          ? THREE.MathUtils.lerp(0.46 * Math.PI, 0.84 * Math.PI, frac)
          : THREE.MathUtils.lerp(1.16 * Math.PI, 1.54 * Math.PI, frac);
        const widthRatio = Math.max(0.42, Math.abs(Math.sin(t)));
        let zBand = zBandBase[(i * 5 + (isLeft ? 0 : 3)) % zBandBase.length] * widthRatio;
        const radialScale = THREE.MathUtils.clamp(1.03 - Math.abs(zBand) * 0.28, 0.8, 1.0);
        const [lx, canopyY, lowFrac] = heartPos(t, radialScale);
        zBand *= 1 - 0.32 * lowFrac;
        const radialXZ = Math.hypot(lx, zBand);
        if (radialXZ < 0.56) {
          const minZ = Math.sqrt(Math.max(0, 0.56 * 0.56 - lx * lx));
          zBand = (zBand >= 0 ? 1 : -1) * Math.max(Math.abs(zBand), minZ);
        }
        const dropTier = (i % 3) * 0.075;
        const cordLen = 0.28 + dropTier;
        const ly = canopyY - 0.26 - dropTier;
        lanternSpecs.push([lx, ly, zBand, cordLen]);
      }

      const lanternsGroup = new THREE.Group();
      lanternSpecs.forEach(([lx, ly, lz, cordLen], lIdx) => {
        const lg = new THREE.Group();
        const cord = new THREE.Mesh(
          new THREE.CylinderGeometry(0.005, 0.005, cordLen, 5),
          cordMat,
        );
        cord.position.y = cordLen * 0.5;
        lg.add(cord);

        const body = new THREE.Mesh(lanternBodyGeo, treeWaveMats[lIdx % 4]);
        body.scale.set(1, 0.84, 1);
        body.position.y = -0.052;
        lg.add(body);

        const halo = new THREE.Mesh(lanternHaloGeo, waveHaloMats[lIdx % 4]);
        halo.position.y = -0.052;
        lg.add(halo);

        for (const cy of [-0.002, -0.104]) {
          const cap = new THREE.Mesh(lanternCapGeo, trimGold);
          cap.position.y = cy;
          lg.add(cap);
        }

        const tassel = new THREE.Mesh(lanternTasselGeo, trimGold);
        tassel.position.y = -0.142;
        lg.add(tassel);

        lg.position.set(lx, ly, lz);
        lanternsGroup.add(lg);
      });
      batchStaticGroup(lanternsGroup);
      heartTree.add(lanternsGroup);



      // 4b. 树上悬挂 18 枚红色许愿牌（夜晚泛暖红微光，随风轻摆）
      const plaqueCanvas = document.createElement('canvas');
      plaqueCanvas.width = 128;
      plaqueCanvas.height = 160;
      const pqg = plaqueCanvas.getContext('2d')!;
      pqg.fillStyle = '#c81e1e';
      pqg.fillRect(0, 0, 128, 160);
      pqg.strokeStyle = '#ffd166';
      pqg.lineWidth = 8;
      pqg.strokeRect(10, 10, 108, 140);
      pqg.fillStyle = '#ffd166';
      pqg.font = 'bold 54px serif';
      pqg.textAlign = 'center';
      pqg.textBaseline = 'middle';
      pqg.fillText('愿', 64, 72);
      pqg.beginPath();
      pqg.moveTo(64, 128);
      pqg.bezierCurveTo(48, 118, 48, 104, 57, 103);
      pqg.bezierCurveTo(62, 102, 64, 108, 64, 108);
      pqg.bezierCurveTo(64, 108, 66, 102, 71, 103);
      pqg.bezierCurveTo(80, 104, 80, 118, 64, 128);
      pqg.fill();
      const plaqueTex = new THREE.CanvasTexture(plaqueCanvas);
      const plaqueMat = new THREE.MeshStandardMaterial({
        map: plaqueTex,
        emissive: 0xa81c1c,
        emissiveMap: plaqueTex,
        emissiveIntensity: 0.2,
        roughness: 0.45,
      });
      const plaqueGeo = new THREE.BoxGeometry(0.115, 0.15, 0.018);
      const wishingPlaques: { group: THREE.Group; phase: number; baseRotZ: number }[] = [];
      for (let i = 0; i < 18; i++) {
        const side = i % 2 === 0 ? -1 : 1;
        const frac = Math.floor(i / 2) / 8;
        const t = side < 0
          ? THREE.MathUtils.lerp(0.32 * Math.PI, 0.80 * Math.PI, frac)
          : THREE.MathUtils.lerp(1.20 * Math.PI, 1.68 * Math.PI, frac);
        const [px, py, lowFrac] = heartPos(t, 0.96);
        const pz = (i % 3 === 0 ? -0.52 : i % 3 === 1 ? 0.52 : -0.34) * (1 - 0.3 * lowFrac);
        const pg = new THREE.Group();
        const cordLen = 0.22 + (i % 3) * 0.05;
        const cord = new THREE.Mesh(
          new THREE.CylinderGeometry(0.004, 0.004, cordLen, 4),
          trimGold,
        );
        cord.position.y = cordLen * 0.5;
        pg.add(cord);

        const board = new THREE.Mesh(plaqueGeo, plaqueMat);
        board.position.y = -0.075;
        pg.add(board);

        const cap = new THREE.Mesh(new THREE.BoxGeometry(0.125, 0.022, 0.024), trimGold);
        cap.position.y = -0.004;
        pg.add(cap);

        const tassel = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.015, 0.06, 6), trimGold);
        tassel.position.y = -0.18;
        pg.add(tassel);

        pg.position.set(px, py - cordLen * 0.65, pz);
        const baseRotZ = (nextRand() - 0.5) * 0.12;
        pg.rotation.z = baseRotZ;
        heartTree.add(pg);
        wishingPlaques.push({ group: pg, phase: nextRand() * Math.PI * 2, baseRotZ });
      }

      // 4c. 树池底座透明隐藏式暖金灯带（白天完全隐形透明，仅夜晚亮起柔光）
      const baseStripMat = new THREE.MeshBasicMaterial({
        color: 0xffd584,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      const baseStripMesh = new THREE.Mesh(
        new THREE.TorusGeometry(1.155, 0.024, 12, 64),
        baseStripMat,
      );
      baseStripMesh.rotation.x = Math.PI / 2;
      baseStripMesh.position.y = 0.026;
      baseStripMesh.visible = false;
      heartTree.add(baseStripMesh);

      const sgCanvas = document.createElement('canvas');
      sgCanvas.width = sgCanvas.height = 128;
      const sgg = sgCanvas.getContext('2d')!;
      const sgGrad = sgg.createRadialGradient(64, 64, 40, 64, 64, 63);
      sgGrad.addColorStop(0, 'rgba(255, 200, 110, 0)');
      sgGrad.addColorStop(0.45, 'rgba(255, 210, 125, 0.85)');
      sgGrad.addColorStop(0.72, 'rgba(255, 180, 85, 0.45)');
      sgGrad.addColorStop(1, 'rgba(255, 180, 85, 0)');
      sgg.fillStyle = sgGrad;
      sgg.fillRect(0, 0, 128, 128);
      const sgTex = new THREE.CanvasTexture(sgCanvas);
      const baseStripGlowMat = new THREE.MeshBasicMaterial({
        map: sgTex,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      const baseStripGlowMesh = new THREE.Mesh(new THREE.PlaneGeometry(2.85, 2.85), baseStripGlowMat);
      baseStripGlowMesh.rotation.x = -Math.PI / 2;
      baseStripGlowMesh.position.y = 0.022;
      baseStripGlowMesh.visible = false;
      heartTree.add(baseStripGlowMesh);


      // 5. 沿爱心树边缘围成一圈的粉金小爱心萤火粒子（64 颗，清晰勾勒树冠爱心轮廓）
      const hCount = 64;
      const hPos = new Float32Array(hCount * 3);
      const hBase: { x: number; y: number; z: number; phase: number; speed: number }[] = [];
      for (let i = 0; i < hCount; i++) {
        const t = (i / hCount) * Math.PI * 2;
        const edgeScale = 1.07 + (i % 3) * 0.045;
        const [hx, hy, lowFrac] = heartPos(t, edgeScale);
        const zLayer = ((i % 5) - 2) * 0.18 * (1 - 0.35 * lowFrac);
        hBase.push({
          x: hx,
          y: hy,
          z: zLayer,
          phase: (i / hCount) * Math.PI * 4,
          speed: 0.9 + (i % 4) * 0.22,
        });
        hPos[i * 3] = hx;
        hPos[i * 3 + 1] = hy;
        hPos[i * 3 + 2] = zLayer;
      }
      const hGeo = new THREE.BufferGeometry();
      hGeo.setAttribute('position', new THREE.BufferAttribute(hPos, 3));
      const hCanvas = document.createElement('canvas');
      hCanvas.width = hCanvas.height = 128;
      const hg = hCanvas.getContext('2d')!;
      const hGrad = hg.createRadialGradient(64, 58, 6, 64, 58, 44);
      hGrad.addColorStop(0, '#fff2b2');
      hGrad.addColorStop(0.45, '#ff99c8');
      hGrad.addColorStop(1, '#ff5c9e');
      hg.fillStyle = hGrad;
      hg.shadowColor = '#ffd166';
      hg.shadowBlur = 18;
      hg.beginPath();
      hg.moveTo(64, 96);
      hg.bezierCurveTo(26, 72, 22, 34, 48, 30);
      hg.bezierCurveTo(60, 28, 64, 42, 64, 42);
      hg.bezierCurveTo(64, 42, 68, 28, 80, 30);
      hg.bezierCurveTo(106, 34, 102, 72, 64, 96);
      hg.fill();
      const hTex = new THREE.CanvasTexture(hCanvas);
      const heartMat = new THREE.PointsMaterial({
        map: hTex,
        size: 0.38,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        sizeAttenuation: true,
      });
      const heartPoints = new THREE.Points(hGeo, heartMat);
      heartPoints.visible = false;
      heartTree.add(heartPoints);

      // 6. 树池地面暖粉星心魔法光环投影
      const ghCanvas = document.createElement('canvas');
      ghCanvas.width = ghCanvas.height = 256;
      const ghg = ghCanvas.getContext('2d')!;
      const ghGrad = ghg.createRadialGradient(128, 128, 30, 128, 128, 124);
      ghGrad.addColorStop(0, 'rgba(255, 190, 215, 0.35)');
      ghGrad.addColorStop(0.6, 'rgba(255, 210, 145, 0.22)');
      ghGrad.addColorStop(1, 'rgba(255, 210, 145, 0)');
      ghg.fillStyle = ghGrad;
      ghg.fillRect(0, 0, 256, 256);
      ghg.strokeStyle = 'rgba(255, 225, 168, 0.68)';
      ghg.lineWidth = 4;
      ghg.setLineDash([16, 10]);
      ghg.beginPath();
      ghg.arc(128, 128, 104, 0, Math.PI * 2);
      ghg.stroke();
      ghg.setLineDash([]);
      ghg.strokeStyle = 'rgba(255, 168, 200, 0.55)';
      ghg.lineWidth = 3;
      ghg.beginPath();
      ghg.arc(128, 128, 86, 0, Math.PI * 2);
      ghg.stroke();
      const ghTex = new THREE.CanvasTexture(ghCanvas);
      const groundHaloMat = new THREE.MeshBasicMaterial({
        map: ghTex,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      const groundHalo = new THREE.Mesh(new THREE.CircleGeometry(1.75, 40), groundHaloMat);
      groundHalo.rotation.x = -Math.PI / 2;
      groundHalo.position.set(0, 0.03, 0);
      groundHalo.visible = false;
      heartTree.add(groundHalo);

      // 7. 树冠动态光影投影秀（上移至树冠中上部平整区，投影更清晰）
      const projCanvas = document.createElement('canvas');
      projCanvas.width = projCanvas.height = 512;
      const projTex = new THREE.CanvasTexture(projCanvas);
      const spotTarget = new THREE.Object3D();
      spotTarget.position.set(0, 3.24, 0.0);
      heartTree.add(spotTarget);
      const spotLight = new THREE.SpotLight(0xffd6ea, 0, 8.5, 0.48, 0.38, 1.0);
      spotLight.castShadow = false;
      spotLight.map = projTex;
      spotLight.position.set(0, 3.18, -3.7);
      spotLight.target = spotTarget;
      heartTree.add(spotLight);

      // 8. 树下「奶白一二 & 焦糖布布」夜晚许愿拍照小剧场
      const dioramaGroup = new THREE.Group();
      const makeScenicBear = (charDef: typeof CHARS.yier) => {
        const fakeSlot = {
          ...charDef,
          slotId: 0,
          start: 0,
          court: [0, 0] as [number, number],
          launch: [0, 0] as [number, number],
          gate: [0, 0] as [number, number],
          gateAxis: 'z' as const,
          home: [[0, 0], [0, 0], [0, 0], [0, 0], [0, 0]] as [number, number][],
          final: [0, 0] as [number, number],
          base: [[0, 0], [0, 0], [0, 0], [0, 0]] as [number, number][],
          toy: [0, 0] as [number, number],
          finalYaw: 0,
          type: 'human' as const,
        };
        const m = buildPlaneMesh(fakeSlot, anisotropy);
        m.scale.setScalar(0.62);
        return m;
      };
      const yierMesh = makeScenicBear(CHARS.yier);
      yierMesh.position.set(-0.31, 0.02, -1.36);
      dioramaGroup.add(yierMesh);

      const bubuMesh = makeScenicBear(CHARS.bubu);
      bubuMesh.position.set(0.31, 0.02, -1.36);
      dioramaGroup.add(bubuMesh);

      // 迷你复古三脚架相机
      const camGrp = new THREE.Group();
      camGrp.position.set(0, 0.02, -2.18);
      const legMat = mat(0x4a382c, 0.65);
      for (const ang of [0, 2.1, -2.1]) {
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.008, 0.38, 6), legMat);
        leg.position.set(Math.sin(ang) * 0.075, 0.17, Math.cos(ang) * 0.075);
        leg.rotation.z = -Math.sin(ang) * 0.34;
        leg.rotation.x = Math.cos(ang) * 0.34;
        camGrp.add(leg);
      }
      const camBody = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.11, 0.09), mat(0x2d343e, 0.4));
      camBody.position.set(0, 0.37, 0);
      camGrp.add(camBody);
      const camLens = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.04, 0.055, 12), new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.25, metalness: 0.6 }));
      camLens.rotation.x = Math.PI / 2;
      camLens.position.set(0, 0.37, 0.06);
      camGrp.add(camLens);
      const flashLight = new THREE.PointLight(0xfff4dc, 0, 4.2, 1.6);
      flashLight.position.set(0, 0.47, -2.04);
      heartTree.add(flashLight);
      const flashHaloMat = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      const flashHalo = new THREE.Mesh(new THREE.CircleGeometry(0.18, 20), flashHaloMat);
      flashHalo.position.set(0, 0.44, 0.08);
      camGrp.add(flashHalo);
      dioramaGroup.add(camGrp);

      dioramaGroup.visible = false;
      heartTree.add(dioramaGroup);

      heartTreeNightData = {
        waveMats: treeWaveMats,
        waveHaloMats,
        baseStripMesh,
        baseStripMat,
        baseStripGlowMesh,
        baseStripGlowMat,
        plaqueMat,
        wishingPlaques,
        heartPoints,
        heartMat,
        heartBase: hBase,
        groundHalo,
        groundHaloMat,
        spotLight,
        projCanvas,
        projTex,
        lastProjDraw: -1,
        dioramaGroup,
        yierMesh,
        bubuMesh,
        flashLight,
        flashHalo,
        flashHaloMat,
      };

      heartTree.position.set(Math.sin(ha) * 12.15, -0.63, Math.cos(ha) * 12.15);
      heartTree.rotation.y = ha;
      scene.add(heartTree);
    }
  }

  /* ================= 4. 古朴红木漆面棋盘格子 ================= */
  const boardTileGroup = new THREE.Group();
  const hardwoodTex = createHardwoodFrameTexture(anisotropy);
  const tileCurbMat = new THREE.MeshStandardMaterial({
    map: hardwoodTex,
    color: 0xeedcc4,
    roughness: 0.72,
  });
  const slateTrimMat = new THREE.MeshStandardMaterial({
    color: 0x5b3a24,
    roughness: 0.62,
    metalness: 0.06,
  });
  const darkenToWoodHex = (hex: number, ratio: number) => {
    const r = Math.round(((hex >> 16) & 255) * (1 - ratio) + 206 * ratio);
    const g = Math.round(((hex >> 8) & 255) * (1 - ratio) + 174 * ratio);
    const b = Math.round((hex & 255) * (1 - ratio) + 134 * ratio);
    return (r << 16) | (g << 8) | b;
  };
  const tileTopMatCache = new Map<string, THREE.MeshStandardMaterial>();
  const triTopMatCache = new Map<string, THREE.MeshStandardMaterial>();
  const medallionMatCache = new Map<string, THREE.MeshStandardMaterial>();
  const shopMedallionMatCache = new Map<string, THREE.MeshStandardMaterial>();
  const shopRingIndices = players.map((P) => (P.start + 40) % 52);
  const shopRingSet = new Set(shopRingIndices);

  const getTileTopMat = (P: PlayerConfig | null | undefined) => {
    const key = P ? P.key : 'neutral';
    let m = tileTopMatCache.get(key);
    if (!m) {
      const tex = createAncientTileTexture(
        P ? P.color : NEUTRAL_CELL,
        !P,
        P?.key === 'yier',
        anisotropy,
      );
      m = new THREE.MeshStandardMaterial({
        map: tex,
        roughness: P?.key === 'yier' || !P ? 0.66 : 0.58,
      });
      tileTopMatCache.set(key, m);
    }
    return m;
  };

  const getTriTopMat = (P: PlayerConfig | null | undefined) => {
    const key = P ? P.key : 'neutral';
    let m = triTopMatCache.get(key);
    if (!m) {
      const col = !P
        ? 0xb6906a
        : P.key === 'yier'
          ? 0xe5d6b8
          : darkenToWoodHex(P.color, 0.24);
      m = new THREE.MeshStandardMaterial({
        color: col,
        roughness: P?.key === 'yier' || !P ? 0.66 : 0.58,
      });
      triTopMatCache.set(key, m);
    }
    return m;
  };

  const getMedallionMat = (P: PlayerConfig | null | undefined) => {
    const key = P ? P.key : 'neutral';
    let m = medallionMatCache.get(key);
    if (!m) {
      const tex = createCellMedallionTexture(
        P ? ringColor(P) : 0xc6c0b0,
        !P,
        P?.key === 'yier',
        anisotropy,
      );
      m = new THREE.MeshStandardMaterial({
        map: tex,
        transparent: true,
        roughness: 0.55,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -1,
        polygonOffsetUnits: -1,
      });
      medallionMatCache.set(key, m);
    }
    return m;
  };

  const getShopMedallionMat = (P: PlayerConfig) => {
    let m = shopMedallionMatCache.get(P.key);
    if (!m) {
      const tex = createShopMedallionTexture(ringColor(P), P.key === 'yier', anisotropy);
      m = new THREE.MeshStandardMaterial({
        map: tex,
        transparent: true,
        roughness: 0.42,
        metalness: 0.14,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -1,
        polygonOffsetUnits: -1,
      });
      shopMedallionMatCache.set(P.key, m);
    }
    return m;
  };

  const rectTile = (
    x: number,
    z: number,
    w: number,
    d: number,
    P: PlayerConfig | null | undefined,
  ) => {
    // 外框青石底托 + 内嵌矿彩石砖
    const base = new THREE.Mesh(new THREE.BoxGeometry(w, 0.1, d), tileCurbMat);
    base.position.set(x, 0.05, z);
    base.receiveShadow = true;
    base.castShadow = true;
    boardTileGroup.add(base);

    const inlay = new THREE.Mesh(
      new THREE.BoxGeometry(Math.max(0.2, w - 0.065), 0.024, Math.max(0.2, d - 0.065)),
      getTileTopMat(P),
    );
    inlay.position.set(x, 0.108, z);
    inlay.receiveShadow = true;
    boardTileGroup.add(inlay);
    return inlay;
  };

  const makeTriShape = (pts: Point2D[]) => {
    let p = pts.map(([x, z]) => [x, -z] as Point2D);
    const area =
      (p[1][0] - p[0][0]) * (p[2][1] - p[0][1]) -
      (p[2][0] - p[0][0]) * (p[1][1] - p[0][1]);
    if (area < 0) p = [p[0], p[2], p[1]];
    const s = new THREE.Shape();
    s.moveTo(p[0][0], p[0][1]);
    s.lineTo(p[1][0], p[1][1]);
    s.lineTo(p[2][0], p[2][1]);
    s.closePath();
    return s;
  };

  const triTile = (
    ptsXZ: Point2D[],
    cx: number,
    cz: number,
    P: PlayerConfig | null | undefined,
  ) => {
    const outer = new THREE.Mesh(
      new THREE.ExtrudeGeometry(makeTriShape(ptsXZ), { depth: 0.1, bevelEnabled: false }),
      tileCurbMat,
    );
    outer.rotation.x = -Math.PI / 2;
    outer.position.y = 0;
    outer.receiveShadow = true;
    outer.castShadow = true;
    boardTileGroup.add(outer);

    // 略微向质心内缩形成倒角青石嵌面
    const insetPts = ptsXZ.map(([x, z]) => {
      const dx = x - cx;
      const dz = z - cz;
      const len = Math.hypot(dx, dz) || 1;
      return [x - (dx / len) * 0.045, z - (dz / len) * 0.045] as Point2D;
    });
    const inlay = new THREE.Mesh(
      new THREE.ExtrudeGeometry(makeTriShape(insetPts), {
        depth: 0.018,
        bevelEnabled: true,
        bevelThickness: 0.002,
        bevelSize: 0.004,
        bevelSegments: 1,
      }),
      getTriTopMat(P),
    );
    inlay.rotation.x = -Math.PI / 2;
    inlay.position.y = 0.1;
    inlay.receiveShadow = true;
    boardTileGroup.add(inlay);
    return inlay;
  };

  const cellDisc = (
    x: number,
    z: number,
    P: PlayerConfig | null | undefined,
    rOut = 0.31,
  ) => {
    const r = new THREE.Mesh(new THREE.CircleGeometry(rOut, 28), getMedallionMat(P));
    r.rotation.x = -Math.PI / 2;
    r.position.set(x, 0.1215, z);
    r.receiveShadow = true;
    boardTileGroup.add(r);
  };

  RING_TILES.forEach((t, i) => {
    const P = slotPlayer(i % 4);
    const isShopTile = !!P && shopRingSet.has(i);
    if (t.kind === 'rect') {
      rectTile(t.x, t.z, t.w, t.d, P);
      if (isShopTile && P) {
        const shopDisc = new THREE.Mesh(new THREE.CircleGeometry(0.365, 32), getShopMedallionMat(P));
        shopDisc.rotation.x = -Math.PI / 2;
        shopDisc.rotation.z = -Math.floor(i / 13) * (Math.PI / 2);
        shopDisc.position.set(t.cx, 0.1225, t.cz);
        shopDisc.receiveShadow = true;
        scene.add(shopDisc);

        const goldRim = new THREE.Mesh(
          new THREE.TorusGeometry(0.372, 0.014, 8, 32),
          new THREE.MeshStandardMaterial({
            color: 0xf4c44e,
            emissive: 0xd99b26,
            emissiveIntensity: 0.25,
            roughness: 0.32,
            metalness: 0.55,
          }),
        );
        goldRim.rotation.x = -Math.PI / 2;
        goldRim.position.set(t.cx, 0.123, t.cz);
        scene.add(goldRim);
      } else {
        cellDisc(t.cx, t.cz, P, 0.31);
      }
    } else {
      triTile(t.pts, t.cx, t.cz, P);
      cellDisc(t.cx, t.cz, P, 0.245);
    }
    if (i % 13 === 0 && P) {
      // 终点航道拐弯点：使用平贴格面的 90° 圆弧拐弯箭头（从上一格方向弯折指向终点走廊首格）
      const hc = SLOTS[i / 13].home[0];
      const prevTile = RING_TILES[(i + 51) % 52];
      // uVec: 指向来路方向 (prevTile)，vVec: 指向终点走廊入口 (hc)
      const uLen = Math.hypot(prevTile.cx - t.cx, prevTile.cz - t.cz) || 1;
      const uVecX = (prevTile.cx - t.cx) / uLen;
      const uVecZ = (prevTile.cz - t.cz) / uLen;
      const vLen = Math.hypot(hc[0] - t.cx, hc[1] - t.cz) || 1;
      const vVecX = (hc[0] - t.cx) / vLen;
      const vVecZ = (hc[1] - t.cz) / vLen;

      // 在 (u, v) 局部平面构建 90° 圆角弯折箭头轮廓，再映射到世界 (X, -Z) 平面
      const toShapeXY = (u: number, v: number): [number, number] => {
        const wx = u * uVecX + v * vVecX;
        const wz = u * uVecZ + v * vVecZ;
        return [wx, -wz];
      };

      const pts2d: [number, number][] = [];
      // 箭尾底边与外侧直段 (来自 u 正方向)
      pts2d.push(toShapeXY(0.165, -0.008));
      pts2d.push(toShapeXY(0.165, -0.076));
      pts2d.push(toShapeXY(0.036, -0.076));

      // 外侧 90° 圆弧弯折 (围绕圆心 (0.036, 0.036)，半径 0.112)
      const arcSteps = 12;
      for (let k = 1; k <= arcSteps; k++) {
        const ang = -Math.PI / 2 - (k / arcSteps) * (Math.PI / 2);
        const u = 0.036 + Math.cos(ang) * 0.112;
        const v = 0.036 + Math.sin(ang) * 0.112;
        pts2d.push(toShapeXY(u, v));
      }

      // 箭头左侧外翼 -> 箭头尖端 (指向 +v 终点航道) -> 箭头右侧内翼
      pts2d.push(toShapeXY(-0.076, 0.052));
      pts2d.push(toShapeXY(-0.132, 0.052));
      pts2d.push(toShapeXY(-0.042, 0.195));
      pts2d.push(toShapeXY(0.048, 0.052));
      pts2d.push(toShapeXY(-0.008, 0.052));

      // 内侧 90° 圆弧弯折 (围绕圆心 (0.036, 0.036)，半径 0.044)
      for (let k = 0; k <= arcSteps; k++) {
        const ang = -Math.PI + (k / arcSteps) * (Math.PI / 2);
        const u = 0.036 + Math.cos(ang) * 0.044;
        const v = 0.036 + Math.sin(ang) * 0.044;
        pts2d.push(toShapeXY(u, v));
      }

      const turnShape = new THREE.Shape();
      turnShape.moveTo(pts2d[0][0], pts2d[0][1]);
      for (let k = 1; k < pts2d.length; k++) {
        turnShape.lineTo(pts2d[k][0], pts2d[k][1]);
      }
      turnShape.closePath();

      const turnGeo = new THREE.ExtrudeGeometry(turnShape, {
        depth: 0.012,
        bevelEnabled: true,
        bevelThickness: 0.003,
        bevelSize: 0.003,
        bevelSegments: 2,
      });
      turnGeo.rotateX(-Math.PI / 2);

      const turnArrowMesh = new THREE.Mesh(
        turnGeo,
        new THREE.MeshStandardMaterial({
          color: lineOf(P),
          roughness: 0.36,
          metalness: 0.12,
        }),
      );
      turnArrowMesh.position.set(t.cx, 0.123, t.cz);
      turnArrowMesh.castShadow = true;
      turnArrowMesh.receiveShadow = true;
      scene.add(turnArrowMesh);
    }
  });

  const planeMarks: THREE.Group[] = [];
  players.forEach((P, pIdx) => {
    const a = RING[(P.start + 2 + FLIGHT_FROM) % 52];
    const b = RING[(P.start + 2 + FLIGHT_FROM + FLIGHT_STEP) % 52];
    const s = new THREE.Vector3(a[0], 0.15, a[1]);
    const e = new THREE.Vector3(b[0], 0.15, b[1]);
    const mid = s.clone().lerp(e, 0.5);
    mid.y = 1.15;
    const line = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(
        new THREE.QuadraticBezierCurve3(s, mid, e).getPoints(36),
      ),
      new THREE.LineDashedMaterial({
        color: lineOf(P),
        dashSize: 0.3,
        gapSize: 0.18,
        transparent: true,
        opacity: 0.95,
      }),
    );
    line.computeLineDistances();
    scene.add(line);

    const fyaw = Math.atan2(b[0] - a[0], b[1] - a[1]);
    const takeoffPadGroup = new THREE.Group();
    const takeoffTop = new THREE.Mesh(
      new THREE.CircleGeometry(0.225, 32),
      new THREE.MeshStandardMaterial({
        map: createFlightTakeoffTexture(P, anisotropy),
        roughness: 0.48,
      }),
    );
    takeoffTop.rotation.x = -Math.PI / 2;
    takeoffTop.rotation.z = fyaw + Math.PI;
    takeoffTop.position.set(a[0], 0.124, a[1]);
    takeoffTop.receiveShadow = true;
    takeoffPadGroup.add(takeoffTop);

    const takeoffRim = new THREE.Mesh(
      new THREE.TorusGeometry(0.228, 0.012, 8, 32),
      new THREE.MeshStandardMaterial({
        color: lineOf(P),
        roughness: 0.42,
        metalness: 0.15,
      }),
    );
    takeoffRim.rotation.x = -Math.PI / 2;
    takeoffRim.position.set(a[0], 0.125, a[1]);
    takeoffPadGroup.add(takeoffRim);
    scene.add(takeoffPadGroup);

    // 飞机航线落点：使用停机坪「P」字圆盘标识替代原先的八面体三角堆
    const pPadTop = new THREE.Mesh(
      new THREE.CircleGeometry(0.225, 32),
      new THREE.MeshStandardMaterial({
        map: createLandingPadTexture(P, anisotropy),
        roughness: 0.48,
      }),
    );
    pPadTop.rotation.x = -Math.PI / 2;
    pPadTop.position.set(b[0], 0.124, b[1]);
    pPadTop.receiveShadow = true;
    scene.add(pPadTop);

    const pPadRim = new THREE.Mesh(
      new THREE.TorusGeometry(0.228, 0.012, 8, 32),
      new THREE.MeshStandardMaterial({
        color: lineOf(P),
        roughness: 0.42,
        metalness: 0.15,
      }),
    );
    pPadRim.rotation.x = -Math.PI / 2;
    pPadRim.position.set(b[0], 0.125, b[1]);
    scene.add(pPadRim);
  });

  const crossDangerLightMat = new THREE.MeshStandardMaterial({
    map: createCrossDangerTexture(false, anisotropy),
    transparent: true,
    depthWrite: false,
    roughness: 0.72,
  });
  const crossDangerYierMat = new THREE.MeshStandardMaterial({
    map: createCrossDangerTexture(true, anisotropy),
    transparent: true,
    depthWrite: false,
    roughness: 0.72,
  });

  players.forEach((P) => {
    const hasOppFlight = players.some((op) => op.slotId === (P.slotId + 2) % 4);
    P.home.forEach((c, idx) => {
      rectTile(c[0], c[1], 0.72, 0.72, P);
      cellDisc(c[0], c[1], P, 0.255);
      // 终点通道第 4 格（pos 54 / 终点前第 2 格）：对家航线穿过点，绘与圆圈同色的纯线条警示标
      if (idx === 3 && hasOppFlight) {
        const dangerMark = new THREE.Mesh(
          new THREE.CircleGeometry(0.225, 32),
          P.key === 'yier' ? crossDangerYierMat : crossDangerLightMat,
        );
        dangerMark.rotation.x = -Math.PI / 2;
        dangerMark.rotation.z = -(Math.PI / 2) * (P.slotId + 1);
        dangerMark.position.set(c[0], 0.1235, c[1]);
        dangerMark.receiveShadow = true;
        scene.add(dangerMark);
      }
    });
  });

  batchStaticGroup(boardTileGroup);
  scene.add(boardTileGroup);

  /* ================= 5. 1:1 摇摇车手办与基地庭院 ================= */
  const rideToys: RideToyAnim[] = [];
  const courtFences: CourtFenceHighlight[] = [];
  const fenceStoneBaseMat = mat(0xa6aeb5, 0.88);
  const fenceStonePlinthMat = mat(0xb6bec4, 0.84);
  const courtyardGrassTop = new THREE.MeshStandardMaterial({
    map: createCourtyardGrassTexture(anisotropy),
    roughness: 1,
  });
  const courtyardGrassSide = mat(0x7a5a3a);

  const buildRideToy = (P: PlayerConfig, slotId: number) => {
    const root = new THREE.Group();
    const rockerPivot = new THREE.Group();
    root.add(rockerPivot);
    const M = (c: number, r = 0.45) => new THREE.MeshStandardMaterial({ color: c, roughness: r });
    const panda = P.species === 'panda';

    if (panda) {
      const skyBlue = 0x74c7db;
      const pink = 0xd9467a;
      const yellowRim = 0xefc22c;
      const cream = 0xf6f2e8;
      rockerPivot.add(makeRockerBase(skyBlue));
      const pinkM = M(pink, 0.45);
      const saddle = new THREE.Mesh(new THREE.SphereGeometry(0.192, 24, 18), pinkM);
      saddle.scale.set(1.04, 0.9, 1.56);
      saddle.position.set(0, 0.185, -0.02);
      saddle.castShadow = true;
      saddle.receiveShadow = true;
      rockerPivot.add(saddle);

      const hood = new THREE.Mesh(new THREE.SphereGeometry(0.184, 24, 20), pinkM);
      hood.scale.set(1.03, 1.0, 1.08);
      hood.position.set(0, 0.255, 0.155);
      hood.castShadow = true;
      rockerPivot.add(hood);

      const faceTilt = -0.32;
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(0.134, 0.025, 14, 32),
        M(yellowRim, 0.4),
      );
      ring.scale.set(1.04, 0.96, 1.0);
      ring.position.set(0, 0.258, 0.265);
      ring.rotation.x = faceTilt;
      rockerPivot.add(ring);

      const creamFace = new THREE.Mesh(
        new THREE.SphereGeometry(0.132, 24, 20),
        M(cream, 0.55),
      );
      creamFace.scale.set(1.02, 0.94, 0.54);
      creamFace.position.set(0, 0.255, 0.275);
      creamFace.rotation.x = faceTilt;
      rockerPivot.add(creamFace);

      const smilePts = [
        new THREE.Vector3(-0.042, 0.248, 0.338),
        new THREE.Vector3(-0.005, 0.236, 0.344),
        new THREE.Vector3(0.032, 0.248, 0.338),
        new THREE.Vector3(0.042, 0.26, 0.332),
      ];
      rockerPivot.add(
        new THREE.Mesh(
          new THREE.TubeGeometry(new THREE.CatmullRomCurve3(smilePts), 14, 0.0065, 8, false),
          M(0x3a2820, 0.4),
        ),
      );

      const blueM = M(skyBlue, 0.42);
      const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.026, 0.48, 14), blueM);
      bar.rotation.z = Math.PI / 2;
      bar.position.set(0, 0.39, 0.12);
      bar.castShadow = true;
      rockerPivot.add(bar);
      for (const s of [-1, 1]) {
        const cap = new THREE.Mesh(new THREE.SphereGeometry(0.032, 12, 10), blueM);
        cap.position.set(0.245 * s, 0.39, 0.12);
        rockerPivot.add(cap);
      }
    } else {
      const whiteCol = 0xf4f2ee;
      const duckYellow = 0xe6cb1e;
      const duckOrange = 0xf29a1d;
      rockerPivot.add(makeRockerBase(whiteCol));
      const duckM = M(duckYellow, 0.44);
      const duckBody = new THREE.Mesh(new THREE.SphereGeometry(0.192, 24, 18), duckM);
      duckBody.scale.set(1.06, 0.84, 1.56);
      duckBody.position.set(0, 0.175, -0.02);
      duckBody.castShadow = true;
      duckBody.receiveShadow = true;
      rockerPivot.add(duckBody);

      const duckTail = new THREE.Mesh(new THREE.SphereGeometry(0.078, 16, 12), duckM);
      duckTail.scale.set(0.88, 0.75, 1.38);
      duckTail.position.set(0, 0.25, -0.31);
      duckTail.rotation.x = -0.42;
      rockerPivot.add(duckTail);

      const duckHead = new THREE.Mesh(new THREE.SphereGeometry(0.184, 24, 20), duckM);
      duckHead.scale.set(1.07, 0.96, 1.02);
      duckHead.position.set(0, 0.335, 0.175);
      duckHead.castShadow = true;
      rockerPivot.add(duckHead);

      const eyeM = M(0x2a1a14, 0.35);
      for (const s of [-1, 1]) {
        const eye = new THREE.Mesh(new THREE.SphereGeometry(0.019, 14, 10), eyeM);
        eye.scale.set(1, 1, 0.6);
        eye.position.set(0.074 * s, 0.358, 0.342);
        rockerPivot.add(eye);
      }
      const bill = new THREE.Mesh(new THREE.SphereGeometry(0.076, 20, 14), M(duckOrange, 0.42));
      bill.scale.set(1.26, 0.38, 1.05);
      bill.position.set(0, 0.295, 0.362);
      bill.rotation.x = 0.12;
      bill.castShadow = true;
      rockerPivot.add(bill);

      const whiteM = M(whiteCol, 0.4);
      const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.026, 0.5, 14), whiteM);
      bar.rotation.z = Math.PI / 2;
      bar.position.set(0, 0.42, 0.13);
      bar.castShadow = true;
      rockerPivot.add(bar);
      for (const s of [-1, 1]) {
        const cap = new THREE.Mesh(new THREE.SphereGeometry(0.032, 12, 10), whiteM);
        cap.position.set(0.255 * s, 0.42, 0.13);
        rockerPivot.add(cap);
      }
    }

    const {
      riderPivot,
      headPivot,
      restArmGroup,
      eatArmPivot,
      cakeGroup,
      cakeSlice1,
      cakeSlice2,
      mouthClosed,
      mouthOpen,
      jawPivot,
      blushMeshes,
      normalEyes,
      happyEyes,
    } = buildToyRider(P);
    rockerPivot.add(riderPivot);
    root.scale.setScalar(1.06);
    root.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) o.castShadow = true;
    });
    rideToys.push({
      root,
      rockerPivot,
      riderPivot,
      headPivot,
      phase: slotId * 1.45,
      species: P.species,
      charKey: P.key,
      cakeEat:
        panda && restArmGroup && eatArmPivot && cakeGroup && cakeSlice1 && cakeSlice2 && mouthClosed && mouthOpen && jawPivot
          ? {
              restArmGroup,
              eatArmPivot,
              cakeGroup,
              cakeSlice1,
              cakeSlice2,
              mouthClosed,
              mouthOpen,
              jawPivot,
              blushMeshes,
              normalEyes,
              happyEyes,
              eatStart: -1,
              eatDur: 7.4,
            }
          : undefined,
    });
    return root;
  };

  for (let j = 0; j < 4; j++) {
    const slot = SLOTS[j];
    const P = slotPlayer(j);
    const cx = slot.court[0];
    const cz = slot.court[1];
    const fenceWoodMat = mat(0xbdb9b1, 0.78);
    const fenceTrimWoodMat = mat(0xa29f98, 0.72);
    const fenceCapMat = mat(0xd4d0c8, 0.58);
    courtFences.push({
      woodMat: fenceWoodMat,
      trimMat: fenceTrimWoodMat,
      capMat: fenceCapMat,
      active: false,
      pulse: false,
      accentHex: 0x56c48c,
    });
    const grass = new THREE.Mesh(new THREE.BoxGeometry(3.92, 0.16, 3.92), [
      courtyardGrassSide,
      courtyardGrassSide,
      courtyardGrassTop,
      courtyardGrassSide,
      courtyardGrassSide,
      courtyardGrassSide,
    ]);
    grass.position.set(cx, 0.02, cz);
    grass.receiveShadow = true;
    grass.castShadow = true;
    scene.add(grass);

    const H = 3.82;
    const R = H / 2;
    const gx = slot.gate[0];
    const gz = slot.gate[1];
    const gateOpenSide =
      slot.gateAxis === 'z' ? (gz > cz ? 'bottom' : 'top') : gx > cx ? 'right' : 'left';

    const sides = [
      { name: 'top', ex: 0, ez: -R, nx: 0, nz: -1, horiz: true },
      { name: 'bottom', ex: 0, ez: R, nx: 0, nz: 1, horiz: true },
      { name: 'left', ex: -R, ez: 0, nx: -1, nz: 0, horiz: false },
      { name: 'right', ex: R, ez: 0, nx: 1, nz: 0, horiz: false },
    ] as const;

    const courtyardFenceGroup = new THREE.Group();
    const addWoodPillar = (
      px: number,
      pz: number,
      postW: number,
      postH: number,
      plinthW: number,
      capScale = 1,
    ) => {
      const plinth = new THREE.Mesh(
        new THREE.BoxGeometry(plinthW, 0.068, plinthW),
        fenceStonePlinthMat,
      );
      plinth.position.set(px, 0.112, pz);
      plinth.castShadow = true;
      plinth.receiveShadow = true;
      courtyardFenceGroup.add(plinth);

      const post = new THREE.Mesh(
        new THREE.BoxGeometry(postW, postH, postW),
        fenceWoodMat,
      );
      post.position.set(px, 0.146 + postH * 0.5, pz);
      post.castShadow = true;
      post.receiveShadow = true;
      courtyardFenceGroup.add(post);

      const collar = new THREE.Mesh(
        new THREE.BoxGeometry(postW + 0.024, 0.026, postW + 0.024),
        fenceTrimWoodMat,
      );
      collar.position.set(px, 0.146 + postH + 0.004, pz);
      collar.castShadow = true;
      courtyardFenceGroup.add(collar);

      const cap = new THREE.Mesh(
        new THREE.SphereGeometry(0.044 * capScale, 12, 10),
        fenceCapMat,
      );
      cap.scale.y = 0.88;
      cap.position.set(px, 0.146 + postH + 0.044 * capScale, pz);
      cap.castShadow = true;
      courtyardFenceGroup.add(cap);
    };

    const addFenceSpan = (
      a: number,
      b: number,
      horiz: boolean,
      fixedX: number,
      fixedZ: number,
    ) => {
      const len = b - a;
      if (len <= 0.12) return;
      const mid = (a + b) * 0.5;
      const sx = horiz ? mid : fixedX;
      const sz = horiz ? fixedZ : mid;

      // 青石压脚条（防潮基座，衔接庭院青石与草坪）
      const stoneCurb = new THREE.Mesh(
        new THREE.BoxGeometry(horiz ? len : 0.115, 0.06, horiz ? 0.115 : len),
        fenceStoneBaseMat,
      );
      stoneCurb.position.set(sx, 0.11, sz);
      stoneCurb.castShadow = true;
      stoneCurb.receiveShadow = true;
      courtyardFenceGroup.add(stoneCurb);

      // 下槛 + 腰枋 + 寻杖扶手（浅原木三层清雅栏杆）
      const rails: [number, number, number, THREE.Material][] = [
        [0.16, 0.036, 0.058, fenceWoodMat],
        [0.255, 0.028, 0.048, fenceTrimWoodMat],
        [0.355, 0.04, 0.084, fenceWoodMat],
      ];
      for (const [ry, rh, rw, rMat] of rails) {
        const rail = new THREE.Mesh(
          new THREE.BoxGeometry(horiz ? len : rw, rh, horiz ? rw : len),
          rMat,
        );
        rail.position.set(sx, ry, sz);
        rail.castShadow = true;
        rail.receiveShadow = true;
        courtyardFenceGroup.add(rail);
      }

      // 竖向清雅细木棂
      const innerStart = a + 0.08;
      const innerEnd = b - 0.08;
      const innerSpan = innerEnd - innerStart;
      if (innerSpan > 0.08) {
        const count = Math.max(1, Math.round(innerSpan / 0.3));
        for (let k = 0; k <= count; k++) {
          const t = count === 0 ? innerSpan * 0.5 : (k / count) * innerSpan;
          const pos = innerStart + t;
          const baluster = new THREE.Mesh(
            new THREE.BoxGeometry(0.032, 0.185, 0.032),
            fenceWoodMat,
          );
          baluster.position.set(horiz ? pos : fixedX, 0.258, horiz ? fixedZ : pos);
          baluster.castShadow = true;
          courtyardFenceGroup.add(baluster);
        }
      }
    };

    sides.forEach((s) => {
      const horiz = s.horiz;
      const fixedX = cx + s.ex;
      const fixedZ = cz + s.ez;
      const minEdge = (horiz ? cx : cz) - R + 0.07;
      const maxEdge = (horiz ? cx : cz) + R - 0.07;

      if (s.name === gateOpenSide) {
        const doorCoord = horiz ? gx : gz;
        addFenceSpan(minEdge, doorCoord - 0.5, horiz, fixedX, fixedZ);
        addFenceSpan(doorCoord + 0.5, maxEdge, horiz, fixedX, fixedZ);

        [-0.5, 0.5].forEach((off) => {
          const px = horiz ? doorCoord + off : fixedX;
          const pz = horiz ? fixedZ : doorCoord + off;
          addWoodPillar(px, pz, 0.12, 0.38, 0.155, 1.1);

          // 门侧小青石抱鼓石（外沿点缀，不占门洞通道）
          const drum = new THREE.Mesh(
            new THREE.CylinderGeometry(0.052, 0.058, 0.13, 14),
            fenceStonePlinthMat,
          );
          drum.rotation.z = horiz ? 0 : Math.PI / 2;
          drum.rotation.x = horiz ? Math.PI / 2 : 0;
          drum.position.set(px + s.nx * 0.08, 0.142, pz + s.nz * 0.08);
          drum.castShadow = true;
          drum.receiveShadow = true;
          courtyardFenceGroup.add(drum);
        });
      } else {
        const centerCoord = horiz ? cx : cz;
        addFenceSpan(minEdge, centerCoord - 0.05, horiz, fixedX, fixedZ);
        addFenceSpan(centerCoord + 0.05, maxEdge, horiz, fixedX, fixedZ);
        addWoodPillar(
          horiz ? cx : fixedX,
          horiz ? fixedZ : cz,
          0.1,
          0.31,
          0.135,
          0.9,
        );
      }
    });

    for (const [sx, sz] of [
      [-1, -1],
      [1, -1],
      [-1, 1],
      [1, 1],
    ]) {
      addWoodPillar(cx + sx * (R - 0.02), cz + sz * (R - 0.02), 0.115, 0.33, 0.15, 1.0);
    }

    batchStaticGroup(courtyardFenceGroup);
    scene.add(courtyardFenceGroup);

    if (P) {
      const toy = buildRideToy(P, j);
      toy.position.set(slot.toy[0], 0.1, slot.toy[1]);
      toy.rotation.y = Math.atan2(-cx, -cz);
      scene.add(toy);

      const bxCenter = P.base.reduce((s, b) => s + b[0], 0) / 4;
      const bzCenter = P.base.reduce((s, b) => s + b[1], 0) / 4;
      const slabCurb = new THREE.Mesh(new THREE.BoxGeometry(2.36, 0.04, 2.36), tileCurbMat);
      slabCurb.position.set(bxCenter, 0.084, bzCenter);
      slabCurb.receiveShadow = true;
      slabCurb.castShadow = true;
      scene.add(slabCurb);

      const slab = new THREE.Mesh(new THREE.BoxGeometry(2.22, 0.044, 2.22), getTileTopMat(P));
      slab.position.set(bxCenter, 0.092, bzCenter);
      slab.receiveShadow = true;
      slab.castShadow = true;
      scene.add(slab);

      const boxwoodStandMat = mat(0xd4be96, 0.66);
      const standRimMat = new THREE.MeshStandardMaterial({
        color: lineOf(P),
        roughness: 0.48,
        metalness: 0.1,
      });
      P.base.forEach((b) => {
        const pad = new THREE.Mesh(
          new THREE.CylinderGeometry(0.41, 0.44, 0.034, 8),
          boxwoodStandMat,
        );
        pad.rotation.y = Math.PI / 8;
        pad.position.set(b[0], 0.125, b[1]);
        pad.receiveShadow = true;
        pad.castShadow = true;
        scene.add(pad);
        const rim = new THREE.Mesh(
          new THREE.TorusGeometry(0.39, 0.024, 10, 32),
          standRimMat,
        );
        rim.rotation.x = -Math.PI / 2;
        rim.position.set(b[0], 0.141, b[1]);
        scene.add(rim);
      });

      const lx = slot.launch[0];
      const lz = slot.launch[1];
      const firstTile = RING[(P.start + 3) % 52];
      const tx = firstTile[0];
      const tz = firstTile[1];
      const gVec = new THREE.Vector3(gx, 0.095, gz);
      const lVec = new THREE.Vector3(lx, 0.095, lz);
      const pathDir = lVec.clone().sub(gVec).normalize();
      const pathStart = gVec.clone().addScaledVector(pathDir, 0.12);
      const pathLen = Math.max(0.18, pathStart.distanceTo(lVec));

      const gateCurb = new THREE.Mesh(
        new THREE.BoxGeometry(0.6, 0.032, pathLen + 0.04),
        tileCurbMat,
      );
      gateCurb.position.copy(pathStart).lerp(lVec, 0.5);
      gateCurb.position.y = 0.086;
      gateCurb.rotation.y = Math.atan2(lx - gx, lz - gz);
      gateCurb.receiveShadow = true;
      scene.add(gateCurb);

      const gatePath = new THREE.Mesh(
        new THREE.BoxGeometry(0.48, 0.034, pathLen),
        getTileTopMat(P),
      );
      gatePath.position.copy(pathStart).lerp(lVec, 0.5);
      gatePath.position.y = 0.094;
      gatePath.rotation.y = Math.atan2(lx - gx, lz - gz);
      gatePath.receiveShadow = true;
      scene.add(gatePath);

      // 八角雕木启程台（老胡桃木底阶 + 漆木鼓座 + 乌木压箍 + 木刻篆印盘面）
      const startPlinth = new THREE.Mesh(
        new THREE.CylinderGeometry(0.47, 0.52, 0.056, 8),
        tileCurbMat,
      );
      startPlinth.rotation.y = Math.PI / 8;
      startPlinth.position.set(lx, 0.062, lz);
      startPlinth.castShadow = true;
      startPlinth.receiveShadow = true;
      scene.add(startPlinth);

      const startBase = new THREE.Mesh(
        new THREE.CylinderGeometry(0.41, 0.44, 0.034, 28),
        mat(P.key === 'yier' ? 0xd9c6a3 : darkenToWoodHex(P.color, 0.24), 0.62),
      );
      startBase.position.set(lx, 0.104, lz);
      startBase.castShadow = true;
      startBase.receiveShadow = true;
      scene.add(startBase);

      const startCollar = new THREE.Mesh(
        new THREE.TorusGeometry(0.415, 0.018, 8, 28),
        slateTrimMat,
      );
      startCollar.rotation.x = -Math.PI / 2;
      startCollar.position.set(lx, 0.118, lz);
      scene.add(startCollar);

      const startTop = new THREE.Mesh(
        new THREE.CircleGeometry(0.405, 32),
        new THREE.MeshStandardMaterial({
          map: createStartPadTexture(P, anisotropy),
          roughness: 0.58,
        }),
      );
      startTop.rotation.x = -Math.PI / 2;
      startTop.rotation.z = Math.atan2(tx - lx, tz - lz);
      startTop.position.set(lx, 0.123, lz);
      startTop.receiveShadow = true;
      scene.add(startTop);

      // 优化起点方向指示：用平贴地面的精致立体导流箭头替代原先突兀的三角锥
      const dirX = tx - lx;
      const dirZ = tz - lz;
      const dirLen = Math.hypot(dirX, dirZ) || 1;
      const ux = dirX / dirLen;
      const uz = dirZ / dirLen;

      const takeoffArrowShape = new THREE.Shape();
      takeoffArrowShape.moveTo(0, 0.14);
      takeoffArrowShape.lineTo(0.105, 0.01);
      takeoffArrowShape.lineTo(0.045, 0.01);
      takeoffArrowShape.lineTo(0.045, -0.11);
      takeoffArrowShape.lineTo(-0.045, -0.11);
      takeoffArrowShape.lineTo(-0.045, 0.01);
      takeoffArrowShape.lineTo(-0.105, 0.01);
      takeoffArrowShape.closePath();

      const takeoffArrowGeo = new THREE.ExtrudeGeometry(takeoffArrowShape, {
        depth: 0.014,
        bevelEnabled: true,
        bevelThickness: 0.003,
        bevelSize: 0.003,
        bevelSegments: 2,
      });
      takeoffArrowGeo.rotateX(-Math.PI / 2);
      takeoffArrowGeo.rotateY(Math.PI);

      const stepArrow = new THREE.Mesh(
        takeoffArrowGeo,
        new THREE.MeshStandardMaterial({
          color: lineOf(P),
          roughness: 0.36,
          metalness: 0.14,
        }),
      );
      stepArrow.rotation.y = Math.atan2(ux, uz);
      // 放置在启程台外缘与首格之间的中点偏外侧，避免与启程台圆环穿插
      const arrowDist = Math.min(dirLen * 0.56, 0.56);
      stepArrow.position.set(lx + ux * arrowDist, 0.118, lz + uz * arrowDist);
      stepArrow.castShadow = true;
      stepArrow.receiveShadow = true;
      scene.add(stepArrow);
    }
  }

  // 中央终点区（古朴红木榫卯四方台 + 八角檀木螺钿骰盘）
  const darkRosewoodMat = mat(0x6e472d, 0.7);
  const chestnutWoodMat = new THREE.MeshStandardMaterial({
    map: hardwoodTex,
    color: 0xf7e6cf,
    roughness: 0.64,
  });
  const ebonyInlayMat = new THREE.MeshStandardMaterial({
    color: 0x4d2f1c,
    roughness: 0.58,
    metalness: 0.06,
  });
  const boxwoodStudMat = mat(0xdcc69e, 0.58);

  // 底层老红木台基
  addBox(0, 0, 3.88, 0.1, 3.88, 0x6e472d, 0.05);

  // 外圈花梨木框 + 内嵌乌木压线（传统中式棋盘榫卯框）
  const borderR = 1.83;
  [
    [0, borderR, 3.78, 0.11],
    [0, -borderR, 3.78, 0.11],
    [borderR, 0, 0.11, 3.78],
    [-borderR, 0, 0.11, 3.78],
  ].forEach(([x, z, w, d]) => {
    const curb = new THREE.Mesh(new THREE.BoxGeometry(w, 0.034, d), chestnutWoodMat);
    curb.position.set(x, 0.11, z);
    curb.receiveShadow = true;
    curb.castShadow = true;
    scene.add(curb);
  });
  [
    [0, 1.755, 3.55, 0.044],
    [0, -1.755, 3.55, 0.044],
    [1.755, 0, 0.044, 3.55],
    [-1.755, 0, 0.044, 3.55],
  ].forEach(([x, z, w, d]) => {
    const inlayBand = new THREE.Mesh(new THREE.BoxGeometry(w, 0.022, d), ebonyInlayMat);
    inlayBand.position.set(x, 0.118, z);
    inlayBand.receiveShadow = true;
    scene.add(inlayBand);
  });

  // 四隅榫卯木柱墩 + 黄杨木圆顶
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const pier = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.052, 0.19), darkRosewoodMat);
      pier.position.set(1.82 * sx, 0.118, 1.82 * sz);
      pier.castShadow = true;
      pier.receiveShadow = true;
      scene.add(pier);

      const cap = new THREE.Mesh(new THREE.BoxGeometry(0.145, 0.02, 0.145), ebonyInlayMat);
      cap.position.set(1.82 * sx, 0.15, 1.82 * sz);
      cap.castShadow = true;
      scene.add(cap);

      const bead = new THREE.Mesh(new THREE.SphereGeometry(0.042, 10, 8), boxwoodStudMat);
      bead.scale.y = 0.82;
      bead.position.set(1.82 * sx, 0.178, 1.82 * sz);
      scene.add(bead);
    }
  }

  // 四方大漆木板终点扇区
  const buildGoalBay = (
    p0: Point2D,
    p1: Point2D,
    apex: Point2D,
    P: PlayerConfig | null | undefined,
  ) => {
    const v0 = new THREE.Vector3(p0[0], 0.112, p0[1]);
    const v1 = new THREE.Vector3(p1[0], 0.112, p1[1]);
    const v2 = new THREE.Vector3(apex[0], 0.112, apex[1]);
    const crossY = (v1.x - v0.x) * (v2.z - v0.z) - (v1.z - v0.z) * (v2.x - v0.x);
    const positions =
      crossY < 0
        ? new Float32Array([v0.x, v0.y, v0.z, v1.x, v1.y, v1.z, v2.x, v2.y, v2.z])
        : new Float32Array([v0.x, v0.y, v0.z, v2.x, v2.y, v2.z, v1.x, v1.y, v1.z]);
    const uvs =
      crossY < 0
        ? new Float32Array([0, 0, 1, 0, 0.5, 1])
        : new Float32Array([0, 0, 0.5, 1, 1, 0]);
    const normals = new Float32Array([0, 1, 0, 0, 1, 0, 0, 1, 0]);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    geo.setAttribute('normal', new THREE.BufferAttribute(normals, 3));

    const tex = createGoalTriangleTexture(P ? P.color : null, P?.key === 'yier', anisotropy);
    const mesh = new THREE.Mesh(
      geo,
      new THREE.MeshStandardMaterial({
        map: tex,
        roughness: P?.key === 'yier' || !P ? 0.66 : 0.58,
      }),
    );
    mesh.receiveShadow = true;
    scene.add(mesh);
  };

  buildGoalBay([-1.75, -1.75], [-1.75, 1.75], [0, 0], slotPlayer(0));
  buildGoalBay([1.75, -1.75], [1.75, 1.75], [0, 0], slotPlayer(2));
  buildGoalBay([-1.75, 1.75], [1.75, 1.75], [0, 0], slotPlayer(3));
  buildGoalBay([-1.75, -1.75], [1.75, -1.75], [0, 0], slotPlayer(1));

  // 四条对角乌木镶花梨分界梁
  for (let k = 0; k < 4; k++) {
    const a = k * (Math.PI / 2) + Math.PI / 4;
    const rIn = 0.68;
    const rOut = 2.46;
    const midR = (rIn + rOut) * 0.5;
    const len = rOut - rIn;

    const woodRib = new THREE.Mesh(new THREE.BoxGeometry(0.068, 0.018, len), ebonyInlayMat);
    woodRib.position.set(Math.cos(a) * midR, 0.114, Math.sin(a) * midR);
    woodRib.rotation.y = Math.atan2(Math.cos(a), Math.sin(a));
    woodRib.receiveShadow = true;
    scene.add(woodRib);

    const ridgeRib = new THREE.Mesh(new THREE.BoxGeometry(0.024, 0.022, len - 0.04), chestnutWoodMat);
    ridgeRib.position.set(Math.cos(a) * midR, 0.117, Math.sin(a) * midR);
    ridgeRib.rotation.y = woodRib.rotation.y;
    scene.add(ridgeRib);
  }

  // 终点归位红木莲印垫座（顶面与 y=0.120 严丝合缝）
  players.forEach((P) => {
    const baseDisc = new THREE.Mesh(
      new THREE.CylinderGeometry(0.32, 0.35, 0.014, 8),
      darkRosewoodMat,
    );
    baseDisc.rotation.y = Math.PI / 8;
    baseDisc.position.set(P.final[0], 0.113, P.final[1]);
    baseDisc.receiveShadow = true;
    scene.add(baseDisc);

    const sealRing = new THREE.Mesh(
      new THREE.RingGeometry(0.22, 0.28, 24),
      new THREE.MeshStandardMaterial({
        color: P.key === 'yier' ? 0x5e3b24 : lineOf(P),
        roughness: 0.48,
        metalness: 0.08,
      }),
    );
    sealRing.rotation.x = -Math.PI / 2;
    sealRing.position.set(P.final[0], 0.1208, P.final[1]);
    scene.add(sealRing);

    const innerWoodRing = new THREE.Mesh(new THREE.RingGeometry(0.18, 0.215, 24), boxwoodStudMat);
    innerWoodRing.rotation.x = -Math.PI / 2;
    innerWoodRing.position.set(P.final[0], 0.1206, P.final[1]);
    scene.add(innerWoodRing);
  });

  // 中央八角檀木螺钿骰盘（三层红木束腰底座 + 螺钿木纹盘面，顶面高度 y = 0.250）
  const altarGroup = new THREE.Group();
  const altarTier1 = new THREE.Mesh(
    new THREE.CylinderGeometry(0.64, 0.7, 0.052, 8),
    darkRosewoodMat,
  );
  altarTier1.rotation.y = Math.PI / 8;
  altarTier1.position.y = 0.136;
  altarTier1.castShadow = true;
  altarTier1.receiveShadow = true;
  altarGroup.add(altarTier1);

  const altarCollar = new THREE.Mesh(
    new THREE.CylinderGeometry(0.57, 0.58, 0.014, 8),
    chestnutWoodMat,
  );
  altarCollar.rotation.y = Math.PI / 8;
  altarCollar.position.y = 0.166;
  altarGroup.add(altarCollar);

  const altarWaist = new THREE.Mesh(
    new THREE.CylinderGeometry(0.54, 0.56, 0.036, 8),
    ebonyInlayMat,
  );
  altarWaist.rotation.y = Math.PI / 8;
  altarWaist.position.y = 0.183;
  altarWaist.castShadow = true;
  altarGroup.add(altarWaist);

  const altarTopWood = new THREE.Mesh(
    new THREE.CylinderGeometry(0.59, 0.56, 0.046, 8),
    chestnutWoodMat,
  );
  altarTopWood.rotation.y = Math.PI / 8;
  altarTopWood.position.y = 0.223;
  altarTopWood.castShadow = true;
  altarTopWood.receiveShadow = true;
  altarGroup.add(altarTopWood);

  const altarPlate = new THREE.Mesh(
    new THREE.CylinderGeometry(0.49, 0.5, 0.008, 36),
    new THREE.MeshStandardMaterial({
      map: createDiceAltarTexture(anisotropy),
      roughness: 0.56,
      metalness: 0.06,
    }),
  );
  altarPlate.position.y = 0.246;
  altarPlate.receiveShadow = true;
  altarGroup.add(altarPlate);

  // 八角木雕小望柱桩钉（位于骰子旋转包络半径之外）
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4 + Math.PI / 8;
    const post = new THREE.Mesh(
      new THREE.CylinderGeometry(0.026, 0.032, 0.018, 8),
      darkRosewoodMat,
    );
    post.position.set(Math.cos(a) * 0.535, 0.252, Math.sin(a) * 0.535);
    altarGroup.add(post);

    const stud = new THREE.Mesh(new THREE.SphereGeometry(0.02, 8, 6), boxwoodStudMat);
    stud.scale.y = 0.72;
    stud.position.set(Math.cos(a) * 0.535, 0.264, Math.sin(a) * 0.535);
    altarGroup.add(stud);
  }
  scene.add(altarGroup);

  const trimMat = new THREE.MeshStandardMaterial({
    color: 0xb48f3e,
    roughness: 0.36,
    metalness: 0.55,
  });

  // 四角角楼（紧贴石台顶面 y=0.08，无悬空）
  for (let j = 0; j < 4; j++) {
    const P = slotPlayer(j);
    const sx = j === 0 || j === 3 ? -1 : 1;
    const sz = j === 0 || j === 1 ? -1 : 1;
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.15, 1.04, 1.15), brickMat(1.1, 0.8));
    body.position.y = 0.52;
    body.castShadow = true;
    body.receiveShadow = true;
    g.add(body);
    const band = new THREE.Mesh(new THREE.BoxGeometry(1.36, 0.12, 1.36), merlonMat);
    band.position.y = 1.1;
    g.add(band);
    const roof1 = new THREE.Mesh(new THREE.ConeGeometry(1.12, 0.45, 4), mat(0x46515c, 0.5));
    roof1.position.y = 1.36;
    roof1.rotation.y = Math.PI / 4;
    g.add(roof1);
    const roof2 = new THREE.Mesh(new THREE.ConeGeometry(0.75, 0.42, 4), mat(0x3b454f, 0.5));
    roof2.position.y = 1.66;
    roof2.rotation.y = Math.PI / 4;
    g.add(roof2);
    const bead = new THREE.Mesh(new THREE.SphereGeometry(0.08, 10, 8), trimMat);
    bead.position.y = 1.92;
    g.add(bead);
    const lantMat = new THREE.MeshStandardMaterial({
      color: 0xe5442b,
      emissive: 0xb83018,
      emissiveIntensity: 0.75,
      roughness: 0.4,
    });
      lanternMats.push(lantMat);
    for (const lx of [-1, 1]) {
      for (const lz of [-1, 1]) {
        const l = new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 10), lantMat);
        l.scale.y = 0.85;
        l.position.set(0.74 * lx, 1.0, 0.74 * lz);
        g.add(l);
      }
    }
    const banMat = mat(P ? P.color : 0xb5aea0);
    (
      [
        [-sx * 0.61, 0, 0],
        [0, -sz * 0.61, Math.PI / 2],
      ] as [number, number, number][]
    ).forEach(([bx, bz, ry]) => {
      const b = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.7, 0.48), banMat);
      b.position.set(bx, 0.55, bz);
      b.rotation.y = ry;
      g.add(b);
      const t2 = new THREE.Mesh(new THREE.BoxGeometry(0.065, 0.08, 0.52), trimMat);
      t2.position.set(bx * 0.99, 0.94, bz * 0.99);
      t2.rotation.y = ry;
      g.add(t2);
    });
    g.position.set(sx * 8.38, 0.08, sz * 8.38);
    scene.add(g);
  }

  /* ================= 6. 护城河与草地生态动物 ================= */
  const critters: CritterAnim[] = [];
  const moatDucks: MoatDuckAnim[] = [];
  const swimKois: SwimKoiAnim[] = [];
  const boats: BoatAnim[] = [];

  const furWhite = mat(0xfaf6ef, 0.8);
  const furCream = mat(0xf2e2cb, 0.8);
  const furCocoa = mat(0xd2b393, 0.8);
  const earPink = mat(0xffb6c8, 0.75);
  const nosePink = mat(0xff8fab, 0.55);
  const eyeDark = mat(0x1f1916, 0.25);

  const eyeShineMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const bunnyShadowMat = new THREE.MeshBasicMaterial({
    color: 0x2a5228,
    transparent: true,
    opacity: 0.29,
    depthWrite: false,
  });

  const carrotOrangeMat = mat(0xff7a24, 0.58);
  const carrotLeafMat = mat(0x4ea844, 0.72);
  const tuftBladeMat = mat(0x56ab48, 0.78);
  const burrowHoleMat = mat(0x23170e, 0.96);
  const burrowSoilMat = mat(0x7c5939, 0.92);

  const makeCuteBunny = () => {
    const palette = [
      { main: furWhite, belly: furWhite },
      { main: furCream, belly: furWhite },
      { main: furCocoa, belly: furCream },
    ][(Math.random() * 3) | 0];
    const g = new THREE.Group();

    // 地面柔影（跳跃时留在草地上并随高度缩放淡出）
    const shadowDisc = new THREE.Mesh(new THREE.CircleGeometry(0.19, 16), bunnyShadowMat.clone());
    shadowDisc.rotation.x = -Math.PI / 2;
    shadowDisc.position.y = 0.012;
    g.add(shadowDisc);

    // 地面小草丛（吃草动作时显现于嘴前草地）
    const grassGrp = new THREE.Group();
    grassGrp.position.set(0, 0.01, 0.25);
    for (let k = 0; k < 5; k++) {
      const ba = (k / 5) * Math.PI * 2 + 0.3;
      const blade = new THREE.Mesh(new THREE.ConeGeometry(0.017, 0.12, 4), tuftBladeMat);
      blade.position.set(Math.cos(ba) * 0.036, 0.05, Math.sin(ba) * 0.036);
      blade.rotation.set(Math.sin(ba) * 0.28, 0, -Math.cos(ba) * 0.28);
      grassGrp.add(blade);
    }
    grassGrp.visible = false;
    g.add(grassGrp);

    // 地洞土堆与飞溅土块（打洞钻洞动作时显现）
    const burrowGrp = new THREE.Group();
    burrowGrp.position.set(0, 0.014, 0.27);
    const holeDisc = new THREE.Mesh(new THREE.CircleGeometry(0.165, 16), burrowHoleMat);
    holeDisc.rotation.x = -Math.PI / 2;
    holeDisc.position.y = 0.004;
    burrowGrp.add(holeDisc);

    const soilRim = new THREE.Mesh(new THREE.TorusGeometry(0.175, 0.048, 7, 16), burrowSoilMat);
    soilRim.rotation.x = Math.PI / 2;
    soilRim.scale.set(1.06, 1.0, 0.72);
    soilRim.position.y = 0.008;
    burrowGrp.add(soilRim);

    const dirtChips: THREE.Mesh[] = [];
    for (let k = 0; k < 4; k++) {
      const chip = new THREE.Mesh(new THREE.DodecahedronGeometry(0.025, 0), burrowSoilMat);
      chip.visible = false;
      burrowGrp.add(chip);
      dirtChips.push(chip);
    }
    burrowGrp.visible = false;
    g.add(burrowGrp);

    const bodyPivot = new THREE.Group();
    bodyPivot.position.set(0, 0.02, 0);
    g.add(bodyPivot);

    // 梨形圆润臀背 + 蓬松白肚兜
    const rump = new THREE.Mesh(new THREE.SphereGeometry(0.155, 16, 14), palette.main);
    rump.scale.set(1.02, 0.94, 1.18);
    rump.position.set(0, 0.145, -0.045);
    bodyPivot.add(rump);

    const chest = new THREE.Mesh(new THREE.SphereGeometry(0.125, 14, 12), palette.main);
    chest.scale.set(0.95, 0.96, 1.05);
    chest.position.set(0, 0.155, 0.075);
    bodyPivot.add(chest);

    const bib = new THREE.Mesh(new THREE.SphereGeometry(0.092, 12, 10), palette.belly);
    bib.scale.set(0.9, 0.95, 0.68);
    bib.position.set(0, 0.148, 0.145);
    bodyPivot.add(bib);

    // 饱满后腿枢轴（跳跃向后蹬腿）
    const hindPivot = new THREE.Group();
    hindPivot.position.set(0, 0.09, -0.055);
    bodyPivot.add(hindPivot);
    for (const sx of [-1, 1]) {
      const thigh = new THREE.Mesh(new THREE.SphereGeometry(0.078, 12, 10), palette.main);
      thigh.scale.set(0.72, 1.02, 1.18);
      thigh.position.set(0.105 * sx, 0.01, -0.01);
      hindPivot.add(thigh);
      const foot = new THREE.Mesh(new THREE.SphereGeometry(0.044, 10, 8), palette.belly);
      foot.scale.set(0.85, 0.52, 1.68);
      foot.position.set(0.1 * sx, -0.062, 0.06);
      hindPivot.add(foot);
    }

    // 小前爪枢轴（支持捧胡萝卜、刨土打洞）
    const pawPivots: THREE.Group[] = [];
    for (const sx of [-1, 1]) {
      const pawPivot = new THREE.Group();
      pawPivot.position.set(0.068 * sx, 0.095, 0.135);
      const arm = new THREE.Mesh(new THREE.SphereGeometry(0.036, 10, 8), palette.belly);
      arm.scale.set(0.82, 1.32, 0.96);
      arm.position.set(0, -0.04, 0.025);
      arm.rotation.x = 0.25;
      pawPivot.add(arm);
      bodyPivot.add(pawPivot);
      pawPivots.push(pawPivot);
    }

    // 捧在双爪间的胡萝卜（吃萝卜动作时显现）
    const carrotGrp = new THREE.Group();
    carrotGrp.position.set(0, 0.165, 0.228);
    const carrotBody = new THREE.Mesh(new THREE.ConeGeometry(0.028, 0.145, 8), carrotOrangeMat);
    carrotBody.rotation.x = -Math.PI * 0.62;
    carrotGrp.add(carrotBody);
    for (let k = -1; k <= 1; k++) {
      const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.012, 0.055, 5), carrotLeafMat);
      leaf.position.set(k * 0.013, 0.036, 0.062);
      leaf.rotation.set(0.65, 0, -k * 0.32);
      carrotGrp.add(leaf);
    }
    carrotGrp.visible = false;
    bodyPivot.add(carrotGrp);

    // 圆滚棉花糖尾巴
    const tailPivot = new THREE.Group();
    tailPivot.position.set(0, 0.135, -0.2);
    const tail = new THREE.Mesh(new THREE.SphereGeometry(0.062, 12, 10), furWhite);
    tail.scale.set(1, 0.95, 0.95);
    tailPivot.add(tail);
    bodyPivot.add(tailPivot);

    // 灵动小脑袋（可独立歪头、嗅闻）
    const headPivot = new THREE.Group();
    headPivot.position.set(0, 0.25, 0.14);
    bodyPivot.add(headPivot);

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.125, 16, 14), palette.main);
    head.scale.set(1.06, 0.94, 1.02);
    head.position.set(0, 0.045, 0.03);
    headPivot.add(head);

    for (const sx of [-1, 1]) {
      const cheekPuff = new THREE.Mesh(new THREE.SphereGeometry(0.056, 10, 8), palette.main);
      cheekPuff.scale.set(1.08, 0.85, 0.92);
      cheekPuff.position.set(0.064 * sx, 0.02, 0.095);
      headPivot.add(cheekPuff);

      const blush = new THREE.Mesh(new THREE.SphereGeometry(0.028, 8, 8), earPink);
      blush.scale.set(1.1, 0.62, 0.32);
      blush.position.set(0.094 * sx, 0.024, 0.112);
      headPivot.add(blush);

      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.021, 10, 10), eyeDark);
      eye.position.set(0.068 * sx, 0.065, 0.132);
      headPivot.add(eye);

      const shine = new THREE.Mesh(new THREE.SphereGeometry(0.007, 6, 6), eyeShineMat);
      shine.position.set(0.072 * sx + 0.004, 0.073, 0.149);
      headPivot.add(shine);
    }

    const muzzle = new THREE.Mesh(new THREE.SphereGeometry(0.036, 10, 8), palette.belly);
    muzzle.scale.set(1.15, 0.82, 0.85);
    muzzle.position.set(0, 0.024, 0.142);
    headPivot.add(muzzle);

    const nose = new THREE.Mesh(new THREE.SphereGeometry(0.015, 8, 8), nosePink);
    nose.scale.set(1.25, 0.85, 0.9);
    nose.position.set(0, 0.036, 0.168);
    headPivot.add(nose);

    // 双耳独立枢轴（可分别颤动、微垂、扑风向后掠）
    const earPivots: THREE.Group[] = [];
    for (const sx of [-1, 1]) {
      const earPivot = new THREE.Group();
      earPivot.position.set(0.055 * sx, 0.135, 0.015);
      earPivot.rotation.set(-0.12, 0, -0.18 * sx);
      const ear = new THREE.Mesh(new THREE.SphereGeometry(0.038, 12, 10), palette.main);
      ear.scale.set(0.76, 2.55, 0.5);
      ear.position.set(0, 0.085, 0);
      earPivot.add(ear);
      const inner = new THREE.Mesh(new THREE.SphereGeometry(0.023, 10, 8), earPink);
      inner.scale.set(0.65, 2.05, 0.32);
      inner.position.set(0, 0.082, 0.014);
      earPivot.add(inner);
      headPivot.add(earPivot);
      earPivots.push(earPivot);
    }

    g.userData.bodyPivot = bodyPivot;
    g.userData.headPivot = headPivot;
    g.userData.earL = earPivots[0];
    g.userData.earR = earPivots[1];
    g.userData.pawL = pawPivots[0];
    g.userData.pawR = pawPivots[1];
    g.userData.hindPivot = hindPivot;
    g.userData.tailPivot = tailPivot;
    g.userData.shadowDisc = shadowDisc;
    g.userData.carrotGrp = carrotGrp;
    g.userData.grassGrp = grassGrp;
    g.userData.burrowGrp = burrowGrp;
    g.userData.dirtChips = dirtChips;
    g.rotation.y = rnd(0, 6.28);
    return g;
  };

  const makeSeagull = (): {
    g: THREE.Group;
    mode: BirdFlightMode;
    scale: number;
    dur: number;
    species: BirdSpecies;
  } => {
    const whiteMat = mat(0xfbf9f3, 0.56);
    const greyMat = mat(0x666a70, 0.58);
    const tipMat = mat(0x2e231e, 0.56);
    const beakYellowMat = mat(0xf1b632, 0.42);
    const legYellowMat = mat(0xe8a928, 0.45);

    const g = new THREE.Group();
    const bodyRoot = new THREE.Group();
    g.add(bodyRoot);

    // 圆润饱满的白色海鸥躯干与挺拔胸颈曲线
    const torso = new THREE.Mesh(new THREE.SphereGeometry(0.112, 16, 14), whiteMat);
    torso.scale.set(0.86, 0.84, 1.32);
    torso.rotation.x = -0.18;
    torso.castShadow = true;
    bodyRoot.add(torso);

    const chestBridge = new THREE.Mesh(new THREE.SphereGeometry(0.086, 14, 12), whiteMat);
    chestBridge.scale.set(0.84, 0.96, 0.94);
    chestBridge.position.set(0, 0.048, 0.082);
    chestBridge.castShadow = true;
    bodyRoot.add(chestBridge);

    // 灰羽背鞍（衔接双翼）
    const mantle = new THREE.Mesh(new THREE.SphereGeometry(0.094, 14, 12), greyMat);
    mantle.scale.set(0.84, 0.48, 1.12);
    mantle.position.set(0, 0.044, -0.022);
    mantle.rotation.x = -0.18;
    bodyRoot.add(mantle);

    // 可独立扭头张望的 Q 版圆白小脑袋 + 小豆眼 + 短圆黄喙
    const headPivot = new THREE.Group();
    headPivot.position.set(0, 0.11, 0.11);
    bodyRoot.add(headPivot);

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.078, 16, 14), whiteMat);
    head.scale.set(0.97, 0.97, 1.02);
    head.position.set(0, 0.026, 0.008);
    head.castShadow = true;
    headPivot.add(head);

    for (const sx of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.0115, 8, 8), eyeDark);
      eye.position.set(0.052 * sx, 0.036, 0.056);
      headPivot.add(eye);
    }

    const upperBill = new THREE.Mesh(new THREE.SphereGeometry(0.025, 12, 10), beakYellowMat);
    upperBill.scale.set(0.68, 0.56, 1.36);
    upperBill.position.set(0, 0.018, 0.092);
    upperBill.rotation.x = 0.14;
    headPivot.add(upperBill);

    const lowerBill = new THREE.Mesh(new THREE.SphereGeometry(0.02, 10, 8), beakYellowMat);
    lowerBill.scale.set(0.62, 0.36, 1.15);
    lowerBill.position.set(0, 0.005, 0.086);
    lowerBill.rotation.x = 0.05;
    headPivot.add(lowerBill);

    // 站立停歇时收拢的杏仁形灰翼 + 黑棕飞羽尾尖（还原参考图侧影）
    const foldedWings = new THREE.Group();
    for (const sx of [-1, 1]) {
      const fWing = new THREE.Mesh(new THREE.SphereGeometry(0.078, 14, 12), greyMat);
      fWing.scale.set(0.56, 0.78, 1.65);
      fWing.position.set(0.082 * sx, 0.028, -0.042);
      fWing.rotation.set(-0.18, sx * -0.16, sx * 0.18);
      fWing.castShadow = true;
      foldedWings.add(fWing);

      const fTip = new THREE.Mesh(new THREE.ConeGeometry(0.028, 0.145, 8), tipMat);
      fTip.scale.set(0.62, 1, 0.88);
      fTip.position.set(0.034 * sx, -0.004, -0.178);
      fTip.rotation.set(-Math.PI / 2 - 0.18, 0, sx * 0.1);
      foldedWings.add(fTip);
    }
    const foldedTail = new THREE.Mesh(new THREE.BoxGeometry(0.068, 0.018, 0.13), tipMat);
    foldedTail.position.set(0, -0.008, -0.18);
    foldedTail.rotation.x = -0.18;
    foldedWings.add(foldedTail);
    foldedWings.visible = false;
    bodyRoot.add(foldedWings);

    // 飞行展开双翼（灰色主翼 + 深棕黑翼梢）
    const lw = new THREE.Group();
    lw.position.set(-0.066, 0.035, 0.02);
    const rw = new THREE.Group();
    rw.position.set(0.066, 0.035, 0.02);
    const wingSpan = 0.31;
    const wingChord = 0.135;
    for (const [wg, sx] of [
      [lw, -1],
      [rw, 1],
    ] as const) {
      const inner = new THREE.Mesh(new THREE.SphereGeometry(0.5, 10, 8), greyMat);
      inner.scale.set(wingSpan, 0.032, wingChord);
      inner.position.set(sx * wingSpan * 0.45, 0, -0.01);
      wg.add(inner);

      const tip = new THREE.Mesh(
        new THREE.ConeGeometry(wingChord * 0.42, wingSpan * 0.56, 5),
        tipMat,
      );
      tip.scale.set(1, 1, 0.25);
      tip.rotation.z = (sx * -Math.PI) / 2;
      tip.rotation.y = sx * -0.28;
      tip.position.set(sx * wingSpan * 0.92, 0, -0.035);
      wg.add(tip);
      bodyRoot.add(wg);
    }

    const flyTail = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.016, 0.13), tipMat);
    flyTail.position.set(0, 0.012, -0.175);
    flyTail.rotation.x = 0.14;
    bodyRoot.add(flyTail);

    // 细黄脚丫（停落时从腹下伸出，脚底恰好位于 local y = 0 贴合布布头顶）
    const legsGrp = new THREE.Group();
    legsGrp.position.set(0, -0.05, 0.006);
    for (const sx of [-1, 1]) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.0085, 0.0075, 0.095, 7), legYellowMat);
      leg.position.set(0.034 * sx, -0.045, 0);
      legsGrp.add(leg);

      const foot = new THREE.Mesh(new THREE.BoxGeometry(0.028, 0.009, 0.044), legYellowMat);
      foot.position.set(0.034 * sx, -0.0905, 0.012);
      legsGrp.add(foot);
    }
    legsGrp.visible = false;
    bodyRoot.add(legsGrp);

    g.userData.bodyRoot = bodyRoot;
    g.userData.headPivot = headPivot;
    g.userData.foldedWings = foldedWings;
    g.userData.flyTail = flyTail;
    g.userData.legsGrp = legsGrp;
    g.userData.lw = lw;
    g.userData.rw = rw;

    const scale = 0.94;
    g.scale.setScalar(scale);
    return {
      g,
      mode: Math.random() < 0.6 ? 'soar' : 'circle',
      scale,
      dur: rnd(10.5, 14.5),
      species: 'seagull',
    };
  };

  const makeCuteBird = (
    forcedSpecies?: BirdSpecies,
  ): {
    g: THREE.Group;
    mode: BirdFlightMode;
    scale: number;
    dur: number;
    species: BirdSpecies;
  } => {
    const speciesRoll = Math.random();
    const species: BirdSpecies =
      forcedSpecies ??
      (speciesRoll < 0.2
        ? 'seagull'
        : speciesRoll < 0.4
          ? 'egret'
          : speciesRoll < 0.6
            ? 'swallow'
            : speciesRoll < 0.8
              ? 'kingfisher'
              : speciesRoll < 0.92
                ? 'oriole'
                : 'robin');

    if (species === 'seagull') {
      return makeSeagull();
    }

    const palette = {
      egret: {
        back: mat(0xfbf9f4, 0.62),
        belly: mat(0xf5f2ea, 0.65),
        wingTip: mat(0xe8e4da, 0.65),
        beak: mat(0xeba128, 0.45),
        accent: mat(0xdfdbd0, 0.65),
        mode: (Math.random() < 0.65 ? 'soar' : 'circle') as BirdFlightMode,
        scale: rnd(1.12, 1.38),
        dur: rnd(11, 16),
      },
      swallow: {
        back: mat(0x28364c, 0.52),
        belly: mat(0xf6f0e4, 0.65),
        wingTip: mat(0x1f2838, 0.52),
        beak: mat(0x3a3532, 0.5),
        accent: mat(0xd86b4a, 0.65),
        mode: (Math.random() < 0.7 ? 'swoop' : 'bound') as BirdFlightMode,
        scale: rnd(0.86, 1.05),
        dur: rnd(7.5, 10.5),
      },
      kingfisher: {
        back: mat(0x1e8fa6, 0.5),
        belly: mat(0xe6843c, 0.62),
        wingTip: mat(0x16687c, 0.52),
        beak: mat(0x2e2a28, 0.45),
        accent: mat(0x4fc3d9, 0.5),
        mode: (Math.random() < 0.6 ? 'swoop' : 'bound') as BirdFlightMode,
        scale: rnd(0.84, 1.02),
        dur: rnd(8, 11.5),
      },
      oriole: {
        back: mat(0xf2be35, 0.58),
        belly: mat(0xf9d866, 0.62),
        wingTip: mat(0x262426, 0.58),
        beak: mat(0xd96e52, 0.5),
        accent: mat(0x262426, 0.58),
        mode: (Math.random() < 0.65 ? 'circle' : 'soar') as BirdFlightMode,
        scale: rnd(0.95, 1.15),
        dur: rnd(10, 14),
      },
      robin: {
        back: mat(0x7c5a42, 0.66),
        belly: mat(0xf08458, 0.68),
        wingTip: mat(0x5b4230, 0.66),
        beak: mat(0xf2b942, 0.5),
        accent: mat(0xefe6d8, 0.68),
        mode: 'bound' as BirdFlightMode,
        scale: rnd(0.82, 1.05),
        dur: rnd(8.5, 12),
      },
    }[species];

    const g = new THREE.Group();
    const isEgret = species === 'egret';
    const isSwallow = species === 'swallow';

    const body = new THREE.Mesh(new THREE.SphereGeometry(0.115, 14, 12), palette.back);
    body.scale.set(isEgret ? 0.72 : 0.92, isEgret ? 0.7 : 0.86, isEgret ? 1.52 : 1.3);
    g.add(body);

    const belly = new THREE.Mesh(new THREE.SphereGeometry(0.092, 12, 10), palette.belly);
    belly.scale.set(0.86, 0.78, 1.12);
    belly.position.set(0, -0.022, 0.032);
    g.add(belly);

    if (species === 'swallow') {
      const throat = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8), palette.accent);
      throat.position.set(0, 0.02, 0.115);
      g.add(throat);
    } else if (species === 'oriole') {
      const mask = new THREE.Mesh(new THREE.SphereGeometry(0.056, 10, 8), palette.accent);
      mask.scale.set(1.12, 0.75, 0.85);
      mask.position.set(0, 0.082, 0.145);
      g.add(mask);
    } else if (species === 'kingfisher') {
      const crest = new THREE.Mesh(new THREE.ConeGeometry(0.032, 0.085, 6), palette.accent);
      crest.rotation.x = -0.65;
      crest.position.set(0, 0.135, 0.075);
      g.add(crest);
    }

    const head = new THREE.Mesh(
      new THREE.SphereGeometry(isEgret ? 0.062 : 0.08, 12, 10),
      palette.back,
    );
    head.position.set(0, isEgret ? 0.115 : 0.08, isEgret ? 0.195 : 0.118);
    g.add(head);

    if (isEgret) {
      const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.036, 0.15, 8), palette.back);
      neck.rotation.x = 0.88;
      neck.position.set(0, 0.065, 0.145);
      g.add(neck);
      const plume = new THREE.Mesh(new THREE.ConeGeometry(0.016, 0.11, 5), palette.accent);
      plume.rotation.x = -1.25;
      plume.position.set(0, 0.13, 0.135);
      g.add(plume);
      for (const sx of [-1, 1]) {
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.006, 0.28, 5), palette.beak);
        leg.rotation.x = Math.PI / 2 - 0.06;
        leg.position.set(0.026 * sx, -0.02, -0.22);
        g.add(leg);
      }
    }

    const beakLen = isEgret ? 0.16 : species === 'kingfisher' ? 0.11 : 0.068;
    const beak = new THREE.Mesh(
      new THREE.ConeGeometry(isEgret ? 0.02 : 0.024, beakLen, 6),
      palette.beak,
    );
    beak.rotation.x = Math.PI / 2;
    beak.position.set(
      0,
      isEgret ? 0.108 : 0.072,
      (isEgret ? 0.195 : 0.118) + beakLen * 0.5 + 0.045,
    );
    g.add(beak);

    for (const sx of [-1, 1]) {
      const e = new THREE.Mesh(new THREE.SphereGeometry(0.014, 6, 6), eyeDark);
      e.position.set(
        (isEgret ? 0.038 : 0.048) * sx,
        isEgret ? 0.128 : 0.096,
        isEgret ? 0.225 : 0.172,
      );
      g.add(e);
    }

    // 肩关节铰链双翼（主翼 + 翼梢飞羽）
    const wingSpan = isEgret ? 0.34 : isSwallow ? 0.29 : 0.24;
    const wingChord = isEgret ? 0.15 : isSwallow ? 0.11 : 0.13;
    const lw = new THREE.Group();
    lw.position.set(-0.075, 0.025, 0.02);
    const rw = new THREE.Group();
    rw.position.set(0.075, 0.025, 0.02);
    for (const [wg, sx] of [
      [lw, -1],
      [rw, 1],
    ] as const) {
      const inner = new THREE.Mesh(new THREE.SphereGeometry(0.5, 10, 8), palette.back);
      inner.scale.set(wingSpan, 0.032, wingChord);
      inner.position.set(sx * wingSpan * 0.45, 0, -0.01);
      wg.add(inner);

      const tip = new THREE.Mesh(new THREE.ConeGeometry(wingChord * 0.42, wingSpan * 0.58, 5), palette.wingTip);
      tip.scale.set(1, 1, 0.25);
      tip.rotation.z = sx * -Math.PI / 2;
      tip.rotation.y = sx * -0.28;
      tip.position.set(sx * wingSpan * 0.92, 0, -0.035);
      wg.add(tip);
      g.add(wg);
    }

    // 尾羽（燕子使用标志性剪刀叉尾，其它鸟类为扇形尾羽）
    if (isSwallow) {
      for (const sx of [-1, 1]) {
        const fork = new THREE.Mesh(new THREE.ConeGeometry(0.022, 0.2, 4), palette.wingTip);
        fork.scale.set(0.9, 1, 0.22);
        fork.rotation.x = -Math.PI / 2 + 0.12;
        fork.rotation.z = sx * 0.24;
        fork.position.set(0.035 * sx, 0.022, -0.22);
        g.add(fork);
      }
    } else {
      const tail = new THREE.Mesh(new THREE.BoxGeometry(isEgret ? 0.11 : 0.09, 0.016, 0.14), palette.wingTip);
      tail.position.set(0, 0.025, -0.18);
      tail.rotation.x = 0.18;
      g.add(tail);
    }

    g.userData.lw = lw;
    g.userData.rw = rw;
    g.scale.setScalar(palette.scale);
    return { g, mode: palette.mode, scale: palette.scale, dur: palette.dur, species };
  };

  const fMats = [0xff8ab8, 0x67b8e3, 0xffcf56, 0xb896ff].map(
    (c) =>
      new THREE.MeshStandardMaterial({
        color: c,
        roughness: 0.5,
        side: THREE.DoubleSide,
      }),
  );
  const makeButterfly = () => {
    const m = fMats[(Math.random() * 4) | 0];
    const g = new THREE.Group();
    const b = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.16, 6), eyeDark);
    b.rotation.x = Math.PI / 2;
    g.add(b);
    const lw = new THREE.Group();
    const rw = new THREE.Group();
    const wTop = new THREE.CircleGeometry(0.095, 12);
    const wBot = new THREE.CircleGeometry(0.07, 10);
    for (const [grp, sign] of [
      [lw, -1],
      [rw, 1],
    ] as const) {
      const t = new THREE.Mesh(wTop, m);
      t.position.set(0.08 * sign, 0, 0.04);
      t.rotation.x = -Math.PI / 2;
      grp.add(t);
      const bt = new THREE.Mesh(wBot, m);
      bt.position.set(0.065 * sign, 0, -0.05);
      bt.rotation.x = -Math.PI / 2;
      grp.add(bt);
      g.add(grp);
    }
    g.userData.lw = lw;
    g.userData.rw = rw;
    return g;
  };

  const koiRed = mat(0xe6643a, 0.48);
  const koiWhite = mat(0xf4efe4, 0.52);
  const koiGold = mat(0xe7ac38, 0.48);
  const koiJade = mat(0x527d78, 0.52);
  const koiSilver = mat(0xd7e1db, 0.54);
  const koiInk = mat(0x2d3238, 0.55);
  const koiFinGold = new THREE.MeshStandardMaterial({
    color: 0xf4c76b,
    roughness: 0.55,
    transparent: true,
    opacity: 0.85,
    side: THREE.DoubleSide,
  });
  const koiFinWhite = new THREE.MeshStandardMaterial({
    color: 0xf6f3ea,
    roughness: 0.55,
    transparent: true,
    opacity: 0.85,
    side: THREE.DoubleSide,
  });

  const makeKoi = (variantIdx?: number) => {
    const kindIdx = variantIdx ?? ((Math.random() * 4) | 0);
    const fishKind = (['kohaku', 'tricolor', 'goldfish', 'jadeCarp'] as const)[kindIdx % 4];
    const isGoldfish = fishKind === 'goldfish';
    const baseM =
      fishKind === 'goldfish'
        ? koiGold
        : fishKind === 'jadeCarp'
          ? koiJade
          : koiWhite;
    const patchM =
      fishKind === 'jadeCarp' ? koiSilver : fishKind === 'goldfish' ? koiRed : koiRed;
    const finM = fishKind === 'goldfish' ? koiFinGold : koiFinWhite;

    const g = new THREE.Group();

    // 头部微摆枢轴（流线鼻吻 + 双眼）
    const headPivot = new THREE.Group();
    headPivot.position.set(0, 0, 0.075);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.072, 12, 10), baseM);
    head.scale.set(isGoldfish ? 0.92 : 0.76, isGoldfish ? 0.88 : 0.74, 1.08);
    head.position.set(0, 0, 0.03);
    headPivot.add(head);
    if (fishKind === 'kohaku' || fishKind === 'tricolor') {
      const crownSpot = new THREE.Mesh(new THREE.SphereGeometry(0.044, 10, 8), patchM);
      crownSpot.scale.set(0.88, 0.62, 1.05);
      crownSpot.position.set(0, 0.03, 0.035);
      headPivot.add(crownSpot);
    }
    for (const sx of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.013, 6, 6), eyeDark);
      eye.position.set((isGoldfish ? 0.048 : 0.039) * sx, 0.018, 0.072);
      headPivot.add(eye);
    }
    g.add(headPivot);

    // 主躯干 + 斑纹 + 背鳍 + 双侧胸鳍
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.095, 14, 12), baseM);
    body.scale.set(isGoldfish ? 0.84 : 0.68, isGoldfish ? 0.92 : 0.72, isGoldfish ? 1.35 : 1.55);
    body.position.set(0, 0, 0.01);
    g.add(body);

    const belly = new THREE.Mesh(
      new THREE.SphereGeometry(0.078, 12, 10),
      fishKind === 'jadeCarp' ? koiSilver : koiWhite,
    );
    belly.scale.set(isGoldfish ? 0.82 : 0.64, 0.62, 1.25);
    belly.position.set(0, -0.025, 0.015);
    g.add(belly);

    const saddle = new THREE.Mesh(new THREE.SphereGeometry(0.068, 10, 8), patchM);
    saddle.scale.set(0.76, 0.56, 1.18);
    saddle.position.set(0, isGoldfish ? 0.045 : 0.032, 0.02);
    g.add(saddle);

    if (fishKind === 'tricolor') {
      const inkSpot = new THREE.Mesh(new THREE.SphereGeometry(0.042, 8, 8), koiInk);
      inkSpot.scale.set(0.85, 0.6, 0.95);
      inkSpot.position.set(0.016, 0.035, -0.045);
      g.add(inkSpot);
    }

    const dorsal = new THREE.Mesh(new THREE.ConeGeometry(0.045, isGoldfish ? 0.12 : 0.09, 4), finM);
    dorsal.scale.set(0.2, 1, 1.65);
    dorsal.rotation.x = -0.35;
    dorsal.position.set(0, isGoldfish ? 0.09 : 0.07, -0.02);
    g.add(dorsal);

    const finGeo = new THREE.CircleGeometry(isGoldfish ? 0.058 : 0.046, 8);
    const finL = new THREE.Group();
    finL.position.set(isGoldfish ? -0.068 : -0.054, -0.016, 0.05);
    const finR = new THREE.Group();
    finR.position.set(isGoldfish ? 0.068 : 0.054, -0.016, 0.05);
    for (const [fg, sx] of [
      [finL, -1],
      [finR, 1],
    ] as const) {
      const fm = new THREE.Mesh(finGeo, finM);
      fm.rotation.x = -Math.PI / 2;
      fm.scale.set(1.25, 0.72, 1);
      fm.position.set(sx * 0.04, 0, -0.015);
      fg.add(fm);
      g.add(fg);
    }

    // 中段尾柄枢轴 + 尾鳍枢轴（实现真正游动的S型波浪传导）
    const midPivot = new THREE.Group();
    midPivot.position.set(0, 0, -0.085);
    const midBody = new THREE.Mesh(new THREE.SphereGeometry(0.058, 10, 8), baseM);
    midBody.scale.set(0.56, 0.66, 1.32);
    midBody.position.set(0, 0, -0.045);
    midPivot.add(midBody);
    g.add(midPivot);

    const tailPivot = new THREE.Group();
    tailPivot.position.set(0, 0, -0.1);
    if (isGoldfish) {
      for (const sx of [-1, 1]) {
        const lobe = new THREE.Mesh(new THREE.ConeGeometry(0.068, 0.2, 5), finM);
        lobe.scale.set(0.24, 1, 0.95);
        lobe.rotation.x = Math.PI / 2;
        lobe.rotation.z = sx * 0.28;
        lobe.position.set(0.025 * sx, -0.008, -0.095);
        tailPivot.add(lobe);
      }
    } else {
      for (const sy of [-1, 1]) {
        const lobe = new THREE.Mesh(new THREE.ConeGeometry(0.042, 0.145, 4), finM);
        lobe.scale.set(0.22, 1, 0.85);
        lobe.rotation.x = Math.PI / 2 - sy * 0.36;
        lobe.position.set(0, 0.024 * sy, -0.068);
        tailPivot.add(lobe);
      }
    }
    midPivot.add(tailPivot);

    g.userData.headPivot = headPivot;
    g.userData.midPivot = midPivot;
    g.userData.tail = tailPivot;
    g.userData.finL = finL;
    g.userData.finR = finR;
    g.scale.setScalar(isGoldfish ? 0.88 : rnd(0.92, 1.12));
    return g;
  };

  const duckYellow = mat(0xf7d038, 0.55);
  const duckWhite = mat(0xfbf8f0, 0.55);
  const duckBill = mat(0xf08c24, 0.45);
  const makeMoatDuck = (isYellow: boolean) => {
    const m = isYellow ? duckYellow : duckWhite;
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.14, 14, 12), m);
    body.scale.set(0.85, 0.72, 1.28);
    body.position.y = 0.04;
    g.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.095, 14, 12), m);
    head.position.set(0, 0.17, 0.12);
    g.add(head);
    const bill = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 8), duckBill);
    bill.scale.set(1.15, 0.42, 1.25);
    bill.position.set(0, 0.145, 0.22);
    g.add(bill);
    for (const sx of [-1, 1]) {
      const e = new THREE.Mesh(new THREE.SphereGeometry(0.016, 8, 8), eyeDark);
      e.position.set(0.058 * sx, 0.19, 0.185);
      g.add(e);
    }
    return g;
  };

  [true, false].forEach((isY, idx) => {
    const d = makeMoatDuck(isY);
    scene.add(d);
    moatDucks.push({
      g: d,
      th: idx * 3.14 + 0.8,
      speed: 0.042 * (idx === 0 ? 1 : -1),
      rOff: idx === 0 ? 0.72 : -0.72,
      bob: idx * 2,
    });
  });

  const swimStyles: FishSwimStyle[] = ['cruise', 'burst', 'dart', 'cruise', 'burst', 'hover'];
  for (let i = 0; i < 6; i++) {
    const k = makeKoi(i);
    scene.add(k);
    const baseROff = rnd(-1.05, 1.05);
    swimKois.push({
      g: k,
      th: i * 1.05,
      speed: (i % 2 ? 1 : -1) * rnd(0.022, 0.036),
      rOff: baseROff,
      baseROff,
      phase: i * 1.7,
      swimPhase: i * 1.3,
      style: swimStyles[i],
    });
  }

  const spawnCritter = (
    kind: 'rabbit' | 'bird' | 'fly' | 'fish',
    opts?: SpawnBirdOptions,
  ) => {
    if (kind === 'rabbit') {
      const g = makeCuteBunny();
      let x = 25.0;
      let z = 6;
      for (let tTry = 0; tTry < 24; tTry++) {
        const a = rnd(0, 6.28);
        const r = rnd(22.1, 30.0);
        const cx = Math.cos(a) * r;
        const cz = Math.sin(a) * r;
        if (r >= moatOuterR(a) + 1.55 && Math.min(Math.abs(cx), Math.abs(cz)) >= 1.85) {
          x = cx;
          z = cz;
          break;
        }
      }
      const baseScale = rnd(0.65, 0.77);
      g.scale.setScalar(baseScale);
      g.position.set(x, hillH(x, z), z);
      const dir = rnd(0, 6.28);
      g.rotation.y = -dir + Math.PI / 2;
      scene.add(g);
      critters.push({
        kind: 'rabbit',
        g,
        ttl: rnd(18, 30),
        state: 'rest',
        rest: rnd(0.32, 0.95),
        stateT: 0,
        stateDur: 0,
        hopT: 0,
        hopDur: rnd(0.34, 0.45),
        dir,
        phase: rnd(0, 6.28),
        hopH: rnd(0.26, 0.36),
        baseScale,
      });
    } else if (kind === 'bird') {
      const { g, mode, dur, species } = makeCuteBird(opts?.species);
      const hasActivePerch = critters.some((c) => c.kind === 'bird' && c.perchTarget);
      const wantPerch =
        species === 'seagull' &&
        !hasActivePerch &&
        rideToys.length > 0 &&
        (opts?.perch === true || (opts?.perch !== false && Math.random() < 0.72));

      if (wantPerch) {
        const bubuToys = rideToys.filter((rt) => rt.species === 'bear');
        const pool = bubuToys.length > 0 ? bubuToys : rideToys;
        const targetToy = pool[(Math.random() * pool.length) | 0];
        targetToy.headPivot.updateWorldMatrix(true, false);
        const headCrown = new THREE.Vector3(0, 0.514, 0);
        targetToy.headPivot.localToWorld(headCrown);

        const approachAngle =
          Math.atan2(headCrown.x, headCrown.z) + rnd(-0.85, 0.85);
        const R = rnd(21.0, 26.5);
        const from = new THREE.Vector3(
          Math.sin(approachAngle) * R,
          rnd(6.4, 8.6),
          Math.cos(approachAngle) * R,
        );
        const midPt = from.clone().lerp(headCrown, 0.52);
        const perpX = -Math.cos(approachAngle);
        const perpZ = Math.sin(approachAngle);
        const sideSwing = (Math.random() < 0.5 ? 1 : -1) * rnd(2.2, 4.4);
        const ctrl = new THREE.Vector3(
          midPt.x + perpX * sideSwing,
          headCrown.y + rnd(3.2, 4.6),
          midPt.z + perpZ * sideSwing,
        );
        g.position.copy(from);
        g.lookAt(ctrl);
        scene.add(g);
        critters.push({
          kind: 'bird',
          g,
          ttl: 40,
          from,
          to: headCrown.clone(),
          ctrl,
          prog: 0,
          dur: 3.4,
          flap: rnd(0, 6),
          mode: 'soar',
          phase: rnd(0, 6.28),
          circleR: 15,
          circleSpeed: 5,
          species,
          perchTarget: targetToy,
          perchPhase: 'approach',
          perchT: 0,
          perchDur: rnd(3.1, 3.8),
          perchYaw: (Math.random() < 0.5 ? -1 : 1) * Math.PI * 0.42,
        });
        return;
      }

      const a = rnd(0, 6.28);
      const R = rnd(24.5, 30.5);
      const h =
        mode === 'soar' || mode === 'circle'
          ? rnd(7.2, 10.6)
          : mode === 'swoop'
            ? rnd(6.8, 9.2)
            : rnd(4.5, 7.2);
      const from = new THREE.Vector3(Math.cos(a) * R, h, Math.sin(a) * R);
      const to = new THREE.Vector3(
        -from.x + rnd(-9, 9),
        h + rnd(-1.4, 1.8),
        -from.z + rnd(-9, 9),
      );
      const midAngle = a + (Math.random() < 0.5 ? 1 : -1) * rnd(0.9, 1.5);
      const ctrlR = mode === 'swoop' ? rnd(15.0, 19.0) : rnd(10.0, 16.5);
      const ctrlY =
        mode === 'swoop'
          ? rnd(2.5, 3.8)
          : mode === 'soar'
            ? h + rnd(1.0, 2.2)
            : (from.y + to.y) * 0.5 + rnd(-0.6, 1.2);
      const ctrl = new THREE.Vector3(Math.cos(midAngle) * ctrlR, ctrlY, Math.sin(midAngle) * ctrlR);
      g.position.copy(from);
      g.lookAt(ctrl);
      scene.add(g);
      critters.push({
        kind: 'bird',
        g,
        ttl: 40,
        from,
        to,
        ctrl,
        prog: 0,
        dur,
        flap: rnd(0, 6),
        mode,
        phase: rnd(0, 6.28),
        circleR: rnd(13.5, 19.0),
        circleSpeed: (Math.random() < 0.5 ? 1 : -1) * rnd(4.5, 6.5),
        species,
      });
    } else if (kind === 'fly') {
      const g = makeButterfly();
      const a = rnd(0, 6.28);
      const r = rnd(21.5, 36.0);
      const cx = Math.cos(a) * r;
      const cz = Math.sin(a) * r;
      g.position.set(cx, -0.2, cz);
      scene.add(g);
      critters.push({
        kind: 'fly',
        g,
        ttl: rnd(9, 16),
        seed: rnd(0, 100),
        flap: rnd(0, 6),
        cx,
        cz,
      });
    } else {
      let a = rnd(0, 6.28);
      let rr = moatChannelR(a, rnd(-0.8, 0.8), 1.05);
      for (let tTry = 0; tTry < 8; tTry++) {
        if (Math.min(Math.abs(Math.cos(a) * rr), Math.abs(Math.sin(a) * rr)) >= 1.5) break;
        a = rnd(0, 6.28);
        rr = moatChannelR(a, rnd(-0.8, 0.8), 1.05);
      }
      const g = makeKoi();
      g.position.set(Math.cos(a) * rr, WATER_Y - 0.08, Math.sin(a) * rr);
      g.rotation.y = a + Math.PI / 2;
      scene.add(g);
      critters.push({
        kind: 'fish',
        g,
        ttl: 2,
        prog: 0,
        h: rnd(0.5, 0.78),
      });
    }
  };

  spawnCritter('rabbit');
  spawnCritter('rabbit');
  spawnCritter('rabbit');
  spawnCritter('bird');
  spawnCritter('bird');

  // 乌篷画舫小木船与船夫、游船人物
  {
    const hullW = 0.48;
    const hullH = 0.16;
    const hullL = 1.86;
    const hullGeo = new THREE.BoxGeometry(hullW, hullH, hullL, 10, 4, 28);
    const hPos = hullGeo.attributes.position;
    for (let i = 0; i < hPos.count; i++) {
      let x = hPos.getX(i);
      let y = hPos.getY(i);
      const z = hPos.getZ(i);
      const t = z / (hullL / 2); // -1 stern .. +1 bow
      const at = Math.min(1, Math.abs(t));
      const widthTaper = Math.pow(Math.max(0.05, 1 - Math.pow(at, 2.1)), 0.56);
      const flare = y > 0 ? 1.1 : 0.72;
      const rocker = 0.145 * Math.pow(at, 2.35);
      const depthTaper = 1 - 0.38 * Math.pow(at, 2.2);
      x *= widthTaper * flare;
      y = y * depthTaper + rocker;
      hPos.setXYZ(i, x, y, z);
    }
    hullGeo.computeVertexNormals();

    const woodMat2 = mat(0x9a6f44, 0.72);
    const woodDeckMat = mat(0xb88b5a, 0.76);
    const woodDark = mat(0x5c4028, 0.78);
    const canopyOuterMat = new THREE.MeshStandardMaterial({
      color: 0x3b3530,
      roughness: 0.85,
      side: THREE.DoubleSide,
    });
    const canopyInnerMat = new THREE.MeshStandardMaterial({
      color: 0x9b744b,
      roughness: 0.82,
      side: THREE.DoubleSide,
    });
    const bodyMat = mat(0x465e73, 0.72);
    const pantsMat = mat(0x2d3843, 0.78);
    const sashRedMat = mat(0xc84d3b, 0.65);
    const hatMat = mat(0xd8c38a, 0.78);
    const hatRimMat = mat(0x8e7242, 0.8);
    const oarMat = mat(0x7c5b37, 0.74);
    const oarPaddleMat = mat(0x634527, 0.76);
    const skinMat = mat(0xf6dcc2, 0.58);
    const blushMat = mat(0xf39ca3, 0.68);
    const eyeDark = mat(0x1f1916, 0.22);
    const lipMat = mat(0xde7a82, 0.55);
    const hairMat = mat(0x221f25, 0.48);
    const goldAccent = mat(0xd8b14a, 0.36);
    const jadeMat = mat(0x6ec2a8, 0.4);
    const ivoryTrimMat = mat(0xf5f0e4, 0.62);
    const pinkRibbonMat = mat(0xf2b9c2, 0.62);
    const deepTealTrimMat = mat(0x275755, 0.66);
    const fanPaperMat = mat(0xf8f1dc, 0.68);
    const teaPotMat = mat(0x88c2b2, 0.35);
    const wakeTex = createWakeTexture(anisotropy);
    const hullFoamTex = createHullFoamTexture(anisotropy);
    const wakeMat = new THREE.MeshBasicMaterial({
      map: wakeTex,
      transparent: true,
      opacity: 0.58,
      side: THREE.DoubleSide,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    });
    const hullFoamMat = new THREE.MeshBasicMaterial({
      map: hullFoamTex,
      transparent: true,
      opacity: 0.72,
      side: THREE.DoubleSide,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    });
    const lantMat = new THREE.MeshStandardMaterial({
      color: 0xffbc4d,
      emissive: 0xe68419,
      emissiveIntensity: 0.9,
      roughness: 0.35,
    });
      lanternMats.push(lantMat);

    const addCuteFace = (parent: THREE.Group, headY: number, zOff: number, refined = false) => {
      for (const sx of [-1, 1]) {
        const eye = new THREE.Mesh(new THREE.SphereGeometry(refined ? 0.0068 : 0.0082, 8, 6), eyeDark);
        eye.position.set((refined ? 0.016 : 0.02) * sx, headY + 0.004, zOff);
        parent.add(eye);
        const cheek = new THREE.Mesh(new THREE.SphereGeometry(refined ? 0.0085 : 0.0105, 8, 6), blushMat);
        cheek.scale.set(1.1, 0.62, 0.42);
        cheek.position.set((refined ? 0.024 : 0.03) * sx, headY - 0.009, zOff - 0.005);
        parent.add(cheek);
      }
      if (refined) {
        const lip = new THREE.Mesh(new THREE.SphereGeometry(0.0046, 6, 6), lipMat);
        lip.scale.set(1.3, 0.55, 0.5);
        lip.position.set(0, headY - 0.017, zOff + 0.001);
        parent.add(lip);
      }
    };

    const makeBoat = (
      dir: number,
      initTh: number,
      rOff: number,
      passenger: { cloth: number; variant: 'scholar' | 'maiden' },
    ) => {
      const g = new THREE.Group();

      // 流畅弯翘木船身 + 内舱木板 + 船舷压条
      const hull = new THREE.Mesh(hullGeo, woodMat2);
      hull.castShadow = false;
      hull.receiveShadow = true;
      g.add(hull);

      const deckPlank = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.024, 1.12), woodDeckMat);
      deckPlank.position.set(0, 0.082, 0);
      deckPlank.receiveShadow = true;
      g.add(deckPlank);

      for (const sx of [-1, 1]) {
        const rail = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.034, 1.06), woodDark);
        rail.position.set(0.21 * sx, 0.095, 0);
        g.add(rail);
      }
      for (const bz of [-0.56, 0.14]) {
        const bench = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.028, 0.14), woodDark);
        bench.position.set(0, 0.102, bz);
        g.add(bench);
      }

      // 乌篷拱顶
      const canopyGrp = new THREE.Group();
      canopyGrp.position.set(0, 0.09, -0.16);
      const canopyOuterGeo = new THREE.CylinderGeometry(0.225, 0.225, 0.48, 16, 1, true, 0, Math.PI);
      canopyOuterGeo.rotateZ(Math.PI / 2);
      canopyOuterGeo.rotateY(Math.PI / 2);
      const canopyOuter = new THREE.Mesh(canopyOuterGeo, canopyOuterMat);
      canopyOuter.scale.set(1.0, 1.32, 1);
      canopyOuter.castShadow = true;
      canopyGrp.add(canopyOuter);

      const canopyInnerGeo = new THREE.CylinderGeometry(0.208, 0.208, 0.46, 14, 1, true, 0, Math.PI);
      canopyInnerGeo.rotateZ(Math.PI / 2);
      canopyInnerGeo.rotateY(Math.PI / 2);
      const canopyInner = new THREE.Mesh(canopyInnerGeo, canopyInnerMat);
      canopyInner.scale.set(1.0, 1.3, 1);
      canopyGrp.add(canopyInner);

      for (const rz of [-0.22, 0, 0.22]) {
        const rib = new THREE.Mesh(
          new THREE.TorusGeometry(0.228, 0.011, 6, 18, Math.PI),
          Math.abs(rz) > 0.18 ? woodDark : hatRimMat,
        );
        rib.scale.set(1.0, 1.32, 1);
        rib.position.z = rz;
        canopyGrp.add(rib);
      }
      for (const sx of [-1, 1]) {
        const tassel = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.016, 0.09, 6), sashRedMat);
        tassel.position.set(0.165 * sx, 0.18, 0.235);
        canopyGrp.add(tassel);
      }
      g.add(canopyGrp);

      // 船头弯杆暖灯
      const pole1 = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.012, 0.26, 6), woodDark);
      pole1.position.set(0.06, 0.2, 0.7);
      pole1.rotation.x = 0.22;
      g.add(pole1);
      const poleArm = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.14, 6), woodDark);
      poleArm.position.set(0.03, 0.31, 0.76);
      poleArm.rotation.set(0.25, 0, 0.45);
      g.add(poleArm);
      const bowLight = new THREE.Mesh(new THREE.SphereGeometry(0.048, 12, 10), lantMat);
      bowLight.scale.y = 1.15;
      bowLight.position.set(0, 0.26, 0.81);
      g.add(bowLight);
      for (const ly of [0.31, 0.21]) {
        const lCap = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.015, 8), goldAccent);
        lCap.position.set(0, ly, 0.81);
        g.add(lCap);
      }

      // 船头小茶席
      const tray = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.016, 0.13), woodDark);
      tray.position.set(-0.02, 0.104, 0.4);
      g.add(tray);
      const pot = new THREE.Mesh(new THREE.SphereGeometry(0.026, 10, 8), teaPotMat);
      pot.scale.set(1.05, 0.85, 1.05);
      pot.position.set(-0.02, 0.128, 0.4);
      g.add(pot);
      for (const cx of [-0.045, 0.032]) {
        const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.008, 0.016, 8), hatMat);
        cup.position.set(cx, 0.12, 0.43);
        g.add(cup);
      }

      // 船尾船夫（朝向右舷桨架坐姿，双臂关节实时握住桨柄）
      const man = new THREE.Group();
      const baseLeg = new THREE.Mesh(new THREE.CylinderGeometry(0.068, 0.078, 0.072, 10), pantsMat);
      baseLeg.position.y = 0.038;
      man.add(baseLeg);

      const manUpper = new THREE.Group();
      manUpper.position.y = 0.075;
      man.add(manUpper);

      const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.068, 0.148, 10), bodyMat);
      torso.position.y = 0.072;
      torso.castShadow = true;
      manUpper.add(torso);
      const sash = new THREE.Mesh(new THREE.CylinderGeometry(0.067, 0.069, 0.024, 10), sashRedMat);
      sash.position.y = 0.018;
      manUpper.add(sash);
      const mHead = new THREE.Mesh(new THREE.SphereGeometry(0.05, 12, 10), skinMat);
      mHead.position.y = 0.185;
      mHead.castShadow = true;
      manUpper.add(mHead);
      addCuteFace(manUpper, 0.183, 0.044);

      const hat = new THREE.Mesh(new THREE.ConeGeometry(0.128, 0.064, 16), hatMat);
      hat.position.y = 0.236;
      hat.castShadow = true;
      manUpper.add(hat);
      const hatTop = new THREE.Mesh(new THREE.SphereGeometry(0.018, 8, 6), hatRimMat);
      hatTop.position.y = 0.268;
      manUpper.add(hatTop);

      // 左右摆臂枢轴（局部 +Z 朝前伸展至手心，每帧直接对准桨柄双握点）
      const makeBoatmanArm = (sx: number) => {
        const armPivot = new THREE.Group();
        armPivot.position.set(0.058 * sx, 0.126, 0.012);
        const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.019, 0.135, 8), bodyMat);
        sleeve.rotation.x = Math.PI / 2;
        sleeve.position.z = 0.068;
        armPivot.add(sleeve);
        const hand = new THREE.Mesh(new THREE.SphereGeometry(0.017, 8, 6), skinMat);
        hand.position.z = 0.14;
        armPivot.add(hand);
        manUpper.add(armPivot);
        return armPivot;
      };
      const manLeftArm = makeBoatmanArm(1);
      const manRightArm = makeBoatmanArm(-1);

      man.position.set(-0.04, 0.114, -0.57);
      man.rotation.y = 1.1;
      man.scale.setScalar(1.08);
      g.add(man);

      // 船舷木橹枢轴（单根一体化木桨：柄端直达船夫手中 -> 穿桨架 -> 桨叶严丝合缝连接在杆梢）
      const oarLock = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.018, 0.052, 8), woodDark);
      oarLock.position.set(0.2, 0.125, -0.49);
      g.add(oarLock);
      const oarLockRing = new THREE.Mesh(new THREE.TorusGeometry(0.018, 0.005, 6, 12), woodDark);
      oarLockRing.rotation.y = Math.PI / 2;
      oarLockRing.position.set(0.2, 0.15, -0.49);
      g.add(oarLockRing);

      const oarPivot = new THREE.Group();
      oarPivot.position.set(0.2, 0.15, -0.49);

      // oarRod 局部轴向：-Z 为船内握柄端（船夫双手握持），0 为船舷支点，+Z 为伸出船外入水桨叶
      const oarRod = new THREE.Group();
      const handleTarget = new THREE.Object3D();
      handleTarget.position.set(0, 0, -0.185);
      oarRod.add(handleTarget);

      const handleForeTarget = new THREE.Object3D();
      handleForeTarget.position.set(0, 0, -0.125);
      oarRod.add(handleForeTarget);

      const handlePommel = new THREE.Mesh(new THREE.SphereGeometry(0.014, 8, 6), woodDark);
      handlePommel.position.set(0, 0, -0.215);
      oarRod.add(handlePommel);

      const oarShaft = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.013, 0.62, 8), oarMat);
      oarShaft.rotation.x = Math.PI / 2;
      oarShaft.position.set(0, 0, 0.095); // 覆盖 z = -0.215 .. +0.405
      oarRod.add(oarShaft);

      // 桨叶严格沿着同一条 Z 轴衔接在杆身末端（z = +0.38 .. +0.57），再无悬浮木片
      const oarBladeNeck = new THREE.Mesh(new THREE.BoxGeometry(0.024, 0.014, 0.055), oarPaddleMat);
      oarBladeNeck.position.set(0, 0, 0.385);
      oarRod.add(oarBladeNeck);

      const oarBlade = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.012, 0.19), oarPaddleMat);
      oarBlade.position.set(0, 0, 0.485);
      oarBlade.rotation.z = 0.22;
      oarRod.add(oarBlade);

      // 中立角度：船外桨叶朝右外侧入水，船内桨柄恰落在船夫胸前双手处
      oarRod.rotation.order = 'YXZ';
      oarRod.rotation.y = 1.36;
      oarRod.rotation.x = 0.56;
      oarPivot.add(oarRod);
      g.add(oarPivot);

      // 船舱前端精致苗条游船人物：白衣女子 / 青衣男子
      const p = new THREE.Group();
      const clothMat = mat(passenger.cloth, 0.62);
      const isMaiden = passenger.variant === 'maiden';
      const trimMat = isMaiden ? pinkRibbonMat : ivoryTrimMat;
      const accentMat = isMaiden ? goldAccent : jadeMat;

      const cushion = new THREE.Mesh(
        new THREE.CylinderGeometry(0.088, 0.098, 0.026, 12),
        isMaiden ? pinkRibbonMat : deepTealTrimMat,
      );
      cushion.position.y = 0.013;
      p.add(cushion);

      // 修身坐裙/下摆（更纤细收腰、加褶皱滚边）
      const skirtLower = new THREE.Mesh(new THREE.CylinderGeometry(0.044, 0.08, 0.068, 12), clothMat);
      skirtLower.scale.set(0.95, 1, 0.88);
      skirtLower.position.set(0, 0.056, 0.012);
      p.add(skirtLower);

      const hemTrim = new THREE.Mesh(
        new THREE.CylinderGeometry(0.077, 0.082, 0.012, 12),
        isMaiden ? ivoryTrimMat : deepTealTrimMat,
      );
      hemTrim.scale.set(0.95, 1, 0.88);
      hemTrim.position.set(0, 0.028, 0.012);
      p.add(hemTrim);

      // 细窄裙褶条
      for (let pi = 0; pi < 5; pi++) {
        const pa = -0.75 + pi * 0.375;
        const pleat = new THREE.Mesh(
          new THREE.BoxGeometry(0.005, 0.058, 0.006),
          isMaiden ? pinkRibbonMat : deepTealTrimMat,
        );
        pleat.position.set(Math.sin(pa) * 0.062, 0.055, 0.012 + Math.cos(pa) * 0.054);
        pleat.rotation.y = pa;
        pleat.rotation.x = -0.32;
        p.add(pleat);
      }

      // 苗条上身（收肩收腰 + 略微扁平化更显修长）
      const pBody = new THREE.Group();
      pBody.position.y = 0.086;
      p.add(pBody);

      const robe = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.049, 0.142, 12), clothMat);
      robe.scale.set(0.92, 1, 0.76);
      robe.position.y = 0.072;
      robe.castShadow = true;
      pBody.add(robe);

      // 汉服交领（Y字领口滚边）
      for (const sx of [-1, 1]) {
        const lapel = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.062, 0.008), trimMat);
        lapel.position.set(0.012 * sx, 0.114, 0.031);
        lapel.rotation.z = 0.34 * sx;
        pBody.add(lapel);
      }

      // 纤细束腰与玉佩/丝绦
      const pSash = new THREE.Mesh(
        new THREE.CylinderGeometry(0.043, 0.045, 0.02, 12),
        isMaiden ? pinkRibbonMat : deepTealTrimMat,
      );
      pSash.scale.set(0.94, 1, 0.78);
      pSash.position.y = 0.028;
      pBody.add(pSash);

      const sashTail = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.054, 0.005), accentMat);
      sashTail.position.set(0.018, -0.002, 0.035);
      sashTail.rotation.z = -0.14;
      pBody.add(sashTail);

      // 修长双袖
      for (const sx of [-1, 1]) {
        const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.013, 0.022, 0.095, 8), clothMat);
        sleeve.position.set(0.044 * sx, 0.092, 0.022);
        sleeve.rotation.set(-0.68, 0, -0.18 * sx);
        pBody.add(sleeve);
        const hand = new THREE.Mesh(new THREE.SphereGeometry(0.011, 8, 6), skinMat);
        hand.position.set(0.052 * sx, 0.054, 0.054);
        pBody.add(hand);
      }

      // 头部独立枢轴，方便相遇对诗时微微颔首顾盼
      const pHeadGrp = new THREE.Group();
      pHeadGrp.position.y = 0.178;
      pBody.add(pHeadGrp);

      const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.013, 0.015, 0.026, 8), skinMat);
      neck.position.y = -0.026;
      pHeadGrp.add(neck);

      const pHead = new THREE.Mesh(new THREE.SphereGeometry(0.043, 12, 10), skinMat);
      pHead.scale.set(0.92, 1.03, 0.92);
      pHead.castShadow = true;
      pHeadGrp.add(pHead);
      addCuteFace(pHeadGrp, -0.003, 0.038, true);

      const hairCap = new THREE.Mesh(
        new THREE.SphereGeometry(0.046, 12, 10, 0, Math.PI * 2, 0, Math.PI * 0.56),
        hairMat,
      );
      hairCap.scale.set(0.93, 1.02, 0.94);
      hairCap.position.set(0, 0.005, -0.003);
      hairCap.rotation.x = -0.24;
      pHeadGrp.add(hairCap);

      const backHair = new THREE.Mesh(
        new THREE.CylinderGeometry(0.024, 0.018, isMaiden ? 0.115 : 0.075, 8),
        hairMat,
      );
      backHair.scale.set(1.15, 1, 0.45);
      backHair.position.set(0, isMaiden ? -0.045 : -0.026, -0.034);
      backHair.rotation.x = 0.14;
      pHeadGrp.add(backHair);

      if (isMaiden) {
        // 白衣女子：仙姿云髻 + 金步摇花饰 + 轻盈披帛 + 精致团扇
        const topKnot = new THREE.Mesh(new THREE.SphereGeometry(0.021, 8, 6), hairMat);
        topKnot.scale.set(1.05, 0.9, 0.95);
        topKnot.position.set(0, 0.052, -0.005);
        pHeadGrp.add(topKnot);
        for (const sx of [-1, 1]) {
          const sideLoop = new THREE.Mesh(new THREE.TorusGeometry(0.016, 0.0055, 6, 10), hairMat);
          sideLoop.position.set(0.034 * sx, 0.034, -0.003);
          sideLoop.rotation.y = 0.35 * sx;
          pHeadGrp.add(sideLoop);
          const pearl = new THREE.Mesh(new THREE.SphereGeometry(0.007, 6, 6), pinkRibbonMat);
          pearl.position.set(0.041 * sx, 0.038, 0.009);
          pHeadGrp.add(pearl);
        }
        const hairpin = new THREE.Mesh(new THREE.CylinderGeometry(0.0028, 0.0028, 0.088, 6), goldAccent);
        hairpin.rotation.z = Math.PI / 2 + 0.16;
        hairpin.position.set(0, 0.054, -0.005);
        pHeadGrp.add(hairpin);

        // 轻纱披帛环绕双肩垂落
        const shawlArc = new THREE.Mesh(
          new THREE.TorusGeometry(0.055, 0.0065, 6, 14, Math.PI * 1.15),
          pinkRibbonMat,
        );
        shawlArc.rotation.set(Math.PI / 2 + 0.25, 0, Math.PI * 0.92);
        shawlArc.position.set(0, 0.102, 0.006);
        pBody.add(shawlArc);
        for (const sx of [-1, 1]) {
          const drape = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.078, 0.004), pinkRibbonMat);
          drape.position.set(0.052 * sx, 0.054, 0.028);
          drape.rotation.z = -0.18 * sx;
          pBody.add(drape);
        }

        // 手持团扇
        const fanRim = new THREE.Mesh(new THREE.TorusGeometry(0.04, 0.003, 6, 14), woodDark);
        fanRim.position.set(-0.056, 0.084, 0.068);
        fanRim.rotation.set(0.22, 0.42, 0);
        pBody.add(fanRim);
        const roundFan = new THREE.Mesh(new THREE.CircleGeometry(0.039, 14), fanPaperMat);
        roundFan.position.copy(fanRim.position);
        roundFan.rotation.copy(fanRim.rotation);
        pBody.add(roundFan);
        const fanHandle = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.003, 0.055, 6), woodDark);
        fanHandle.position.set(-0.052, 0.044, 0.062);
        pBody.add(fanHandle);
      } else {
        // 青衣男子：高束玉冠 + 玉簪 + 文雅折扇
        const bun = new THREE.Mesh(new THREE.SphereGeometry(0.02, 8, 6), hairMat);
        bun.position.set(0, 0.054, -0.006);
        pHeadGrp.add(bun);
        const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.019, 0.021, 0.022, 8), ivoryTrimMat);
        crown.position.set(0, 0.053, -0.006);
        pHeadGrp.add(crown);
        const pin = new THREE.Mesh(new THREE.CylinderGeometry(0.0035, 0.0035, 0.078, 6), jadeMat);
        pin.rotation.z = Math.PI / 2;
        pin.position.set(0, 0.056, -0.006);
        pHeadGrp.add(pin);

        // 手持折扇
        const fan = new THREE.Mesh(
          new THREE.CircleGeometry(0.044, 10, 0.25, Math.PI * 0.65),
          fanPaperMat,
        );
        fan.position.set(0.056, 0.072, 0.066);
        fan.rotation.set(0.28, -0.45, 0.22);
        pBody.add(fan);
      }

      p.position.set(0, 0.115, 0.16);
      p.rotation.y = -0.16;
      p.scale.setScalar(1.08);
      g.add(p);

      // 船体吃水线白沫环 + 船尾 V 形水波纹
      const hullFoam = new THREE.Mesh(new THREE.PlaneGeometry(0.64, 1.98), hullFoamMat.clone());
      hullFoam.rotation.x = -Math.PI / 2;
      hullFoam.position.set(0, 0.028, 0);
      hullFoam.renderOrder = 2;
      g.add(hullFoam);

      const wake = new THREE.Mesh(new THREE.PlaneGeometry(0.68, 1.08), wakeMat.clone());
      wake.rotation.x = -Math.PI / 2;
      wake.position.set(0, 0.028, -1.32);
      wake.renderOrder = 2;
      g.add(wake);

      g.scale.setScalar(1.36);
      g.userData.man = man;
      g.userData.manUpper = manUpper;
      g.userData.manLeftArm = manLeftArm;
      g.userData.manRightArm = manRightArm;
      g.userData.oar = oarPivot;
      g.userData.oarRod = oarRod;
      g.userData.handleTarget = handleTarget;
      g.userData.handleForeTarget = handleForeTarget;
      g.userData.passenger = p;
      g.userData.passengerHead = pHeadGrp;
      g.userData.hullFoam = hullFoam;
      g.userData.wake = wake;
      boats.push({
        g,
        th: initTh,
        rOff,
        speed: dir * 0.044,
        speedFactor: 1,
        bob: Math.random() * 6,
        role: passenger.variant,
        targetLookYaw: 0,
        currentLookYaw: 0,
        rowPhase: Math.random() * 6,
      });
      scene.add(g);
    };

    // 青衣男子顺时针行船（外侧水道），白衣女子逆时针行船（内侧水道），错道相逢互不对撞
    makeBoat(1, 0.35, 0.68, { cloth: 0x3b7a78, variant: 'scholar' });
    makeBoat(-1, 1.72, -0.68, { cloth: 0xfaf7f0, variant: 'maiden' });
  }

  // 古城夜景暖色灯笼光源（傍晚渐亮、夜晚点亮中央棋盘与四门牌坊，保持棋盘清晰又具浓郁夜色）
  const nightLights: { light: THREE.PointLight; baseIntensity: number }[] = [];
  const addNightLight = (
    x: number,
    y: number,
    z: number,
    colorHex: number,
    baseIntensity: number,
    distance: number,
    decay = 1.4,
  ) => {
    const pt = new THREE.PointLight(colorHex, 0, distance, decay);
    pt.position.set(x, y, z);
    scene.add(pt);
    nightLights.push({ light: pt, baseIntensity });
  };
  // 中央骰台上方暖金主灯（柔和照亮棋盘中心与小熊）
  addNightLight(0, 4.6, 0, 0xffb85c, 2.8, 19, 1.35);
  // 2 盏对角广域暖橘灯覆盖四座熊熊坊/城门（与自发光灯笼配合，减少点光源着色器循环）
  addNightLight(6.2, 3.0, 6.2, 0xff9a42, 2.6, 18.0, 1.35);
  addNightLight(-6.2, 3.0, -6.2, 0xff9a42, 2.6, 18.0, 1.35);
  // 爱心古榕树灯笼暖光
  addNightLight(-11.5, 2.5, 0, 0xff9442, 2.6, 13.5, 1.4);

  // 夜景护城河与庭院周边漂浮萤火虫
  const fireflyCount = 68;
  const fireflyPos = new Float32Array(fireflyCount * 3);
  const fireflyBase: { x: number; y: number; z: number; phase: number; speed: number; radius: number }[] = [];
  for (let i = 0; i < fireflyCount; i++) {
    const ang = (i / fireflyCount) * Math.PI * 2 + Math.random() * 0.4;
    const rad = 9.2 + Math.random() * 9.5;
    const fx = Math.cos(ang) * rad;
    const fz = Math.sin(ang) * rad;
    const fy = 0.65 + Math.random() * 2.5;
    fireflyBase.push({
      x: fx,
      y: fy,
      z: fz,
      phase: Math.random() * Math.PI * 2,
      speed: 0.65 + Math.random() * 0.85,
      radius: 0.25 + Math.random() * 0.45,
    });
    fireflyPos[i * 3] = fx;
    fireflyPos[i * 3 + 1] = fy;
    fireflyPos[i * 3 + 2] = fz;
  }
  const ffGeo = new THREE.BufferGeometry();
  ffGeo.setAttribute('position', new THREE.BufferAttribute(fireflyPos, 3));
  const ffCanvas = document.createElement('canvas');
  ffCanvas.width = ffCanvas.height = 64;
  const ffg = ffCanvas.getContext('2d')!;
  const ffGrad = ffg.createRadialGradient(32, 32, 2, 32, 32, 30);
  ffGrad.addColorStop(0, 'rgba(255, 248, 185, 1)');
  ffGrad.addColorStop(0.35, 'rgba(255, 220, 105, 0.85)');
  ffGrad.addColorStop(1, 'rgba(255, 180, 60, 0)');
  ffg.fillStyle = ffGrad;
  ffg.fillRect(0, 0, 64, 64);
  const ffTex = new THREE.CanvasTexture(ffCanvas);
  const fireflyMat = new THREE.PointsMaterial({
    map: ffTex,
    color: 0xffe680,
    size: 0.34,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    sizeAttenuation: true,
  });
  const fireflyPoints = new THREE.Points(ffGeo, fireflyMat);
  fireflyPoints.visible = false;
  scene.add(fireflyPoints);

  // 1) 清晨护城河水雾轻纱
  const mistCanvas = document.createElement('canvas');
  mistCanvas.width = mistCanvas.height = 128;
  const mg = mistCanvas.getContext('2d')!;
  const mGrad = mg.createRadialGradient(64, 64, 6, 64, 64, 60);
  mGrad.addColorStop(0, 'rgba(255, 248, 236, 0.55)');
  mGrad.addColorStop(0.55, 'rgba(250, 242, 232, 0.22)');
  mGrad.addColorStop(1, 'rgba(250, 242, 232, 0)');
  mg.fillStyle = mGrad;
  mg.fillRect(0, 0, 128, 128);
  const mistTex = new THREE.CanvasTexture(mistCanvas);
  const mistMat = new THREE.MeshBasicMaterial({
    map: mistTex,
    transparent: true,
    opacity: 0.45,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const mistGroup = new THREE.Group();
  const mistData: { mesh: THREE.Mesh; ang: number; rad: number; speed: number; yBase: number; phase: number }[] = [];
  const mistGeo = new THREE.PlaneGeometry(3.4, 2.2);
  for (let i = 0; i < 14; i++) {
    const ang = (i / 14) * Math.PI * 2 + Math.random() * 0.3;
    const rad = 11.4 + Math.random() * 3.8;
    const mm = new THREE.Mesh(mistGeo, mistMat);
    mm.rotation.x = -Math.PI / 2;
    mm.rotation.z = ang;
    const yb = WATER_Y + 0.14 + Math.random() * 0.12;
    mm.position.set(Math.cos(ang) * rad, yb, Math.sin(ang) * rad);
    mistGroup.add(mm);
    mistData.push({
      mesh: mm,
      ang,
      rad,
      speed: 0.015 + Math.random() * 0.015,
      yBase: yb,
      phase: Math.random() * Math.PI * 2,
    });
  }
  scene.add(mistGroup);

  // 2) 中午高空立体棉花糖云朵
  const cloudGroup = new THREE.Group();
  const cloudMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.92,
    metalness: 0.0,
    transparent: true,
    opacity: 0.28,
    depthWrite: false,
  });
  const cloudData: { g: THREE.Group; xBase: number; zBase: number; yBase: number; speed: number; phase: number }[] = [];
  const puffGeo = new THREE.SphereGeometry(1, 14, 12);
  for (let i = 0; i < 5; i++) {
    const cg = new THREE.Group();
    const puffs: [number, number, number, number][] = [
      [0, 0, 0, 1.15],
      [-0.95, -0.18, 0.1, 0.88],
      [0.95, -0.15, -0.08, 0.92],
      [-0.45, 0.32, -0.15, 0.78],
      [0.48, 0.28, 0.15, 0.74],
    ];
    for (const [px, py, pz, ps] of puffs) {
      const pm = new THREE.Mesh(puffGeo, cloudMat);
      pm.scale.set(ps * 1.15, ps * 0.72, ps * 0.95);
      pm.position.set(px, py, pz);
      cg.add(pm);
    }
    const xb = -24 + i * 12 + (Math.random() - 0.5) * 4;
    const zb = -18 + (i % 2 === 0 ? -4 : 6) + (Math.random() - 0.5) * 6;
    const yb = 11.8 + Math.random() * 2.4;
    cg.position.set(xb, yb, zb);
    cg.scale.setScalar(0.95 + Math.random() * 0.35);
    cloudGroup.add(cg);
    cloudData.push({
      g: cg,
      xBase: xb,
      zBase: zb,
      yBase: yb,
      speed: 0.35 + Math.random() * 0.22,
      phase: Math.random() * Math.PI * 2,
    });
  }
  scene.add(cloudGroup);

  // 3) 下午随风飘落的银杏叶与花瓣雨
  const leafCount = 84;
  const leafPos = new Float32Array(leafCount * 3);
  const leafCols = new Float32Array(leafCount * 3);
  const leafData: { x: number; y: number; z: number; vx: number; vy: number; vz: number; phase: number }[] = [];
  const leafPalette = [
    new THREE.Color(0xffb84d),
    new THREE.Color(0xf59e42),
    new THREE.Color(0xf7a8b8),
    new THREE.Color(0xffd269),
  ];
  for (let i = 0; i < leafCount; i++) {
    const lx = (Math.random() - 0.5) * 28;
    const lz = (Math.random() - 0.5) * 28;
    const ly = 0.4 + Math.random() * 6.8;
    leafData.push({
      x: lx,
      y: ly,
      z: lz,
      vx: 0.45 + Math.random() * 0.35,
      vy: 0.52 + Math.random() * 0.38,
      vz: 0.18 + Math.random() * 0.25,
      phase: Math.random() * Math.PI * 2,
    });
    leafPos[i * 3] = lx;
    leafPos[i * 3 + 1] = ly;
    leafPos[i * 3 + 2] = lz;
    const c = leafPalette[i % leafPalette.length];
    leafCols[i * 3] = c.r;
    leafCols[i * 3 + 1] = c.g;
    leafCols[i * 3 + 2] = c.b;
  }
  const leafGeo = new THREE.BufferGeometry();
  leafGeo.setAttribute('position', new THREE.BufferAttribute(leafPos, 3));
  leafGeo.setAttribute('color', new THREE.BufferAttribute(leafCols, 3));
  const leafCanvas = document.createElement('canvas');
  leafCanvas.width = leafCanvas.height = 48;
  const lg = leafCanvas.getContext('2d')!;
  lg.translate(24, 24);
  lg.rotate(0.4);
  lg.fillStyle = '#ffffff';
  lg.beginPath();
  lg.ellipse(0, 0, 14, 8, 0, 0, Math.PI * 2);
  lg.fill();
  const leafTex = new THREE.CanvasTexture(leafCanvas);
  const leafMat = new THREE.PointsMaterial({
    map: leafTex,
    vertexColors: true,
    size: 0.28,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    sizeAttenuation: true,
  });
  const leafPoints = new THREE.Points(leafGeo, leafMat);
  leafPoints.visible = false;
  scene.add(leafPoints);

  // 4) 夜晚闪烁星空与暖白弯月
  const nightSkyGroup = new THREE.Group();
  const starCount = 115;
  const starPos = new Float32Array(starCount * 3);
  for (let i = 0; i < starCount; i++) {
    const theta = Math.random() * Math.PI * 2;
    const phi = 0.2 + Math.random() * 0.72;
    const r = 34 + Math.random() * 10;
    starPos[i * 3] = Math.sin(phi) * Math.cos(theta) * r;
    starPos[i * 3 + 1] = 10 + Math.cos(phi) * r * 0.65;
    starPos[i * 3 + 2] = Math.sin(phi) * Math.sin(theta) * r;
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
  const starMat = new THREE.PointsMaterial({
    map: ffTex,
    color: 0xeaf2ff,
    size: 0.42,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    sizeAttenuation: true,
  });
  const starPoints = new THREE.Points(starGeo, starMat);
  nightSkyGroup.add(starPoints);

  const moonMat = new THREE.MeshBasicMaterial({
    color: 0xfff3c4,
    transparent: true,
    opacity: 0,
    depthWrite: false,
  });
  const moonMesh = new THREE.Mesh(new THREE.CircleGeometry(1.75, 28), moonMat);
  moonMesh.position.set(-16, 20.5, -24);
  moonMesh.lookAt(0, 0, 0);
  nightSkyGroup.add(moonMesh);
  nightSkyGroup.visible = false;
  scene.add(nightSkyGroup);

  // 5) 清晨东方日出太阳与柔粉金晨曦光晕
  const sunriseGroup = new THREE.Group();
  sunriseGroup.position.set(32, 9.2, 14);
  const sunriseDiscMat = new THREE.MeshBasicMaterial({
    color: 0xffe6b3,
    transparent: true,
    opacity: 0.96,
    depthWrite: false,
    fog: false,
  });
  const sunriseDiscMesh = new THREE.Mesh(new THREE.SphereGeometry(2.1, 24, 18), sunriseDiscMat);
  sunriseGroup.add(sunriseDiscMesh);

  const shCanvas = document.createElement('canvas');
  shCanvas.width = shCanvas.height = 128;
  const shg = shCanvas.getContext('2d')!;
  const shGrad = shg.createRadialGradient(64, 64, 6, 64, 64, 63);
  shGrad.addColorStop(0, 'rgba(255, 244, 204, 0.92)');
  shGrad.addColorStop(0.28, 'rgba(255, 198, 146, 0.65)');
  shGrad.addColorStop(0.62, 'rgba(255, 158, 168, 0.25)');
  shGrad.addColorStop(1, 'rgba(255, 158, 168, 0)');
  shg.fillStyle = shGrad;
  shg.fillRect(0, 0, 128, 128);
  const shTex = new THREE.CanvasTexture(shCanvas);
  const sunriseHaloMat = new THREE.MeshBasicMaterial({
    map: shTex,
    transparent: true,
    opacity: 0.85,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    fog: false,
  });
  const sunriseHaloMesh = new THREE.Mesh(new THREE.PlaneGeometry(17, 17), sunriseHaloMat);
  sunriseGroup.add(sunriseHaloMesh);
  scene.add(sunriseGroup);

  return {
    waterMesh,
    moatTex,
    waterNormalTex,
    waterUniforms,
    lanternMats,
    nightLights,
    fireflyPoints,
    fireflyMat,
    fireflyBase,
    mistGroup,
    mistMat,
    mistData,
    cloudGroup,
    cloudMat,
    cloudData,
    leafPoints,
    leafMat,
    leafData,
    nightSkyGroup,
    starMat,
    moonMat,
    sunriseGroup,
    sunriseDiscMat,
    sunriseHaloMesh,
    sunriseHaloMat,
    heartTreeNight: heartTreeNightData,
    waterY: WATER_Y,
    rideToys,
    planeMarks,
    courtFences,
    shopRingIndices,
    lotusList,
    willowDrapeList,
    petals,
    moatDucks,
    swimKois,
    boats,
    critters,
    moatMid,
    moatOuterR,
    moatChannelR,
    hillH,
    spawnCritter,
  };
}

/** 多地图场景构建注册表：新增地图时只需在此登记对应 builder */
export const MAP_WORLD_BUILDERS: Record<MapId, WorldBuilder> = {
  ancient_city: buildAncientWorld,
};

export function buildWorldByMapId(
  mapId: MapId,
  scene: THREE.Scene,
  players: PlayerConfig[],
  anisotropy: number,
): WorldRefs {
  const builder = MAP_WORLD_BUILDERS[mapId] ?? buildAncientWorld;
  return builder(scene, players, anisotropy);
}
