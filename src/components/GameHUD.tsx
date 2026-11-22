import React, { useEffect, useRef, useState } from 'react';
import { beep } from '../game/audio';
import {
  CHAR_TALENTS,
  CameraMode,
  GameHudSnapshot,
  GraphicsQuality,
  HUD_PIPS,
  ITEM_DEFS,
  ITEM_ORDER,
  ItemType,
  TimeOfDay,
} from '../game/constants';
import { CharacterAvatar } from './CharacterAvatar';
import { ItemIcon } from './ItemIcon';

const QUICK_EMOTES = [
  { icon: '😄', text: '开心!' },
  { icon: '😜', text: '略略略' },
  { icon: '🔥', text: '冲鸭!' },
  { icon: '💦', text: '慌了慌了' },
  { icon: '👏', text: '666!' },
  { icon: '💤', text: '快点呀~' },
];

interface GameHUDProps {
  snap: GameHudSnapshot;
  showSetup: boolean;
  muted: boolean;
  quality: GraphicsQuality;
  onToggleMute: () => void;
  onChangeQuality: (q: GraphicsQuality) => void;
  onSetGmDie: (val: number | null) => void;
  onGmGrantItem: (item: ItemType) => void;
  onGmClearItems: () => void;
  onSetGmTimeOfDay: (tod: TimeOfDay) => void;
  onToggleGmAutoPlay: () => void;
  onSetGameSpeed: (speed: number, gmMode?: boolean) => void;
  onActionPod: () => void;
  onUseItem: (item: ItemType) => void;
  onPickItemTarget: (pid: number, idx: number) => void;
  onCancelItemTarget: () => void;
  onPickShopItem: (item: ItemType) => void;
  onSetCamMode: (mode: CameraMode) => void;
  onResetView: () => void;
  onReturnSetup: () => void;
  onTogglePause: () => void;
  onHumanEmote?: (senderPid: number) => void;
}

