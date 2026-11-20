import * as THREE from 'three';
import { PlayerConfig, SLOTS, lineOf } from './constants';
import {
  createDiceFaceTexture,
  createHeadFaceTexture,
  createNumberBadgeTexture,
  createPropellerDiscTexture,
} from './textures';

export interface HeadFaceParts {
  leftEye: THREE.Mesh;
  rightEye: THREE.Mesh;
  leftSquint: THREE.Mesh;
  rightSquint: THREE.Mesh;
  leftBlush: THREE.Mesh;
  rightBlush: THREE.Mesh;
  mouthW: THREE.Mesh;
  mouthOpen: THREE.Group;
}

export interface PlaneParts {
  animRoot: THREE.Group;
  body: THREE.Mesh;
  headMesh: THREE.Mesh;
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
  shielded: boolean;
  shieldMesh?: THREE.Group;
  mesh: THREE.Group;
}

let _propDiscTex: THREE.CanvasTexture | null = null;
function getPropDiscTex(anisotropy = 4): THREE.CanvasTexture {
  if (!_propDiscTex) {
    _propDiscTex = createPropellerDiscTexture(anisotropy);
  }
  return _propDiscTex;
}

export function makePlaneModel(
  color: number,
  pastelTint?: number,
  anisotropy = 4,
  withWindshield = true,
): THREE.Group {
  const g = new THREE.Group();

  const baseBodyCol = new THREE.Color(pastelTint ?? color).lerp(
    new THREE.Color(0xfff6f8),
    pastelTint ? 0.22 : 0.48,
  );
  const accentCol = new THREE.Color(color).lerp(new THREE.Color(0x3a261e), 0.08);
  const cocoaHex = 0x4a3228;

  const bodyMat = new THREE.MeshStandardMaterial({
    color: baseBodyCol,
    roughness: 0.38,
    metalness: 0.04,
  });
  const accentMat = new THREE.MeshStandardMaterial({
    color: accentCol,
    roughness: 0.36,
    metalness: 0.06,
  });
  const cocoaMat = new THREE.MeshStandardMaterial({
    color: cocoaHex,
    roughness: 0.42,
  });
  const creamMat = new THREE.MeshStandardMaterial({
    color: 0xfffcf7,
    roughness: 0.34,
  });
  const glassMat = new THREE.MeshStandardMaterial({
    color: 0xd8f3ff,
    roughness: 0.16,
    metalness: 0.15,
    transparent: true,
    opacity: 0.78,
  });

  // 1) 圆润饱满的胖水滴流线机身
  const fuseProfile = [
    [0.0, -0.33],
    [0.048, -0.31],
    [0.088, -0.25],
    [0.128, -0.16],
    [0.162, -0.05],
    [0.176, 0.05],
    [0.172, 0.14],
    [0.154, 0.22],
    [0.122, 0.265],
    [0.0, 0.275],
  ].map(([r, z]) => new THREE.Vector2(r, z));

  const fusePts = new THREE.SplineCurve(fuseProfile).getPoints(36);
  const fuseGeo = new THREE.LatheGeometry(fusePts, 32);
  fuseGeo.rotateX(Math.PI / 2);
  const fuselage = new THREE.Mesh(fuseGeo, bodyMat);
  fuselage.scale.set(1.12, 0.96, 1.0);
  g.add(fuselage);

  const noseRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.146, 0.015, 10, 28),
    cocoaMat,
  );
  noseRing.position.set(0, -0.005, 0.225);
  g.add(noseRing);

  const cockpitRim = new THREE.Mesh(
    new THREE.TorusGeometry(0.126, 0.022, 12, 28),
    cocoaMat,
  );
  cockpitRim.rotation.x = Math.PI / 2 - 0.08;
  cockpitRim.scale.set(1.08, 1.15, 1);
  cockpitRim.position.set(0, 0.125, -0.02);
  g.add(cockpitRim);

  const cockpitWell = new THREE.Mesh(
    new THREE.CylinderGeometry(0.118, 0.105, 0.08, 22),
    cocoaMat,
  );
  cockpitWell.scale.set(1.06, 1, 1.12);
  cockpitWell.position.set(0, 0.095, -0.02);
  g.add(cockpitWell);

  if (withWindshield) {
    const canopy = new THREE.Mesh(
      new THREE.SphereGeometry(0.112, 18, 14, 0, Math.PI * 2, 0, Math.PI * 0.52),
      glassMat,
    );
    canopy.scale.set(1.02, 0.72, 1.18);
    canopy.position.set(0, 0.125, 0.01);
    g.add(canopy);
  }

  // 2) 两侧圆润饱满的椭圆形机翼
  const wingShape = new THREE.Shape();
  wingShape.moveTo(0, 0.085);
  wingShape.bezierCurveTo(0.14, 0.095, 0.32, 0.055, 0.36, -0.03);
  wingShape.bezierCurveTo(0.38, -0.095, 0.28, -0.14, 0.14, -0.115);
  wingShape.bezierCurveTo(0.05, -0.095, 0.01, -0.055, 0, 0.085);

  const wingGeo = new THREE.ExtrudeGeometry(wingShape, {
    depth: 0.022,
    bevelEnabled: true,
    bevelThickness: 0.016,
    bevelSize: 0.018,
    bevelSegments: 5,
    curveSegments: 20,
  });
  wingGeo.rotateX(Math.PI / 2);

  for (const sx of [-1, 1]) {
    const wingWrap = new THREE.Group();
    const wMesh = new THREE.Mesh(wingGeo, bodyMat);
    if (sx < 0) {
      wMesh.scale.x = -1;
    }
    wingWrap.add(wMesh);

    const roundel = new THREE.Mesh(
      new THREE.CylinderGeometry(0.036, 0.036, 0.058, 16),
      accentMat,
    );
    roundel.position.set(sx * 0.26, -0.01, -0.035);
    wingWrap.add(roundel);

    wingWrap.position.set(sx * 0.12, -0.03, 0.04);
    wingWrap.rotation.z = -sx * 0.09;
    wingWrap.rotation.x = 0.06;
    g.add(wingWrap);
  }

  // 3) 尾部圆润可爱的垂直尾翼与水平尾翼
  const vTailShape = new THREE.Shape();
  vTailShape.moveTo(0, 0);
  vTailShape.bezierCurveTo(0.02, 0.12, -0.02, 0.21, -0.075, 0.21);
  vTailShape.bezierCurveTo(-0.14, 0.21, -0.16, 0.11, -0.135, 0);
  vTailShape.closePath();

  const vTailGeo = new THREE.ExtrudeGeometry(vTailShape, {
    depth: 0.018,
    bevelEnabled: true,
    bevelThickness: 0.014,
    bevelSize: 0.014,
    bevelSegments: 4,
    curveSegments: 16,
  });
  vTailGeo.translate(0, 0, -0.009);
  vTailGeo.rotateY(Math.PI / 2);
  const vTail = new THREE.Mesh(vTailGeo, bodyMat);
  vTail.position.set(0, 0.055, -0.185);
  g.add(vTail);

  for (const sx of [-1, 1]) {
    const hTail = new THREE.Mesh(
      new THREE.SphereGeometry(0.095, 16, 12),
      bodyMat,
    );
    hTail.scale.set(1.28, 0.24, 0.62);
    hTail.position.set(sx * 0.11, 0.035, -0.265);
    hTail.rotation.y = -sx * 0.22;
    g.add(hTail);
  }

  // 4) 机腹可爱小巧双轮起落架
  for (const sx of [-1, 1]) {
    const strut = new THREE.Mesh(
      new THREE.CylinderGeometry(0.012, 0.012, 0.07, 8),
      cocoaMat,
    );
    strut.position.set(sx * 0.105, -0.125, 0.06);
    strut.rotation.z = sx * 0.18;
    g.add(strut);

    const wheel = new THREE.Mesh(
      new THREE.CylinderGeometry(0.042, 0.042, 0.028, 16),
      cocoaMat,
    );
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(sx * 0.115, -0.155, 0.06);
    g.add(wheel);

    const hub = new THREE.Mesh(
      new THREE.CylinderGeometry(0.02, 0.02, 0.032, 12),
      creamMat,
    );
    hub.rotation.z = Math.PI / 2;
    hub.position.set(sx * 0.115, -0.155, 0.06);
    g.add(hub);
  }

  // 5) 机头标志性大号白色同心旋风螺旋桨圆盘
  const propGroup = new THREE.Group();
  propGroup.position.set(0, -0.01, 0.272);

  const discTex = getPropDiscTex(anisotropy);
  const discFaceMat = new THREE.MeshStandardMaterial({
    map: discTex,
    roughness: 0.32,
  });
  const discMats = [cocoaMat, discFaceMat, discFaceMat];
  const windDisc = new THREE.Mesh(
    new THREE.CylinderGeometry(0.188, 0.188, 0.026, 32),
    discMats,
  );
  windDisc.rotation.x = Math.PI / 2;
  propGroup.add(windDisc);

  const spinner = new THREE.Mesh(
    new THREE.SphereGeometry(0.034, 14, 12),
    creamMat,
  );
  spinner.scale.set(1, 1, 0.72);
  spinner.position.z = 0.014;
  propGroup.add(spinner);

  g.add(propGroup);
  g.userData.propeller = propGroup;

  g.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });
  return g;
}

