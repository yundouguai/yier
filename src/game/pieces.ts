import * as THREE from 'three';
import { PlayerConfig, SLOTS } from './constants';
import {
  createDiceFaceTexture,
  createHeadFaceTexture,
  createNumberBadgeTexture,
} from './textures';

export interface PlaneParts {
  animRoot: THREE.Group;
  body: THREE.Mesh;
  headPivot: THREE.Group;
  leftArm: THREE.Group;
  rightArm: THREE.Group;
  leftFoot: THREE.Group;
  rightFoot: THREE.Group;
}

export interface PlaneData {
  pid: number;
  idx: number;
  pos: number;
  animating: boolean;
  phase: number;
  mesh: THREE.Group;
}

export function makePlaneModel(color: number): THREE.Group {
  const g = new THREE.Group();
  const M = new THREE.MeshStandardMaterial({ color, roughness: 0.4 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x35454f, roughness: 0.3 });

  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.065, 0.38, 12), M);
  body.rotation.x = Math.PI / 2;
  g.add(body);

  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.14, 12), M);
  nose.rotation.x = Math.PI / 2;
  nose.position.z = 0.26;
  g.add(nose);

  const canopy = new THREE.Mesh(new THREE.SphereGeometry(0.042, 10, 8), dark);
  canopy.scale.set(0.75, 0.55, 1.2);
  canopy.position.set(0, 0.055, 0.06);
  g.add(canopy);

  const wing = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.022, 0.14), M);
  wing.position.set(0, 0.01, -0.03);
  g.add(wing);

  const tailH = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.02, 0.07), M);
  tailH.position.set(0, 0.03, -0.18);
  g.add(tailH);

  const tailV = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.12, 0.08), M);
  tailV.position.set(0, 0.08, -0.18);
  g.add(tailV);

  g.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) o.castShadow = true;
  });
  return g;
}

function loafHead(P: PlayerConfig, anisotropy: number): THREE.Mesh {
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
  const geo = new THREE.LatheGeometry(pts, 80, Math.PI, Math.PI * 2);
  const pos = geo.attributes.position;
  const v = new THREE.Vector3();

  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const r = Math.sqrt(v.x * v.x + v.z * v.z) || 1;
    const f = v.z / r;
    const band =
      THREE.MathUtils.smoothstep(v.y, 0.215, 0.24) *
      (1 - THREE.MathUtils.smoothstep(v.y, 0.285, 0.315));
    const bx = 0.98 + 0.02 * band;
    const bzBand = 1.028 + 0.022 * f;
    const bz = 1 + (bzBand - 1) * band;
    pos.setXYZ(i, v.x * 1.08 * bx, 0.19 + (v.y - 0.19) * 0.85, v.z * 0.93 * bz);
  }
  geo.computeVertexNormals();

  const head = new THREE.Mesh(
    geo,
    new THREE.MeshStandardMaterial({
      map: createHeadFaceTexture(P, anisotropy),
      roughness: 0.42,
    }),
  );
  const decMat = (c: number) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.42 });
  const spl = new THREE.SplineCurve(raw).getPoints(400);

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
    const py = 0.19 + (hy - 0.19) / 0.85;
    const r = radiusAt(py);
    const f = Math.cos(ang);
    const band =
      THREE.MathUtils.smoothstep(py, 0.215, 0.24) *
      (1 - THREE.MathUtils.smoothstep(py, 0.285, 0.315));
    const bzBand = 1.05 + 0.05 * f;
    const bz = 1 + (bzBand - 1) * band;
    const Rx = r * 1.08 * (0.98 + 0.02 * band);
    const Rz = r * 0.93 * bz;
    return {
      x: Rx * Math.sin(ang) * (1 - embed / Rx),
      z: Rz * Math.cos(ang) * (1 - embed / Rz),
    };
  };

  for (const s of [-1, 1]) {
    const th = 0.393 * s;
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.024, 20, 14), decMat(0x33241c));
    eye.scale.set(1, 1, 0.42);
    const ep = surfPt(th, 0.326, 0.002);
    eye.position.set(ep.x, 0.326, ep.z);
    eye.rotation.y = th;
    head.add(eye);

    const tb = 0.675 * s;
    const blush = new THREE.Mesh(new THREE.SphereGeometry(0.0462, 20, 14), decMat(P.blush));
    blush.scale.set(1, 1, 0.3);
    const bp = surfPt(tb, 0.26, 0.004);
    blush.position.set(bp.x, 0.26, bp.z);
    blush.rotation.y = tb;
    blush.rotation.x = (surfPt(tb, 0.3, 0).z - surfPt(tb, 0.22, 0).z) / 0.08;
    head.add(blush);
  }

  const my = 0.316;
  const half: THREE.Vector2[] = [];
  for (let k = 0; k <= 10; k++) {
    const a = Math.PI * (1 - (k / 10) * 0.85);
    half.push(new THREE.Vector2(-0.014 + Math.cos(a) * 0.011, my + 0.008 - Math.sin(a) * 0.016));
  }
  for (let k = 1; k <= 6; k++) {
    const t = k / 6;
    const u = 1 - t;
    half.push(
      new THREE.Vector2(
        u * u * -0.0042 + 2 * u * t * -0.001,
        my + u * u * 0.0007 + 2 * u * t * 0.0008 + t * t * 0.0022,
      ),
    );
  }
  const mpts = half
    .concat(
      half
        .slice(0, -1)
        .reverse()
        .map((p) => new THREE.Vector2(-p.x, p.y)),
    )
    .map((p) => new THREE.Vector3(p.x, p.y, surfPt(0, p.y, 0).z + 0.0022));
  head.add(
    new THREE.Mesh(
      new THREE.TubeGeometry(new THREE.CatmullRomCurve3(mpts), 32, 0.0032, 8, false),
      decMat(0x5a4030),
    ),
  );
  return head;
}

