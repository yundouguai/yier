import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import {
  ensureAudio,
  beep,
  sndCap,
  sndHop,
  sndRoll,
  sndWin,
  sndYourTurn,
} from './audio';
import {
  CHARS,
  CharKey,
  CameraMode,
  FLIGHT_FROM,
  FLIGHT_STEP,
  GameHudSnapshot,
  GamePhase,
  HOME_END,
  ORIENT,
  PlayerConfig,
  Point2D,
  RING,
  SEAT_ORDER,
  SLOTS,
  STACK_OFF,
  SeatConfig,
  lineOf,
  toColorHex,
} from './constants';
import {
  DICE_REST_Y,
  HeadFaceParts,
  PlaneData,
  PlaneParts,
  buildDiceRig,
  buildPickHints,
  buildPlaneMesh,
  buildTurnArrow,
  makePilotPlaneModel,
  makePlaneModel,
} from './pieces';
import { createNumberBadgeTexture } from './textures';
import { WorldRefs, buildAncientWorld } from './world';

const TIMEOUT = 30000;
const STACK_STEP_Y = 0.545;
const rnd = (a: number, b: number) => a + Math.random() * (b - a);
const lerpAngle = (a: number, b: number, t: number) =>
  a + Math.atan2(Math.sin(b - a), Math.cos(b - a)) * t;

const _scratchDiceScale = new THREE.Vector3();
const _scratchFenceColor = new THREE.Color();
const _scratchCamOffset = new THREE.Vector3();
const _scratchCamSpherical = new THREE.Spherical();
const _scratchCamPos = new THREE.Vector3();
const _scratchBirdPos = new THREE.Vector3();
const _scratchBirdNext = new THREE.Vector3();
const _scratchBirdPrev = new THREE.Vector3();
const _scratchBirdOrb = new THREE.Vector3();
const _scratchHeadCrown = new THREE.Vector3();
const _scratchHeadQuat = new THREE.Quaternion();
const _scratchTargetQuat = new THREE.Quaternion();
const _scratchYawQuat = new THREE.Quaternion();
const _scratchUpAxis = new THREE.Vector3(0, 1, 0);
const _scratchHandleRear = new THREE.Vector3();
const _scratchHandleFore = new THREE.Vector3();
const _scratchBoatAnchor = new THREE.Vector3();
const _scratchProj = new THREE.Vector3();

const ROMANTIC_POEMS: { a: string; b: string }[] = [
  { a: '清风拂柳画船移', b: '春水映花君莫迟' },
  { a: '一川烟雨微风软', b: '半篙春水落花香' },
  { a: '风裁细柳千丝绿', b: '月照寒梅半盏香' },
  { a: '曾约花前同醉月', b: '今逢水上共听风' },
  { a: '闲看花影浮碧水', b: '静听风声入画栏' },
  { a: '雪落梅梢香暗动', b: '月移花影意绵长' },
  { a: '春风不解离人意', b: '偏送落花到画舟' },
  { a: '一棹清风千里月', b: '满船花影半溪云' },
  { a: '君似春风来破雪', b: '我如明月照花眠' },
  { a: '风起涟漪摇月色', b: '舟停柳岸对花吟' },
  { a: '雪后晴云舒远岫', b: '花间清露湿罗衣' },
  { a: '月色如银铺浅水', b: '花香似梦绕轻舟' },
  { a: '借得三更湖上月', b: '换来一曲袖间风' },
  { a: '踏雪寻梅犹念旧', b: '临风赏月最相思' },
  { a: '微风轻展衣间雪', b: '细雨斜吹鬓角花' },
  { a: '星月满船君作伴', b: '风花入梦夜生香' },
  { a: '柳絮随风沾画楫', b: '桃花带月映清波' },
  { a: '雪融春水波先暖', b: '风入花林梦亦甜' },
  { a: '一帘月影清如水', b: '十里花风暖似春' },
  { a: '愿作清风常伴月', b: '甘为飞雪共护花' },
];

interface AnimTween {
  t0: number;
  dur: number;
  fn: (k: number) => void;
  res: () => void;
}

interface PendingTask {
  at: number;
  fn: () => void;
}

function detectSoftwareGl(): boolean {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param));
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return true;
  }
}

export class FlightChessEngine {
  private container: HTMLElement;
  private onSnapshot: (snap: GameHudSnapshot) => void;
  private onContextLostCb?: (lost: boolean) => void;

  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private controls: OrbitControls;
  private envRT: THREE.WebGLRenderTarget;
  private isSoftwareGl: boolean;
  private anisotropy: number;

  private players: PlayerConfig[];
  private planes: PlaneData[] = [];
  private world: WorldRefs;
  private diceRig: ReturnType<typeof buildDiceRig>;
  private pickHints: THREE.Group[];
  private badgeTexCache = new Map<string, THREE.CanvasTexture>();
  private turnArrow: THREE.Mesh;
  private hlRings: THREE.Mesh[] = [];

  private phase: GamePhase = 'idle';
  private turn = 0;
  private die: number | null = null;
  private hudDieFace = 6;
  private hudDieRolling = false;
  private hudDiePopKey = 0;
  private sixChain = 0;
  private movable: { plane: PlaneData }[] = [];
  private timeMs = 0;
  private paused = false;
  private deadline: number | null = null;
  private camMode: CameraMode = 'follow';
  private camGoalActive = false;
  private camGoalTarget = new THREE.Vector3(0, 0.06, 1.15);
  private camGoalSpherical = new THREE.Spherical(16.4, 0.96, 0.18);
  private camFollowPlane: PlaneData | null = null;
  private camFollowObj: THREE.Object3D | null = null;
  private camUserInteracting = false;
  private winnerPid: number | null = null;
  private finishedOrder: number[] = [];
  private gmNextDie: number | null = null;
  private lastSec = -1;

  private message: string | null = null;
  private messageColor: string | null = null;
  private messageKey = 0;
  private msgTimer: number | null = null;
  private splashText: string | null = null;
  private splashAvatar = '🐼';
  private splashCharKey: CharKey = 'yier';
  private splashColor = '#3aa66b';
  private splashVisible = false;
  private splashTimer: number | null = null;
  private splashRaf = 0;
  private shakeKey = 0;

  private anims: AnimTween[] = [];
  private pending: PendingTask[] = [];
  private clock = new THREE.Clock();
  private frameId = 0;
  private disposed = false;

  private poemState: 'cruising' | 'slowing' | 'verse1' | 'verse2' | 'departing' = 'cruising';
  private poemTimer = 0;
  private poemCooldown = 2.0;
  private activePoemIdx = 0;
  private lastPoemIdx = -1;
  private poemLayer: HTMLDivElement;
  private poemBubbles: {
    scholar: { root: HTMLDivElement; text: HTMLSpanElement; visible: boolean };
    maiden: { root: HTMLDivElement; text: HTMLSpanElement; visible: boolean };
  };

  private ray = new THREE.Raycaster();
  private ptr = new THREE.Vector2();
  private downXY: [number, number] | null = null;
  private diceHovered = false;
  private lastHoverRaycast = 0;

  private boundResize: () => void;
  private boundPointerDown: (e: PointerEvent) => void;
  private boundPointerMove: (e: PointerEvent) => void;
  private boundPointerUp: (e: PointerEvent) => void;
  private boundContextLost: (e: Event) => void;
  private boundContextRestored: () => void;
  private boundControlsStart: () => void;
  private boundControlsEnd: () => void;

  constructor(
    container: HTMLElement,
    seats: SeatConfig[],
    autoStart: boolean,
    onSnapshot: (snap: GameHudSnapshot) => void,
    onContextLost?: (lost: boolean) => void,
  ) {
    this.container = container;
    this.onSnapshot = onSnapshot;
    this.onContextLostCb = onContextLost;

    const activeSeats = seats.filter((s) => s.on);
    const chosen =
      activeSeats.length >= 2 && activeSeats.length <= 4
        ? activeSeats
        : [
            { on: true, char: 'yier' as const, type: 'human' as const },
            { on: true, char: 'bubu' as const, type: 'ai' as const },
          ];

    const slotIndices = SEAT_ORDER[chosen.length];
    this.players = chosen.map((c, i) => ({
      ...CHARS[c.char],
      type: c.type,
      ...this.getSlot(slotIndices[i]),
    }));

    this.isSoftwareGl = detectSoftwareGl();
    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl,
      powerPreference: 'high-performance',
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(
      this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2),
    );
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.04;
    this.renderer.shadowMap.enabled = !this.isSoftwareGl;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.container.appendChild(this.renderer.domElement);

