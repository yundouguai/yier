import * as THREE from 'three';
import {
  FLIGHT_FROM,
  FLIGHT_STEP,
  NEUTRAL_CELL,
  PlayerConfig,
  Point2D,
  RING,
  RING_TILES,
  SLOTS,
  lineOf,
  ringColor,
} from './constants';
import { makePlaneModel } from './pieces';
import {
  createBrickBankTexture,
  createCourtyardGrassTexture,
  createGrassTexture,
  createMoatTexture,
  createStartPadTexture,
  createStoneDeckTexture,
  createWallBrickTexture,
} from './textures';

export interface RideToyAnim {
  root: THREE.Group;
  rockerPivot: THREE.Group;
  riderPivot: THREE.Group;
  headPivot: THREE.Group;
  phase: number;
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

export interface SwimKoiAnim {
  g: THREE.Group;
  th: number;
  speed: number;
  rOff: number;
  phase: number;
}

export interface BoatAnim {
  g: THREE.Group;
  th: number;
  speed: number;
  bob: number;
}

export type CritterAnim =
  | {
      kind: 'rabbit';
      g: THREE.Group;
      ttl: number;
      state: 'rest' | 'hop';
      rest: number;
      hopT: number;
      hopDur: number;
      dir: number;
    }
  | {
      kind: 'bird';
      g: THREE.Group;
      ttl: number;
      from: THREE.Vector3;
      to: THREE.Vector3;
      prog: number;
      dur: number;
      flap: number;
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

export interface WorldRefs {
  waterMesh: THREE.Mesh;
  moatTex: THREE.CanvasTexture;
  rideToys: RideToyAnim[];
  lotusList: LotusAnim[];
  willowDrapeList: WillowAnim[];
  petals: PetalAnim[];
  moatDucks: MoatDuckAnim[];
  swimKois: SwimKoiAnim[];
  boats: BoatAnim[];
  critters: CritterAnim[];
  moatMid: (th: number) => number;
  spawnCritter: (kind: 'rabbit' | 'bird' | 'fly' | 'fish') => void;
}

const rnd = (a: number, b: number) => a + Math.random() * (b - a);
const moatInnerR = (th: number) =>
  12.7 + 0.45 * Math.sin(4 * th + 1.25) + 0.25 * Math.sin(8 * th + 2.6);
const moatOuterR = (th: number) =>
  16.8 + 0.55 * Math.sin(4 * th + 0.7) + 0.3 * Math.sin(8 * th + 2.1);
const moatMid = (th: number) => (moatInnerR(th) + moatOuterR(th)) * 0.5;

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
  const darkCol = P.key === 'yier' ? 0x2a1d17 : P.key === 'bubu' ? 0x2a1a14 : P.ear;
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
      inner.position.set(0, -0.002, 0.024);
      ear.add(inner);
    }
  }
  for (const s of [-1, 1]) {
    const th = 0.385 * s;
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.023, 18, 14), darkM);
    eye.scale.set(1, 1, 0.45);
    const ep = surfPt(th, 0.322, 0.002);
    eye.position.set(ep.x, 0.322, ep.z);
    eye.rotation.y = th;
    headWrap.add(eye);
  }
  const blushCol = panda
    ? P.key === 'yier'
      ? 0xf2937e
      : P.blush
    : P.key === 'bubu'
      ? 0xeab832
      : P.blush;
  const blushM = M(blushCol, 0.72);
  for (const s of [-1, 1]) {
    const tb = 0.63 * s;
    const blush = new THREE.Mesh(new THREE.SphereGeometry(0.048, 20, 14), blushM);
    blush.scale.set(1.04, 1.0, 0.24);
    const bp = surfPt(tb, 0.258, 0.004);
    blush.position.set(bp.x, 0.258, bp.z);
    blush.rotation.y = tb;
    blush.rotation.x = (surfPt(tb, 0.3, 0).z - surfPt(tb, 0.22, 0).z) / 0.08;
    headWrap.add(blush);
  }
  if (panda) {
    const mz = surfPt(0, 0.308, 0).z;
    const mRim = new THREE.Mesh(new THREE.TorusGeometry(0.022, 0.007, 10, 20), darkM);
    mRim.scale.set(0.92, 1.18, 0.65);
    mRim.position.set(0, 0.306, mz + 0.001);
    headWrap.add(mRim);
    const tongue = new THREE.Mesh(
      new THREE.SphereGeometry(0.019, 14, 10),
      M(0xef7c8e, 0.6),
    );
    tongue.scale.set(0.85, 1.1, 0.45);
    tongue.position.set(0, 0.304, mz + 0.002);
    headWrap.add(tongue);
    for (const s of [-1, 1]) {
      const lip = new THREE.Mesh(new THREE.SphereGeometry(0.009, 10, 8), darkM);
      lip.position.set(0.021 * s, 0.326, surfPt(0.06 * s, 0.326, 0).z + 0.002);
      headWrap.add(lip);
    }
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
  for (const s of [-1, 1]) {
    const a = new THREE.Vector3(0.135 * s, 0.22, -0.01);
    const b = new THREE.Vector3(0.205 * s, gripY, gripZ);
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
  for (const s of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.SphereGeometry(0.068, 16, 12), legM);
    leg.scale.set(0.85, 0.82, 1.28);
    leg.position.set(0.185 * s, -0.03, 0.1);
    leg.rotation.y = s * 0.25;
    leg.castShadow = true;
    riderPivot.add(leg);
  }
  return { riderPivot, headPivot };
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

  /* ================= 1. 地形草地与护城河 ================= */
  const grassTex = createGrassTexture(anisotropy);
  {
    const RINGS = 24;
    const SEGS = 72;
    const MAXR = 42;
    const verts: number[] = [];
    const uvs: number[] = [];
    const cols: number[] = [];
    const idx: number[] = [];
    const hillH = (x: number, z: number) => {
      const r = Math.hypot(x, z);
      if (r < 17.8) return -0.66;
      const f = THREE.MathUtils.smoothstep(r, 17.8, 36);
      const n =
        Math.sin(x * 0.14) * Math.cos(z * 0.14) * 0.85 +
        Math.sin(x * 0.27 + z * 0.2) * 0.45;
      return -0.66 + f * (0.55 + Math.max(0, n) * 1.15);
    };
    const cMeadow = new THREE.Color(0xffffff);
    const cPath = new THREE.Color(0xdcc9a3);
    const cHill = new THREE.Color(0xe6f0d8);
    const tmp = new THREE.Color();

    for (let i = 0; i <= RINGS; i++) {
      const rad = (i / RINGS) * MAXR;
      for (let j = 0; j <= SEGS; j++) {
        const th = (j / SEGS) * Math.PI * 2;
        const x = Math.cos(th) * rad;
        const z = Math.sin(th) * rad;
        const y = hillH(x, z);
        verts.push(x, y, z);
        uvs.push(x / 8, z / 8);
        const onPath = rad > 16.2 && rad < 32 && Math.min(Math.abs(x), Math.abs(z)) < 0.95;
        tmp.copy(cMeadow);
        if (rad > 22) tmp.lerp(cHill, THREE.MathUtils.smoothstep(rad, 22, 40) * 0.35);
        if (onPath) {
          const edge =
            1 - THREE.MathUtils.smoothstep(Math.min(Math.abs(x), Math.abs(z)), 0.45, 0.95);
          tmp.lerp(cPath, edge * 0.85);
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
        idx.push(a, b, c, c, b, d);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    const meadow = new THREE.Mesh(
      g,
      new THREE.MeshStandardMaterial({ map: grassTex, vertexColors: true, roughness: 0.96 }),
    );
    meadow.receiveShadow = true;
    scene.add(meadow);
  }

  {
    const bedShape = new THREE.Shape();
    for (let i = 0; i <= 128; i++) {
      const th = (i / 128) * Math.PI * 2;
      const r = moatOuterR(th) + 0.6;
      if (i === 0) bedShape.moveTo(Math.cos(th) * r, Math.sin(th) * r);
      else bedShape.lineTo(Math.cos(th) * r, Math.sin(th) * r);
    }
    const bedHole = new THREE.Path();
    for (let i = 128; i >= 0; i--) {
      const th = (i / 128) * Math.PI * 2;
      const r = moatInnerR(th) - 0.6;
      if (i === 128) bedHole.moveTo(Math.cos(th) * r, Math.sin(th) * r);
      else bedHole.lineTo(Math.cos(th) * r, Math.sin(th) * r);
    }
    bedShape.holes.push(bedHole);
    const bed = new THREE.Mesh(new THREE.ShapeGeometry(bedShape), mat(0x284752, 0.95));
    bed.rotation.x = -Math.PI / 2;
    bed.position.y = -0.92;
    bed.receiveShadow = true;
    scene.add(bed);
  }

  const moatTex = createMoatTexture(anisotropy);
  const waterMesh = (() => {
    const RAD = 6;
    const ANG = 128;
    const pos: number[] = [];
    const uvs: number[] = [];
    const cols: number[] = [];
    const idx: number[] = [];
    const cEdge = new THREE.Color(0x9be0dc);
    const cDeep = new THREE.Color(0x3b768c);
    const tmp = new THREE.Color();

    for (let i = 0; i <= RAD; i++) {
      const u = i / RAD;
      tmp.copy(cEdge).lerp(cDeep, Math.sin(u * Math.PI));
      for (let j = 0; j <= ANG; j++) {
        const th = (j / ANG) * Math.PI * 2;
        const r = THREE.MathUtils.lerp(moatInnerR(th) - 0.15, moatOuterR(th) + 0.15, u);
        pos.push(Math.cos(th) * r, -0.5, Math.sin(th) * r);
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
        idx.push(a, b, c, c, b, d);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    const m = new THREE.Mesh(
      g,
      new THREE.MeshStandardMaterial({
        map: moatTex,
        vertexColors: true,
        roughness: 0.12,
        metalness: 0.32,
        transparent: true,
        opacity: 0.82,
      }),
    );
    m.receiveShadow = true;
    scene.add(m);
    m.userData.basePos = Float32Array.from(pos);
    return m;
  })();

  const willowDrapeList: WillowAnim[] = [];
  const lotusList: LotusAnim[] = [];

  {
    const rockGeo = new THREE.DodecahedronGeometry(0.22, 1);
    const rockMats = [mat(0x7c8589, 0.88), mat(0x90979a, 0.85), mat(0x6c7a72, 0.9)];
    for (let i = 0; i < 110; i++) {
      const th = Math.random() * Math.PI * 2;
      const isInner = Math.random() < 0.5;
      const r =
        (isInner ? moatInnerR(th) : moatOuterR(th)) +
        (isInner ? -0.08 : 0.12) +
        (Math.random() - 0.5) * 0.22;
      const x = Math.cos(th) * r;
      const z = Math.sin(th) * r;
      if (Math.min(Math.abs(x), Math.abs(z)) < 1.25) continue;
      const rock = new THREE.Mesh(rockGeo, rockMats[i % 3]);
      rock.scale.set(rnd(0.6, 1.5), rnd(0.4, 0.8), rnd(0.6, 1.4));
      rock.position.set(x, -0.62, z);
      rock.rotation.set(rnd(-0.2, 0.2), rnd(0, 6), rnd(-0.2, 0.2));
      rock.receiveShadow = true;
      scene.add(rock);
    }

    const padGeo = new THREE.CircleGeometry(0.26, 18, 0.22, Math.PI * 2 - 0.44);
    const padMat = new THREE.MeshStandardMaterial({
      color: 0x4b934c,
      roughness: 0.65,
      side: THREE.DoubleSide,
    });
    const lotusPetalGeo = new THREE.ConeGeometry(0.055, 0.14, 5);
    const lotusMats = [mat(0xffadc4, 0.5), mat(0xfff5f8, 0.5)];
    const lotusCoreMat = mat(0xf5cb42, 0.5);

    for (let i = 0; i < 28; i++) {
      const th = Math.random() * Math.PI * 2;
      const r = moatMid(th) + rnd(-1.35, 1.35);
      const x = Math.cos(th) * r;
      const z = Math.sin(th) * r;
      if (Math.min(Math.abs(x), Math.abs(z)) < 1.3) continue;
      const grp = new THREE.Group();
      const pad = new THREE.Mesh(padGeo, padMat);
      pad.rotation.x = -Math.PI / 2;
      pad.rotation.z = rnd(0, 6);
      pad.scale.setScalar(rnd(0.75, 1.3));
      pad.receiveShadow = true;
      grp.add(pad);
      if (i % 3 === 0) {
        const fl = new THREE.Group();
        const pm = lotusMats[i % 2];
        for (let k = 0; k < 7; k++) {
          const pa = (k / 7) * Math.PI * 2;
          const pt = new THREE.Mesh(lotusPetalGeo, pm);
          pt.position.set(Math.cos(pa) * 0.06, 0.04, Math.sin(pa) * 0.06);
          pt.rotation.set(Math.sin(pa) * 0.55, 0, -Math.cos(pa) * 0.55);
          fl.add(pt);
        }
        const core = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 8), lotusCoreMat);
        core.position.y = 0.045;
        fl.add(core);
        grp.add(fl);
      }
      grp.position.set(x, -0.49, z);
      scene.add(grp);
      lotusList.push({ g: grp, phase: rnd(0, 6) });
    }
  }

  // 石拱桥
  {
    const stoneMat = mat(0xa0acb0, 0.78);
    const stoneDark = mat(0x7c888d, 0.82);
    const capGold = mat(0xd4b678, 0.55);
    const bridge = new THREE.Group();
    const NS = 11;
    const LEN = 6.4;
    const H = 0.76;
    const GY = -0.64;
    const HT = 0.09;

    for (let i = 0; i < NS; i++) {
      const um = (i + 0.5) / NS;
      const x = (um - 0.5) * LEN;
      const y = GY + HT + H * Math.sin(Math.PI * um);
      const slope = ((H * Math.PI) / LEN) * Math.cos(Math.PI * um);
      const seg = new THREE.Mesh(new THREE.BoxGeometry(LEN / NS + 0.08, 0.18, 1.88), stoneMat);
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
        panel.position.set(x, y + 0.14, 0.88 * sz);
        panel.rotation.z = Math.atan(slope);
        bridge.add(panel);
        const rail = new THREE.Mesh(
          new THREE.BoxGeometry(LEN / NS + 0.08, 0.08, 0.11),
          stoneDark,
        );
        rail.position.set(x, y + 0.28, 0.88 * sz);
        rail.rotation.z = Math.atan(slope);
        bridge.add(rail);
        if (i % 2 === 0) {
          const post = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.36, 0.12), stoneDark);
          post.position.set(x, y + 0.18, 0.88 * sz);
          post.rotation.z = Math.atan(slope);
          bridge.add(post);
          const bud = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 8), capGold);
          bud.position.set(x, y + 0.39, 0.88 * sz);
          bridge.add(bud);
        }
      }
    }
    for (const ex of [-1, 1]) {
      const pier = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.6, 1.94), stoneDark);
      pier.position.set(ex * (LEN / 2 - 0.3), GY - 0.15, 0);
      bridge.add(pier);
      for (const sz of [-1, 1]) {
        const cap = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.62, 0.2), stoneDark);
        cap.position.set(ex * (LEN / 2), GY + 0.3, 0.92 * sz);
        cap.castShadow = true;
        bridge.add(cap);
        const finial = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), capGold);
        finial.position.set(ex * (LEN / 2), GY + 0.65, 0.92 * sz);
        bridge.add(finial);
      }
    }
    for (let q = 0; q < 4; q++) {
      const b = bridge.clone();
      b.rotation.y = (q * Math.PI) / 2;
      const a = (q * Math.PI) / 2;
      b.position.set(Math.cos(a) * 14.75, 0, Math.sin(a) * 14.75);
      scene.add(b);
    }
  }

  // 内岸青砖步道
  {
    const bankTex = createBrickBankTexture(anisotropy);
    const bank = new THREE.Mesh(
      new THREE.RingGeometry(8.2, 13.4, 64),
      new THREE.MeshStandardMaterial({ map: bankTex, roughness: 0.88 }),
    );
    bank.rotation.x = -Math.PI / 2;
    bank.position.y = -0.63;
    bank.receiveShadow = true;
    scene.add(bank);
  }

  /* ================= 2. 森林、垂柳、樱花、野花与小蘑菇 ================= */
  const petals: PetalAnim[] = [];
  {
    const GY = -0.66;
    const barkMat = mat(0x6e4b35, 0.92);
    const darkBarkMat = mat(0x523626, 0.92);
    const sphGeo = new THREE.SphereGeometry(1, 14, 12);
    const trunkGeo = new THREE.CylinderGeometry(0.11, 0.2, 1, 8);
    const rootGeo = new THREE.ConeGeometry(0.24, 0.36, 7);
    const coneGeo = new THREE.ConeGeometry(1, 1.35, 12);
    const greens = [mat(0x4f8a42, 0.82), mat(0x639e4c, 0.82), mat(0x3f7539, 0.84), mat(0x78ad58, 0.8)];
    const sakuras = [mat(0xffb7cc, 0.78), mat(0xffcadb, 0.76), mat(0xff9ebb, 0.8)];
    const warms = [mat(0xd96b43, 0.8), mat(0xe3963e, 0.8), mat(0xe8c448, 0.78)];
    const willowLeafMat = new THREE.MeshStandardMaterial({
      color: 0x7eb856,
      roughness: 0.82,
      side: THREE.DoubleSide,
    });
    const treeGroup = new THREE.Group();

    const addFluffyTree = (x: number, z: number, s: number, mats = greens) => {
      const g = new THREE.Group();
      const tr = new THREE.Mesh(trunkGeo, barkMat);
      tr.position.y = 0.52;
      tr.scale.y = 1.05;
      g.add(tr);
      const rt = new THREE.Mesh(rootGeo, barkMat);
      rt.position.y = 0.14;
      g.add(rt);
      const blobs: [number, number, number, number][] = [
        [0, 1.42, 0, 0.78],
        [0.42, 1.25, 0.2, 0.54],
        [-0.4, 1.28, -0.18, 0.56],
        [0.1, 1.3, -0.4, 0.52],
        [0, 1.72, 0.08, 0.56],
      ];
      blobs.forEach(([px, py, pz, pr], i) => {
        const m = new THREE.Mesh(sphGeo, mats[i % mats.length]);
        m.position.set(px, py, pz);
        m.scale.set(pr * 1.12, pr * 0.92, pr * 1.12);
        g.add(m);
      });
      g.position.set(x, GY, z);
      g.scale.setScalar(s);
      g.rotation.y = rnd(0, 6.28);
      treeGroup.add(g);
    };

    const addPineTree = (x: number, z: number, s: number) => {
      const g = new THREE.Group();
      const tr = new THREE.Mesh(trunkGeo, darkBarkMat);
      tr.position.y = 0.45;
      g.add(tr);
      for (let i = 0; i < 3; i++) {
        const c = new THREE.Mesh(coneGeo, greens[i % greens.length]);
        c.position.y = 1.05 + i * 0.68;
        c.scale.set(1 - 0.22 * i, 0.95 - 0.12 * i, 1 - 0.22 * i);
        g.add(c);
        const cap = new THREE.Mesh(sphGeo, greens[i % greens.length]);
        cap.position.y = 1.42 + i * 0.68;
        cap.scale.setScalar(0.32 * (1 - 0.2 * i));
        g.add(cap);
      }
      g.position.set(x, GY, z);
      g.scale.setScalar(s);
      g.rotation.y = rnd(0, 6.28);
      treeGroup.add(g);
    };

    const drapeGeo = new THREE.BoxGeometry(0.05, 0.85, 0.03);
    const willows: [number, number][] = [
      [-10.2, -10.2],
      [10.2, -10.2],
      [10.2, 10.2],
      [-10.2, 10.2],
      [-17.5, 6.5],
      [17.5, -6.5],
    ];
    willows.forEach(([wx, wz], idx) => {
      const g = new THREE.Group();
      const tr = new THREE.Mesh(trunkGeo, barkMat);
      tr.position.y = 0.65;
      tr.scale.set(1.15, 1.35, 1.15);
      tr.rotation.z = 0.15;
      g.add(tr);
      const crown = new THREE.Mesh(sphGeo, willowLeafMat);
      crown.position.set(-0.1, 1.55, 0);
      crown.scale.set(0.85, 0.62, 0.85);
      g.add(crown);
      const drapes = new THREE.Group();
      drapes.position.set(-0.1, 1.4, 0);
      for (let k = 0; k < 10; k++) {
        const ang = (k / 10) * Math.PI * 2;
        const strip = new THREE.Mesh(drapeGeo, willowLeafMat);
        strip.position.set(Math.cos(ang) * 0.68, -0.38, Math.sin(ang) * 0.68);
        drapes.add(strip);
      }
      g.add(drapes);
      g.position.set(wx, GY, wz);
      g.scale.setScalar(0.95);
      g.rotation.y = idx * 1.1;
      treeGroup.add(g);
      willowDrapeList.push({ g: drapes, phase: idx * 1.3 });
    });

    for (let i = 0; i < 115; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = rnd(18.8, 35);
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r;
      if (Math.min(Math.abs(x), Math.abs(z)) < 1.85) {
        i--;
        continue;
      }
      const pick = Math.random();
      if (pick < 0.42) addFluffyTree(x, z, rnd(0.85, 1.55), greens);
      else if (pick < 0.72) addPineTree(x, z, rnd(0.85, 1.5));
      else if (pick < 0.88) addFluffyTree(x, z, rnd(0.8, 1.35), sakuras);
      else addFluffyTree(x, z, rnd(0.85, 1.35), warms);
    }

    for (let i = 0; i < 22; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = rnd(9.6, 12.1);
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r;
      if (
        (Math.abs(x) < 9.1 && Math.abs(z) < 9.1) ||
        Math.min(Math.abs(x), Math.abs(z)) < 1.95
      ) {
        i--;
        continue;
      }
      addFluffyTree(x, z, rnd(0.58, 0.95), i % 2 === 0 ? sakuras : warms);
    }
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
      const r = rnd(9, 24);
      m.position.set(Math.cos(a) * r, rnd(0.5, 4.2), Math.sin(a) * r);
      scene.add(m);
      petals.push({ m, speed: rnd(0.35, 0.65), sway: rnd(0, 6), baseR: r, ang: a });
    }

    const bladeGeo = new THREE.ConeGeometry(0.04, 1, 4);
    const tuftMats = [mat(0x6d9948, 0.85), mat(0x7fad56, 0.85), mat(0x5e8a3d, 0.85)];
    const pGeo = new THREE.SphereGeometry(0.09, 10, 8);
    const cGeo = new THREE.SphereGeometry(0.055, 10, 8);
    const stGeo = new THREE.CylinderGeometry(0.016, 0.024, 0.38, 6);
    const stMat = mat(0x5e8a3e, 0.8);
    const cMats = [mat(0xf5cf47, 0.6), mat(0xebae34, 0.6)];
    const pMats = [
      mat(0xff8eb3, 0.65),
      mat(0xffe066, 0.65),
      mat(0xfffaf0, 0.65),
      mat(0xb8a4ff, 0.65),
      mat(0xff9f7a, 0.65),
    ];

    for (let i = 0; i < 75; i++) {
      const a = rnd(0, 6.28);
      const r = rnd(17.6, 34);
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r;
      if (Math.min(Math.abs(x), Math.abs(z)) < 1.1) continue;
      const g = new THREE.Group();
      for (let k = 0; k < 6; k++) {
        const b = new THREE.Mesh(bladeGeo, tuftMats[(i + k) % 3]);
        const h = rnd(0.45, 0.88);
        const ba = (k / 6) * Math.PI * 2 + rnd(-0.3, 0.3);
        const br = rnd(0, 0.14);
        b.scale.set(1, h, 1);
        b.position.set(Math.cos(ba) * br, 0.45 * h, Math.sin(ba) * br);
        b.rotation.set(rnd(-0.35, 0.35), 0, rnd(-0.35, 0.35));
        g.add(b);
      }
      g.position.set(x, GY, z);
      g.scale.setScalar(rnd(0.85, 1.45));
      scene.add(g);
    }

    for (let i = 0; i < 56; i++) {
      const a = rnd(0, 6.28);
      const r = rnd(17.5, 33);
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r;
      if (Math.min(Math.abs(x), Math.abs(z)) < 1.15) continue;
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
      f.position.set(x, GY, z);
      f.scale.setScalar(rnd(0.85, 1.35));
      scene.add(f);
    }

    const mushCapMat = mat(0xe04f47, 0.55);
    const mushStemMat = mat(0xf7efe4, 0.75);
    const mushDotMat = mat(0xffffff, 0.6);
    for (let i = 0; i < 22; i++) {
      const a = rnd(0, 6.28);
      const r = rnd(18.5, 30);
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r;
      if (Math.min(Math.abs(x), Math.abs(z)) < 1.5) continue;
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
      mg.position.set(x, GY, z);
      mg.scale.setScalar(rnd(0.8, 1.35));
      scene.add(mg);
    }
  }

  /* ================= 3. 古城石台、城墙、四向城门楼 & 角楼 ================= */
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
    scene.add(m);
    return m;
  };

  addBrickBox(0, 0, 17.8, 0.4, 17.8, -0.68, 7, 0.2);
  addBrickBox(0, 0, 17.2, 0.62, 17.2, -0.29, 6, 0.3);

  const deck = new THREE.Mesh(
    new THREE.BoxGeometry(17.2, 0.12, 17.2),
    new THREE.MeshStandardMaterial({ map: stoneDeckTex, roughness: 0.82 }),
  );
  deck.position.y = 0.02;
  deck.receiveShadow = true;
  scene.add(deck);

  const wallMat = brickMat(4.5, 0.3);
  const merlonGeo = new THREE.BoxGeometry(0.62, 0.15, 0.3);
  const merlonMat = mat(0x8d969c, 0.72);
  for (const sz of [-1, 1]) {
    for (const sx of [-1, 1]) {
      const wh = new THREE.Mesh(new THREE.BoxGeometry(7.45, 0.22, 0.38), wallMat);
      wh.position.set(sx * 4.65, 0.22, sz * 8.38);
      wh.castShadow = true;
      wh.receiveShadow = true;
      scene.add(wh);

      const wv = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.22, 7.45), wallMat);
      wv.position.set(sz * 8.38, 0.22, sx * 4.65);
      wv.castShadow = true;
      wv.receiveShadow = true;
      scene.add(wv);

      for (let i = 0; i < 6; i++) {
        const mh = new THREE.Mesh(merlonGeo, merlonMat);
        mh.position.set(sx * (1.45 + i * 1.22), 0.41, sz * 8.38);
        mh.castShadow = true;
        scene.add(mh);

        const mv = new THREE.Mesh(merlonGeo, merlonMat);
        mv.rotation.y = Math.PI / 2;
        mv.position.set(sz * 8.38, 0.41, sx * (1.45 + i * 1.22));
        mv.castShadow = true;
        scene.add(mv);
      }
    }
  }

  const trimGold = new THREE.MeshStandardMaterial({
    color: 0xd1a836,
    roughness: 0.35,
    metalness: 0.55,
  });
  {
    const pillarMat = mat(0x9a362c, 0.6);
    const roofTileMat = mat(0x444f59, 0.55);
    const lantMat = new THREE.MeshStandardMaterial({
      color: 0xe5442b,
      emissive: 0xb83018,
      emissiveIntensity: 0.75,
      roughness: 0.4,
    });
    for (let q = 0; q < 4; q++) {
      const gate = new THREE.Group();
      for (const sx of [-1, 1]) {
        const pil = new THREE.Mesh(
          new THREE.CylinderGeometry(0.09, 0.11, 1.05, 10),
          pillarMat,
        );
        pil.position.set(0.74 * sx, 0.52, 0);
        pil.castShadow = true;
        gate.add(pil);

        const baseStone = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.16, 0.28), merlonMat);
        baseStone.position.set(0.74 * sx, 0.08, 0);
        gate.add(baseStone);

        const l = new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 10), lantMat);
        l.scale.y = 0.85;
        l.position.set(0.86 * sx, 0.82, 0.16);
        gate.add(l);
      }
      const lintel = new THREE.Mesh(new THREE.BoxGeometry(1.78, 0.16, 0.24), pillarMat);
      lintel.position.set(0, 0.98, 0);
      lintel.castShadow = true;
      gate.add(lintel);
      const roof = new THREE.Mesh(new THREE.ConeGeometry(1.38, 0.48, 4), roofTileMat);
      roof.scale.set(1.25, 1, 0.58);
      roof.rotation.y = Math.PI / 4;
      roof.position.set(0, 1.28, 0);
      roof.castShadow = true;
      gate.add(roof);
      const ridge = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.08, 0.09), trimGold);
      ridge.position.set(0, 1.52, 0);
      gate.add(ridge);
      const a = (q * Math.PI) / 2;
      gate.position.set(Math.sin(a) * 8.38, 0.08, Math.cos(a) * 8.38);
      gate.rotation.y = a;
      scene.add(gate);
    }
  }

  /* ================= 4. 经典 7 格边棋盘格子 ================= */
  const rectTile = (x: number, z: number, w: number, d: number, color: number) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.12, d), mat(color));
    m.position.set(x, 0.06, z);
    m.receiveShadow = true;
    scene.add(m);
    return m;
  };
  const triTile = (ptsXZ: Point2D[], color: number) => {
    let p = ptsXZ.map(([x, z]) => [x, -z] as Point2D);
    const area =
      (p[1][0] - p[0][0]) * (p[2][1] - p[0][1]) -
      (p[2][0] - p[0][0]) * (p[1][1] - p[0][1]);
    if (area < 0) p = [p[0], p[2], p[1]];
    const s = new THREE.Shape();
    s.moveTo(p[0][0], p[0][1]);
    s.lineTo(p[1][0], p[1][1]);
    s.lineTo(p[2][0], p[2][1]);
    s.closePath();
    const m = new THREE.Mesh(
      new THREE.ExtrudeGeometry(s, { depth: 0.12, bevelEnabled: false }),
      mat(color),
    );
    m.rotation.x = -Math.PI / 2;
    m.position.y = 0;
    m.receiveShadow = true;
    scene.add(m);
    return m;
  };
  const cellDisc = (x: number, z: number, color: number, rIn = 0.24, rOut = 0.31) => {
    const r = new THREE.Mesh(new THREE.RingGeometry(rIn, rOut, 24), mat(color));
    r.rotation.x = -Math.PI / 2;
    r.position.set(x, 0.124, z);
    scene.add(r);
  };

  RING_TILES.forEach((t, i) => {
    const P = slotPlayer(i % 4);
    const col = P ? P.colorLight : NEUTRAL_CELL;
    if (t.kind === 'rect') {
      rectTile(t.x, t.z, t.w, t.d, col);
      cellDisc(t.cx, t.cz, P ? ringColor(P) : 0xb7bdc0, 0.24, 0.31);
    } else {
      triTile(t.pts, col);
      cellDisc(t.cx, t.cz, P ? ringColor(P) : 0xb7bdc0, 0.19, 0.25);
    }
    if (i % 13 === 0 && P) {
      const hc = SLOTS[i / 13].home[0];
      const arrow = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.26, 3), mat(lineOf(P)));
      arrow.quaternion.setFromUnitVectors(
        new THREE.Vector3(0, 1, 0),
        new THREE.Vector3(hc[0] - t.cx, 0, hc[1] - t.cz).normalize(),
      );
      arrow.scale.set(1.1, 0.28, 1);
      arrow.position.set(t.cx, 0.142, t.cz);
      scene.add(arrow);
    }
  });

  players.forEach((P) => {
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
    const planeMark = makePlaneModel(lineOf(P));
    planeMark.scale.setScalar(0.8);
    planeMark.position.set(a[0], 0.2, a[1]);
    planeMark.rotation.y = fyaw;
    scene.add(planeMark);

    const d = new THREE.Mesh(new THREE.OctahedronGeometry(0.16), mat(lineOf(P)));
    d.scale.y = 0.38;
    d.rotation.y = Math.PI / 4;
    d.position.set(b[0], 0.16, b[1]);
    scene.add(d);
  });

  players.forEach((P) =>
    P.home.forEach((c) => {
      rectTile(c[0], c[1], 0.8, 0.8, P.colorLight);
      cellDisc(c[0], c[1], ringColor(P), 0.22, 0.28);
    }),
  );

  /* ================= 5. 1:1 摇摇车手办与基地庭院 ================= */
  const rideToys: RideToyAnim[] = [];
  const woodMat = mat(0x9b6b45);
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

    const { riderPivot, headPivot } = buildToyRider(P);
    rockerPivot.add(riderPivot);
    root.scale.setScalar(1.06);
    root.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) o.castShadow = true;
    });
    rideToys.push({ root, rockerPivot, riderPivot, headPivot, phase: slotId * 1.45 });
    return root;
  };

  for (let j = 0; j < 4; j++) {
    const slot = SLOTS[j];
    const P = slotPlayer(j);
    const cx = slot.court[0];
    const cz = slot.court[1];
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
      { name: 'top', ex: 0, ez: -R, w: H, d: 0.08 },
      { name: 'bottom', ex: 0, ez: R, w: H, d: 0.08 },
      { name: 'left', ex: -R, ez: 0, w: 0.08, d: H },
      { name: 'right', ex: R, ez: 0, w: 0.08, d: H },
    ] as const;

    sides.forEach((s) => {
      const horiz = s.w > s.d;
      if (s.name === gateOpenSide) {
        const doorCoord = horiz ? gx : gz;
        const segments: [number, number][] = horiz
          ? [
              [cx - R, doorCoord - 0.46],
              [doorCoord + 0.46, cx + R],
            ]
          : [
              [cz - R, doorCoord - 0.46],
              [doorCoord + 0.46, cz + R],
            ];
        segments.forEach(([a, b]) => {
          const len = b - a;
          if (len > 0.14) {
            const mid = (a + b) / 2;
            for (const y of [0.35, 0.19]) {
              const rail = new THREE.Mesh(
                new THREE.BoxGeometry(horiz ? len : 0.08, 0.055, horiz ? 0.08 : len),
                woodMat,
              );
              rail.position.set(horiz ? mid : cx + s.ex, y, horiz ? cz + s.ez : mid);
              scene.add(rail);
            }
          }
        });
        [-0.44, 0.44].forEach((off) => {
          const p = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.48, 0.13), woodMat);
          p.position.set(
            horiz ? doorCoord + off : cx + s.ex,
            0.32,
            horiz ? cz + s.ez : doorCoord + off,
          );
          p.castShadow = true;
          scene.add(p);
        });
      } else {
        for (let i = 1; i < 4; i++) {
          const t = -R + i * (H / 4);
          const post = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.38, 0.09), woodMat);
          post.position.set(horiz ? cx + t : cx + s.ex, 0.27, horiz ? cz + s.ez : cz + t);
          post.castShadow = true;
          scene.add(post);
        }
        for (const y of [0.35, 0.19]) {
          const rail = new THREE.Mesh(new THREE.BoxGeometry(s.w, 0.055, s.d), woodMat);
          rail.position.set(cx + s.ex, y, cz + s.ez);
          scene.add(rail);
        }
      }
    });

    for (const [sx, sz] of [
      [-1, -1],
      [1, -1],
      [-1, 1],
      [1, 1],
    ]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.44, 0.13), woodMat);
      post.position.set(cx + sx * (R - 0.02), 0.3, cz + sz * (R - 0.02));
      post.castShadow = true;
      scene.add(post);
    }

    if (P) {
      const toy = buildRideToy(P, j);
      toy.position.set(slot.toy[0], 0.1, slot.toy[1]);
      toy.rotation.y = Math.atan2(-cx, -cz);
      scene.add(toy);

      const bxCenter = P.base.reduce((s, b) => s + b[0], 0) / 4;
      const bzCenter = P.base.reduce((s, b) => s + b[1], 0) / 4;
      const slab = new THREE.Mesh(new THREE.BoxGeometry(2.26, 0.05, 2.26), mat(P.colorLight));
      slab.position.set(bxCenter, 0.09, bzCenter);
      slab.receiveShadow = true;
      slab.castShadow = true;
      scene.add(slab);

      P.base.forEach((b) => {
        const pad = new THREE.Mesh(
          new THREE.CylinderGeometry(0.42, 0.42, 0.035, 28),
          mat(0xffffff),
        );
        pad.position.set(b[0], 0.125, b[1]);
        pad.receiveShadow = true;
        pad.castShadow = true;
        scene.add(pad);
        const rim = new THREE.Mesh(
          new THREE.TorusGeometry(0.4, 0.03, 10, 32),
          mat(lineOf(P)),
        );
        rim.rotation.x = -Math.PI / 2;
        rim.position.set(b[0], 0.14, b[1]);
        scene.add(rim);
      });

      const lx = slot.launch[0];
      const lz = slot.launch[1];
      const firstTile = RING[(P.start + 3) % 52];
      const tx = firstTile[0];
      const tz = firstTile[1];
      const gVec = new THREE.Vector3(gx, 0.07, gz);
      const lVec = new THREE.Vector3(lx, 0.07, lz);
      const gatePath = new THREE.Mesh(
        new THREE.BoxGeometry(0.54, 0.06, gVec.distanceTo(lVec) + 0.25),
        mat(P.colorLight),
      );
      gatePath.position.copy(gVec).lerp(lVec, 0.5);
      gatePath.rotation.y = Math.atan2(lx - gx, lz - gz);
      gatePath.receiveShadow = true;
      scene.add(gatePath);

      const startBase = new THREE.Mesh(
        new THREE.CylinderGeometry(0.44, 0.48, 0.11, 32),
        mat(P.color),
      );
      startBase.position.set(lx, 0.075, lz);
      startBase.castShadow = true;
      startBase.receiveShadow = true;
      scene.add(startBase);

      const startTop = new THREE.Mesh(
        new THREE.CircleGeometry(0.42, 32),
        new THREE.MeshStandardMaterial({
          map: createStartPadTexture(P, anisotropy),
          roughness: 0.45,
        }),
      );
      startTop.rotation.x = -Math.PI / 2;
      startTop.rotation.z = Math.atan2(tx - lx, tz - lz);
      startTop.position.set(lx, 0.132, lz);
      scene.add(startTop);

      const stepArrow = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.26, 3), mat(lineOf(P)));
      stepArrow.quaternion.setFromUnitVectors(
        new THREE.Vector3(0, 1, 0),
        new THREE.Vector3(tx - lx, 0, tz - lz).normalize(),
      );
      stepArrow.scale.set(1.1, 0.3, 1);
      stepArrow.position.set((lx + tx) / 2, 0.125, (lz + tz) / 2);
      scene.add(stepArrow);
    }
  }

  // 中央终点区
  addBox(0, 0, 2.82, 0.1, 2.82, 0x767e86, 0.05);
  const trimMat = new THREE.MeshStandardMaterial({
    color: 0xc9a227,
    roughness: 0.35,
    metalness: 0.55,
  });
  [
    [0, 1.4, 2.88, 0.07],
    [0, -1.4, 2.88, 0.07],
    [1.4, 0, 0.07, 2.88],
    [-1.4, 0, 0.07, 2.88],
  ].forEach(([x, z, w, d]) => {
    const t2 = new THREE.Mesh(new THREE.BoxGeometry(w, 0.03, d), trimMat);
    t2.position.set(x, 0.12, z);
    scene.add(t2);
  });

  const tri = (pts: Point2D[], color: number) => {
    const s = new THREE.Shape();
    s.moveTo(pts[0][0], pts[0][1]);
    s.lineTo(pts[1][0], pts[1][1]);
    s.lineTo(pts[2][0], pts[2][1]);
    s.closePath();
    const m = new THREE.Mesh(new THREE.ShapeGeometry(s), mat(color));
    m.rotation.x = -Math.PI / 2;
    m.position.y = 0.11;
    m.receiveShadow = true;
    scene.add(m);
    return m;
  };
  const triTint = (j: number) => {
    const P = slotPlayer(j);
    return P ? P.color : 0xe4dbc8;
  };
  tri(
    [
      [-1.38, -1.38],
      [-1.38, 1.38],
      [0, 0],
    ],
    triTint(0),
  );
  tri(
    [
      [1.38, -1.38],
      [1.38, 1.38],
      [0, 0],
    ],
    triTint(2),
  );
  tri(
    [
      [-1.38, 1.38],
      [1.38, 1.38],
      [0, 0],
    ],
    triTint(1),
  );
  tri(
    [
      [-1.38, -1.38],
      [1.38, -1.38],
      [0, 0],
    ],
    triTint(3),
  );

  players.forEach((P) => {
    const rim = new THREE.Mesh(new THREE.RingGeometry(0.22, 0.28, 24), mat(ringColor(P)));
    rim.rotation.x = -Math.PI / 2;
    rim.position.set(P.final[0], 0.118, P.final[1]);
    scene.add(rim);
  });
  const centerCap = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.28, 0.05, 16), trimMat);
  centerCap.position.y = 0.125;
  scene.add(centerCap);

  // 四角角楼
  for (let j = 0; j < 4; j++) {
    const P = slotPlayer(j);
    const sx = j === 0 || j === 3 ? -1 : 1;
    const sz = j === 0 || j === 1 ? -1 : 1;
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.95, 1.15), brickMat(1.1, 0.8));
    body.position.y = 0.58;
    g.add(body);
    const band = new THREE.Mesh(new THREE.BoxGeometry(1.36, 0.12, 1.36), merlonMat);
    band.position.y = 1.12;
    g.add(band);
    const roof1 = new THREE.Mesh(new THREE.ConeGeometry(1.12, 0.45, 4), mat(0x46515c, 0.5));
    roof1.position.y = 1.38;
    roof1.rotation.y = Math.PI / 4;
    g.add(roof1);
    const roof2 = new THREE.Mesh(new THREE.ConeGeometry(0.75, 0.42, 4), mat(0x3b454f, 0.5));
    roof2.position.y = 1.68;
    roof2.rotation.y = Math.PI / 4;
    g.add(roof2);
    const bead = new THREE.Mesh(new THREE.SphereGeometry(0.08, 10, 8), trimMat);
    bead.position.y = 1.94;
    g.add(bead);
    const lantMat = new THREE.MeshStandardMaterial({
      color: 0xe5442b,
      emissive: 0xb83018,
      emissiveIntensity: 0.75,
      roughness: 0.4,
    });
    for (const lx of [-1, 1]) {
      for (const lz of [-1, 1]) {
        const l = new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 10), lantMat);
        l.scale.y = 0.85;
        l.position.set(0.74 * lx, 1.02, 0.74 * lz);
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
    g.position.set(sx * 8.38, 0.12, sz * 8.38);
    scene.add(g);
  }

  /* ================= 6. 护城河与草地生态动物 ================= */
  const critters: CritterAnim[] = [];
  const moatDucks: MoatDuckAnim[] = [];
  const swimKois: SwimKoiAnim[] = [];
  const boats: BoatAnim[] = [];

  const furWhite = mat(0xf5f0e8, 0.82);
  const furCream = mat(0xebd8be, 0.82);
  const furCocoa = mat(0xc4a484, 0.82);
  const earPink = mat(0xffb6c8, 0.75);
  const nosePink = mat(0xff8fab, 0.55);
  const eyeDark = mat(0x1f1916, 0.25);

  const makeCuteBunny = () => {
    const fur = [furWhite, furCream, furCocoa][(Math.random() * 3) | 0];
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.17, 16, 14), fur);
    body.scale.set(0.95, 0.88, 1.25);
    body.position.y = 0.15;
    g.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.13, 16, 14), fur);
    head.scale.set(1.05, 0.95, 1.02);
    head.position.set(0, 0.29, 0.18);
    g.add(head);
    for (const sx of [-1, 1]) {
      const ear = new THREE.Mesh(new THREE.SphereGeometry(0.042, 10, 10), fur);
      ear.scale.set(0.75, 2.4, 0.55);
      ear.position.set(0.058 * sx, 0.46, 0.15);
      ear.rotation.set(-0.18, 0, 0.22 * sx);
      g.add(ear);
      const inner = new THREE.Mesh(new THREE.SphereGeometry(0.026, 8, 8), earPink);
      inner.scale.set(0.65, 2.0, 0.35);
      inner.position.set(0, 0, 0.016);
      ear.add(inner);
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.02, 8, 8), eyeDark);
      eye.position.set(0.075 * sx, 0.31, 0.275);
      g.add(eye);
      const cheek = new THREE.Mesh(new THREE.SphereGeometry(0.028, 8, 8), earPink);
      cheek.scale.set(1, 0.6, 0.3);
      cheek.position.set(0.085 * sx, 0.265, 0.255);
      g.add(cheek);
      const paw = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 8), fur);
      paw.position.set(0.07 * sx, 0.04, 0.2);
      g.add(paw);
    }
    const nose = new THREE.Mesh(new THREE.SphereGeometry(0.016, 8, 8), nosePink);
    nose.position.set(0, 0.28, 0.31);
    g.add(nose);
    const tail = new THREE.Mesh(new THREE.SphereGeometry(0.055, 10, 10), furWhite);
    tail.position.set(0, 0.14, -0.22);
    g.add(tail);
    g.rotation.y = rnd(0, 6.28);
    return g;
  };

  const birdCols = [mat(0x526475, 0.65), mat(0x7c583c, 0.65), mat(0x3f6e5c, 0.65)];
  const bellyMat = mat(0xf28b66, 0.7);
  const beakMat = mat(0xf5b83d, 0.5);
  const makeCuteBird = () => {
    const m = birdCols[(Math.random() * 3) | 0];
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.12, 14, 12), m);
    body.scale.set(0.95, 0.88, 1.3);
    g.add(body);
    const belly = new THREE.Mesh(new THREE.SphereGeometry(0.095, 12, 10), bellyMat);
    belly.position.set(0, -0.02, 0.04);
    g.add(belly);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.085, 12, 10), m);
    head.position.set(0, 0.08, 0.12);
    g.add(head);
    const beak = new THREE.Mesh(new THREE.ConeGeometry(0.026, 0.07, 6), beakMat);
    beak.rotation.x = Math.PI / 2;
    beak.position.set(0, 0.07, 0.22);
    g.add(beak);
    for (const sx of [-1, 1]) {
      const e = new THREE.Mesh(new THREE.SphereGeometry(0.014, 6, 6), eyeDark);
      e.position.set(0.05 * sx, 0.1, 0.175);
      g.add(e);
    }
    const lw = new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 8), m);
    lw.scale.set(1.4, 0.12, 0.65);
    lw.position.set(-0.18, 0.02, 0);
    g.add(lw);
    const rw = new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 8), m);
    rw.scale.set(1.4, 0.12, 0.65);
    rw.position.set(0.18, 0.02, 0);
    g.add(rw);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.018, 0.14), m);
    tail.position.set(0, 0.03, -0.18);
    tail.rotation.x = 0.22;
    g.add(tail);
    g.userData.lw = lw;
    g.userData.rw = rw;
    g.scale.setScalar(rnd(0.85, 1.25));
    return g;
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

  const koiRed = mat(0xf26430, 0.35);
  const koiWhite = mat(0xfffaf2, 0.35);
  const koiGold = mat(0xf5b731, 0.35);
  const makeKoi = () => {
    const m = Math.random() < 0.5 ? koiRed : koiGold;
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.11, 12, 10), m);
    body.scale.set(0.62, 0.68, 1.75);
    g.add(body);
    const spot = new THREE.Mesh(new THREE.SphereGeometry(0.075, 10, 8), koiWhite);
    spot.scale.set(0.68, 0.72, 1.1);
    spot.position.set(0, 0.01, 0.04);
    g.add(spot);
    const tailPivot = new THREE.Group();
    tailPivot.position.set(0, 0, -0.18);
    const tail = new THREE.Mesh(new THREE.ConeGeometry(0.085, 0.18, 4), m);
    tail.scale.set(0.22, 1, 1);
    tail.rotation.x = Math.PI / 2;
    tail.position.z = -0.07;
    tailPivot.add(tail);
    g.add(tailPivot);
    g.userData.tail = tailPivot;
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
      speed: 0.06 * (idx === 0 ? 1 : -1),
      rOff: idx === 0 ? 0.7 : -0.7,
      bob: idx * 2,
    });
  });

  for (let i = 0; i < 6; i++) {
    const k = makeKoi();
    scene.add(k);
    swimKois.push({
      g: k,
      th: i * 1.05,
      speed: (i % 2 ? 1 : -1) * rnd(0.1, 0.15),
      rOff: rnd(-1.05, 1.05),
      phase: i * 1.7,
    });
  }

  const spawnCritter = (kind: 'rabbit' | 'bird' | 'fly' | 'fish') => {
    if (kind === 'rabbit') {
      const g = makeCuteBunny();
      const a = rnd(0, 6.28);
      const r = rnd(18.5, 33);
      g.position.set(Math.cos(a) * r, -0.66, Math.sin(a) * r);
      scene.add(g);
      critters.push({
        kind: 'rabbit',
        g,
        ttl: rnd(12, 22),
        state: 'rest',
        rest: rnd(0.3, 1.2),
        hopT: 0,
        hopDur: rnd(0.34, 0.48),
        dir: rnd(0, 6.28),
      });
    } else if (kind === 'bird') {
      const g = makeCuteBird();
      const a = rnd(0, 6.28);
      const R = rnd(20, 26);
      const h = rnd(6.5, 11);
      const from = new THREE.Vector3(Math.cos(a) * R, h, Math.sin(a) * R);
      const to = new THREE.Vector3(
        -from.x + rnd(-8, 8),
        h + rnd(-1.5, 2),
        -from.z + rnd(-8, 8),
      );
      g.position.copy(from);
      g.lookAt(to);
      scene.add(g);
      critters.push({
        kind: 'bird',
        g,
        ttl: 40,
        from,
        to,
        prog: 0,
        dur: rnd(9, 14),
        flap: rnd(0, 6),
      });
    } else if (kind === 'fly') {
      const g = makeButterfly();
      const a = rnd(0, 6.28);
      const r = rnd(17.8, 33);
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
      const g = makeKoi();
      const a = rnd(0, 6.28);
      const rr = moatMid(a) + rnd(-0.8, 0.8);
      g.position.set(Math.cos(a) * rr, -0.54, Math.sin(a) * rr);
      g.rotation.y = rnd(0, 6.28);
      scene.add(g);
      critters.push({
        kind: 'fish',
        g,
        ttl: 2,
        prog: 0,
        h: rnd(0.55, 0.85),
      });
    }
  };

  spawnCritter('rabbit');
  spawnCritter('rabbit');

  // 小木船
  {
    const hullGeo = new THREE.BoxGeometry(0.38, 0.16, 1.38);
    const tipGeo = new THREE.ConeGeometry(0.16, 0.44, 4);
    const woodMat2 = mat(0x8a643e, 0.75);
    const woodDark = mat(0x5c422a, 0.8);
    const canopyMat = mat(0x524538, 0.88);
    const bodyMat = mat(0x55687a, 0.75);
    const hatMat = mat(0xd4c291, 0.8);
    const oarMat = mat(0x7a5c3a, 0.75);
    const skinMat = mat(0xf0d9b8, 0.65);
    const hairMat = mat(0x2b2b30, 0.5);
    const wakeMat = new THREE.MeshBasicMaterial({
      color: 0xe8fbff,
      transparent: true,
      opacity: 0.45,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const lantMat = new THREE.MeshStandardMaterial({
      color: 0xffb84d,
      emissive: 0xe88a1a,
      emissiveIntensity: 0.85,
      roughness: 0.35,
    });

    const makeBoat = (dir: number, passenger?: { cloth: number }) => {
      const g = new THREE.Group();
      g.add(new THREE.Mesh(hullGeo, woodMat2));
      const bow = new THREE.Mesh(tipGeo, woodDark);
      bow.rotation.x = Math.PI / 2;
      bow.position.z = 0.88;
      g.add(bow);
      const stern = new THREE.Mesh(tipGeo, woodDark);
      stern.rotation.x = -Math.PI / 2;
      stern.position.z = -0.88;
      g.add(stern);
      const awning = new THREE.Mesh(
        new THREE.CylinderGeometry(0.22, 0.22, 0.62, 12, 1, false, 0, Math.PI),
        canopyMat,
      );
      awning.rotation.set(Math.PI / 2, 0, Math.PI / 2);
      awning.position.set(0, 0.1, -0.14);
      g.add(awning);
      const bowLight = new THREE.Mesh(new THREE.SphereGeometry(0.055, 10, 8), lantMat);
      bowLight.position.set(0, 0.22, 0.72);
      g.add(bowLight);

      const man = new THREE.Group();
      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.09, 0.22, 8), bodyMat);
      body.position.y = 0.17;
      man.add(body);
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.055, 10, 8), skinMat);
      head.position.y = 0.32;
      man.add(head);
      const hat = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.075, 10), hatMat);
      hat.position.y = 0.38;
      man.add(hat);
      man.position.set(0.02, 0.05, 0.24);
      man.rotation.y = 0.5;
      g.add(man);

      const oar = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.04, 0.62), oarMat);
      oar.position.set(0.21, -0.02, -0.06);
      oar.rotation.set(0.25, 0.6, -0.5);
      g.add(oar);

      if (passenger) {
        const p = new THREE.Group();
        const robe = new THREE.Mesh(
          new THREE.CylinderGeometry(0.055, 0.095, 0.22, 8),
          mat(passenger.cloth),
        );
        robe.position.y = 0.16;
        p.add(robe);
        const ph = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8), skinMat);
        ph.position.y = 0.3;
        p.add(ph);
        const bun = new THREE.Mesh(new THREE.SphereGeometry(0.032, 8, 6), hairMat);
        bun.position.set(0, 0.355, 0.005);
        p.add(bun);
        p.position.set(0, 0.05, -0.22);
        p.rotation.y = -0.35;
        g.add(p);
      }

      const wake = new THREE.Mesh(new THREE.PlaneGeometry(0.55, 0.9), wakeMat.clone());
      wake.rotation.x = -Math.PI / 2;
      wake.position.set(0, 0.01, -1.15);
      g.add(wake);

      g.userData.man = man;
      g.userData.wake = wake;
      boats.push({
        g,
        th: Math.random() * Math.PI * 2,
        speed: dir * (0.045 + Math.random() * 0.015),
        bob: Math.random() * 6,
      });
      scene.add(g);
    };

    makeBoat(1, { cloth: 0xf7f3ec });
    makeBoat(-1, { cloth: 0x4a9a8a });
  }

  return {
    waterMesh,
    moatTex,
    rideToys,
    lotusList,
    willowDrapeList,
    petals,
    moatDucks,
    swimKois,
    boats,
    critters,
    moatMid,
    spawnCritter,
  };
}