export function buildPlaneMesh(P: PlayerConfig, anisotropy: number): THREE.Group {
  const g = new THREE.Group();
  const M = (c: number) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.55 });
  const animRoot = new THREE.Group();
  g.add(animRoot);

  const body = new THREE.Mesh(new THREE.SphereGeometry(0.195, 24, 18), M(P.body));
  body.scale.set(1, 0.7, 0.95);
  body.position.y = 0.155;
  animRoot.add(body);

  const armPivots: THREE.Group[] = [];
  const footPivots: THREE.Group[] = [];
  for (const s of [-1, 1]) {
    const ap = new THREE.Group();
    ap.position.set(0.165 * s, 0.2, 0.02);
    const arm = new THREE.Mesh(new THREE.SphereGeometry(0.05, 12, 10), M(P.body));
    arm.scale.set(0.85, 1.2, 0.85);
    arm.position.set(0.02 * s, -0.03, 0);
    arm.rotation.z = -s * 0.35;
    ap.add(arm);
    animRoot.add(ap);
    armPivots.push(ap);

    const fp = new THREE.Group();
    fp.position.set(0.08 * s, 0.07, 0.02);
    const foot = new THREE.Mesh(new THREE.SphereGeometry(0.065, 12, 10), M(P.foot));
    foot.scale.set(0.9, 0.6, 1.25);
    foot.position.set(0, -0.03, 0.03);
    fp.add(foot);
    animRoot.add(fp);
    footPivots.push(fp);
  }

  const headPivot = new THREE.Group();
  headPivot.position.set(0, 0.22, 0);
  const headWrap = new THREE.Group();
  headWrap.position.set(0, -0.22, 0);
  headWrap.add(loafHead(P, anisotropy));

  if (P.species === 'panda') {
    for (const s of [-1, 1]) {
      const ear = new THREE.Mesh(new THREE.SphereGeometry(0.048, 16, 12), M(P.ear));
      ear.scale.set(1, 1.05, 0.85);
      ear.position.set(0.155 * s, 0.59, 0);
      headWrap.add(ear);
    }
  } else {
    for (const s of [-1, 1]) {
      const ear = new THREE.Mesh(new THREE.SphereGeometry(0.047, 16, 12), M(P.ear));
      ear.scale.set(1, 0.95, 0.85);
      ear.position.set(0.137 * s, 0.58, 0);
      headWrap.add(ear);

      const inner = new THREE.Mesh(new THREE.SphereGeometry(0.029, 14, 10), M(0x2a1a14));
      inner.scale.set(1, 0.92, 0.48);
      inner.position.set(0, -0.002, 0.035);
      ear.add(inner);
    }
  }

  headPivot.add(headWrap);
  animRoot.add(headPivot);

  g.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) o.castShadow = true;
  });
  g.scale.setScalar(0.92);
  g.userData.parts = {
    animRoot,
    body,
    headPivot,
    leftArm: armPivots[0],
    rightArm: armPivots[1],
    leftFoot: footPivots[0],
    rightFoot: footPivots[1],
  } satisfies PlaneParts;

  return g;
}

export const DICE_REST_Y = 0.502;