export const GameHUD: React.FC<GameHUDProps> = ({
  snap,
  showSetup,
  muted,
  quality,
  onToggleMute,
  onChangeQuality,
  onSetGmDie,
  onGmGrantItem,
  onGmClearItems,
  onSetGmTimeOfDay,
  onToggleGmAutoPlay,
  onSetGameSpeed,
  onActionPod,
  onUseItem,
  onPickItemTarget,
  onCancelItemTarget,
  onPickShopItem,
  onSetCamMode,
  onResetView,
  onReturnSetup,
  onTogglePause,
  onHumanEmote,
}) => {
  const [rulesOpen, setRulesOpen] = useState(false);
  const [camMenuOpen, setCamMenuOpen] = useState(false);
  const [gmOpen, setGmOpen] = useState(false);
  const [emoteOpen, setEmoteOpen] = useState(false);
  const [partyExpanded, setPartyExpanded] = useState(true);
  const [questExpanded, setQuestExpanded] = useState(false);
  const [bottomDockExpanded, setBottomDockExpanded] = useState(true);
  const [settingsMenuOpen, setSettingsMenuOpen] = useState(false);
  const [activeEmotes, setActiveEmotes] = useState<Record<number, string>>({});
  const [inspectedPid, setInspectedPid] = useState<number | null>(null);
  const [giftOpenedKey, setGiftOpenedKey] = useState<number | null>(null);
  const [giftDismissedKey, setGiftDismissedKey] = useState<number | null>(null);
  const [giftCountdown, setGiftCountdown] = useState<number>(3);
  const lastHumanPidRef = useRef(0);
  const emoteTimers = useRef<Record<number, number>>({});
  const secretTapCount = useRef(0);
  const secretTapTimer = useRef<number | null>(null);

  // 本地玩家任务奖励：先出现礼盒，3 秒内点击或自动打开后，再展示表情包与获得提示
  const giftEventKey = snap.giftQuestEvent?.key ?? null;
  const giftIsHuman = snap.giftQuestEvent?.isLocalHuman ?? false;
  useEffect(() => {
    if (giftEventKey === null || !giftIsHuman) return;
    setGiftCountdown(3);
    const cdInterval = window.setInterval(() => {
      setGiftCountdown((prev) => (prev > 1 ? prev - 1 : 1));
    }, 1000);
    const autoOpenTimer = window.setTimeout(() => {
      setGiftOpenedKey((cur) => (cur === giftEventKey ? cur : giftEventKey));
    }, 3000);
    return () => {
      window.clearInterval(cdInterval);
      window.clearTimeout(autoOpenTimer);
    };
  }, [giftEventKey, giftIsHuman]);

  useEffect(() => {
    if (giftEventKey === null || !giftIsHuman || giftOpenedKey !== giftEventKey) return;
    const dismissTimer = window.setTimeout(() => {
      setGiftDismissedKey(giftEventKey);
    }, 5400);
    return () => window.clearTimeout(dismissTimer);
  }, [giftEventKey, giftIsHuman, giftOpenedKey]);

  // 启动时预加载全部 7 张轻量 WebP 表情包到内存，触发时零等待秒开
  useEffect(() => {
    const urls = [
      './assets/yier_gift_box_closed.webp',
      './assets/bubu_gift_box_closed.webp',
      './assets/yier_gift_box.webp',
      './assets/bubu_gift_box.webp',
      './assets/item_sixDie.webp',
      './assets/item_twinDice.webp',
      './assets/item_refuel.webp',
      './assets/item_shield.webp',
      './assets/item_missile.webp',
    ];
    urls.forEach((url) => {
      const img = new Image();
      img.decoding = 'async';
      img.src = url;
      if (typeof img.decode === 'function') {
        img.decode().catch(() => {});
      }
    });
  }, []);

  const curTurnPlayerType = snap.players[snap.turn]?.type;
  useEffect(() => {
    if (showSetup) {
      setInspectedPid(null);
      return;
    }
    if (curTurnPlayerType === 'human') {
      lastHumanPidRef.current = snap.turn;
      setInspectedPid(null);
    }
  }, [showSetup, snap.turn, curTurnPlayerType]);

  const showEmoteBubble = (playerIdx: number, content: string) => {
    if (emoteTimers.current[playerIdx]) {
      window.clearTimeout(emoteTimers.current[playerIdx]);
    }
    setActiveEmotes((prev) => ({ ...prev, [playerIdx]: content }));
    emoteTimers.current[playerIdx] = window.setTimeout(() => {
      setActiveEmotes((prev) => {
        const next = { ...prev };
        delete next[playerIdx];
        return next;
      });
    }, 5600);
  };

  useEffect(() => {
    if (!snap.latestEmote || showSetup) return;
    showEmoteBubble(snap.latestEmote.pid, snap.latestEmote.text);
  }, [snap.latestEmote?.key, showSetup]);

  const handleSendEmote = (icon: string, text: string) => {
    const curPlayer = snap.players[snap.turn];
    const senderIdx =
      curPlayer && curPlayer.type === 'human'
        ? snap.turn
        : Math.max(
            0,
            snap.players.findIndex((p) => p.type === 'human'),
          );
    showEmoteBubble(senderIdx, `${icon} ${text}`);
    beep(680, 0.06, 'sine', 0.1);
    setEmoteOpen(false);
    onHumanEmote?.(senderIdx);
  };

  useEffect(() => {
    return () => {
      Object.values(emoteTimers.current).forEach((t) => window.clearTimeout(t));
    };
  }, []);

  const handleSecretTap = () => {
    secretTapCount.current += 1;
    if (secretTapTimer.current !== null) {
      window.clearTimeout(secretTapTimer.current);
    }
    if (secretTapCount.current >= 5) {
      secretTapCount.current = 0;
      setGmOpen((v) => !v);
      return;
    }
    secretTapTimer.current = window.setTimeout(() => {
      secretTapCount.current = 0;
    }, 1400);
  };

  useEffect(() => {
    if (!rulesOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setRulesOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [rulesOpen]);

  const cur = snap.players[snap.turn] ?? snap.players[0];
  if (!cur) return null;

  const isOpponent = cur.type === 'ai';
  const humanTurn = !isOpponent && snap.phase !== 'over' && !showSetup;
  const curHumanNum = snap.players
    .slice(0, snap.turn + 1)
    .filter((p) => p.type === 'human').length;
  const curOppNum = snap.players
    .slice(0, snap.turn + 1)
    .filter((p) => p.type === 'ai').length;

  let actionText = '准备中…';
  if (snap.phase === 'over') actionText = '🏆 对局结束';
  else if (snap.phase === 'shopChoice') {
    actionText = `🏪 请选择 1 张道具卡 (${snap.shopSecondsLeft ?? 15}s)`;
  } else if (snap.phase === 'rolling') {
    actionText =
      snap.die !== null && !snap.hudDieRolling ? `掷出 ${snap.die} 点` : '掷骰中…';
  } else if (snap.phase === 'moving') actionText = '移动中…';
  else if (isOpponent) actionText = '对手思考中…';
  else if (snap.pendingItemTarget === 'shield') actionText = '🛡️ 请点选己方棋子开启护盾';
  else if (snap.pendingItemTarget === 'missile') actionText = '🚀 请点选敌方棋子发射导弹';
  else if (snap.phase === 'awaitRoll') actionText = '请掷骰子（可使用道具）';
  else if (snap.phase === 'awaitMove') {
    actionText =
      snap.movableCount === 1
        ? `掷出 ${snap.die} 点 · 点击小人移动`
        : `掷出 ${snap.die} 点 · 请点选棋子`;
  }
  const topPrompt = snap.message ?? actionText;

  const timeSuffix = snap.secondsLeft !== null ? ` (${snap.secondsLeft}s)` : '';

  let rollDisabled = true;
  let rollLabel = '🏆 对局已结束';
  let rollVariant: 'green' | 'pick' | 'disabled' = 'disabled';

  if (snap.phase === 'awaitRoll' && !isOpponent) {
    rollDisabled = false;
    rollLabel = `🎲 掷骰子${timeSuffix}`;
    rollVariant = 'green';
  } else if (snap.phase === 'awaitMove' && !isOpponent) {
    if (snap.movableCount === 1) {
      rollDisabled = false;
      rollLabel = `⚡ 移动棋子${timeSuffix}`;
      rollVariant = 'pick';
    } else {
      rollDisabled = true;
      rollLabel = `👆 请选棋子${timeSuffix}`;
      rollVariant = 'pick';
    }
  } else if (snap.phase === 'shopChoice') {
    rollLabel = `🏪 选购中 (${snap.shopSecondsLeft ?? 15}s)`;
  } else if (snap.phase === 'rolling') {
    rollLabel = '🎲 投掷中…';
  } else if (snap.phase === 'moving') {
    rollLabel = '✈️ 移动中…';
  } else if (isOpponent) {
    rollLabel = '⏳ 对手行动中…';
  }

  const activePips = HUD_PIPS[snap.hudDieFace] ?? [];
  const redFace = snap.hudDieFace === 1 || snap.hudDieFace === 4;
  const secondDieFace = snap.twinDice ? snap.twinDice[1] : null;
  const secondPips = secondDieFace ? (HUD_PIPS[secondDieFace] ?? []) : [];
  const secondRedFace = secondDieFace === 1 || secondDieFace === 4;

  // 回合切换时自动切到当前行动玩家；点击任意玩家卡片直接切过去看
  useEffect(() => {
    setInspectedPid(null);
  }, [snap.turn]);

  const effectiveQuestPid =
    inspectedPid !== null && snap.players[inspectedPid] ? inspectedPid : snap.turn;
  const questPlayer = snap.players[effectiveQuestPid] ?? cur;
  // 底部道具栏展示当前回合人类玩家的背包（AI 回合时隐藏主动使用条）
  const deckPlayer = cur.type === 'human' ? cur : null;
  const heldItemEntries = deckPlayer
    ? ITEM_ORDER.filter((t) => (deckPlayer.items?.[t] ?? 0) > 0)
    : [];
  const shopPlayer =
    snap.shopPid !== null ? (snap.players[snap.shopPid] ?? cur) : cur;

  return (
    <>
      {/* Screen-edge glow on human turn */}
      <div
        className="pointer-events-none fixed inset-0 z-[9] transition-opacity duration-300"
        style={{
          opacity:
            humanTurn && (snap.phase === 'awaitRoll' || snap.phase === 'awaitMove') ? 0.9 : 0,
          boxShadow: `inset 0 0 64px 8px ${cur.uiColor}52`,
        }}
      />

      {/* 单回合连踩击杀播报（Double Kill / Triple Kill ...） */}
      {snap.killBanner && !showSetup && (
        <div
          key={snap.killBanner.key}
          className="pointer-events-none fixed left-1/2 top-24 md:top-28 z-[24] -translate-x-1/2 max-w-[calc(100vw-24px)]"
        >
          <div
            className="anim-card-pop flex items-center gap-2.5 rounded-2xl border-2 border-amber-300/90 bg-gradient-to-r from-slate-900/92 via-rose-950/92 to-slate-900/92 px-4 py-2 text-white shadow-[0_14px_34px_rgba(0,0,0,0.35)] backdrop-blur-md"
            style={{
              boxShadow: `0 12px 32px rgba(0,0,0,0.36), 0 0 0 3px ${snap.killBanner.playerColor}55`,
            }}
          >
            <CharacterAvatar charKey={snap.killBanner.playerCharKey} size={34} />
            <div className="leading-tight">
              <div className="bg-gradient-to-r from-amber-200 via-yellow-300 to-rose-300 bg-clip-text text-base md:text-xl font-black tracking-wider text-transparent drop-shadow-sm">
                {snap.killBanner.title}
              </div>
              <div className="text-[11px] md:text-xs font-bold text-amber-100/95">
                {snap.killBanner.subtitle}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 一二的馈赠 / 布布不烦恼：本地玩家先弹出可点击礼盒（3秒自动打开），再展示居中表情包+获得提示；AI仅显示弱化顶部小提示 */}
      {snap.giftQuestEvent && !showSetup && giftDismissedKey !== snap.giftQuestEvent.key && (
        snap.giftQuestEvent.isLocalHuman ? (
          giftOpenedKey !== snap.giftQuestEvent.key ? (
            <div
              key={`gift-box-${snap.giftQuestEvent.key}`}
              className="pointer-events-none fixed inset-0 z-[22] flex items-center justify-center p-4"
            >
              <div className="hud-gift-toast-inner flex max-w-[calc(100vw-24px)] flex-col items-center">
                <div
                  className="mb-2 flex flex-col items-center justify-center gap-0.5 max-w-[calc(100vw-28px)] rounded-3xl bg-white/75 px-5 py-2 text-center text-sm sm:text-base font-extrabold text-slate-900 shadow-[0_6px_18px_rgba(0,0,0,0.14)] backdrop-blur-sm anim-card-pop"
                  style={{
                    border: `1.5px solid ${snap.giftQuestEvent.playerColor}99`,
                    textShadow: '0 1px 2px rgba(255,255,255,0.85)',
                  }}
                >
                  <div className="flex flex-wrap items-center justify-center gap-x-1.5">
                    <CharacterAvatar charKey={snap.giftQuestEvent.playerCharKey} size={22} />
                    <span>
                      {snap.giftQuestEvent.playerName} 完成
                      {snap.giftQuestEvent.questType === 'bubu' ? '「布布不烦恼」' : '「一二宝的馈赠」'}
                    </span>
                  </div>
                  <div className="text-xs sm:text-sm font-bold text-amber-700">
                    点击礼盒开启奖励（{giftCountdown}秒后自动打开）
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setGiftOpenedKey(snap.giftQuestEvent!.key)}
                  aria-label="点击礼盒开启奖励"
                  className="pointer-events-auto relative flex h-40 w-40 md:h-48 md:w-48 items-center justify-center bg-transparent border-0 p-0 cursor-pointer transition-transform duration-200 hover:scale-105 active:scale-95 focus:outline-none"
                >
                  <div
                    className="anim-gift-rays absolute inset-1 rounded-full opacity-70 blur-[2px]"
                    style={{
                      background:
                        snap.giftQuestEvent.questType === 'bubu'
                          ? 'repeating-conic-gradient(from 0deg, rgba(253,224,71,0.55) 0deg 15deg, rgba(147,197,253,0.12) 15deg 30deg)'
                          : 'repeating-conic-gradient(from 0deg, rgba(253,224,71,0.58) 0deg 15deg, rgba(244,114,182,0.14) 15deg 30deg)',
                      maskImage: 'radial-gradient(circle, black 35%, transparent 72%)',
                      WebkitMaskImage: 'radial-gradient(circle, black 35%, transparent 72%)',
                    }}
                  />
                  <div
                    className="absolute inset-4 rounded-full opacity-75 blur-md animate-pulse"
                    style={{
                      background:
                        snap.giftQuestEvent.questType === 'bubu'
                          ? 'radial-gradient(circle, #fef08a 0%, #93c5fd 60%, transparent 100%)'
                          : 'radial-gradient(circle, #fef08a 0%, #f9a8d4 60%, transparent 100%)',
                    }}
                  />
                  <span className="absolute left-3 top-3 text-base text-amber-400 animate-ping" style={{ animationDuration: '1.8s' }}>✦</span>
                  <span className="absolute right-3 top-4 text-sm text-amber-500 animate-pulse">✦</span>
                  <span className="absolute left-4 bottom-4 text-sm text-yellow-400 animate-pulse">✦</span>
                  <img
                    src={`./assets/${snap.giftQuestEvent.questType === 'bubu' ? 'bubu_gift_box_closed.webp' : 'yier_gift_box_closed.webp'}`}
                    alt={snap.giftQuestEvent.questType === 'bubu' ? '布布不烦恼礼盒' : '一二的馈赠礼盒'}
                    loading="eager"
                    decoding="sync"
                    className="anim-gift-wiggle relative h-36 w-36 md:h-44 md:w-44 shrink-0 object-contain drop-shadow-[0_12px_24px_rgba(0,0,0,0.28)]"
                  />
                  <div className="pointer-events-none absolute bottom-2 right-2 flex items-center justify-center">
                    <span className="absolute h-8 w-8 rounded-full border-2 border-amber-400/85 animate-ping" />
                    <span className="anim-gift-tap relative text-2xl drop-shadow-[0_2px_6px_rgba(0,0,0,0.32)]">👆</span>
                  </div>
                </button>
              </div>
            </div>
          ) : (
          <div
            key={`gift-open-${snap.giftQuestEvent.key}`}
            className="pointer-events-none fixed inset-0 z-[22] flex items-center justify-center p-4"
          >
            <div className="hud-gift-toast-inner flex max-w-[calc(100vw-24px)] flex-col items-center">
              <div
                className="anim-gift-float mb-1.5 flex flex-col items-center justify-center gap-0.5 max-w-[calc(100vw-28px)] rounded-3xl bg-white/68 px-5 py-2 text-center text-sm sm:text-base md:text-lg font-extrabold text-slate-900 shadow-[0_6px_18px_rgba(0,0,0,0.14)] backdrop-blur-sm"
                style={{
                  border: `1.5px solid ${snap.giftQuestEvent.playerColor}99`,
                  textShadow: '0 1px 2px rgba(255,255,255,0.85)',
                }}
              >
                <div className="flex flex-wrap items-center justify-center gap-x-1.5">
                  <span>恭喜</span>
                  <CharacterAvatar charKey={snap.giftQuestEvent.playerCharKey} size={24} />
                  <span>
                    {snap.giftQuestEvent.playerName} 完成
                    {snap.giftQuestEvent.questType === 'bubu' ? '「布布不烦恼」' : '「一二宝的馈赠」'}
                  </span>
                </div>
                <div className="flex flex-wrap items-center justify-center gap-x-1.5">
                  <span>获得</span>
                  <span
                    className="inline-flex items-center gap-1"
                    style={{ color: ITEM_DEFS[snap.giftQuestEvent.item].accentColor }}
                  >
                    <ItemIcon item={snap.giftQuestEvent.item} size={22} />
                    <span>{ITEM_DEFS[snap.giftQuestEvent.item].name}</span>
                  </span>
                </div>
              </div>
              <img
                src={`./assets/${snap.giftQuestEvent.questType === 'bubu' ? 'bubu_gift_box.webp' : 'yier_gift_box.webp'}?k=${snap.giftQuestEvent.key}`}
                alt={snap.giftQuestEvent.questType === 'bubu' ? '布布不烦恼' : '一二的馈赠'}
                loading="eager"
                decoding="sync"
                className="anim-gift-sticker h-36 w-36 md:h-44 md:w-44 shrink-0 object-contain drop-shadow-[0_12px_24px_rgba(0,0,0,0.28)]"
              />
            </div>
          </div>
          )
        ) : (
          <div
            key={snap.giftQuestEvent.key}
            className="pointer-events-none fixed left-1/2 top-14 md:top-16 z-[18] -translate-x-1/2 max-w-[calc(100vw-32px)]"
          >
            <div className="anim-msg-pop flex flex-wrap items-center justify-center gap-1.5 rounded-full border border-white/60 bg-white/68 px-3 py-1 text-[11px] md:text-xs font-bold text-slate-600 shadow-xs backdrop-blur-xs">
              <CharacterAvatar charKey={snap.giftQuestEvent.playerCharKey} size={18} />
              <span>
                {snap.giftQuestEvent.playerName} 完成
                {snap.giftQuestEvent.questType === 'bubu' ? '「布布不烦恼」' : '「一二宝的馈赠」'}，获得
              </span>
              <span
                className="inline-flex items-center gap-1 font-extrabold"
                style={{ color: ITEM_DEFS[snap.giftQuestEvent.item].accentColor }}
              >
                <ItemIcon item={snap.giftQuestEvent.item} size={15} />
                <span>{ITEM_DEFS[snap.giftQuestEvent.item].name}</span>
              </span>
            </div>
          </div>
        )
      )}

      {/* Turn / Item splash：本地玩家居中展示表情包+提示；非本地AI使用奶油派炸弹时同规格大提示但不显示表情包，其余仅顶部弱化提示 */}
      {snap.splashIsHuman || snap.splashItem === 'missile' ? (
        <div
          className={`pointer-events-none fixed inset-0 z-[20] flex items-center justify-center p-4 transition-opacity duration-200 ${
            snap.splashVisible ? 'opacity-100' : 'opacity-0'
          }`}
        >
          <div
            className={`hud-item-splash-inner flex max-w-[calc(100vw-24px)] flex-col items-center gap-1.5 transition-transform duration-200 ${
              snap.splashVisible ? 'scale-100' : 'scale-90'
            }`}
          >
            {snap.splashVisible && snap.splashItem && snap.splashIsHuman && (
              <img
                key={`item-sticker-${snap.splashKey}`}
                src={`./assets/item_${snap.splashItem}.webp`}
                alt={ITEM_DEFS[snap.splashItem].name}
                loading="eager"
                decoding="sync"
                className="h-28 w-28 md:h-32 md:w-32 shrink-0 object-contain drop-shadow-[0_10px_20px_rgba(0,0,0,0.24)]"
              />
            )}
            <div
              className="flex flex-wrap items-center justify-center gap-2 rounded-full bg-white/88 px-5 py-2 text-sm sm:text-base md:text-lg font-extrabold text-slate-800 backdrop-blur-sm"
              style={{
                border: `2.5px solid ${snap.splashColor}`,
                boxShadow: `0 12px 32px rgba(0,0,0,0.2), 0 0 0 4px ${snap.splashColor}28`,
              }}
            >
              <CharacterAvatar charKey={snap.splashCharKey} size={28} />
              {snap.splashItem && snap.splashItem !== 'shield' && snap.splashActorName ? (
                <>
                  <span>{snap.splashActorName} 使用</span>
                  <span
                    className="inline-flex items-center gap-1"
                    style={{ color: ITEM_DEFS[snap.splashItem].accentColor }}
                  >
                    <ItemIcon item={snap.splashItem} size={22} />
                    <span>「{ITEM_DEFS[snap.splashItem].name}」</span>
                  </span>
                  {snap.splashDetail && <span>· {snap.splashDetail}</span>}
                  {snap.splashTargetCharKey && snap.splashTargetName && (
                    <span className="inline-flex items-center gap-1.5">
                      <CharacterAvatar charKey={snap.splashTargetCharKey} size={26} />
                      <span>{snap.splashTargetName}！</span>
                    </span>
                  )}
                </>
              ) : snap.splashItem === 'shield' ? (
                <>
                  <ItemIcon item="shield" size={22} />
                  <span>{snap.splashText}</span>
                </>
              ) : (
                <span>{snap.splashText}</span>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div
          className={`pointer-events-none fixed left-1/2 top-14 md:top-16 z-[18] -translate-x-1/2 max-w-[calc(100vw-32px)] transition-opacity duration-200 ${
            snap.splashVisible ? 'opacity-90' : 'opacity-0'
          }`}
        >
          <div className="flex flex-wrap items-center justify-center gap-1.5 rounded-full border border-white/60 bg-white/70 px-3.5 py-1 text-[11px] md:text-xs font-bold text-slate-600 shadow-xs backdrop-blur-xs">
            <CharacterAvatar charKey={snap.splashCharKey} size={18} />
            {snap.splashItem && snap.splashItem !== 'shield' && snap.splashActorName ? (
              <>
                <span>{snap.splashActorName} 使用</span>
                <span
                  className="inline-flex items-center gap-1"
                  style={{ color: ITEM_DEFS[snap.splashItem].accentColor }}
                >
                  <ItemIcon item={snap.splashItem} size={15} />
                  <span>「{ITEM_DEFS[snap.splashItem].name}」</span>
                </span>
                {snap.splashDetail && <span>· {snap.splashDetail}</span>}
                {snap.splashTargetCharKey && snap.splashTargetName && (
                  <span className="inline-flex items-center gap-1">
                    <CharacterAvatar charKey={snap.splashTargetCharKey} size={18} />
                    <span>{snap.splashTargetName}！</span>
                  </span>
                )}
              </>
            ) : snap.splashItem === 'shield' ? (
              <>
                <ItemIcon item="shield" size={15} />
                <span>{snap.splashText}</span>
              </>
            ) : (
              <span>{snap.splashText}</span>
            )}
          </div>
        </div>
      )}

      <div className="pointer-events-none fixed inset-0 z-10">
        {/* Party / Player list + minimal transparent Quest text below */}
        <div
          className="hud-left-corner absolute left-2.5 top-2.5 md:left-3.5 md:top-3.5 flex flex-col items-start gap-1.5"
          style={{ paddingTop: 'env(safe-area-inset-top)', paddingLeft: 'env(safe-area-inset-left)' }}
        >
          <div className="flex items-start gap-1">
            {partyExpanded ? (
              <>
                <div className="flex w-[124px] md:w-[152px] flex-col gap-1">
            {snap.players.map((pl, i) => {
              const humanNum = snap.players
                .slice(0, i + 1)
                .filter((p) => p.type === 'human').length;
              const oppNum = snap.players
                .slice(0, i + 1)
                .filter((p) => p.type === 'ai').length;
              const bubble = activeEmotes[i];
              const heldItems = ITEM_ORDER.filter((t) => (pl.items?.[t] ?? 0) > 0);
              const isQuestSelected = effectiveQuestPid === i;
              return (
                <div key={i} className="relative">
                  <button
                    type="button"
                    onClick={() => { setInspectedPid(i); setQuestExpanded(true); }}
                    title={`点击查看 ${pl.name} 的任务与道具详情`}
                    className={`pointer-events-auto flex w-full items-start gap-1.5 rounded-[11px] px-2 py-1 md:px-2.5 md:py-1.5 text-left transition-all duration-200 cursor-pointer hover:bg-white ${
                      pl.active
                        ? 'bg-white opacity-100 translate-x-1'
                        : isQuestSelected
                          ? 'bg-white/95 opacity-100'
                          : 'bg-white/85 opacity-90'
                    }`}
                    style={{
                      border: `2px solid ${
                        pl.active
                          ? pl.uiColor
                          : isQuestSelected
                            ? `${pl.uiColor}99`
                            : 'rgba(255,255,255,0.8)'
                      }`,
                      boxShadow: pl.active
                        ? `0 8px 22px rgba(0,0,0,0.16), 0 0 0 3px ${pl.uiColor}2e`
                        : isQuestSelected
                          ? `0 6px 16px rgba(60,80,110,0.16), 0 0 0 2px ${pl.uiColor}24`
                          : '0 4px 12px rgba(60,80,110,0.14)',
                    }}
                  >
                    <div className="relative mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center">
                      <CharacterAvatar charKey={pl.charKey} size={24} />
                      <span
                        className="absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full border border-white shadow-sm"
                        style={{ backgroundColor: pl.colorHex }}
                      />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-1">
                        <b className="truncate text-[10px] md:text-[11px] text-slate-800">
                          {pl.name}
                        </b>
                        {pl.finishRank !== null ? (
                          <span className="shrink-0 rounded bg-amber-100 px-1.5 py-0.5 text-[8px] md:text-[9px] font-extrabold text-amber-800 whitespace-nowrap">
                            {pl.finishRank === 1
                              ? '🥇 第1名'
                              : pl.finishRank === 2
                                ? '🥈 第2名'
                                : pl.finishRank === 3
                                  ? '🥉 第3名'
                                  : `第${pl.finishRank}名`}
                          </span>
                        ) : (
                          <span
                            className="shrink-0 rounded px-1.5 py-0.5 text-[8px] md:text-[9px] font-bold whitespace-nowrap"
                            style={{
                              backgroundColor: pl.active ? pl.uiColor : '#eef1f5',
                              color: pl.active ? '#ffffff' : '#64748b',
                            }}
                          >
                            {pl.active
                              ? pl.type === 'ai'
                                ? '思考中'
                                : '行动中'
                              : pl.type === 'ai'
                                ? `对手${oppNum}`
                                : `玩家${humanNum}`}
                          </span>
                        )}
                      </div>
                      <div className="mt-0.5 flex items-center gap-0.5">
                        {[0, 1, 2, 3].map((k) => (
                          <span
                            key={k}
                            className={`h-1.5 flex-1 rounded-full transition-colors ${
                              k < pl.doneCount ? 'bg-[#3aa66b]' : 'bg-slate-200'
                            }`}
                          />
                        ))}
                        <span className="ml-0.5 text-[9px] font-semibold text-slate-400 tabular-nums">
                          {pl.doneCount}/4
                        </span>
                      </div>
                      <div
                        className="mt-0.5 flex items-center gap-1 text-[9px] font-semibold text-slate-500 tabular-nums leading-tight"
                        title={`踩人 ${pl.kda?.stomps ?? 0} / 被踩 ${pl.kda?.stomped ?? 0} / 击破护盾 ${pl.kda?.shieldBreaks ?? 0}`}
                      >
                        <span className="text-slate-400">K/D/A</span>
                        <span>
                          {pl.kda?.stomps ?? 0}/{pl.kda?.stomped ?? 0}/{pl.kda?.shieldBreaks ?? 0}
                        </span>
                      </div>

                      {/* 持有道具（仅图标与数量） */}
                      {heldItems.length > 0 && (
                        <div className="mt-1 flex flex-wrap items-center gap-0.5">
                          {heldItems.map((itemKey) => {
                            const def = ITEM_DEFS[itemKey];
                            const cnt = pl.items[itemKey];
                            return (
                              <span
                                key={itemKey}
                                title={`${def.name} ×${cnt}（${def.shortEffect}）`}
                                className="inline-flex items-center gap-0.5 rounded border px-1 py-0.5 text-[9px] font-bold leading-none tabular-nums"
                                style={{
                                  borderColor: `${def.accentColor}45`,
                                  backgroundColor: `${def.accentColor}14`,
                                  color: def.accentColor,
                                }}
                              >
                                <ItemIcon item={itemKey} size={11} />
                                <span>×{cnt}</span>
                              </span>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </button>

                  {bubble && (
                    <div className="anim-msg-pop pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-2 z-30 whitespace-nowrap rounded-full border border-amber-200 bg-white/98 px-2.5 py-1 text-[11px] font-extrabold text-slate-800 shadow-md">
                      {bubble}
                    </div>
                  )}
                </div>
              );
            })}
                </div>
                <button
                  type="button"
                  onClick={() => setPartyExpanded(false)}
                  title="向左收起队伍栏"
                  aria-label="向左收起队伍栏"
                  className="pointer-events-auto mt-1.5 -ml-0.5 flex h-5 w-4 shrink-0 items-center justify-center rounded-full bg-white/35 text-[9px] font-bold text-slate-500/80 backdrop-blur-[2px] transition-all hover:bg-white/75 hover:text-slate-800 cursor-pointer"
                >
                  ◂
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => setPartyExpanded(true)}
                title="展开队伍栏"
                aria-label="展开队伍栏"
                className="pointer-events-auto flex items-center gap-0.5 rounded-full bg-white/55 px-2 py-1 text-[10px] font-bold text-slate-600 backdrop-blur-xs transition-colors hover:bg-white/85 hover:text-slate-900 cursor-pointer"
              >
                <span>队伍</span>
                <span className="text-[9px]">▸</span>
              </button>
            )}
          </div>

          {/* 队伍栏下方：极简透明纯文字任务栏（支持向左收起，文字内容保持不变） */}
          <div className="flex items-start gap-1">
            {questExpanded ? (
              <>
                <div
                  className="pointer-events-auto w-[166px] md:w-[194px] rounded-xl border border-white/45 bg-white/48 px-2 py-1.5 backdrop-blur-[4px]"
                  style={{
                    textShadow: '0 1px 2px rgba(255,255,255,0.8)',
                  }}
                >
                  <button
                    type="button"
                    onClick={() => setQuestExpanded(false)}
                    title="向左收起任务栏"
                    aria-label="向左收起任务栏"
                    className="flex w-full items-center justify-between gap-1 py-0.5 text-left cursor-pointer group"
                  >
                    <span
                      className="truncate max-w-[92px] text-[11px] font-extrabold"
                      style={{ color: questPlayer.uiColor }}
                    >
                      {questPlayer.name}
                    </span>
                    <span className="flex items-center gap-1 text-[10px] font-bold text-slate-700 whitespace-nowrap">
                      <span>任务·道具</span>
                      <span className="text-[9px] text-slate-400 transition-colors group-hover:text-slate-700">◂</span>
                    </span>
                  </button>

                  <div className="mt-1 space-y-1.5 text-slate-800">
                    {(() => {
                      const td = questPlayer ? CHAR_TALENTS[questPlayer.charKey] : undefined;
                      if (!td) return null;
                      const rem = questPlayer.talentCharges ?? 0;
                      return (
                        <div
                          className="rounded-lg border px-1.5 py-1 text-[10px]"
                          style={{
                            backgroundColor: td.accentBg,
                            borderColor: td.accentBorder,
                          }}
                          title={td.desc}
                        >
                          <div className="flex items-center justify-between font-extrabold" style={{ color: td.accentText }}>
                            <span>✨ {td.name}</span>
                            {td.maxCharges > 0 ? (
                              <span className="tabular-nums">剩余 {rem}/{td.maxCharges}</span>
                            ) : (
                              <span>已生效</span>
                            )}
                          </div>
                          <div className="mt-0.5 text-[9.5px] leading-snug text-slate-600">
                            {td.shortTag}
                          </div>
                        </div>
                      );
                    })()}
                    <div>
                      <div className="flex items-center justify-between text-[11px] font-extrabold">
                        <span>🎲 一二的馈赠</span>
                        <span className="text-[10px] font-bold text-amber-800">随机卡×1</span>
                      </div>
                      <div className="mt-0.5 space-y-0.5 text-[10px] font-bold tabular-nums">
                        <div className="flex items-center justify-between">
                          <span className="text-slate-700">骰子摇出1点</span>
                          <span
                            className={
                              (questPlayer.quest?.roll1 ?? 0) >= 1
                                ? 'font-extrabold text-emerald-700'
                                : 'font-extrabold text-slate-700'
                            }
                          >
                            {questPlayer.quest?.roll1 ?? 0}/1
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-slate-700">骰子摇出2点</span>
                          <span
                            className={
                              (questPlayer.quest?.roll2 ?? 0) >= 1
                                ? 'font-extrabold text-emerald-700'
                                : 'font-extrabold text-slate-700'
                            }
                          >
                            {questPlayer.quest?.roll2 ?? 0}/1
                          </span>
                        </div>
                      </div>
                      <div className="mt-0.5 text-[10px] leading-tight font-semibold text-slate-700">
                        同时满足，自动消耗1次兑换奖励
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between text-[11px] font-extrabold">
                        <span>🫧 布布不烦恼</span>
                        <span className="text-[10px] font-bold text-sky-800">泡泡/奶茶×1</span>
                      </div>
                      <div className="mt-0.5 flex items-center justify-between text-[10px] font-bold">
                        <span className="text-slate-700">被踩累计2次，扣2次兑换</span>
                        <span className="ml-1 shrink-0 font-extrabold text-sky-800 tabular-nums">
                          {questPlayer.quest?.stomped ?? 0}/2
                        </span>
                      </div>
                    </div>

                    <div className="pt-1 border-t border-slate-500/15">
                      {ITEM_ORDER.some((it) => (questPlayer.items?.[it] ?? 0) > 0) ? (
                        <div className="flex flex-wrap gap-1">
                          {ITEM_ORDER.filter((it) => (questPlayer.items?.[it] ?? 0) > 0).map((itemKey) => {
                            const def = ITEM_DEFS[itemKey];
                            const cnt = questPlayer.items[itemKey];
                            return (
                              <span
                                key={itemKey}
                                title={`${def.name} ×${cnt}（${def.shortEffect}）`}
                                className="inline-flex items-center gap-0.5 rounded-md bg-white/65 px-1.5 py-0.5 text-[10px] font-bold text-slate-800 tabular-nums"
                              >
                                <ItemIcon item={itemKey} size={13} />
                                <span>{def.name}</span>
                                <span style={{ color: def.accentColor }}>×{cnt}</span>
                              </span>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="text-[10px] font-semibold text-slate-600">
                          持有道具：暂无
                        </div>
                      )}
                    </div>
                  </div>
                </div>

              </>
            ) : (
              <button
                type="button"
                onClick={() => setQuestExpanded(true)}
                title="展开任务栏"
                aria-label="展开任务栏"
                className="pointer-events-auto flex items-center gap-0.5 rounded-full bg-white/48 px-2 py-1 text-[10px] font-bold text-slate-600 backdrop-blur-xs transition-colors hover:bg-white/80 hover:text-slate-900 cursor-pointer"
              >
                <span>任务</span>
                <span className="text-[9px]">▸</span>
              </button>
            )}
          </div>
        </div>

        {/* Bottom-center focal point: Turn Owner + Action/Event Pills side-by-side above Dice Pod */}
        <div className="hud-bottom-dock pointer-events-auto absolute bottom-2.5 md:bottom-4 left-1/2 -translate-x-1/2 flex max-w-[calc(100vw-20px)] flex-col items-center gap-1.5" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
          {!bottomDockExpanded ? (
            <button
              type="button"
              onClick={() => setBottomDockExpanded(true)}
              title="展开骰子与消息栏"
              aria-label="展开骰子与消息栏"
              className="flex items-center gap-1.5 rounded-t-xl rounded-b-lg border border-white/80 bg-white/88 px-3.5 py-1 text-xs font-extrabold text-slate-700 shadow-[0_6px_18px_rgba(30,40,55,0.16)] backdrop-blur-sm transition-colors hover:bg-white cursor-pointer"
            >
              <span>▴ 展开操作</span>
            </button>
          ) : (
            <>
          {gmOpen && (
            <div className="anim-card-pop mb-0.5 flex flex-col gap-1.5 rounded-2xl border border-emerald-400/40 bg-slate-900/92 px-3 py-2 text-xs text-white shadow-2xl backdrop-blur-md">
              <div className="flex items-center gap-1.5">
                <span className="w-[58px] shrink-0 text-center rounded-md bg-emerald-500/20 px-1.5 py-0.5 font-mono text-[11px] font-bold text-emerald-300 border border-emerald-400/30">
                  GM 控骰
                </span>
                <button
                  type="button"
                  onClick={() => onSetGmDie(null)}
                  className={`rounded-lg px-2 py-1 text-[11px] font-bold transition cursor-pointer ${
                    snap.gmDie === null
                      ? 'bg-emerald-500 text-white shadow-sm'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  随机
                </button>
                {[1, 2, 3, 4, 5, 6].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => onSetGmDie(n)}
                    className={`h-7 w-7 rounded-lg font-mono text-xs font-extrabold transition cursor-pointer ${
                      snap.gmDie === n
                        ? 'bg-emerald-500 text-white ring-2 ring-emerald-300 shadow-sm'
                        : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
                    }`}
                  >
                    {n}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setGmOpen(false)}
                  className="ml-auto flex h-6 w-6 items-center justify-center rounded-lg bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white cursor-pointer"
                  title="关闭 GM 面板"
                >
                  ✕
                </button>
              </div>

              <div className="flex items-center gap-1.5">
                <span className="w-[58px] shrink-0 text-center rounded-md bg-amber-500/20 px-1.5 py-0.5 font-mono text-[11px] font-bold text-amber-300 border border-amber-400/30">
                  道具
                </span>
                {ITEM_ORDER.map((itemKey) => {
                  const def = ITEM_DEFS[itemKey];
                  return (
                    <button
                      key={itemKey}
                      type="button"
                      onClick={() => onGmGrantItem(itemKey)}
                      title={`GM 获得 +1「${def.name}」`}
                      aria-label={`GM 获得 ${def.name}`}
                      className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-800 transition hover:bg-slate-700 hover:scale-105 active:scale-95 cursor-pointer"
                    >
                      <ItemIcon item={itemKey} size={18} />
                    </button>
                  );
                })}
                <button
                  type="button"
                  onClick={onGmClearItems}
                  title="清空当前玩家所有道具"
                  className="ml-auto rounded-lg border border-rose-400/35 bg-rose-500/20 px-2.5 py-1 text-[11px] font-bold text-rose-200 transition hover:bg-rose-500/35 hover:text-white active:scale-95 cursor-pointer"
                >
                  清空
                </button>
              </div>

              <div className="flex items-center gap-1.5">
                <span className="w-[58px] shrink-0 text-center rounded-md bg-violet-500/20 px-1.5 py-0.5 font-mono text-[11px] font-bold text-violet-300 border border-violet-400/30">
                  托管
                </span>
                <button
                  type="button"
                  onClick={onToggleGmAutoPlay}
                  className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-bold transition cursor-pointer ${
                    snap.gmAutoPlay
                      ? 'bg-violet-500 text-white ring-2 ring-violet-300 shadow-sm'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  <span>🤖</span>
                  <span>自动游戏：{snap.gmAutoPlay ? '已开启' : '关闭'}</span>
                </button>
              </div>

              <div className="flex items-center gap-1.5">
                <span className="w-[58px] shrink-0 text-center rounded-md bg-sky-500/20 px-1.5 py-0.5 font-mono text-[11px] font-bold text-sky-300 border border-sky-400/30">
                  天气
                </span>
                {(
                  [
                    ['morning', '🌅', '清晨'],
                    ['noon', '☀️', '中午'],
                    ['afternoon', '🌇', '下午'],
                    ['evening', '🌙', '夜晚'],
                  ] as [TimeOfDay, string, string][]
                ).map(([tod, icon, label]) => (
                  <button
                    key={tod}
                    type="button"
                    onClick={() => onSetGmTimeOfDay(tod)}
                    title={`切换天气：${label}`}
                    className={`flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-bold transition cursor-pointer ${
                      snap.timeOfDay === tod
                        ? 'bg-sky-500 text-white shadow-sm'
                        : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    <span>{icon}</span>
                    <span>{label}</span>
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <span className="w-[58px] shrink-0 text-center rounded-md bg-amber-500/20 px-1.5 py-0.5 font-mono text-[11px] font-bold text-amber-300 border border-amber-400/30">
                  倍速
                </span>
                <input
                  type="range"
                  min={1.0}
                  max={8.0}
                  step={0.5}
                  value={snap.gameSpeed}
                  onChange={(e) => onSetGameSpeed(parseFloat(e.target.value), true)}
                  aria-label="GM 倍速"
                  className="h-1.5 flex-1 min-w-0 cursor-pointer accent-amber-400"
                />
                <span className="w-10 shrink-0 text-right font-mono text-[11px] font-bold tabular-nums text-amber-300">
                  {snap.gameSpeed.toFixed(1)}x
                </span>
              </div>
            </div>
          )}

          {emoteOpen && (
            <div className="anim-card-pop mb-0.5 flex flex-wrap items-center justify-center gap-1.5 rounded-2xl border border-slate-200 bg-white/95 px-3 py-2 shadow-xl backdrop-blur-md">
              {QUICK_EMOTES.map((em) => (
                <button
                  key={em.text}
                  type="button"
                  onClick={() => handleSendEmote(em.icon, em.text)}
                  className="flex items-center gap-1 rounded-xl bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-700 transition-colors hover:bg-emerald-50 hover:text-emerald-700 cursor-pointer"
                >
                  <span>{em.icon}</span>
                  <span>{em.text}</span>
                </button>
              ))}
            </div>
          )}



          <div
            className="flex items-center gap-2.5 md:gap-3 rounded-[20px] bg-white/95 px-3.5 py-2.5 transition-shadow"
            style={{
              border: `2.5px solid ${humanTurn ? cur.uiColor : 'rgba(255,255,255,0.95)'}`,
              boxShadow:
                humanTurn &&
                (snap.phase === 'awaitRoll' || snap.phase === 'awaitMove')
                  ? `0 12px 32px rgba(30,40,55,0.24), 0 0 0 4px ${cur.uiColor}40`
                  : '0 10px 28px rgba(30,40,55,0.20)',
            }}
          >
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={rollDisabled}
                onClick={() => {
                  setEmoteOpen(false);
                  onActionPod();
                }}
                title="点击掷骰子"
                key={`die-${snap.hudDiePopKey}`}
                className={`grid h-12 w-12 md:h-[52px] md:w-[52px] shrink-0 grid-cols-3 grid-rows-3 gap-1 rounded-[13px] border-2 border-[#d5c7b0] bg-gradient-to-b from-[#fffdf9] to-[#f3ebdc] p-1.5 shadow-[inset_0_-3px_0_#dfd2bc,0_3px_8px_rgba(0,0,0,0.12)] transition-transform hover:scale-105 cursor-pointer disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:scale-100 ${
                  snap.hudDieRolling
                    ? 'anim-die-spin'
                    : snap.hudDiePopKey > 0
                      ? 'anim-die-pop'
                      : ''
                }`}
              >
                {Array.from({ length: 9 }, (_, i) => (
                  <span
                    key={i}
                    className={`h-full w-full rounded-full transition-all duration-100 ${
                      activePips.includes(i)
                        ? `opacity-100 scale-100 ${redFace ? 'bg-[#dc3c32]' : 'bg-[#2e2824]'}`
                        : 'opacity-0 scale-50'
                    }`}
                  />
                ))}
              </button>

              {secondDieFace !== null && (
                <div
                  key={`die2-${snap.hudDiePopKey}`}
                  className={`grid h-10 w-10 md:h-[46px] md:w-[46px] shrink-0 grid-cols-3 grid-rows-3 gap-0.5 rounded-[11px] border-2 border-[#d5c7b0] bg-gradient-to-b from-[#fffdf9] to-[#f3ebdc] p-1.5 shadow-[inset_0_-2px_0_#dfd2bc,0_2px_6px_rgba(0,0,0,0.12)] ${
                    snap.hudDiePopKey > 0 ? 'anim-die-pop' : ''
                  }`}
                >
                  {Array.from({ length: 9 }, (_, i) => (
                    <span
                      key={i}
                      className={`h-full w-full rounded-full transition-all duration-100 ${
                        secondPips.includes(i)
                          ? `opacity-100 scale-100 ${secondRedFace ? 'bg-[#dc3c32]' : 'bg-[#2e2824]'}`
                          : 'opacity-0 scale-50'
                      }`}
                    />
                  ))}
                </div>
              )}

              <div
                onClick={handleSecretTap}
                className="min-w-[56px] text-xs leading-snug text-slate-600 tabular-nums select-none cursor-default"
              >
                <b className="flex items-center gap-1 text-[15px] text-slate-900">
                  <span>
                    {snap.twinDice && snap.die !== null
                      ? `${snap.twinDice[0]}+${snap.twinDice[1]}=${snap.die}`
                      : snap.die !== null
                        ? `点数 ${snap.die}`
                        : '点数 -'}
                  </span>
                  {snap.gmDie !== null && (
                    <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  )}
                </b>
                连6 ×{snap.sixChain}
              </div>
            </div>

            <button
              type="button"
              disabled={rollDisabled}
              onClick={onActionPod}
              className={`min-w-[132px] md:min-w-[160px] whitespace-nowrap rounded-[14px] px-4 md:px-6 py-2.5 md:py-3 text-sm md:text-[15px] font-extrabold text-white tabular-nums transition-transform active:translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60 disabled:grayscale cursor-pointer ${
                rollVariant === 'pick'
                  ? 'bg-gradient-to-b from-amber-500 to-amber-600 shadow-[0_4px_0_#b45309]'
                  : rollVariant === 'green'
                    ? 'bg-gradient-to-b from-[#42b878] to-[#2c9a60] shadow-[0_4px_0_#1f7a49]'
                    : 'bg-slate-500 shadow-[0_3px_0_#475569]'
              }`}
            >
              {rollLabel}
            </button>

            <button
              type="button"
              onClick={() => setEmoteOpen((v) => !v)}
              title="发送快捷表情"
              className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-[13px] border text-lg transition-colors cursor-pointer ${
                emoteOpen
                  ? 'border-emerald-400 bg-emerald-50 text-emerald-700'
                  : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
              }`}
            >
              💬
            </button>
            <button
              type="button"
              onClick={() => {
                setEmoteOpen(false);
                setBottomDockExpanded(false);
              }}
              title="向下收起操作栏"
              aria-label="向下收起操作栏"
              className="flex h-11 w-7 shrink-0 items-center justify-center rounded-[11px] border border-slate-200 bg-slate-50 text-xs font-bold text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800 cursor-pointer"
            >
              ▾
            </button>
          </div>

          {/* 己方道具卡栏 + 已自动选中提示 */}
          {deckPlayer && (heldItemEntries.length > 0 || (snap.armedRefuel && snap.turnUsedAtkDef)) && (
            <div className="flex flex-wrap items-center justify-center gap-1.5 rounded-2xl border border-white/90 bg-white/92 px-2.5 py-1.5 shadow-[0_8px_22px_rgba(30,40,55,0.16)] backdrop-blur-md">
              {snap.armedRefuel && snap.turnUsedAtkDef && (
                <span className="inline-flex items-center gap-1 rounded-xl border border-emerald-400 bg-emerald-50 px-2.5 py-1 text-[10px] font-extrabold text-emerald-800 ring-2 ring-emerald-200">
                  <ItemIcon item="refuel" size={16} />
                  <span>再来一口小饼干（已自动选中 · 本次投骰生效）</span>
                </span>
              )}

              {heldItemEntries.map((itemKey) => {
                const def = ITEM_DEFS[itemKey];
                const count = deckPlayer.items[itemKey];
                const isDefenseCard = itemKey === 'shield';
                const blockedByCap = isDefenseCard ? snap.turnUsedDef : snap.turnUsedAtkDef;
                const canUseNow = snap.phase === 'awaitRoll' && !blockedByCap;
                const isPickingThis = snap.pendingItemTarget === itemKey;
                const isArmedDiceThis =
                  !snap.turnUsedAtkDef &&
                  ((itemKey === 'sixDie' && snap.armedSixDie) ||
                    (itemKey === 'twinDice' && snap.armedTwinDice) ||
                    (itemKey === 'refuel' && snap.armedRefuel));
                return (
                  <button
                    key={itemKey}
                    type="button"
                    disabled={!canUseNow}
                    onClick={() => onUseItem(itemKey)}
                    title={`${def.name}（${def.categoryLabel}）：${def.desc}`}
                    className={`flex items-center gap-1.5 rounded-xl border px-2.5 py-1 text-left transition cursor-pointer disabled:cursor-not-allowed disabled:opacity-45 ${
                      isPickingThis
                        ? 'border-sky-500 bg-sky-50 ring-2 ring-sky-300'
                        : isArmedDiceThis
                          ? 'border-amber-500 bg-amber-50 ring-2 ring-amber-300/80 shadow-sm'
                          : canUseNow
                            ? 'border-slate-200 bg-white hover:border-amber-400 hover:bg-amber-50/70 shadow-sm'
                            : 'border-slate-200 bg-slate-50'
                    }`}
                  >
                    <ItemIcon item={itemKey} size={22} />
                    <div className="leading-tight">
                      <div className="flex items-center gap-1 text-[11px] font-extrabold text-slate-800">
                        <span>{def.name}</span>
                        <span
                          className="rounded px-1 text-[9px] font-bold text-white"
                          style={{ backgroundColor: def.accentColor }}
                        >
                          ×{count}
                        </span>
                        {isArmedDiceThis && (
                          <span className="rounded bg-amber-500 px-1 text-[9px] font-extrabold text-white">
                            已选
                          </span>
                        )}
                      </div>
                      <div className="text-[9px] font-medium text-slate-500">
                        {isArmedDiceThis
                          ? '投骰时使用 · 再点取消'
                          : blockedByCap
                            ? isDefenseCard
                              ? '下回合再洗香香~'
                              : '已经吃不下啦~'
                            : def.shortEffect}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}


          <div className="flex max-w-full items-center justify-center gap-1.5 md:gap-2">
            <div
              className="flex h-9 md:h-10 shrink-0 items-center justify-center rounded-2xl border-2 border-slate-300/90 bg-white/95 px-2.5 md:px-3 text-[12px] md:text-[13px] font-extrabold text-slate-700 whitespace-nowrap tabular-nums"
              style={{ boxShadow: '0 6px 18px rgba(0,0,0,0.12)' }}
              title="当前大轮数"
            >
              第 {snap.roundNumber ?? 1} 轮
            </div>

            <div
              className="flex h-9 md:h-10 shrink-0 items-center gap-1.5 md:gap-2 rounded-2xl bg-white/95 px-2.5 md:px-3.5 text-[12px] md:text-[14px] font-bold text-slate-800 whitespace-nowrap transition-colors"
              style={{
                border: `2px solid ${cur.uiColor}`,
                boxShadow: humanTurn
                  ? `0 6px 18px rgba(0,0,0,0.16), 0 0 0 3px ${cur.uiColor}2e`
                  : '0 6px 20px rgba(0,0,0,0.14)',
              }}
            >
              <CharacterAvatar charKey={cur.charKey} size={24} />
              <span>{cur.name}</span>
              <span
                className="rounded-md px-1.5 py-0.5 text-[10px] md:text-[11px] font-extrabold text-white whitespace-nowrap"
                style={{ backgroundColor: cur.uiColor }}
              >
                {isOpponent ? `对手${curOppNum}` : `玩家${curHumanNum}`}
              </span>
            </div>

            <div
              aria-live="polite"
              className="flex h-9 md:h-10 min-w-0 items-center gap-1.5 md:gap-2 rounded-2xl bg-white/95 px-3 md:px-4 text-[12px] md:text-[14px] font-bold text-slate-800 transition-colors"
              style={{
                border: `2px solid ${cur.uiColor}`,
                boxShadow: '0 6px 20px rgba(0,0,0,0.14)',
              }}
            >
              <span className="truncate text-[12px] md:text-[14px] font-bold text-slate-700">
                {topPrompt}
              </span>
              {snap.pendingItemTarget !== null && (
                <button
                  type="button"
                  onClick={onCancelItemTarget}
                  className="pointer-events-auto ml-1 shrink-0 rounded-full bg-rose-500 px-2.5 py-0.5 text-[11px] font-extrabold text-white shadow-xs transition-colors hover:bg-rose-600 cursor-pointer"
                >
                  ✕ 取消选择
                </button>
              )}
            </div>
          </div>

            </>
          )}
        </div>

        {/* Top-Right Pill Bar: 天色时段 | 视角下拉 | 游戏规则 | 声音 | 设置齿轮 */}
        <div
          className="hud-right-corner pointer-events-auto absolute right-2.5 top-2.5 md:right-3.5 md:top-3.5 flex items-center gap-1 rounded-full border border-white/55 bg-white/52 p-1 shadow-[0_6px_18px_rgba(30,40,55,0.12)] backdrop-blur-md"
          style={{ paddingTop: 'env(safe-area-inset-top)', paddingRight: 'env(safe-area-inset-right)' }}
          role="group"
          aria-label="天色、视角、规则、声音与设置"
        >

          {/* 视角下拉按钮 */}
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setCamMenuOpen((v) => !v);
                setSettingsMenuOpen(false);
              }}
              title="切换视角（快捷键 V）"
              aria-expanded={camMenuOpen}
              className={`flex h-8 items-center gap-1 rounded-full px-2.5 text-[11px] md:text-xs font-bold transition-colors whitespace-nowrap cursor-pointer ${
                camMenuOpen
                  ? 'bg-white/55 text-slate-900 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.65)]'
                  : 'text-slate-700 hover:bg-white/40'
              }`}
            >
              <span>
                {snap.camMode === 'follow' ? '跟随' : snap.camMode === 'top' ? '俯视' : '自由'}
              </span>
              <span className="text-[10px] text-slate-500">{camMenuOpen ? '▴' : '▾'}</span>
            </button>

            {camMenuOpen && (
              <div className="anim-card-pop absolute right-0 top-full mt-2 w-28 rounded-2xl border border-white/70 bg-white/75 p-1.5 shadow-[0_12px_30px_rgba(15,23,42,0.16)] backdrop-blur-md">
                {(
                  [
                    ['follow', '跟随视角'],
                    ['top', '俯视视角'],
                    ['free', '自由视角'],
                  ] as [CameraMode, string][]
                ).map(([mode, label]) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => {
                      onSetCamMode(mode);
                      setCamMenuOpen(false);
                    }}
                    className={`flex w-full items-center justify-between rounded-xl px-2.5 py-2 text-xs font-bold transition-colors cursor-pointer ${
                      snap.camMode === mode
                        ? 'bg-emerald-500/16 text-emerald-800 ring-1 ring-emerald-500/25'
                        : 'text-slate-700 hover:bg-white/60'
                    }`}
                  >
                    <span>{label}</span>
                    {snap.camMode === mode && (
                      <svg
                        width="13"
                        height="13"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="text-emerald-600"
                        aria-hidden="true"
                      >
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          <span className="h-4 w-px bg-slate-700/15" aria-hidden="true" />

          {/* 游戏规则按钮 */}
          <button
            type="button"
            onClick={() => {
              setCamMenuOpen(false);
              setSettingsMenuOpen(false);
              setEmoteOpen(false);
              setRulesOpen(true);
            }}
            className={`flex h-8 items-center gap-1 rounded-full px-2.5 text-[11px] md:text-xs font-bold transition-colors whitespace-nowrap cursor-pointer ${
              rulesOpen
                ? 'bg-emerald-500/16 text-emerald-800'
                : 'text-slate-700 hover:bg-white/40'
            }`}
          >
            <span>规则</span>
          </button>

          <span className="h-4 w-px bg-slate-700/15" aria-hidden="true" />

          {/* 声音按钮（统一矢量线框图标） */}
          <button
            type="button"
            onClick={onToggleMute}
            title={muted ? '开启全局音效' : '关闭全局音效'}
            aria-label={muted ? '开启音效' : '静音'}
            className={`flex h-8 w-8 items-center justify-center rounded-full transition-colors cursor-pointer ${
              muted
                ? 'bg-rose-500/14 text-rose-600 hover:bg-rose-500/20'
                : 'text-slate-600 hover:bg-white/40 hover:text-slate-900'
            }`}
          >
            {muted ? (
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.1"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                <line x1="22" y1="9" x2="16" y2="15" />
                <line x1="16" y1="9" x2="22" y2="15" />
              </svg>
            ) : (
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.1"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
              </svg>
            )}
          </button>

          <span className="h-4 w-px bg-slate-700/15" aria-hidden="true" />

          {/* 齿轮设置按钮（收纳返回设置与暂停） */}
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setSettingsMenuOpen((v) => !v);
                setCamMenuOpen(false);
              }}
              title="设置"
              aria-label="设置"
              aria-expanded={settingsMenuOpen}
              className={`flex h-8 w-8 items-center justify-center rounded-full transition-all cursor-pointer ${
                settingsMenuOpen
                  ? 'bg-white/55 text-emerald-700 rotate-45 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.65)]'
                  : 'text-slate-600 hover:bg-white/40 hover:text-slate-900'
              }`}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.1"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <circle cx="12" cy="12" r="3.2" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h.08a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v.08a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
            </button>

            {settingsMenuOpen && (
              <div className="anim-card-pop absolute right-0 top-full mt-2 w-48 rounded-2xl border border-white/80 bg-white/95 p-1.5 shadow-[0_12px_30px_rgba(15,23,42,0.18)] backdrop-blur-md">
                <div className="px-2 py-1.5">
                  <div className="mb-1 text-[11px] font-bold text-slate-600">🎨 画质</div>
                  <div className="grid grid-cols-3 gap-1 rounded-lg bg-slate-100 p-0.5">
                    {(
                      [
                        ['high', '高'],
                        ['medium', '中'],
                        ['low', '低'],
                      ] as [GraphicsQuality, string][]
                    ).map(([q, label]) => (
                      <button
                        key={q}
                        type="button"
                        onClick={() => onChangeQuality(q)}
                        className={`rounded-md py-1 text-[11px] font-extrabold transition-colors cursor-pointer ${
                          quality === q
                            ? 'bg-[#2c9a60] text-white shadow-xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="my-1 h-px bg-slate-100" />
                <div className="px-2 py-1.5">
                  <div className="mb-1 flex items-center justify-between text-[11px] font-bold text-slate-600">
                    <span>⚡ 节奏倍速</span>
                    <span className="tabular-nums text-emerald-700">{snap.gameSpeed.toFixed(1)}x</span>
                  </div>
                  <input
                    type="range"
                    min={1.0}
                    max={1.5}
                    step={0.1}
                    value={Math.min(1.5, snap.gameSpeed)}
                    onChange={(e) => onSetGameSpeed(parseFloat(e.target.value))}
                    aria-label="游戏倍速"
                    className="mb-1.5 h-1.5 w-full cursor-pointer accent-emerald-600"
                  />
                  <div className="grid grid-cols-4 gap-1">
                    {[1.0, 1.2, 1.3, 1.5].map((sp) => (
                      <button
                        key={sp}
                        type="button"
                        onClick={() => onSetGameSpeed(sp)}
                        className={`rounded-md py-1 text-[10px] font-bold tabular-nums transition-colors cursor-pointer ${
                          Math.abs(snap.gameSpeed - sp) < 0.05
                            ? 'bg-[#2c9a60] text-white'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        {sp.toFixed(1)}x
                      </button>
                    ))}
                  </div>
                </div>
                <div className="my-1 h-px bg-slate-100" />
                <button
                  type="button"
                  onClick={() => {
                    setSettingsMenuOpen(false);
                    onReturnSetup();
                  }}
                  className="flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-xs font-bold text-slate-700 transition-colors hover:bg-slate-100 cursor-pointer"
                >
                  <span>🔄 返回设置</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSettingsMenuOpen(false);
                    onTogglePause();
                  }}
                  className="flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-xs font-bold text-slate-700 transition-colors hover:bg-slate-100 cursor-pointer"
                >
                  <span>{snap.paused ? '▶️ 继续游戏' : '⏸️ 暂停游戏'}</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Rules Modal */}
        {rulesOpen && (
          <div
            className="pointer-events-auto fixed inset-0 z-30 flex items-center justify-center bg-slate-950/45 p-4"
            onClick={() => setRulesOpen(false)}
          >
            <div
              className="anim-card-pop w-full max-w-[540px] max-h-[84vh] overflow-y-auto rounded-[20px] bg-white p-6 text-slate-700 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-3.5">
                <div>
                  <h3 className="text-lg font-bold text-slate-900">玩法规则说明</h3>
                  <p className="mt-0.5 text-xs text-slate-500">
                    经典 7 格边环道 · 4 架棋子全部抵达中心终点即获胜
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setRulesOpen(false)}
                  aria-label="关闭规则说明"
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-sm text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800 cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <div className="mt-4 space-y-5 text-[13px] leading-relaxed">
                <section>
                  <h4 className="mb-2 text-xs font-bold tracking-wide text-emerald-700">
                    01. 起飞与连掷规则
                  </h4>
                  <ul className="space-y-2 text-slate-600">
                    <li className="flex gap-2.5">
                      <span className="shrink-0 font-semibold text-slate-800">5 或 6 起飞</span>
                      <span>
                        掷出 <b className="text-slate-900">5</b> 或 <b className="text-slate-900">6</b>{' '}
                        点（或使用双倍珍珠奶茶掷出总和 <b className="text-slate-900">≥ 5</b>）时，可选择让停机坪棋子登上 <b className="text-slate-900">START 起点台</b>，或移动场上已有棋子。
                      </span>
                    </li>
                    <li className="flex gap-2.5">
                      <span className="shrink-0 font-semibold text-slate-800">仅 6 奖连掷</span>
                      <span>
                        只有自然掷出 <b className="text-slate-900">6</b> 点才可再掷一次（连续三个 6
                        后第三次只走子不再投；使用幸运草莓蛋糕或双倍珍珠奶茶不触发连投）；棋子抵达终点不额外奖励掷骰。
                      </span>
                    </li>
                  </ul>
                </section>

                <section className="border-t border-slate-100 pt-4">
                  <h4 className="mb-2 text-xs font-bold tracking-wide text-emerald-700">
                    02. 跳跃、航线与撞击
                  </h4>
                  <ul className="space-y-2 text-slate-600">
                    <li className="flex gap-2.5">
                      <span className="shrink-0 font-semibold text-slate-800">同色跳 +4</span>
                      <span>
                        外圈 52 格四色循环，落在己方同色格可顺延向前跳跃 <b className="text-slate-900">4 格</b>。
                      </span>
                    </li>
                    <li className="flex gap-2.5">
                      <span className="shrink-0 font-semibold text-slate-800">航线飞 +12</span>
                      <span>
                        落在带 <b className="text-slate-900">✈</b> 标记的己色斜角格，沿虚线直飞对岸{' '}
                        <b className="text-slate-900">12 格</b>，并击中航线穿过的对家终点通道第 4 格（终点前第 2 格）敌机（单熊送回基地，叠叠乐拆散分别退 6~9 格，有泡泡罩则抵挡；直飞后仍可顺风连跳）。
                      </span>
                    </li>
                    <li className="flex gap-2.5">
                      <span className="shrink-0 font-semibold text-slate-800">被踩与叠叠乐</span>
                      <span>
                        落点遇单只敌方小熊时直接将其送回基地；若敌方为<b className="text-slate-900">叠叠乐（≥2只同格）</b>，则伤害分摊并被拆散，分别后退 <b className="text-slate-900">6、7、8、9 格</b>（最多退至起点，不回基地）。若目标带有<b className="text-sky-700">软绵绵泡泡罩</b>，则消耗护盾抵挡 1 次踩踏并同格挤脸站立（己方多只带盾叠叠乐合体时自动合并为 1 层护盾）；点数超出终点格会向后回弹。
                      </span>
                    </li>
                  </ul>
                </section>

                <section className="border-t border-slate-100 pt-4">
                  <h4 className="mb-2 text-xs font-bold tracking-wide text-emerald-700">
                    03. 道具、商店与悬赏任务
                  </h4>
                  <ul className="space-y-2 text-slate-600">
                    <li className="flex gap-2.5">
                      <span className="shrink-0 font-semibold text-slate-800">获取途径</span>
                      <span>
                        踩中棋盘上的 <b className="text-amber-700">🍰 草莓蛋糕商店格</b> 可在 15 秒内从 3
                        张不重复随机道具卡中挑选 1 张；完成左侧悬赏任务（<b>一二的馈赠</b>：1点与2点同时≥1次奖随机卡；<b>布布不烦恼</b>：累计被踩2次随机奖软绵绵泡泡罩或双倍珍珠奶茶）也可获得。
                      </span>
                    </li>
                    <li className="flex gap-2.5">
                      <span className="shrink-0 font-semibold text-slate-800">使用限制</span>
                      <span>
                        在回合内投骰前使用。单回合（含奖励连投）最多使用 <b className="text-slate-900">1 张进攻/加速道具 + 1 张软绵绵泡泡罩</b>（奶油派炸弹与幸运草莓蛋糕、双倍珍珠奶茶、再来一口小饼干共用每回合 1 次上限）。
                      </span>
                    </li>
                  </ul>
                  <div className="mt-3 overflow-hidden rounded-xl border border-slate-200">
                    <table className="w-full border-collapse text-left text-xs">
                      <thead>
                        <tr className="bg-slate-50 text-slate-700 border-b border-slate-200">
                          <th className="px-2.5 py-2 font-bold whitespace-nowrap">道具</th>
                          <th className="px-2.5 py-2 font-bold whitespace-nowrap">类型</th>
                          <th className="px-2.5 py-2 font-bold">效果与限制</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white">
                        {ITEM_ORDER.map((itemKey) => {
                          const def = ITEM_DEFS[itemKey];
                          const isDefense = def.category === 'defense' || def.category === 'counter';
                          return (
                            <tr key={itemKey}>
                              <td className="px-2.5 py-2 font-bold text-slate-800 whitespace-nowrap">
                                <span className="inline-flex items-center gap-1.5"><ItemIcon item={itemKey} size={16} /><span>{def.name}</span></span>
                              </td>
                              <td className="px-2.5 py-2 whitespace-nowrap">
                                <span
                                  className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-bold ${
                                    isDefense
                                      ? 'bg-sky-50 text-sky-700 border border-sky-200'
                                      : 'bg-rose-50 text-rose-700 border border-rose-200'
                                  }`}
                                >
                                  {isDefense ? '防御' : '攻击'}
                                </span>
                              </td>
                              <td className="px-2.5 py-2 text-slate-600 leading-snug">
                                {def.shortEffect}（{def.limitNote}）
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  <ul className="hidden">
                  </ul>
                </section>

                <section className="border-t border-slate-100 pt-4">
                  <h4 className="mb-2.5 text-xs font-bold tracking-wide text-emerald-700">
                    04. 快捷操控与视角
                  </h4>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 text-xs text-slate-600">
                    <div className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2">
                      <span>掷骰 / 单子直走</span>
                      <kbd className="rounded border border-slate-200 bg-white px-2 py-0.5 font-mono text-[11px] font-semibold text-slate-700">
                        空格 / 回车
                      </kbd>
                    </div>
                    <div className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2">
                      <span>快速选棋子</span>
                      <kbd className="rounded border border-slate-200 bg-white px-2 py-0.5 font-mono text-[11px] font-semibold text-slate-700">
                        数字键 1~4
                      </kbd>
                    </div>
                    <div className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2">
                      <span>切换 / 回正视角</span>
                      <kbd className="rounded border border-slate-200 bg-white px-2 py-0.5 font-mono text-[11px] font-semibold text-slate-700">
                        V / R
                      </kbd>
                    </div>
                    <div className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2">
                      <span>暂停或继续</span>
                      <kbd className="rounded border border-slate-200 bg-white px-2 py-0.5 font-mono text-[11px] font-semibold text-slate-700">
                        P
                      </kbd>
                    </div>
                  </div>
                </section>
              </div>

              <div className="mt-5 flex justify-end border-t border-slate-100 pt-3.5">
                <button
                  type="button"
                  onClick={() => setRulesOpen(false)}
                  className="rounded-xl bg-[#2c9a60] px-6 py-2 text-sm font-bold text-white shadow-sm transition-colors hover:bg-[#258552] cursor-pointer"
                >
                  我知道了
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 15 秒道具商店三选一弹窗（卡通半透明精简版） */}
        {snap.phase === 'shopChoice' && snap.shopOffer && !showSetup && (
          <div role="dialog" aria-modal="true" aria-label="古城道具商店" className="pointer-events-auto fixed inset-0 z-30 flex items-center justify-center bg-slate-900/20 p-4 backdrop-blur-[2px]">
            <div
              className="anim-card-pop w-full max-w-[560px] rounded-[32px] border-[3px] border-white/80 bg-[#fff9f2]/72 p-4 md:p-5 backdrop-blur-md"
              style={{
                boxShadow: `0 20px 50px rgba(25,18,12,0.22), 0 0 0 4px ${shopPlayer.uiColor}55`,
              }}
            >
              <div className="flex items-center justify-between gap-3 px-1 pb-3">
                <div className="flex items-center gap-2.5">
                  <CharacterAvatar charKey={shopPlayer.charKey} size={36} />
                  <h3 className="text-base md:text-lg font-extrabold text-slate-800 drop-shadow-[0_1px_1px_rgba(255,255,255,0.9)]">
                    🏪 一二布布的小卖部 · 选 1 个
                  </h3>
                </div>
                <div aria-live="polite" className="shrink-0 rounded-full bg-amber-400/90 px-3.5 py-1 text-sm font-extrabold text-white tabular-nums shadow-sm">
                  ⏱️ {snap.shopSecondsLeft ?? 15}s
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 md:gap-3.5">
                {snap.shopOffer.map((itemKey) => {
                  const def = ITEM_DEFS[itemKey];
                  return (
                    <button
                      key={itemKey}
                      type="button"
                      onClick={() => onPickShopItem(itemKey)}
                      className="group relative flex flex-col items-center rounded-[24px] border-2 border-white/85 bg-white/65 px-2.5 py-4 text-center backdrop-blur-sm transition-all duration-200 hover:-translate-y-1.5 hover:scale-[1.03] hover:bg-white/92 hover:shadow-xl active:scale-95 cursor-pointer"
                    >
                      <div
                        className="mt-2 flex h-16 w-16 items-center justify-center rounded-full transition-transform duration-200 group-hover:scale-110"
                        style={{ backgroundColor: `${def.accentColor}1c` }}
                      >
                        <ItemIcon item={itemKey} size={44} />
                      </div>

                      <h4 className="mt-2.5 text-sm md:text-base font-extrabold text-slate-800">
                        {def.name}
                      </h4>
                      <p className="mt-0.5 text-[11px] font-semibold text-slate-500 leading-tight">
                        {def.shortEffect}
                      </p>

                      <div
                        className="mt-3 rounded-full px-4 py-1 text-xs font-extrabold text-white shadow-sm transition-transform group-hover:scale-105"
                        style={{ backgroundColor: def.accentColor }}
                      >
                        选它！
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
};
