import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import {
  ensureAudio,
  beep,
  announceKillStreak,
  playWeatherAmbientPulse,
  sndCap,
  sndHop,
  sndRoll,
  sndWin,
  sndYourTurn,
} from './audio';
import {
  AI_PERSONALITIES,
  AI_PERSONALITY_ORDER,
  AiPersonality,
  CHARS,
  CharKey,
  CameraMode,
  FLIGHT_FROM,
  FLIGHT_STEP,
  GIFT_QUEST_ITEM_WEIGHTS,
  GiftQuestEvent,
  GameHudSnapshot,
  GamePhase,
  GraphicsQuality,
  HOME_END,
  HudEmoteEvent,
  KillBannerEvent,
  ITEM_DEFS,
  ITEM_ORDER,
  ItemTargetChoice,
  ItemType,
  MAPS,
  MapConfig,
  MapId,
  ORIENT,
  PlayerConfig,
  PlayerKdaStats,
  PlayerQuestState,
  ProgressStage,
  Point2D,
  RING,
  SEAT_ORDER,
  SHOP_ITEM_WEIGHTS,
  SLOTS,
  SeatConfig,
  TimeOfDay,
  TimeOfDayPreset,
  lineOf,
  toColorHex,
} from './constants';
import {
  CampfireRig,
  DICE_REST_Y,
  HeadFaceParts,
  PlaneData,
  PlaneParts,
  buildCampfireRig,
  buildDiceRig,
  buildPickHints,
  buildPlaneMesh,
  buildToyMissileMesh,
  buildTurnArrow,
  makePilotPlaneModel,
  makePlaneModel,
} from './pieces';
import { createNumberBadgeTexture } from './textures';
import { WorldRefs, buildWorldByMapId } from './world';