function createChibiDiceGeometry(): THREE.BufferGeometry {
  const half = 0.475;
  const radius = 0.185;
  const inner = half - radius;
  const puffSphRadius = 0.51;
  const puffRatio = 0.16;

  const geo = new THREE.BoxGeometry(half * 2, half * 2, half * 2, 16, 16, 16);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const norm = geo.attributes.normal as THREE.BufferAttribute;
  const v = new THREE.Vector3();
  const c = new THREE.Vector3();
  const nBox = new THREE.Vector3();
  const nSph = new THREE.Vector3();
  const pBox = new THREE.Vector3();
  const pSph = new THREE.Vector3();

  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    c.set(
      THREE.MathUtils.clamp(v.x, -inner, inner),
      THREE.MathUtils.clamp(v.y, -inner, inner),
      THREE.MathUtils.clamp(v.z, -inner, inner),
    );
    nBox.subVectors(v, c);
    if (nBox.lengthSq() > 1e-8) nBox.normalize();
    else nBox.fromBufferAttribute(norm, i).normalize();

    pBox.copy(c).addScaledVector(nBox, radius);
    nSph.copy(pBox).normalize();
    pSph.copy(nSph).multiplyScalar(puffSphRadius);

    v.lerpVectors(pBox, pSph, puffRatio);
    pos.setXYZ(i, v.x, v.y, v.z);

    nBox.lerp(nSph, puffRatio).normalize();
    norm.setXYZ(i, nBox.x, nBox.y, nBox.z);
  }
  pos.needsUpdate = true;
  norm.needsUpdate = true;
  return geo;
}

export function buildDiceRig(scene: THREE.Scene, anisotropy: number) {
  const faceOrder = [3, 4, 1, 6, 2, 5];
  const diceMaterials = faceOrder.map(
    (n) =>
      new THREE.MeshStandardMaterial({
        map: createDiceFaceTexture(n, anisotropy),
        roughness: 0.24,
        metalness: 0.03,
      }),
  );
  const dice = new THREE.Mesh(createChibiDiceGeometry(), diceMaterials);
  dice.position.set(0, DICE_REST_Y, 0);
  dice.scale.setScalar(0.52);
  dice.castShadow = true;
  scene.add(dice);

  const diceHitMesh = new THREE.Mesh(
    new THREE.SphereGeometry(0.95, 12, 10),
    new THREE.MeshBasicMaterial({ visible: false }),
  );
  dice.add(diceHitMesh);

  const diceShadow = new THREE.Mesh(
    new THREE.CircleGeometry(0.33, 24),
    new THREE.MeshBasicMaterial({
      color: 0x201a12,
      transparent: true,
      opacity: 0.28,
      depthWrite: false,
    }),
  );
  diceShadow.rotation.x = -Math.PI / 2;
  diceShadow.position.set(0, 0.2515, 0);
  scene.add(diceShadow);

  const diceHint = new THREE.Group();
  diceHint.position.set(0, 0.254, 0);
  scene.add(diceHint);

  const dhRingMat = new THREE.MeshBasicMaterial({
    color: 0x5ec992,
    transparent: true,
    opacity: 0.84,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const dhRing = new THREE.Mesh(new THREE.RingGeometry(0.37, 0.43, 36), dhRingMat);
  dhRing.rotation.x = -Math.PI / 2;
  diceHint.add(dhRing);

  const dhRippleMat = new THREE.MeshBasicMaterial({
    color: 0x9ae8be,
    transparent: true,
    opacity: 0.46,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const dhRipple = new THREE.Mesh(new THREE.RingGeometry(0.38, 0.43, 36), dhRippleMat);
  dhRipple.rotation.x = -Math.PI / 2;
  dhRipple.position.y = -0.001;
  diceHint.add(dhRipple);

  diceHint.visible = false;

  return {
    dice,
    diceMaterials,
    diceHitMesh,
    diceShadow,
    diceHint,
    dhRing,
    dhRipple,
  };
}

export function buildPickHints(scene: THREE.Scene, anisotropy: number): THREE.Group[] {
  const hints: THREE.Group[] = [];
  for (let num = 1; num <= 4; num++) {
    const grp = new THREE.Group();
    const cone = new THREE.Mesh(
      new THREE.ConeGeometry(0.18, 0.42, 4),
      new THREE.MeshStandardMaterial({
        color: 0x3aa66b,
        emissive: 0x2e8b57,
        emissiveIntensity: 1.2,
        roughness: 0.35,
      }),
    );
    cone.rotation.x = Math.PI;
    grp.add(cone);

    const badge = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: createNumberBadgeTexture(num, anisotropy),
        transparent: true,
      }),
    );
    badge.scale.set(0.52, 0.52, 1);
    badge.position.y = 0.48;
    grp.add(badge);

    grp.visible = false;
    grp.userData.baseY = 1.55;
    scene.add(grp);
    hints.push(grp);
  }
  return hints;
}

export function buildTurnArrow(scene: THREE.Scene): THREE.Mesh {
  const turnArrow = new THREE.Mesh(
    new THREE.ConeGeometry(0.32, 0.56, 4),
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0x888888,
      emissiveIntensity: 0.55,
      roughness: 0.35,
    }),
  );
  turnArrow.rotation.x = Math.PI;
  turnArrow.userData.home = { x: 0, z: 0 };
  scene.add(turnArrow);
  return turnArrow;
}
