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
  STACK_OFF,
  SeatConfig,
  lineOf,
  toColorHex,
} from './constants';
import {
  PlaneData,
  PlaneParts,
  buildCampFrames,
  buildDiceRig,
  buildPickHints,
  buildPlaneMesh,
  buildTurnArrow,
  makePlaneModel,
} from './pieces';
import { WorldRefs, buildAncientWorld } from './world';

const TIMEOUT = 30000;
const rnd = (a: number, b: number) => a + Math.random() * (b - a);
const lerpAngle = (a: number, b: number, t: number) =>
  a + Math.atan2(Math.sin(b - a), Math.cos(b - a)) * t;

const _scratchDiceScale = new THREE.Vector3();
const _scratchCamOffset = new THREE.Vector3();
const _scratchCamSpherical = new THREE.Spherical();
const _scratchCamPos = new THREE.Vector3();

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
  private campFrames: THREE.Group[];
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
  private camMode: CameraMode = 'free';
  private camGoalActive = false;
  private camGoalTarget = new THREE.Vector3(0, 0.06, 1.15);
  private camGoalSpherical = new THREE.Spherical(16.4, 0.96, 0.18);
  private camFollowPlane: PlaneData | null = null;
  private camFollowObj: THREE.Object3D | null = null;
  private camUserInteracting = false;
  private winnerPid: number | null = null;
  private lastSec = -1;

  private message: string | null = null;
  private messageColor: string | null = null;
  private messageKey = 0;
  private msgTimer: number | null = null;
  private splashText: string | null = null;
  private splashAvatar = '🐼';
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
    this.scene.background = new THREE.Color(0xe6d6bc);
    this.scene.fog = new THREE.Fog(0xe6d6bc, 36, 78);

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
      130,
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
    this.controls.maxDistance = 32;
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
    this.campFrames = buildCampFrames(this.scene);
    this.turnArrow = buildTurnArrow(this.scene);

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
    const q = slotId;
    const BASE_YAWS = [Math.PI / 2, 0, -Math.PI / 2, Math.PI];
    const rotCW = ([x, z]: Point2D, qq: number): Point2D => {
      if (qq === 0) return [x, z];
      if (qq === 1) return [-z, x];
      if (qq === 2) return [-x, -z];
      return [z, -x];
    };
    return {
      slotId: q,
      start: q * 13,
      court: rotCW([-5.68, -5.68], q),
      launch: rotCW([-7.08, -3.28], q),
      gate: rotCW([-6.85, -3.77], q),
      gateAxis: (q % 2 === 0 ? 'z' : 'x') as 'x' | 'z',
      home: (
        [
          [-5.26, 0],
          [-4.4, 0],
          [-3.54, 0],
          [-2.68, 0],
          [-1.82, 0],
        ] as Point2D[]
      ).map((p) => rotCW(p, q)),
      final: rotCW([-0.86, 0], q),
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
    };
  }

  private fitOrientation(): void {
    const portrait = window.innerHeight > window.innerWidth;
    this.camera.fov = portrait ? 54 : 47;
    if (this.scene.fog instanceof THREE.Fog) {
      this.scene.fog.near = portrait ? 40 : 34;
      this.scene.fog.far = portrait ? 86 : 74;
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
      const radius = THREE.MathUtils.clamp(20.6 / Math.max(0.55, aspect * 1.12), 18.2, 24.0);
      return { radius, phi: 0.9, targetPull: 1.15 };
    }
    const radius = aspect < 1.35 ? 17.8 : 16.4;
    return { radius, phi: 0.96, targetPull: 1.45 };
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
      THREE.MathUtils.clamp(radius, 5.5, 32),
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

  private setMsg(t: string, color?: string | null, duration = 2400): void {
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
    this.campFrames.forEach((f, j) => {
      const pl = this.slotPlayer(j);
      const on = !!pl && this.turn === this.players.indexOf(pl) && this.phase !== 'over';
      f.visible = on;
      if (on && pl) {
        const c = pl.type === 'ai' ? 0xe23b2e : pl.color;
        (f.userData.mat as THREE.MeshStandardMaterial).color.setHex(c);
        (f.userData.mat as THREE.MeshStandardMaterial).emissive.setHex(c);
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
      splashColor: this.splashColor,
      splashVisible: this.splashVisible,
      shakeKey: this.shakeKey,
      winnerPid: this.winnerPid,
      players: this.players.map((pl, i) => ({
        name: pl.name,
        species: pl.species,
        type: pl.type,
        colorHex: toColorHex(pl.color),
        uiColor: pl.uiColor,
        doneCount: this.planesOf(i).filter((p) => p.pos === HOME_END).length,
        active: this.turn === i && this.phase !== 'over' && P !== undefined,
      })),
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
    if (this.phase === 'awaitMove' && !this.isAI() && this.movable[idx] && this.die !== null) {
      ensureAudio();
      this.performMove(this.movable[idx].plane, this.die);
    }
  }

  public togglePause(): void {
    if (this.phase === 'over' || this.phase === 'idle') return;
    this.paused = !this.paused;
    this.emitSnapshot();
  }

  public setCamMode(mode: CameraMode): void {
    this.camMode = mode;
    if (mode !== 'follow') {
      this.camFollowPlane = null;
      this.camFollowObj = null;
    }
    this.resetView();
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

  private relayout(): void {
    const groups: Record<string, PlaneData[]> = {};
    this.planes.forEach((p) => {
      if (!p.animating) {
        const k = this.cellKey(p);
        (groups[k] = groups[k] || []).push(p);
      }
    });
    for (const k in groups) {
      groups[k].forEach((p, i) => {
        const off = STACK_OFF[Math.min(i, STACK_OFF.length - 1)];
        let x: number;
        let z: number;
        let yaw: number;
        if (p.pos === -1) {
          const b = this.players[p.pid].base[p.idx];
          x = b[0];
          z = b[1];
          yaw = Math.atan2(-x, -z + 2);
        } else {
          const c = this.posToCell(this.players[p.pid], p.pos);
          x = c[0] + off[0];
          z = c[1] + off[1];
          yaw = p.pos === HOME_END ? this.players[p.pid].finalYaw : this.faceTravelDir(p);
        }
        p.mesh.position.set(x, 0.12, z);
        p.mesh.rotation.y = yaw;
      });
    }
  }

  /* ================= Highlighting ================= */
  private highlight(list: { plane: PlaneData }[]): void {
    this.clearHL();
    list.forEach((c, i) => {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(0.5, 0.06, 8, 28),
        new THREE.MeshBasicMaterial({ color: 0x3aa66b }),
      );
      ring.rotation.x = -Math.PI / 2;
      c.plane.mesh.add(ring);
      ring.position.set(0, -0.02, 0);
      this.hlRings.push(ring);
      if (this.pickHints[i]) {
        this.pickHints[i].visible = true;
        this.pickHints[i].position.set(
          c.plane.mesh.position.x,
          1.55,
          c.plane.mesh.position.z,
        );
      }
    });
  }

  private clearHL(): void {
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
        if (p.pos === -1) return die === 6;
        return true;
      })
      .map((plane) => ({ plane }));
  }

  private async animDice(die: number): Promise<void> {
    sndRoll();
    this.hudDieRolling = true;
    this.emitSnapshot();
    const rx = Math.random() * 8 - 4;
    const rz = Math.random() * 8 - 4;
    let lastHudTick = 0;
    await this.tween(840, (t) => {
      this.diceRig.dice.rotation.x = t * Math.PI * 4 + rx;
      this.diceRig.dice.rotation.y = t * Math.PI * 2.6;
      this.diceRig.dice.rotation.z = t * Math.PI * 3.2 + rz;
      this.diceRig.dice.position.y = 3.8 + Math.sin(t * Math.PI) * 1.15;
      if (t - lastHudTick > 0.12) {
        lastHudTick = t;
        this.hudDieFace = 1 + Math.floor(Math.random() * 6);
        this.emitSnapshot();
      }
    });
    if (this.disposed) return;
    this.hudDieRolling = false;
    this.diceRig.dice.rotation.set(...ORIENT[die]);
    this.diceRig.dice.position.y = 3.8;
    this.hudDieFace = die;
    this.hudDiePopKey++;
    this.emitSnapshot();
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

    const die = 1 + Math.floor(Math.random() * 6);
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
      await this.sleep(1400);
      if (!this.disposed) this.endTurn(die === 6);
      return;
    }
    if (this.isAI()) {
      this.emitSnapshot();
      await this.sleep(1100);
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
  ): Promise<void> {
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
      m.position.y = sy + Math.sin(t * Math.PI) * arc;
      m.rotation.y = lerpAngle(syaw, yaw, t);
      const air = Math.sin(t * Math.PI);
      const sq = t < 0.15 ? (1 - t / 0.15) * 0.12 : t > 0.85 ? ((t - 0.85) / 0.15) * 0.12 : 0;
      const syScale = 1 + air * 0.09 - sq;
      const sxScale = 1 / Math.sqrt(syScale);
      pt.animRoot.scale.set(sxScale, syScale, sxScale);
      pt.animRoot.rotation.x = air * 0.16;
      pt.leftArm.rotation.z = 0.35 + air * 0.9;
      pt.rightArm.rotation.z = -0.35 - air * 0.9;
      pt.leftFoot.rotation.x = stepSign * air * 0.55;
      pt.rightFoot.rotation.x = -stepSign * air * 0.55;
      pt.headPivot.rotation.x = air * 0.12;
    });
    m.position.set(x, 0.12, z);
    m.rotation.y = yaw;
    pt.animRoot.scale.set(1, 1, 1);
    pt.animRoot.rotation.set(0, 0, 0);
    pt.leftArm.rotation.set(0, 0, 0);
    pt.rightArm.rotation.set(0, 0, 0);
    pt.leftFoot.rotation.set(0, 0, 0);
    pt.rightFoot.rotation.set(0, 0, 0);
    pt.headPivot.rotation.set(0, 0, 0);
    plane.animating = false;
  }

  private async celebrateGoal(plane: PlaneData): Promise<void> {
    plane.animating = true;
    const m = plane.mesh;
    const pt = m.userData.parts as PlaneParts;
    const baseYaw = this.players[plane.pid].finalYaw;
    this.spawnImpact(m.position.x, m.position.z);
    await this.tween(820, (t) => {
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

    await this.tween(780, (k) => {
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
    m.position.set(x, 0.12, z);
    m.rotation.set(0, 0, 0);
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
    color: number,
    dur: number,
  ): Promise<void> {
    const yaw = Math.atan2(cTo[0] - cFrom[0], cTo[1] - cFrom[1]);
    const flyers = stack.map((p, i) => {
      const off = STACK_OFF[Math.min(i, STACK_OFF.length - 1)];
      p.animating = true;
      const fp = makePlaneModel(color);
      const sx = cFrom[0] + off[0];
      const sz = cFrom[1] + off[1];
      const tx = cTo[0] + off[0];
      const tz = cTo[1] + off[1];
      fp.position.set(sx, 0.12, sz);
      fp.rotation.y = yaw;
      p.mesh.visible = false;
      this.scene.add(fp);
      return { p, fp, sx, sz, tx, tz };
    });

    const prevFollowObj = this.camFollowObj;
    if (
      this.camMode === 'follow' &&
      this.camFollowPlane &&
      stack.includes(this.camFollowPlane) &&
      flyers[0]
    ) {
      this.camFollowObj = flyers[0].fp;
    }

    await this.tween(dur, (k) => {
      for (const f of flyers) {
        f.fp.position.x = f.sx + (f.tx - f.sx) * k;
        f.fp.position.z = f.sz + (f.tz - f.sz) * k;
        f.fp.position.y = 0.12 + Math.sin(k * Math.PI) * 2.0;
        f.fp.rotation.y = yaw;
        f.fp.rotation.x = -Math.sin(k * Math.PI) * 0.35;
      }
    });

    for (const f of flyers) {
      this.scene.remove(f.fp);
      f.p.mesh.visible = true;
      f.p.mesh.position.set(f.tx, 0.12, f.tz);
      f.p.mesh.rotation.y = yaw;
      f.p.animating = false;
    }
    if (this.camFollowPlane) {
      this.camFollowObj = this.camFollowPlane.mesh;
    } else {
      this.camFollowObj = prevFollowObj;
    }
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
    const victims = this.planes.filter((q) => q.pid === oppPid && q.pos === 53);
    if (!victims.length) return;
    sndCap();
    this.setMsg(`💥 飞越航线，击落 ${oppPlayer.name} 航道敌机！`);
    const c = this.posToCell(oppPlayer, 53);
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
    if (this.camMode === 'follow' && !this.camUserInteracting) {
      this.camFollowPlane = plane;
      this.camFollowObj = plane.mesh;
    }
    this.emitSnapshot();

    const P = this.players[plane.pid];
    const stack =
      plane.pos === -1 || plane.pos === 0
        ? [plane]
        : this.planesOf(plane.pid).filter(
            (p) => p.pos === plane.pos && p.pos !== HOME_END,
          );
    const sync = (fn: (p: PlaneData, o: Point2D) => Promise<void>) =>
      Promise.all(
        stack.map((p, i) => fn(p, STACK_OFF[Math.min(i, STACK_OFF.length - 1)])),
      );
    const setPos = (v: number) => stack.forEach((p) => (p.pos = v));
    const hopAll = (c: Point2D, yaw: number, arc: number, dur: number, sign: number) =>
      sync((p, o) => this.hopTo(p, c[0] + o[0], c[1] + o[1], yaw, arc, dur, sign));

    if (plane.pos === -1) {
      setPos(0);
      const c = this.posToCell(P, 0);
      const used = Math.min(
        this.planesOf(plane.pid).filter((p) => p !== plane && p.pos === 0).length,
        STACK_OFF.length - 1,
      );
      const o = STACK_OFF[used];
      this.setMsg('✈️ 登上 START 起点台！');
      beep(660, 0.12, 'triangle', 0.14);
      await this.hopTo(
        plane,
        c[0] + o[0],
        c[1] + o[1],
        this.faceTravelDir(plane),
        0.95,
        440,
        1,
      );
    } else {
      let curStep = plane.pos;
      let dir = 1;
      for (let i = 0; i < die; i++) {
        if (curStep === HOME_END) dir = -1;
        curStep += dir;
        setPos(curStep);
        const c = this.posToCell(P, curStep);
        const yaw = curStep === HOME_END ? P.finalYaw : this.faceTravelDir(plane);
        sndHop();
        await hopAll(c, yaw, 0.5, 220, i % 2 === 0 ? 1 : -1);
        if (this.disposed) return;
      }
      if (dir === -1) {
        this.setMsg(`↩️ 点数超出，回弹至航道第 ${curStep - 50} 格`);
      }
      await this.captureAt(plane);

      if (plane.pos >= 1 && plane.pos <= 49 && plane.pos % 4 === 2) {
        if (plane.pos === FLIGHT_FROM) {
          this.setMsg('🌀 踏上飞行航线，直飞对面！');
          sndCap();
          const cFrom = this.posToCell(P, plane.pos);
          setPos(plane.pos + FLIGHT_STEP);
          const cTo = this.posToCell(P, plane.pos);
          await Promise.all([
            this.flyAsPlane(stack, cFrom, cTo, lineOf(P), 1250),
            new Promise<void>((res) =>
              this.after(550, () => {
                this.captureFlyCross(plane.pid).then(res);
              }),
            ),
          ]);
          await this.captureAt(plane);
          this.setMsg('⚡ 同色顺风再跳 4 格！');
          beep(540, 0.12, 'triangle', 0.14);
          setPos(plane.pos + 4);
          await hopAll(
            this.posToCell(P, plane.pos),
            this.faceTravelDir(plane),
            1.15,
            400,
            1,
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
            400,
            1,
          );
          await this.captureAt(plane);
          if (plane.pos === FLIGHT_FROM) {
            this.setMsg('🌀 连跳触发飞行航线，直飞对面！');
            sndCap();
            const cFrom = this.posToCell(P, plane.pos);
            setPos(plane.pos + FLIGHT_STEP);
            const cTo = this.posToCell(P, plane.pos);
            await Promise.all([
              this.flyAsPlane(stack, cFrom, cTo, lineOf(P), 1250),
              new Promise<void>((res) =>
                this.after(550, () => {
                  this.captureFlyCross(plane.pid).then(res);
                }),
              ),
            ]);
            await this.captureAt(plane);
          }
        }
      }
    }

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
    if (this.disposed) return;
    if (plane.pos === HOME_END) {
      beep(784, 0.2, 'triangle', 0.16);
      this.setMsg('🏁 一架飞机到达终点！');
      await Promise.all(stack.map((p) => this.celebrateGoal(p)));
    }
    this.relayout();
    this.emitSnapshot();
    if (this.planesOf(plane.pid).every((p) => p.pos === HOME_END)) {
      this.showWin(plane.pid);
      return;
    }
    this.endTurn(die === 6 || plane.pos === HOME_END);
  }

  private endTurn(again: boolean): void {
    if (this.phase === 'over' || this.disposed) return;
    if (again && this.sixChain < 3) {
      this.setMsg('🎲 奖励再掷一次！');
      this.beginRollPhase(true);
      return;
    }
    this.turn = (this.turn + 1) % this.players.length;
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
        home.tx * 0.72 + P.court[0] * 0.24,
        home.ty,
        home.tz * 0.72 + P.court[1] * 0.24,
        home.radius * 0.94,
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
      this.after(1500, () => this.doRoll());
    } else {
      this.phase = 'awaitRoll';
      this.deadline = this.timeMs + TIMEOUT;
      sndYourTurn();
      this.showTurnSplash(this.cur(), isBonus);
    }
  }

  /* ================= AI Decision ================= */
  private landingOf(p: PlaneData, die: number) {
    if (p.pos === -1) return { pos: 0, jump: false, fly: false, bounced: false };
    let np = p.pos + die;
    let bounced = false;
    if (np > HOME_END) {
      np = HOME_END - (np - HOME_END);
      bounced = true;
    }
    if (np === HOME_END) return { pos: HOME_END, jump: false, fly: false, bounced };
    let jump = false;
    let fly = false;
    if (!bounced && np >= 1 && np <= 49 && np % 4 === 2) {
      if (np === FLIGHT_FROM) {
        fly = true;
        jump = true;
        np = FLIGHT_FROM + FLIGHT_STEP + 4;
      } else {
        jump = true;
        np += 4;
        if (np === FLIGHT_FROM) {
          fly = true;
          np = FLIGHT_FROM + FLIGHT_STEP;
        }
      }
    }
    return { pos: np, jump, fly, bounced };
  }

  private aiPick(cands: { plane: PlaneData }[]) {
    const me = this.turn;
    const die = this.die ?? 1;
    let best = cands[0];
    let bs = -1e9;
    for (const c of cands) {
      const p = c.plane;
      let s = p.pos;
      const L = this.landingOf(p, die);
      const np = L.pos;
      if (np === HOME_END) s += 120;
      if (p.pos === -1) s += 45;
      if (L.fly) s += 28;
      if (L.jump) s += 10;
      if (L.bounced) s -= 12;
      if (np >= 1 && np <= 50) {
        const r = (this.players[me].start + 2 + np) % 52;
        let cap = 0;
        let threat = 0;
        for (const q of this.planes) {
          if (q.pid === me || q.pos < 1 || q.pos > 50) continue;
          const qr = this.ringIndexOf(q);
          if (qr === r) cap++;
          const d = (r - qr + 52) % 52;
          if (d >= 1 && d <= 6) threat++;
        }
        s += cap * 55 - threat * 18;
      } else if (np >= 51) {
        s += 16;
      }
      if (L.fly) {
        const opp = this.slotPlayer((this.players[me].slotId + 2) % 4);
        if (
          opp &&
          this.planesOf(this.players.indexOf(opp)).some((q) => q.pos === 53)
        ) {
          s += 65;
        }
      }
      s += Math.random() * 4;
      if (s > bs) {
        bs = s;
        best = c;
      }
    }
    return best;
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
          const ex = t * 5.5 + p.phase;
          p.mesh.scale.setScalar(baseScale * (1 + 0.06 * Math.sin(ex)));
          pt.animRoot.position.y = Math.abs(Math.sin(ex)) * 0.07;
          pt.leftArm.rotation.z = 0.85 + Math.sin(ex * 1.5) * 0.35;
          pt.rightArm.rotation.z = -0.85 - Math.sin(ex * 1.5) * 0.35;
          pt.headPivot.rotation.x = Math.sin(ex) * 0.08;
          pt.headPivot.rotation.z = Math.sin(ex * 0.5) * 0.07;
        } else {
          const idle = t * 2.0 + p.phase;
          const br = Math.sin(idle);
          p.mesh.scale.setScalar(baseScale);
          pt.animRoot.position.y = 0;
          pt.animRoot.rotation.z = 0;
          pt.animRoot.scale.set(1 - br * 0.015, 1 + br * 0.025, 1 - br * 0.015);
          pt.headPivot.rotation.z = Math.sin(t * 0.9 + p.phase) * 0.065;
          pt.headPivot.rotation.y = p.pos >= 0 ? Math.sin(t * 0.65 + p.phase) * 0.16 : 0;
          pt.headPivot.rotation.x = br * 0.025;
          pt.leftArm.rotation.z = 0.05 + br * 0.06;
          pt.rightArm.rotation.z = -0.05 - br * 0.06;
        }
      });

      this.world.moatTex.offset.x += dt * 0.025;
      this.world.moatTex.offset.y += dt * 0.014;
      const wAttr = this.world.waterMesh.geometry.attributes.position as THREE.BufferAttribute;
      const basePos = this.world.waterMesh.userData.basePos as Float32Array;
      for (let i = 0; i < wAttr.count; i++) {
        const bx = basePos[i * 3];
        const bz = basePos[i * 3 + 2];
        wAttr.setY(
          i,
          -0.5 + Math.sin(bx * 0.55 + t * 1.6) * 0.012 + Math.cos(bz * 0.55 + t * 1.3) * 0.012,
        );
      }
      wAttr.needsUpdate = true;

      for (const l of this.world.lotusList) {
        l.g.position.y = -0.49 + Math.sin(t * 1.6 + l.phase) * 0.014;
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
        if (p.m.position.y < -0.64) {
          p.m.position.y = rnd(2.8, 4.6);
          p.m.position.x = Math.cos(p.ang) * p.baseR;
          p.m.position.z = Math.sin(p.ang) * p.baseR;
        }
      }
      for (const k of this.world.swimKois) {
        const r = this.world.moatMid(k.th) + k.rOff;
        const px = Math.cos(k.th) * r;
        const pz = Math.sin(k.th) * r;
        k.th += dt * k.speed;
        const r2 = this.world.moatMid(k.th) + k.rOff;
        const nx = Math.cos(k.th) * r2;
        const nz = Math.sin(k.th) * r2;
        k.g.position.set(nx, -0.57 + Math.sin(t * 2.4 + k.phase) * 0.015, nz);
        k.g.rotation.y = Math.atan2(nx - px, nz - pz);
        (k.g.userData.tail as THREE.Group).rotation.y = Math.sin(t * 10 + k.phase) * 0.42;
      }
      for (const d of this.world.moatDucks) {
        const r = this.world.moatMid(d.th) + d.rOff;
        const px = Math.cos(d.th) * r;
        const pz = Math.sin(d.th) * r;
        d.th += dt * d.speed;
        const r2 = this.world.moatMid(d.th) + d.rOff;
        const nx = Math.cos(d.th) * r2;
        const nz = Math.sin(d.th) * r2;
        d.g.position.set(nx, -0.5 + Math.sin(t * 2 + d.bob) * 0.015, nz);
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
        this.phase === 'awaitRoll' && !this.isAI() && this.diceHovered ? 1.52 : 1.35;
      _scratchDiceScale.set(targetDiceScale, targetDiceScale, targetDiceScale);
      this.diceRig.dice.scale.lerp(_scratchDiceScale, Math.min(1, dt * 12));

      if (this.diceRig.diceHint.visible) {
        const br = 0.5 + 0.5 * Math.sin(t * 2.6);
        (this.diceRig.dhGlow.material as THREE.MeshBasicMaterial).opacity =
          (this.diceHovered ? 0.22 : 0.08) + br * 0.14;
        this.diceRig.dhGlow.scale.setScalar(1 + br * 0.12);
        (this.diceRig.dhRingH.material as THREE.MeshBasicMaterial).opacity = 0.35 + br * 0.5;
        (this.diceRig.dhRingV.material as THREE.MeshBasicMaterial).opacity = 0.35 + br * 0.5;
        this.diceRig.dhRingV.rotation.y += dt * 1.2;
        this.diceRig.dhSparks.forEach((s) => {
          const u = s.userData as { a: number; sp: number; r: number; ph: number };
          u.a += dt * u.sp;
          s.position.set(
            Math.cos(u.a) * u.r,
            Math.sin(t * 1.8 + u.ph) * 0.55,
            Math.sin(u.a) * u.r,
          );
        });
        this.diceRig.diceMaterials.forEach((m) => {
          m.emissive.setHex(0xcc8a00);
          m.emissiveIntensity = (this.diceHovered ? 0.35 : 0.15) + br * 0.35;
        });
      } else {
        this.diceRig.diceMaterials.forEach((m) => {
          m.emissiveIntensity = 0;
        });
      }

      this.campFrames.forEach((f) => {
        if (f.visible) {
          (f.userData.mat as THREE.MeshStandardMaterial).emissiveIntensity =
            0.45 + 0.35 * Math.sin(t * 3.2);
        }
      });

      const hd = this.diceRig.dice.position.y - 2.8;
      (this.diceRig.diceShadow.material as THREE.MeshBasicMaterial).opacity = 0.3 - 0.06 * hd;
      this.diceRig.diceShadow.scale.setScalar(1 + 0.08 * hd);

      for (let i = this.world.critters.length - 1; i >= 0; i--) {
        const c = this.world.critters[i];
        c.ttl -= dt;
        if (c.ttl <= 0) {
          this.scene.remove(c.g);
          this.world.critters.splice(i, 1);
          continue;
        }
        if (c.kind === 'rabbit') {
          if (c.state === 'rest') {
            c.rest -= dt;
            c.g.scale.set(1, 1, 1);
            if (c.rest <= 0) {
              c.state = 'hop';
              c.hopT = 0;
              const px = c.g.position.x;
              const pz = c.g.position.z;
              c.dir =
                Math.hypot(px, pz) > 34
                  ? Math.atan2(-pz, -px) + (Math.random() - 0.5)
                  : c.dir + Math.random() * 1.8 - 0.9;
              c.g.rotation.y = -c.dir + Math.PI / 2;
            }
          } else {
            c.hopT += dt / c.hopDur;
            if (c.hopT >= 1) {
              c.hopT = 0;
              c.state = 'rest';
              c.rest = 0.3 + Math.random() * 1.2;
              c.g.position.y = -0.66;
            } else {
              const arc = Math.sin(c.hopT * Math.PI);
              c.g.position.x += Math.cos(c.dir) * 2.8 * dt;
              c.g.position.z += Math.sin(c.dir) * 2.8 * dt;
              c.g.position.y = -0.66 + arc * 0.36;
              c.g.scale.set(1 - arc * 0.06, 1 + arc * 0.1, 1 - arc * 0.06);
            }
          }
        } else if (c.kind === 'bird') {
          c.prog += dt / c.dur;
          if (c.prog >= 1) {
            this.scene.remove(c.g);
            this.world.critters.splice(i, 1);
            continue;
          }
          c.g.position.lerpVectors(c.from, c.to, c.prog);
          c.g.position.y += Math.sin(c.prog * 7 + c.flap) * 0.35;
          c.flap += dt * 9;
          const w = Math.sin(c.flap) * 0.55;
          (c.g.userData.lw as THREE.Object3D).rotation.z = w;
          (c.g.userData.rw as THREE.Object3D).rotation.z = -w;
        } else if (c.kind === 'fish') {
          c.prog += dt / 1.15;
          if (c.prog >= 1) {
            this.scene.remove(c.g);
            this.world.critters.splice(i, 1);
            continue;
          }
          c.g.position.y = -0.52 + Math.sin(c.prog * Math.PI) * c.h;
          c.g.rotation.x = -(Math.sin(c.prog * Math.PI) * 1.1 - 0.55);
          c.g.position.x += Math.cos(c.g.rotation.y) * dt * 0.8;
          c.g.position.z += Math.sin(c.g.rotation.y) * dt * 0.8;
          (c.g.userData.tail as THREE.Object3D).rotation.y = Math.sin(t * 18) * 0.5;
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

      for (const b of this.world.boats) {
        const r = this.world.moatMid(b.th);
        const px = Math.cos(b.th) * r;
        const pz = Math.sin(b.th) * r;
        b.th += dt * b.speed;
        const r2 = this.world.moatMid(b.th);
        const nx = Math.cos(b.th) * r2;
        const nz = Math.sin(b.th) * r2;
        b.g.position.set(nx, -0.48 + Math.sin(t * 1.4 + b.bob) * 0.022, nz);
        b.g.rotation.y = Math.atan2(nx - px, nz - pz);
        b.g.rotation.z = Math.sin(t * 1.1 + b.bob) * 0.035;
        (b.g.userData.man as THREE.Object3D).rotation.y = 0.5 + Math.sin(t * 2 + b.bob) * 0.35;
        const wp = 0.5 + 0.5 * Math.sin(t * 4 + b.bob);
        const wake = b.g.userData.wake as THREE.Mesh;
        wake.scale.set(0.9 + wp * 0.2, 1 + wp * 0.25, 1);
        (wake.material as THREE.MeshBasicMaterial).opacity = 0.22 + wp * 0.22;
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
    this.controls.target.x = THREE.MathUtils.clamp(this.controls.target.x, -11, 11);
    this.controls.target.y = THREE.MathUtils.clamp(this.controls.target.y, -0.3, 2.5);
    this.controls.target.z = THREE.MathUtils.clamp(this.controls.target.z, -11, 11);
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
        home.tx * 0.35 + pos.x * 0.65,
        home.ty + Math.min(Math.max(pos.y - 0.12, 0) * 0.35, 0.8),
        home.tz * 0.35 + pos.z * 0.65,
      );
      this.camGoalSpherical.set(
        THREE.MathUtils.clamp(home.radius * 0.78, 5.5, 32),
        0.88,
        _scratchCamSpherical.theta,
      );
      this.camGoalActive = true;
    }

    if (!this.camGoalActive) return;

    const rate = this.camMode === 'follow' && this.camFollowPlane ? 5.2 : 3.8;
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
  }
}