export function makePilotPlaneModel(P: PlayerConfig, anisotropy = 4): THREE.Group {
  const root = new THREE.Group();

  const planeTintMap: Record<string, number> = {
    yier: 0xfadadd,
    caomei: 0xf9cbd3,
    xiangyu: 0xd8cff6,
    bubu: 0xd2cff8,
    mocha: 0xd8ecbe,
    haiyan: 0xc8e4f6,
  };
  const planeTint = planeTintMap[P.key] ?? P.colorLight;

  const plane = makePlaneModel(lineOf(P), planeTint, anisotropy, false);
  plane.scale.setScalar(1.48);
  plane.position.y = 0.12;
  root.add(plane);

  if (plane.userData.propeller) {
    const prop = plane.userData.propeller as THREE.Group;
    prop.scale.setScalar(1.18);
    prop.position.set(0.02, -0.015, 0.278);
    root.userData.propeller = prop;
  }

  const M = (c: number, r = 0.5) => new THREE.MeshStandardMaterial({ color: c, roughness: r });
  const pilotHeadPivot = new THREE.Group();
  pilotHeadPivot.position.set(0, 0.25, -0.035);

  const headWrap = new THREE.Group();
  headWrap.position.set(0, -0.19, 0);
  const headMesh = loafHead(P, anisotropy);
  headWrap.add(headMesh);

  const mouthFrame = new THREE.Mesh(
    new THREE.CylinderGeometry(0.018, 0.015, 0.012, 16),
    M(0x4a2e24, 0.4),
  );
  mouthFrame.rotation.x = Math.PI / 2;
  mouthFrame.scale.set(0.85, 1.25, 1);
  mouthFrame.position.set(0, 0.296, 0.236);
  headWrap.add(mouthFrame);

  const tongue = new THREE.Mesh(
    new THREE.SphereGeometry(0.014, 14, 12),
    M(0xf2827f, 0.38),
  );
  tongue.scale.set(0.82, 1.18, 0.55);
  tongue.position.set(0, 0.295, 0.241);
  headWrap.add(tongue);

  if (P.species === 'panda') {
    for (const s of [-1, 1]) {
      const ear = new THREE.Mesh(new THREE.SphereGeometry(0.052, 16, 12), M(P.ear));
      ear.scale.set(1.05, 1.08, 0.85);
      ear.position.set(0.158 * s, 0.592, 0);
      headWrap.add(ear);
    }
  } else {
    for (const s of [-1, 1]) {
      const ear = new THREE.Mesh(new THREE.SphereGeometry(0.051, 16, 12), M(P.ear));
      ear.scale.set(1.04, 0.98, 0.85);
      ear.position.set(0.142 * s, 0.582, 0);
      headWrap.add(ear);

      const inner = new THREE.Mesh(new THREE.SphereGeometry(0.031, 14, 10), M(0x2a1a14));
      inner.scale.set(1, 0.92, 0.48);
      inner.position.set(0, -0.002, 0.036);
      ear.add(inner);
    }
  }

  if (P.species === 'panda') {
    const bowGrp = new THREE.Group();
    bowGrp.position.set(0, 0.185, 0.205);
    const bowMat = M(0x3b241c, 0.45);
    const knot = new THREE.Mesh(new THREE.SphereGeometry(0.022, 12, 10), bowMat);
    knot.scale.set(1, 0.9, 0.75);
    bowGrp.add(knot);
    for (const sx of [-1, 1]) {
      const lobe = new THREE.Mesh(new THREE.SphereGeometry(0.034, 14, 10), bowMat);
      lobe.scale.set(1.25, 0.78, 0.6);
      lobe.position.set(sx * 0.034, -0.004, -0.004);
      lobe.rotation.z = -sx * 0.28;
      bowGrp.add(lobe);
    }
    headWrap.add(bowGrp);
  }

  for (const sx of [-1, 1]) {
    const paw = new THREE.Mesh(new THREE.SphereGeometry(0.044, 14, 10), M(P.body));
    paw.scale.set(0.95, 0.78, 1.15);
    paw.position.set(sx * 0.175, 0.18, 0.11);
    headWrap.add(paw);
  }

  headWrap.scale.setScalar(1.36);
  pilotHeadPivot.add(headWrap);
  root.add(pilotHeadPivot);
  root.userData.pilotHead = pilotHeadPivot;

  root.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });
  return root;
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

  geo.userData.basePos = new Float32Array((geo.attributes.position as THREE.BufferAttribute).array);
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

  let leftEye!: THREE.Mesh;
  let rightEye!: THREE.Mesh;
  let leftSquint!: THREE.Mesh;
  let rightSquint!: THREE.Mesh;
  let leftBlush!: THREE.Mesh;
  let rightBlush!: THREE.Mesh;

  for (const s of [-1, 1]) {
    const th = 0.393 * s;
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.024, 20, 14), decMat(0x33241c));
    eye.scale.set(1, 1, 0.42);
    const ep = surfPt(th, 0.326, 0.002);
    eye.position.set(ep.x, 0.326, ep.z);
    eye.rotation.y = th;
    head.add(eye);
    if (s < 0) leftEye = eye;
    else rightEye = eye;

    // 弯弧眯眼 (> / < 形状，贴合头部曲面)
    const outerAng = th + s * 0.11;
    const innerAng = th - s * 0.055;
    const midAng = (outerAng + innerAng) * 0.5;
    const sqPts = [
      { a: outerAng, y: 0.342 },
      { a: midAng - s * 0.01, y: 0.333 },
      { a: innerAng, y: 0.326 },
      { a: midAng - s * 0.01, y: 0.319 },
      { a: outerAng, y: 0.310 },
    ].map(({ a, y }) => {
      const sp = surfPt(a, y, -0.0025);
      return new THREE.Vector3(sp.x, y, sp.z);
    });
    const squint = new THREE.Mesh(
      new THREE.TubeGeometry(new THREE.CatmullRomCurve3(sqPts), 24, 0.0046, 8, false),
      decMat(0x3a261d),
    );
    squint.visible = false;
    head.add(squint);
    if (s < 0) leftSquint = squint;
    else rightSquint = squint;

    const tb = 0.675 * s;
    const blush = new THREE.Mesh(new THREE.SphereGeometry(0.0462, 20, 14), decMat(P.blush));
    blush.scale.set(1, 1, 0.3);
    const bp = surfPt(tb, 0.26, 0.004);
    blush.position.set(bp.x, 0.26, bp.z);
    blush.rotation.y = tb;
    blush.rotation.x = (surfPt(tb, 0.3, 0).z - surfPt(tb, 0.22, 0).z) / 0.08;
    blush.userData.basePos = blush.position.clone();
    blush.userData.baseScale = blush.scale.clone();
    head.add(blush);
    if (s < 0) leftBlush = blush;
    else rightBlush = blush;
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
  const mouthW = new THREE.Mesh(
    new THREE.TubeGeometry(new THREE.CatmullRomCurve3(mpts), 32, 0.0032, 8, false),
    decMat(0x5a4030),
  );
  head.add(mouthW);

  // ω 上唇 + 带粉红小舌头的张嘴表情
  const mouthOpen = new THREE.Group();
  const openLipPts = mpts.map((p) => new THREE.Vector3(p.x * 1.04, p.y + 0.004, p.z + 0.0005));
  mouthOpen.add(
    new THREE.Mesh(
      new THREE.TubeGeometry(new THREE.CatmullRomCurve3(openLipPts), 32, 0.0035, 8, false),
      decMat(0x4a2e24),
    ),
  );
  const openRim = new THREE.Mesh(
    new THREE.CylinderGeometry(0.016, 0.0135, 0.01, 18),
    decMat(0x4a2e24),
  );
  openRim.rotation.x = Math.PI / 2;
  openRim.scale.set(0.86, 1.0, 1.32);
  openRim.position.set(0, my - 0.015, surfPt(0, my - 0.015, 0).z + 0.0012);
  mouthOpen.add(openRim);

  const openTongue = new THREE.Mesh(
    new THREE.SphereGeometry(0.0135, 16, 12),
    new THREE.MeshStandardMaterial({ color: 0xf2827f, roughness: 0.36 }),
  );
  openTongue.scale.set(0.76, 1.15, 0.52);
  openTongue.position.set(0, my - 0.017, surfPt(0, my - 0.017, 0).z + 0.0048);
  mouthOpen.add(openTongue);
  mouthOpen.visible = false;
  head.add(mouthOpen);

  head.userData.faceParts = {
    leftEye,
    rightEye,
    leftSquint,
    rightSquint,
    leftBlush,
    rightBlush,
    mouthW,
    mouthOpen,
  } satisfies HeadFaceParts;

  return head;
}