const TIMEOUT = 30000;
const STACK_STEP_Y = 0.625;
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
  private readonly mapId: MapId;
  private readonly mapConfig: MapConfig;
  private onSnapshot: (snap: GameHudSnapshot) => void;
  private onContextLostCb?: (lost: boolean) => void;

  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private controls: OrbitControls;
  private envRT: THREE.WebGLRenderTarget;
  private hemiLight!: THREE.HemisphereLight;
  private sunLight!: THREE.DirectionalLight;
  private fillLight!: THREE.DirectionalLight;
  private timeOfDay: TimeOfDay = 'morning';
  private maxDoneStage = 0;
  private todFrom: TimeOfDayPreset;
  private todTo: TimeOfDayPreset;
  private todBlend = 1;
  private _todColA = new THREE.Color();
  private _todColB = new THREE.Color();
  private _todPosA = new THREE.Vector3();
  private _todPosB = new THREE.Vector3();
  private isSoftwareGl: boolean;
  private quality: GraphicsQuality = 'high';
  private frameCounter = 0;
  private shadowInterval = 1;
  private anisotropy: number;

  private players: PlayerConfig[];
  private planes: PlaneData[] = [];
  private world: WorldRefs;
  private diceRig: ReturnType<typeof buildDiceRig>;
  private campfireRig: CampfireRig;
  private campfireBlend = 0;
  private stage4CampfireActive = false;
  private pickHints: THREE.Group[];
  private badgeTexCache = new Map<string, THREE.CanvasTexture>();
  private turnArrow: THREE.Mesh;
  private hlRings: THREE.Mesh[] = [];

  private phase: GamePhase = 'idle';
  private turn = 0;
  private die: number | null = null;
  private twinDice: [number, number] | null = null;
  private twinDiceUsedForRoll = false;
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
  private camFollowCloseup = false;
  private camUserInteracting = false;
  private winnerPid: number | null = null;
  private finishedOrder: number[] = [];
  private gmNextDie: number | null = null;
  private gmAutoPlay = false;
  private lastSec = -1;

  // 道具与任务系统状态
  private shopRingSet = new Set<number>();
  private playerItems: Record<ItemType, number>[] = [];
  private playerQuests: PlayerQuestState[] = [];
  private playerKda: PlayerKdaStats[] = [];
  private turnUsedAtkDef = false;
  private turnUsedDef = false;
  private armedSixDie = false;
  private armedTwinDice = false;
  private armedRefuel = false;
  private refuelCarriedOver = false;
  private pendingExtraRoll = false;
  private suppressSixBonusThisRoll = false;
  private pendingItemTarget: 'shield' | 'missile' | null = null;
  private targetChoices: { plane: PlaneData; stackCount: number }[] = [];
  private shopOffer: ItemType[] | null = null;
  private shopDeadline: number | null = null;
  private shopPid: number | null = null;
  private shopPendingAgain = false;
  private shopPostAction: (() => Promise<void>) | null = null;
  private lastShopSec = -1;
  private itemBusy = false;

  // AI 性格、威胁/记仇系数与拟人化发言状态
  private offenseScores: number[][] = [];
  private playerTurnCount: number[] = [];
  private itemLastGainedTurn: Record<ItemType, number>[] = [];
  private latestEmote: HudEmoteEvent | null = null;
  private giftQuestEvent: GiftQuestEvent | null = null;
  private giftQuestKey = 0;
  private giftQuestTimer: number | null = null;
  private killBanner: KillBannerEvent | null = null;
  private killBannerKey = 0;
  private killBannerTimer: number | null = null;
  private turnStompKills = 0;
  private emoteKeySeq = 0;
  private lastAiEmoteAt: number[] = [];
  private turnSeq = 0;
  private totalCompletedTurns = 0;

  private message: string | null = null;
  private messageColor: string | null = null;
  private messageKey = 0;
  private msgTimer: number | null = null;
  private splashText: string | null = null;
  private splashAvatar = '🐼';
  private splashCharKey: CharKey = 'yier';
  private splashColor = '#3aa66b';
  private splashVisible = false;
  private splashItem: ItemType | null = null;
  private splashKey = 0;
  private splashIsHuman = true;
  private splashActorName: string | null = null;
  private splashDetail: string | null = null;
  private splashTargetCharKey: CharKey | null = null;
  private splashTargetName: string | null = null;
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
  private nextGlobalCakeEatAt = 24 + Math.random() * 18;
  private nextWeatherAudioAt = 4.5;

  private boundResize: () => void;
  private boundPointerDown: (e: PointerEvent) => void;
  private boundPointerMove: (e: PointerEvent) => void;
  private boundPointerUp: (e: PointerEvent) => void;
  private boundContextLost: (e: Event) => void;
  private isContextLost = false;
  private boundContextRestored: () => void;
  private boundVisibilityChange: () => void;
  private boundControlsStart: () => void;
  private boundControlsEnd: () => void;

  constructor(
    container: HTMLElement,
    seats: SeatConfig[],
    autoStart: boolean,
    onSnapshot: (snap: GameHudSnapshot) => void,
    onContextLost?: (lost: boolean) => void,
    onReady?: () => void,
    mapId: MapId = 'ancient_city',
    quality: GraphicsQuality = 'high',
  ) {
    this.container = container;
    this.mapId = mapId;
    this.mapConfig = MAPS[mapId] ?? MAPS.ancient_city;
    this.todFrom = this.mapConfig.timePresets.morning;
    this.todTo = this.mapConfig.timePresets.morning;
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
    const aiSeatsCount = chosen.filter((c) => c.type === 'ai').length;
    const hasExplicitTactician = chosen.some(
      (c) => c.type === 'ai' && c.personality === 'tactician',
    );
    const otherPersonalities = AI_PERSONALITY_ORDER.filter((p) => p !== 'tactician');
    for (let i = otherPersonalities.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [otherPersonalities[i], otherPersonalities[j]] = [
        otherPersonalities[j],
        otherPersonalities[i],
      ];
    }
    const fallbackPersonalities: AiPersonality[] =
      aiSeatsCount > 0 && !hasExplicitTactician
        ? (['tactician', ...otherPersonalities.slice(0, Math.max(0, aiSeatsCount - 1))] as AiPersonality[])
        : ([...otherPersonalities, 'tactician'] as AiPersonality[]).slice(0, Math.max(1, aiSeatsCount));
    for (let i = fallbackPersonalities.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [fallbackPersonalities[i], fallbackPersonalities[j]] = [
        fallbackPersonalities[j],
        fallbackPersonalities[i],
      ];
    }

    let aiSlotCounter = 0;
    this.players = chosen.map((c, i) => ({
      ...CHARS[c.char],
      type: c.type,
      personality:
        c.type === 'ai'
          ? (c.personality ?? fallbackPersonalities[aiSlotCounter++ % fallbackPersonalities.length])
          : undefined,
      ...this.getSlot(slotIndices[i]),
    }));
    // 兜底保证至少 1 位 AI 为精算型
    const aiPlayers = this.players.filter((pl) => pl.type === 'ai');
    if (aiPlayers.length > 0 && !aiPlayers.some((pl) => pl.personality === 'tactician')) {
      aiPlayers[Math.floor(Math.random() * aiPlayers.length)].personality = 'tactician';
    }
    this.offenseScores = this.players.map(() => this.players.map(() => 0));
    this.playerTurnCount = this.players.map(() => 0);
    this.itemLastGainedTurn = this.players.map(() => ({
      sixDie: -99,
      twinDice: -99,
      refuel: -99,
      shield: -99,
      missile: -99,
    }));
    this.lastAiEmoteAt = this.players.map(() => -9999);

    this.isSoftwareGl = detectSoftwareGl();
    this.quality = quality;
    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl && this.quality !== 'low',
      powerPreference: 'high-performance',
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    const maxDpr = this.isSoftwareGl || this.quality === 'low' ? 1 : this.quality === 'medium' ? 1.4 : 2;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, maxDpr));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = this.mapConfig.timePresets.morning.exposure;
    this.renderer.shadowMap.enabled = !this.isSoftwareGl;
    this.renderer.shadowMap.type =
      this.quality === 'high' ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap;
    if (!this.isSoftwareGl && this.quality !== 'high') {
      this.renderer.shadowMap.autoUpdate = false;
      this.renderer.shadowMap.needsUpdate = true;
      this.shadowInterval = this.quality === 'low' ? 4 : 2;
    }
    this.container.appendChild(this.renderer.domElement);

    const maxAniso = this.renderer.capabilities.getMaxAnisotropy();
    this.anisotropy = this.quality === 'high' ? maxAniso : this.quality === 'medium' ? Math.min(8, maxAniso) : Math.min(4, maxAniso);

    this.scene = new THREE.Scene();
    const initTod = this.mapConfig.timePresets.morning;
    this.scene.background = new THREE.Color(initTod.skyBgHex);
    this.scene.fog = new THREE.Fog(initTod.fogHex, initTod.fogNear, initTod.fogFar);

    const pmremGenerator = new THREE.PMREMGenerator(this.renderer);
    const roomEnv = new RoomEnvironment();
    this.envRT = pmremGenerator.fromScene(roomEnv, 0.04);
    this.scene.environment = this.envRT.texture;
    this.scene.environmentIntensity = initTod.envIntensity;
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

    // Lighting rig (driven by Time-of-Day presets: morning -> noon -> afternoon -> evening)
    this.hemiLight = new THREE.HemisphereLight(
      initTod.hemiSkyHex,
      initTod.hemiGroundHex,
      initTod.hemiIntensity,
    );
    this.scene.add(this.hemiLight);
    this.sunLight = new THREE.DirectionalLight(
      initTod.sunColorHex,
      initTod.sunIntensity,
    );
    this.sunLight.position.set(...initTod.sunPosition);
    this.sunLight.castShadow = !this.isSoftwareGl;
    const shadowDim = this.quality === 'high' ? 2048 : this.quality === 'medium' ? 1536 : 1024;
    this.sunLight.shadow.mapSize.set(shadowDim, shadowDim);
    this.sunLight.shadow.camera.left = -13;
    this.sunLight.shadow.camera.right = 13;
    this.sunLight.shadow.camera.top = 13;
    this.sunLight.shadow.camera.bottom = -13;
    this.sunLight.shadow.bias = -0.0004;
    this.scene.add(this.sunLight);

    this.fillLight = new THREE.DirectionalLight(initTod.fillColorHex, initTod.fillIntensity);
    this.fillLight.position.set(-9, 8, -6);
    this.scene.add(this.fillLight);

    // World & Pieces
    this.world = buildWorldByMapId(this.mapId, this.scene, this.players, this.anisotropy);
    this.applyTimeOfDayLerp(1);
    if (this.world.boats[1]) this.world.boats[1].g.visible = false;
    this.shopRingSet = new Set(this.world.shopRingIndices);
    this.playerItems = this.players.map(() => ({
      sixDie: 0,
      twinDice: 0,
      refuel: 0,
      shield: 0,
      missile: 0,
    }));
    this.playerQuests = this.players.map(() => ({
      roll1: 0,
      roll2: 0,
      stomped: 0,
    }));
    this.playerKda = this.players.map(() => ({
      stomps: 0,
      stomped: 0,
      shieldBreaks: 0,
    }));
    this.diceRig = buildDiceRig(this.scene, this.anisotropy);
    this.campfireRig = buildCampfireRig(this.scene);
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
          shielded: false,
          shieldMesh: mesh.userData.shieldMesh as THREE.Group | undefined,
          mesh,
        };
        mesh.userData.plane = data;
        this.planes.push(data);
        this.scene.add(mesh);
      }
    });

    // Schedule critters (governed by time-of-day ecological habits)
    this.scheduleCritter('rabbit', 4000);
    this.scheduleCritter('bird', 4500);
    this.scheduleCritter('fly', 2500);
    this.scheduleCritter('fish', 4500);

    // Pre-warm shaders（临时显形所有延迟显示物体，避免对局中首次出现时主线程编译着色器卡顿）
    if (!this.isSoftwareGl) {
      const hiddenObjs: THREE.Object3D[] = [];
      this.scene.traverse((obj) => {
        if (!obj.visible) {
          hiddenObjs.push(obj);
          obj.visible = true;
        }
      });
      this.renderer.compile(this.scene, this.camera);
      for (let i = 0; i < hiddenObjs.length; i++) {
        hiddenObjs[i].visible = false;
      }
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
      if (this.paused || this.itemBusy) {
        this.renderer.domElement.style.cursor = 'default';
        this.diceHovered = false;
        return;
      }
      this.ptr.x = (e.clientX / window.innerWidth) * 2 - 1;
      this.ptr.y = -(e.clientY / window.innerHeight) * 2 + 1;
      this.ray.setFromCamera(this.ptr, this.camera);
      let hit = false;
      this.diceHovered = false;
      if (this.phase === 'awaitRoll' && !this.isAI() && this.pendingItemTarget !== null) {
        this.diceHovered = this.ray.intersectObject(this.diceRig.diceHitMesh).length > 0;
        hit =
          this.diceHovered ||
          this.targetChoices.some(
            (c) => this.ray.intersectObject(c.plane.mesh, true).length > 0,
          );
      } else if (this.phase === 'awaitRoll' && !this.isAI()) {
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
      if (moved > 6 || this.paused || this.itemBusy) return;
      this.ptr.x = (e.clientX / window.innerWidth) * 2 - 1;
      this.ptr.y = -(e.clientY / window.innerHeight) * 2 + 1;
      this.ray.setFromCamera(this.ptr, this.camera);

      if (this.phase === 'awaitRoll' && !this.isAI() && this.pendingItemTarget !== null) {
        if (this.ray.intersectObject(this.diceRig.diceHitMesh).length > 0) {
          this.cancelItemTarget();
          void this.triggerActionPod();
          return;
        }
        const hits = this.ray.intersectObjects(
          this.planes.map((p) => p.mesh),
          true,
        );
        if (hits.length) {
          let o: THREE.Object3D | null = hits[0].object;
          while (o && !o.userData.plane) o = o.parent;
          if (o) {
            const clicked = o.userData.plane as PlaneData;
            const resolved = this.resolveBottomOfStack(clicked);
            if (this.targetChoices.some((c) => c.plane === resolved || c.plane === clicked)) {
              const target = this.targetChoices.some((c) => c.plane === resolved)
                ? resolved
                : clicked;
              this.pickItemTarget(target.pid, target.idx);
              return;
            }
          }
        }
        return;
      }

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
          if (o) {
            const clicked = o.userData.plane as PlaneData;
            const resolved = this.resolveBottomOfStack(clicked);
            if (this.movable.some((c) => c.plane === resolved)) {
              this.performMove(resolved, this.die!);
            } else if (this.movable.some((c) => c.plane === clicked)) {
              this.performMove(clicked, this.die!);
            }
          }
        }
      }
    };
    this.boundContextLost = (e: Event) => {
      e.preventDefault();
      this.isContextLost = true;
      this.onContextLostCb?.(true);
    };
    this.boundContextRestored = () => {
      this.isContextLost = false;
      this.restoreGpuResources();
      this.onContextLostCb?.(false);
    };
    this.boundVisibilityChange = () => {
      if (document.visibilityState === 'visible' && !this.disposed) {
        // 丢弃后台挂起期间累积的巨大时间差，防止动画/小动物/贴图 UV 瞬移
        this.clock.getDelta();
        if (!this.isContextLost) {
          this.renderer.shadowMap.needsUpdate = true;
          this.renderer.render(this.scene, this.camera);
        }
      }
    };
    this.boundControlsStart = () => {
      this.camUserInteracting = true;
      this.camGoalActive = false;
      this.camFollowPlane = null;
      this.camFollowObj = null;
      this.camFollowCloseup = false;
    };
    this.boundControlsEnd = () => {
      this.camUserInteracting = false;
    };

    window.addEventListener('resize', this.boundResize);
    document.addEventListener('visibilitychange', this.boundVisibilityChange);
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
    this.renderer.render(this.scene, this.camera);
    this.startLoop();
    if (onReady) {
      requestAnimationFrame(() => {
        if (!this.disposed) onReady();
      });
    }
  }

  public startMatch(): void {
    if (this.disposed || this.phase !== 'idle') return;
    this.beginRollPhase(false);
  }

  private getSlot(slotId: number) {
    return SLOTS[slotId];
  }

  private fitOrientation(): void {
    const portrait = window.innerHeight > window.innerWidth;
    this.camera.fov = portrait ? 54 : 47;
    if (this.scene.fog instanceof THREE.Fog) {
      const curTod = this.mapConfig.timePresets[this.timeOfDay];
      this.scene.fog.near = curTod.fogNear + (portrait ? 4 : 0);
      this.scene.fog.far = curTod.fogFar + (portrait ? 8 : 0);
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
      const maxCritters = this.quality === 'high' ? 8 : this.quality === 'medium' ? 5 : 3;
      const tod = this.timeOfDay;
      // 兔子：晨昏与夜间活跃，中午烈日躲回洞里午睡
      // 蝴蝶：喜阳日行，清晨/中午/下午活跃，夜晚栖息消失
      // 飞鸟/海鸥：仅中午与下午允许海鸥落到布布头上的彩蛋
      const allowed =
        kind === 'rabbit'
          ? tod !== 'noon'
          : kind === 'fly'
            ? tod !== 'evening'
            : true;
      if (allowed && this.mapConfig.enableCritterSpawns && this.world.critters.length < maxCritters) {
        if (kind === 'bird') {
          // 阶段 3 及之后天上飞鸟出现概率降低 50%
          if (this.maxDoneStage < 3 || Math.random() < 0.5) {
            const allowSeagullPerch = tod === 'noon' || tod === 'afternoon';
            this.world.spawnCritter?.('bird', { perch: allowSeagullPerch ? undefined : false });
          }
        } else {
          this.world.spawnCritter?.(kind);
        }
      }
      const nextDelay = kind === 'bird' ? rnd(6100, 13300) : rnd(5500, 12000);
      this.scheduleCritter(kind, nextDelay);
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
    this.splashItem = null;
    this.splashActorName = null;
    this.splashDetail = null;
    this.splashTargetCharKey = null;
    this.splashTargetName = null;
    this.splashIsHuman = P.type === 'human';
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

  private showTurnEndSplash(P: PlayerConfig, text: string, durationMs = 2100): void {
    if (P.type !== 'human') return;
    this.splashAvatar = P.species === 'panda' ? '🐼' : '🐻';
    this.splashCharKey = P.key;
    this.splashText = text;
    this.splashColor = P.uiColor;
    this.splashItem = null;
    this.splashActorName = null;
    this.splashDetail = null;
    this.splashTargetCharKey = null;
    this.splashTargetName = null;
    this.splashIsHuman = true;
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
      }, durationMs);
    });
  }

  private showShopSplash(
    P: PlayerConfig,
    item: ItemType,
    durationMs = 2400,
  ): void {
    const def = ITEM_DEFS[item];
    this.splashAvatar = P.species === 'panda' ? '🐼' : '🐻';
    this.splashCharKey = P.key;
    this.splashText = `🏪 ${P.name} 购买了「${def.name}」· ${def.shortEffect}`;
    this.splashColor = def.accentColor;
    this.splashItem = null;
    this.splashActorName = null;
    this.splashDetail = null;
    this.splashTargetCharKey = null;
    this.splashTargetName = null;
    this.splashIsHuman = P.type === 'human';
    this.splashVisible = true;
    this.emitSnapshot();
    cancelAnimationFrame(this.splashRaf);
    if (this.splashTimer !== null) window.clearTimeout(this.splashTimer);
    this.splashRaf = requestAnimationFrame(() => {
      if (this.disposed) return;
      this.splashTimer = window.setTimeout(() => {
        if (this.disposed) return;
        this.splashVisible = false;
        this.splashItem = null;
        this.emitSnapshot();
      }, P.type !== 'human' ? durationMs + 2000 : durationMs);
    });
  }

  private showItemSplash(
    P: PlayerConfig,
    item: ItemType,
    detail?: string,
    durationMs = 3600,
    targetPlayer?: PlayerConfig,
  ): void {
    const def = ITEM_DEFS[item];
    this.splashAvatar = P.species === 'panda' ? '🐼' : '🐻';
    this.splashCharKey = P.key;
    this.splashActorName = P.name;
    this.splashDetail = detail ?? def.shortEffect;
    this.splashTargetCharKey = targetPlayer ? targetPlayer.key : null;
    this.splashTargetName = targetPlayer ? targetPlayer.name : null;
    this.splashText = item === 'shield' ? '香布布~香布布~浑身香香的布布~' : `${P.name} 使用「${def.name}」· ${detail ?? def.shortEffect}`;
    this.splashColor = def.accentColor;
    this.splashItem = item;
    this.splashKey++;
    this.splashIsHuman = P.type === 'human';
    this.splashVisible = true;
    this.emitSnapshot();
    cancelAnimationFrame(this.splashRaf);
    if (this.splashTimer !== null) window.clearTimeout(this.splashTimer);
    this.splashRaf = requestAnimationFrame(() => {
      if (this.disposed) return;
      this.splashTimer = window.setTimeout(() => {
        if (this.disposed) return;
        this.splashVisible = false;
        this.splashItem = null;
        this.splashActorName = null;
        this.splashDetail = null;
        this.splashTargetCharKey = null;
        this.splashTargetName = null;
        this.emitSnapshot();
      }, P.type !== 'human' ? durationMs + 2000 : durationMs);
    });
  }

  private recordTurnKillStreak(killerPid: number, addedKills: number): void {
    if (addedKills <= 0) return;
    this.turnStompKills += addedKills;
    if (this.turnStompKills < 2) return;
    const kills = this.turnStompKills;
    const killer = this.players[killerPid];
    if (!killer) return;

    const map: Record<number, { title: string; cn: string; voice: string }> = {
      2: { title: 'DOUBLE KILL!', cn: '双杀', voice: 'Double Kill!' },
      3: { title: 'TRIPLE KILL!', cn: '三杀', voice: 'Triple Kill!' },
      4: { title: 'QUADRA KILL!', cn: '四杀', voice: 'Quadra Kill!' },
      5: { title: 'PENTA KILL!', cn: '五杀', voice: 'Penta Kill!' },
    };
    const info = map[kills] ?? {
      title: 'LEGENDARY!',
      cn: '超神暴走',
      voice: 'Legendary!',
    };

    this.killBanner = {
      key: ++this.killBannerKey,
      kills,
      title: info.title,
      subtitle: `${killer.name} · ${info.cn}（单回合连踩 ${kills} 只）`,
      playerName: killer.name,
      playerCharKey: killer.key,
      playerColor: killer.uiColor,
    };
    announceKillStreak(kills, info.voice);
    this.emitSnapshot();
    if (this.killBannerTimer !== null) window.clearTimeout(this.killBannerTimer);
    this.killBannerTimer = window.setTimeout(() => {
      if (this.disposed) return;
      this.killBanner = null;
      this.emitSnapshot();
    }, 3400);
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
    const shopSecondsLeft =
      this.phase === 'shopChoice' && this.shopDeadline !== null && !this.paused
        ? Math.max(0, Math.ceil((this.shopDeadline - this.timeMs) / 1000))
        : null;

    this.diceRig.diceHint.visible =
      !this.stage4CampfireActive && this.phase === 'awaitRoll' && !this.isAI() && this.pendingItemTarget === null && !this.itemBusy;
    this.world.courtFences.forEach((cf, j) => {
      const pl = this.slotPlayer(j);
      const on = !!pl && this.turn === this.players.indexOf(pl) && this.phase !== 'over';
      cf.active = on;
      cf.pulse = on && pl?.type === 'human';
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
      mapId: this.mapId,
      timeOfDay: this.timeOfDay,
      phase: this.phase,
      turn: this.turn,
      die: this.die,
      twinDice: this.twinDice,
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
      latestEmote: this.latestEmote,
      splashText: this.splashText,
      splashAvatar: this.splashAvatar,
      splashCharKey: this.splashCharKey,
      splashColor: this.splashColor,
      splashVisible: this.splashVisible,
      splashItem: this.splashItem,
      splashKey: this.splashKey,
      splashIsHuman: this.splashIsHuman,
      splashActorName: this.splashActorName,
      splashDetail: this.splashDetail,
      splashTargetCharKey: this.splashTargetCharKey,
      splashTargetName: this.splashTargetName,
      shakeKey: this.shakeKey,
      winnerPid: this.winnerPid,
      rankings: this.getRankings(),
      gmDie: this.gmNextDie,
      gmAutoPlay: this.gmAutoPlay,
      turnUsedAtkDef: this.turnUsedAtkDef,
      turnUsedDef: this.turnUsedDef,
      armedSixDie: this.armedSixDie,
      armedTwinDice: this.armedTwinDice,
      armedRefuel: this.armedRefuel,
      pendingItemTarget: this.pendingItemTarget,
      targetChoices: this.targetChoices.map((tc): ItemTargetChoice => {
        const owner = this.players[tc.plane.pid];
        return {
          pid: tc.plane.pid,
          idx: tc.plane.idx,
          ownerName: owner.name,
          ownerColor: owner.uiColor,
          pos: tc.plane.pos,
          shielded: tc.plane.shielded,
          stackCount: tc.stackCount,
        };
      }),
      shopOffer: this.shopOffer,
      shopSecondsLeft,
      shopPid: this.shopPid,
      giftQuestEvent: this.giftQuestEvent,
      killBanner: this.killBanner,
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
          items: { ...this.playerItems[i] },
          quest: { ...this.playerQuests[i] },
          kda: { ...this.playerKda[i] },
        };
      }),
    });
  }

  /* ================= Item & Quest Helpers ================= */
  private resolveBottomOfStack(plane: PlaneData): PlaneData {
    if (plane.pos < 1 || plane.pos >= HOME_END) return plane;
    const sameStack = this.planes
      .filter((p) => p.pid === plane.pid && p.pos === plane.pos)
      .sort((a, b) => a.idx - b.idx);
    return sameStack[0] ?? plane;
  }

  private syncShieldVisuals(): void {
    for (const p of this.planes) {
      if (!p.shieldMesh) continue;
      if (!p.shielded || p.pos < 0 || p.pos >= HOME_END) {
        p.shieldMesh.visible = false;
        continue;
      }
      if (p.pos >= 1) {
        const stack = this.planes
          .filter((q) => q.pid === p.pid && q.pos === p.pos)
          .sort((a, b) => a.idx - b.idx);
        const firstShielded = stack.find((q) => q.shielded);
        if (firstShielded && firstShielded !== p) {
          p.shieldMesh.visible = false;
          continue;
        }
      }
      p.shieldMesh.visible = true;
    }
  }

  private spawnShieldBreak(x: number, z: number): void {
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.28, 0.56, 32),
      new THREE.MeshBasicMaterial({
        color: 0x5be3ff,
        transparent: true,
        opacity: 0.95,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(x, 0.34, z);
    this.scene.add(ring);

    const bubbleColors = [0xffc2e2, 0xa6f4ff, 0xd9c2ff, 0xffffff];
    const shards: { m: THREE.Mesh; vx: number; vy: number; vz: number }[] = [];
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2;
      const mat = new THREE.MeshBasicMaterial({
        color: bubbleColors[i % bubbleColors.length],
        transparent: true,
        opacity: 0.85,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const m = new THREE.Mesh(new THREE.SphereGeometry(0.055 + (i % 3) * 0.015, 10, 8), mat);
      m.position.set(x + Math.cos(a) * 0.25, 0.42, z + Math.sin(a) * 0.25);
      this.scene.add(m);
      shards.push({
        m,
        vx: Math.cos(a) * (0.9 + Math.random() * 0.5),
        vy: 0.6 + Math.random() * 0.6,
        vz: Math.sin(a) * (0.9 + Math.random() * 0.5),
      });
    }
    this.tween(580, (k) => {
      const e = 1 - Math.pow(1 - k, 2);
      ring.scale.setScalar(1 + e * 2.1);
      ring.material.opacity = 0.95 * (1 - k);
      for (const sh of shards) {
        sh.m.position.x = x + sh.vx * e;
        sh.m.position.y = 0.42 + sh.vy * Math.sin(k * Math.PI * 0.7);
        sh.m.position.z = z + sh.vz * e;
        sh.m.rotation.x += 0.25;
        sh.m.rotation.y += 0.25;
        (sh.m.material as THREE.MeshBasicMaterial).opacity = 1 - k;
        sh.m.scale.setScalar(1 - k * 0.5);
      }
    }).then(() => {
      this.scene.remove(ring);
      ring.geometry.dispose();
      ring.material.dispose();
      for (const sh of shards) {
        this.scene.remove(sh.m);
        sh.m.geometry.dispose();
        (sh.m.material as THREE.Material).dispose();
      }
    });
  }

  private getProgressStage(): ProgressStage {
    const maxDone = Math.max(
      0,
      ...this.players.map((_, pid) => this.planesOf(pid).filter((p) => p.pos === HOME_END).length),
    );
    return Math.min(3, maxDone) as ProgressStage;
  }

  private pickWeightedItem(
    weights: Record<ItemType, number>,
    exclude?: Set<ItemType>,
  ): ItemType {
    const candidates = ITEM_ORDER.filter(
      (it) => (!exclude || !exclude.has(it)) && (weights[it] ?? 0) > 0,
    );
    if (candidates.length === 0) {
      const fallback = ITEM_ORDER.filter((it) => !exclude || !exclude.has(it));
      return fallback[0] ?? ITEM_ORDER[0];
    }
    const total = candidates.reduce((acc, it) => acc + weights[it], 0);
    let r = Math.random() * total;
    for (const it of candidates) {
      r -= weights[it];
      if (r <= 0) return it;
    }
    return candidates[candidates.length - 1];
  }

  private pickUniqueShopOffer(): ItemType[] {
    const stage = this.getProgressStage();
    const weights = SHOP_ITEM_WEIGHTS[stage];
    const picked = new Set<ItemType>();
    const offer: ItemType[] = [];
    for (let i = 0; i < 3; i++) {
      const next = this.pickWeightedItem(weights, picked);
      picked.add(next);
      offer.push(next);
    }
    return offer;
  }

  private grantItem(pid: number, item: ItemType): void {
    this.playerItems[pid][item] += 1;
    if (this.itemLastGainedTurn[pid]) {
      this.itemLastGainedTurn[pid][item] = this.playerTurnCount[pid] ?? 0;
    }
  }

  private grantRandomItem(pid: number): ItemType {
    const stage = this.getProgressStage();
    const item = this.pickWeightedItem(GIFT_QUEST_ITEM_WEIGHTS[stage]);
    this.grantItem(pid, item);
    return item;
  }

  private recordRollQuest(pid: number, faces: number[]): void {
    const q = this.playerQuests[pid];
    if (!q) return;
    let touched = false;
    const has1 = faces.includes(1);
    const has2 = faces.includes(2);
    if (faces.length > 1 && has1 && has2) {
      // 动力装置双骰同轮最多计入 1 个任务骰面，优先补齐较缺的一侧
      if (q.roll1 <= q.roll2) q.roll1 += 1;
      else q.roll2 += 1;
      touched = true;
    } else if (has1) {
      q.roll1 += 1;
      touched = true;
    } else if (has2) {
      q.roll2 += 1;
      touched = true;
    }
    if (!touched) return;
    while (q.roll1 >= 1 && q.roll2 >= 1) {
      q.roll1 -= 1;
      q.roll2 -= 1;
      const got = this.grantRandomItem(pid);
      const def = ITEM_DEFS[got];
      const pl = this.players[pid];
      beep(820, 0.12, 'triangle', 0.14);
      this.setMsg(`🎯 ${pl.name} 完成「一二的馈赠」，获得 ${def.icon} ${def.name}！`, pl.uiColor);
      this.giftQuestEvent = {
        questType: 'gift',
        isLocalHuman: pl.type === 'human',
        playerName: pl.name,
        playerCharKey: pl.key,
        playerColor: pl.uiColor,
        item: got,
        key: ++this.giftQuestKey,
      };
      if (this.giftQuestTimer !== null) window.clearTimeout(this.giftQuestTimer);
      this.giftQuestTimer = window.setTimeout(() => {
        if (this.disposed) return;
        this.giftQuestEvent = null;
        this.emitSnapshot();
      }, pl.type !== 'human' ? 7400 : 5400);
    }
    this.emitSnapshot();
  }

  private recordStompQuest(victimPid: number, count = 1): void {
    const q = this.playerQuests[victimPid];
    if (!q) return;
    q.stomped += count;
    while (q.stomped >= 2) {
      q.stomped -= 2;
      const reward: ItemType = Math.random() < 0.5 ? 'shield' : 'twinDice';
      this.grantItem(victimPid, reward);
      const def = ITEM_DEFS[reward];
      const pl = this.players[victimPid];
      beep(720, 0.12, 'triangle', 0.14);
      this.setMsg(`${def.icon} ${pl.name} 触发「布布不烦恼」，任务奖励：${def.name} ×1！`, pl.uiColor);
      this.giftQuestEvent = {
        questType: 'bubu',
        isLocalHuman: pl.type === 'human',
        playerName: pl.name,
        playerCharKey: pl.key,
        playerColor: pl.uiColor,
        item: reward,
        key: ++this.giftQuestKey,
      };
      if (this.giftQuestTimer !== null) window.clearTimeout(this.giftQuestTimer);
      this.giftQuestTimer = window.setTimeout(() => {
        if (this.disposed) return;
        this.giftQuestEvent = null;
        this.emitSnapshot();
      }, pl.type !== 'human' ? 7400 : 5400);
    }
    this.emitSnapshot();
  }

  private buildTargetChoices(kind: 'shield' | 'missile', actorPid: number): { plane: PlaneData; stackCount: number }[] {
    const seen = new Set<string>();
    const result: { plane: PlaneData; stackCount: number }[] = [];

    if (kind === 'shield') {
      const myPlanes = this.planesOf(actorPid)
        .filter((p) => p.pos >= 0 && p.pos < HOME_END)
        .sort((a, b) => a.idx - b.idx);
      for (const p of myPlanes) {
        if (p.pos === 0) {
          if (p.shielded) continue;
          result.push({ plane: p, stackCount: 1 });
        } else {
          const key = `${p.pid}-${p.pos}`;
          if (seen.has(key)) continue;
          seen.add(key);
          const stack = myPlanes.filter((q) => q.pos === p.pos);
          if (stack.some((q) => q.shielded)) continue;
          result.push({ plane: stack[0], stackCount: stack.length });
        }
      }
    } else {
      const enemies = this.planes
        .filter((p) => p.pid !== actorPid && p.pos >= 1 && p.pos <= 55)
        .sort((a, b) => a.pid - b.pid || a.idx - b.idx);
      for (const p of enemies) {
        const key = `${p.pid}-${p.pos}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const stack = enemies.filter((q) => q.pid === p.pid && q.pos === p.pos);
        result.push({ plane: stack[0], stackCount: stack.length });
      }
    }
    return result;
  }

  /* ================= AI Personality, Threat Coeff & Chat ================= */
  // 计算敌方当前在棋盘上对我方的实时踩踏/打击威胁度 B ∈ [0, 1]
  private computeEnemyBoardThreat(me: number, enemyPid: number): number {
    if (me === enemyPid) return 0;
    const myPlanes = this.planesOf(me).filter((p) => p.pos >= 1 && p.pos < HOME_END && !p.shielded);
    const enemyPlanes = this.planesOf(enemyPid);
    const enemyP = this.players[enemyPid];
    const enemyInv = this.playerItems[enemyPid];
    if (!myPlanes.length || !enemyP) return 0;

    let raw = 0;
    for (const mp of myPlanes) {
      const weight = mp.pos === 54 ? 1.25 : 0.45 + (mp.pos / 50) * 0.85;
      if (mp.pos >= 1 && mp.pos <= 50) {
        const myRing = this.ringIndexOf(mp);
        for (const ep of enemyPlanes) {
          if (ep.pos >= 1 && ep.pos <= 50) {
            const d = (myRing - this.ringIndexOf(ep) + 52) % 52;
            if (d >= 1 && d <= 6) {
              raw += 0.34 * weight;
            } else if (d >= 7 && d <= 10) {
              const midPos = ep.pos + (d - 4);
              if (midPos >= 1 && midPos <= 49 && midPos % 4 === 2) {
                raw += 0.18 * weight;
              }
            }
          } else if (ep.pos === 0) {
            const startRing = (enemyP.start + 2) % 52;
            const d = (myRing - startRing + 52) % 52;
            if (d >= 1 && d <= 6) raw += 0.22 * weight;
          }
        }
      } else if (mp.pos === 54 && (this.players[me].slotId + 2) % 4 === enemyP.slotId) {
        if (enemyPlanes.some((ep) => ep.pos >= 8 && ep.pos <= 17)) raw += 0.36;
      }
    }
    if (enemyInv) {
      if (enemyInv.missile > 0) raw += 0.16;
      if (enemyInv.sixDie > 0 || enemyInv.twinDice > 0) raw += 0.12;
    }
    return Math.min(1, raw);
  }

  // 完整威胁系数公式：
  // 累计冒犯值 O ∈ [0, 2.5]（被踩 1 次 +1.0，被踩 2 次达上限强度 G = min(1, O / 2.0) = 1.0）
  // 综合威胁系数 T(me, enemy) = 1.0 + W_p * (0.78 * G + 0.22 * B)
  // 成功报复后按比例与定额双重衰减 O，使威胁系数明显回落
  private computeThreatCoeff(me: number, enemyPid: number): number {
    if (me === enemyPid) return 1.0;
    const p: AiPersonality = this.players[me]?.personality ?? 'tactician';
    const offense = this.offenseScores[me]?.[enemyPid] ?? 0;
    const gSeverity = Math.min(1.0, offense / 2.0);
    const boardThreat = this.computeEnemyBoardThreat(me, enemyPid);
    const sensitivity =
      p === 'vengeful' ? 2.2 : p === 'tactician' ? 1.25 : p === 'rusher' ? 0.75 : 0.35;
    return 1.0 + sensitivity * (0.78 * gSeverity + 0.22 * boardThreat);
  }

  private getTopThreatPid(pid: number): number {
    let bestPid = -1;
    let bestCoeff = 1.45;
    for (let j = 0; j < this.players.length; j++) {
      if (j === pid) continue;
      const coeff = this.computeThreatCoeff(pid, j);
      if (coeff > bestCoeff) {
        bestCoeff = coeff;
        bestPid = j;
      }
    }
    return bestPid;
  }

  private recordOffense(victimPid: number, attackerPid: number, amount: number): void {
    if (victimPid === attackerPid) return;
    if (!this.offenseScores[victimPid]) return;
    const prev = this.offenseScores[victimPid][attackerPid] ?? 0;
    this.offenseScores[victimPid][attackerPid] = Math.min(2.5, prev + amount);
  }

  private onRetaliationSuccess(me: number, enemyPid: number, method: 'stomp' | 'missile'): void {
    if (!this.offenseScores[me]) return;
    const cur = this.offenseScores[me][enemyPid] ?? 0;
    if (method === 'stomp') {
      this.offenseScores[me][enemyPid] = Math.max(0, cur * 0.35 - 0.55);
    } else {
      this.offenseScores[me][enemyPid] = Math.max(0, cur * 0.45 - 0.45);
    }
  }

  private fireAiEmoteNow(
    pid: number,
    text: string,
    cooldownMs = 2200,
    ignoreCooldown = false,
  ): boolean {
    if (this.disposed) return false;
    const pl = this.players[pid];
    if (!pl || pl.type !== 'ai') return false;
    if (!ignoreCooldown && this.timeMs - (this.lastAiEmoteAt[pid] ?? -9999) < cooldownMs) {
      return false;
    }
    this.lastAiEmoteAt[pid] = this.timeMs;
    this.latestEmote = { pid, text, key: ++this.emoteKeySeq };
    this.emitSnapshot();
    return true;
  }

  private emitAiEmote(
    pid: number,
    kind:
      | 'gotStomped'
      | 'gotMissiled'
      | 'stompedEnemy'
      | 'stompRevenge'
      | 'fireMissile'
      | 'useSpeedItem'
      | 'useShield'
      | 'shopPick'
      | 'goal'
      | 'reply'
      | 'preRoll'
      | 'preMove'
      | 'preStomp'
      | 'preFly'
      | 'preTakeoff'
      | 'preGoal'
      | 'watchHuman'
      | 'bystander',
    cooldownMs = 2600,
    targetName?: string,
    opts?: {
      probMult?: number;
      delayMinMs?: number;
      delayMaxMs?: number;
      requireTurnSeq?: number;
      allowFollowUp?: boolean;
      allowBystander?: boolean;
    },
  ): void {
    if (this.disposed) return;
    if (this.totalCompletedTurns < this.players.length) return;
    const pl = this.players[pid];
    if (!pl || pl.type !== 'ai') return;

    const p: AiPersonality = pl.personality ?? 'tactician';
    const profile: Record<
      AiPersonality,
      {
        talkRate: number;
        followUpRate: number;
        delayRange: [number, number];
        replyRate: number;
        ambientRate: number;
      }
    > = {
      vengeful: {
        talkRate: 0.72,
        followUpRate: 0.36,
        delayRange: [900, 3300],
        replyRate: 0.56,
        ambientRate: 0.28,
      },
      chill: {
        talkRate: 0.42,
        followUpRate: 0.14,
        delayRange: [1700, 4600],
        replyRate: 0.62,
        ambientRate: 0.14,
      },
      rusher: {
        talkRate: 0.80,
        followUpRate: 0.20,
        delayRange: [600, 2400],
        replyRate: 0.50,
        ambientRate: 0.16,
      },
      tactician: {
        talkRate: 0.54,
        followUpRate: 0.14,
        delayRange: [1100, 3600],
        replyRate: 0.46,
        ambientRate: 0.24,
      },
    };

    const cfg = profile[p];
    const baseRate =
      kind === 'reply'
        ? cfg.replyRate
        : kind === 'preRoll' || kind === 'preMove' || kind === 'watchHuman' || kind === 'bystander' || kind === 'preTakeoff'
          ? cfg.ambientRate
          : cfg.talkRate;
    const prob = Math.min(0.96, baseRate * (opts?.probMult ?? 1));
    if (Math.random() > prob) return;

    const pools: Record<AiPersonality, Record<typeof kind, string[]>> = {
      vengeful: {
        gotStomped: [
          `😠 ${targetName ?? '你'}，我记小本本上了！`,
          '💢 敢踩我？走着瞧！',
          '📝 这笔账先记下，待会儿算！',
          '📝 拿小本本记录下来！',
        ],
        gotMissiled: [
          `🥧 好啊 ${targetName ?? ''}，这记奶油派我记下了！`,
          '😠 糊我一脸奶油？别让我逮到！',
        ],
        stompedEnemy: ['😏 别挡我的道！', '💥 让你尝尝被踩的滋味'],
        stompRevenge: [
          `🎯 ${targetName ?? ''}，还记得刚才的账吗！`,
          '😈 君子报仇，十步不晚！',
        ],
        fireMissile: [
          `🥧 ${targetName ?? ''}，接我一记奶油派炸弹！`,
          '💢 新仇旧恨一起算！',
        ],
        useSpeedItem: ['🔥 全速追上去算账！', '😠 别想跑太远！'],
        useShield: ['🫧 先套个泡泡罩，免得被偷袭'],
        shopPick: ['🏪 这张卡正好用得上~', '😏 准备好了，谁惹我试试'],
        goal: ['🏁 先下一城，账照样算！', '🔥 顺利进站！'],
        reply: ['👀 别笑，我小本本可记着呢', '💢 好好飞，别惹我！', '😤 看我待会儿怎么追'],
        preRoll: ['😠 这把骰子给点力，我要追人', '👀 让我看看谁跑最前面...', '🔥 来个大点数！'],
        preMove: ['😠 往前挪几步，盯着你们呢', '👀 先占个好位置'],
        preStomp: ['😏 嘿嘿，前面那位小心点', '💥 刚好够着，准备踩人咯'],
        preFly: ['🔥 顺风起飞，马上追上你们！'],
        preTakeoff: ['😠 终于出门了，刚才的账慢慢算！'],
        preGoal: ['🔥 这只先稳稳进终点！'],
        watchHuman: ['👀 你可别踩到我前面啊', '💢 走快点，我盯着你呢', '📝 我记性好着呢，别乱丢奶油派'],
        bystander: ['😈 哈哈，有人要记仇咯', '👀 幸好没波及到我', '🔥 场面越来越热闹了'],
      },
      chill: {
        gotStomped: [
          '🍵 没事没事，回基地泡壶茶~',
          '🌸 缘分呐，让你先走',
          '😌 佛系不生气，重在参与~',
        ],
        gotMissiled: ['🥧 哎呀奶油挺甜的，顺便退几步看风景~', '🌿 随缘啦，不急着到终点'],
        stompedEnemy: ['🙏 哎呀不好意思撞到了~', '😅 纯属巧合，手下留情'],
        stompRevenge: ['🙏 缘分又撞一起啦~', '😅 抱歉抱歉~'],
        fireMissile: ['🥧 跑太快啦，请吃块奶油派歇歇~', '🍵 抱歉借过，小小减速一下'],
        useSpeedItem: ['🌿 顺风散步去咯~', '✨ 随缘加速，慢慢晃悠'],
        useShield: ['🫧 洗个泡泡澡，安稳过日子~', '🍵 安全第一，慢慢来~'],
        shopPick: ['🍰 顺路逛个小卖部真惬意~', '🌸 随便挑张顺眼的'],
        goal: ['🏁 慢慢晃也到家啦~', '🍵 一只到站，真悠闲~'],
        reply: ['🍵 哈哈开心就好~', '🌸 慢慢飞，不着急~', '✨ 快乐飞行棋第一名~'],
        preRoll: ['🍵 随便掷个几都行~', '🌸 佛系摇骰，重在开心', '😌 来个不紧不慢的点数吧'],
        preMove: ['🌿 慢慢走，安全最要紧', '🍵 晃悠晃悠往前挪几步~'],
        preStomp: ['😅 哎呀刚好落在这格，对不住啦~'],
        preFly: ['🌸 哇，顺便搭个便车飞一程~'],
        preTakeoff: ['🍵 出门晒晒太阳散步去~'],
        preGoal: ['🌸 慢慢悠悠到终点啦~'],
        watchHuman: ['🍵 慢慢想不着急，先喝口茶~', '🌸 局势挺平和的嘛', '😌 开心玩，赢不赢随缘~'],
        bystander: ['🍵 哈哈好热闹呀~', '🌸 大家飞得都挺欢乐嘛', '😌 和气生财，和气生财~'],
      },
      rusher: {
        gotStomped: [
          '😤 别想拖慢我的速度！',
          '⚡ 可恶！马上冲回来！',
        ],
        gotMissiled: ['🥧 居然拿奶油派拖我节奏！加倍追回去！', '⚡ 拦不住我的！'],
        stompedEnemy: ['💥 挡路者通通回基地！', '⚡ 借过借过，我要冲第一！'],
        stompRevenge: ['💥 顺手清场！继续冲刺！', '⚡ 挡我速通？下去吧！'],
        fireMissile: ['🥧 领跑的给我慢下来！', '⚡ 第一名必须是我的！'],
        useSpeedItem: ['⚡ 全速冲刺！速战速决！', '🔥 加速拉满，直奔终点！'],
        useShield: ['🫧 套个泡泡继续猛冲！'],
        shopPick: ['🏪 好卡到手，继续抢跑！', '⚡ 提速卡真香！'],
        goal: ['🏁 又进一只！光速冲线！', '⚡ 距离夺冠更近一步！'],
        reply: ['⚡ 少聊两句，看我速通！', '🔥 我只想最快结束这局！', '💨 冲就完事了！'],
        preRoll: ['🔥 快快快，给我出大点数！', '💨 这回合直接甩开你们'],
        preMove: ['⚡ 往前冲！节奏不能停！', '💨 继续提速！'],
        preStomp: ['⚡ 让开让开，直接踩过去！', '💥 挡我路的通通闪开！'],
        preFly: ['🔥 飞过去！节奏起飞！', '⚡ 顺风大跳，甩开大部队！'],
        preTakeoff: ['⚡ 出发！全速起跑！'],
        preGoal: ['🏁 直接冲线进终点！'],
        watchHuman: ['⚡ 快点投呀，急死我了！', '🔥 别纠结啦，冲鸭！'],
        bystander: ['🔥 打起来打起来！', '⚡ 好机会！趁乱往前冲！', '💨 你们互丢奶油派，我偷跑咯'],
      },
      tactician: {
        gotStomped: ['🧠 有意思，重新算一下最优解', '📊 小小失误，问题不大'],
        gotMissiled: ['🥧 被针对了？说明我领先太多', '📊 调整节奏，稳住局面'],
        stompedEnemy: ['🎯 精准算步，顺路清障！', '🧠 这一步收益拉满'],
        stompRevenge: ['🎯 精准反制', '🧠 正好顺路送你回基地'],
        fireMissile: ['🥧 精准打击领跑位！', '🎯 这一记奶油派性价比很高'],
        useSpeedItem: ['🧠 算准格子，直接拿下！', '📊 节奏把控中~'],
        useShield: ['🫧 关键位置先套一层泡泡保险'],
        shopPick: ['🧠 补一张关键功能卡', '📊 这张卡最契合当前局势'],
        goal: ['🏁 按计划稳步收官！', '🧠 一只稳稳落袋'],
        reply: ['🧠 一切都在计算之中', '📊 小心走位哦~', '🎯 看看谁的节奏更稳'],
        preRoll: ['🧠 算下概率，出 4 以上最舒服', '📊 稳扎稳打，看这步怎么落子', '🎯 希望骰子配合一下计算'],
        preMove: ['🧠 这一步落点最合理', '📊 稳步推进，控制风险'],
        preStomp: ['🎯 刚好踩点，顺路清障！'],
        preFly: ['🧠 踩中同色连跳，收益拉满！'],
        preTakeoff: ['🧠 先派一只出基地占节奏'],
        preGoal: ['🎯 精准卡步，直接进终点！'],
        watchHuman: ['🧠 这步挺关键的，好好选', '📊 局势挺微妙，看你怎么走'],
        bystander: ['📊 这波博弈有点意思', '🧠 局势瞬间反转了', '🎯 关键道具都交得挺准'],
      },
    };

    const followUpPools: Record<AiPersonality, string[]> = {
      vengeful: ['💢 给我等着！', '📝 记在小本本上！', '😠 下轮见！', '🔥 别以为结束了'],
      chill: ['🍵 开心最重要啦~', '🌸 慢慢飞~', '😌 问题不大哈哈', '✨ 喝口水继续'],
      rusher: ['⚡ 冲冲冲！', '🔥 别墨迹！', '💨 第一名预定！', '⚡ 速度拉满！'],
      tactician: ['📊 节奏很关键', '🧠 稳住能赢', '🎯 继续观察局势', '✨ 算好下一手'],
    };

    const list = pools[p][kind];
    if (!list || list.length === 0) return;
    const text = list[Math.floor(Math.random() * list.length)];

    const [dMin, dMax] = [
      opts?.delayMinMs ?? cfg.delayRange[0],
      opts?.delayMaxMs ?? cfg.delayRange[1],
    ];
    const delayMs = Math.round(dMin + Math.random() * Math.max(80, dMax - dMin));
    const capturedTurnSeq = opts?.requireTurnSeq;

    this.after(delayMs, () => {
      if (this.disposed) return;
      if (capturedTurnSeq !== undefined && capturedTurnSeq !== this.turnSeq) return;
      const sent = this.fireAiEmoteNow(pid, text, cooldownMs);
      if (!sent) return;

      // 有概率在几秒后再补发第二句话（更像真人连发）
      const canFollow = opts?.allowFollowUp ?? (kind !== 'bystander' && kind !== 'useShield');
      if (canFollow && Math.random() < cfg.followUpRate) {
        const fuPool = followUpPools[p];
        const fuText = fuPool[Math.floor(Math.random() * fuPool.length)];
        const fuDelay = Math.round(1700 + Math.random() * 1900);
        this.after(fuDelay, () => {
          if (this.disposed) return;
          if (capturedTurnSeq !== undefined && capturedTurnSeq !== this.turnSeq) return;
          this.fireAiEmoteNow(pid, fuText, 0, true);
        });
      }

      // 关键场面（被踩/被炸/进终点）偶发引来另一位旁观 AI 延时接茬
      if (
        opts?.allowBystander &&
        (kind === 'gotStomped' || kind === 'gotMissiled' || kind === 'goal')
      ) {
        const others = this.players
          .map((q, idx) => ({ q, idx }))
          .filter((x) => x.q.type === 'ai' && x.idx !== pid);
        if (others.length > 0 && Math.random() < 0.35) {
          const other = others[Math.floor(Math.random() * others.length)];
          this.emitAiEmote(other.idx, 'bystander', 3200, undefined, {
            probMult: 1.5,
            delayMinMs: 1100,
            delayMaxMs: 2900,
            allowFollowUp: false,
          });
        }
      }
    });
  }

  public reactToHumanEmote(senderPid: number): void {
    if (this.disposed) return;
    const aiPids = this.players
      .map((pl, idx) => ({ pl, idx }))
      .filter((x) => x.pl.type === 'ai' && x.idx !== senderPid)
      .map((x) => x.idx);
    if (aiPids.length === 0) return;

    // 每次人类发消息，每位 AI 独立按自身性格概率、不同延迟决定是否接话（可能 0、1 或 2 个回应）
    const shuffled = [...aiPids].sort(() => Math.random() - 0.5);
    let repliesScheduled = 0;
    for (const aiPid of shuffled) {
      if (repliesScheduled >= 2) break;
      const baseDelay = 950 + repliesScheduled * 1400;
      this.emitAiEmote(aiPid, 'reply', 2000, undefined, {
        probMult: repliesScheduled === 0 ? 1.05 : 0.45,
        delayMinMs: baseDelay,
        delayMaxMs: baseDelay + 2300,
        allowFollowUp: repliesScheduled === 0,
      });
      repliesScheduled++;
    }
  }

  private aiChooseShopItem(offer: ItemType[], pid: number): ItemType {
    const P = this.players[pid];
    const p: AiPersonality = P.personality ?? 'tactician';
    const myPlanes = this.planesOf(pid);
    const stuckInBase = myPlanes.filter((q) => q.pos === -1).length;
    const enemyLeaderPos = Math.max(
      0,
      ...this.planes.filter((q) => q.pid !== pid && q.pos < HOME_END).map((q) => q.pos),
    );

    const hasMissileTargets = this.buildTargetChoices('missile', pid).length > 0;
    if (p === 'tactician') {
      if (hasMissileTargets && enemyLeaderPos >= 34 && offer.includes('missile')) return 'missile';
      if (stuckInBase >= 3 && offer.includes('sixDie')) return 'sixDie';
    }
    if (p === 'vengeful' && hasMissileTargets && this.getTopThreatPid(pid) >= 0 && offer.includes('missile')) {
      return 'missile';
    }
    const prio = AI_PERSONALITIES[p].shopPriority;
    return prio.find((it) => offer.includes(it)) ?? offer[0];
  }

  /** 给被奶油派炸弹命中的小熊头顶糊上 3D 蓬松奶油与小樱桃，持续 durationMs 后自然消散 */
  private attachCreamSplat(plane: PlaneData, durationMs = 3000): void {
    const pt = plane.mesh.userData.parts as PlaneParts | undefined;
    if (!pt) return;
    const prev = pt.headPivot.userData.creamSplat as THREE.Group | undefined;
    if (prev) {
      pt.headPivot.remove(prev);
      this.disposeGeometryOnly(prev);
    }

    const splat = new THREE.Group();
    const creamMat = new THREE.MeshStandardMaterial({
      color: 0xfffcf5,
      emissive: 0xfff0d4,
      emissiveIntensity: 0.16,
      roughness: 0.32,
      metalness: 0.0,
    });
    const cherryMat = new THREE.MeshStandardMaterial({
      color: 0xef4444,
      emissive: 0xb91c1c,
      emissiveIntensity: 0.18,
      roughness: 0.18,
    });

    // 厚实蓬松的奶油大盖帽（全角度清晰可见）
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.255, 22, 16), creamMat);
    cap.scale.set(1.18, 0.72, 1.15);
    cap.position.set(0, 0.255, 0.01);
    splat.add(cap);

    // 顶部奶油螺旋尖
    const swirl = new THREE.Mesh(new THREE.ConeGeometry(0.115, 0.145, 18), creamMat);
    swirl.position.set(-0.01, 0.435, 0.01);
    swirl.rotation.z = 0.12;
    splat.add(swirl);

    // 360° 环绕整颗脑袋的 10 坨厚奶油垂边（正面、脸侧、后脑全覆盖）
    const blobSpecs: [number, number, number, number, number][] = [
      [0.0, 0.19, 0.225, 0.088, 1.4],
      [-0.145, 0.205, 0.175, 0.085, 1.38],
      [0.145, 0.20, 0.175, 0.088, 1.35],
      [-0.225, 0.215, 0.03, 0.086, 1.3],
      [0.225, 0.215, 0.03, 0.086, 1.3],
      [-0.19, 0.22, -0.13, 0.084, 1.28],
      [0.19, 0.22, -0.13, 0.084, 1.28],
      [-0.075, 0.225, -0.22, 0.088, 1.25],
      [0.075, 0.225, -0.22, 0.088, 1.25],
      [0.0, 0.28, -0.14, 0.092, 1.15],
    ];
    for (const [bx, by, bz, r, sy] of blobSpecs) {
      const blob = new THREE.Mesh(new THREE.SphereGeometry(r, 14, 12), creamMat);
      blob.scale.set(1.04, sy, 0.96);
      blob.position.set(bx, by, bz);
      splat.add(blob);
    }

    // 脸上与头侧滑落的 4 颗明显奶油液滴
    const dripSpecs: [number, number, number, number][] = [
      [-0.085, 0.085, 0.235, 0.044],
      [0.105, 0.095, 0.225, 0.04],
      [-0.235, 0.11, 0.06, 0.038],
      [0.235, 0.115, -0.04, 0.038],
    ];
    for (const [dx, dy, dz, dr] of dripSpecs) {
      const drip = new THREE.Mesh(new THREE.SphereGeometry(dr, 12, 10), creamMat);
      drip.scale.set(0.85, 1.65, 0.85);
      drip.position.set(dx, dy, dz);
      splat.add(drip);
    }

    // 奶油尖上的大红樱桃
    const cherry = new THREE.Mesh(new THREE.SphereGeometry(0.062, 14, 12), cherryMat);
    cherry.position.set(0.055, 0.485, 0.035);
    splat.add(cherry);

    splat.scale.setScalar(0.01);
    pt.headPivot.add(splat);
    pt.headPivot.userData.creamSplat = splat;

    // 糊脸 Q 弹出现
    void this.tween(180, (k) => {
      const sc = 0.01 + Math.sin(k * Math.PI * 0.65) * 1.12;
      splat.scale.setScalar(Math.min(1.08, sc));
    }).then(() => {
      if (!this.disposed) splat.scale.setScalar(1);
    });

    // 持续 3 秒后平滑缩小消失
    this.after(durationMs, () => {
      if (this.disposed) return;
      if (pt.headPivot.userData.creamSplat !== splat) return;
      void this.tween(320, (k) => {
        const sc = Math.max(0.01, 1 - k * k);
        splat.scale.setScalar(sc);
      }).then(() => {
        if (pt.headPivot.userData.creamSplat === splat) {
          pt.headPivot.userData.creamSplat = undefined;
        }
        pt.headPivot.remove(splat);
        this.disposeObject3D(splat);
      });
    });
  }

  private async fireMissile(attackerPid: number, rawTarget: PlaneData): Promise<void> {
    const target = this.resolveBottomOfStack(rawTarget);
    const P = this.players[attackerPid];
    const T = this.players[target.pid];
    const targetStack = this.planesOf(target.pid).filter(
      (p) => p.pos === target.pos && p.pos >= 1 && p.pos <= 55,
    );
    if (!targetStack.length) return;

    this.itemBusy = true;
    this.pendingItemTarget = null;
    this.targetChoices = [];
    this.clearHL();
    this.emitSnapshot();

    const rocket = buildToyMissileMesh(lineOf(P));
    const startVec = new THREE.Vector3(P.court[0] * 0.55, 1.4, P.court[1] * 0.55);
    const tc = this.posToCell(T, target.pos);
    const endVec = new THREE.Vector3(tc[0], 0.45, tc[1]);
    const midVec = startVec.clone().lerp(endVec, 0.5);
    midVec.y = Math.max(startVec.y, endVec.y) + 3.4;

    const curve = new THREE.QuadraticBezierCurve3(startVec, midVec, endVec);
    rocket.position.copy(startVec);
    this.scene.add(rocket);

    // 自动跟随视角下特写锁定被炸小熊并全程跟随
    if (this.camMode === 'follow' && !this.camUserInteracting) {
      this.camFollowPlane = target;
      this.camFollowObj = target.mesh;
      this.camFollowCloseup = true;
    }

    this.setMsg(`🚀 ${P.name} 向 ${T.name} 发射了奶油派炸弹！`, P.uiColor);
    this.showItemSplash(P, 'missile', '锁定', 3600, T);
    await this.sleep(1000);
    if (this.disposed) {
      this.scene.remove(rocket);
      this.disposeObject3D(rocket);
      this.camFollowPlane = null;
      this.camFollowObj = null;
      this.camFollowCloseup = false;
      this.itemBusy = false;
      return;
    }
    if (P.type === 'ai') {
      const hadGrudge = (this.offenseScores[attackerPid]?.[target.pid] ?? 0) >= 0.95;
      this.emitAiEmote(
        attackerPid,
        hadGrudge && P.personality === 'vengeful' ? 'stompRevenge' : 'fireMissile',
        1800,
        T.name,
        { probMult: 1.15, delayMinMs: 450, delayMaxMs: 2100 },
      );
    }
    beep(460, 0.16, 'sawtooth', 0.12);

    const tmpPos = new THREE.Vector3();
    const tmpNext = new THREE.Vector3();
    const flame = rocket.userData.flame as THREE.Mesh | undefined;
    await this.tween(920, (k) => {
      curve.getPoint(k, tmpPos);
      curve.getPoint(Math.min(1, k + 0.02), tmpNext);
      rocket.position.copy(tmpPos);
      rocket.lookAt(tmpNext);
      if (flame) {
        const flick = 0.85 + Math.sin(k * 45) * 0.28;
        flame.scale.set(1, flick, 1);
      }
    });

    this.scene.remove(rocket);
    rocket.traverse((obj) => {
      const m = obj as THREE.Mesh;
      if (m.geometry) m.geometry.dispose();
      if (m.material) {
        const mats = Array.isArray(m.material) ? m.material : [m.material];
        mats.forEach((mat) => mat.dispose());
      }
    });
    if (this.disposed) {
      this.camFollowPlane = null;
      this.camFollowObj = null;
      this.camFollowCloseup = false;
      this.itemBusy = false;
      return;
    }

    const shieldedCarrier = targetStack.find((p) => p.shielded);
    if (shieldedCarrier) {
      shieldedCarrier.shielded = false;
      if (this.playerKda[attackerPid]) this.playerKda[attackerPid].shieldBreaks += 1;
      this.syncShieldVisuals();
      this.spawnShieldBreak(tc[0], tc[1]);
      this.triggerShake();
      beep(640, 0.16, 'triangle', 0.15);
      this.setMsg(`🫧 ${T.name} 的软绵绵泡泡罩成功抵挡了奶油派炸弹！`, T.uiColor);
      this.recordOffense(target.pid, attackerPid, 0.4);
      if (T.type === 'ai') {
        this.emitAiEmote(target.pid, 'gotMissiled', 1800, P.name, {
          probMult: 1.1,
          delayMinMs: 950,
          delayMaxMs: 3400,
        });
      }
      await this.sleep(450);
    } else {
      sndCap();
      this.spawnImpact(tc[0], tc[1]);
      this.triggerShake();
      this.recordOffense(target.pid, attackerPid, 0.85);
      if (T.type === 'ai') {
        this.emitAiEmote(target.pid, 'gotMissiled', 1600, P.name, {
          probMult: 1.3,
          delayMinMs: 1100,
          delayMaxMs: 3900,
          allowBystander: true,
        });
      }
      const fromPos = target.pos;
      const stepsBack = Math.min(6, Math.max(0, fromPos - 1));
      if (stepsBack > 0) {
        const finalPos = Math.max(1, fromPos - 6);
        this.setMsg(`🥧 命中！${T.name} 的小熊被奶油派糊了一头，后退 ${stepsBack} 格！`, P.uiColor);
        targetStack.forEach((p) => {
          p.pos = finalPos;
          p.animating = true;
          this.attachCreamSplat(p, 4200);
        });
        const c = this.posToCell(T, finalPos);
        const yaw = this.faceTravelDir(target);
        const baseCount = this.planes.filter(
          (q) => !targetStack.includes(q) && q.pid === target.pid && q.pos === finalPos,
        ).length;

        await Promise.all(
          targetStack.map((p, i) => {
            const m = p.mesh;
            const pt = m.userData.parts as PlaneParts;
            const sx = m.position.x;
            const sy = m.position.y;
            const sz = m.position.z;
            const syaw = m.rotation.y;
            const landY = 0.12 + (baseCount + i) * STACK_STEP_Y;
            return this.tween(640, (k) => {
              const ease = 1 - Math.pow(1 - k, 1.8);
              m.position.x = THREE.MathUtils.lerp(sx, c[0], ease);
              m.position.z = THREE.MathUtils.lerp(sz, c[1], ease);
              m.position.y = THREE.MathUtils.lerp(sy, landY, ease) + Math.sin(k * Math.PI) * 2.15;
              m.rotation.y = lerpAngle(syaw, yaw, ease);
              pt.animRoot.rotation.x = -k * Math.PI * 2;
              pt.animRoot.rotation.z = Math.sin(k * Math.PI * 3) * 0.42;
              pt.leftArm.rotation.z = 1.45;
              pt.rightArm.rotation.z = -1.45;
              pt.leftFoot.rotation.x = Math.sin(k * Math.PI * 6) * 0.6;
              pt.rightFoot.rotation.x = -Math.sin(k * Math.PI * 6) * 0.6;
            }).then(() => {
              m.position.set(c[0], landY, c[1]);
              m.rotation.set(0, yaw, 0);
              m.userData.stackBaseX = c[0];
              m.userData.stackBaseY = landY;
              m.userData.stackBaseZ = c[1];
              m.userData.stackBaseYaw = yaw;
              m.userData.stackIdx = baseCount + i;
              m.userData.stackTotal = baseCount + targetStack.length;
              pt.animRoot.rotation.set(0, 0, 0);
              pt.leftArm.rotation.set(0, 0, 0);
              pt.rightArm.rotation.set(0, 0, 0);
              pt.leftFoot.rotation.set(0, 0, 0);
              pt.rightFoot.rotation.set(0, 0, 0);
              p.animating = false;
            });
          }),
        );
        if (this.disposed) {
          this.itemBusy = false;
          return;
        }
        this.spawnImpact(c[0], c[1]);
        // 击退落点若有其他玩家棋子，触发踩踏/破盾效果
        await this.captureAt(target);
      } else {
        targetStack.forEach((p) => {
          this.attachCreamSplat(p, 4200);
        });
        this.setMsg(`🥧 奶油派命中 ${T.name}（已在第 1 格，糊了一头奶油啦~）`, P.uiColor);
      }
      this.onRetaliationSuccess(attackerPid, target.pid, 'missile');
    }

    this.relayout();
    this.syncShieldVisuals();
    if (this.camFollowPlane === target && this.camFollowCloseup) {
      await this.sleep(650);
      if (this.camFollowPlane === target) {
        this.camFollowPlane = null;
        this.camFollowObj = null;
        this.camFollowCloseup = false;
        if (!this.disposed && this.camMode === 'follow' && !this.camUserInteracting) {
          this.focusTurn();
        }
      }
    }
    this.itemBusy = false;
    this.emitSnapshot();
  }

  private evaluatePlaneStompRisk(plane: PlaneData): {
    rawProb: number;
    valueRisk: number;
    pursuerPids: number[];
  } {
    if (plane.pos < 1 || plane.pos >= HOME_END) {
      return { rawProb: 0, valueRisk: 0, pursuerPids: [] };
    }
    const me = plane.pid;
    const myPlanes = this.planesOf(me);
    const stackCount = myPlanes.filter((q) => q.pos === plane.pos).length;
    if (plane.pos >= 51 && plane.pos !== 54) {
      return { rawProb: 0, valueRisk: 0, pursuerPids: [] };
    }

    let rawProb = 0;
    const pursuerSet = new Set<number>();

    if (plane.pos === 54) {
      const ct = this.oppCrossFlyThreat(me);
      if (ct.oppPid >= 0) {
        const oppInv = this.playerItems[ct.oppPid];
        if (ct.immediate) {
          rawProb += 0.30 + (oppInv?.sixDie || oppInv?.twinDice ? 0.14 : 0);
          pursuerSet.add(ct.oppPid);
        } else if (ct.near) {
          rawProb += 0.10;
        }
      }
    } else {
      const myRing = this.ringIndexOf(plane);
      for (const q of this.planes) {
        if (q.pid === me) continue;
        const oppP = this.players[q.pid];
        const oppInv = this.playerItems[q.pid];
        const oppPersonality: AiPersonality = oppP?.personality ?? 'tactician';
        const aggroMult =
          oppPersonality === 'rusher' || oppPersonality === 'vengeful' ? 1.15 : 0.95;

        if (q.pos >= 1 && q.pos <= 50) {
          const d = (myRing - this.ringIndexOf(q) + 52) % 52;
          if (d >= 1 && d <= 6) {
            let pHit = (1 / 6) * aggroMult;
            if (d === 6 && (oppInv?.sixDie ?? 0) > 0) pHit += 0.16;
            if ((oppInv?.twinDice ?? 0) > 0 || (oppInv?.refuel ?? 0) > 0) pHit += 0.08;
            rawProb += pHit;
            pursuerSet.add(q.pid);
          } else if (d >= 7 && d <= 10) {
            const midPos = q.pos + (d - 4);
            if (midPos >= 1 && midPos <= 49 && midPos % 4 === 2) {
              rawProb += 0.14 * aggroMult;
              pursuerSet.add(q.pid);
            }
          }
        } else if (q.pos === 0 && oppP) {
          const startRing = (oppP.start + 2) % 52;
          const d = (myRing - startRing + 52) % 52;
          if (d >= 1 && d <= 6) {
            rawProb += 0.15 * aggroMult + (d === 6 && (oppInv?.sixDie ?? 0) > 0 ? 0.12 : 0);
            pursuerSet.add(q.pid);
          }
        }
      }
      // 高进度或叠机也面临对手导弹打击风险
      const enemyHasMissile = this.players.some(
        (_, pid) => pid !== me && (this.playerItems[pid]?.missile ?? 0) > 0,
      );
      if (enemyHasMissile && (plane.pos >= 22 || stackCount >= 2)) {
        rawProb += stackCount >= 2 ? 0.18 : 0.10;
      }
    }

    const progressFactor = plane.pos === 54 ? 1.55 : 0.45 + (plane.pos / 50) * 1.15;
    const stackMult = 1 + (stackCount - 1) * 0.75;
    const valueRisk = rawProb * 100 * progressFactor * stackMult;
    return { rawProb, valueRisk, pursuerPids: Array.from(pursuerSet) };
  }

  private async aiTryUseItems(): Promise<boolean> {
    if (this.disposed || this.phase !== 'aiWait' || !this.isAI()) return false;
    let usedAnyItem = false;
    const me = this.turn;
    const inv = this.playerItems[me];
    const P = this.players[me];
    const personality: AiPersonality = P.personality ?? 'tactician';
    const myTurnNow = this.playerTurnCount[me] ?? 0;
    const turnsHeld = (item: ItemType) =>
      myTurnNow - (this.itemLastGainedTurn[me]?.[item] ?? -99);

    const myPlanes = this.planesOf(me);
    const activeBoard = myPlanes.filter((p) => p.pos >= 0 && p.pos < HOME_END);
    const boardRisks = activeBoard
      .filter((p) => !p.shielded)
      .map((p) => ({ plane: p, ...this.evaluatePlaneStompRisk(p) }))
      .sort((a, b) => b.valueRisk - a.valueRisk);
    const maxUnshieldedRisk = boardRisks[0]?.valueRisk ?? 0;
    const pursuerPidSet = new Set<number>(boardRisks.flatMap((r) => r.pursuerPids));

    // 1) 环境反制导弹：获得后先观望，结合性格、威胁系数与追兵被踩风险决定是否发射
    if (inv.missile > 0) {
      const held = turnsHeld('missile');
      const targets = this.buildTargetChoices('missile', me);
      if (targets.length > 0) {
        const scored = targets
          .map((t) => {
            const enemyPid = t.plane.pid;
            const enemyDone = this.planesOf(enemyPid).filter((q) => q.pos === HOME_END).length;
            const threatCoeff = this.computeThreatCoeff(me, enemyPid);
            const isStompPursuer = pursuerPidSet.has(enemyPid) && maxUnshieldedRisk >= 20;
            const shieldPenalty = t.plane.shielded ? 0.35 : 1;
            const leadPart = t.plane.pos * 0.9 + enemyDone * 10;
            let score =
              (leadPart * (personality === 'vengeful' ? 0.45 : 0.9) +
                t.stackCount * 8 +
                (threatCoeff - 1.0) * (personality === 'vengeful' ? 52 : 34) +
                (isStompPursuer ? 26 : 0)) *
              shieldPenalty;
            if (personality === 'rusher') score += enemyDone * 12;
            if (personality === 'tactician' && t.stackCount >= 2) score += 20;
            return { t, score, threatCoeff, enemyDone, isStompPursuer };
          })
          .sort((a, b) => b.score - a.score);

        const best = scored[0];
        const emergency =
          best.t.plane.pos >= 44 ||
          (best.threatCoeff >= 2.2 && !best.t.plane.shielded && best.t.plane.pos >= 22);
        const canFireThisTurn = held >= 2 || (held >= 1 && (emergency || best.isStompPursuer)) || emergency;

        const shouldFire =
          canFireThisTurn &&
          (personality === 'vengeful'
            ? (best.threatCoeff >= 1.8 && best.t.plane.pos >= 10) ||
              best.t.plane.pos >= 28 ||
              best.isStompPursuer
            : personality === 'chill'
              ? !best.t.plane.shielded &&
                (best.t.plane.pos >= 40 || best.enemyDone >= 3 || (best.isStompPursuer && maxUnshieldedRisk >= 34))
              : personality === 'rusher'
                ? (!best.t.plane.shielded && best.t.plane.pos >= 20) || best.t.plane.pos >= 32
                : !best.t.plane.shielded &&
                  (best.t.plane.pos >= 26 || best.t.stackCount >= 2 || best.isStompPursuer || best.threatCoeff >= 1.85));

        if (shouldFire && !this.turnUsedAtkDef) {
          inv.missile -= 1;
          this.turnUsedAtkDef = true;
          usedAnyItem = true;
          await this.fireMissile(me, best.t.plane);
          if (this.disposed) return true;
        }
      }
    }

    // 2) 每回合最多 1 张攻击/防御类道具（需评估被踩风险 + 持有回合 + 性格策略）
    if (!this.turnUsedAtkDef) {
      const hasInBase = myPlanes.some((p) => p.pos === -1);
      const onBoardCount = activeBoard.length;
      const tryShield = async (minRisk: number): Promise<boolean> => {
        if (inv.shield <= 0) return false;
        const shieldCands = this.buildTargetChoices('shield', me);
        const endangered = shieldCands
          .map((c) => {
            const r = this.evaluatePlaneStompRisk(c.plane);
            return { c, valueRisk: r.valueRisk, rawProb: r.rawProb };
          })
          .sort((a, b) => b.valueRisk - a.valueRisk);

        if (endangered.length > 0 && endangered[0].rawProb > 0 && endangered[0].valueRisk >= minRisk) {
          inv.shield -= 1;
          endangered[0].c.plane.shielded = true;
          this.turnUsedAtkDef = true;
          this.syncShieldVisuals();
          const cPos = this.posToCell(P, endangered[0].c.plane.pos);
          this.spawnShieldBreak(cPos[0], cPos[1]);
          this.setMsg('🫧 香布布~香布布~浑身香香的布布~', P.uiColor);
          this.showItemSplash(P, 'shield');
          this.emitAiEmote(me, 'useShield', 1800);
          usedAnyItem = true;
          this.emitSnapshot();
          return true;
        }
        return false;
      };

      const sixEval = () => {
        let exactGoal = false;
        let flyOrThreatStomp = false;
        for (const p of activeBoard) {
          if (p.pos === HOME_END - 6) exactGoal = true;
          if (p.pos === 0 || (p.pos >= 1 && p.pos <= 44)) {
            const L = this.simulateMoveOutcome(p, 6);
            if (L.fly) flyOrThreatStomp = true;
            for (const sp of L.ringStops) {
              const rIdx = (P.start + 2 + sp) % 52;
              for (const q of this.planes) {
                if (q.pid !== me && q.pos >= 1 && q.pos <= 50 && this.ringIndexOf(q) === rIdx) {
                  if (this.computeThreatCoeff(me, q.pid) >= 1.5 || q.pos >= 20 || personality === 'rusher') {
                    flyOrThreatStomp = true;
                  }
                }
              }
            }
          }
        }
        return { exactGoal, flyOrThreatStomp };
      };

      const useSixDie = async () => {
        inv.sixDie -= 1;
        this.armedSixDie = true;
        this.turnUsedAtkDef = true;
        this.setMsg(`🎲 ${P.name} 使用了「幸运草莓蛋糕」！`, P.uiColor);
        this.showItemSplash(P, 'sixDie');
        this.emitAiEmote(me, 'useSpeedItem', 1800);
        usedAnyItem = true;
        this.emitSnapshot();
      };

      const useRefuel = async () => {
        inv.refuel -= 1;
        this.armedRefuel = true;
        this.turnUsedAtkDef = true;
        this.setMsg(`⛽ ${P.name} 使用了「再来一口小饼干」！`, P.uiColor);
        this.showItemSplash(P, 'refuel');
        this.emitAiEmote(me, 'useSpeedItem', 1800);
        usedAnyItem = true;
        this.emitSnapshot();
      };

      const useTwinDice = async () => {
        inv.twinDice -= 1;
        this.armedTwinDice = true;
        this.turnUsedAtkDef = true;
        this.setMsg(`⚙️ ${P.name} 启动了「双倍珍珠奶茶」！`, P.uiColor);
        this.showItemSplash(P, 'twinDice');
        this.emitAiEmote(me, 'useSpeedItem', 1800);
        usedAnyItem = true;
        this.emitSnapshot();
      };

      // 刚在本回合（例如连投前）或才拿到还没隔一轮时，谨慎持有，除非遇到极高风险/绝杀
      const shieldUrgent = maxUnshieldedRisk >= 44;
      const shieldFloor =
        personality === 'chill'
          ? 18
          : personality === 'vengeful'
            ? 22
            : personality === 'tactician'
              ? 24
              : 34;

      // 1) 先根据性格与被踩风险决定是否交护盾
      if (
        (personality === 'chill' || personality === 'tactician' || personality === 'vengeful') &&
        (turnsHeld('shield') >= 1 || shieldUrgent) &&
        (await tryShield(shieldFloor))
      ) {
        return usedAnyItem;
      }

      // 2) 评估加速/进攻卡使用时机（不能刚拿就无脑丢）
      const twinEval = () => {
        if (onBoardCount === 0 && hasInBase) {
          // 双骰起飞率 20/36 (55.6%)，若无 6 数骰可作为起飞备选
          return { expectedScore: 18, shouldTakeoff: true, highOvershootRisk: false };
        }
        const safeCount = activeBoard.filter((p) => p.pos >= 46).length;
        const highOvershootRisk = activeBoard.length > 0 && safeCount === activeBoard.length;
        let totalWeighted = 0;
        const weights = [0, 0, 1, 2, 3, 4, 5, 6, 5, 4, 3, 2, 1];
        for (let sum = 2; sum <= 12; sum++) {
          let bestSumScore = -999;
          for (const p of activeBoard) {
            const L = this.simulateMoveOutcome(p, sum);
            let sc = sum * 0.9;
            if (L.fly) sc += 26;
            else if (L.jump) sc += 14;
            if (L.pos === HOME_END) sc += 32;
            if (p.pos >= 51 && L.pos < p.pos) sc -= 24;
            for (const sp of L.ringStops) {
              const rIdx = (P.start + 2 + sp) % 52;
              if (this.planes.some((q) => q.pid !== me && q.pos >= 1 && q.pos <= 50 && this.ringIndexOf(q) === rIdx)) {
                sc += 24;
              }
            }
            if (sc > bestSumScore) bestSumScore = sc;
          }
          totalWeighted += bestSumScore * (weights[sum] / 36);
        }
        return { expectedScore: totalWeighted, shouldTakeoff: false, highOvershootRisk };
      };
      const s6 = sixEval();
      const stwin = twinEval();
      const sixHeld = turnsHeld('sixDie');
      const twinHeld = turnsHeld('twinDice');
      const refuelHeld = turnsHeld('refuel');
      const escapeNeed = maxUnshieldedRisk >= 28;

      if (personality === 'rusher') {
        if (
          inv.sixDie > 0 &&
          (s6.exactGoal ||
            (sixHeld >= 1 && (s6.flyOrThreatStomp || onBoardCount === 0)) ||
            (sixHeld >= 2 && hasInBase && onBoardCount <= 2))
        ) {
          await useSixDie();
          return usedAnyItem;
        }
        if (
          inv.refuel > 0 &&
          ((refuelHeld >= 1 && (escapeNeed || activeBoard.some((p) => p.pos >= 10))) ||
            (refuelHeld >= 2 && activeBoard.length > 0))
        ) {
          await useRefuel();
          return usedAnyItem;
        }
        if (
          inv.twinDice > 0 &&
          !stwin.highOvershootRisk &&
          (stwin.shouldTakeoff ||
            (twinHeld >= 1 && (escapeNeed || stwin.expectedScore >= 16)) ||
            (twinHeld >= 2 && activeBoard.some((p) => p.pos >= 4 && p.pos <= 44)))
        ) {
          await useTwinDice();
          return usedAnyItem;
        }
        if ((turnsHeld('shield') >= 1 || shieldUrgent) && (await tryShield(shieldFloor))) return usedAnyItem;
      } else if (personality === 'chill') {
        if (
          inv.sixDie > 0 &&
          (s6.exactGoal || (sixHeld >= 2 && hasInBase && onBoardCount === 0))
        ) {
          await useSixDie();
          return usedAnyItem;
        }
        if (
          inv.refuel > 0 &&
          ((refuelHeld >= 1 && escapeNeed) ||
            (refuelHeld >= 2 && activeBoard.some((p) => p.pos >= 18) && Math.random() < 0.7))
        ) {
          await useRefuel();
          return usedAnyItem;
        }
        if (
          inv.twinDice > 0 &&
          ((twinHeld >= 1 && escapeNeed) ||
            (twinHeld >= 2 && activeBoard.some((p) => p.pos >= 16 && p.pos <= 38) && Math.random() < 0.65))
        ) {
          await useTwinDice();
          return usedAnyItem;
        }
      } else if (personality === 'vengeful') {
        const hasHotThreat = this.getTopThreatPid(me) >= 0;
        if (
          inv.sixDie > 0 &&
          (s6.exactGoal ||
            (sixHeld >= 1 && (s6.flyOrThreatStomp || onBoardCount === 0)) ||
            (sixHeld >= 2 && hasInBase && hasHotThreat))
        ) {
          await useSixDie();
          return usedAnyItem;
        }
        if (
          inv.twinDice > 0 &&
          ((twinHeld >= 1 && (escapeNeed || (hasHotThreat && activeBoard.some((p) => p.pos >= 6 && p.pos <= 42)))) ||
            (twinHeld >= 2 && activeBoard.some((p) => p.pos >= 8 && p.pos <= 42)))
        ) {
          await useTwinDice();
          return usedAnyItem;
        }
        if (
          inv.refuel > 0 &&
          ((refuelHeld >= 1 && (escapeNeed || hasHotThreat)) ||
            (refuelHeld >= 2 && activeBoard.some((p) => p.pos >= 8)))
        ) {
          await useRefuel();
          return usedAnyItem;
        }
      } else {
        // 精算稳健型：先评估收益与风险，绝不盲目交卡
        if (
          inv.sixDie > 0 &&
          (s6.exactGoal ||
            (sixHeld >= 1 && (s6.flyOrThreatStomp || (onBoardCount === 0 && hasInBase))) ||
            (sixHeld >= 2 && hasInBase && onBoardCount <= 1))
        ) {
          await useSixDie();
          return usedAnyItem;
        }
        if (
          inv.refuel > 0 &&
          ((refuelHeld >= 1 && escapeNeed) ||
            (refuelHeld >= 2 && activeBoard.some((p) => p.pos >= 14 && p.pos <= 46)))
        ) {
          await useRefuel();
          return usedAnyItem;
        }
        if (
          inv.twinDice > 0 &&
          ((twinHeld >= 1 && escapeNeed && activeBoard.some((p) => p.pos <= 43)) ||
            (twinHeld >= 2 && activeBoard.some((p) => p.pos >= 16 && p.pos <= 40)))
        ) {
          await useTwinDice();
          return usedAnyItem;
        }
      }
    }
    return usedAnyItem;
  }

  /* ================= Public User Actions ================= */
  public triggerActionPod(): void {
    if (this.paused || this.disposed || this.itemBusy) return;
    ensureAudio();
    if (this.phase === 'awaitRoll' && !this.isAI()) {
      if (this.pendingItemTarget !== null) {
        this.cancelItemTarget();
      }
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
    if (this.paused || this.disposed || this.itemBusy) return;
    if (this.phase === 'awaitMove' && !this.isAI() && this.die !== null) {
      const target = this.movable.find((m) => m.plane.idx === idx) ?? this.movable[idx];
      if (target) {
        ensureAudio();
        this.performMove(target.plane, this.die);
      }
    }
  }

  public useItem(type: ItemType): void {
    if (this.paused || this.disposed || this.itemBusy) return;
    if (this.phase !== 'awaitRoll' || this.isAI()) return;
    const inv = this.playerItems[this.turn];
    if (!inv || inv[type] <= 0) return;
    const def = ITEM_DEFS[type];

    if (type === 'shield') {
      if (this.turnUsedDef) {
        this.setMsg('🫧 下回合再洗香香~');
        return;
      }
    } else if (this.turnUsedAtkDef) {
      this.setMsg('🍰 已经吃不下啦~');
      return;
    }

    ensureAudio();

    if (type === 'sixDie' || type === 'twinDice' || type === 'refuel') {
      const alreadySelected =
        (type === 'sixDie' && this.armedSixDie) ||
        (type === 'twinDice' && this.armedTwinDice) ||
        (type === 'refuel' && this.armedRefuel && !this.refuelCarriedOver);
      this.armedSixDie = false;
      this.armedTwinDice = false;
      if (!this.refuelCarriedOver) this.armedRefuel = false;
      this.pendingItemTarget = null;
      this.targetChoices = [];
      this.clearHL();
      if (!alreadySelected) {
        if (type === 'sixDie') this.armedSixDie = true;
        if (type === 'twinDice') this.armedTwinDice = true;
        if (type === 'refuel') this.armedRefuel = true;
      }
      beep(alreadySelected ? 480 : 660, 0.08, 'triangle', 0.11);
      this.emitSnapshot();
      return;
    }

    if (type === 'shield' || type === 'missile') {
      if (type === 'missile') {
        this.armedSixDie = false;
        this.armedTwinDice = false;
        if (!this.refuelCarriedOver) this.armedRefuel = false;
      }
      if (this.pendingItemTarget === type) {
        this.cancelItemTarget();
        return;
      }
      const choices = this.buildTargetChoices(type, this.turn);
      if (choices.length === 0) {
        this.setMsg(
          type === 'shield'
            ? '🫧 场上暂无可套泡泡罩的己方小熊（不可叠加）'
            : '🥧 场上暂无可丢奶油派的敌方小熊（起点与终点除外）',
        );
        return;
      }
      this.pendingItemTarget = type;
      this.targetChoices = choices;
      this.highlight(
        choices.map((c) => ({ plane: c.plane })),
        type === 'shield' ? 0x2b8bd4 : 0xef4444,
      );
      this.setMsg(
        type === 'shield'
          ? '🫧 请点选场上己方小熊套上软绵绵泡泡罩'
          : '🥧 请点选场上敌方小熊丢出奶油派炸弹',
      );
      this.emitSnapshot();
    }
  }

  public cancelItemTarget(): void {
    if (this.pendingItemTarget === null) return;
    this.pendingItemTarget = null;
    this.targetChoices = [];
    this.clearHL();
    this.message = null;
    if (this.msgTimer !== null) window.clearTimeout(this.msgTimer);
    this.emitSnapshot();
  }

  public pickItemTarget(pid: number, idx: number): void {
    if (this.paused || this.disposed || this.itemBusy) return;
    if (this.phase !== 'awaitRoll' || this.isAI() || !this.pendingItemTarget) return;
    const match = this.targetChoices.find(
      (c) => c.plane.pid === pid && c.plane.idx === idx,
    );
    if (!match) return;

    ensureAudio();
    const kind = this.pendingItemTarget;
    const inv = this.playerItems[this.turn];

    if (kind === 'shield') {
      if (inv.shield <= 0 || this.turnUsedDef) return;
      inv.shield -= 1;
      match.plane.shielded = true;
      this.turnUsedDef = true;
      this.pendingItemTarget = null;
      this.targetChoices = [];
      this.clearHL();
      this.syncShieldVisuals();
      const cPos = this.posToCell(this.players[pid], match.plane.pos);
      this.spawnShieldBreak(cPos[0], cPos[1]);
      beep(740, 0.12, 'triangle', 0.14);
      this.setMsg('🫧 香布布~香布布~浑身香香的布布~');
      this.showItemSplash(this.cur(), 'shield', `为 #${match.plane.idx + 1} 号小熊套上泡泡罩`);
      this.emitSnapshot();
    } else if (kind === 'missile') {
      if (inv.missile <= 0 || this.turnUsedAtkDef) return;
      inv.missile -= 1;
      this.turnUsedAtkDef = true;
      void this.fireMissile(this.turn, match.plane);
    }
  }

  public pickShopItem(item: ItemType): void {
    if (this.disposed || this.phase !== 'shopChoice' || this.shopPid === null) return;
    if (this.shopOffer && !this.shopOffer.includes(item)) return;
    ensureAudio();
    const pid = this.shopPid;
    const pl = this.players[pid];
    const again = this.shopPendingAgain;
    const postAction = this.shopPostAction;
    this.grantItem(pid, item);
    this.shopOffer = null;
    this.shopDeadline = null;
    this.shopPid = null;
    this.shopPendingAgain = false;
    this.shopPostAction = null;
    this.lastShopSec = -1;
    const def = ITEM_DEFS[item];
    beep(784, 0.14, 'triangle', 0.15);
    this.setMsg(`🎁 ${pl.name} 在商店获得了 ${def.icon} ${def.name}！`, pl.uiColor);
    this.showShopSplash(pl, item);
    if (postAction) {
      this.phase = 'moving';
      this.emitSnapshot();
      void postAction();
      return;
    }
    this.emitSnapshot();
    this.endTurn(again);
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
    if (val !== null && this.phase === 'awaitRoll' && !this.isAI() && !this.paused && !this.disposed && !this.itemBusy) {
      ensureAudio();
      if (this.pendingItemTarget !== null) this.cancelItemTarget();
      this.doRoll();
    }
  }

  private resolveGmTargetPid(pid?: number): number {
    if (pid !== undefined && this.players[pid]) return pid;
    if (this.players[this.turn]?.type === 'human') return this.turn;
    const firstHuman = this.players.findIndex((p) => p.type === 'human');
    return firstHuman >= 0 ? firstHuman : this.turn;
  }

  public gmGrantItem(type: ItemType, pid?: number): void {
    if (this.disposed) return;
    const targetPid = this.resolveGmTargetPid(pid);
    const inv = this.playerItems[targetPid];
    if (!inv) return;
    inv[type] = (inv[type] ?? 0) + 1;
    ensureAudio();
    beep(740, 0.07, 'triangle', 0.1);
    this.emitSnapshot();
  }

  public gmClearItems(pid?: number): void {
    if (this.disposed) return;
    const targetPid = this.resolveGmTargetPid(pid);
    const inv = this.playerItems[targetPid];
    if (!inv) return;
    for (const k of ITEM_ORDER) {
      inv[k] = 0;
    }
    if (targetPid === this.turn) {
      this.armedSixDie = false;
      this.armedTwinDice = false;
      if (!this.refuelCarriedOver) this.armedRefuel = false;
      if (this.pendingItemTarget !== null) this.cancelItemTarget();
    }
    ensureAudio();
    beep(420, 0.08, 'triangle', 0.1);
    this.emitSnapshot();
  }

  private onEnterTimeOfDay(tod: TimeOfDay): void {
    if ((tod === 'noon' || tod === 'afternoon') && this.mapConfig.enableCritterSpawns) {
      this.after(3500, () => {
        if (this.disposed || (this.timeOfDay !== 'noon' && this.timeOfDay !== 'afternoon')) return;
        this.world.spawnCritter?.('bird', { species: 'seagull', perch: true });
      });
    }
    if (tod === 'evening') {
      const nowT = this.clock.elapsedTime;
      if (this.nextGlobalCakeEatAt - nowT > 18) {
        this.nextGlobalCakeEatAt = nowT + 6 + Math.random() * 8;
      }
    }
  }

  public setGmTimeOfDay(tod: TimeOfDay): void {
    if (this.disposed) return;
    if (this.timeOfDay === tod && this.todBlend >= 1) return;
    this.todFrom = this.mapConfig.timePresets[this.timeOfDay];
    this.todTo = this.mapConfig.timePresets[tod];
    this.timeOfDay = tod;
    this.todBlend = 0;
    this.onEnterTimeOfDay(tod);
    this.emitSnapshot();
  }

  public toggleGmAutoPlay(): void {
    if (this.disposed) return;
    this.gmAutoPlay = !this.gmAutoPlay;
    this.emitSnapshot();
    if (!this.gmAutoPlay || this.paused || this.isAI() || this.itemBusy) return;
    if (this.phase === 'awaitRoll') {
      this.after(450, () => {
        if (!this.disposed && this.gmAutoPlay && this.phase === 'awaitRoll' && !this.isAI() && !this.itemBusy) {
          ensureAudio();
          if (this.pendingItemTarget !== null) this.cancelItemTarget();
          this.doRoll();
        }
      });
    } else if (this.phase === 'awaitMove' && this.movable.length > 0 && this.die !== null) {
      const d = this.die;
      const picked = this.aiPick(this.movable);
      this.after(450, () => {
        if (!this.disposed && this.gmAutoPlay && this.phase === 'awaitMove' && !this.isAI()) {
          void this.performMove(picked.plane, d);
        }
      });
    } else if (this.phase === 'shopChoice' && this.shopOffer && this.shopOffer.length > 0) {
      const chosen = this.aiChooseShopItem(this.shopOffer, this.shopPid ?? this.turn);
      this.pickShopItem(chosen);
    }
  }

  public setQuality(q: GraphicsQuality): void {
    this.quality = q;
    if (this.disposed || this.isSoftwareGl) return;
    const maxDpr = q === 'low' ? 1 : q === 'medium' ? 1.4 : 2;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, maxDpr));
    this.renderer.shadowMap.autoUpdate = q === 'high';
    this.shadowInterval = q === 'low' ? 4 : q === 'medium' ? 2 : 1;
    this.renderer.shadowMap.needsUpdate = true;
    if (!this.isContextLost) {
      this.renderer.render(this.scene, this.camera);
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
      this.camFollowCloseup = false;
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
    if (total === 4) {
      return [
        { lx: -0.198, lz: 0.178 },
        { lx: 0.198, lz: 0.178 },
        { lx: -0.198, lz: -0.178 },
        { lx: 0.198, lz: -0.178 },
      ];
    }
    const pts: { lx: number; lz: number }[] = [];
    const r = 0.255;
    for (let k = 0; k < total; k++) {
      const a = (k / total) * Math.PI * 2;
      pts.push({ lx: Math.cos(a) * r, lz: Math.sin(a) * r });
    }
    return pts;
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
      const distinctPids = new Set(grp.map((g) => g.pid)).size;
      const isMixedRingHuddle = k.startsWith('r') && distinctPids >= 2;
      if (!isMixedRingHuddle) {
        grp.sort((a, b) => a.idx - b.idx);
      }

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
        } else if (p.pos === 0 || isMixedRingHuddle) {
          // START 区域或护盾挡踩共格：采用真实软体接触面压平，实现「脸挤脸」并排站立
          const c = this.posToCell(this.players[p.pid], p.pos);
          const baseYaw = isMixedRingHuddle ? this.faceTravelDir(grp[0]) : this.faceTravelDir(p);
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
              const dlx = nb.lx - me.lx;
              const dlz = nb.lz - me.lz;
              const wdx = dlx * cosY + dlz * sinY;
              const wdz = -dlx * sinY + dlz * cosY;
              const dist = Math.hypot(wdx, wdz) || 1;
              const cYaw = Math.cos(yaw);
              const sYaw = Math.sin(yaw);
              const lnx = (wdx * cYaw - wdz * sYaw) / dist;
              const lnz = (wdx * sYaw + wdz * cYaw) / dist;
              const maxProj = (dist * 0.5) / 0.92;
              contacts.push({ nx: lnx, nz: lnz, maxProj });
            }
            this.applyCheekSquishDeform(p, contacts, i % 2 === 0 ? 'w' : 'open');
          } else {
            this.applyCheekSquishDeform(p, []);
          }
        } else if (p.pos === HOME_END) {
          // 终点欢呼小方阵：在己方终点区域内整齐错开站位（不叠叠乐），全员开心挥手欢呼
          const c = this.posToCell(this.players[p.pid], HOME_END);
          const baseYaw = this.players[p.pid].finalYaw;
          const formations: Record<number, [number, number][]> = {
            1: [[0, 0]],
            2: [
              [-0.31, 0.04],
              [0.31, 0.04],
            ],
            3: [
              [-0.33, 0.12],
              [0.33, 0.12],
              [0, -0.24],
            ],
            4: [
              [-0.32, 0.15],
              [0.32, 0.15],
              [-0.27, -0.23],
              [0.27, -0.23],
            ],
          };
          const pts = formations[Math.min(4, Math.max(1, total))] ?? formations[4];
          const [lx, lz] = pts[Math.min(i, pts.length - 1)];
          const cosY = Math.cos(baseYaw);
          const sinY = Math.sin(baseYaw);
          x = c[0] + lx * cosY + lz * sinY;
          z = c[1] - lx * sinY + lz * cosY;
          y = 0.12;
          yaw = baseYaw + (lx < -0.05 ? 0.14 : lx > 0.05 ? -0.14 : 0);
          stackIdx = 0;
          stackTotal = 1;
          this.applyCheekSquishDeform(p, []);
        } else {
          // 同阵营棋盘重叠时采用垂直「叠叠乐」堆叠（idx 最小在最底）
          const c = this.posToCell(this.players[p.pid], p.pos);
          x = c[0];
          z = c[1];
          y = 0.12 + i * STACK_STEP_Y;
          yaw = this.faceTravelDir(p);
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
        if (p.pos !== 0 && !isMixedRingHuddle) {
          this.applyCheekSquishDeform(p, []);
          p.mesh.userData.huddleTotal = 1;
          p.mesh.userData.huddleRoll = 0;
          p.mesh.userData.huddlePitch = 0;
        }
      });
    }
    this.syncShieldVisuals();
  }

  /* ================= Highlighting ================= */
  private getBadgeTexture(label: string, bgColor = '#1f9d55'): THREE.CanvasTexture {
    const key = `${label}_${bgColor}`;
    let tex = this.badgeTexCache.get(key);
    if (!tex) {
      tex = createNumberBadgeTexture(label, this.anisotropy, bgColor);
      this.badgeTexCache.set(key, tex);
    }
    return tex;
  }

  private highlight(list: { plane: PlaneData }[], ringHex = 0x3aa66b): void {
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
          new THREE.MeshBasicMaterial({ color: ringHex }),
        );
        ring.rotation.x = -Math.PI / 2;
        c.plane.mesh.add(ring);
        ring.position.set(0, -0.02, 0);
        this.hlRings.push(ring);
      }
      const groupKey = c.plane.pos <= 0 ? `single_${c.plane.pid}_${c.plane.idx}` : `${c.plane.pid}_${cellKey}`;
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
      const cone = hint.children[0] as THREE.Mesh | undefined;
      if (cone && (cone.material as THREE.MeshStandardMaterial).color) {
        const cm = cone.material as THREE.MeshStandardMaterial;
        cm.color.setHex(ringHex);
        cm.emissive.setHex(ringHex);
      }
      const badgeColor =
        ringHex === 0xef4444 ? '#ef4444' : ringHex === 0x2b8bd4 ? '#2b8bd4' : '#1f9d55';
      const badge = hint.children[1] as THREE.Sprite | undefined;
      if (badge) {
        const tex = this.getBadgeTexture(label, badgeColor);
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
    this.hlRings.forEach((r) => {
      if (r.parent) r.parent.remove(r);
      r.geometry.dispose();
      (r.material as THREE.Material).dispose();
    });
    this.hlRings.length = 0;
    this.pickHints.forEach((h) => (h.visible = false));
  }

  /* ================= Dice & Turn Flow ================= */
  private movablePlanes(
    pid: number,
    die: number,
    allowTakeoff = die === 5 || die === 6,
  ): { plane: PlaneData }[] {
    const active = this.planesOf(pid)
      .filter((p) => {
        if (p.pos === HOME_END) return false;
        if (p.pos === -1) return allowTakeoff;
        return true;
      })
      .sort((a, b) => a.idx - b.idx);
    // 棋盘上同格叠叠乐只控制最底下那只
    const seenStack = new Set<string>();
    const result: { plane: PlaneData }[] = [];
    for (const p of active) {
      if (p.pos >= 1) {
        const key = `${p.pid}-${p.pos}`;
        if (seenStack.has(key)) continue;
        seenStack.add(key);
      }
      result.push({ plane: p });
    }
    return result;
  }

  private async animDice(die: number): Promise<void> {
    sndRoll();
    this.diceRig.dice2.visible = false;
    this.diceRig.dice2Shadow.visible = false;
    this.diceRig.dice.position.x = 0;
    this.diceRig.diceShadow.position.x = 0;
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

  private async animTwinDice(d1: number, d2: number): Promise<void> {
    sndRoll();
    const { dice, dice2, diceShadow, dice2Shadow } = this.diceRig;
    dice2.visible = !this.stage4CampfireActive;
    dice2Shadow.visible = !this.stage4CampfireActive;
    dice.scale.setScalar(0.47);
    dice2.scale.setScalar(0.47);
    this.hudDieRolling = true;
    this.emitSnapshot();

    const sx1 = dice.rotation.x;
    const sy1 = dice.rotation.y;
    const sz1 = dice.rotation.z;
    const sx2 = dice2.rotation.x;
    const sy2 = dice2.rotation.y;
    const sz2 = dice2.rotation.z;
    const [tx1, ty1, tz1] = ORIENT[d1];
    const [tx2, ty2, tz2] = ORIENT[d2];
    const dir = () => (Math.random() < 0.5 ? 1 : -1);
    const tX1 = (5 + Math.floor(Math.random() * 2)) * Math.PI * 2 * dir();
    const tY1 = (4 + Math.floor(Math.random() * 2)) * Math.PI * 2 * dir();
    const tZ1 = (4 + Math.floor(Math.random() * 2)) * Math.PI * 2 * dir();
    const tX2 = (5 + Math.floor(Math.random() * 2)) * Math.PI * 2 * dir();
    const tY2 = (4 + Math.floor(Math.random() * 2)) * Math.PI * 2 * dir();
    const tZ2 = (4 + Math.floor(Math.random() * 2)) * Math.PI * 2 * dir();
    const startX = dice.position.x;

    let lastHudTick = 0;
    await this.tween(1700, (t) => {
      const ease = 1 - Math.pow(1 - t, 3);
      dice.position.x = THREE.MathUtils.lerp(startX, -0.28, Math.min(1, t * 2));
      dice2.position.x = THREE.MathUtils.lerp(0, 0.28, Math.min(1, t * 2));
      diceShadow.position.x = dice.position.x;
      dice2Shadow.position.x = dice2.position.x;
      dice.position.y = DICE_REST_Y + Math.sin(t * Math.PI) * 1.48;
      dice2.position.y = DICE_REST_Y + Math.sin(Math.min(1, t * 1.05) * Math.PI) * 1.38;
      dice.rotation.set(
        THREE.MathUtils.lerp(sx1, tx1 + tX1, ease),
        THREE.MathUtils.lerp(sy1, ty1 + tY1, ease),
        THREE.MathUtils.lerp(sz1, tz1 + tZ1, ease),
      );
      dice2.rotation.set(
        THREE.MathUtils.lerp(sx2, tx2 + tX2, ease),
        THREE.MathUtils.lerp(sy2, ty2 + tY2, ease),
        THREE.MathUtils.lerp(sz2, tz2 + tZ2, ease),
      );
      if (t < 0.9 && t - lastHudTick > 0.1) {
        lastHudTick = t;
        this.hudDieFace = 1 + Math.floor(Math.random() * 6);
        this.emitSnapshot();
      }
    });
    if (this.disposed) return;
    this.hudDieRolling = false;
    dice.position.set(-0.28, DICE_REST_Y, 0);
    dice2.position.set(0.28, DICE_REST_Y, 0);
    diceShadow.position.x = -0.28;
    dice2Shadow.position.x = 0.28;
    dice.rotation.set(...ORIENT[d1]);
    dice2.rotation.set(...ORIENT[d2]);
    this.hudDieFace = d1;
    this.hudDiePopKey++;
    this.emitSnapshot();
    await this.sleep(160);
  }

  private async doRoll(): Promise<void> {
    if (this.phase !== 'awaitRoll' && this.phase !== 'aiWait') return;
    this.phase = 'rolling';
    this.deadline = null;
    this.pendingItemTarget = null;
    this.targetChoices = [];
    this.message = null;
    if (this.msgTimer !== null) window.clearTimeout(this.msgTimer);
    if (this.splashItem === null) {
      this.splashVisible = false;
      cancelAnimationFrame(this.splashRaf);
      if (this.splashTimer !== null) window.clearTimeout(this.splashTimer);
    }
    this.clearHL();

    let usedSixDie = this.armedSixDie;
    let usedTwinDice = this.armedTwinDice;
    let usedRefuel = this.armedRefuel;
    const carriedRefuel = this.refuelCarriedOver;
    this.armedSixDie = false;
    this.armedTwinDice = false;
    this.armedRefuel = false;
    this.refuelCarriedOver = false;

    if (!this.isAI()) {
      const inv = this.playerItems[this.turn];
      if (usedSixDie) {
        if (inv && inv.sixDie > 0) {
          inv.sixDie -= 1;
          this.turnUsedAtkDef = true;
          this.showItemSplash(this.cur(), 'sixDie');
        } else {
          usedSixDie = false;
        }
      } else if (usedTwinDice) {
        if (inv && inv.twinDice > 0) {
          inv.twinDice -= 1;
          this.turnUsedAtkDef = true;
          this.showItemSplash(this.cur(), 'twinDice');
        } else {
          usedTwinDice = false;
        }
      } else if (usedRefuel && !carriedRefuel) {
        if (inv && inv.refuel > 0) {
          inv.refuel -= 1;
          this.turnUsedAtkDef = true;
          this.showItemSplash(this.cur(), 'refuel');
        } else {
          usedRefuel = false;
        }
      }
    }

    this.pendingExtraRoll = this.pendingExtraRoll || usedRefuel;
    this.suppressSixBonusThisRoll = usedSixDie || usedTwinDice;
    this.twinDice = null;
    this.twinDiceUsedForRoll = usedTwinDice;
    this.emitSnapshot();

    if (usedTwinDice) {
      let d1 = 1 + Math.floor(Math.random() * 6);
      const d2 = 1 + Math.floor(Math.random() * 6);
      if (this.gmNextDie !== null && this.gmNextDie >= 1 && this.gmNextDie <= 6) {
        d1 = this.gmNextDie;
        this.gmNextDie = null;
      }
      this.twinDice = [d1, d2];
      this.die = d1 + d2;
      await this.animTwinDice(d1, d2);
      if (this.disposed) return;

      if (d1 === 6 || d2 === 6) {
        this.sixChain = this.pendingExtraRoll ? this.sixChain + 1 : 0;
      } else if (!this.pendingExtraRoll) {
        this.sixChain = 0;
      }
      this.recordRollQuest(this.turn, [d1, d2]);
      if (d1 === 6 || d2 === 6) {
        this.setMsg(`⚙️ 双倍珍珠奶茶掷出 ${d1} + ${d2} = ${this.die} 点（含 6 无连投）`);
      } else {
        this.setMsg(`⚙️ 双倍珍珠奶茶掷出 ${d1} + ${d2} = ${this.die} 点`);
      }
      this.emitSnapshot();
      await this.onRolled(this.die, d1 >= 5 || d2 >= 5 || this.die === 5 || this.die === 6);
      return;
    }

    let die = 1 + Math.floor(Math.random() * 6);
    if (usedSixDie) {
      die = 6;
    } else if (this.gmNextDie !== null && this.gmNextDie >= 1 && this.gmNextDie <= 6) {
      die = this.gmNextDie;
      this.gmNextDie = null;
    }
    this.die = die;
    await this.animDice(die);
    if (this.disposed) return;

    this.recordRollQuest(this.turn, [die]);

    if (die === 6) {
      this.sixChain++;
      if (this.suppressSixBonusThisRoll) {
        this.setMsg(
          this.sixChain >= 3
            ? '⚠️ 累计已达 3 个 6！本次可移动，但不再触发连投'
            : '🎲 掷出 6 点（本回合道具效果，不额外送连投）',
        );
        if (this.sixChain >= 3 && !this.isAI()) {
          this.showTurnEndSplash(this.cur(), '⚠️ 连 6 已达上限，本次移动后回合结束', 2300);
        }
      } else if (this.sixChain >= 3) {
        this.setMsg('⚠️ 连续三个 6！本次可移动，但不再掷');
        if (!this.isAI()) {
          this.showTurnEndSplash(this.cur(), '⚠️ 连 6 已达上限，本次移动后回合结束', 2300);
        }
      }
    } else if (!this.pendingExtraRoll) {
      this.sixChain = 0;
    }
    this.emitSnapshot();
    await this.onRolled(die, die === 5 || die === 6);
  }

  private consumeExtraRoll(die: number): boolean {
    const gotSixBonus =
      !this.suppressSixBonusThisRoll && die === 6 && this.sixChain < 3;
    this.suppressSixBonusThisRoll = false;
    if (gotSixBonus) {
      // 投出 6 本身触发免费连投，保留尚未消耗的连投道具次数（不被吞掉）
      return true;
    }
    if (this.pendingExtraRoll) {
      this.pendingExtraRoll = false;
      return true;
    }
    return false;
  }

  private async onRolled(die: number, allowTakeoff = die === 5 || die === 6): Promise<void> {
    if (this.disposed) return;
    const cands = this.movablePlanes(this.turn, die, allowTakeoff);
    if (cands.length === 0) {
      const willRollAgain = this.consumeExtraRoll(die);
      this.setMsg(`🎲 掷出 ${die} 点，暂无可移动小熊`);
      if (!this.isAI()) {
        this.showTurnEndSplash(
          this.cur(),
          willRollAgain
            ? `🎲 掷出 ${die} 点无棋可走 · 奖励再掷一次！`
            : `🎲 掷出 ${die} 点无棋可走 · 回合结束`,
          1900,
        );
      }
      await this.sleep(!this.isAI() ? 1600 : 1000);
      if (!this.disposed) {
        this.endTurn(willRollAgain);
      }
      return;
    }
    if (this.isAI()) {
      this.emitSnapshot();
      const picked = this.aiPick(cands);
      // 严格根据本步真实落点结果选择发言，绝不乱喊“踩人/起飞/大跳”
      const P = this.players[this.turn];
      let moveEmoteKind: 'preTakeoff' | 'preGoal' | 'preStomp' | 'preFly' | 'preMove' = 'preMove';
      let moveProbMult = 0.55;
      if (picked.plane.pos === -1) {
        moveEmoteKind = 'preTakeoff';
        moveProbMult = 0.9;
      } else {
        const sim = this.simulateMoveOutcome(picked.plane, die);
        const willStomp = sim.ringStops.some((sp) => {
          const rIdx = (P.start + 2 + sp) % 52;
          return this.planes.some(
            (q) => q.pid !== this.turn && q.pos >= 1 && q.pos <= 50 && this.ringIndexOf(q) === rIdx,
          );
        });
        if (sim.pos === HOME_END) {
          moveEmoteKind = 'preGoal';
          moveProbMult = 1.0;
        } else if (willStomp) {
          moveEmoteKind = 'preStomp';
          moveProbMult = 1.05;
        } else if (sim.fly || sim.jump) {
          moveEmoteKind = 'preFly';
          moveProbMult = 0.95;
        }
      }
      this.emitAiEmote(this.turn, moveEmoteKind, 3200, undefined, {
        probMult: moveProbMult,
        delayMinMs: 220,
        delayMaxMs: 780,
        requireTurnSeq: this.turnSeq,
        allowFollowUp: false,
      });
      await this.sleep(1350);
      if (!this.disposed) await this.performMove(picked.plane, die);
    } else {
      this.phase = 'awaitMove';
      this.movable = cands;
      this.deadline = this.timeMs + TIMEOUT;
      this.highlight(cands);
      this.emitSnapshot();
      if (this.gmAutoPlay) {
        const picked = this.aiPick(cands);
        this.after(550, () => {
          if (!this.disposed && this.gmAutoPlay && this.phase === 'awaitMove' && !this.isAI()) {
            void this.performMove(picked.plane, die);
          }
        });
      }
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
    onImpact?: () => void,
  ): Promise<void> {
    this.applyCheekSquishDeform(plane, []);
    plane.animating = true;
    const m = plane.mesh;
    const pt = m.userData.parts as PlaneParts;
    const sx = m.position.x;
    const sz = m.position.z;
    const sy = m.position.y;
    const syaw = m.rotation.y;
    let impactFired = false;

    await this.tween(dur, (t) => {
      if (onImpact && !impactFired && t >= 0.78) {
        impactFired = true;
        onImpact();
      }
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
      if (flipMode === 'frontFlip') {
        const ft = t < 0.08 ? 0 : t > 0.92 ? 1 : (t - 0.08) / 0.84;
        const fe = ft < 0.5 ? 2 * ft * ft : 1 - Math.pow(-2 * ft + 2, 2) / 2;
        pt.animRoot.rotation.x = fe * Math.PI * 2;
      } else {
        pt.animRoot.rotation.x = air * 0.16;
      }
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

  /** 保留原版终点转圈高跳欢呼动画，供后续其他场景复用 */
  /** 保留原版终点转圈高跳欢呼动画（备用） */
  public async celebrateGoalCheer(plane: PlaneData): Promise<void> {
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

  /** 保留原版终点举手欢呼待机姿势（备用） */
  public applyGoalCheerIdle(p: PlaneData, pt: PlaneParts, t: number, baseScale: number): void {
    const v = t * 4.2 + p.phase;
    p.mesh.scale.setScalar(baseScale);
    pt.animRoot.position.y = Math.abs(Math.sin(v)) * 0.09;
    pt.animRoot.rotation.z = Math.sin(v * 0.5) * 0.08;
    pt.leftArm.rotation.z = 1.35 + Math.sin(v * 1.5) * 0.28;
    pt.rightArm.rotation.z = -1.35 - Math.sin(v * 1.5) * 0.28;
    pt.headPivot.rotation.z = Math.sin(v) * 0.12;
    pt.headPivot.rotation.y = Math.sin(v * 0.5) * 0.18;
  }

  /** 终点到达庆祝：舒缓节奏双手执红绸左右挥甩跳舞动作 */
  private animateSilkRibbon(pivot: THREE.Group | undefined, phase: number, sideSign: number): void {
    if (!pivot) return;
    // 向正面（+Z）大弧度挥甩，同时上下轻扬
    pivot.rotation.y = -sideSign * (0.56 + Math.sin(phase - 0.35) * 0.48);
    pivot.rotation.z = sideSign * (-0.1 + Math.cos(phase - 0.5) * 0.28);
    const strip = pivot.userData.ribbonMesh as THREE.Mesh | undefined;
    if (!strip) return;
    const geo = strip.geometry as THREE.BufferGeometry;
    const rest = geo.userData.restPos as Float32Array | undefined;
    if (!rest) return;
    const pos = geo.attributes.position as THREE.BufferAttribute;
    const arr = pos.array as Float32Array;
    for (let i = 0; i < pos.count; i++) {
      const ix = i * 3;
      const rx = rest[ix];
      const ry = rest[ix + 1];
      const rz = rest[ix + 2];
      const u = Math.min(1, Math.abs(rx) / 0.46);
      const env = Math.pow(u, 1.15);
      arr[ix + 1] = ry + Math.cos(u * 3.8 - phase * 1.3) * env * 0.065;
      arr[ix + 2] = rz + Math.sin(u * 4.4 - phase * 1.5) * env * 0.095;
    }
    pos.needsUpdate = true;
  }

  private async celebrateGoal(plane: PlaneData): Promise<void> {
    plane.animating = true;
    const m = plane.mesh;
    const pt = m.userData.parts as PlaneParts;
    const baseYaw = this.players[plane.pid].finalYaw;
    const faceParts = pt.headMesh.userData.faceParts as HeadFaceParts | undefined;
    if (faceParts) {
      faceParts.mouthW.visible = false;
      faceParts.mouthOpen.visible = true;
    }
    if (pt.redScarf) pt.redScarf.visible = true;
    if (pt.leftRibbonPivot) pt.leftRibbonPivot.visible = true;
    if (pt.rightRibbonPivot) pt.rightRibbonPivot.visible = true;
    this.spawnImpact(m.position.x, m.position.z);
    await this.tween(1420, (t) => {
      const beat = t * Math.PI * 2.5;
      const sway = Math.sin(beat);
      const bounce = Math.abs(Math.sin(beat));
      m.position.y = 0.12 + bounce * 0.14;
      m.rotation.y = baseYaw + sway * 0.24;
      pt.animRoot.rotation.z = sway * 0.16;
      pt.animRoot.scale.set(1 + (1 - bounce) * 0.035, 1 + bounce * 0.06, 1 + (1 - bounce) * 0.035);
      // 双手向前伸展并挥舞红绸向正面大弧度摆动
      pt.leftArm.rotation.x = -0.92;
      pt.leftArm.rotation.y = sway * 0.36;
      pt.leftArm.rotation.z = 0.22 + sway * 0.34;
      pt.rightArm.rotation.x = -0.92;
      pt.rightArm.rotation.y = sway * 0.36;
      pt.rightArm.rotation.z = -0.22 + sway * 0.34;
      pt.leftFoot.rotation.x = sway * 0.36;
      pt.rightFoot.rotation.x = -sway * 0.36;
      pt.headPivot.rotation.z = -sway * 0.16;
      pt.headPivot.rotation.y = sway * 0.18;
      pt.headPivot.rotation.x = bounce * 0.06;
      this.animateSilkRibbon(pt.leftRibbonPivot, beat, -1);
      this.animateSilkRibbon(pt.rightRibbonPivot, beat + 0.35, 1);
    });
    m.position.y = 0.12;
    m.rotation.y = baseYaw;
    pt.animRoot.rotation.set(0, 0, 0);
    pt.animRoot.scale.set(1, 1, 1);
    pt.leftArm.rotation.set(0, 0, 0);
    pt.rightArm.rotation.set(0, 0, 0);
    pt.leftFoot.rotation.set(0, 0, 0);
    pt.rightFoot.rotation.set(0, 0, 0);
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
    const homeYaw = Math.atan2(-x, -z + 2);

    await this.tween(1320, (k) => {
      if (k < 0.08) {
        // 被踩瞬间压扁蓄力
        const sqT = k / 0.08;
        const syScale = 1 - 0.56 * Math.sin(sqT * Math.PI * 0.5);
        const sxScale = 1 / Math.sqrt(syScale);
        pt.animRoot.scale.set(sxScale, syScale, sxScale);
        pt.animRoot.rotation.set(0, 0, 0);
        pt.headPivot.rotation.x = -0.35 * sqT;
        m.position.set(sx, sy, sz);
        pt.leftArm.rotation.z = 1.45 * sqT;
        pt.rightArm.rotation.z = -1.45 * sqT;
      } else if (k < 0.88) {
        // 爆发击飞：高抛物线 + 翻滚旋转 + 手脚乱蹬
        const u = (k - 0.08) / 0.80;
        const easeHoriz = 1 - Math.pow(1 - u, 1.55);
        const arcY = Math.pow(Math.sin(u * Math.PI), 0.72) * 4.8;
        m.position.x = sx + (x - sx) * easeHoriz;
        m.position.z = sz + (z - sz) * easeHoriz;
        m.position.y = THREE.MathUtils.lerp(sy, 0.12, easeHoriz) + arcY;
        m.rotation.y = syaw + u * Math.PI * 4.2;
        m.rotation.z = Math.sin(u * Math.PI * 5) * 0.65;
        pt.animRoot.rotation.x = u * Math.PI * 4;
        const stretch = u < 0.22 ? 1 + (1 - u / 0.22) * 0.24 : 1;
        pt.animRoot.scale.set(1 / Math.sqrt(stretch), stretch, 1 / Math.sqrt(stretch));
        pt.headPivot.rotation.x = 0.25;
        pt.leftArm.rotation.z = 1.45 + Math.sin(u * Math.PI * 12) * 0.65;
        pt.rightArm.rotation.z = -1.45 - Math.sin(u * Math.PI * 12) * 0.65;
        pt.leftFoot.rotation.x = Math.sin(u * Math.PI * 14) * 0.8;
        pt.rightFoot.rotation.x = -Math.sin(u * Math.PI * 14) * 0.8;
      } else {
        // 落回基地 QQ 回弹
        const b = (k - 0.88) / 0.12;
        const syScale = 1 - Math.sin(b * Math.PI) * 0.28;
        const sxScale = 1 / Math.sqrt(syScale);
        m.position.set(x, 0.12, z);
        m.rotation.set(0, homeYaw, 0);
        pt.animRoot.rotation.set(0, 0, 0);
        pt.animRoot.scale.set(sxScale, syScale, sxScale);
        pt.headPivot.rotation.x = Math.sin(b * Math.PI) * 0.2;
        pt.leftArm.rotation.z = (1 - b) * 0.8;
        pt.rightArm.rotation.z = -(1 - b) * 0.8;
        pt.leftFoot.rotation.x = 0;
        pt.rightFoot.rotation.x = 0;
      }
    });
    m.position.set(x, 0.12, z);
    m.rotation.set(0, homeYaw, 0);
    m.userData.stackBaseX = x;
    m.userData.stackBaseY = 0.12;
    m.userData.stackBaseZ = z;
    m.userData.stackBaseYaw = homeYaw;
    m.userData.stackTotal = 1;
    m.userData.stackIdx = 0;
    m.userData.dizzyUntil = this.timeMs + 3800;
    pt.animRoot.scale.set(1, 1, 1);
    pt.animRoot.rotation.set(0, 0, 0);
    pt.headPivot.rotation.set(0, 0, 0);
    pt.leftArm.rotation.set(0, 0, 0);
    pt.rightArm.rotation.set(0, 0, 0);
    pt.leftFoot.rotation.set(0, 0, 0);
    pt.rightFoot.rotation.set(0, 0, 0);
    plane.animating = false;
  }

  private impactRingGeo: THREE.RingGeometry | null = null;
  private impactOuterRingGeo: THREE.RingGeometry | null = null;
  private impactSparkGeo: THREE.SphereGeometry | null = null;

  private spawnImpact(x: number, z: number): void {
    if (!this.impactRingGeo) this.impactRingGeo = new THREE.RingGeometry(0.28, 0.58, 32);
    if (!this.impactOuterRingGeo) this.impactOuterRingGeo = new THREE.RingGeometry(0.22, 0.42, 32);
    if (!this.impactSparkGeo) this.impactSparkGeo = new THREE.SphereGeometry(0.085, 8, 6);
    const ring = new THREE.Mesh(
      this.impactRingGeo,
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
    ring.position.set(x, 0.18, z);
    this.scene.add(ring);

    const outerRing = new THREE.Mesh(
      this.impactOuterRingGeo,
      new THREE.MeshBasicMaterial({
        color: 0xff7b54,
        transparent: true,
        opacity: 0.85,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    outerRing.rotation.x = -Math.PI / 2;
    outerRing.position.set(x, 0.19, z);
    this.scene.add(outerRing);

    const sparks: { m: THREE.Mesh; a: number; sp: number; h: number }[] = [];
    for (let i = 0; i < 14; i++) {
      const m = new THREE.MeshBasicMaterial({
        color: i % 2 === 0 ? 0xffe08a : 0xff8a65,
        transparent: true,
        opacity: 1,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const s = new THREE.Mesh(this.impactSparkGeo, m);
      s.position.set(x, 0.24, z);
      this.scene.add(s);
      sparks.push({
        m: s,
        a: (i / 14) * Math.PI * 2 + (Math.random() - 0.5) * 0.2,
        sp: 0.8 + Math.random() * 0.85,
        h: 0.65 + Math.random() * 0.65,
      });
    }
    this.tween(680, (k) => {
      const e = 1 - Math.pow(1 - k, 2.2);
      ring.scale.setScalar(1 + e * 2.8);
      ring.material.opacity = 0.95 * (1 - k);
      outerRing.scale.setScalar(1 + e * 3.6);
      outerRing.material.opacity = 0.85 * Math.pow(1 - k, 1.3);
      for (const sp of sparks) {
        sp.m.position.set(
          x + Math.cos(sp.a) * sp.sp * e * 1.65,
          0.24 + Math.sin(e * Math.PI) * sp.h,
          z + Math.sin(sp.a) * sp.sp * e * 1.65,
        );
        (sp.m.material as THREE.MeshBasicMaterial).opacity = 1 - k;
        sp.m.scale.setScalar(1.1 - k * 0.75);
      }
    }).then(() => {
      this.scene.remove(ring);
      ring.material.dispose();
      this.scene.remove(outerRing);
      outerRing.material.dispose();
      sparks.forEach((sp) => {
        this.scene.remove(sp.m);
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

    // 飞机停在起飞格前方 0.92 格处，与格面上的叠叠乐小熊清晰错开
    const bx = sx + dirX * 0.92;
    const bz = sz + dirZ * 0.92;

    const leadP = this.players[pid];
    const fp = makePilotPlaneModel(leadP, this.anisotropy);
    const enterStartX = bx - dirX * 2.2;
    const enterStartZ = bz - dirZ * 2.2;
    fp.position.set(enterStartX, 3.3, enterStartZ);
    fp.rotation.y = yaw;
    fp.scale.setScalar(0.22);
    const pilotHead = fp.userData.pilotHead as THREE.Group | undefined;
    if (pilotHead) {
      pilotHead.scale.setScalar(0.001);
    }
    this.scene.add(fp);

    const prevFollowObj = this.camFollowObj;
    if (this.camFollowPlane && stack.includes(this.camFollowPlane)) {
      this.camFollowObj = fp;
    }

    // 0) 飞机从空中俯冲滑翔降落至起飞位，彻底消除闪现
    await this.tween(480, (k) => {
      const ease = 1 - Math.pow(1 - k, 3);
      fp.position.x = THREE.MathUtils.lerp(enterStartX, bx, ease);
      fp.position.z = THREE.MathUtils.lerp(enterStartZ, bz, ease);
      fp.position.y = THREE.MathUtils.lerp(3.3, 0.42, ease);
      fp.rotation.x = (1 - ease) * 0.28;
      fp.scale.setScalar(THREE.MathUtils.lerp(0.22, 1.0, ease));
      if (fp.userData.propeller) {
        (fp.userData.propeller as THREE.Group).rotation.z = k * Math.PI * 16;
      }
    });
    if (this.disposed) {
      this.scene.remove(fp);
      this.disposeGeometryOnly(fp);
      return;
    }
    fp.position.set(bx, 0.42, bz);
    fp.rotation.x = 0;
    fp.scale.setScalar(1);

    // 1) 一只一只依次跳进前方座舱
    const boardOrder = [...stack].reverse();
    for (let bIdx = 0; bIdx < boardOrder.length; bIdx++) {
      if (this.disposed) {
        this.scene.remove(fp);
      this.disposeGeometryOnly(fp);
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

      beep(420 + bIdx * 85, 0.08, 'sine', 0.1);
      const restHeadY = 0.25 - bIdx * 0.014;
      await this.tween(bIdx === 0 ? 190 : 230, (k) => {
        const bounce = Math.sin(k * Math.PI * 2.4) * Math.exp(-k * 3.6);
        const dip = Math.sin(k * Math.PI);

        if (pilotHead) {
          if (bIdx === 0) {
            const pop = Math.min(1, k * 2.2);
            const sx = pop * (1 + bounce * 0.26);
            const sy = pop * (1 - bounce * 0.28);
            pilotHead.scale.set(Math.max(0.001, sx), Math.max(0.001, sy), Math.max(0.001, sx));
            pilotHead.position.y = 0.25 - dip * 0.04;
          } else {
            const sq = Math.sin(Math.min(1, k * 1.45) * Math.PI);
            const sx = 1 + sq * 0.32 + bounce * 0.14;
            const sy = 1 - sq * 0.44 - bounce * 0.16;
            pilotHead.scale.set(Math.max(0.5, sx), Math.max(0.45, sy), Math.max(0.5, sx));
            pilotHead.position.y = restHeadY - sq * 0.115;
          }
        }

        fp.position.y = 0.42 - dip * (0.065 + bIdx * 0.015);
        fp.scale.set(
          1 + dip * 0.085 + bounce * 0.04,
          1 - dip * 0.11 - bounce * 0.05,
          1 + dip * 0.085 + bounce * 0.04,
        );
        if (fp.userData.propeller) {
          (fp.userData.propeller as THREE.Group).rotation.z += 0.35;
        }
      });
      if (pilotHead) {
        pilotHead.scale.setScalar(1);
        pilotHead.position.y = restHeadY;
      }
      fp.position.y = 0.42;
      fp.scale.setScalar(1);
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
      this.disposeGeometryOnly(fp);
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

    // 收起座舱熊头后，飞机优雅拉升飞离棋盘消失在空中
    if (pilotHead) {
      pilotHead.visible = false;
    }
    const returnAnim = this.tween(680, (k) => {
      const ease = k * k;
      fp.position.x = THREE.MathUtils.lerp(tx, tx + dirX * 2.8, ease);
      fp.position.z = THREE.MathUtils.lerp(tz, tz + dirZ * 2.8, ease);
      fp.position.y = THREE.MathUtils.lerp(0.42, 3.8, ease);
      fp.rotation.order = 'YXZ';
      fp.rotation.y = yaw;
      fp.rotation.x = -ease * 0.42;
      fp.rotation.z = Math.sin(k * Math.PI) * 0.28;
      fp.scale.setScalar(Math.max(0.04, 1 - ease * 0.92));
      if (fp.userData.propeller) {
        (fp.userData.propeller as THREE.Group).rotation.z = k * Math.PI * 28;
      }
    }).then(() => {
      this.scene.remove(fp);
      this.disposeGeometryOnly(fp);
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

    // 按阵营分组判断护盾防御
    const byPid = new Map<number, PlaneData[]>();
    for (const v of victims) {
      const arr = byPid.get(v.pid) ?? [];
      arr.push(v);
      byPid.set(v.pid, arr);
    }

    const toSendHome: PlaneData[] = [];
    const defendedPids: number[] = [];
    const c = this.posToCell(this.players[plane.pid], plane.pos);

    const attackerName = this.players[plane.pid].name;
    for (const [vPid, grp] of byPid.entries()) {
      const shieldedUnit = grp.find((v) => v.shielded);
      if (shieldedUnit) {
        shieldedUnit.shielded = false;
        if (this.playerKda[plane.pid]) this.playerKda[plane.pid].shieldBreaks += 1;
        this.syncShieldVisuals();
        defendedPids.push(vPid);
        this.spawnShieldBreak(c[0], c[1]);
        this.triggerShake();
        this.recordOffense(vPid, plane.pid, 0.5);
        if (this.players[vPid].type === 'ai') {
          this.emitAiEmote(vPid, 'gotStomped', 1800, attackerName, {
            probMult: 1.0,
            delayMinMs: 1100,
            delayMaxMs: 3600,
          });
        }
      } else {
        toSendHome.push(...grp);
        if (this.playerKda[plane.pid]) this.playerKda[plane.pid].stomps += grp.length;
        if (this.playerKda[vPid]) this.playerKda[vPid].stomped += grp.length;
        this.recordStompQuest(vPid, 1);
        this.recordOffense(vPid, plane.pid, 1.0);
        if (this.players[plane.pid].type === 'ai') {
          const hadGrudge = (this.offenseScores[plane.pid]?.[vPid] ?? 0) >= 0.95;
          this.emitAiEmote(
            plane.pid,
            hadGrudge ? 'stompRevenge' : 'stompedEnemy',
            1800,
            this.players[vPid].name,
            { probMult: hadGrudge ? 1.25 : 1.0, delayMinMs: 700, delayMaxMs: 2800 },
          );
          this.onRetaliationSuccess(plane.pid, vPid, 'stomp');
        }
        if (this.players[vPid].type === 'ai') {
          this.emitAiEmote(vPid, 'gotStomped', 1600, attackerName, {
            probMult: 1.3,
            delayMinMs: 1200,
            delayMaxMs: 4100,
            allowBystander: true,
          });
        }
      }
    }

    if (defendedPids.length > 0 && toSendHome.length === 0) {
      beep(680, 0.16, 'triangle', 0.15);
      const names = defendedPids.map((id) => this.players[id].name).join('、');
      this.setMsg(`🫧 ${names} 的泡泡罩挡下踩踏！大家挤脸站在同一格~`);
      this.relayout();
      await this.sleep(360);
      return 0;
    }

    if (toSendHome.length > 0) {
      sndCap();
      if (defendedPids.length > 0) {
        this.setMsg(`💥 撞掉 ${toSendHome.length} 架敌机，另有护盾成功格挡并同格挤脸！`);
      } else {
        this.setMsg(`💥 撞掉 ${toSendHome.length} 架敌机，送回基地！`);
      }
      this.recordTurnKillStreak(plane.pid, toSendHome.length);
      this.spawnImpact(c[0], c[1]);
      this.triggerShake();
      await Promise.all(
        toSendHome.map((v) => {
          v.pos = -1;
          v.shielded = false;
          const b = this.players[v.pid].base[v.idx];
          return this.sendHome(v, b[0], b[1]);
        }),
      );
      this.syncShieldVisuals();
    }
    return toSendHome.length;
  }

  private async captureFlyCross(flyingPid: number): Promise<void> {
    const oppPlayer = this.slotPlayer((this.players[flyingPid].slotId + 2) % 4);
    if (!oppPlayer) return;
    const oppPid = this.players.indexOf(oppPlayer);
    const victims = this.planes.filter((q) => q.pid === oppPid && q.pos === 54);
    if (!victims.length) return;
    const c = this.posToCell(oppPlayer, 54);
    const attackerName = this.players[flyingPid].name;

    const shieldedUnit = victims.find((v) => v.shielded);
    if (shieldedUnit) {
      shieldedUnit.shielded = false;
      if (this.playerKda[flyingPid]) this.playerKda[flyingPid].shieldBreaks += 1;
      this.syncShieldVisuals();
      this.spawnShieldBreak(c[0], c[1]);
      this.triggerShake();
      beep(680, 0.16, 'triangle', 0.15);
      this.setMsg(`🛡️ ${oppPlayer.name} 的护盾成功抵挡了航线击落！`, oppPlayer.uiColor);
      this.recordOffense(oppPid, flyingPid, 0.5);
      if (oppPlayer.type === 'ai') {
        this.emitAiEmote(oppPid, 'gotStomped', 1800, attackerName, {
          probMult: 1.0,
          delayMinMs: 1100,
          delayMaxMs: 3600,
        });
      }
      return;
    }

    if (this.playerKda[flyingPid]) this.playerKda[flyingPid].stomps += victims.length;
    if (this.playerKda[oppPid]) this.playerKda[oppPid].stomped += victims.length;
    this.recordTurnKillStreak(flyingPid, victims.length);
    sndCap();
    this.setMsg(`💥 飞越航线，击落 ${oppPlayer.name} 航道敌机！`);
    this.spawnImpact(c[0], c[1]);
    this.triggerShake();
    this.recordStompQuest(oppPid, victims.length);
    this.recordOffense(oppPid, flyingPid, 1.0);
    if (this.players[flyingPid].type === 'ai') {
      const hadGrudge = (this.offenseScores[flyingPid]?.[oppPid] ?? 0) >= 0.95;
      this.emitAiEmote(
        flyingPid,
        hadGrudge ? 'stompRevenge' : 'stompedEnemy',
        1800,
        oppPlayer.name,
        { probMult: hadGrudge ? 1.25 : 1.0, delayMinMs: 700, delayMaxMs: 2800 },
      );
      this.onRetaliationSuccess(flyingPid, oppPid, 'stomp');
    }
    if (oppPlayer.type === 'ai') {
      this.emitAiEmote(oppPid, 'gotStomped', 1600, attackerName, {
        probMult: 1.3,
        delayMinMs: 1200,
        delayMaxMs: 4100,
        allowBystander: true,
      });
    }
    await Promise.all(
      victims.map((v) => {
        v.pos = -1;
        v.shielded = false;
        const b = this.players[v.pid].base[v.idx];
        return this.sendHome(v, b[0], b[1]);
      }),
    );
    this.syncShieldVisuals();
  }

  private async performMove(rawPlane: PlaneData, die: number): Promise<void> {
    const plane = this.resolveBottomOfStack(rawPlane);
    this.phase = 'moving';
    this.deadline = null;
    this.clearHL();
    this.camFollowPlane = plane;
    this.camFollowObj = plane.mesh;
    this.camFollowCloseup = false;
    this.emitSnapshot();

    const P = this.players[plane.pid];
    const stack =
      plane.pos === -1 || plane.pos === 0
        ? [plane]
        : this.planesOf(plane.pid)
            .filter((p) => p.pos === plane.pos && p.pos !== HOME_END)
            .sort((a, b) => a.idx - b.idx);
    const sync = (fn: (p: PlaneData, idx: number) => Promise<void>) =>
      Promise.all(stack.map((p, i) => fn(p, i)));
    const setPos = (v: number) => stack.forEach((p) => (p.pos = v));
    const countExistingAt = (pos: number, includeOthers = false) => {
      if (pos <= 0) return 0;
      if (includeOthers && pos <= 50) {
        const targetRing = (P.start + 2 + pos) % 52;
        return this.planes.filter(
          (q) =>
            !stack.includes(q) &&
            q.pos >= 1 &&
            q.pos <= 50 &&
            this.ringIndexOf(q) === targetRing,
        ).length;
      }
      return this.planes.filter(
        (q) => !stack.includes(q) && q.pid === plane.pid && q.pos === pos,
      ).length;
    };
    const hopAll = (
      c: Point2D,
      yaw: number,
      arc: number,
      dur: number,
      sign: number,
      targetPos?: number,
      flipMode: 'none' | 'frontFlip' | 'spinLeft' | 'spinRight' = 'none',
      onImpact?: () => void,
      isPassThrough = false,
    ) => {
      const baseStackCount =
        targetPos !== undefined && targetPos !== HOME_END
          ? countExistingAt(targetPos, isPassThrough)
          : 0;
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
          idx === 0 ? onImpact : undefined,
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
      this.relayout();
      await this.sleep(320);
    } else {
      const leftStart = plane.pos === 0;
      const leftMixedRing =
        plane.pos >= 1 &&
        plane.pos <= 50 &&
        this.planes.some(
          (q) =>
            q.pid !== plane.pid &&
            q.pos >= 1 &&
            q.pos <= 50 &&
            this.ringIndexOf(q) === this.ringIndexOf(plane),
        );
      let curStep = plane.pos;
      let dir = 1;
      for (let i = 0; i < die; i++) {
        if (curStep === HOME_END) dir = -1;
        else if (dir === -1 && curStep <= 51) dir = 1;
        curStep += dir;
        setPos(curStep);
        if ((leftStart || leftMixedRing) && i === 0) {
          stack.forEach((p) => (p.animating = true));
          this.relayout();
        }
        const c = this.posToCell(P, curStep);
        const yaw = curStep === HOME_END ? P.finalYaw : this.faceTravelDir(plane);
        sndHop();
        let stepCapturePromise: Promise<number> | null = null;
        await hopAll(
          c,
          yaw,
          0.5,
          460,
          i % 2 === 0 ? 1 : -1,
          curStep,
          'none',
          i === die - 1
            ? () => {
                stepCapturePromise = this.captureAt(plane);
              }
            : undefined,
          i < die - 1,
        );
        if (this.disposed) return;
        if (i < die - 1) {
          await this.sleep(80);
          if (this.disposed) return;
        } else if (stepCapturePromise) {
          await stepCapturePromise;
        }
      }
      if (dir === -1) {
        this.setMsg(
          curStep > 50
            ? `↩️ 点数超出，回弹至航道第 ${curStep - 50} 格`
            : `↩️ 点数超出，回弹至第 ${curStep} 格`,
        );
      }

      const runSameColorAndFlight = async () => {
        if (this.disposed) return;
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
            let jumpCapture1: Promise<number> | null = null;
            await hopAll(
              this.posToCell(P, plane.pos),
              this.faceTravelDir(plane),
              1.95,
              920,
              1,
              plane.pos,
              stack.length >= 2 ? (Math.random() < 0.5 ? 'spinLeft' : 'spinRight') : 'frontFlip',
              () => {
                jumpCapture1 = this.captureAt(plane);
              },
            );
            if (jumpCapture1) await jumpCapture1;
          } else {
            this.setMsg('⚡ 落在己方颜色格，跳跃前进 4 格！');
            beep(540, 0.12, 'triangle', 0.14);
            setPos(plane.pos + 4);
            let jumpCapture2: Promise<number> | null = null;
            await hopAll(
              this.posToCell(P, plane.pos),
              this.faceTravelDir(plane),
              1.95,
              920,
              1,
              plane.pos,
              stack.length >= 2 ? (Math.random() < 0.5 ? 'spinLeft' : 'spinRight') : 'frontFlip',
              () => {
                jumpCapture2 = this.captureAt(plane);
              },
            );
            if (jumpCapture2) await jumpCapture2;
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
      };

      const continueAfterDirectShop = async () => {
        await runSameColorAndFlight();
        if (this.disposed) return;
        this.relayout();
        this.emitSnapshot();
        const willRollAgainAfter = this.consumeExtraRoll(die);
        await this.sleep(450);
        if (this.disposed) return;
        if (this.camFollowPlane && this.camMode === 'follow' && !this.camUserInteracting) {
          const home = this.getHomeCameraPose();
          _scratchCamOffset.copy(this.camera.position).sub(this.controls.target);
          _scratchCamSpherical.setFromVector3(_scratchCamOffset);
          this.setCamGoal(home.tx, home.ty, home.tz, home.radius, home.phi, _scratchCamSpherical.theta);
        }
        this.camFollowPlane = null;
        this.camFollowObj = null;
        this.camFollowCloseup = false;
        this.endTurn(willRollAgainAfter);
      };

      // 直接踩到商店格子时：先打开商店选购，选购完成后再继续触发同色 +4 大跳/飞行
      if (plane.pos >= 1 && plane.pos <= 50 && this.ringIndexOf(plane) === (P.start + 40) % 52) {
        const offer = this.pickUniqueShopOffer();
        if (this.isAI() || this.gmAutoPlay) {
          const chosen = this.aiChooseShopItem(offer, plane.pid);
          this.grantItem(plane.pid, chosen);
          const def = ITEM_DEFS[chosen];
          beep(740, 0.12, 'triangle', 0.14);
          this.setMsg(`🏪 ${P.name} 踏入商店，选择了 ${def.icon} ${def.name}！`, P.uiColor);
          this.showShopSplash(P, chosen);
          this.emitAiEmote(plane.pid, 'shopPick', 1400);
          this.emitSnapshot();
          await this.sleep(750);
          await continueAfterDirectShop();
          return;
        } else {
          this.shopOffer = offer;
          this.shopPid = plane.pid;
          this.shopPendingAgain = false;
          this.shopPostAction = continueAfterDirectShop;
          this.shopDeadline = this.timeMs + 15000;
          this.lastShopSec = 15;
          this.phase = 'shopChoice';
          beep(840, 0.14, 'triangle', 0.15);
          this.setMsg(`🏪 ${P.name} 踏入道具商店，请于 15 秒内挑选 1 张道具卡！`, P.uiColor);
          this.emitSnapshot();
          return;
        }
      }

      await runSameColorAndFlight();
    }

    if (this.disposed) return;
    if (plane.pos === HOME_END) {
      stack.forEach((p) => (p.shielded = false));
      beep(784, 0.2, 'triangle', 0.16);
      this.setMsg('🏁 一架飞机到达终点！');
      if (P.type === 'ai') {
        this.emitAiEmote(plane.pid, 'goal', 1800, undefined, {
          probMult: 1.25,
          delayMinMs: 750,
          delayMaxMs: 2800,
          allowBystander: true,
        });
      }
      await Promise.all(stack.map((p) => this.celebrateGoal(p)));
      this.syncTimeOfDay();
    }
    this.relayout();
    this.emitSnapshot();

    const willRollAgain = this.consumeExtraRoll(die);

    if (this.planesOf(plane.pid).every((p) => p.pos === HOME_END)) {
      if (!this.finishedOrder.includes(plane.pid)) {
        this.finishedOrder.push(plane.pid);
      }
      const rank = this.finishedOrder.length;
      const finishLimit = Math.min(3, Math.max(1, this.players.length - 1));
      if (rank >= finishLimit) {
        this.camFollowPlane = null;
        this.camFollowObj = null;
        this.camFollowCloseup = false;
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
      this.camFollowCloseup = false;
      this.endTurn(false);
      return;
    }

    await this.sleep(450);
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
    this.camFollowCloseup = false;

    // 踩中商店格子：15 秒内从 3 张不重复随机道具卡中选择 1 张
    if (plane.pos >= 1 && plane.pos <= 50 && this.ringIndexOf(plane) === (P.start + 40) % 52) {
      const offer = this.pickUniqueShopOffer();
      if (this.isAI() || this.gmAutoPlay) {
        const chosen = this.aiChooseShopItem(offer, plane.pid);
        this.grantItem(plane.pid, chosen);
        const def = ITEM_DEFS[chosen];
        beep(740, 0.12, 'triangle', 0.14);
        this.setMsg(`🏪 ${P.name} 踏入商店，选择了 ${def.icon} ${def.name}！`, P.uiColor);
        this.showShopSplash(P, chosen);
        this.emitAiEmote(plane.pid, 'shopPick', 1400);
        this.emitSnapshot();
        await this.sleep(750);
        if (!this.disposed) this.endTurn(willRollAgain);
        return;
      } else {
        this.shopOffer = offer;
        this.shopPid = plane.pid;
        this.shopPendingAgain = willRollAgain;
        this.shopDeadline = this.timeMs + 15000;
        this.lastShopSec = 15;
        this.phase = 'shopChoice';
        beep(840, 0.14, 'triangle', 0.15);
        this.setMsg(`🏪 ${P.name} 踏入道具商店，请于 15 秒内挑选 1 张道具卡！`, P.uiColor);
        this.emitSnapshot();
        return;
      }
    }

    this.endTurn(willRollAgain);
  }

  private endTurn(again: boolean): void {
    if (this.phase === 'over' || this.disposed) return;
    if (again) {
      if (this.pendingExtraRoll) {
        // 本次掷出 6 触发免费连投导致再来一口小饼干尚未消耗，下次投骰默认自动选中
        this.armedRefuel = true;
        this.refuelCarriedOver = true;
      }
      this.setMsg('🎲 奖励再掷一次！');
      this.beginRollPhase(true);
      return;
    }
    this.totalCompletedTurns += 1;
    let steps = 0;
    do {
      this.turn = (this.turn + 1) % this.players.length;
      steps++;
    } while (
      steps < this.players.length &&
      this.finishedOrder.includes(this.turn)
    );
    this.sixChain = 0;
    this.turnStompKills = 0;
    this.turnUsedAtkDef = false;
    this.turnUsedDef = false;
    this.armedSixDie = false;
    this.armedTwinDice = false;
    this.armedRefuel = false;
    this.refuelCarriedOver = false;
    this.pendingExtraRoll = false;
    this.suppressSixBonusThisRoll = false;
    this.pendingItemTarget = null;
    this.targetChoices = [];
    this.twinDice = null;
    this.twinDiceUsedForRoll = false;
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
      const theta = _scratchCamSpherical.theta;
      const myBears = this.planesOf(this.turn).filter((p) => p.pos < HOME_END);
      const onBoardCount = myBears.filter((p) => p.pos >= 0).length;

      if (myBears.length >= 2 && onBoardCount >= 1) {
        let minX = Infinity;
        let maxX = -Infinity;
        let minZ = Infinity;
        let maxZ = -Infinity;
        for (const b of myBears) {
          const bx = b.mesh.position.x;
          const bz = b.mesh.position.z;
          if (bx < minX) minX = bx;
          if (bx > maxX) maxX = bx;
          if (bz < minZ) minZ = bz;
          if (bz > maxZ) maxZ = bz;
        }
        const cx = (minX + maxX) * 0.5;
        const cz = (minZ + maxZ) * 0.5;
        const cosT = Math.cos(theta);
        const sinT = Math.sin(theta);
        let maxRight = 0;
        let maxFwd = 0;
        for (const b of myBears) {
          const dx = b.mesh.position.x - cx;
          const dz = b.mesh.position.z - cz;
          const rProj = Math.abs(dx * cosT - dz * sinT);
          const fProj = Math.abs(dx * sinT + dz * cosT);
          if (rProj > maxRight) maxRight = rProj;
          if (fProj > maxFwd) maxFwd = fProj;
        }
        const halfW = maxRight + 1.8;
        const halfD = maxFwd + 2.0;
        const vFov = THREE.MathUtils.degToRad(this.camera.fov);
        const aspect = Math.max(0.5, (window.innerWidth || 1280) / (window.innerHeight || 720));
        const hFov = 2 * Math.atan(Math.tan(vFov * 0.5) * aspect);
        const basePhi = home.phi;
        const rH = halfW / Math.tan(hFov * 0.5);
        const rV = (halfD * Math.cos(basePhi)) / Math.tan(vFov * 0.5) + halfD * Math.sin(basePhi);
        const targetRadius = THREE.MathUtils.clamp(
          Math.max(rH, rV) * 1.18,
          home.radius * 0.82,
          24.5,
        );
        const spreadT = THREE.MathUtils.clamp((targetRadius - home.radius * 0.85) / 10, 0, 1);
        const targetPhi = THREE.MathUtils.lerp(home.phi, 0.72, spreadT);
        this.setCamGoal(cx, home.ty, cz, targetRadius, targetPhi, theta);
      } else {
        this.setCamGoal(
          home.tx * 0.55 + P.court[0] * 0.45,
          home.ty,
          home.tz * 0.55 + P.court[1] * 0.45,
          home.radius * 0.78,
          home.phi,
          theta,
        );
      }
    }
  }

  private beginRollPhase(isBonus = false): void {
    const curTurnSeq = ++this.turnSeq;
    if (!isBonus && this.playerTurnCount[this.turn] !== undefined) {
      this.playerTurnCount[this.turn] += 1;
    }
    this.focusTurn();
    if (this.isAI()) {
      this.phase = 'aiWait';
      this.deadline = null;
      this.emitSnapshot();
      // 轮到 AI 时，有性格概率提前说一句（掷骰前）
      this.emitAiEmote(this.turn, 'preRoll', 2800, undefined, {
        probMult: isBonus ? 1.2 : 1.0,
        delayMinMs: 220,
        delayMaxMs: 800,
        requireTurnSeq: curTurnSeq,
        allowFollowUp: false,
      });
      // 上一轮结束后，AI 至少等待 2 秒再开始操作
      this.after(2000, () => {
        if (this.disposed || this.phase !== 'aiWait') return;
        void this.aiTryUseItems().then((usedItem) => {
          if (this.disposed || this.phase !== 'aiWait') return;
          if (usedItem) {
            // 使用完任意道具后，至少等待 2 秒再投骰子
            this.after(2000, () => {
              if (!this.disposed && this.phase === 'aiWait') this.doRoll();
            });
          } else {
            this.doRoll();
          }
        });
      });
    } else {
      this.phase = 'awaitRoll';
      this.deadline = this.timeMs + TIMEOUT;
      sndYourTurn();
      this.showTurnSplash(this.cur(), isBonus);
      if (this.gmAutoPlay) {
        this.after(700, () => {
          if (!this.disposed && this.gmAutoPlay && this.phase === 'awaitRoll' && !this.isAI() && !this.itemBusy) {
            ensureAudio();
            this.doRoll();
          }
        });
      }
      // 玩家思考期间，旁观 AI 按性格概率延后或分批闲聊/催促
      const aiWatchers = this.players
        .map((pl, idx) => ({ pl, idx }))
        .filter((x) => x.pl.type === 'ai');
      if (aiWatchers.length > 0) {
        const watcher = aiWatchers[Math.floor(Math.random() * aiWatchers.length)];
        this.emitAiEmote(watcher.idx, 'watchHuman', 3400, undefined, {
          probMult: 0.9,
          delayMinMs: 2600,
          delayMaxMs: 7400,
          requireTurnSeq: curTurnSeq,
          allowFollowUp: true,
        });
      }
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
    const P = this.players[me];
    const personality: AiPersonality = P?.type === 'ai' ? (P.personality ?? 'tactician') : 'tactician';
    const myPlanes = this.planesOf(me);
    const activeCount = myPlanes.filter((q) => q.pos >= 0 && q.pos < HOME_END).length;
    const crossThreat = this.oppCrossFlyThreat(me);
    const myTotalItems = Object.values(this.playerItems[me] ?? {}).reduce((a, b) => a + b, 0);

    const progressMult =
      personality === 'rusher' ? 1.55 : personality === 'chill' ? 0.85 : personality === 'tactician' ? 1.1 : 1.0;
    const threatMult =
      personality === 'rusher' ? 0.45 : personality === 'chill' ? 1.75 : personality === 'vengeful' ? 0.85 : 1.05;
    const stompBase =
      personality === 'rusher' ? 24 : personality === 'chill' ? 22 : personality === 'vengeful' ? 75 : 16;
    const flyKillBonus =
      personality === 'rusher' ? 138 : personality === 'chill' ? 45 : personality === 'vengeful' ? 105 : 125;

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
        s = (personality === 'rusher' ? 380 : 320) + stackCount * 35;
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
        // 掷出 5 或 6 点可从基地起飞
        const baseLaunch = personality === 'rusher' ? 92 : personality === 'chill' ? 68 : 78;
        s = baseLaunch - activeCount * 10;
      } else {
        // 外圈或起点台棋子：结合性格评估进度、踩人、航线、商店与避险
        s =
          p.pos === 0
            ? 18 * progressMult
            : 10 + (p.pos * 0.45 + Math.max(0, np - p.pos) * 0.55) * progressMult;

        // 统计沿途各停靠环格可撞回家的敌机：
        // 目标价值公式 = 基础踩踏分 + 领先分×领先权重 + (威胁系数 - 1)×威胁权重 + 实时威胁分×28
        // 记仇型领先权重极低而威胁权重极高，在多目标可选时优先踩对自己威胁最大的玩家而非第一名
        const leadWeight =
          personality === 'vengeful'
            ? 0.22
            : personality === 'chill'
              ? 0.35
              : personality === 'tactician'
                ? 0.95
                : 1.15;
        const threatWeight =
          personality === 'vengeful'
            ? 128
            : personality === 'tactician'
              ? 105
              : personality === 'rusher'
                ? 75
                : 40;
        const capturedSet = new Set<PlaneData>();
        for (const stopPos of L.ringStops) {
          const rIdx = (P.start + 2 + stopPos) % 52;
          for (const q of this.planes) {
            if (q.pid === me || q.pos < 1 || q.pos > 50) continue;
            if (this.ringIndexOf(q) === rIdx && !capturedSet.has(q)) {
              capturedSet.add(q);
              const enemyDone = this.planesOf(q.pid).filter((x) => x.pos === HOME_END).length;
              const leadScore = q.pos * 0.52 + enemyDone * 14;
              const threatCoeff = this.computeThreatCoeff(me, q.pid);
              const boardThreat = this.computeEnemyBoardThreat(me, q.pid);
              const shieldFactor = q.shielded ? 0.36 : 1.0;
              s +=
                (stompBase +
                  leadScore * leadWeight +
                  (threatCoeff - 1.0) * threatWeight +
                  boardThreat * 28) *
                shieldFactor;
            }
          }
        }

        // 飞越对面航线击落敌方停在终点前第 4 格（pos 54）的棋子
        if (L.fly && crossThreat.oppPid >= 0) {
          const flyVictims = this.planesOf(crossThreat.oppPid).filter((q) => q.pos === 54).length;
          const threatCoeff = this.computeThreatCoeff(me, crossThreat.oppPid);
          const oppDone = this.planesOf(crossThreat.oppPid).filter((x) => x.pos === HOME_END).length;
          const flyThreatBonus = (threatCoeff - 1.0) * threatWeight + oppDone * 12 * leadWeight;
          s += flyVictims * (flyKillBonus + flyThreatBonus);
        }

        if (L.fly) s += personality === 'rusher' ? 76 : 48;
        else if (L.jump) s += personality === 'rusher' ? 42 : personality === 'tactician' ? 30 : 20;

        if (np >= 51) {
          // 冲入终点前安全通道
          s += 78 + (np - 50) * 3;
          if (np === 54) {
            if (crossThreat.immediate) s -= 42 * threatMult;
            else if (crossThreat.near) s -= 14 * threatMult;
          }
        } else if (np >= 1 && np <= 50) {
          const newRingIdx = (P.start + 2 + np) % 52;
          if (newRingIdx === (P.start + 40) % 52 && myTotalItems < 2) {
            s += personality === 'tactician' ? 30 : personality === 'chill' ? 14 : 18;
          }
          if (myPlanes.some((q) => q !== p && q.pos === np)) {
            s += personality === 'tactician' ? 24 : 12; // 同格叠机协同推进
          }
          const curThreat =
            p.pos >= 1 && p.pos <= 50 ? this.ringThreatScore(this.ringIndexOf(p), me) : 0;
          const newThreat = this.ringThreatScore(newRingIdx, me);
          if (curThreat > 0 && newThreat < curThreat) {
            s += (curThreat - newThreat) * (32 + p.pos * 0.3) * threatMult;
          }
          if (newThreat > 0) {
            const myShieldMult = p.shielded ? 0.2 : 1.0;
            s -= newThreat * (24 + p.pos * 0.45 * stackCount) * threatMult * myShieldMult;
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
      if (!this.isContextLost) this.renderer.render(this.scene, this.camera);
      if (this.isSoftwareGl) {
        this.afterDraw(tick);
      } else {
        this.frameId = requestAnimationFrame(tick);
      }
    };
    if (this.isSoftwareGl) {
      this.stepFrame();
      if (!this.isContextLost) this.renderer.render(this.scene, this.camera);
      this.afterDraw(tick);
    } else {
      this.frameId = requestAnimationFrame(tick);
    }
  }

  private syncTimeOfDay(): void {
    const maxDone = Math.max(
      0,
      ...this.players.map((_, pid) => this.planesOf(pid).filter((p) => p.pos === HOME_END).length),
    );
    if (maxDone >= 4 && !this.stage4CampfireActive) {
      this.stage4CampfireActive = true;
      this.setMsg('🔥 有人全员完赛！中央骰台升起了温暖篝火~');
    }
    const stage = Math.min(3, maxDone);
    if (stage <= this.maxDoneStage) return;
    this.maxDoneStage = stage;
    const order: TimeOfDay[] = ['morning', 'noon', 'afternoon', 'evening'];
    const nextTod = order[stage];
    this.todFrom = this.mapConfig.timePresets[this.timeOfDay];
    this.todTo = this.mapConfig.timePresets[nextTod];
    this.timeOfDay = nextTod;
    this.todBlend = 0;
    this.onEnterTimeOfDay(nextTod);
    this.emitSnapshot();
  }

  private applyTimeOfDayLerp(k: number): void {
    const ease = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
    const A = this.todFrom;
    const B = this.todTo;

    if (this.scene.background instanceof THREE.Color) {
      this._todColA.setHex(A.skyBgHex);
      this._todColB.setHex(B.skyBgHex);
      this.scene.background.copy(this._todColA).lerp(this._todColB, ease);
    }
    if (this.scene.fog instanceof THREE.Fog) {
      this._todColA.setHex(A.fogHex);
      this._todColB.setHex(B.fogHex);
      this.scene.fog.color.copy(this._todColA).lerp(this._todColB, ease);
      this.scene.fog.near = THREE.MathUtils.lerp(A.fogNear, B.fogNear, ease);
      this.scene.fog.far = THREE.MathUtils.lerp(A.fogFar, B.fogFar, ease);
    }

    this._todColA.setHex(A.hemiSkyHex);
    this._todColB.setHex(B.hemiSkyHex);
    this.hemiLight.color.copy(this._todColA).lerp(this._todColB, ease);
    this._todColA.setHex(A.hemiGroundHex);
    this._todColB.setHex(B.hemiGroundHex);
    this.hemiLight.groundColor.copy(this._todColA).lerp(this._todColB, ease);
    this.hemiLight.intensity = THREE.MathUtils.lerp(A.hemiIntensity, B.hemiIntensity, ease);

    this._todColA.setHex(A.sunColorHex);
    this._todColB.setHex(B.sunColorHex);
    this.sunLight.color.copy(this._todColA).lerp(this._todColB, ease);
    this.sunLight.intensity = THREE.MathUtils.lerp(A.sunIntensity, B.sunIntensity, ease);
    this._todPosA.set(...A.sunPosition);
    this._todPosB.set(...B.sunPosition);
    this.sunLight.position.copy(this._todPosA).lerp(this._todPosB, ease);

    this._todColA.setHex(A.fillColorHex);
    this._todColB.setHex(B.fillColorHex);
    this.fillLight.color.copy(this._todColA).lerp(this._todColB, ease);
    this.fillLight.intensity = THREE.MathUtils.lerp(A.fillIntensity, B.fillIntensity, ease);

    this.scene.environmentIntensity = THREE.MathUtils.lerp(A.envIntensity, B.envIntensity, ease);
    this.renderer.toneMappingExposure = THREE.MathUtils.lerp(A.exposure, B.exposure, ease);

    const lantVal = THREE.MathUtils.lerp(A.lanternEmissive, B.lanternEmissive, ease);
    this.world.lanternMats?.forEach((m) => {
      m.emissiveIntensity = lantVal;
    });

    const nightScale = THREE.MathUtils.lerp(A.lanternLightScale, B.lanternLightScale, ease);
    this.world.nightLights?.forEach((nl) => {
      nl.light.intensity = nl.baseIntensity * nightScale;
    });

    const ffOp = THREE.MathUtils.lerp(A.fireflyOpacity, B.fireflyOpacity, ease);
    if (this.world.fireflyMat && this.world.fireflyPoints) {
      this.world.fireflyMat.opacity = ffOp;
      this.world.fireflyPoints.visible = ffOp > 0.015;
    }

    const mistOp = THREE.MathUtils.lerp(A.mistOpacity, B.mistOpacity, ease);
    if (this.world.mistMat && this.world.mistGroup) {
      this.world.mistMat.opacity = mistOp;
      this.world.mistGroup.visible = mistOp > 0.015;
    }

    const cloudOp = THREE.MathUtils.lerp(A.cloudOpacity, B.cloudOpacity, ease);
    if (this.world.cloudMat && this.world.cloudGroup) {
      this.world.cloudMat.opacity = cloudOp;
      this.world.cloudGroup.visible = cloudOp > 0.015;
    }

    const leafOp = THREE.MathUtils.lerp(A.leafOpacity, B.leafOpacity, ease);
    if (this.world.leafMat && this.world.leafPoints) {
      this.world.leafMat.opacity = leafOp;
      this.world.leafPoints.visible = leafOp > 0.015;
    }

    const starOp = THREE.MathUtils.lerp(A.starOpacity, B.starOpacity, ease);
    if (this.world.nightSkyGroup && this.world.starMat && this.world.moonMat) {
      this.world.starMat.opacity = starOp;
      this.world.moonMat.opacity = starOp * 0.92;
      this.world.nightSkyGroup.visible = starOp > 0.015;
    }

    const htn = this.world.heartTreeNight;
    if (htn) {
      const active = nightScale > 0.02;
      htn.heartMat.opacity = nightScale * 0.98;
      htn.heartPoints.visible = active;
      htn.groundHaloMat.opacity = nightScale * 0.85;
      htn.groundHalo.visible = active;
      htn.spotLight.intensity = nightScale * 7.6;
      htn.dioramaGroup.visible = nightScale > 0.15;
      htn.baseLampMat.emissiveIntensity = nightScale * 2.6;
      htn.baseHaloMats.forEach((hm) => { hm.opacity = nightScale * 0.58; });
      htn.basePointLights.forEach((bpl) => { bpl.intensity = nightScale * 1.45; });
      htn.plaqueMat.emissiveIntensity = 0.2 + nightScale * 0.95;
      if (!active) {
        htn.waveHaloMats.forEach((wh) => { wh.opacity = 0; });
        htn.canopyGlowLight.intensity = 0;
      }
    }

    if (this.world.waterMesh && this.world.waterMesh.material instanceof THREE.MeshStandardMaterial) {
      this._todColA.setHex(A.waterTintHex);
      this._todColB.setHex(B.waterTintHex);
      this.world.waterMesh.material.color.copy(this._todColA).lerp(this._todColB, ease);
    }

    if (!this.isSoftwareGl) {
      this.renderer.shadowMap.needsUpdate = true;
    }
  }

  private stepFrame(): void {
    if (this.isContextLost) {
      this.clock.getDelta();
      return;
    }
    const dt = Math.min(this.clock.getDelta(), 0.1);
    const t = this.clock.elapsedTime;
    this.frameCounter++;

    if (!this.isSoftwareGl && !this.renderer.shadowMap.autoUpdate) {
      if (this.frameCounter % this.shadowInterval === 0) {
        this.renderer.shadowMap.needsUpdate = true;
      }
    }



    if (!this.paused) {
      this.timeMs += dt * 1000;
      if (this.todBlend < 1) {
        this.todBlend = Math.min(1, this.todBlend + dt / 6.0);
        this.applyTimeOfDayLerp(this.todBlend);
      }
      if (this.world.fireflyPoints?.visible && this.world.fireflyBase) {
        const posAttr = this.world.fireflyPoints.geometry.getAttribute('position') as THREE.BufferAttribute;
        const arr = posAttr.array as Float32Array;
        const base = this.world.fireflyBase;
        for (let i = 0; i < base.length; i++) {
          const b = base[i];
          const ph = t * b.speed + b.phase;
          arr[i * 3] = b.x + Math.cos(ph) * b.radius;
          arr[i * 3 + 1] = b.y + Math.sin(ph * 1.35) * 0.28;
          arr[i * 3 + 2] = b.z + Math.sin(ph * 0.9) * b.radius;
        }
        posAttr.needsUpdate = true;
      }

      if (this.world.mistGroup?.visible && this.world.mistData) {
        for (const md of this.world.mistData) {
          md.ang += dt * md.speed;
          md.mesh.position.x = Math.cos(md.ang) * md.rad;
          md.mesh.position.z = Math.sin(md.ang) * md.rad;
          md.mesh.position.y = md.yBase + Math.sin(t * 0.65 + md.phase) * 0.04;
          md.mesh.rotation.z = md.ang;
        }
      }

      if (this.world.cloudGroup?.visible && this.world.cloudData) {
        for (const cd of this.world.cloudData) {
          const span = 56;
          const x = (((cd.xBase + t * cd.speed + 28) % span) + span) % span - 28;
          cd.g.position.x = x;
          cd.g.position.y = cd.yBase + Math.sin(t * 0.4 + cd.phase) * 0.16;
        }
      }

      if (this.world.leafPoints?.visible && this.world.leafData) {
        const posAttr = this.world.leafPoints.geometry.getAttribute('position') as THREE.BufferAttribute;
        const arr = posAttr.array as Float32Array;
        const ld = this.world.leafData;
        for (let i = 0; i < ld.length; i++) {
          const p = ld[i];
          p.x += (p.vx + Math.sin(t * 1.6 + p.phase) * 0.35) * dt;
          p.z += (p.vz + Math.cos(t * 1.3 + p.phase) * 0.25) * dt;
          p.y -= p.vy * dt;
          if (p.y < 0.15) {
            p.y = 6.8 + Math.random() * 1.2;
            p.x = (Math.random() - 0.5) * 28;
            p.z = (Math.random() - 0.5) * 28;
          }
          if (p.x > 16) p.x = -16;
          if (p.z > 16) p.z = -16;
          arr[i * 3] = p.x;
          arr[i * 3 + 1] = p.y;
          arr[i * 3 + 2] = p.z;
        }
        posAttr.needsUpdate = true;
      }

      if (this.world.nightSkyGroup?.visible) {
        this.world.nightSkyGroup.rotation.y = t * 0.006;
      }

      if (this.stage4CampfireActive) {
        if (this.campfireBlend < 1) {
          this.campfireBlend = Math.min(1, this.campfireBlend + dt / 2.6);
          const ease = 1 - Math.pow(1 - this.campfireBlend, 2.2);
          const diceScale = 0.52 * (1 - ease);
          if (diceScale <= 0.015) {
            this.diceRig.dice.visible = false;
            this.diceRig.diceShadow.visible = false;
            this.diceRig.diceHint.visible = false;
          } else {
            this.diceRig.dice.scale.setScalar(diceScale);
            this.diceRig.dice.position.y = DICE_REST_Y + ease * 0.35;
            this.diceRig.dice.rotation.y += dt * 2.4;
            this.diceRig.diceShadow.scale.setScalar(1 - ease);
            this.diceRig.diceHint.scale.setScalar(1 - ease);
          }
          this.campfireRig.group.position.y = 0.05 + 0.20 * ease;
          this.campfireRig.group.scale.setScalar(0.05 + 0.95 * ease);
        }
        // 篝火火焰与火星跳动动画
        this.campfireRig.light.intensity =
          (2.6 + Math.sin(t * 9.5) * 0.35 + Math.cos(t * 15.2) * 0.2) * this.campfireBlend;
        this.campfireRig.flames.forEach((fm, fi) => {
          const sy = 0.86 + Math.sin(t * (7.5 + fi * 2.1) + fi * 1.4) * 0.22;
          const sx = 0.92 + Math.cos(t * (6.2 + fi * 1.7) + fi) * 0.12;
          fm.scale.set(sx, sy, sx);
          fm.rotation.z = Math.sin(t * 5.2 + fi * 1.7) * 0.14;
        });
        const spAttr = this.campfireRig.sparks.geometry.getAttribute('position') as THREE.BufferAttribute;
        const spArr = spAttr.array as Float32Array;
        for (let i = 0; i < this.campfireRig.sparkBase.length; i++) {
          const sb = this.campfireRig.sparkBase[i];
          const life = (t * sb.speed + sb.phase) % 1;
          const ang = sb.angle + life * 1.4;
          const rad = sb.radius * (1 - life * 0.35);
          spArr[i * 3] = Math.cos(ang) * rad;
          spArr[i * 3 + 1] = 0.22 + life * 0.92;
          spArr[i * 3 + 2] = Math.sin(ang) * rad;
        }
        spAttr.needsUpdate = true;
      }

      const htn = this.world.heartTreeNight;
      if (htn) {
        // 许愿牌全天随风轻摆
        for (let i = 0; i < htn.wishingPlaques.length; i++) {
          const wp = htn.wishingPlaques[i];
          wp.group.rotation.z = wp.baseRotZ + Math.sin(t * 1.7 + wp.phase) * 0.065;
          wp.group.rotation.x = Math.cos(t * 1.3 + wp.phase) * 0.04;
        }
      }
      if (htn && htn.heartPoints.visible) {
        // 1) 4 组树冠红灯笼波浪流光呼吸 + 外圈光晕
        const baseLant = this.mapConfig.timePresets[this.timeOfDay].lanternEmissive;
        const nightFactor = THREE.MathUtils.clamp(htn.heartMat.opacity / 0.98, 0, 1);
        htn.waveMats.forEach((wm, wi) => {
          const wave = 0.5 + 0.5 * Math.sin(t * 2.9 - wi * 1.45);
          wm.emissiveIntensity = baseLant * (0.45 + 1.15 * wave);
          if (htn.waveHaloMats[wi]) {
            htn.waveHaloMats[wi].opacity = nightFactor * (0.08 + 0.36 * wave);
          }
        });
        htn.canopyGlowLight.intensity = nightFactor * (1.1 + 0.45 * Math.sin(t * 2.4));

        // 2) 沿树冠爱心边缘环绕的粉金小爱心微光律动
        const hAttr = htn.heartPoints.geometry.getAttribute('position') as THREE.BufferAttribute;
        const hArr = hAttr.array as Float32Array;
        for (let i = 0; i < htn.heartBase.length; i++) {
          const hb = htn.heartBase[i];
          const ph = t * hb.speed + hb.phase;
          hArr[i * 3] = hb.x + Math.cos(ph) * 0.075;
          hArr[i * 3 + 1] = hb.y + Math.sin(ph * 1.15) * 0.095;
          hArr[i * 3 + 2] = hb.z + Math.sin(ph * 0.85) * 0.075;
        }
        hAttr.needsUpdate = true;

        // 3) 树池地面光环旋转呼吸
        htn.groundHalo.rotation.z = t * 0.28;
        const gs = 1 + Math.sin(t * 2.1) * 0.05;
        htn.groundHalo.scale.set(gs, gs, 1);

        // 4) 树冠投影秀（并排一二 & 布布手指比耶动画，15fps 刷新 512x512 SpotLight.map）
        if (t - htn.lastProjDraw >= 0.066) {
          htn.lastProjDraw = t;
          const pg = htn.projCanvas.getContext('2d');
          if (pg) {
            pg.fillStyle = '#000000';
            pg.fillRect(0, 0, 512, 512);

            const drawPeaceBear = (
              cx: number,
              cy: number,
              isPanda: boolean,
              phaseOffset: number,
            ) => {
              const bob = Math.sin(t * 3.4 + phaseOffset) * 5;
              const tilt = Math.sin(t * 2.4 + phaseOffset) * 0.045;
              const pawBob = Math.sin(t * 5.6 + phaseOffset) * 5.5;
              const pawRot = Math.sin(t * 5.2 + phaseOffset) * 0.16;
              const blinkCycle = (t + phaseOffset * 0.7) % 4.2;
              const isBlinking = blinkCycle > 4.02;

              const outline = '#3b251c';
              const bodyCol = isPanda ? '#ffffff' : '#cc9978';
              const blushCol = isPanda ? '#fab8bf' : '#f4cc86';

              pg.save();
              pg.translate(cx, cy + bob);
              pg.rotate(tilt);

              // 柔和白色外发光轮廓，模拟投影灯亮边
              pg.shadowColor = 'rgba(255, 246, 240, 0.92)';
              pg.shadowBlur = 18;

              // 1) 圆耳（熊猫实心深棕；布布外棕内深棕）
              for (const sx of [-1, 1]) {
                pg.fillStyle = isPanda ? outline : bodyCol;
                pg.strokeStyle = '#ffffff';
                pg.lineWidth = 10;
                pg.beginPath();
                pg.arc(sx * 70, -68, 25, 0, Math.PI * 2);
                pg.stroke();
                pg.fill();

                pg.strokeStyle = outline;
                pg.lineWidth = 6;
                pg.beginPath();
                pg.arc(sx * 70, -68, 24, 0, Math.PI * 2);
                pg.fill();
                pg.stroke();

                if (!isPanda) {
                  pg.fillStyle = outline;
                  pg.beginPath();
                  pg.arc(sx * 70, -68, 13, 0, Math.PI * 2);
                  pg.fill();
                }
              }

              // 2) 奶白一二胸前深棕小领结
              if (isPanda) {
                pg.fillStyle = outline;
                pg.strokeStyle = '#ffffff';
                pg.lineWidth = 8;
                pg.beginPath();
                pg.ellipse(-10, 84, 15, 11, -0.35, 0, Math.PI * 2);
                pg.ellipse(10, 84, 15, 11, 0.35, 0, Math.PI * 2);
                pg.stroke();
                pg.fill();
              }

              // 3) 软萌麻糬大脸轮廓（上圆下微鼓腮帮）
              const traceHead = () => {
                pg.beginPath();
                pg.moveTo(0, -82);
                pg.bezierCurveTo(64, -82, 92, -46, 94, -2);
                pg.bezierCurveTo(96, 44, 80, 74, 0, 74);
                pg.bezierCurveTo(-80, 74, -96, 44, -94, -2);
                pg.bezierCurveTo(-92, -46, -64, -82, 0, -82);
                pg.closePath();
              };

              // 白色贴纸外描边
              traceHead();
              pg.strokeStyle = '#ffffff';
              pg.lineWidth = 12;
              pg.stroke();

              // 脸部底色 + 深棕描边
              pg.shadowBlur = 0;
              traceHead();
              pg.fillStyle = bodyCol;
              pg.fill();
              pg.strokeStyle = outline;
              pg.lineWidth = 6.5;
              pg.stroke();

              // 4) 大圆腮红
              pg.fillStyle = blushCol;
              for (const sx of [-1, 1]) {
                pg.beginPath();
                pg.ellipse(sx * 64, 30, 21, 18, 0, 0, Math.PI * 2);
                pg.fill();
              }

              // 5) 低位圆眼睛（带偶尔眨眼）
              pg.fillStyle = outline;
              pg.strokeStyle = outline;
              pg.lineWidth = 4.5;
              pg.lineCap = 'round';
              for (const sx of [-1, 1]) {
                if (isBlinking) {
                  pg.beginPath();
                  pg.moveTo(sx * 45 - 8, 8);
                  pg.quadraticCurveTo(sx * 45, 2, sx * 45 + 8, 8);
                  pg.stroke();
                } else {
                  pg.beginPath();
                  pg.arc(sx * 45, 8, 10, 0, Math.PI * 2);
                  pg.fill();
                }
              }

              // 6) 经典 w 嘴 + 开心小舌头
              pg.fillStyle = '#f4848c';
              pg.beginPath();
              pg.ellipse(0, 23, 8.5, 13, 0, 0, Math.PI * 2);
              pg.fill();
              pg.strokeStyle = outline;
              pg.lineWidth = 4;
              pg.stroke();

              pg.fillStyle = bodyCol;
              pg.beginPath();
              pg.rect(-18, 0, 36, 15);
              pg.fill();

              pg.strokeStyle = outline;
              pg.lineWidth = 4.2;
              pg.lineCap = 'round';
              pg.beginPath();
              pg.moveTo(-12, 7);
              pg.quadraticCurveTo(-6, 18, 0, 9);
              pg.quadraticCurveTo(6, 18, 12, 7);
              pg.stroke();

              // 7) 招牌「手指比耶 ✌️」小爪子（带上下摆动动画）
              pg.save();
              pg.translate(-44, 54 + pawBob);
              pg.rotate(-0.18 + pawRot);

              // 两根比耶手指 + 圆润手掌
              pg.fillStyle = bodyCol;
              pg.strokeStyle = outline;
              pg.lineWidth = 5.5;
              pg.lineJoin = 'round';

              // 手指 1（竖起）
              pg.beginPath();
              pg.ellipse(-6, -24, 9.5, 16, -0.22, 0, Math.PI * 2);
              pg.fill();
              pg.stroke();
              // 手指 2（斜起成 V）
              pg.beginPath();
              pg.ellipse(12, -20, 9.5, 15.5, 0.36, 0, Math.PI * 2);
              pg.fill();
              pg.stroke();
              // 圆润手掌底座
              pg.beginPath();
              pg.ellipse(2, 2, 24, 21, 0, 0, Math.PI * 2);
              pg.fill();
              pg.stroke();
              // 弯曲拇指小弧线
              pg.lineWidth = 4.2;
              pg.beginPath();
              pg.arc(4, 3, 9.5, -0.4, Math.PI * 0.95);
              pg.stroke();
              pg.restore();

              pg.restore();
            };

            // 左：奶白一二，右：焦糖布布（并排投影，整体上移至树冠中上部宽阔区）
            drawPeaceBear(148, 236, true, 0);
            drawPeaceBear(364, 236, false, 1.35);

            // 上方点缀缓缓闪烁的爱心
            const spAlpha = 0.72 + 0.28 * Math.sin(t * 3.8);
            pg.fillStyle = `rgba(255, 188, 212, ${spAlpha})`;
            pg.beginPath();
            pg.moveTo(256, 126);
            pg.bezierCurveTo(234, 110, 232, 88, 246, 86);
            pg.bezierCurveTo(254, 84, 256, 94, 256, 94);
            pg.bezierCurveTo(256, 94, 258, 84, 266, 86);
            pg.bezierCurveTo(280, 88, 278, 110, 256, 126);
            pg.fill();

            htn.projTex.needsUpdate = true;
          }
        }

        // 5) 树下「一二 & 布布」10 秒许愿拍照小剧场
        if (htn.dioramaGroup.visible) {
          const cyc = t % 10.0;
          const yPt = htn.yierMesh.userData.parts as PlaneParts | undefined;
          const bPt = htn.bubuMesh.userData.parts as PlaneParts | undefined;
          const lerpYaw = (cur: number, target: number) => {
            let diff = ((target - cur + Math.PI) % (Math.PI * 2)) - Math.PI;
            if (diff < -Math.PI) diff += Math.PI * 2;
            return cur + diff * Math.min(1, dt * 10);
          };
          const setPose = (
            mesh: THREE.Group,
            pt: PlaneParts | undefined,
            sideSign: number,
          ) => {
            if (!pt) return;
            const fp = pt.headMesh.userData.faceParts as HeadFaceParts | undefined;
            if (cyc < 4.0) {
              // 阶段1：面向爱心树（+Z）仰望许愿（双手合十）
              mesh.rotation.y = lerpYaw(mesh.rotation.y, -sideSign * 0.18);
              pt.animRoot.position.y = Math.sin(t * 2.2) * 0.015;
              pt.headPivot.rotation.x = -0.34;
              pt.headPivot.rotation.z = sideSign * 0.08;
              pt.leftArm.rotation.x = -1.05;
              pt.leftArm.rotation.z = 0.45;
              pt.rightArm.rotation.x = -1.05;
              pt.rightArm.rotation.z = -0.45;
              if (fp) { fp.mouthW.visible = true; fp.mouthOpen.visible = false; }
            } else if (cyc < 7.2) {
              // 阶段2：转身面向三脚架相机（-Z）比耶贴脸合影
              mesh.rotation.y = lerpYaw(mesh.rotation.y, Math.PI + sideSign * 0.16);
              pt.animRoot.position.y = 0;
              pt.headPivot.rotation.x = 0.04;
              pt.headPivot.rotation.z = sideSign * 0.14;
              if (sideSign < 0) {
                pt.leftArm.rotation.x = -0.5;
                pt.leftArm.rotation.z = 1.35 + Math.sin(t * 7) * 0.18;
                pt.rightArm.rotation.x = -0.3;
                pt.rightArm.rotation.z = -0.4;
              } else {
                pt.rightArm.rotation.x = -0.5;
                pt.rightArm.rotation.z = -1.35 - Math.sin(t * 7) * 0.18;
                pt.leftArm.rotation.x = -0.3;
                pt.leftArm.rotation.z = 0.4;
              }
              if (fp) { fp.mouthW.visible = false; fp.mouthOpen.visible = true; }
            } else {
              // 阶段3：拍完面向相机开心蹦跳
              const jump = Math.abs(Math.sin((cyc - 7.2) * Math.PI * 2.5));
              mesh.rotation.y = lerpYaw(mesh.rotation.y, Math.PI + sideSign * 0.12);
              pt.animRoot.position.y = jump * 0.11;
              pt.headPivot.rotation.x = 0;
              pt.headPivot.rotation.z = Math.sin(t * 8) * 0.12;
              pt.leftArm.rotation.x = 0;
              pt.leftArm.rotation.z = 1.2 + jump * 0.3;
              pt.rightArm.rotation.x = 0;
              pt.rightArm.rotation.z = -1.2 - jump * 0.3;
              if (fp) { fp.mouthW.visible = false; fp.mouthOpen.visible = true; }
            }
          };
          setPose(htn.yierMesh, yPt, -1);
          setPose(htn.bubuMesh, bPt, 1);

          // 相机闪光灯在 cyc = 6.1s 触发脉冲
          if (cyc >= 6.1 && cyc < 6.6) {
            const fp = 1 - (cyc - 6.1) / 0.5;
            htn.flashLight.intensity = fp * fp * 4.5;
            htn.flashHaloMat.opacity = fp * 0.95;
            htn.flashHalo.scale.setScalar(0.6 + (1 - fp) * 1.4);
          } else {
            htn.flashLight.intensity = 0;
            htn.flashHaloMat.opacity = 0;
          }
        }
      }

      if (t >= this.nextWeatherAudioAt) {
        playWeatherAmbientPulse(this.timeOfDay);
        this.nextWeatherAudioAt = t + (this.timeOfDay === 'evening' ? 5.2 : 6.8) + Math.random() * 4.5;
      }
      if (this.deadline !== null && this.timeMs >= this.deadline && !this.itemBusy) {
        this.deadline = null;
        if (this.phase === 'awaitRoll' && !this.isAI()) {
          if (this.pendingItemTarget !== null) {
            this.cancelItemTarget();
          }
          this.doRoll();
          this.setMsg('⏱️ 超时未操作，自动掷骰');
        } else if (this.phase === 'awaitMove' && this.movable.length && this.die !== null) {
          this.performMove(this.aiPick(this.movable).plane, this.die);
          this.setMsg('⏱️ 超时未操作，自动移动');
        }
      }
      if (this.phase === 'shopChoice' && this.shopDeadline !== null && this.timeMs >= this.shopDeadline) {
        this.shopDeadline = null;
        const autoItem = this.shopOffer?.[0] ?? 'shield';
        this.pickShopItem(autoItem);
      }

      for (let i = this.pending.length - 1; i >= 0; i--) {
        if (this.timeMs >= this.pending[i].at) {
          const f = this.pending[i];
          this.pending.splice(i, 1);
          f.fn();
        }
      }

      const smooth01 = (v: number) => {
        const c = Math.max(0, Math.min(1, v));
        return c * c * (3 - 2 * c);
      };
      if (t >= this.nextGlobalCakeEatAt) {
        const cakePool = this.world.rideToys.filter((r) => r.cakeEat && r.cakeEat.eatStart < 0);
        if (cakePool.length > 0) {
          const picked = cakePool[(Math.random() * cakePool.length) | 0];
          picked.cakeEat!.eatStart = t;
        }
        const baseGap = this.timeOfDay === 'evening' ? 25 + Math.random() * 10 : 50 + Math.random() * 20;
        this.nextGlobalCakeEatAt = t + baseGap;
      }

      for (const rt of this.world.rideToys) {
        const w = t * 1.45 + rt.phase;
        const rock = Math.sin(w);
        rt.rockerPivot.rotation.x = rock * 0.095;
        rt.rockerPivot.position.y = Math.abs(rock) * 0.012;
        rt.riderPivot.rotation.x = Math.sin(w - 0.55) * 0.085;
        let headRotX = Math.sin(w - 0.95) * 0.07;
        let headRotY = 0;
        let headRotZ = Math.sin(t * 0.7 + rt.phase) * 0.045;

        const ce = rt.cakeEat;
        if (ce) {
          if (ce.eatStart >= 0) {
            const p = (t - ce.eatStart) / ce.eatDur;
            if (p >= 1) {
              ce.eatStart = -1;
              ce.restArmGroup.visible = true;
              ce.eatArmPivot.visible = false;
              ce.eatArmPivot.rotation.set(0, 0, 0);
              ce.cakeGroup.visible = true;
              ce.cakeGroup.position.set(0.145, 0.128, 0.28);
              ce.cakeGroup.scale.setScalar(1.45);
              ce.cakeSlice1.visible = true;
              ce.cakeSlice1.scale.setScalar(1);
              ce.cakeSlice2.visible = true;
              ce.cakeSlice2.scale.setScalar(1);
              ce.mouthClosed.visible = true;
              ce.mouthOpen.visible = false;
              ce.mouthOpen.scale.set(1, 1, 1);
              ce.jawPivot.rotation.x = 0;
              ce.blushMeshes.forEach((bm) => bm.scale.set(1.04, 1.0, 0.24));
              ce.normalEyes.forEach((em) => (em.visible = true));
              ce.happyEyes.forEach((em) => (em.visible = false));
            } else {
              ce.restArmGroup.visible = false;
              ce.eatArmPivot.visible = true;

              // 3口吃掉草莓小蛋糕：0 = 脸侧举着展示, 1 = 准确塞入嘴口中心
              let feed = 0;
              if (p < 0.12) {
                feed = 0;
              } else if (p < 0.22) {
                feed = smooth01((p - 0.12) / 0.10); // 第1口送入嘴中
              } else if (p < 0.30) {
                feed = 1 - smooth01((p - 0.22) / 0.08);
              } else if (p < 0.40) {
                feed = 0; // 咀嚼第1口
              } else if (p < 0.50) {
                feed = smooth01((p - 0.40) / 0.10); // 第2口送入嘴中
              } else if (p < 0.58) {
                feed = 1 - smooth01((p - 0.50) / 0.08);
              } else if (p < 0.68) {
                feed = 0; // 咀嚼第2口
              } else if (p < 0.78) {
                feed = smooth01((p - 0.68) / 0.10); // 第3口连草莓一起塞入嘴中
              } else if (p < 0.86) {
                feed = 1 - smooth01((p - 0.78) / 0.08);
              } else {
                feed = 0;
              }

              // 负 Y 旋转向内摆动，让蛋糕精确进入嘴巴中心 (x≈0, y≈0.40, z≈0.245)
              ce.eatArmPivot.rotation.set(-0.12 * feed, -0.92 * feed, 0.16 * feed);

              // 第1口(0.22)吃掉第1瓣，第2口(0.50)吃掉第2瓣，第3口(0.78)整块吃光
              const popIn = p < 0.07 ? smooth01(p / 0.07) : 1;
              ce.cakeSlice1.visible = p < 0.22;
              if (p >= 0.18 && p < 0.22) {
                ce.cakeSlice1.scale.setScalar(1 - smooth01((p - 0.18) / 0.04) * 0.7);
              } else {
                ce.cakeSlice1.scale.setScalar(1);
              }

              ce.cakeSlice2.visible = p < 0.50;
              if (p >= 0.46 && p < 0.50) {
                ce.cakeSlice2.scale.setScalar(1 - smooth01((p - 0.46) / 0.04) * 0.7);
              } else {
                ce.cakeSlice2.scale.setScalar(1);
              }

              let stuff3Scale = 1;
              if (p >= 0.73 && p < 0.78) {
                stuff3Scale = 1 - smooth01((p - 0.73) / 0.05) * 0.85;
              }
              ce.cakeGroup.visible = p < 0.78;
              ce.cakeGroup.position.set(0.145, 0.128, 0.28);
              ce.cakeGroup.scale.setScalar(1.45 * Math.max(0.05, popIn * stuff3Scale));

              // 3D 张嘴接住蛋糕 + 舒缓自然的咀嚼频率
              const bite1Open = p >= 0.14 && p <= 0.24;
              const bite2Open = p >= 0.42 && p <= 0.52;
              const bite3Open = p >= 0.70 && p <= 0.80;
              const isChewing =
                (p > 0.24 && p < 0.41) || (p > 0.52 && p < 0.69) || (p > 0.80 && p < 0.95);

              if (bite1Open || bite2Open || bite3Open) {
                ce.mouthClosed.visible = false;
                ce.mouthOpen.visible = true;
                const dur = 0.10;
                const start = bite1Open ? 0.14 : bite2Open ? 0.42 : 0.70;
                const openPeak = Math.sin(smooth01((p - start) / dur) * Math.PI);
                ce.mouthOpen.scale.set(1.0 + openPeak * 0.24, 0.9 + openPeak * 0.42, 1.0 + openPeak * 0.35);
                ce.jawPivot.rotation.x = 0.2 + openPeak * 0.45;
              } else if (isChewing) {
                // 舒缓可爱的慢速咀嚼（约 1.2 次/秒）
                const chewWave = 0.5 + 0.5 * Math.sin(t * 7.5);
                ce.mouthClosed.visible = false;
                ce.mouthOpen.visible = true;
                ce.mouthOpen.scale.set(0.95, 0.45 + chewWave * 0.38, 0.9);
                ce.jawPivot.rotation.x = 0.06 + chewWave * 0.28;
              } else {
                ce.mouthClosed.visible = true;
                ce.mouthOpen.visible = false;
                ce.jawPivot.rotation.x = 0;
              }

              const cheekPuff = isChewing ? 1 + (0.5 + 0.5 * Math.sin(t * 7.5)) * 0.16 : 1;
              ce.blushMeshes.forEach((bm) =>
                bm.scale.set(1.04 * cheekPuff, 1.0 * cheekPuff, 0.24 * (1 + (cheekPuff - 1) * 1.4)),
              );

              const isHappy = p >= 0.22 && p < 0.95;
              ce.normalEyes.forEach((em) => (em.visible = !isHappy));
              ce.happyEyes.forEach((em) => (em.visible = isHappy));

              headRotX += feed * 0.1 + (isChewing ? Math.abs(Math.sin(t * 7.5)) * 0.04 : 0);
              if (isChewing) {
                headRotZ += Math.sin(t * 5.2) * 0.055;
              }
            }
          }
        }

        rt.headPivot.rotation.set(headRotX, headRotY, headRotZ);
      }

      const movableSet =
        this.phase === 'awaitMove'
          ? new Set(this.movable.map((m) => m.plane))
          : this.phase === 'awaitRoll' && this.pendingItemTarget !== null
            ? new Set(this.targetChoices.map((c) => c.plane))
            : null;

      this.planes.forEach((p) => {
        if (p.shieldMesh && p.shieldMesh.visible) {
          const eqRing = p.shieldMesh.userData.eqRing as THREE.Mesh | undefined;
          if (eqRing) {
            eqRing.rotation.z = t * 1.45 + p.phase;
            eqRing.position.y = 0.34 + Math.sin(t * 3.1 + p.phase) * 0.02;
          }
          let sTotal = 1;
          let sIdx = 0;
          if (p.pos >= 1 && p.pos < HOME_END) {
            const liveStack = this.planes
              .filter((q) => q.pid === p.pid && q.pos === p.pos)
              .sort((a, b) => a.idx - b.idx);
            sTotal = Math.max(1, liveStack.length);
            const foundIdx = liveStack.indexOf(p);
            sIdx = foundIdx >= 0 ? foundIdx : 0;
          }
          const pulse = 1 + Math.sin(t * 2.6 + p.phase) * 0.02;
          if (sTotal >= 2) {
            const centerOffsetY = ((sTotal - 1) * 0.5 - sIdx) * (STACK_STEP_Y / 0.92);
            const sx = (1 + (sTotal - 1) * 0.14) * pulse;
            const sy = (1 + (sTotal - 1) * 0.72) * pulse;
            p.shieldMesh.position.set(0, centerOffsetY - 0.34 * (sy - 1), 0);
            p.shieldMesh.scale.set(sx, sy, sx);
          } else {
            p.shieldMesh.position.set(0, 0, 0);
            p.shieldMesh.scale.setScalar(pulse);
          }
        }

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

        const smokeUntil = (p.mesh.userData.smokeUntil as number) || 0;
        let smokeGrp = p.mesh.userData.smokeGroup as THREE.Group | undefined;
        if (this.timeMs < smokeUntil && p.pos >= 1) {
          if (!smokeGrp) {
            smokeGrp = new THREE.Group();
            const puffGeo = new THREE.SphereGeometry(0.055, 10, 8);
            for (let k = 0; k < 5; k++) {
              const mat = new THREE.MeshStandardMaterial({
                color: k % 2 === 0 ? 0x6b7280 : 0x9ca3af,
                transparent: true,
                opacity: 0.72,
                roughness: 0.92,
                depthWrite: false,
              });
              const puff = new THREE.Mesh(puffGeo, mat);
              puff.userData.seed = k / 5;
              smokeGrp.add(puff);
            }
            p.mesh.add(smokeGrp);
            p.mesh.userData.smokeGroup = smokeGrp;
          }
          smokeGrp.visible = true;
          smokeGrp.children.forEach((child, idx) => {
            const puff = child as THREE.Mesh;
            const phase = ((t * 0.95 + (puff.userData.seed as number)) % 1 + 1) % 1;
            const ang = idx * 1.3 + phase * 3.2;
            const rad = 0.04 + phase * 0.11;
            puff.position.set(
              Math.cos(ang) * rad,
              0.74 + phase * 0.56,
              Math.sin(ang) * rad,
            );
            const sc = 0.55 + phase * 1.05;
            puff.scale.setScalar(sc);
            (puff.material as THREE.MeshStandardMaterial).opacity = (1 - phase) * 0.75;
          });
        } else if (smokeGrp) {
          smokeGrp.visible = false;
        }

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

        // 非棋盘叠叠乐状态（单个棋子、START 区域并排站立或护盾挡踩挤脸）
        if (baseX !== undefined && baseY !== undefined && baseZ !== undefined && baseYaw !== undefined) {
          p.mesh.position.set(baseX, baseY, baseZ);
          p.mesh.rotation.set(0, baseYaw, 0);
        }

        const showRibbon = p.pos === HOME_END;
        if (pt.redScarf) pt.redScarf.visible = showRibbon;
        if (pt.leftRibbonPivot) pt.leftRibbonPivot.visible = showRibbon;
        if (pt.rightRibbonPivot) pt.rightRibbonPivot.visible = showRibbon;

        if (p.pos === HOME_END) {
          // 终点方阵欢快跳「双手执红绸向正面挥甩」舞（速度提升 20%），张开开心小嘴
          const v = t * 3.75 + p.pid * 0.65;
          const sway = Math.sin(v);
          const bounce = Math.abs(Math.sin(v));
          const faceParts = pt.headMesh.userData.faceParts as HeadFaceParts | undefined;
          if (faceParts) {
            faceParts.mouthW.visible = false;
            faceParts.mouthOpen.visible = true;
          }
          p.mesh.scale.setScalar(baseScale);
          pt.animRoot.position.y = bounce * 0.095;
          pt.animRoot.rotation.z = sway * 0.16;
          pt.animRoot.rotation.y = sway * 0.16;
          pt.animRoot.scale.set(1 + (1 - bounce) * 0.03, 1 + bounce * 0.055, 1 + (1 - bounce) * 0.03);
          pt.leftArm.rotation.x = -0.92;
          pt.leftArm.rotation.y = sway * 0.36;
          pt.leftArm.rotation.z = 0.22 + sway * 0.32;
          pt.rightArm.rotation.x = -0.92;
          pt.rightArm.rotation.y = sway * 0.36;
          pt.rightArm.rotation.z = -0.22 + sway * 0.32;
          pt.leftFoot.rotation.x = sway * 0.34;
          pt.rightFoot.rotation.x = -sway * 0.34;
          pt.headPivot.rotation.z = -sway * 0.14;
          pt.headPivot.rotation.y = sway * 0.16;
          pt.headPivot.rotation.x = bounce * 0.06;
          this.animateSilkRibbon(pt.leftRibbonPivot, v, -1);
          this.animateSilkRibbon(pt.rightRibbonPivot, v + 0.35, 1);
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

            if ((p.pos === 0 || (p.pos >= 1 && stackTotal <= 1)) && huddleTotal >= 2) {
              // START 区域或同格挤脸状态：软糯横向微扁、贴脸轻贴
              const huddleSeed = p.pid * 2.1;
              const nuzzle = Math.sin(t * 2.2 + huddleSeed);
              p.mesh.scale.setScalar(baseScale);
              pt.animRoot.position.y = 0;
              pt.animRoot.rotation.set(hPitch, 0, hRoll * 0.5);
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
      if (this.world.moatTex) {
        this.world.moatTex.offset.x -= dt * 0.068;
        this.world.moatTex.offset.y += Math.sin(t * 0.6) * dt * 0.008;
      }
      if (this.world.waterNormalTex) {
        this.world.waterNormalTex.offset.x -= dt * 0.078;
        this.world.waterNormalTex.offset.y -= dt * 0.018;
      }
      if (this.world.waterUniforms) {
        this.world.waterUniforms.uTime.value = t;
      }
      this.world.onUpdate?.(t, dt);

      for (const l of this.world.lotusList) {
        l.g.position.y = wy + 0.008 + Math.sin(t * 1.6 + l.phase) * 0.012;
      }
      for (const w of this.world.willowDrapeList) {
        w.g.rotation.z = Math.sin(t * 1.2 + w.phase) * 0.06;
        w.g.rotation.x = Math.cos(t * 0.9 + w.phase) * 0.04;
      }
      for (let pi = 0; pi < this.world.petals.length; pi++) {
        const p = this.world.petals[pi];
        if (this.quality === 'low' && pi % 2 === 1) {
          p.m.visible = false;
          continue;
        }
        p.m.visible = true;
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

      if (!this.stage4CampfireActive) {
        const showingTwin = this.twinDice !== null || (this.phase === 'rolling' && this.twinDiceUsedForRoll);
        const targetDiceScale = showingTwin
          ? 0.47
          : this.phase === 'awaitRoll' && !this.isAI() && this.diceHovered
            ? 0.58
            : 0.52;
        _scratchDiceScale.set(targetDiceScale, targetDiceScale, targetDiceScale);
        this.diceRig.dice.scale.lerp(_scratchDiceScale, Math.min(1, dt * 12));
        if (!showingTwin && this.phase !== 'rolling') {
          this.diceRig.dice2.visible = false;
          this.diceRig.dice2Shadow.visible = false;
          this.diceRig.dice.position.x = THREE.MathUtils.lerp(
            this.diceRig.dice.position.x,
            0,
            Math.min(1, dt * 10),
          );
          this.diceRig.diceShadow.position.x = this.diceRig.dice.position.x;
        }

        if (this.diceRig.diceHint.visible) {
          const pulse = 0.5 + 0.5 * Math.sin(t * 3.4);
          const rippleCycle = (t * 0.72) % 1;
          this.diceRig.dhRing.scale.setScalar(
            (this.diceHovered ? 1.24 : 1.12) + pulse * 0.1,
          );
          (this.diceRig.dhRing.material as THREE.MeshBasicMaterial).opacity =
            (this.diceHovered ? 0.98 : 0.84) + pulse * 0.16;
          this.diceRig.dhRipple.scale.setScalar(1 + rippleCycle * 0.95);
          (this.diceRig.dhRipple.material as THREE.MeshBasicMaterial).opacity =
            (1 - rippleCycle) * (this.diceHovered ? 0.78 : 0.58);

          const idleFloatY =
            DICE_REST_Y + (this.diceHovered ? 0.24 : 0.16) + Math.sin(t * 3.2) * 0.055;
          this.diceRig.dice.position.y = THREE.MathUtils.lerp(
            this.diceRig.dice.position.y,
            idleFloatY,
            Math.min(1, dt * 10),
          );
          const shadowScale = Math.max(0.68, 1 - (this.diceRig.dice.position.y - DICE_REST_Y) * 0.85);
          this.diceRig.diceShadow.scale.setScalar(shadowScale);
          this.diceRig.diceMaterials.forEach((m) => {
            m.emissive.setHex(0xffeaa8);
            m.emissiveIntensity = (this.diceHovered ? 0.26 : 0.14) + pulse * 0.1;
          });
        } else {
          if (this.phase !== 'rolling') {
            this.diceRig.dice.position.y = THREE.MathUtils.lerp(
              this.diceRig.dice.position.y,
              DICE_REST_Y,
              Math.min(1, dt * 12),
            );
          }
          this.diceRig.diceShadow.scale.setScalar(1);
          this.diceRig.diceMaterials.forEach((m) => {
            m.emissiveIntensity = 0;
          });
        }
      }

      const fencePulse = 0.5 + 0.5 * Math.sin(t * 5.2);
      this.world.courtFences.forEach((cf) => {
        if (cf.active) {
          if (cf.pulse) {
            cf.woodMat.emissiveIntensity = 0.08 + fencePulse * 0.92;
            cf.trimMat.emissiveIntensity = 0.15 + fencePulse * 1.35;
            cf.capMat.emissiveIntensity = 0.35 + fencePulse * 2.15;
          } else {
            cf.woodMat.emissiveIntensity = 0.42;
            cf.trimMat.emissiveIntensity = 0.65;
            cf.capMat.emissiveIntensity = 1.05;
          }
        }
      });

      const hd = this.diceRig.dice.position.y - DICE_REST_Y;
      (this.diceRig.diceShadow.material as THREE.MeshBasicMaterial).opacity = Math.max(
        0.06,
        0.28 - 0.12 * hd,
      );
      this.diceRig.diceShadow.scale.setScalar(1 + 0.15 * hd);
      if (this.diceRig.dice2.visible) {
        const hd2 = this.diceRig.dice2.position.y - DICE_REST_Y;
        (this.diceRig.dice2Shadow.material as THREE.MeshBasicMaterial).opacity = Math.max(
          0.06,
          0.26 - 0.12 * hd2,
        );
        this.diceRig.dice2Shadow.scale.setScalar(1 + 0.15 * hd2);
      }

      for (let i = this.world.critters.length - 1; i >= 0; i--) {
        const c = this.world.critters[i];
        c.ttl -= dt;
        const canDespawn =
          c.kind !== 'rabbit' || c.state === 'rest' || c.state === 'hop';
        if (c.ttl <= 0 && canDespawn) {
          this.scene.remove(c.g);
          this.disposeGeometryOnly(c.g);
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
          this.disposeGeometryOnly(c.g);
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
          this.disposeGeometryOnly(c.g);
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
          this.disposeGeometryOnly(c.g);
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

      // 护城河游船阶段控制：阶段 0~1 仅青衣男子独舟巡游；阶段 2 及以后白衣女子泛舟登场并触发对诗
      const boats = this.world.boats;
      const maidenActive =
        this.maxDoneStage >= 2 ||
        this.timeOfDay === 'afternoon' ||
        this.timeOfDay === 'evening';
      if (boats.length >= 2) {
        const bScholar = boats[0];
        const bMaiden = boats[1];
        bMaiden.g.visible = maidenActive;
        if (!maidenActive) {
          bScholar.speedFactor = 1;
          bScholar.targetLookYaw = 0;
          bMaiden.speedFactor = 1;
          bMaiden.targetLookYaw = 0;
          this.poemState = 'cruising';
          this.poemTimer = 0;
          this.poemBubbles.scholar.visible = false;
          this.poemBubbles.maiden.visible = false;
          this.poemBubbles.scholar.root.style.opacity = '0';
          this.poemBubbles.maiden.root.style.opacity = '0';
        } else {
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
      }

      for (const b of boats) {
        if (!b.g.visible) continue;
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
    const shopSec =
      this.phase === 'shopChoice' && this.shopDeadline !== null && !this.paused
        ? Math.max(0, Math.ceil((this.shopDeadline - this.timeMs) / 1000))
        : -1;
    if (sec !== this.lastSec || shopSec !== this.lastShopSec) {
      this.lastSec = sec;
      this.lastShopSec = shopSec;
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
      const targetRadius = this.camFollowCloseup
        ? THREE.MathUtils.clamp(home.radius * 0.34, 5.5, 6.2)
        : THREE.MathUtils.clamp(home.radius * 0.48, 6.8, 9.2);
      const targetPhi = this.camFollowCloseup ? 1.04 : 0.94;
      this.camGoalSpherical.set(
        targetRadius,
        targetPhi,
        _scratchCamSpherical.theta,
      );
      this.camGoalActive = true;
    }

    if (!this.camGoalActive) return;

    const rate = this.camMode === 'follow' && this.camFollowPlane ? (this.camFollowCloseup ? 8.5 : 7.0) : 3.8;
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

  /** WebGL 上下文从后台丢失恢复后：重建 PMREM 环境光贴图并强制重传全部纹理与阴影 */
  private restoreGpuResources(): void {
    if (this.disposed) return;
    try {
      this.envRT.dispose();
    } catch {
      // ignore
    }
    const pmremGenerator = new THREE.PMREMGenerator(this.renderer);
    const roomEnv = new RoomEnvironment();
    this.envRT = pmremGenerator.fromScene(roomEnv, 0.04);
    this.scene.environment = this.envRT.texture;
    roomEnv.dispose();
    pmremGenerator.dispose();

    const markTex = (tex: THREE.Texture | null | undefined) => {
      if (tex) tex.needsUpdate = true;
    };

    this.scene.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (mesh.material) {
        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        for (const m of mats) {
          const std = m as THREE.MeshStandardMaterial;
          markTex(std.map);
          markTex(std.normalMap);
          markTex(std.roughnessMap);
          markTex(std.metalnessMap);
          markTex(std.emissiveMap);
          markTex(std.alphaMap);
          m.needsUpdate = true;
        }
      }
    });

    this.badgeTexCache.forEach((tex) => {
      tex.needsUpdate = true;
    });
    if (this.world.heartTreeNight) {
      this.world.heartTreeNight.projTex.needsUpdate = true;
      this.world.heartTreeNight.lastProjDraw = -1;
    }
    this.applyTimeOfDayLerp(this.todBlend);
    this.renderer.shadowMap.needsUpdate = true;
    this.clock.getDelta();
    this.renderer.render(this.scene, this.camera);
  }

  /** 仅释放临时物体的几何体，不误伤 world.ts / pieces.ts 中跨实例共享的材质与贴图 */
  private disposeGeometryOnly(root: THREE.Object3D): void {
    root.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (mesh.geometry) mesh.geometry.dispose();
    });
  }

  private disposeObject3D(root: THREE.Object3D): void {
    root.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (mesh.geometry) mesh.geometry.dispose();
      if (mesh.material) {
        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        for (const m of mats) {
          const std = m as THREE.MeshStandardMaterial;
          if (std.map) std.map.dispose();
          if (std.normalMap) std.normalMap.dispose();
          if (std.roughnessMap) std.roughnessMap.dispose();
          if (std.metalnessMap) std.metalnessMap.dispose();
          if (std.emissiveMap) std.emissiveMap.dispose();
          if (std.alphaMap) std.alphaMap.dispose();
          m.dispose();
        }
      }
    });
  }

  public dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    cancelAnimationFrame(this.frameId);
    window.clearTimeout(this.frameId);
    cancelAnimationFrame(this.splashRaf);
    if (this.msgTimer !== null) window.clearTimeout(this.msgTimer);
    if (this.splashTimer !== null) window.clearTimeout(this.splashTimer);
    if (this.giftQuestTimer !== null) window.clearTimeout(this.giftQuestTimer);
    if (this.killBannerTimer !== null) window.clearTimeout(this.killBannerTimer);

    window.removeEventListener('resize', this.boundResize);
    document.removeEventListener('visibilitychange', this.boundVisibilityChange);
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

    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
      } catch {
        // ignore
      }
    }

    this.clearHL();
    this.world.heartTreeNight?.projTex.dispose();
    this.badgeTexCache.forEach((tex) => tex.dispose());
    this.badgeTexCache.clear();
    this.world.onDispose?.();
    this.controls.dispose();
    this.envRT.dispose();

    this.disposeObject3D(this.scene);

    this.renderer.dispose();
    if (this.renderer.domElement.parentNode === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
    if (this.poemLayer.parentNode === this.container) {
      this.container.removeChild(this.poemLayer);
    }
  }
}