    this.anisotropy = this.renderer.capabilities.getMaxAnisotropy();

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xdbe8df);
    this.scene.fog = new THREE.Fog(0xdbe8df, 48, 108);

    const pmremGenerator = new THREE.PMREMGenerator(this.renderer);
    const roomEnv = new RoomEnvironment();
    this.envRT = pmremGenerator.fromScene(roomEnv, 0.04);
    this.scene.environment = this.envRT.texture;
    this.scene.environmentIntensity = 0.38;
    roomEnv.dispose();
    pmremGenerator.dispose();

    const portrait = () => window.innerHeight > window.innerWidth;
    this.camera = new THREE.PerspectiveCamera(
      portrait() ? 54 : 47,
      window.innerWidth / window.innerHeight,
      0.1,
      140,
    );
    this.fitOrientation();

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    const home = this.getHomeCameraPose();
    this.controls.target.set(home.tx, home.ty, home.tz);
    this.camGoalTarget.set(home.tx, home.ty, home.tz);
    this.camGoalSpherical.set(home.radius, home.phi, home.theta);
    _scratchCamOffset.setFromSpherical(this.camGoalSpherical);
    this.camera.position.copy(this.controls.target).add(_scratchCamOffset);

    this.controls.enableDamping = !this.isSoftwareGl;
    this.controls.dampingFactor = 0.08;
    this.controls.enablePan = true;
    this.controls.screenSpacePanning = false;
    this.controls.rotateSpeed = 0.78;
    this.controls.zoomSpeed = 0.9;
    this.controls.panSpeed = 0.75;
    this.controls.minDistance = 5.5;
    this.controls.maxDistance = 38;
    this.controls.minPolarAngle = 0.14;
    this.controls.maxPolarAngle = 1.24;

    if (new URLSearchParams(window.location.search).has('closeup')) {
      this.camera.position.set(14.6, 1.5, 14.6);
      this.controls.target.set(11.5, 0.5, 11.5);
      this.controls.minDistance = 2;
    }

    // Lighting rig
    this.scene.add(new THREE.HemisphereLight(0xfff5e4, 0x8ea874, 0.72));
    const sun = new THREE.DirectionalLight(0xffdfb0, 1.32);
    sun.position.set(8, 16, 7);
    sun.castShadow = !this.isSoftwareGl;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -13;
    sun.shadow.camera.right = 13;
    sun.shadow.camera.top = 13;
    sun.shadow.camera.bottom = -13;
    sun.shadow.bias = -0.0004;
    this.scene.add(sun);

    const fill = new THREE.DirectionalLight(0xd0e2f2, 0.34);
    fill.position.set(-9, 8, -6);
    this.scene.add(fill);

    // World & Pieces
    this.world = buildAncientWorld(this.scene, this.players, this.anisotropy);
    this.diceRig = buildDiceRig(this.scene, this.anisotropy);
    this.pickHints = buildPickHints(this.scene, this.anisotropy);
    this.turnArrow = buildTurnArrow(this.scene);

    // 游船对诗浮层气泡
    this.poemLayer = document.createElement('div');
    this.poemLayer.style.position = 'absolute';
    this.poemLayer.style.inset = '0';
    this.poemLayer.style.pointerEvents = 'none';
    this.poemLayer.style.overflow = 'hidden';
    this.poemLayer.style.zIndex = '6';
    this.container.appendChild(this.poemLayer);

    const makePoemBubble = (label: string, accent: string) => {
      const root = document.createElement('div');
      root.style.position = 'absolute';
      root.style.left = '0px';
      root.style.top = '0px';
      root.style.transform = 'translate3d(-9999px, -9999px, 0)';
      root.style.opacity = '0';
      root.style.transition = 'opacity 0.42s ease';
      root.style.pointerEvents = 'none';
      root.style.display = 'flex';
      root.style.flexDirection = 'column';
      root.style.alignItems = 'center';
      root.style.willChange = 'transform, opacity';

      const card = document.createElement('div');
      card.style.background = 'rgba(253, 249, 240, 0.94)';
      card.style.border = `1.5px solid ${accent}`;
      card.style.borderRadius = '10px';
      card.style.padding = '5px 11px';
      card.style.boxShadow = '0 6px 18px rgba(34, 24, 16, 0.16)';
      card.style.backdropFilter = 'blur(4px)';
      card.style.whiteSpace = 'nowrap';
      card.style.display = 'flex';
      card.style.flexDirection = 'column';
      card.style.alignItems = 'center';
      card.style.gap = '2px';

      const speaker = document.createElement('span');
      speaker.textContent = label;
      speaker.style.fontSize = '10px';
      speaker.style.fontWeight = '700';
      speaker.style.letterSpacing = '0.08em';
      speaker.style.color = accent;

      const text = document.createElement('span');
      text.style.fontSize = '13px';
      text.style.fontWeight = '600';
      text.style.letterSpacing = '0.06em';
      text.style.color = '#2b241d';
      text.style.fontFamily = '"Noto Serif SC", "Songti SC", "STSong", Georgia, serif';

      const tail = document.createElement('div');
      tail.style.width = '8px';
      tail.style.height = '8px';
      tail.style.background = 'rgba(253, 249, 240, 0.94)';
      tail.style.borderRight = `1.5px solid ${accent}`;
      tail.style.borderBottom = `1.5px solid ${accent}`;
      tail.style.transform = 'rotate(45deg)';
      tail.style.marginTop = '-5px';

      card.appendChild(speaker);
      card.appendChild(text);
      root.appendChild(card);
      root.appendChild(tail);
      this.poemLayer.appendChild(root);
      return { root, text, visible: false };
    };

    this.poemBubbles = {
      scholar: makePoemBubble('青衣公子', '#2e6f6d'),
      maiden: makePoemBubble('白衣姑娘', '#b85c6b'),
    };

    this.players.forEach((P, pid) => {
      for (let i = 0; i < 4; i++) {
        const mesh = buildPlaneMesh(P, this.anisotropy);
        const data: PlaneData = {
          pid,
          idx: i,
          pos: -1,
          animating: false,
          phase: pid * 1.3 + i * 0.95,
          mesh,
        };
        mesh.userData.plane = data;
        this.planes.push(data);
        this.scene.add(mesh);
      }
    });

    // Schedule critters
    this.scheduleCritter('rabbit', 4000);
    this.scheduleCritter('bird', 4500);
    this.after(7800, () => {
      if (this.disposed) return;
      this.world.spawnCritter('bird', { species: 'seagull', perch: true });
    });
    this.scheduleCritter('fly', 2500);
    this.scheduleCritter('fish', 4500);

    // Pre-warm shaders
    if (!this.isSoftwareGl) {
      this.renderer.compile(this.scene, this.camera);
    }

    // Events
    this.boundResize = () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.fitOrientation();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    };
    this.boundPointerDown = (e: PointerEvent) => {
      this.downXY = [e.clientX, e.clientY];
      ensureAudio();
    };
    this.boundPointerMove = (e: PointerEvent) => {
      const now = performance.now();
      if (now - this.lastHoverRaycast < 40) return;
      this.lastHoverRaycast = now;
      if (this.paused) {
        this.renderer.domElement.style.cursor = 'default';
        this.diceHovered = false;
        return;
      }
      this.ptr.x = (e.clientX / window.innerWidth) * 2 - 1;
      this.ptr.y = -(e.clientY / window.innerHeight) * 2 + 1;
      this.ray.setFromCamera(this.ptr, this.camera);
      let hit = false;
      this.diceHovered = false;
      if (this.phase === 'awaitRoll' && !this.isAI()) {
        this.diceHovered = this.ray.intersectObject(this.diceRig.diceHitMesh).length > 0;
        hit = this.diceHovered;
      } else if (this.phase === 'awaitMove') {
        hit = this.movable.some(
          (c) => this.ray.intersectObject(c.plane.mesh, true).length > 0,
        );
      }
      this.renderer.domElement.style.cursor = hit ? 'pointer' : 'default';
    };
    this.boundPointerUp = (e: PointerEvent) => {
      if (!this.downXY) return;
      const moved = Math.hypot(e.clientX - this.downXY[0], e.clientY - this.downXY[1]);
      this.downXY = null;
      if (moved > 6 || this.paused) return;
      this.ptr.x = (e.clientX / window.innerWidth) * 2 - 1;
      this.ptr.y = -(e.clientY / window.innerHeight) * 2 + 1;
      this.ray.setFromCamera(this.ptr, this.camera);

      if (
        this.phase === 'awaitRoll' &&
        !this.isAI() &&
        this.ray.intersectObject(this.diceRig.diceHitMesh).length
      ) {
        this.doRoll();
        return;
      }
      if (this.phase === 'awaitMove' && !this.isAI()) {
        const hits = this.ray.intersectObjects(
          this.planes.map((p) => p.mesh),
          true,
        );
        if (hits.length) {
          let o: THREE.Object3D | null = hits[0].object;
          while (o && !o.userData.plane) o = o.parent;
          if (o && this.movable.some((c) => c.plane === o!.userData.plane)) {
            this.performMove(o.userData.plane as PlaneData, this.die!);
          }
        }
      }
    };
    this.boundContextLost = (e: Event) => {
      e.preventDefault();
      this.onContextLostCb?.(true);
    };
    this.boundContextRestored = () => {
      this.onContextLostCb?.(false);
    };
    this.boundControlsStart = () => {
      this.camUserInteracting = true;
      this.camGoalActive = false;
      this.camFollowPlane = null;
      this.camFollowObj = null;
    };
    this.boundControlsEnd = () => {
      this.camUserInteracting = false;
    };

    window.addEventListener('resize', this.boundResize);
    this.controls.addEventListener('start', this.boundControlsStart);
    this.controls.addEventListener('end', this.boundControlsEnd);
    this.renderer.domElement.addEventListener('pointerdown', this.boundPointerDown);
    this.renderer.domElement.addEventListener('pointermove', this.boundPointerMove);
    this.renderer.domElement.addEventListener('pointerup', this.boundPointerUp);
    this.renderer.domElement.addEventListener('webglcontextlost', this.boundContextLost);
    this.renderer.domElement.addEventListener(
      'webglcontextrestored',
      this.boundContextRestored,
    );

    this.relayout();
    this.emitSnapshot();
    if (autoStart) {
      this.beginRollPhase(false);
    }
    this.startLoop();
  }

  private getSlot(slotId: number) {
    return SLOTS[slotId];
  }

  private fitOrientation(): void {
    const portrait = window.innerHeight > window.innerWidth;
    this.camera.fov = portrait ? 54 : 47;
    if (this.scene.fog instanceof THREE.Fog) {
      this.scene.fog.near = portrait ? 52 : 48;
      this.scene.fog.far = portrait ? 116 : 108;
    }
    this.camera.updateProjectionMatrix();
  }

  private getAnchorPlayer(): PlayerConfig {
    return this.players.find((p) => p.type === 'human') ?? this.players[0];
  }

  private getViewportRigDefaults(): { radius: number; phi: number; targetPull: number } {
    const w = window.innerWidth || 1280;
    const h = window.innerHeight || 720;
    const aspect = w / h;
    if (h > w) {
      const radius = THREE.MathUtils.clamp(18.6 / Math.max(0.55, aspect * 1.12), 16.4, 21.6);
      return { radius, phi: 0.92, targetPull: 1.0 };
    }
    const radius = aspect < 1.35 ? 16.0 : 14.8;
    return { radius, phi: 0.96, targetPull: 1.3 };
  }

  private getHomeCameraPose(): {
    tx: number;
    ty: number;
    tz: number;
    radius: number;
    phi: number;
    theta: number;
  } {
    const { radius, phi, targetPull } = this.getViewportRigDefaults();
    const anchor = this.getAnchorPlayer();
    let theta = 0.18;
    if (anchor) {
      if (anchor.court[1] < 0) {
        theta = anchor.court[0] < 0 ? 0.18 : -0.18;
      } else {
        theta = anchor.court[0] > 0 ? -Math.PI + 0.18 : Math.PI - 0.18;
      }
    }
    const cx = anchor ? anchor.court[0] * 0.05 : 0;
    const cz = anchor ? anchor.court[1] * 0.05 : 0;
    return {
      tx: cx + Math.sin(theta) * targetPull,
      ty: 0.06,
      tz: cz + Math.cos(theta) * targetPull,
      radius,
      phi,
      theta,
    };
  }

  private setCamGoal(
    tx: number,
    ty: number,
    tz: number,
    radius: number,
    phi: number,
    theta: number,
  ): void {
    if (new URLSearchParams(window.location.search).has('closeup')) return;
    this.camGoalTarget.set(tx, ty, tz);
    this.camGoalSpherical.set(
      THREE.MathUtils.clamp(radius, 5.5, 38),
      THREE.MathUtils.clamp(phi, 0.14, 1.24),
      theta,
    );
    this.camGoalActive = true;
  }

  private scheduleCritter(kind: 'rabbit' | 'bird' | 'fly' | 'fish', delay: number): void {
    this.after(delay, () => {
      if (this.disposed) return;
      this.world.spawnCritter(kind);
      this.scheduleCritter(kind, rnd(5500, 12000));
    });
  }

  private after(ms: number, fn: () => void): void {
    this.pending.push({ at: this.timeMs + ms, fn });
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((r) => this.after(ms, r));
  }

  private tween(dur: number, fn: (k: number) => void): Promise<void> {
    return new Promise((res) => this.anims.push({ t0: this.timeMs, dur, fn, res }));
  }

  private cur(): PlayerConfig {
    return this.players[this.turn];
  }

  private isAI(): boolean {
    return this.cur().type === 'ai';
  }

  private planesOf(pid: number): PlaneData[] {
    return this.planes.filter((p) => p.pid === pid);
  }

  private slotPlayer(j: number): PlayerConfig | undefined {
    return this.players.find((P) => P.slotId === j);
  }

  private setMsg(t: string, color?: string | null, duration = 3200): void {
    this.message = t;
    this.messageColor = color ?? (this.cur() ? this.cur().uiColor : null);
    this.messageKey++;
    this.emitSnapshot();
    if (this.msgTimer !== null) window.clearTimeout(this.msgTimer);
    if (duration > 0) {
      this.msgTimer = window.setTimeout(() => {
        if (this.disposed) return;
        this.message = null;
        this.emitSnapshot();
      }, duration);
    }
  }

  private showTurnSplash(P: PlayerConfig, isBonus = false): void {
    if (P.type !== 'human') return;
    this.splashAvatar = P.species === 'panda' ? '🐼' : '🐻';
    this.splashCharKey = P.key;
    this.splashText = isBonus ? `再掷一次！${P.name}` : `轮到你啦！${P.name}`;
    this.splashColor = P.uiColor;
    this.splashVisible = true;
    this.emitSnapshot();
    cancelAnimationFrame(this.splashRaf);
    if (this.splashTimer !== null) window.clearTimeout(this.splashTimer);
    this.splashRaf = requestAnimationFrame(() => {
      if (this.disposed) return;
      this.splashTimer = window.setTimeout(() => {
        if (this.disposed) return;
        this.splashVisible = false;
        this.emitSnapshot();
      }, 2000);
    });
  }

  private triggerShake(): void {
    this.shakeKey++;
    this.emitSnapshot();
  }

  private emitSnapshot(): void {
    const P = this.cur();
    const showTimer =
      this.deadline !== null &&
      !this.paused &&
      !this.isAI() &&
      (this.phase === 'awaitRoll' || this.phase === 'awaitMove');
    const secondsLeft = showTimer
      ? Math.max(0, Math.ceil((this.deadline! - this.timeMs) / 1000))
      : null;

    this.diceRig.diceHint.visible = this.phase === 'awaitRoll' && !this.isAI();
    this.world.courtFences.forEach((cf, j) => {
      const pl = this.slotPlayer(j);
      const on = !!pl && this.turn === this.players.indexOf(pl) && this.phase !== 'over';
      cf.active = on;
      if (on && pl) {
        const accentMap: Record<string, number> = {
          yier: 0x16c77a,
          caomei: 0xf0485b,
          xiangyu: 0x9368e8,
          bubu: 0xe88d24,
          mocha: 0x6ab82e,
          haiyan: 0x2898e0,
        };
        const accent = accentMap[pl.key] ?? pl.color;
        cf.accentHex = accent;
        _scratchFenceColor.setHex(accent);
        cf.woodMat.color.setHex(0xbdb9b1).lerp(_scratchFenceColor, 0.78);
        cf.woodMat.emissive.setHex(accent);
        cf.trimMat.color.setHex(accent);
        cf.trimMat.emissive.setHex(accent);
        cf.capMat.color.setHex(0xfffdf5).lerp(_scratchFenceColor, 0.55);
        cf.capMat.emissive.setHex(accent);
      } else {
        cf.woodMat.color.setHex(0xbdb9b1);
        cf.woodMat.emissiveIntensity = 0;
        cf.trimMat.color.setHex(0xa29f98);
        cf.trimMat.emissiveIntensity = 0;
        cf.capMat.color.setHex(0xd4d0c8);
        cf.capMat.emissiveIntensity = 0;
      }
    });

    this.onSnapshot({
      phase: this.phase,
      turn: this.turn,
      die: this.die,
      hudDieFace: this.hudDieFace,
      hudDieRolling: this.hudDieRolling,
      hudDiePopKey: this.hudDiePopKey,
      sixChain: this.sixChain,
      movableCount: this.movable.length,
      paused: this.paused,
      camMode: this.camMode,
      secondsLeft,
      message: this.message,
      messageColor: this.messageColor,
      messageKey: this.messageKey,
      splashText: this.splashText,
      splashAvatar: this.splashAvatar,
      splashCharKey: this.splashCharKey,
      splashColor: this.splashColor,
      splashVisible: this.splashVisible,
      shakeKey: this.shakeKey,
      winnerPid: this.winnerPid,
      rankings: this.getRankings(),
      gmDie: this.gmNextDie,
      players: this.players.map((pl, i) => {
        const rankIdx = this.finishedOrder.indexOf(i);
        return {
          charKey: pl.key,
          name: pl.name,
          species: pl.species,
          type: pl.type,
          colorHex: toColorHex(pl.color),
          uiColor: pl.uiColor,
          doneCount: this.planesOf(i).filter((p) => p.pos === HOME_END).length,
          finishRank: rankIdx >= 0 ? rankIdx + 1 : null,
          active: this.turn === i && this.phase !== 'over' && P !== undefined,
        };
      }),
    });
  }

  /* ================= Public User Actions ================= */
  public triggerActionPod(): void {
    if (this.paused || this.disposed) return;
    ensureAudio();
    if (this.phase === 'awaitRoll' && !this.isAI()) {
      this.doRoll();
    } else if (
      this.phase === 'awaitMove' &&
      !this.isAI() &&
      this.movable.length === 1 &&
      this.die !== null
    ) {
      this.performMove(this.movable[0].plane, this.die);
    }
  }

  public pickMovableIndex(idx: number): void {
    if (this.paused || this.disposed) return;
    if (this.phase === 'awaitMove' && !this.isAI() && this.die !== null) {
      const target = this.movable.find((m) => m.plane.idx === idx) ?? this.movable[idx];
      if (target) {
        ensureAudio();
        this.performMove(target.plane, this.die);
      }
    }
  }

  public togglePause(): void {
    if (this.phase === 'over' || this.phase === 'idle') return;
    this.paused = !this.paused;
    this.emitSnapshot();
  }

  public setGmDie(val: number | null): void {
    if (val !== null && (val < 1 || val > 6)) return;
    this.gmNextDie = val;
    this.emitSnapshot();
    if (val !== null && this.phase === 'awaitRoll' && !this.isAI() && !this.paused && !this.disposed) {
      ensureAudio();
      this.doRoll();
    }
  }

  public setPaused(paused: boolean): void {
    if (this.phase === 'over' || this.phase === 'idle') return;
    if (this.paused === paused) return;
    this.paused = paused;
    this.emitSnapshot();
  }

  public setCamMode(mode: CameraMode): void {
    this.camMode = mode;
    if (mode !== 'follow') {
      this.camFollowPlane = null;
      this.camFollowObj = null;
    }
    if (mode === 'free') {
      this.camGoalActive = false;
    } else {
      this.resetView();
    }
    this.emitSnapshot();
  }

  public cycleCamMode(): void {
    const order: CameraMode[] = ['follow', 'top', 'free'];
    const next = order[(order.indexOf(this.camMode) + 1) % order.length];
    this.setCamMode(next);
  }

  public resetView(): void {
    if (this.camMode === 'top') {
      this.focusTopDown();
      return;
    }
    const home = this.getHomeCameraPose();
    this.setCamGoal(home.tx, home.ty, home.tz, home.radius, home.phi, home.theta);
  }

  /* ================= Board Math & Relayout ================= */
  private posToCell(P: PlayerConfig, pos: number): Point2D {
    if (pos === 0) return P.launch;
    if (pos <= 50) return RING[(P.start + 2 + pos) % 52];
    if (pos <= 55) return P.home[pos - 51];
    return P.final;
  }

  private ringIndexOf(plane: PlaneData): number {
    return (this.players[plane.pid].start + 2 + plane.pos) % 52;
  }

  private cellKey(plane: PlaneData): string {
    if (plane.pos === -1) return `b${plane.pid}-${plane.idx}`;
    if (plane.pos === HOME_END) return `f${plane.pid}`;
    if (plane.pos >= 51) return `h${plane.pid}-${plane.pos}`;
    if (plane.pos === 0) return `L${plane.pid}`;
    return `r${this.ringIndexOf(plane)}`;
  }

  private faceTravelDir(plane: PlaneData): number {
    const P = this.players[plane.pid];
    const cur = this.posToCell(P, plane.pos);
    const nxt: Point2D = plane.pos >= HOME_END ? [0, 0] : this.posToCell(P, plane.pos + 1);
    const dx = nxt[0] - cur[0];
    const dz = nxt[1] - cur[1];
    return dx === 0 && dz === 0 ? P.finalYaw : Math.atan2(dx, dz);
  }

  private getStartHuddlePts(total: number): { lx: number; lz: number }[] {
    if (total <= 1) return [{ lx: 0, lz: 0 }];
    if (total === 2) {
      // 距离 0.396（< 2*0.243）：双颊正好压扁贴紧在一起，耳朵与腮红完全在安全区不穿模
      return [
        { lx: -0.198, lz: 0 },
        { lx: 0.198, lz: 0 },
      ];
    }
    if (total === 3) {
      return [
        { lx: -0.198, lz: 0.115 },
        { lx: 0.198, lz: 0.115 },
        { lx: 0, lz: -0.215 },
      ];
    }
    return [
      { lx: -0.198, lz: 0.178 },
      { lx: 0.198, lz: 0.178 },
      { lx: -0.198, lz: -0.178 },
      { lx: 0.198, lz: -0.178 },
    ];
  }

  private getStartHuddlePose(
    idx: number,
    total: number,
    baseYaw: number,
  ): {
    dx: number;
    dz: number;
    leanRoll: number;
    leanPitch: number;
    yawOff: number;
    pts: { lx: number; lz: number }[];
  } {
    const pts = this.getStartHuddlePts(total);
    if (total <= 1) {
      return { dx: 0, dz: 0, leanRoll: 0, leanPitch: 0, yawOff: 0, pts };
    }
    const me = pts[Math.min(idx, pts.length - 1)];
    const leanRoll = me.lx !== 0 ? Math.sign(me.lx) * 0.04 : 0;
    const leanPitch = me.lz !== 0 ? -Math.sign(me.lz) * 0.04 : 0;
    const yawOff = me.lx !== 0 ? -Math.sign(me.lx) * 0.05 : 0;

    const cosY = Math.cos(baseYaw);
    const sinY = Math.sin(baseYaw);
    const dx = me.lx * cosY + me.lz * sinY;
    const dz = -me.lx * sinY + me.lz * cosY;
    return { dx, dz, leanRoll, leanPitch, yawOff, pts };
  }

  private applyCheekSquishDeform(
    plane: PlaneData,
    contactPlanesLocal: { nx: number; nz: number; maxProj: number }[],
    mouthVariant: 'w' | 'open' = 'w',
  ): void {
    const pt = plane.mesh.userData.parts as PlaneParts | undefined;
    if (!pt || !pt.headMesh) return;
    const geo = pt.headMesh.geometry;
    const basePos = geo.userData.basePos as Float32Array | undefined;
    if (!basePos) return;

    const faceParts = pt.headMesh.userData.faceParts as HeadFaceParts | undefined;
    const posAttr = geo.attributes.position as THREE.BufferAttribute;
    const arr = posAttr.array as Float32Array;

    if (contactPlanesLocal.length === 0) {
      if (geo.userData.squished) {
        arr.set(basePos);
        posAttr.needsUpdate = true;
        geo.computeVertexNormals();
        geo.userData.squished = false;
      }
      if (faceParts) {
        faceParts.leftEye.visible = true;
        faceParts.rightEye.visible = true;
        faceParts.leftSquint.visible = false;
        faceParts.rightSquint.visible = false;
        const lbPos = faceParts.leftBlush.userData.basePos as THREE.Vector3 | undefined;
        const lbScale = faceParts.leftBlush.userData.baseScale as THREE.Vector3 | undefined;
        if (lbPos) faceParts.leftBlush.position.copy(lbPos);
        if (lbScale) faceParts.leftBlush.scale.copy(lbScale);
        const rbPos = faceParts.rightBlush.userData.basePos as THREE.Vector3 | undefined;
        const rbScale = faceParts.rightBlush.userData.baseScale as THREE.Vector3 | undefined;
        if (rbPos) faceParts.rightBlush.position.copy(rbPos);
        if (rbScale) faceParts.rightBlush.scale.copy(rbScale);
        faceParts.mouthW.visible = true;
        faceParts.mouthOpen.visible = false;
      }
      return;
    }

    for (let i = 0; i < basePos.length; i += 3) {
      let x = basePos[i];
      let y = basePos[i + 1];
      let z = basePos[i + 2];

      for (const cp of contactPlanesLocal) {
        const proj = x * cp.nx + z * cp.nz;
        if (proj > cp.maxProj) {
          const excess = proj - cp.maxProj;
          // 接触面顶点 100% 压平到碰撞中线平面，实现零缝隙贴紧
          x -= cp.nx * excess;
          z -= cp.nz * excess;
          // 挤压侧脸颊向前/两侧软糯鼓出
          if (y >= 0.20 && y <= 0.45) {
            if (z > 0) z += excess * 0.48;
            y += excess * 0.14;
          }
        } else if (proj > cp.maxProj * 0.68 && y >= 0.20 && y <= 0.42) {
          const near = (proj - cp.maxProj * 0.68) / (cp.maxProj * 0.32);
          if (z > 0) z += near * 0.013;
        }
      }
      arr[i] = x;
      arr[i + 1] = y;
      arr[i + 2] = z;
    }
    posAttr.needsUpdate = true;
    geo.computeVertexNormals();
    geo.userData.squished = true;

    if (faceParts) {
      const squishLeft = contactPlanesLocal.some((cp) => cp.nx < -0.35);
      const squishRight = contactPlanesLocal.some((cp) => cp.nx > 0.35);
      faceParts.leftEye.visible = !squishLeft;
      faceParts.leftSquint.visible = squishLeft;
      faceParts.rightEye.visible = !squishRight;
      faceParts.rightSquint.visible = squishRight;

      const lbPos = faceParts.leftBlush.userData.basePos as THREE.Vector3 | undefined;
      const lbScale = faceParts.leftBlush.userData.baseScale as THREE.Vector3 | undefined;
      if (lbPos && lbScale) {
        if (squishLeft) {
          faceParts.leftBlush.position.set(lbPos.x + 0.014, lbPos.y + 0.008, lbPos.z + 0.024);
          faceParts.leftBlush.scale.set(1.24, 1.18, 0.48);
        } else {
          faceParts.leftBlush.position.copy(lbPos);
          faceParts.leftBlush.scale.copy(lbScale);
        }
      }

      const rbPos = faceParts.rightBlush.userData.basePos as THREE.Vector3 | undefined;
      const rbScale = faceParts.rightBlush.userData.baseScale as THREE.Vector3 | undefined;
      if (rbPos && rbScale) {
        if (squishRight) {
          faceParts.rightBlush.position.set(rbPos.x - 0.014, rbPos.y + 0.008, rbPos.z + 0.024);
          faceParts.rightBlush.scale.set(1.24, 1.18, 0.48);
        } else {
          faceParts.rightBlush.position.copy(rbPos);
          faceParts.rightBlush.scale.copy(rbScale);
        }
      }

      faceParts.mouthW.visible = mouthVariant === 'w';
      faceParts.mouthOpen.visible = mouthVariant === 'open';
    }
  }

  private relayout(): void {
    const groups: Record<string, PlaneData[]> = {};
    this.planes.forEach((p) => {
      if (!p.animating) {
        const k = this.cellKey(p);
        (groups[k] = groups[k] || []).push(p);
      }
    });
    for (const k in groups) {
      const grp = groups[k];
      const total = grp.length;
      grp.forEach((p, i) => {
        let x: number;
        let y = 0.12;
        let z: number;
        let yaw: number;
        let stackIdx = 0;
        let stackTotal = 1;

        if (p.pos === -1) {
          const b = this.players[p.pid].base[p.idx];
          x = b[0];
          z = b[1];
          yaw = Math.atan2(-x, -z + 2);
        } else if (p.pos === 0) {
          // START 区域：真实软体接触面压平，实现图2般紧贴「脸挤脸」且零穿模
          const c = this.posToCell(this.players[p.pid], p.pos);
          const baseYaw = this.faceTravelDir(p);
          const huddle = this.getStartHuddlePose(i, total, baseYaw);
          x = c[0] + huddle.dx;
          z = c[1] + huddle.dz;
          yaw = baseYaw + huddle.yawOff;
          p.mesh.userData.huddleRoll = huddle.leanRoll;
          p.mesh.userData.huddlePitch = huddle.leanPitch;
          p.mesh.userData.huddleTotal = total;
          p.mesh.userData.huddleIdx = i;

          if (total >= 2) {
            const me = huddle.pts[Math.min(i, huddle.pts.length - 1)];
            const cosY = Math.cos(baseYaw);
            const sinY = Math.sin(baseYaw);
            const contacts: { nx: number; nz: number; maxProj: number }[] = [];
            for (let j = 0; j < huddle.pts.length; j++) {
              if (j === i) continue;
              const nb = huddle.pts[j];
              // 世界平面从我指向邻居的向量
              const dlx = nb.lx - me.lx;
              const dlz = nb.lz - me.lz;
              const wdx = dlx * cosY + dlz * sinY;
              const wdz = -dlx * sinY + dlz * cosY;
              const dist = Math.hypot(wdx, wdz) || 1;
              // 转回当前角色自身 yaw 局部坐标
              const cYaw = Math.cos(yaw);
              const sYaw = Math.sin(yaw);
              const lnx = (wdx * cYaw - wdz * sYaw) / dist;
              const lnz = (wdx * sYaw + wdz * cYaw) / dist;
              // 接触中线距（换算到 0.92 缩放前的模型局部坐标）
              const maxProj = (dist * 0.5) / 0.92;
              contacts.push({ nx: lnx, nz: lnz, maxProj });
            }
            this.applyCheekSquishDeform(p, contacts, i % 2 === 0 ? 'w' : 'open');
          } else {
            this.applyCheekSquishDeform(p, []);
          }
        } else {
          // 棋盘上重叠时采用垂直「叠叠乐」堆叠
          const c = this.posToCell(this.players[p.pid], p.pos);
          x = c[0];
          z = c[1];
          y = 0.12 + i * STACK_STEP_Y;
          yaw = p.pos === HOME_END ? this.players[p.pid].finalYaw : this.faceTravelDir(p);
          stackIdx = i;
          stackTotal = total;
        }
        p.mesh.position.set(x, y, z);
        p.mesh.rotation.set(0, yaw, 0);
        p.mesh.userData.stackBaseX = x;
        p.mesh.userData.stackBaseY = y;
        p.mesh.userData.stackBaseZ = z;
        p.mesh.userData.stackBaseYaw = yaw;
        p.mesh.userData.stackIdx = stackIdx;
        p.mesh.userData.stackTotal = stackTotal;
        if (p.pos !== 0) {
          this.applyCheekSquishDeform(p, []);
          p.mesh.userData.huddleTotal = 1;
          p.mesh.userData.huddleRoll = 0;
          p.mesh.userData.huddlePitch = 0;
        }
      });
    }
  }

  /* ================= Highlighting ================= */
  private getBadgeTexture(label: string): THREE.CanvasTexture {
    let tex = this.badgeTexCache.get(label);
    if (!tex) {
      tex = createNumberBadgeTexture(label, this.anisotropy);
      this.badgeTexCache.set(label, tex);
    }
    return tex;
  }

  private highlight(list: { plane: PlaneData }[]): void {
    this.clearHL();
    const seenRingCells = new Set<string>();
    const hintGroups = new Map<string, PlaneData[]>();

    list.forEach((c) => {
      const cellKey = this.cellKey(c.plane);
      const isBottomInStack = ((c.plane.mesh.userData.stackIdx as number) || 0) === 0;
      if (isBottomInStack || !seenRingCells.has(cellKey)) {
        seenRingCells.add(cellKey);
        const ring = new THREE.Mesh(
          new THREE.TorusGeometry(0.5, 0.06, 8, 28),
          new THREE.MeshBasicMaterial({ color: 0x3aa66b }),
        );
        ring.rotation.x = -Math.PI / 2;
        c.plane.mesh.add(ring);
        ring.position.set(0, -0.02, 0);
        this.hlRings.push(ring);
      }
      const groupKey = c.plane.pos <= 0 ? `single_${c.plane.idx}` : cellKey;
      const arr = hintGroups.get(groupKey) ?? [];
      arr.push(c.plane);
      hintGroups.set(groupKey, arr);
    });

    let hintIdx = 0;
    hintGroups.forEach((planes) => {
      const hint = this.pickHints[hintIdx++];
      if (!hint) return;
      const sorted = [...planes].sort((a, b) => a.idx - b.idx);
      const label = sorted.map((p) => p.idx + 1).join('·');
      const topPlane = planes.reduce((best, cur) =>
        cur.mesh.position.y > best.mesh.position.y ? cur : best,
      );
      const hintY = Math.max(1.55, topPlane.mesh.position.y + 1.15);
      const badge = hint.children[1] as THREE.Sprite | undefined;
      if (badge) {
        const tex = this.getBadgeTexture(label);
        const mat = badge.material as THREE.SpriteMaterial;
        if (mat.map !== tex) {
          mat.map = tex;
          mat.needsUpdate = true;
        }
        const aspect = (tex.userData.aspect as number) || 1;
        badge.scale.set(0.52 * aspect, 0.52, 1);
      }
      hint.visible = true;
      hint.userData.baseY = hintY;
      hint.position.set(topPlane.mesh.position.x, hintY, topPlane.mesh.position.z);
    });
  }

  private clearHL(): void {
    this.badgeTexCache.forEach((tex) => tex.dispose());
    this.badgeTexCache.clear();
    this.hlRings.forEach((r) => {
      if (r.parent) r.parent.remove(r);
      r.geometry.dispose();
      (r.material as THREE.Material).dispose();
    });
    this.hlRings.length = 0;
    this.pickHints.forEach((h) => (h.visible = false));
  }

  /* ================= Dice & Turn Flow ================= */
  private movablePlanes(pid: number, die: number): { plane: PlaneData }[] {
    return this.planesOf(pid)
      .filter((p) => {
        if (p.pos === HOME_END) return false;
        if (p.pos === -1) return die === 5 || die === 6;
        return true;
      })
      .map((plane) => ({ plane }));
  }

  private async animDice(die: number): Promise<void> {
    sndRoll();
    this.hudDieRolling = true;
    this.emitSnapshot();
    const sx = this.diceRig.dice.rotation.x;
    const sy = this.diceRig.dice.rotation.y;
    const sz = this.diceRig.dice.rotation.z;
    const [tx, ty, tz] = ORIENT[die];
    const dirX = Math.random() < 0.5 ? 1 : -1;
    const dirY = Math.random() < 0.5 ? 1 : -1;
    const dirZ = Math.random() < 0.5 ? 1 : -1;
    const turnsX = (5 + Math.floor(Math.random() * 2)) * Math.PI * 2 * dirX;
    const turnsY = (4 + Math.floor(Math.random() * 2)) * Math.PI * 2 * dirY;
    const turnsZ = (4 + Math.floor(Math.random() * 2)) * Math.PI * 2 * dirZ;
    let lastHudTick = 0;
    await this.tween(1650, (t) => {
      const ease = 1 - Math.pow(1 - t, 3);
      this.diceRig.dice.rotation.x = THREE.MathUtils.lerp(sx, tx + turnsX, ease);
      this.diceRig.dice.rotation.y = THREE.MathUtils.lerp(sy, ty + turnsY, ease);
      this.diceRig.dice.rotation.z = THREE.MathUtils.lerp(sz, tz + turnsZ, ease);
      this.diceRig.dice.position.y = DICE_REST_Y + Math.sin(t * Math.PI) * 1.45;
      if (t < 0.9 && t - lastHudTick > 0.1) {
        lastHudTick = t;
        this.hudDieFace = 1 + Math.floor(Math.random() * 6);
        this.emitSnapshot();
      }
    });
    if (this.disposed) return;
    this.hudDieRolling = false;
    this.diceRig.dice.rotation.set(...ORIENT[die]);
    this.diceRig.dice.position.y = DICE_REST_Y;
    this.hudDieFace = die;
    this.hudDiePopKey++;
    this.emitSnapshot();
    await this.sleep(150);
  }

  private async doRoll(): Promise<void> {
    if (this.phase !== 'awaitRoll' && this.phase !== 'aiWait') return;
    this.phase = 'rolling';
    this.deadline = null;
    this.message = null;
    if (this.msgTimer !== null) window.clearTimeout(this.msgTimer);
    this.splashVisible = false;
    cancelAnimationFrame(this.splashRaf);
    if (this.splashTimer !== null) window.clearTimeout(this.splashTimer);
    this.clearHL();
    this.emitSnapshot();

    let die = 1 + Math.floor(Math.random() * 6);
    if (this.gmNextDie !== null && this.gmNextDie >= 1 && this.gmNextDie <= 6) {
      die = this.gmNextDie;
      this.gmNextDie = null;
    }
    this.die = die;
    await this.animDice(die);
    if (this.disposed) return;

    if (die === 6) {
      this.sixChain++;
      if (this.sixChain >= 3) {
        this.setMsg('⚠️ 连续三个 6！本次可移动，但不再掷');
      }
    } else {
      this.sixChain = 0;
    }
    this.emitSnapshot();
    await this.onRolled(die);
  }

  private async onRolled(die: number): Promise<void> {
    if (this.disposed) return;
    const cands = this.movablePlanes(this.turn, die);
    if (cands.length === 0) {
      this.setMsg(`🎲 掷出 ${die} 点，暂无可移动飞机`);
      await this.sleep(1000);
      if (!this.disposed) this.endTurn(die === 6);
      return;
    }
    if (this.isAI()) {
      this.emitSnapshot();
      await this.sleep(1350);
      if (!this.disposed) await this.performMove(this.aiPick(cands).plane, die);
    } else {
      this.phase = 'awaitMove';
      this.movable = cands;
      this.deadline = this.timeMs + TIMEOUT;
      this.highlight(cands);
      this.emitSnapshot();
    }
  }

  /* ================= Piece Motion & FX ================= */
  private async hopTo(
    plane: PlaneData,
    x: number,
    z: number,
    yaw: number,
    arc = 0.5,
    dur = 240,
    stepSign = 1,
    baseY = 0.12,
    flipMode: 'none' | 'frontFlip' | 'spinLeft' | 'spinRight' = 'none',
  ): Promise<void> {
    this.applyCheekSquishDeform(plane, []);
    plane.animating = true;
    const m = plane.mesh;
    const pt = m.userData.parts as PlaneParts;
    const sx = m.position.x;
    const sz = m.position.z;
    const sy = m.position.y;
    const syaw = m.rotation.y;

    await this.tween(dur, (t) => {
      m.position.x = sx + (x - sx) * t;
      m.position.z = sz + (z - sz) * t;
      m.position.y = THREE.MathUtils.lerp(sy, baseY, t) + Math.sin(t * Math.PI) * arc;
      const spinOffset =
        flipMode === 'spinLeft'
          ? t * Math.PI * 2
          : flipMode === 'spinRight'
            ? -t * Math.PI * 2
            : 0;
      m.rotation.y = lerpAngle(syaw, yaw, t) + spinOffset;
      const air = Math.sin(t * Math.PI);
      const sq = t < 0.15 ? (1 - t / 0.15) * 0.12 : t > 0.85 ? ((t - 0.85) / 0.15) * 0.12 : 0;
      const syScale = 1 + air * 0.09 - sq;
      const sxScale = 1 / Math.sqrt(syScale);
      pt.animRoot.scale.set(sxScale, syScale, sxScale);
      pt.animRoot.rotation.x = flipMode === 'frontFlip' ? t * Math.PI * 2 : air * 0.16;
      pt.leftArm.rotation.z = 0.35 + air * 0.9;
      pt.rightArm.rotation.z = -0.35 - air * 0.9;
      pt.leftFoot.rotation.x = stepSign * air * 0.55;
      pt.rightFoot.rotation.x = -stepSign * air * 0.55;
      pt.headPivot.rotation.x = air * 0.12;
    });
    m.position.set(x, baseY, z);
    m.rotation.set(0, yaw, 0);
    m.userData.stackBaseX = x;
    m.userData.stackBaseY = baseY;
    m.userData.stackBaseZ = z;
    m.userData.stackBaseYaw = yaw;
    m.userData.stackTotal = 1;
    pt.animRoot.scale.set(1, 1, 1);
    pt.animRoot.rotation.set(0, 0, 0);
    pt.leftArm.rotation.set(0, 0, 0);
    pt.rightArm.rotation.set(0, 0, 0);
    pt.leftFoot.rotation.set(0, 0, 0);
    pt.rightFoot.rotation.set(0, 0, 0);
    pt.headPivot.rotation.set(0, 0, 0);
    pt.headPivot.scale.set(1, 1, 1);
    plane.animating = false;
  }

  private async celebrateGoal(plane: PlaneData): Promise<void> {
    plane.animating = true;
    const m = plane.mesh;
    const pt = m.userData.parts as PlaneParts;
    const baseYaw = this.players[plane.pid].finalYaw;
    this.spawnImpact(m.position.x, m.position.z);
    await this.tween(1300, (t) => {
      const hop = Math.abs(Math.sin(t * Math.PI * 2));
      m.position.y = 0.12 + hop * 0.55;
      m.rotation.y = baseYaw + t * Math.PI * 2;
      pt.leftArm.rotation.z = 1.5 + Math.sin(t * Math.PI * 6) * 0.4;
      pt.rightArm.rotation.z = -1.5 - Math.sin(t * Math.PI * 6) * 0.4;
      pt.headPivot.rotation.z = Math.sin(t * Math.PI * 4) * 0.22;
      pt.animRoot.scale.set(1, 1 + hop * 0.08, 1);
    });
    m.position.y = 0.12;
    m.rotation.y = baseYaw;
    pt.animRoot.scale.set(1, 1, 1);
    pt.headPivot.rotation.set(0, 0, 0);
    plane.animating = false;
  }

  private async sendHome(plane: PlaneData, x: number, z: number): Promise<void> {
    plane.animating = true;
    const m = plane.mesh;
    const pt = m.userData.parts as PlaneParts;
    const sx = m.position.x;
    const sy = m.position.y;
    const sz = m.position.z;
    const syaw = m.rotation.y;

    await this.tween(1250, (k) => {
      m.position.x = sx + (x - sx) * k;
      m.position.z = sz + (z - sz) * k;
      m.position.y = sy + Math.sin(k * Math.PI) * 3.2;
      m.rotation.y = syaw + k * Math.PI * 3;
      m.rotation.z = Math.sin(k * Math.PI * 4) * 0.55;
      pt.leftArm.rotation.z = 1.3 + Math.sin(k * Math.PI * 10) * 0.6;
      pt.rightArm.rotation.z = -1.3 - Math.sin(k * Math.PI * 10) * 0.6;
      pt.leftFoot.rotation.x = Math.sin(k * Math.PI * 12) * 0.7;
      pt.rightFoot.rotation.x = -Math.sin(k * Math.PI * 12) * 0.7;
    });
    const homeYaw = Math.atan2(-x, -z + 2);
    m.position.set(x, 0.12, z);
    m.rotation.set(0, homeYaw, 0);
    m.userData.stackBaseX = x;
    m.userData.stackBaseY = 0.12;
    m.userData.stackBaseZ = z;
    m.userData.stackBaseYaw = homeYaw;
    m.userData.stackTotal = 1;
    m.userData.stackIdx = 0;
    m.userData.dizzyUntil = this.timeMs + 3800;
    pt.leftArm.rotation.set(0, 0, 0);
    pt.rightArm.rotation.set(0, 0, 0);
    pt.leftFoot.rotation.set(0, 0, 0);
    pt.rightFoot.rotation.set(0, 0, 0);
    plane.animating = false;
  }

  private spawnImpact(x: number, z: number): void {
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.25, 0.5, 32),
      new THREE.MeshBasicMaterial({
        color: 0xffd54a,
        transparent: true,
        opacity: 0.95,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(x, 0.16, z);
    this.scene.add(ring);

    const sparks: { m: THREE.Mesh; a: number; sp: number }[] = [];
    for (let i = 0; i < 10; i++) {
      const m = new THREE.MeshBasicMaterial({
        color: 0xffe08a,
        transparent: true,
        opacity: 1,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const s = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), m);
      s.position.set(x, 0.2, z);
      this.scene.add(s);
      sparks.push({ m: s, a: (i / 10) * Math.PI * 2, sp: 0.6 + Math.random() * 0.7 });
    }
    this.tween(620, (k) => {
      const e = 1 - Math.pow(1 - k, 2);
      ring.scale.setScalar(1 + e * 2.4);
      ring.material.opacity = 0.95 * (1 - k);
      for (const sp of sparks) {
        sp.m.position.set(
          x + Math.cos(sp.a) * sp.sp * e * 1.4,
          0.2 + Math.sin(e * Math.PI) * 0.7,
          z + Math.sin(sp.a) * sp.sp * e * 1.4,
        );
        (sp.m.material as THREE.MeshBasicMaterial).opacity = 1 - k;
        sp.m.scale.setScalar(1 - k * 0.6);
      }
    }).then(() => {
      this.scene.remove(ring);
      ring.geometry.dispose();
      ring.material.dispose();
      sparks.forEach((sp) => {
        this.scene.remove(sp.m);
        sp.m.geometry.dispose();
        (sp.m.material as THREE.Material).dispose();
      });
    });
  }

  private async flyAsPlane(
    stack: PlaneData[],
    cFrom: Point2D,
    cTo: Point2D,
    _color: number,
    dur: number,
  ): Promise<void> {
    if (!stack.length) return;
    const pid = stack[0].pid;
    const yaw = Math.atan2(cTo[0] - cFrom[0], cTo[1] - cFrom[1]);
    const sx = cFrom[0];
    const sz = cFrom[1];
    const tx = cTo[0];
    const tz = cTo[1];
    const dist = Math.hypot(tx - sx, tz - sz) || 1;
    const dirX = (tx - sx) / dist;
    const dirZ = (tz - sz) / dist;

    // 隐藏原格面上的静态飞机（避免同时出现两架飞机）
    const staticMark = this.world.planeMarks[pid];
    if (staticMark) {
      staticMark.visible = false;
    }

    // 飞机停在起飞格前方 0.92 格处，与格面上的叠叠乐小熊清晰错开
    const bx = sx + dirX * 0.92;
    const bz = sz + dirZ * 0.92;

    const leadP = this.players[pid];
    const fp = makePilotPlaneModel(leadP, this.anisotropy);
    fp.position.set(bx, 0.42, bz);
    fp.rotation.y = yaw;
    const pilotHead = fp.userData.pilotHead as THREE.Group | undefined;
    if (pilotHead) {
      pilotHead.scale.setScalar(0.001);
    }
    this.scene.add(fp);

    const prevFollowObj = this.camFollowObj;
    if (this.camFollowPlane && stack.includes(this.camFollowPlane)) {
      this.camFollowObj = fp;
    }

    // 1) 一只一只依次跳进前方座舱
    const boardOrder = [...stack].reverse();
    for (let bIdx = 0; bIdx < boardOrder.length; bIdx++) {
      if (this.disposed) {
        this.scene.remove(fp);
        if (staticMark) staticMark.visible = true;
        return;
      }
      const p = boardOrder[bIdx];
      p.animating = true;
      const m = p.mesh;
      const pt = m.userData.parts as PlaneParts;
      const startX = m.position.x;
      const startY = m.position.y;
      const startZ = m.position.z;
      const startYaw = m.rotation.y;

      sndHop();
      await this.tween(310, (k) => {
        m.position.x = THREE.MathUtils.lerp(startX, bx, k);
        m.position.z = THREE.MathUtils.lerp(startZ, bz, k);
        m.position.y = THREE.MathUtils.lerp(startY, 0.56, k) + Math.sin(k * Math.PI) * 0.65;
        m.rotation.set(0, lerpAngle(startYaw, yaw, k), 0);
        const shrink = k > 0.7 ? 1 - ((k - 0.7) / 0.3) * 0.5 : 1;
        m.scale.setScalar(0.92 * shrink);
        pt.leftArm.rotation.z = 1.05;
        pt.rightArm.rotation.z = -1.05;
      });
      m.visible = false;
      m.scale.setScalar(0.92);
      pt.leftArm.rotation.set(0, 0, 0);
      pt.rightArm.rotation.set(0, 0, 0);

      await this.tween(130, (k) => {
        if (bIdx === 0 && pilotHead) {
          const pop = Math.sin(k * Math.PI * 0.5) * (1 + Math.sin(k * Math.PI) * 0.16);
          pilotHead.scale.setScalar(Math.max(0.001, pop));
        }
        fp.position.y = 0.42 - Math.sin(k * Math.PI) * 0.055;
        if (fp.userData.propeller) {
          (fp.userData.propeller as THREE.Group).rotation.z += 0.35;
        }
      });
      if (bIdx === 0 && pilotHead) {
        pilotHead.scale.setScalar(1);
      }
      fp.position.y = 0.42;
      if (bIdx < boardOrder.length - 1) {
        await this.sleep(60);
      }
    }

    // 2) 全员登机后，唯一 1 架飞机 + 1 个大头熊飞向对面落点
    await this.tween(dur, (k) => {
      fp.position.x = THREE.MathUtils.lerp(bx, tx, k);
      fp.position.z = THREE.MathUtils.lerp(bz, tz, k);
      fp.position.y = 0.42 + Math.sin(k * Math.PI) * 2.15;
      fp.rotation.y = yaw;
      fp.rotation.x = -Math.cos(k * Math.PI) * 0.26;
      fp.rotation.z = Math.sin(k * Math.PI * 4) * 0.08;
      if (fp.userData.propeller) {
        (fp.userData.propeller as THREE.Group).rotation.z = k * Math.PI * 34;
      }
      if (pilotHead) {
        pilotHead.rotation.z = Math.sin(k * Math.PI * 6) * 0.09;
      }
    });
    if (this.disposed) {
      this.scene.remove(fp);
      if (staticMark) staticMark.visible = true;
      return;
    }

    // 3) 熊落地恢复成叠叠乐，相机切回角色，随后飞机无人驾驶快速盘旋飞回原格
    for (let i = 0; i < stack.length; i++) {
      const p = stack[i];
      const landY = 0.12 + i * STACK_STEP_Y;
      p.mesh.visible = true;
      p.mesh.position.set(tx, landY + 0.35, tz);
      p.mesh.rotation.set(0, yaw, 0);
      p.mesh.userData.stackBaseX = tx;
      p.mesh.userData.stackBaseY = landY;
      p.mesh.userData.stackBaseZ = tz;
      p.mesh.userData.stackBaseYaw = yaw;
      p.mesh.userData.stackTotal = stack.length;
      p.mesh.userData.stackIdx = i;
    }

    if (this.camFollowPlane) {
      this.camFollowObj = this.camFollowPlane.mesh;
    } else {
      this.camFollowObj = prevFollowObj;
    }

    // 收起座舱熊头变为「无人驾驶」状态，启动快速盘旋返航
    if (pilotHead) {
      pilotHead.visible = false;
    }
    const perpX = -dirZ;
    const perpZ = dirX;
    const returnCurve = new THREE.CubicBezierCurve3(
      new THREE.Vector3(tx, 0.42, tz),
      new THREE.Vector3(tx + dirX * 2.8 + perpX * 3.4, 2.35, tz + dirZ * 2.8 + perpZ * 3.4),
      new THREE.Vector3(sx - dirX * 3.2 + perpX * 2.5, 1.85, sz - dirZ * 3.2 + perpZ * 2.5),
      new THREE.Vector3(sx, 0.305, sz),
    );
    const ptPos = new THREE.Vector3();
    const ptTan = new THREE.Vector3();

    const returnAnim = this.tween(920, (k) => {
      // 前快后稳的返航节奏
      const u = 1 - Math.pow(1 - k, 1.45);
      returnCurve.getPoint(u, ptPos);
      returnCurve.getTangent(u, ptTan);
      fp.position.copy(ptPos);

      const moveYaw = Math.atan2(ptTan.x, ptTan.z);
      fp.rotation.order = 'YXZ';
      fp.rotation.y = moveYaw;
      fp.rotation.x = -ptTan.y * 0.45;
      // 盘旋转弯时顺势侧倾机翼，落地前摆平
      fp.rotation.z = -Math.sin(u * Math.PI) * 0.48;

      // 从飞行尺寸平滑缩回棋盘静态飞机比例，落地严丝合缝
      const sc = THREE.MathUtils.lerp(1.0, 0.86 / 1.48, u);
      fp.scale.setScalar(sc);
      if (fp.userData.propeller) {
        (fp.userData.propeller as THREE.Group).rotation.z = k * Math.PI * 36;
      }
    }).then(() => {
      this.scene.remove(fp);
      if (staticMark && !this.disposed) {
        staticMark.visible = true;
      }
    });

    await this.tween(260, (k) => {
      const ease = 1 - Math.pow(1 - k, 2);
      for (let i = 0; i < stack.length; i++) {
        const p = stack[i];
        const landY = 0.12 + i * STACK_STEP_Y;
        p.mesh.position.y = THREE.MathUtils.lerp(landY + 0.35, landY, ease);
        const sq = k > 0.7 ? Math.sin(((k - 0.7) / 0.3) * Math.PI) * 0.1 : 0;
        const pt = p.mesh.userData.parts as PlaneParts;
        pt.animRoot.scale.set(1 + sq * 0.8, 1 - sq, 1 + sq * 0.8);
      }
    });

    for (let i = 0; i < stack.length; i++) {
      const p = stack[i];
      const landY = 0.12 + i * STACK_STEP_Y;
      const pt = p.mesh.userData.parts as PlaneParts;
      p.mesh.position.set(tx, landY, tz);
      pt.animRoot.scale.set(1, 1, 1);
      p.animating = false;
    }

    // 返航飞机在后台继续快速盘旋回位，不卡住玩家后续跳 4 格动作
    void returnAnim;
  }

  private async captureAt(plane: PlaneData): Promise<number> {
    if (plane.pos < 1 || plane.pos > 50) return 0;
    const r = this.ringIndexOf(plane);
    const victims = this.planes.filter(
      (q) =>
        q.pid !== plane.pid && q.pos >= 1 && q.pos <= 50 && this.ringIndexOf(q) === r,
    );
    if (!victims.length) return 0;
    sndCap();
    this.setMsg(`💥 撞掉 ${victims.length} 架敌机，送回基地！`);
    const c = this.posToCell(this.players[plane.pid], plane.pos);
    this.spawnImpact(c[0], c[1]);
    this.triggerShake();
    await Promise.all(
      victims.map((v) => {
        v.pos = -1;
        const b = this.players[v.pid].base[v.idx];
        return this.sendHome(v, b[0], b[1]);
      }),
    );
    return victims.length;
  }

  private async captureFlyCross(flyingPid: number): Promise<void> {
    const oppPlayer = this.slotPlayer((this.players[flyingPid].slotId + 2) % 4);
    if (!oppPlayer) return;
    const oppPid = this.players.indexOf(oppPlayer);
    const victims = this.planes.filter((q) => q.pid === oppPid && q.pos === 54);
    if (!victims.length) return;
    sndCap();
    this.setMsg(`💥 飞越航线，击落 ${oppPlayer.name} 航道敌机！`);
    const c = this.posToCell(oppPlayer, 54);
    this.spawnImpact(c[0], c[1]);
    this.triggerShake();
    await Promise.all(
      victims.map((v) => {
        v.pos = -1;
        const b = this.players[v.pid].base[v.idx];
        return this.sendHome(v, b[0], b[1]);
      }),
    );
  }

  private async performMove(plane: PlaneData, die: number): Promise<void> {
    this.phase = 'moving';
    this.deadline = null;
    this.clearHL();
    this.camFollowPlane = plane;
    this.camFollowObj = plane.mesh;
    this.emitSnapshot();

    const P = this.players[plane.pid];
    const stack =
      plane.pos === -1 || plane.pos === 0
        ? [plane]
        : this.planesOf(plane.pid).filter(
            (p) => p.pos === plane.pos && p.pos !== HOME_END,
          );
    const sync = (fn: (p: PlaneData, idx: number) => Promise<void>) =>
      Promise.all(stack.map((p, i) => fn(p, i)));
    const setPos = (v: number) => stack.forEach((p) => (p.pos = v));
    const countExistingAt = (pos: number) =>
      pos <= 0
        ? 0
        : this.planes.filter(
            (q) => !stack.includes(q) && q.pid === plane.pid && q.pos === pos,
          ).length;
    const hopAll = (
      c: Point2D,
      yaw: number,
      arc: number,
      dur: number,
      sign: number,
      targetPos?: number,
      flipMode: 'none' | 'frontFlip' | 'spinLeft' | 'spinRight' = 'none',
    ) => {
      const baseStackCount = targetPos !== undefined ? countExistingAt(targetPos) : 0;
      return sync((p, idx) =>
        this.hopTo(
          p,
          c[0],
          c[1],
          yaw,
          arc,
          dur,
          sign,
          0.12 + (baseStackCount + idx) * STACK_STEP_Y,
          flipMode,
        ),
      );
    };

    if (plane.pos === -1) {
      setPos(0);
      const c = this.posToCell(P, 0);
      const existingOnStart = this.planesOf(plane.pid).filter((p) => p !== plane && p.pos === 0);
      const alreadyOnStart = existingOnStart.length;
      const nextTotal = Math.min(alreadyOnStart + 1, 4);
      const baseYaw = this.faceTravelDir(plane);
      const huddle = this.getStartHuddlePose(alreadyOnStart, nextTotal, baseYaw);
      this.setMsg('✈️ 登上 START 起点台！');
      beep(660, 0.12, 'triangle', 0.14);

      const shiftTasks = existingOnStart.map((ep, k) => {
        const targetHuddle = this.getStartHuddlePose(k, nextTotal, baseYaw);
        const tx = c[0] + targetHuddle.dx;
        const tz = c[1] + targetHuddle.dz;
        const tyaw = baseYaw + targetHuddle.yawOff;
        const sx = ep.mesh.position.x;
        const sz = ep.mesh.position.z;
        const syaw = ep.mesh.rotation.y;
        ep.animating = true;
        return this.tween(540, (t) => {
          const ease = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
          const nx = sx + (tx - sx) * ease;
          const nz = sz + (tz - sz) * ease;
          const nyaw = lerpAngle(syaw, tyaw, ease);
          ep.mesh.position.set(nx, 0.12, nz);
          ep.mesh.rotation.set(0, nyaw, 0);
          ep.mesh.userData.stackBaseX = nx;
          ep.mesh.userData.stackBaseZ = nz;
          ep.mesh.userData.stackBaseYaw = nyaw;
        }).then(() => {
          ep.animating = false;
        });
      });

      await Promise.all([
        this.hopTo(
          plane,
          c[0] + huddle.dx,
          c[1] + huddle.dz,
          baseYaw + huddle.yawOff,
          0.95,
          820,
          1,
        ),
        ...shiftTasks,
      ]);
      // 落地零延迟贴脸
      this.relayout();
      await this.sleep(320);
    } else {
      const leftStart = plane.pos === 0;
      let curStep = plane.pos;
      let dir = 1;
      for (let i = 0; i < die; i++) {
        if (curStep === HOME_END) dir = -1;
        curStep += dir;
        setPos(curStep);
        if (leftStart && i === 0) {
          // 离开 START 台时，剩余同伴立刻恢复圆脸或重新布局
          this.relayout();
        }
        const c = this.posToCell(P, curStep);
        const yaw = curStep === HOME_END ? P.finalYaw : this.faceTravelDir(plane);
        sndHop();
        await hopAll(c, yaw, 0.5, 460, i % 2 === 0 ? 1 : -1, curStep);
        if (this.disposed) return;
        if (i < die - 1) {
          await this.sleep(80);
          if (this.disposed) return;
        }
      }
      if (dir === -1) {
        this.setMsg(`↩️ 点数超出，回弹至航道第 ${curStep - 50} 格`);
      }
      await this.captureAt(plane);

      if (plane.pos >= 1 && plane.pos <= 49 && plane.pos % 4 === 2) {
        await this.sleep(320);
        if (this.disposed) return;
        if (plane.pos === FLIGHT_FROM) {
          this.setMsg('🌀 踏上飞行航线，直飞对面！');
          sndCap();
          const cFrom = this.posToCell(P, plane.pos);
          setPos(plane.pos + FLIGHT_STEP);
          const cTo = this.posToCell(P, plane.pos);
          await Promise.all([
            this.flyAsPlane(stack, cFrom, cTo, lineOf(P), 2200),
            new Promise<void>((res) =>
              this.after(980, () => {
                this.captureFlyCross(plane.pid).then(res);
              }),
            ),
          ]);
          await this.captureAt(plane);
          await this.sleep(320);
          if (this.disposed) return;
          this.setMsg('⚡ 同色顺风再跳 4 格！');
          beep(540, 0.12, 'triangle', 0.14);
          setPos(plane.pos + 4);
          await hopAll(
            this.posToCell(P, plane.pos),
            this.faceTravelDir(plane),
            1.15,
            820,
            1,
            plane.pos,
            stack.length >= 2 ? (Math.random() < 0.5 ? 'spinLeft' : 'spinRight') : 'frontFlip',
          );
          await this.captureAt(plane);
        } else {
          this.setMsg('⚡ 落在己方颜色格，跳跃前进 4 格！');
          beep(540, 0.12, 'triangle', 0.14);
          setPos(plane.pos + 4);
          await hopAll(
            this.posToCell(P, plane.pos),
            this.faceTravelDir(plane),
            1.15,
            820,
            1,
            plane.pos,
            stack.length >= 2 ? (Math.random() < 0.5 ? 'spinLeft' : 'spinRight') : 'frontFlip',
          );
          await this.captureAt(plane);
          if (plane.pos === FLIGHT_FROM) {
            await this.sleep(320);
            if (this.disposed) return;
            this.setMsg('🌀 连跳触发飞行航线，直飞对面！');
            sndCap();
            const cFrom = this.posToCell(P, plane.pos);
            setPos(plane.pos + FLIGHT_STEP);
            const cTo = this.posToCell(P, plane.pos);
            await Promise.all([
              this.flyAsPlane(stack, cFrom, cTo, lineOf(P), 2200),
              new Promise<void>((res) =>
                this.after(980, () => {
                  this.captureFlyCross(plane.pid).then(res);
                }),
              ),
            ]);
            await this.captureAt(plane);
          }
        }
      }
    }

    if (this.disposed) return;
    if (plane.pos === HOME_END) {
      beep(784, 0.2, 'triangle', 0.16);
      this.setMsg('🏁 一架飞机到达终点！');
      await Promise.all(stack.map((p) => this.celebrateGoal(p)));
    }
    this.relayout();
    this.emitSnapshot();
    if (this.planesOf(plane.pid).every((p) => p.pos === HOME_END)) {
      if (!this.finishedOrder.includes(plane.pid)) {
        this.finishedOrder.push(plane.pid);
      }
      const rank = this.finishedOrder.length;
      const finishLimit = Math.min(3, Math.max(1, this.players.length - 1));
      if (rank >= finishLimit) {
        this.camFollowPlane = null;
        this.camFollowObj = null;
        this.showWin(this.finishedOrder[0]);
        return;
      }
      const medal = rank === 1 ? '🥇' : '🥈';
      this.setMsg(`${medal} ${P.name} 获得第 ${rank} 名！`);
      sndWin();
      this.emitSnapshot();
      await this.sleep(700);
      if (this.disposed) return;
      this.camFollowPlane = null;
      this.camFollowObj = null;
      this.endTurn(false);
      return;
    }
    await this.sleep(500);
    if (this.disposed) return;
    if (this.camFollowPlane && this.camMode === 'follow' && !this.camUserInteracting) {
      const home = this.getHomeCameraPose();
      _scratchCamOffset.copy(this.camera.position).sub(this.controls.target);
      _scratchCamSpherical.setFromVector3(_scratchCamOffset);
      this.setCamGoal(
        home.tx,
        home.ty,
        home.tz,
        home.radius,
        home.phi,
        _scratchCamSpherical.theta,
      );
    }
    this.camFollowPlane = null;
    this.camFollowObj = null;
    this.endTurn(die === 6);
  }

  private endTurn(again: boolean): void {
    if (this.phase === 'over' || this.disposed) return;
    if (again && this.sixChain < 3) {
      this.setMsg('🎲 奖励再掷一次！');
      this.beginRollPhase(true);
      return;
    }
    let steps = 0;
    do {
      this.turn = (this.turn + 1) % this.players.length;
      steps++;
    } while (
      steps < this.players.length &&
      this.finishedOrder.includes(this.turn)
    );
    this.sixChain = 0;
    this.beginRollPhase(false);
  }

  private focusTopDown(): void {
    const home = this.getHomeCameraPose();
    this.setCamGoal(0, 0, 0.2, home.radius * 1.04, 0.2, home.theta);
  }

  private focusTurn(): void {
    const P = this.cur();
    this.turnArrow.userData.home = { x: P.court[0], z: P.court[1] };
    const m = this.turnArrow.material as THREE.MeshStandardMaterial;
    m.color.set(lineOf(P));
    m.emissive.set(lineOf(P));

    if (this.camMode === 'follow' && !this.camUserInteracting && !this.camFollowPlane) {
      const home = this.getHomeCameraPose();
      _scratchCamOffset.copy(this.camera.position).sub(this.controls.target);
      _scratchCamSpherical.setFromVector3(_scratchCamOffset);
      this.setCamGoal(
        home.tx * 0.55 + P.court[0] * 0.45,
        home.ty,
        home.tz * 0.55 + P.court[1] * 0.45,
        home.radius * 0.78,
        home.phi,
        _scratchCamSpherical.theta,
      );
    }
  }

  private beginRollPhase(isBonus = false): void {
    this.focusTurn();
    if (this.isAI()) {
      this.phase = 'aiWait';
      this.deadline = null;
      this.emitSnapshot();
      this.after(2000, () => this.doRoll());
    } else {
      this.phase = 'awaitRoll';
      this.deadline = this.timeMs + TIMEOUT;
      sndYourTurn();
      this.showTurnSplash(this.cur(), isBonus);
    }
  }

  /* ================= AI Decision ================= */
  private simulateMoveOutcome(p: PlaneData, die: number) {
    if (p.pos === -1) {
      return { pos: 0, ringStops: [] as number[], jump: false, fly: false, bounced: false };
    }
    let np = p.pos + die;
    let bounced = false;
    if (np > HOME_END) {
      np = HOME_END - (np - HOME_END);
      bounced = true;
    }
    if (np === HOME_END) {
      return { pos: HOME_END, ringStops: [] as number[], jump: false, fly: false, bounced };
    }
    const ringStops: number[] = [];
    if (np >= 1 && np <= 50) ringStops.push(np);
    let jump = false;
    let fly = false;
    if (!bounced && np >= 1 && np <= 49 && np % 4 === 2) {
      if (np === FLIGHT_FROM) {
        fly = true;
        jump = true;
        np = FLIGHT_FROM + FLIGHT_STEP;
        ringStops.push(np);
        np += 4;
        ringStops.push(np);
      } else {
        jump = true;
        np += 4;
        ringStops.push(np);
        if (np === FLIGHT_FROM) {
          fly = true;
          np = FLIGHT_FROM + FLIGHT_STEP;
          ringStops.push(np);
        }
      }
    }
    return { pos: np, ringStops, jump, fly, bounced };
  }

  private ringThreatScore(ringIdx: number, myPid: number): number {
    let threat = 0;
    for (const q of this.planes) {
      if (q.pid === myPid || q.pos < 1 || q.pos > 50) continue;
      const qr = this.ringIndexOf(q);
      const d = (ringIdx - qr + 52) % 52;
      if (d >= 1 && d <= 6) {
        threat += 1;
      } else if (d >= 7 && d <= 10) {
        // 敌机若先落己方同色格再跳 +4，也存在一定追击风险
        const midPos = q.pos + (d - 4);
        if (midPos >= 1 && midPos <= 49 && midPos % 4 === 2) {
          threat += 0.55;
        }
      }
    }
    return threat;
  }

  private oppCrossFlyThreat(myPid: number): { immediate: boolean; near: boolean; oppPid: number } {
    const opp = this.slotPlayer((this.players[myPid].slotId + 2) % 4);
    if (!opp) return { immediate: false, near: false, oppPid: -1 };
    const oppPid = this.players.indexOf(opp);
    const oppPlanes = this.planesOf(oppPid);
    const immediate = oppPlanes.some((q) => q.pos >= 8 && q.pos <= 17);
    const near = oppPlanes.some((q) => q.pos >= 1 && q.pos <= 7);
    return { immediate, near, oppPid };
  }

  private aiPick(cands: { plane: PlaneData }[]) {
    const me = this.turn;
    const die = this.die ?? 1;
    const myPlanes = this.planesOf(me);
    const activeCount = myPlanes.filter((q) => q.pos >= 0 && q.pos < HOME_END).length;
    const crossThreat = this.oppCrossFlyThreat(me);

    let best = cands[0];
    let bs = -1e9;
    for (const c of cands) {
      const p = c.plane;
      const L = this.simulateMoveOutcome(p, die);
      const np = L.pos;
      const stackCount =
        p.pos <= 0 || p.pos >= HOME_END
          ? 1
          : myPlanes.filter((q) => q.pos === p.pos).length;

      let s = 0;

      if (np === HOME_END) {
        // 骰子刚好到达终点，最高优先级
        s = 320 + stackCount * 35;
      } else if (p.pos >= 51) {
        // 已在终点前安全小路上：没危险时尽量不浪费步数去反复回弹，留给其他棋子扩大优势
        const inDanger = p.pos === 54 && crossThreat.immediate;
        if (inDanger) {
          s = 78 - (L.bounced ? 14 : 0) + (np !== 54 ? 22 : 0);
        } else {
          s =
            -160 -
            (L.bounced ? 60 : 0) -
            (np === 54 && (crossThreat.immediate || crossThreat.near) ? 28 : 0) +
            np * 0.5;
        }
      } else if (p.pos === -1) {
        // 掷出 5 或 6 点可从基地起飞，优先增加场上可战棋子数
        s = 78 - activeCount * 10;
      } else {
        // 外圈或起点台棋子：综合评估进度、吃子、跨航线击落、进安全道与脱险/避险
        s = p.pos === 0 ? 18 : 10 + p.pos * 0.45 + Math.max(0, np - p.pos) * 0.55;

        // 统计沿途各停靠环格可撞回家的敌机
        const capturedSet = new Set<PlaneData>();
        for (const stopPos of L.ringStops) {
          const rIdx = (this.players[me].start + 2 + stopPos) % 52;
          for (const q of this.planes) {
            if (q.pid === me || q.pos < 1 || q.pos > 50) continue;
            if (this.ringIndexOf(q) === rIdx && !capturedSet.has(q)) {
              capturedSet.add(q);
              s += 85 + q.pos * 0.7;
            }
          }
        }

        // 飞越对面航线击落敌方停在终点前第 4 格（pos 54）的棋子
        if (L.fly && crossThreat.oppPid >= 0) {
          const flyVictims = this.planesOf(crossThreat.oppPid).filter((q) => q.pos === 54).length;
          s += flyVictims * 115;
        }

        if (L.fly) s += 48;
        if (L.jump) s += 20;

        if (np >= 51) {
          // 冲入终点前安全通道
          s += 78 + (np - 50) * 3;
          if (np === 54) {
            if (crossThreat.immediate) s -= 42;
            else if (crossThreat.near) s -= 14;
          }
        } else if (np >= 1 && np <= 50) {
          const newRingIdx = (this.players[me].start + 2 + np) % 52;
          if (myPlanes.some((q) => q !== p && q.pos === np)) {
            s += 12; // 同格叠机协同推进
          }
          const curThreat =
            p.pos >= 1 && p.pos <= 50 ? this.ringThreatScore(this.ringIndexOf(p), me) : 0;
          const newThreat = this.ringThreatScore(newRingIdx, me);
          if (curThreat > 0 && newThreat < curThreat) {
            s += (curThreat - newThreat) * (32 + p.pos * 0.3);
          }
          if (newThreat > 0) {
            s -= newThreat * (24 + p.pos * 0.45 * stackCount);
          }
        }
      }

      s += Math.random() * 1.5;
      if (s > bs) {
        bs = s;
        best = c;
      }
    }
    return best;
  }

  private getRankings(): number[] {
    const remaining = this.players
      .map((_, i) => i)
      .filter((i) => !this.finishedOrder.includes(i))
      .sort((a, b) => {
        const da = this.planesOf(a).filter((p) => p.pos === HOME_END).length;
        const db = this.planesOf(b).filter((p) => p.pos === HOME_END).length;
        return db - da;
      });
    return [...this.finishedOrder, ...remaining];
  }

  private showWin(pid: number): void {
    this.phase = 'over';
    this.winnerPid = pid;
    this.clearHL();
    sndWin();
    this.message = null;
    if (this.msgTimer !== null) window.clearTimeout(this.msgTimer);
    this.emitSnapshot();
  }

  /* ================= Render Loop ================= */
  private afterDraw(cb: () => void): void {
    const gl = this.renderer.getContext() as WebGL2RenderingContext;
    if (!gl || !gl.fenceSync) {
      this.frameId = window.setTimeout(cb, 80);
      return;
    }
    const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    gl.flush();
    const poll = () => {
      if (this.disposed) {
        if (sync) gl.deleteSync(sync);
        return;
      }
      const state = sync ? gl.getSyncParameter(sync, gl.SYNC_STATUS) : gl.SIGNALED;
      if (state === gl.UNSIGNALED) {
        this.frameId = window.setTimeout(poll, 5);
      } else {
        if (sync) gl.deleteSync(sync);
        this.frameId = window.setTimeout(cb, 80);
      }
    };
    this.frameId = window.setTimeout(poll, 5);
  }

  private startLoop(): void {
    const tick = () => {
      if (this.disposed) return;
      this.stepFrame();
      this.renderer.render(this.scene, this.camera);
      if (this.isSoftwareGl) {
        this.afterDraw(tick);
      } else {
        this.frameId = requestAnimationFrame(tick);
      }
    };
    if (this.isSoftwareGl) {
      this.stepFrame();
      this.renderer.render(this.scene, this.camera);
      this.afterDraw(tick);
    } else {
      this.frameId = requestAnimationFrame(tick);
    }
  }

  private stepFrame(): void {
    const dt = this.clock.getDelta();
    const t = this.clock.elapsedTime;

    if (!this.paused) {
      this.timeMs += dt * 1000;
      if (this.deadline !== null && this.timeMs >= this.deadline) {
        this.deadline = null;
        if (this.phase === 'awaitRoll' && !this.isAI()) {
          this.doRoll();
          this.setMsg('⏱️ 超时未操作，自动掷骰');
        } else if (this.phase === 'awaitMove' && this.movable.length && this.die !== null) {
          this.performMove(this.aiPick(this.movable).plane, this.die);
          this.setMsg('⏱️ 超时未操作，自动移动');
        }
      }

      for (let i = this.pending.length - 1; i >= 0; i--) {
        if (this.timeMs >= this.pending[i].at) {
          const f = this.pending[i];
          this.pending.splice(i, 1);
          f.fn();
        }
      }

      for (const rt of this.world.rideToys) {
        const w = t * 1.45 + rt.phase;
        const rock = Math.sin(w);
        rt.rockerPivot.rotation.x = rock * 0.095;
        rt.rockerPivot.position.y = Math.abs(rock) * 0.012;
        rt.riderPivot.rotation.x = Math.sin(w - 0.55) * 0.085;
        rt.headPivot.rotation.x = Math.sin(w - 0.95) * 0.07;
        rt.headPivot.rotation.z = Math.sin(t * 0.7 + rt.phase) * 0.045;
      }

      const movableSet =
        this.phase === 'awaitMove' ? new Set(this.movable.map((m) => m.plane)) : null;

      this.planes.forEach((p) => {
        const baseScale = p.pos === -1 ? 1.12 : 0.92;
        const pt = p.mesh.userData.parts as PlaneParts;
        if (p.animating) return;

        const stackTotal = (p.mesh.userData.stackTotal as number) || 1;
        const stackIdx = (p.mesh.userData.stackIdx as number) || 0;
        const baseX = p.mesh.userData.stackBaseX as number | undefined;
        const baseY = p.mesh.userData.stackBaseY as number | undefined;
        const baseZ = p.mesh.userData.stackBaseZ as number | undefined;
        const baseYaw = p.mesh.userData.stackBaseYaw as number | undefined;
        const isStackedOnBoard =
          stackTotal >= 2 &&
          p.pos >= 1 &&
          baseX !== undefined &&
          baseY !== undefined &&
          baseZ !== undefined &&
          baseYaw !== undefined;

        if (isStackedOnBoard) {
          // 整座叠叠乐作为一个统一整体：使用 YXZ 欧拉角在角色自身朝向的前后方向摇摆（几乎无左右侧倒穿帮），
          // 通过三角级联精确累加每一层的头顶接触点坐标，确保上层脚底严丝合缝踩在下层头顶，绝不悬空分离
          p.mesh.rotation.order = 'YXZ';

          const towerSeed = p.pid * 1.37 + p.pos * 0.41;
          const sharedBreath = Math.sin(t * 2.0 + towerSeed);

          let maxPitch = 0.018; // 2个人：比较稳，前后轻微呼吸平衡
          let freq = 1.75;
          let armBase = 0.24;
          let armWaveAmp = 0.04;

          if (stackTotal === 3) {
            // 3个人：有点晃，整体呈柔和弧线前后轻晃
            maxPitch = 0.078;
            freq = 2.45;
            armBase = 0.55;
            armWaveAmp = 0.18;
          } else if (stackTotal >= 4) {
            // 4个人：叠在一起晃得厉害，明显前后大幅摇摆 + 顶部急促微颤
            maxPitch = 0.175;
            freq = 3.25;
            armBase = 0.96;
            armWaveAmp = 0.45;
          }

          const pitchAtLevel = (lvl: number): number => {
            const phaseLag = lvl * 0.26;
            const mainWave = Math.sin(t * freq - phaseLag + towerSeed);
            const jitter = stackTotal >= 4 ? Math.sin(t * 9.2 + lvl * 1.1) * 0.18 : 0;
            const heightGain = 0.35 + lvl * 0.38;
            return (mainWave + jitter) * maxPitch * heightGain;
          };

          // 从底层 (k=0) 逐级累加每一层的头顶落脚点，保证全塔刚体级连贯成一个整体
          let localY = 0.12;
          let localZ = 0;
          for (let k = 0; k < stackIdx; k++) {
            const pk = pitchAtLevel(k);
            const stepH = STACK_STEP_Y + sharedBreath * 0.008;
            localY += stepH * Math.cos(pk);
            localZ += stepH * Math.sin(pk);
          }

          const curPitch = pitchAtLevel(stackIdx);
          const worldX = baseX! + Math.sin(baseYaw!) * localZ;
          const worldZ = baseZ! + Math.cos(baseYaw!) * localZ;

          p.mesh.position.set(worldX, localY, worldZ);
          p.mesh.rotation.set(curPitch, baseYaw!, 0);
          p.mesh.scale.setScalar(baseScale);

          // 整塔同步呼吸微压，保持整体一致性
          const squat = sharedBreath * 0.015;
          pt.animRoot.position.y = 0;
          pt.animRoot.scale.set(1 - squat * 0.5, 1 + squat, 1 - squat * 0.5);
          pt.animRoot.rotation.set(0, 0, 0);

          // 小手同步张开维持前后平衡，头部随塔身前后微点
          const armWave = Math.sin(t * (freq * 1.45) + stackIdx * 0.65) * armWaveAmp;
          const curArm = stackIdx === 0 ? 0.14 + armBase * 0.22 : armBase + armWave;
          pt.leftArm.rotation.z = curArm;
          pt.rightArm.rotation.z = -curArm;
          pt.headPivot.rotation.set(curPitch * 0.22, 0, 0);
          return;
        }

        // 非棋盘叠叠乐状态（单个棋子或 START 区域并排站立）
        if (baseX !== undefined && baseY !== undefined && baseZ !== undefined && baseYaw !== undefined) {
          p.mesh.position.set(baseX, baseY, baseZ);
          p.mesh.rotation.set(0, baseYaw, 0);
        }

        if (p.pos === HOME_END) {
          const v = t * 4.2 + p.phase;
          p.mesh.scale.setScalar(baseScale);
          pt.animRoot.position.y = Math.abs(Math.sin(v)) * 0.09;
          pt.animRoot.rotation.z = Math.sin(v * 0.5) * 0.08;
          pt.leftArm.rotation.z = 1.35 + Math.sin(v * 1.5) * 0.28;
          pt.rightArm.rotation.z = -1.35 - Math.sin(v * 1.5) * 0.28;
          pt.headPivot.rotation.z = Math.sin(v) * 0.12;
          pt.headPivot.rotation.y = Math.sin(v * 0.5) * 0.18;
        } else if (movableSet && movableSet.has(p)) {
          const syncPhase = p.pos === 0 || stackTotal >= 2 ? p.pid * 1.37 : p.phase;
          const ex = t * 5.5 + syncPhase;
          p.mesh.scale.setScalar(baseScale * (1 + 0.06 * Math.sin(ex)));
          pt.animRoot.position.y = Math.abs(Math.sin(ex)) * 0.07;
          pt.leftArm.rotation.z = 0.85 + Math.sin(ex * 1.5) * 0.35;
          pt.rightArm.rotation.z = -0.85 - Math.sin(ex * 1.5) * 0.35;
          pt.headPivot.rotation.x = Math.sin(ex) * 0.08;
          pt.headPivot.rotation.z = Math.sin(ex * 0.5) * 0.07;
        } else {
          const dizzyUntil = (p.mesh.userData.dizzyUntil as number) || 0;
          let halo = p.mesh.userData.dizzyHalo as THREE.Group | undefined;

          if (p.pos === -1 && this.timeMs < dizzyUntil) {
            // 被踩回家眩晕动画：头顶金色小星星绕圈旋转 + 晕头转向摇晃
            if (!halo) {
              halo = new THREE.Group();
              const starMat = new THREE.MeshStandardMaterial({
                color: 0xffd633,
                emissive: 0xffa800,
                emissiveIntensity: 0.75,
                roughness: 0.28,
              });
              const starGeo = new THREE.OctahedronGeometry(0.048, 0);
              for (let s = 0; s < 3; s++) {
                const ang = (s / 3) * Math.PI * 2;
                const st = new THREE.Mesh(starGeo, starMat);
                st.scale.set(1, 0.45, 1);
                st.position.set(Math.cos(ang) * 0.24, 0, Math.sin(ang) * 0.24);
                halo.add(st);
              }
              halo.position.set(0, 0.72, 0);
              p.mesh.add(halo);
              p.mesh.userData.dizzyHalo = halo;
            }
            halo.visible = true;
            halo.rotation.y = t * 5.2 + p.phase;
            halo.position.y = 0.72 + Math.sin(t * 6.0) * 0.025;
            halo.children.forEach((st, idx) => {
              st.rotation.y = t * 4 + idx;
            });

            p.mesh.scale.setScalar(baseScale);
            pt.animRoot.position.y = 0;
            pt.animRoot.scale.set(1, 1, 1);
            pt.animRoot.rotation.z = Math.sin(t * 5.2 + p.phase) * 0.11;
            pt.animRoot.rotation.x = Math.cos(t * 5.2 + p.phase) * 0.08;
            pt.headPivot.rotation.z = Math.sin(t * 7.5 + p.phase) * 0.24;
            pt.headPivot.rotation.x = Math.cos(t * 7.5 + p.phase) * 0.16;
            pt.headPivot.rotation.y = Math.sin(t * 3.8 + p.phase) * 0.22;
            pt.leftArm.rotation.z = 0.55 + Math.sin(t * 6.5) * 0.25;
            pt.rightArm.rotation.z = -0.55 - Math.cos(t * 6.5) * 0.25;
          } else {
            if (halo) halo.visible = false;
            const huddleTotal = (p.mesh.userData.huddleTotal as number) || 1;
            const hRoll = (p.mesh.userData.huddleRoll as number) || 0;
            const hPitch = (p.mesh.userData.huddlePitch as number) || 0;

            if (p.pos === 0 && huddleTotal >= 2) {
              // START 区域多熊「真实碰撞贴脸挤压」动画：软糯横向微扁、向内轻贴但保持碰撞边界不穿模
              const huddleSeed = p.pid * 2.1;
              const nuzzle = Math.sin(t * 2.2 + huddleSeed);
              p.mesh.scale.setScalar(baseScale);
              pt.animRoot.position.y = 0;
              pt.animRoot.rotation.set(hPitch, 0, hRoll * 0.5);
              // 取消横向缩水，保持接触面零缝隙贴紧，仅做纵向微弹性呼吸
              pt.animRoot.scale.set(1, 1.02 + nuzzle * 0.012, 1.025);
              pt.headPivot.rotation.set(
                hPitch * 0.4 + nuzzle * 0.02,
                0,
                hRoll + Math.sin(t * 1.6 + huddleSeed) * 0.018,
              );
              pt.headPivot.scale.set(1, 1, 1);
              pt.leftArm.rotation.z = 0.14 + nuzzle * 0.04;
              pt.rightArm.rotation.z = -0.14 - nuzzle * 0.04;
            } else {
              const idle = t * 2.0 + p.phase;
              const br = Math.sin(idle);
              p.mesh.scale.setScalar(baseScale);
              pt.animRoot.position.y = 0;
              pt.animRoot.rotation.set(0, 0, 0);
              pt.animRoot.scale.set(1 - br * 0.015, 1 + br * 0.025, 1 - br * 0.015);
              pt.headPivot.scale.set(1, 1, 1);
              pt.headPivot.rotation.z = Math.sin(t * 0.9 + p.phase) * 0.065;
              pt.headPivot.rotation.y = p.pos >= 0 ? Math.sin(t * 0.65 + p.phase) * 0.16 : 0;
              pt.headPivot.rotation.x = br * 0.025;
              pt.leftArm.rotation.z = 0.05 + br * 0.06;
              pt.rightArm.rotation.z = -0.05 - br * 0.06;
            }
          }
        }
      });

      const wy = this.world.waterY;
      this.world.moatTex.offset.x -= dt * 0.068;
      this.world.moatTex.offset.y += Math.sin(t * 0.6) * dt * 0.008;
      this.world.waterNormalTex.offset.x -= dt * 0.078;
      this.world.waterNormalTex.offset.y -= dt * 0.018;
      this.world.waterUniforms.uTime.value = t;
      const wAttr = this.world.waterMesh.geometry.attributes.position as THREE.BufferAttribute;
      const basePos = this.world.waterMesh.userData.basePos as Float32Array;
      const stride = 161;
      for (let i = 0; i < wAttr.count; i++) {
        const bx = basePos[i * 3];
        const bz = basePos[i * 3 + 2];
        const ang = Math.atan2(bz, bx);
        const u = Math.floor(i / stride) / 20;
        const env = Math.sin(u * Math.PI);
        wAttr.setY(
          i,
          wy +
            env *
              (Math.sin(ang * 10 - t * 1.9) * 0.009 +
                Math.sin(ang * 18 - t * 2.6 + u * 5.0) * 0.005 +
                Math.cos(bx * 0.55 + bz * 0.45 - t * 1.4) * 0.003),
        );
      }
      wAttr.needsUpdate = true;
      this.world.waterMesh.geometry.computeVertexNormals();

      for (const l of this.world.lotusList) {
        l.g.position.y = wy + 0.008 + Math.sin(t * 1.6 + l.phase) * 0.012;
      }
      for (const w of this.world.willowDrapeList) {
        w.g.rotation.z = Math.sin(t * 1.2 + w.phase) * 0.06;
        w.g.rotation.x = Math.cos(t * 0.9 + w.phase) * 0.04;
      }
      for (const p of this.world.petals) {
        p.m.position.y -= p.speed * dt;
        p.m.position.x += Math.sin(t * 1.5 + p.sway) * 0.35 * dt;
        p.m.rotation.x += dt * 1.8;
        p.m.rotation.z += dt * 1.3;
        if (p.m.position.y < wy) {
          p.m.position.y = rnd(2.8, 4.6);
          p.m.position.x = Math.cos(p.ang) * p.baseR;
          p.m.position.z = Math.sin(p.ang) * p.baseR;
        }
      }
      for (const k of this.world.swimKois) {
        const dirSign = Math.sign(k.speed) || 1;
        let speedMult = 1.0;
        let tailAmp = 1.0;
        let tailRate = 5.4;
        let rWave = 0;

        if (k.style === 'burst') {
          // 间歇摆尾冲刺 + 舒展胸鳍滑行
          const cycle = 0.5 + 0.5 * Math.sin(t * 0.9 + k.phase);
          const burst = Math.pow(cycle, 2.2);
          speedMult = 0.58 + burst * 1.15;
          tailAmp = 0.42 + burst * 1.05;
          tailRate = 4.2 + burst * 6.5;
          rWave = Math.sin(t * 0.38 + k.phase) * 0.55;
        } else if (k.style === 'dart') {
          // 灵动蛇形穿梭游动（幅度更大的横向摆巡）
          speedMult = 1.05 + 0.3 * Math.sin(t * 1.3 + k.phase);
          tailAmp = 1.15;
          tailRate = 7.4;
          rWave =
            Math.sin(t * 0.72 + k.phase) * 0.78 +
            Math.cos(t * 0.35 + k.phase * 1.7) * 0.42;
        } else if (k.style === 'hover') {
          // 悠闲慢游晃鳍
          speedMult = 0.65 + 0.22 * Math.sin(t * 0.65 + k.phase);
          tailAmp = 0.68;
          tailRate = 3.8;
          rWave = Math.sin(t * 0.28 + k.phase) * 0.48;
        } else {
          // 平稳巡游
          speedMult = 0.9 + 0.18 * Math.sin(t * 0.7 + k.phase);
          tailAmp = 0.9;
          tailRate = 5.2;
          rWave = Math.sin(t * 0.42 + k.phase) * 0.6;
        }

        const prevROff = k.rOff;
        k.rOff = THREE.MathUtils.clamp(k.baseROff + rWave, -1.38, 1.38);
        const r = this.world.moatChannelR(k.th, prevROff, 0.95);
        const px = Math.cos(k.th) * r;
        const pz = Math.sin(k.th) * r;
        const prevY = k.g.position.y;

        k.th += dt * k.speed * speedMult;
        k.swimPhase += dt * tailRate;

        const r2 = this.world.moatChannelR(k.th, k.rOff, 0.95);
        const nx = Math.cos(k.th) * r2;
        const nz = Math.sin(k.th) * r2;
        const depthWave =
          k.style === 'dart'
            ? Math.sin(t * 1.5 + k.phase) * 0.032
            : Math.sin(t * 1.1 + k.phase) * 0.018;
        const ny = wy - 0.11 + depthWave;

        k.g.position.set(nx, ny, nz);
        const dx = nx - px;
        const dz = nz - pz;
        const dy = ny - prevY;
        const horiz = Math.hypot(dx, dz) || 1e-4;
        k.g.rotation.y = Math.atan2(dx, dz);
        k.g.rotation.x = THREE.MathUtils.clamp(-dy / horiz * 0.65, -0.25, 0.25);
        k.g.rotation.z = THREE.MathUtils.clamp(((k.rOff - prevROff) / (dt || 0.016)) * dirSign * 0.18, -0.26, 0.26);

        // S型全身波浪传导：头 -> 中段尾柄 -> 尾鳍 + 胸鳍协同划水
        const headPivot = k.g.userData.headPivot as THREE.Group | undefined;
        const midPivot = k.g.userData.midPivot as THREE.Group | undefined;
        const tailPivot = k.g.userData.tail as THREE.Group | undefined;
        const finL = k.g.userData.finL as THREE.Group | undefined;
        const finR = k.g.userData.finR as THREE.Group | undefined;
        if (headPivot) headPivot.rotation.y = Math.sin(k.swimPhase) * 0.08 * tailAmp;
        if (midPivot) midPivot.rotation.y = Math.sin(k.swimPhase - 0.95) * 0.22 * tailAmp;
        if (tailPivot) tailPivot.rotation.y = Math.sin(k.swimPhase - 1.9) * 0.36 * tailAmp;
        if (finL && finR) {
          const pad = Math.sin(t * 2.9 + k.phase) * 0.24;
          finL.rotation.y = 0.28 + pad;
          finR.rotation.y = -0.28 - pad;
          finL.rotation.z = 0.12 + Math.cos(t * 2.9 + k.phase) * 0.14;
          finR.rotation.z = -0.12 - Math.cos(t * 2.9 + k.phase) * 0.14;
        }
      }
      for (const d of this.world.moatDucks) {
        const r = this.world.moatChannelR(d.th, d.rOff, 0.92);
        const px = Math.cos(d.th) * r;
        const pz = Math.sin(d.th) * r;
        d.th += dt * d.speed;
        const r2 = this.world.moatChannelR(d.th, d.rOff, 0.92);
        const nx = Math.cos(d.th) * r2;
        const nz = Math.sin(d.th) * r2;
        d.g.position.set(nx, wy - 0.004 + Math.sin(t * 2 + d.bob) * 0.014, nz);
        d.g.rotation.y = Math.atan2(nx - px, nz - pz);
      }

      const h = this.turnArrow.userData.home as { x: number; z: number };
      this.turnArrow.position.set(h.x, 2.05 + Math.sin(t * 2.6) * 0.16, h.z);
      this.turnArrow.rotation.y += dt * 1.4;

      this.pickHints.forEach((m) => {
        if (m.visible) {
          m.position.y = (m.userData.baseY as number) + Math.sin(t * 3.2) * 0.12;
          m.children[0].rotation.y += dt * 2;
        }
      });

      const targetDiceScale =
        this.phase === 'awaitRoll' && !this.isAI() && this.diceHovered ? 0.58 : 0.52;
      _scratchDiceScale.set(targetDiceScale, targetDiceScale, targetDiceScale);
      this.diceRig.dice.scale.lerp(_scratchDiceScale, Math.min(1, dt * 12));

      if (this.diceRig.diceHint.visible) {
        const pulse = 0.5 + 0.5 * Math.sin(t * 2.8);
        const rippleCycle = (t * 0.55) % 1;
        this.diceRig.dhRing.scale.setScalar(
          (this.diceHovered ? 1.08 : 1.0) + pulse * 0.05,
        );
        (this.diceRig.dhRing.material as THREE.MeshBasicMaterial).opacity =
          (this.diceHovered ? 0.88 : 0.62) + pulse * 0.2;
        this.diceRig.dhRipple.scale.setScalar(1 + rippleCycle * 0.62);
        (this.diceRig.dhRipple.material as THREE.MeshBasicMaterial).opacity =
          (1 - rippleCycle) * (this.diceHovered ? 0.52 : 0.36);

        const idleFloatY =
          DICE_REST_Y + (this.diceHovered ? 0.08 : 0.03) + Math.sin(t * 2.8) * 0.025;
        this.diceRig.dice.position.y = THREE.MathUtils.lerp(
          this.diceRig.dice.position.y,
          idleFloatY,
          Math.min(1, dt * 10),
        );
        this.diceRig.diceMaterials.forEach((m) => {
          m.emissive.setHex(0xfff4d8);
          m.emissiveIntensity = this.diceHovered ? 0.12 : 0.04;
        });
      } else {
        if (this.phase !== 'rolling') {
          this.diceRig.dice.position.y = THREE.MathUtils.lerp(
            this.diceRig.dice.position.y,
            DICE_REST_Y,
            Math.min(1, dt * 12),
          );
        }
        this.diceRig.diceMaterials.forEach((m) => {
          m.emissiveIntensity = 0;
        });
      }

      const fencePulse = 0.5 + 0.5 * Math.sin(t * 5.2);
      this.world.courtFences.forEach((cf) => {
        if (cf.active) {
          cf.woodMat.emissiveIntensity = 0.08 + fencePulse * 0.92;
          cf.trimMat.emissiveIntensity = 0.15 + fencePulse * 1.35;
          cf.capMat.emissiveIntensity = 0.35 + fencePulse * 2.15;
        }
      });

      const hd = this.diceRig.dice.position.y - DICE_REST_Y;
      (this.diceRig.diceShadow.material as THREE.MeshBasicMaterial).opacity = Math.max(
        0.06,
        0.28 - 0.12 * hd,
      );
      this.diceRig.diceShadow.scale.setScalar(1 + 0.15 * hd);

      for (let i = this.world.critters.length - 1; i >= 0; i--) {
        const c = this.world.critters[i];
        c.ttl -= dt;
        const canDespawn =
          c.kind !== 'rabbit' || c.state === 'rest' || c.state === 'hop';
        if (c.ttl <= 0 && canDespawn) {
          this.scene.remove(c.g);
          this.world.critters.splice(i, 1);
          continue;
        }
        if (c.kind === 'rabbit') {
          const bodyPivot = c.g.userData.bodyPivot as THREE.Group;
          const headPivot = c.g.userData.headPivot as THREE.Group;
          const earL = c.g.userData.earL as THREE.Group;
          const earR = c.g.userData.earR as THREE.Group;
          const pawL = c.g.userData.pawL as THREE.Group;
          const pawR = c.g.userData.pawR as THREE.Group;
          const hindPivot = c.g.userData.hindPivot as THREE.Group;
          const tailPivot = c.g.userData.tailPivot as THREE.Group;
          const shadowDisc = c.g.userData.shadowDisc as THREE.Mesh;
          const carrotGrp = c.g.userData.carrotGrp as THREE.Group;
          const grassGrp = c.g.userData.grassGrp as THREE.Group;
          const burrowGrp = c.g.userData.burrowGrp as THREE.Group;
          const dirtChips = c.g.userData.dirtChips as THREE.Mesh[];
          const px = c.g.position.x;
          const pz = c.g.position.z;

          carrotGrp.visible = c.state === 'eatCarrot';
          grassGrp.visible = c.state === 'graze';
          const showBurrow =
            c.state === 'dig' || c.state === 'burrow' || c.state === 'emerge';
          burrowGrp.visible = showBurrow;
          shadowDisc.visible = !showBurrow;
          if (c.state !== 'dig') {
            dirtChips.forEach((chip) => {
              chip.visible = false;
            });
          }

          if (c.state === 'rest') {
            c.rest -= dt;
            c.g.position.y = this.world.hillH(px, pz);
            bodyPivot.position.set(0, 0.02, 0);
            bodyPivot.rotation.set(-0.06 + Math.sin(t * 2.1 + c.phase) * 0.05, 0, 0);
            const br = Math.sin(t * 4.2 + c.phase);
            bodyPivot.scale.set(1 - br * 0.025, 1 + br * 0.035, 1 - br * 0.025);
            headPivot.rotation.set(
              Math.sin(t * 6.8 + c.phase) * 0.055,
              Math.sin(t * 1.6 + c.phase * 1.3) * 0.34,
              Math.sin(t * 2.3 + c.phase) * 0.14,
            );
            earL.rotation.set(
              -0.14 + Math.sin(t * 4.8 + c.phase) * 0.12,
              0,
              0.18 + Math.sin(t * 3.1 + c.phase) * 0.08,
            );
            earR.rotation.set(
              -0.1 + Math.cos(t * 4.1 + c.phase) * 0.14,
              0,
              -0.18 - Math.cos(t * 3.5 + c.phase) * 0.08,
            );
            pawL.rotation.set(0, 0, 0);
            pawR.rotation.set(0, 0, 0);
            hindPivot.rotation.x = 0;
            tailPivot.rotation.set(0, Math.sin(t * 5.0 + c.phase) * 0.15, 0);
            shadowDisc.scale.setScalar(1);
            (shadowDisc.material as THREE.MeshBasicMaterial).opacity = 0.29;

            if (c.rest <= 0) {
              const roll = Math.random();
              if (roll < 0.44) {
                c.state = 'hop';
                c.hopT = 0;
                const hopDist = 2.35 * c.hopDur;
                const curR = Math.hypot(px, pz);
                const curTh = Math.atan2(pz, px);
                let chosenDir = c.dir;
                let found = false;
                for (let tryIdx = 0; tryIdx < 10; tryIdx++) {
                  const cand =
                    tryIdx === 0 && curR > 31.5
                      ? Math.atan2(-pz, -px) + rnd(-0.5, 0.5)
                      : tryIdx === 0 && curR < this.world.moatOuterR(curTh) + 1.85
                        ? curTh + rnd(-0.5, 0.5)
                        : c.dir + rnd(-1.1, 1.1) + tryIdx * 0.45;
                  const nx = px + Math.cos(cand) * hopDist;
                  const nz = pz + Math.sin(cand) * hopDist;
                  const nr = Math.hypot(nx, nz);
                  const nTh = Math.atan2(nz, nx);
                  if (
                    nr >= this.world.moatOuterR(nTh) + 1.5 &&
                    nr <= 32.5 &&
                    Math.min(Math.abs(nx), Math.abs(nz)) >= 1.55
                  ) {
                    chosenDir = cand;
                    found = true;
                    break;
                  }
                }
                if (!found) {
                  chosenDir = curR < 25.5 ? curTh : Math.atan2(-pz, -px);
                }
                c.dir = chosenDir;
                c.g.rotation.y = -c.dir + Math.PI / 2;
              } else if (roll < 0.67) {
                c.state = 'graze';
                c.stateT = 0;
                c.stateDur = rnd(2.2, 3.4);
              } else if (roll < 0.85) {
                c.state = 'eatCarrot';
                c.stateT = 0;
                c.stateDur = rnd(2.4, 3.6);
              } else {
                c.state = 'dig';
                c.stateT = 0;
                c.stateDur = rnd(1.8, 2.4);
              }
            }
          } else if (c.state === 'hop') {
            c.hopT += dt / c.hopDur;
            if (c.hopT >= 1) {
              c.hopT = 0;
              c.state = 'rest';
              c.rest = 0.32 + Math.random() * 0.95;
              c.g.position.y = this.world.hillH(px, pz);
              bodyPivot.position.set(0, 0.02, 0);
              bodyPivot.rotation.set(0.08, 0, 0);
              bodyPivot.scale.set(1.06, 0.92, 1.04);
              pawL.rotation.set(0, 0, 0);
              pawR.rotation.set(0, 0, 0);
              hindPivot.rotation.x = 0;
            } else {
              let nx = px + Math.cos(c.dir) * 2.35 * dt;
              let nz = pz + Math.sin(c.dir) * 2.35 * dt;
              const nTh = Math.atan2(nz, nx);
              const safeR = this.world.moatOuterR(nTh) + 1.38;
              const nr = Math.hypot(nx, nz);
              if (nr < safeR) {
                nx = Math.cos(nTh) * safeR;
                nz = Math.sin(nTh) * safeR;
                c.dir = nTh;
                c.g.rotation.y = -c.dir + Math.PI / 2;
              }
              c.g.position.x = nx;
              c.g.position.z = nz;
              c.g.position.y = this.world.hillH(nx, nz);

              const arc = Math.sin(c.hopT * Math.PI);
              const pitch = Math.cos(c.hopT * Math.PI);
              bodyPivot.position.set(0, 0.02 + arc * c.hopH, 0);
              bodyPivot.rotation.set(-pitch * 0.42, 0, 0);
              bodyPivot.scale.set(1 - arc * 0.08, 1 + arc * 0.14, 1 + arc * 0.08);
              pawL.rotation.set(-arc * 0.45, 0, 0);
              pawR.rotation.set(-arc * 0.45, 0, 0);
              hindPivot.rotation.x = arc * 0.72;
              headPivot.rotation.set(pitch * 0.16, 0, 0);
              earL.rotation.set(-0.15 - arc * 0.56, 0, 0.2);
              earR.rotation.set(-0.15 - arc * 0.48, 0, -0.2);
              tailPivot.rotation.set(-arc * 0.25, 0, 0);
              shadowDisc.scale.setScalar(1 - arc * 0.35);
              (shadowDisc.material as THREE.MeshBasicMaterial).opacity =
                0.29 * (1 - arc * 0.55);
            }
          } else if (c.state === 'graze') {
            c.stateT += dt;
            const u = Math.min(1, c.stateT / c.stateDur);
            const env = Math.min(1, u * 5.2, (1 - u) * 5.2);
            const nibblePhase = 0.5 + 0.5 * Math.sin(t * 2.8 + c.phase);
            const chewingLift = nibblePhase < 0.24 ? (0.24 - nibblePhase) / 0.24 : 0;

            c.g.position.y = this.world.hillH(px, pz);
            bodyPivot.position.set(0, 0.02, 0.02 * env);
            bodyPivot.rotation.set(0.28 * env * (1 - chewingLift * 0.5), 0, 0);
            bodyPivot.scale.set(1, 1 - 0.04 * env + Math.sin(t * 14) * 0.02, 1);

            headPivot.rotation.set(
              (0.58 * (1 - chewingLift * 0.65) + Math.sin(t * 16) * 0.11) * env,
              Math.sin(t * 4.2 + c.phase) * (chewingLift > 0 ? 0.24 : 0.1),
              Math.sin(t * 7.5) * 0.06 * env,
            );
            earL.rotation.set(0.1 + Math.sin(t * 6.5 + c.phase) * 0.1, 0, 0.16);
            earR.rotation.set(0.06 + Math.cos(t * 5.8 + c.phase) * 0.1, 0, -0.16);
            pawL.rotation.set(0.18 * env, 0, 0);
            pawR.rotation.set(0.18 * env, 0, 0);
            hindPivot.rotation.x = 0;
            tailPivot.rotation.set(0, Math.sin(t * 6.5 + c.phase) * 0.18, 0);
            shadowDisc.scale.setScalar(1);
            (shadowDisc.material as THREE.MeshBasicMaterial).opacity = 0.29;

            grassGrp.scale.setScalar(Math.max(0.35, 1.0 - u * 0.45));
            grassGrp.rotation.z = Math.sin(t * 15) * 0.09 * (1 - chewingLift);

            if (u >= 1) {
              c.state = 'rest';
              c.rest = rnd(0.35, 0.95);
            }
          } else if (c.state === 'eatCarrot') {
            c.stateT += dt;
            const u = Math.min(1, c.stateT / c.stateDur);
            const env = Math.min(1, u * 5.2, (1 - u) * 5.2);

            c.g.position.y = this.world.hillH(px, pz);
            bodyPivot.position.set(0, 0.02 + 0.026 * env, 0);
            bodyPivot.rotation.set(-0.26 * env, 0, 0);
            bodyPivot.scale.set(
              1 - Math.sin(t * 14) * 0.015,
              1 + 0.04 * env,
              1,
            );

            pawL.rotation.set(-0.98 * env, 0, -0.24 * env);
            pawR.rotation.set(-0.98 * env, 0, 0.24 * env);
            headPivot.rotation.set(
              (0.24 + Math.sin(t * 16) * 0.09) * env,
              Math.sin(t * 3.4 + c.phase) * 0.14 * env,
              Math.sin(t * 5.0) * 0.06 * env,
            );
            earL.rotation.set(-0.08 + Math.sin(t * 7.2 + c.phase) * 0.14, 0, 0.22);
            earR.rotation.set(-0.08 + Math.cos(t * 6.6 + c.phase) * 0.14, 0, -0.22);
            hindPivot.rotation.x = 0.2 * env;
            tailPivot.rotation.set(0, Math.sin(t * 8.5 + c.phase) * 0.24, 0);
            shadowDisc.scale.setScalar(1);
            (shadowDisc.material as THREE.MeshBasicMaterial).opacity = 0.29;

            carrotGrp.scale.setScalar((1 - u * 0.42) * env);
            carrotGrp.position.y = 0.165 + Math.sin(t * 16) * 0.008;
            carrotGrp.rotation.z = Math.sin(t * 8) * 0.08;

            if (u >= 1) {
              c.state = 'rest';
              c.rest = rnd(0.35, 0.95);
            }
          } else if (c.state === 'dig') {
            c.stateT += dt;
            const u = Math.min(1, c.stateT / c.stateDur);

            c.g.position.y = this.world.hillH(px, pz);
            const moundS = THREE.MathUtils.smoothstep(u, 0, 0.55);
            burrowGrp.scale.setScalar(0.18 + moundS * 0.82);

            bodyPivot.position.set(0, 0.02 + Math.abs(Math.sin(t * 24)) * 0.015, 0.04);
            bodyPivot.rotation.set(0.36, 0, Math.sin(t * 12) * 0.08);
            bodyPivot.scale.set(1, 1, 1);

            pawL.rotation.set(-0.32 + Math.sin(t * 26) * 0.72, 0, 0);
            pawR.rotation.set(-0.32 - Math.sin(t * 26) * 0.72, 0, 0);
            headPivot.rotation.set(0.42 + Math.sin(t * 13) * 0.06, 0, 0);
            earL.rotation.set(-0.38, 0, 0.22);
            earR.rotation.set(-0.35, 0, -0.22);
            hindPivot.rotation.x = 0;
            tailPivot.rotation.set(0, Math.sin(t * 12) * 0.18, 0);

            dirtChips.forEach((chip, idx) => {
              chip.visible = true;
              const p = (t * 2.3 + idx * 0.25) % 1;
              const side = idx % 2 === 0 ? 1 : -1;
              chip.position.set(
                side * (0.04 + p * 0.11),
                0.02 + Math.sin(p * Math.PI) * 0.2,
                -p * 0.35,
              );
              chip.rotation.set(p * 6, p * 4, idx);
            });

            if (u >= 1) {
              c.state = 'burrow';
              c.stateT = 0;
              c.stateDur = 1.45;
            }
          } else if (c.state === 'burrow') {
            c.stateT += dt;
            const u = Math.min(1, c.stateT / c.stateDur);
            c.g.position.y = this.world.hillH(px, pz);
            burrowGrp.scale.setScalar(1);

            if (u < 0.28) {
              const k = u / 0.28;
              const arc = Math.sin(k * Math.PI);
              bodyPivot.position.set(0, 0.02 + arc * 0.09, 0.04 + k * 0.21);
              bodyPivot.rotation.set(0.36 + k * 0.44, 0, 0);
              bodyPivot.scale.set(1, 1, 1);
              pawL.rotation.set(-0.45, 0, 0);
              pawR.rotation.set(-0.45, 0, 0);
              hindPivot.rotation.x = arc * 0.55;
            } else if (u < 0.78) {
              const k = (u - 0.28) / 0.5;
              bodyPivot.position.set(0, -k * 0.26, 0.25);
              bodyPivot.rotation.set(0.8, 0, Math.sin(t * 16) * 0.12);
              bodyPivot.scale.set(1, 1, 1);
              pawL.rotation.set(-0.55, 0, 0);
              pawR.rotation.set(-0.55, 0, 0);
              hindPivot.rotation.x = Math.sin(t * 20) * 0.42;
              tailPivot.rotation.set(0, Math.sin(t * 18) * 0.34, 0);
            } else {
              const k = (u - 0.78) / 0.22;
              bodyPivot.position.set(0, -0.26 - k * 0.1, 0.25);
              bodyPivot.rotation.set(0.8, 0, 0);
              bodyPivot.scale.setScalar(Math.max(0.01, 1 - k));
            }
            headPivot.rotation.set(0.3, 0, 0);
            earL.rotation.set(-0.45, 0, 0.18);
            earR.rotation.set(-0.45, 0, -0.18);

            if (u >= 1) {
              c.state = 'emerge';
              c.stateT = 0;
              c.stateDur = 1.55;
            }
          } else {
            // emerge: 探头张望后跳出地洞，土堆自然收拢消失
            c.stateT += dt;
            const u = Math.min(1, c.stateT / c.stateDur);
            c.g.position.y = this.world.hillH(px, pz);

            if (u < 0.32) {
              const k = u / 0.32;
              burrowGrp.scale.setScalar(1);
              bodyPivot.scale.setScalar(THREE.MathUtils.smoothstep(k, 0, 0.35) * 0.99 + 0.01);
              bodyPivot.position.set(0, -0.3 + k * 0.2, 0.22);
              bodyPivot.rotation.set(-0.2, 0, 0);
              headPivot.rotation.set(-0.1, 0, 0);
              earL.rotation.set(-0.1, 0, 0.18);
              earR.rotation.set(-0.1, 0, -0.18);
            } else if (u < 0.68) {
              const k = (u - 0.32) / 0.36;
              burrowGrp.scale.setScalar(1);
              bodyPivot.scale.set(1, 1, 1);
              bodyPivot.position.set(0, -0.1, 0.22);
              bodyPivot.rotation.set(-0.15, 0, 0);
              headPivot.rotation.set(0, Math.sin(k * Math.PI * 3.2) * 0.52, 0);
              earL.rotation.set(-0.08 + Math.sin(t * 8) * 0.12, 0, 0.2);
              earR.rotation.set(-0.08 + Math.cos(t * 7.5) * 0.12, 0, -0.2);
            } else {
              const k = (u - 0.68) / 0.32;
              const arc = Math.sin(k * Math.PI);
              burrowGrp.scale.setScalar(Math.max(0.01, 1 - k));
              bodyPivot.scale.set(1, 1, 1);
              bodyPivot.position.set(0, -0.1 + k * 0.12 + arc * 0.16, 0.22 * (1 - k));
              bodyPivot.rotation.set(-Math.cos(k * Math.PI) * 0.25, 0, 0);
              pawL.rotation.set(-arc * 0.4, 0, 0);
              pawR.rotation.set(-arc * 0.4, 0, 0);
              hindPivot.rotation.x = arc * 0.55;
              headPivot.rotation.set(0, 0, 0);
            }

            if (u >= 1) {
              c.state = 'rest';
              c.rest = rnd(0.45, 1.1);
              burrowGrp.visible = false;
              burrowGrp.scale.setScalar(1);
              bodyPivot.scale.set(1, 1, 1);
              bodyPivot.position.set(0, 0.02, 0);
            }
          }
        } else if (c.kind === 'bird') {
          if (c.perchTarget) {
            const pt = c.perchTarget;
            pt.headPivot.updateWorldMatrix(true, false);
            _scratchHeadCrown.set(0, 0.514, 0);
            pt.headPivot.localToWorld(_scratchHeadCrown);
            pt.headPivot.getWorldQuaternion(_scratchHeadQuat);
            _scratchYawQuat.setFromAxisAngle(_scratchUpAxis, c.perchYaw ?? Math.PI * 0.42);
            _scratchTargetQuat.copy(_scratchHeadQuat).multiply(_scratchYawQuat);

            const bodyRoot = c.g.userData.bodyRoot as THREE.Group;
            const birdHeadPivot = c.g.userData.headPivot as THREE.Group;
            const foldedWings = c.g.userData.foldedWings as THREE.Group;
            const flyTail = c.g.userData.flyTail as THREE.Mesh;
            const legsGrp = c.g.userData.legsGrp as THREE.Group;
            const lw = c.g.userData.lw as THREE.Group;
            const rw = c.g.userData.rw as THREE.Group;

            const applySeagullPose = (landBlend: number, flapSpeed: number, flapAmp: number) => {
              bodyRoot.position.y = landBlend * 0.145;
              legsGrp.visible = landBlend > 0.08;
              legsGrp.scale.set(1, Math.max(0.05, landBlend), 1);
              const isFolded = landBlend > 0.86;
              foldedWings.visible = isFolded;
              lw.visible = !isFolded;
              rw.visible = !isFolded;
              flyTail.visible = !isFolded;
              if (!isFolded) {
                c.flap += dt * flapSpeed;
                const w = Math.sin(c.flap) * flapAmp * (1 - 0.55 * landBlend);
                lw.rotation.set(0, -0.58 * landBlend, w);
                rw.rotation.set(0, 0.58 * landBlend, -w);
              }
            };

            const evalQuad = (
              a: THREE.Vector3,
              b: THREE.Vector3,
              d: THREE.Vector3,
              p: number,
              out: THREE.Vector3,
            ) => {
              const cp = THREE.MathUtils.clamp(p, 0, 1);
              const inv = 1 - cp;
              out
                .copy(a)
                .multiplyScalar(inv * inv)
                .addScaledVector(b, 2 * inv * cp)
                .addScaledVector(d, cp * cp);
            };

            if (c.perchPhase === 'approach') {
              c.perchT = (c.perchT ?? 0) + dt / (c.perchDur || 3.4);
              const p = Math.min(1, c.perchT);
              evalQuad(c.from, c.ctrl, _scratchHeadCrown, p, _scratchBirdPos);
              evalQuad(
                c.from,
                c.ctrl,
                _scratchHeadCrown,
                Math.min(1, p + 0.025),
                _scratchBirdNext,
              );
              c.g.position.copy(_scratchBirdPos);
              if (p < 0.985) {
                c.g.lookAt(_scratchBirdNext);
              }
              const orientBlend = THREE.MathUtils.smoothstep(p, 0.68, 1.0);
              if (orientBlend > 0) {
                c.g.quaternion.slerp(_scratchTargetQuat, orientBlend);
              }
              const landBlend = THREE.MathUtils.smoothstep(p, 0.78, 1.0);
              applySeagullPose(landBlend, p > 0.72 ? 15.5 : 8.2, p > 0.72 ? 0.58 : 0.42);
              if (p >= 1) {
                c.perchPhase = 'perch';
                c.perchT = 0;
                c.perchDur = rnd(8.5, 13.0);
              }
            } else if (c.perchPhase === 'perch') {
              c.perchT = (c.perchT ?? 0) + dt / (c.perchDur || 10.0);
              c.g.position.copy(_scratchHeadCrown);
              c.g.quaternion.copy(_scratchTargetQuat);
              applySeagullPose(1, 0, 0);
              const idlePhase = t * 1.55 + c.phase;
              birdHeadPivot.rotation.set(
                Math.max(0, Math.sin(t * 2.8 + c.phase)) * 0.08,
                Math.sin(idlePhase) * 0.28 + Math.sin(idlePhase * 2.6) * 0.09,
                Math.sin(t * 1.1 + c.phase) * 0.06,
              );
              bodyRoot.position.y = 0.145 + Math.sin(t * 3.1 + c.phase) * 0.004;
              if (c.perchT >= 1) {
                birdHeadPivot.rotation.set(0, 0, 0);
                c.from.copy(_scratchHeadCrown);
                const outAng = Math.atan2(_scratchHeadCrown.x, _scratchHeadCrown.z) + rnd(-0.7, 0.7);
                c.departCtrl = new THREE.Vector3(
                  _scratchHeadCrown.x + Math.sin(outAng) * 6.5,
                  _scratchHeadCrown.y + rnd(3.2, 4.6),
                  _scratchHeadCrown.z + Math.cos(outAng) * 6.5,
                );
                c.departTo = new THREE.Vector3(
                  Math.sin(outAng) * rnd(24, 29),
                  rnd(7.5, 10.2),
                  Math.cos(outAng) * rnd(24, 29),
                );
                c.perchPhase = 'depart';
                c.perchT = 0;
                c.perchDur = rnd(3.0, 4.0);
              }
            } else {
              c.perchT = (c.perchT ?? 0) + dt / (c.perchDur || 3.4);
              const p = c.perchT;
              if (p >= 1) {
                this.scene.remove(c.g);
                this.world.critters.splice(i, 1);
                continue;
              }
              const ctrl = c.departCtrl ?? c.ctrl;
              const to = c.departTo ?? c.to;
              evalQuad(c.from, ctrl, to, p, _scratchBirdPos);
              evalQuad(c.from, ctrl, to, Math.min(1, p + 0.025), _scratchBirdNext);
              c.g.position.copy(_scratchBirdPos);
              c.g.lookAt(_scratchBirdNext);
              if (p < 0.22) {
                const startBlend = 1 - THREE.MathUtils.smoothstep(p, 0, 0.22);
                c.g.quaternion.slerp(_scratchTargetQuat, startBlend);
              }
              const landBlend = 1 - THREE.MathUtils.smoothstep(p, 0, 0.22);
              applySeagullPose(landBlend, 14.5, 0.62);
            }
            continue;
          }

          c.prog += dt / c.dur;
          if (c.prog >= 1) {
            this.scene.remove(c.g);
            this.world.critters.splice(i, 1);
            continue;
          }
          const evalBirdPos = (p: number, out: THREE.Vector3) => {
            const cp = THREE.MathUtils.clamp(p, 0, 1);
            if (c.mode === 'circle') {
              const wIn = THREE.MathUtils.smoothstep(cp, 0, 0.24);
              const wOut = THREE.MathUtils.smoothstep(cp, 0.76, 1);
              const ang = c.phase + cp * c.circleSpeed;
              const baseH = (c.from.y + c.to.y) * 0.5;
              _scratchBirdOrb.set(
                Math.cos(ang) * c.circleR,
                baseH + Math.sin(cp * Math.PI * 4 + c.phase) * 0.42,
                Math.sin(ang) * c.circleR,
              );
              out.lerpVectors(c.from, _scratchBirdOrb, wIn);
              out.lerp(c.to, wOut);
            } else {
              const inv = 1 - cp;
              out
                .copy(c.from)
                .multiplyScalar(inv * inv)
                .addScaledVector(c.ctrl, 2 * inv * cp)
                .addScaledVector(c.to, cp * cp);
              if (c.mode === 'bound') {
                // 上下蹦跶式波浪起伏飞行
                out.y += Math.sin(cp * Math.PI * 13 + c.phase) * 0.46;
              } else if (c.mode === 'soar') {
                out.y += Math.sin(cp * Math.PI * 2 + c.phase) * 0.28;
              }
            }
            return out;
          };

          const pPrev = Math.max(0, c.prog - 0.015);
          const pNext = Math.min(1, c.prog + 0.015);
          evalBirdPos(pPrev, _scratchBirdPrev);
          evalBirdPos(c.prog, _scratchBirdPos);
          evalBirdPos(pNext, _scratchBirdNext);

          c.g.position.copy(_scratchBirdPos);
          if (pNext > c.prog) {
            c.g.lookAt(_scratchBirdNext);
          }

          // 计算水平转弯倾斜压坡角
          const v1x = _scratchBirdPos.x - _scratchBirdPrev.x;
          const v1z = _scratchBirdPos.z - _scratchBirdPrev.z;
          const v2x = _scratchBirdNext.x - _scratchBirdPos.x;
          const v2z = _scratchBirdNext.z - _scratchBirdPos.z;
          const turnCross = (v1x * v2z - v1z * v2x) * 26;
          const bank = THREE.MathUtils.clamp(turnCross, -0.52, 0.52);
          c.g.rotateZ(bank);

          const lw = c.g.userData.lw as THREE.Group;
          const rw = c.g.userData.rw as THREE.Group;

          if (c.mode === 'soar') {
            // 白鹭/大鸟：长时展翼滑翔 + 间歇慢速深振翅
            const flapWindow = Math.sin(t * 0.95 + c.phase);
            if (flapWindow > 0.35) {
              c.flap += dt * 6.2;
              const w = Math.sin(c.flap) * 0.52;
              lw.rotation.set(0, 0, w);
              rw.rotation.set(0, 0, -w);
            } else {
              const glideDihedral = -0.1 + Math.sin(t * 1.4 + c.phase) * 0.03;
              lw.rotation.set(0, 0.14, glideDihedral);
              rw.rotation.set(0, -0.14, -glideDihedral);
            }
          } else if (c.mode === 'circle') {
            // 盘旋滑翔：大部分时间平稳侧倾乘气流滑翔，偶尔轻拍几下翅膀维持高度
            const burst = Math.sin(t * 0.72 + c.phase);
            if (burst > 0.55) {
              c.flap += dt * 7.5;
              const w = Math.sin(c.flap) * 0.45;
              lw.rotation.set(0, 0.08, w);
              rw.rotation.set(0, -0.08, -w);
            } else {
              lw.rotation.set(0, 0.18, -0.06);
              rw.rotation.set(0, -0.18, 0.06);
            }
          } else if (c.mode === 'swoop') {
            // 燕子/翠鸟：俯冲掠水时收掠滑翔，拉起爬升时高频急振翅
            if (c.prog > 0.18 && c.prog < 0.52) {
              lw.rotation.set(0, 0.46, 0.14);
              rw.rotation.set(0, -0.46, -0.14);
            } else {
              c.flap += dt * 15;
              const w = Math.sin(c.flap) * 0.65;
              lw.rotation.set(0, 0.1, w);
              rw.rotation.set(0, -0.1, -w);
            }
          } else {
            // 雀类/知更鸟：上下蹦跶（爬升期急拍翅，波峰滑落期收拢翅膀）
            const wavePhase = c.prog * Math.PI * 13 + c.phase;
            const climbing = Math.cos(wavePhase) > -0.15;
            if (climbing) {
              c.flap += dt * 18;
              const w = Math.sin(c.flap) * 0.72;
              lw.rotation.set(0, 0, w);
              rw.rotation.set(0, 0, -w);
            } else {
              lw.rotation.set(0, 0.45, 0.42);
              rw.rotation.set(0, -0.45, -0.42);
            }
          }
        } else if (c.kind === 'fish') {
          c.prog += dt / 1.15;
          if (c.prog >= 1) {
            this.scene.remove(c.g);
            this.world.critters.splice(i, 1);
            continue;
          }
          c.g.position.y = wy - 0.02 + Math.sin(c.prog * Math.PI) * c.h;
          c.g.rotation.x = -(Math.sin(c.prog * Math.PI) * 1.1 - 0.55);
          c.g.position.x += Math.sin(c.g.rotation.y) * dt * 0.85;
          c.g.position.z += Math.cos(c.g.rotation.y) * dt * 0.85;
          const midPivot = c.g.userData.midPivot as THREE.Group | undefined;
          const tailPivot = c.g.userData.tail as THREE.Group | undefined;
          if (midPivot) midPivot.rotation.y = Math.sin(t * 18) * 0.3;
          if (tailPivot) tailPivot.rotation.y = Math.sin(t * 18 - 0.8) * 0.52;
        } else {
          c.seed += dt;
          c.flap += dt * 13;
          const fw = Math.sin(c.flap) * 0.75;
          (c.g.userData.lw as THREE.Object3D).rotation.z = -fw;
          (c.g.userData.rw as THREE.Object3D).rotation.z = fw;
          c.g.position.x = c.cx + Math.sin(c.seed * 0.9) * 1.3;
          c.g.position.z = c.cz + Math.sin(c.seed * 0.7 + 2) * 1.3;
          c.g.position.y = -0.2 + Math.sin(c.seed * 1.35) * 0.28;
          c.g.rotation.y =
            Math.atan2(
              Math.cos(c.seed * 0.7 + 2) * Math.cos(c.seed * 0.7),
              Math.cos(c.seed * 0.9) * Math.cos(c.seed * 0.9),
            ) || c.g.rotation.y;
        }
      }

      // 两船相逢对诗状态机（渐停 -> 对诗 -> 渐启航）
      const boats = this.world.boats;
      if (boats.length >= 2) {
        const bScholar = boats[0];
        const bMaiden = boats[1];
        const dTh = Math.atan2(
          Math.sin(bMaiden.th - bScholar.th),
          Math.cos(bMaiden.th - bScholar.th),
        );
        if (this.poemCooldown > 0) this.poemCooldown = Math.max(0, this.poemCooldown - dt);

        if (this.poemState === 'cruising') {
          if (this.poemCooldown <= 0 && dTh > 0.08 && dTh < 0.25) {
            this.poemState = 'slowing';
            this.poemTimer = 0;
            let idx = Math.floor(Math.random() * ROMANTIC_POEMS.length);
            if (ROMANTIC_POEMS.length > 1 && idx === this.lastPoemIdx) {
              idx = (idx + 1 + Math.floor(Math.random() * (ROMANTIC_POEMS.length - 1))) % ROMANTIC_POEMS.length;
            }
            this.activePoemIdx = idx;
            this.lastPoemIdx = idx;
            bScholar.targetLookYaw = -0.45;
            bMaiden.targetLookYaw = -0.45;
          }
        } else if (this.poemState === 'slowing') {
          this.poemTimer += dt;
          const k = Math.min(1, this.poemTimer / 1.55);
          const sf = 1 - k * k * (3 - 2 * k);
          bScholar.speedFactor = sf;
          bMaiden.speedFactor = sf;
          if (k >= 1) {
            bScholar.speedFactor = 0;
            bMaiden.speedFactor = 0;
            this.poemState = 'verse1';
            this.poemTimer = 0;
            const poem = ROMANTIC_POEMS[this.activePoemIdx];
            this.poemBubbles.scholar.text.textContent = poem.a;
            this.poemBubbles.scholar.visible = true;
            this.poemBubbles.maiden.visible = false;
          }
        } else if (this.poemState === 'verse1') {
          this.poemTimer += dt;
          if (this.poemTimer >= 2.15) {
            this.poemState = 'verse2';
            this.poemTimer = 0;
            const poem = ROMANTIC_POEMS[this.activePoemIdx];
            this.poemBubbles.maiden.text.textContent = poem.b;
            this.poemBubbles.maiden.visible = true;
          }
        } else if (this.poemState === 'verse2') {
          this.poemTimer += dt;
          if (this.poemTimer >= 3.1) {
            this.poemBubbles.scholar.visible = false;
            this.poemBubbles.maiden.visible = false;
            bScholar.targetLookYaw = 0;
            bMaiden.targetLookYaw = 0;
            this.poemState = 'departing';
            this.poemTimer = 0;
          }
        } else if (this.poemState === 'departing') {
          this.poemTimer += dt;
          const k = Math.min(1, this.poemTimer / 2.0);
          const sf = k * k * (3 - 2 * k);
          bScholar.speedFactor = sf;
          bMaiden.speedFactor = sf;
          if (k >= 1) {
            bScholar.speedFactor = 1;
            bMaiden.speedFactor = 1;
            this.poemState = 'cruising';
            this.poemCooldown = 14;
          }
        }
      }

      for (const b of boats) {
        const r = this.world.moatChannelR(b.th, b.rOff, 1.2);
        const px = Math.cos(b.th) * r;
        const pz = Math.sin(b.th) * r;
        const stepAngle = dt * b.speed * b.speedFactor;
        b.th += stepAngle;
        const r2 = this.world.moatChannelR(b.th, b.rOff, 1.2);
        const nx = Math.cos(b.th) * r2;
        const nz = Math.sin(b.th) * r2;
        const boatY = wy - 0.03 + Math.sin(t * 1.4 + b.bob) * 0.014;
        b.g.position.set(nx, boatY, nz);
        if (Math.abs(stepAngle) > 1e-6) {
          b.g.rotation.y = Math.atan2(nx - px, nz - pz);
        }
        b.g.rotation.z = Math.sin(t * 1.1 + b.bob) * 0.025;

        // 划桨周期与船速同步；停船对诗时木桨温柔停歇
        b.rowPhase += dt * 2.1 * (0.15 + 0.85 * b.speedFactor);
        const rowAmp = THREE.MathUtils.lerp(0.06, 1.0, b.speedFactor);

        const oar = b.g.userData.oar as THREE.Object3D | undefined;
        if (oar) {
          oar.rotation.y = Math.sin(b.rowPhase) * 0.32 * rowAmp;
          oar.rotation.x = Math.cos(b.rowPhase) * 0.14 * rowAmp;
        }

        const manUpper = b.g.userData.manUpper as THREE.Object3D | undefined;
        if (manUpper) {
          manUpper.rotation.x = Math.cos(b.rowPhase) * 0.12 * rowAmp;
          manUpper.rotation.y = Math.sin(b.rowPhase) * 0.14 * rowAmp;
        }

        // 实时将船夫双手对准木桨握柄双握点
        const handleTarget = b.g.userData.handleTarget as THREE.Object3D | undefined;
        const handleForeTarget = b.g.userData.handleForeTarget as THREE.Object3D | undefined;
        const manLeftArm = b.g.userData.manLeftArm as THREE.Object3D | undefined;
        const manRightArm = b.g.userData.manRightArm as THREE.Object3D | undefined;
        if (handleTarget && handleForeTarget && manLeftArm && manRightArm) {
          b.g.updateMatrixWorld(true);
          handleTarget.getWorldPosition(_scratchHandleRear);
          handleForeTarget.getWorldPosition(_scratchHandleFore);
          manLeftArm.lookAt(_scratchHandleRear);
          manRightArm.lookAt(_scratchHandleFore);
        }

        b.currentLookYaw = THREE.MathUtils.lerp(
          b.currentLookYaw,
          b.targetLookYaw,
          1 - Math.exp(-3.5 * dt),
        );
        const passenger = b.g.userData.passenger as THREE.Object3D | undefined;
        if (passenger) {
          passenger.rotation.y = -0.16 + b.currentLookYaw * 0.55 + Math.sin(t * 0.9 + b.bob) * 0.08;
        }
        const passengerHead = b.g.userData.passengerHead as THREE.Object3D | undefined;
        if (passengerHead) {
          passengerHead.rotation.y = b.currentLookYaw * 0.65;
          passengerHead.rotation.x =
            Math.abs(b.targetLookYaw) > 0.05 ? Math.sin(t * 2.2 + b.bob) * 0.06 + 0.04 : 0;
        }

        const wp = 0.5 + 0.5 * Math.sin(t * 3.8 + b.bob);
        const localWaterOffset = (wy + 0.008 - boatY) / (b.g.scale.y || 1);
        const hullFoam = b.g.userData.hullFoam as THREE.Mesh | undefined;
        if (hullFoam) {
          hullFoam.position.y = localWaterOffset;
          hullFoam.scale.set(0.98 + wp * 0.06 * b.speedFactor, 0.99 + wp * 0.04 * b.speedFactor, 1);
          (hullFoam.material as THREE.MeshBasicMaterial).opacity =
            (0.28 + 0.27 * b.speedFactor) + wp * 0.2 * b.speedFactor;
        }
        const wake = b.g.userData.wake as THREE.Mesh;
        wake.position.y = localWaterOffset;
        wake.scale.set(
          0.86 + wp * 0.16 * b.speedFactor,
          0.9 + wp * 0.22 * b.speedFactor,
          0.3 + 0.7 * b.speedFactor,
        );
        (wake.material as THREE.MeshBasicMaterial).opacity =
          (0.44 + wp * 0.24) * b.speedFactor;
      }
    }

    for (let i = this.anims.length - 1; i >= 0; i--) {
      const a = this.anims[i];
      const k = Math.min((this.timeMs - a.t0) / a.dur, 1);
      a.fn(k);
      if (k >= 1) {
        this.anims.splice(i, 1);
        a.res();
      }
    }

    this.hlRings.forEach((r) => {
      const s = 1 + Math.sin(t * 6) * 0.12;
      r.scale.set(s, s, s);
      const m = r.material as THREE.MeshBasicMaterial;
      m.opacity = 0.7 + Math.sin(t * 6) * 0.3;
      m.transparent = true;
    });

    // Update countdown timer every second
    const showTimer =
      this.deadline !== null &&
      !this.paused &&
      !this.isAI() &&
      (this.phase === 'awaitRoll' || this.phase === 'awaitMove');
    const sec = showTimer
      ? Math.max(0, Math.ceil((this.deadline! - this.timeMs) / 1000))
      : -1;
    if (sec !== this.lastSec) {
      this.lastSec = sec;
      this.emitSnapshot();
    }

    this.updateCameraRig(dt);
    this.controls.update();
    this.controls.target.x = THREE.MathUtils.clamp(this.controls.target.x, -14, 14);
    this.controls.target.y = THREE.MathUtils.clamp(this.controls.target.y, -0.3, 2.5);
    this.controls.target.z = THREE.MathUtils.clamp(this.controls.target.z, -14, 14);

    this.updatePoemBubbles();
  }

  private updatePoemBubbles(): void {
    const boats = this.world.boats;
    if (boats.length < 2) return;
    this.camera.updateMatrixWorld();
    const w = window.innerWidth;
    const h = window.innerHeight;

    const projectBubble = (
      boat: (typeof boats)[number],
      bubble: { root: HTMLDivElement; visible: boolean },
    ) => {
      if (!bubble.visible || this.paused) {
        bubble.root.style.opacity = '0';
        return;
      }
      _scratchBoatAnchor.set(0, 0.72, 0.22).applyMatrix4(boat.g.matrixWorld);
      _scratchProj.copy(_scratchBoatAnchor).project(this.camera);
      if (_scratchProj.z > 1 || _scratchProj.z < -1) {
        bubble.root.style.opacity = '0';
        return;
      }
      const sx = THREE.MathUtils.clamp((_scratchProj.x * 0.5 + 0.5) * w, 86, w - 86);
      const sy = THREE.MathUtils.clamp((-_scratchProj.y * 0.5 + 0.5) * h, 64, h - 40);
      bubble.root.style.transform = `translate3d(${sx.toFixed(1)}px, ${sy.toFixed(1)}px, 0) translate(-50%, -100%)`;
      bubble.root.style.opacity = '1';
    };

    projectBubble(boats[0], this.poemBubbles.scholar);
    projectBubble(boats[1], this.poemBubbles.maiden);
  }

  private updateCameraRig(dt: number): void {
    if (this.camUserInteracting || new URLSearchParams(window.location.search).has('closeup')) {
      return;
    }

    if (this.camFollowPlane && this.camMode === 'follow') {
      const targetObj = this.camFollowObj ?? this.camFollowPlane.mesh;
      const pos = targetObj.position;
      const home = this.getHomeCameraPose();
      _scratchCamOffset.copy(this.camera.position).sub(this.controls.target);
      _scratchCamSpherical.setFromVector3(_scratchCamOffset);
      this.camGoalTarget.set(
        pos.x,
        0.25 + Math.min(Math.max(pos.y - 0.12, 0) * 0.55, 1.1),
        pos.z,
      );
      this.camGoalSpherical.set(
        THREE.MathUtils.clamp(home.radius * 0.48, 6.8, 9.2),
        0.94,
        _scratchCamSpherical.theta,
      );
      this.camGoalActive = true;
    }

    if (!this.camGoalActive) return;

    const rate = this.camMode === 'follow' && this.camFollowPlane ? 7.0 : 3.8;
    const alpha = 1 - Math.exp(-rate * Math.min(dt, 0.1));
    this.controls.target.lerp(this.camGoalTarget, alpha);

    _scratchCamOffset.copy(this.camera.position).sub(this.controls.target);
    _scratchCamSpherical.setFromVector3(_scratchCamOffset);

    let dTheta = this.camGoalSpherical.theta - _scratchCamSpherical.theta;
    while (dTheta > Math.PI) dTheta -= Math.PI * 2;
    while (dTheta < -Math.PI) dTheta += Math.PI * 2;

    _scratchCamSpherical.theta += dTheta * alpha;
    _scratchCamSpherical.phi = THREE.MathUtils.lerp(
      _scratchCamSpherical.phi,
      this.camGoalSpherical.phi,
      alpha,
    );
    _scratchCamSpherical.radius = THREE.MathUtils.lerp(
      _scratchCamSpherical.radius,
      this.camGoalSpherical.radius,
      alpha,
    );

    _scratchCamPos.setFromSpherical(_scratchCamSpherical).add(this.controls.target);
    this.camera.position.copy(_scratchCamPos);

    const settled =
      !this.camFollowPlane &&
      this.controls.target.distanceToSquared(this.camGoalTarget) < 0.0004 &&
      Math.abs(dTheta) < 0.004 &&
      Math.abs(this.camGoalSpherical.phi - _scratchCamSpherical.phi) < 0.004 &&
      Math.abs(this.camGoalSpherical.radius - _scratchCamSpherical.radius) < 0.02;

    if (settled) {
      this.controls.target.copy(this.camGoalTarget);
      _scratchCamOffset.setFromSpherical(this.camGoalSpherical);
      this.camera.position.copy(this.controls.target).add(_scratchCamOffset);
      this.camGoalActive = false;
    }
  }

  public dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    cancelAnimationFrame(this.frameId);
    window.clearTimeout(this.frameId);
    cancelAnimationFrame(this.splashRaf);
    if (this.msgTimer !== null) window.clearTimeout(this.msgTimer);
    if (this.splashTimer !== null) window.clearTimeout(this.splashTimer);

    window.removeEventListener('resize', this.boundResize);
    this.controls.removeEventListener('start', this.boundControlsStart);
    this.controls.removeEventListener('end', this.boundControlsEnd);
    this.renderer.domElement.removeEventListener('pointerdown', this.boundPointerDown);
    this.renderer.domElement.removeEventListener('pointermove', this.boundPointerMove);
    this.renderer.domElement.removeEventListener('pointerup', this.boundPointerUp);
    this.renderer.domElement.removeEventListener('webglcontextlost', this.boundContextLost);
    this.renderer.domElement.removeEventListener(
      'webglcontextrestored',
      this.boundContextRestored,
    );

    this.clearHL();
    this.controls.dispose();
    this.envRT.dispose();

    this.scene.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (mesh.geometry) mesh.geometry.dispose();
      if (mesh.material) {
        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        for (const m of mats) {
          const std = m as THREE.MeshStandardMaterial;
          if (std.map) std.map.dispose();
          m.dispose();
        }
      }
    });

    this.renderer.dispose();
    if (this.renderer.domElement.parentNode === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
    if (this.poemLayer.parentNode === this.container) {
      this.container.removeChild(this.poemLayer);
    }
  }
}