export function buildPlaneMesh(P: PlayerConfig, anisotropy: number): THREE.Group {
  const g = new THREE.Group();
  const M = (c: number) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.55 });
  const animRoot = new THREE.Group();
  g.add(animRoot);

  const body = new THREE.Mesh(new THREE.SphereGeometry(0.195, 24, 18), M(P.body));
  body.scale.set(0.96, 0.98, 0.92);
  body.position.y = 0.21;
  animRoot.add(body);

  const armPivots: THREE.Group[] = [];
  const footPivots: THREE.Group[] = [];
  for (const s of [-1, 1]) {
    const ap = new THREE.Group();
    ap.position.set(0.165 * s, 0.275, 0.02);
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

  if (P.species === 'panda') {
    const ribbonMat = new THREE.MeshStandardMaterial({ color: 0x221b18, roughness: 0.45 });
    const collar = new THREE.Mesh(new THREE.TorusGeometry(0.145, 0.017, 10, 28), ribbonMat);
    collar.rotation.x = Math.PI / 2 + 0.08;
    collar.position.set(0, 0.295, 0.01);
    animRoot.add(collar);

    const bowGrp = new THREE.Group();
    bowGrp.position.set(0, 0.278, 0.162);
    const knot = new THREE.Mesh(new THREE.SphereGeometry(0.02, 12, 10), ribbonMat);
    knot.scale.set(1, 0.9, 0.75);
    bowGrp.add(knot);
    for (const sx of [-1, 1]) {
      const lobe = new THREE.Mesh(new THREE.SphereGeometry(0.032, 14, 10), ribbonMat);
      lobe.scale.set(0.85, 1.25, 0.55);
      lobe.position.set(sx * 0.022, -0.024, 0.002);
      lobe.rotation.z = sx * 0.42;
      bowGrp.add(lobe);
    }
    animRoot.add(bowGrp);
  }

  const headPivot = new THREE.Group();
  headPivot.position.set(0, 0.3, 0);
  const headWrap = new THREE.Group();
  headWrap.position.set(0, -0.22, 0);
  const headMesh = loafHead(P, anisotropy);
  headWrap.add(headMesh);

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
  // 护盾透明球形光罩 + 绕身金青能量环（默认隐藏，获得护盾后激活）
  const shieldMesh = new THREE.Group();
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(0.45, 24, 18),
    new THREE.MeshStandardMaterial({
      color: 0x6ce5ff,
      emissive: 0x26b6e8,
      emissiveIntensity: 0.42,
      roughness: 0.16,
      metalness: 0.08,
      transparent: true,
      opacity: 0.27,
      depthWrite: false,
    }),
  );
  dome.position.y = 0.34;
  dome.renderOrder = 4;
  shieldMesh.add(dome);

  const eqRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.455, 0.016, 8, 32),
    new THREE.MeshStandardMaterial({
      color: 0x8ef5ff,
      emissive: 0x38bdf8,
      emissiveIntensity: 0.65,
      roughness: 0.25,
      transparent: true,
      opacity: 0.85,
    }),
  );
  eqRing.rotation.x = Math.PI / 2 - 0.18;
  eqRing.position.y = 0.34;
  shieldMesh.add(eqRing);
  shieldMesh.visible = false;
  shieldMesh.userData.eqRing = eqRing;
  g.add(shieldMesh);

  g.scale.setScalar(0.92);
  g.userData.shieldMesh = shieldMesh;
  g.userData.parts = {
    animRoot,
    body,
    headMesh,
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

  const dice2 = new THREE.Mesh(createChibiDiceGeometry(), diceMaterials);
  dice2.position.set(0.28, DICE_REST_Y, 0);
  dice2.scale.setScalar(0.46);
  dice2.castShadow = true;
  dice2.visible = false;
  scene.add(dice2);

  const dice2Shadow = new THREE.Mesh(
    new THREE.CircleGeometry(0.29, 24),
    new THREE.MeshBasicMaterial({
      color: 0x201a12,
      transparent: true,
      opacity: 0.26,
      depthWrite: false,
    }),
  );
  dice2Shadow.rotation.x = -Math.PI / 2;
  dice2Shadow.position.set(0.28, 0.2515, 0);
  dice2Shadow.visible = false;
  scene.add(dice2Shadow);

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
    dice2,
    diceMaterials,
    diceHitMesh,
    diceShadow,
    dice2Shadow,
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

export function buildToyMissileMesh(accentColor: number): THREE.Group {
  const g = new THREE.Group();

  const bodyMat = new THREE.MeshStandardMaterial({
    color: 0xfff8ee,
    roughness: 0.34,
    metalness: 0.08,
  });
  const redMat = new THREE.MeshStandardMaterial({
    color: 0xe5484d,
    roughness: 0.38,
    metalness: 0.1,
  });
  const goldMat = new THREE.MeshStandardMaterial({
    color: accentColor,
    roughness: 0.32,
    metalness: 0.25,
  });
  const flameMat = new THREE.MeshStandardMaterial({
    color: 0xffb224,
    emissive: 0xff6a00,
    emissiveIntensity: 1.4,
    roughness: 0.2,
  });

  // 导弹沿着 +Z 方向前进
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.115, 0.125, 0.46, 20), bodyMat);
  body.rotation.x = Math.PI / 2;
  g.add(body);

  const stripe = new THREE.Mesh(new THREE.CylinderGeometry(0.122, 0.122, 0.09, 20), goldMat);
  stripe.rotation.x = Math.PI / 2;
  stripe.position.z = 0.04;
  g.add(stripe);

  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.118, 0.24, 20), redMat);
  nose.rotation.x = Math.PI / 2;
  nose.position.z = 0.35;
  g.add(nose);

  const tipCap = new THREE.Mesh(new THREE.SphereGeometry(0.036, 12, 10), goldMat);
  tipCap.position.z = 0.455;
  g.add(tipCap);

  // 4 片尾翼
  const finGeo = new THREE.BoxGeometry(0.024, 0.13, 0.14);
  for (let i = 0; i < 4; i++) {
    const fin = new THREE.Mesh(finGeo, redMat);
    const a = (i * Math.PI) / 2 + Math.PI / 4;
    fin.position.set(Math.cos(a) * 0.12, Math.sin(a) * 0.12, -0.17);
    fin.rotation.z = a + Math.PI / 2;
    g.add(fin);
  }

  const flame = new THREE.Mesh(new THREE.ConeGeometry(0.085, 0.24, 14), flameMat);
  flame.rotation.x = -Math.PI / 2;
  flame.position.z = -0.34;
  g.add(flame);
  g.userData.flame = flame;

  g.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) o.castShadow = true;
  });
  return g;
}

