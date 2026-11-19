import React, { useEffect, useRef, useState } from 'react';
import { beep } from '../game/audio';
import { CameraMode, GameHudSnapshot, HUD_PIPS } from '../game/constants';
import { CharacterAvatar } from './CharacterAvatar';

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
  onToggleMute: () => void;
  onSetGmDie: (val: number | null) => void;
  onActionPod: () => void;
  onSetCamMode: (mode: CameraMode) => void;
  onResetView: () => void;
  onReturnSetup: () => void;
  onTogglePause: () => void;
}

export const GameHUD: React.FC<GameHUDProps> = ({
  snap,
  showSetup,
  muted,
  onToggleMute,
  onSetGmDie,
  onActionPod,
  onSetCamMode,
  onResetView,
  onReturnSetup,
  onTogglePause,
}) => {
  const [rulesOpen, setRulesOpen] = useState(false);
  const [dockCollapsed, setDockCollapsed] = useState(false);
  const [gmOpen, setGmOpen] = useState(false);
  const [emoteOpen, setEmoteOpen] = useState(false);
  const [activeEmotes, setActiveEmotes] = useState<Record<number, string>>({});
  const emoteTimers = useRef<Record<number, number>>({});
  const secretTapCount = useRef(0);
  const secretTapTimer = useRef<number | null>(null);

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
    }, 2800);
  };

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

    // 对手偶发回应表情气泡
    const opponents = snap.players
      .map((p, idx) => ({ p, idx }))
      .filter((x) => x.p.type === 'ai');
    if (opponents.length > 0 && Math.random() < 0.55) {
      const pick = opponents[Math.floor(Math.random() * opponents.length)];
      const reply = QUICK_EMOTES[Math.floor(Math.random() * QUICK_EMOTES.length)];
      window.setTimeout(() => {
        showEmoteBubble(pick.idx, `${reply.icon} ${reply.text}`);
      }, 650);
    }
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
  else if (snap.phase === 'rolling') {
    actionText =
      snap.die !== null && !snap.hudDieRolling ? `掷出 ${snap.die} 点` : '掷骰中…';
  } else if (snap.phase === 'moving') actionText = '移动中…';
  else if (isOpponent) actionText = '对手思考中…';
  else if (snap.phase === 'awaitRoll') actionText = '请掷骰子';
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
  } else if (snap.phase === 'rolling') {
    rollLabel = '🎲 投掷中…';
  } else if (snap.phase === 'moving') {
    rollLabel = '✈️ 移动中…';
  } else if (isOpponent) {
    rollLabel = '⏳ 对手行动中…';
  }

  const activePips = HUD_PIPS[snap.hudDieFace] ?? [];
  const redFace = snap.hudDieFace === 1 || snap.hudDieFace === 4;

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

      {/* Turn splash banner for human turns */}
      <div
        className={`pointer-events-none fixed left-1/2 top-[24%] md:top-[22%] z-[20] flex items-center gap-3 whitespace-nowrap rounded-[22px] bg-white/95 px-6 py-3 text-lg md:text-[22px] font-extrabold text-slate-800 transition-all duration-200 ${
          snap.splashVisible
            ? 'opacity-100 -translate-x-1/2 -translate-y-1/2 scale-100'
            : 'opacity-0 -translate-x-1/2 -translate-y-1/2 scale-90'
        }`}
        style={{
          border: `3px solid ${snap.splashColor}`,
          boxShadow: `0 18px 46px rgba(0,0,0,0.24), 0 0 0 6px ${snap.splashColor}33`,
        }}
      >
        <CharacterAvatar charKey={snap.splashCharKey} size={34} />
        <span>{snap.splashText}</span>
      </div>

      <div className="pointer-events-none fixed inset-0 z-10">
        {/* Party / Player list (left vertical stack) */}
        <div className="absolute left-2.5 top-2.5 md:left-3.5 md:top-3.5 flex w-[148px] md:w-[196px] flex-col gap-1.5">
          {snap.players.map((pl, i) => {
            const humanNum = snap.players
              .slice(0, i + 1)
              .filter((p) => p.type === 'human').length;
            const oppNum = snap.players
              .slice(0, i + 1)
              .filter((p) => p.type === 'ai').length;
            const bubble = activeEmotes[i];
            return (
              <div key={i} className="relative">
                <div
                  className={`pointer-events-auto flex items-center gap-2 rounded-[13px] px-2.5 py-1.5 md:px-3 md:py-2 transition-all duration-200 ${
                    pl.active
                      ? 'bg-white opacity-100 translate-x-1'
                      : 'bg-white/85 opacity-85'
                  }`}
                  style={{
                    border: `2px solid ${pl.active ? pl.uiColor : 'rgba(255,255,255,0.8)'}`,
                    boxShadow: pl.active
                      ? `0 8px 22px rgba(0,0,0,0.16), 0 0 0 3px ${pl.uiColor}2e`
                      : '0 4px 12px rgba(60,80,110,0.14)',
                  }}
                >
                  <div className="relative flex h-8 w-8 shrink-0 items-center justify-center">
                    <CharacterAvatar charKey={pl.charKey} size={32} />
                    <span
                      className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border border-white shadow-sm"
                      style={{ backgroundColor: pl.colorHex }}
                    />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-1">
                      <b className="truncate text-[12px] md:text-[13px] text-slate-800">
                        {pl.name}
                      </b>
                      <span
                        className="shrink-0 rounded px-1.5 py-0.5 text-[9px] md:text-[10px] font-bold whitespace-nowrap"
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
                    </div>
                    <div className="mt-1 flex items-center gap-1">
                      {[0, 1, 2, 3].map((k) => (
                        <span
                          key={k}
                          className={`h-1.5 flex-1 rounded-full transition-colors ${
                            k < pl.doneCount ? 'bg-[#3aa66b]' : 'bg-slate-200'
                          }`}
                        />
                      ))}
                      <span className="ml-0.5 text-[10px] font-semibold text-slate-400 tabular-nums">
                        {pl.doneCount}/4
                      </span>
                    </div>
                  </div>
                </div>

                {bubble && (
                  <div className="anim-msg-pop pointer-events-none absolute left-full top-1/2 z-20 ml-2.5 -translate-y-1/2 whitespace-nowrap rounded-xl border border-slate-200 bg-white/95 px-2.5 py-1 text-xs font-bold text-slate-800 shadow-lg">
                    {bubble}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Bottom-center focal point: Turn Owner + Action/Event Pills side-by-side above Dice Pod */}
        <div className="pointer-events-auto absolute bottom-3 md:bottom-4 left-1/2 -translate-x-1/2 flex max-w-[calc(100vw-20px)] flex-col items-center gap-1.5">
          {gmOpen && (
            <div className="anim-card-pop mb-0.5 flex items-center justify-center gap-1.5 rounded-2xl border border-emerald-400/40 bg-slate-900/92 px-3 py-1.5 text-xs text-white shadow-2xl backdrop-blur-md">
              <span className="rounded-md bg-emerald-500/20 px-1.5 py-0.5 font-mono text-[11px] font-bold text-emerald-300 border border-emerald-400/30">
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
                className="ml-0.5 flex h-6 w-6 items-center justify-center rounded-lg bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white cursor-pointer"
                title="关闭 GM 面板"
              >
                ✕
              </button>
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

          <div className="flex max-w-full items-center justify-center gap-1.5 md:gap-2">
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
              className="flex h-9 md:h-10 min-w-0 items-center gap-1.5 md:gap-2 rounded-2xl bg-white/95 px-3 md:px-4 text-[12px] md:text-[14px] font-bold text-slate-800 transition-colors"
              style={{
                border: `2px solid ${cur.uiColor}`,
                boxShadow: '0 6px 20px rgba(0,0,0,0.14)',
              }}
            >
              <span className="truncate text-[12px] md:text-[14px] font-bold text-slate-700">
                {topPrompt}
              </span>
            </div>
          </div>

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
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={onActionPod}
                title="点击掷骰子"
                key={`die-${snap.hudDiePopKey}`}
                className={`grid h-12 w-12 md:h-[52px] md:w-[52px] shrink-0 grid-cols-3 grid-rows-3 gap-1 rounded-[13px] border-2 border-[#d5c7b0] bg-gradient-to-b from-[#fffdf9] to-[#f3ebdc] p-1.5 shadow-[inset_0_-3px_0_#dfd2bc,0_3px_8px_rgba(0,0,0,0.12)] transition-transform hover:scale-105 cursor-pointer ${
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

              <div
                onClick={handleSecretTap}
                className="min-w-[56px] text-xs leading-snug text-slate-600 tabular-nums select-none cursor-default"
              >
                <b className="flex items-center gap-1 text-[15px] text-slate-900">
                  <span>{snap.die !== null ? `点数 ${snap.die}` : '点数 -'}</span>
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
          </div>
        </div>

        {/* Top-Right Camera View Switcher + Global Mute Switch */}
        <div
          className="pointer-events-auto absolute right-2.5 top-2.5 md:right-3.5 md:top-3.5 flex items-center gap-1 rounded-xl bg-white/95 p-1 shadow-[0_6px_18px_rgba(30,40,55,0.14)] backdrop-blur-sm"
          role="group"
          aria-label="视角与音效"
        >
          {(
            [
              ['follow', '跟随'],
              ['top', '俯视'],
              ['free', '自由'],
            ] as [CameraMode, string][]
          ).map(([mode, label]) => (
            <button
              key={mode}
              type="button"
              onClick={() => onSetCamMode(mode)}
              title="切换视角（快捷键 V）"
              className={`rounded-lg px-2.5 md:px-3 py-1.5 text-[11px] md:text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                snap.camMode === mode
                  ? 'bg-[#2c9a60] text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              {label}
            </button>
          ))}
          <span className="mx-0.5 h-4 w-px bg-slate-200" aria-hidden="true" />
          <button
            type="button"
            onClick={onResetView}
            title="回正视角（快捷键 R）"
            className="rounded-lg px-2 py-1.5 text-[11px] md:text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 whitespace-nowrap shrink-0 cursor-pointer"
          >
            回正
          </button>
          <span className="mx-0.5 h-4 w-px bg-slate-200" aria-hidden="true" />
          <button
            type="button"
            onClick={onToggleMute}
            title={muted ? '开启全局音效' : '关闭全局音效'}
            aria-label={muted ? '开启音效' : '静音'}
            className={`rounded-lg px-2 py-1.5 text-[11px] md:text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              muted
                ? 'bg-rose-50 text-rose-600 hover:bg-rose-100'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            {muted ? '🔇 静音' : '🔊 音效'}
          </button>
        </div>

        {/* Left Vertical Control Bar */}
        <div className="pointer-events-auto absolute bottom-[132px] md:bottom-3.5 left-2.5 md:left-3.5 flex w-[90px] md:w-[102px] flex-col items-stretch gap-1.5">
          {!dockCollapsed && (
            <div className="flex flex-col items-stretch gap-1.5">
              <button
                type="button"
                onClick={() => setRulesOpen((v) => !v)}
                className={`w-full rounded-xl px-2.5 py-2 text-[11px] md:text-xs font-semibold shadow whitespace-nowrap shrink-0 cursor-pointer ${
                  rulesOpen
                    ? 'bg-[#2c9a60] text-white'
                    : 'bg-white/95 text-slate-700 hover:bg-white'
                }`}
              >
                玩法规则
              </button>
              <button
                type="button"
                onClick={onReturnSetup}
                className="w-full rounded-xl bg-white/95 px-2.5 py-2 text-[11px] md:text-xs font-semibold text-slate-700 shadow hover:bg-white whitespace-nowrap shrink-0 cursor-pointer"
              >
                返回设置
              </button>
              <button
                type="button"
                onClick={onTogglePause}
                className="w-full rounded-xl bg-white/95 px-2.5 py-2 text-[11px] md:text-xs font-semibold text-slate-700 shadow hover:bg-white whitespace-nowrap shrink-0 cursor-pointer"
              >
                {snap.paused ? '▶ 继续' : '⏸ 暂停'}
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={() => setDockCollapsed((v) => !v)}
            className="w-full rounded-xl bg-white/95 px-2.5 py-1.5 text-[11px] font-semibold text-slate-600 shadow hover:text-slate-900 whitespace-nowrap shrink-0 cursor-pointer"
          >
            {dockCollapsed ? '▴ 展开控制' : '▾ 收起控制'}
          </button>
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
                        点时，可选择让停机坪棋子登上 <b className="text-slate-900">START 起点台</b>，或移动场上已有棋子。
                      </span>
                    </li>
                    <li className="flex gap-2.5">
                      <span className="shrink-0 font-semibold text-slate-800">仅 6 奖连掷</span>
                      <span>
                        只有掷出 <b className="text-slate-900">6</b> 点才可再掷一次（连续三个 6
                        后第三次只走子不再投）；棋子抵达终点不额外奖励掷骰。
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
                        <b className="text-slate-900">12 格</b>，并击落航线穿过的对家终点前第 4
                        格敌机（直飞后仍可顺风连跳）。
                      </span>
                    </li>
                    <li className="flex gap-2.5">
                      <span className="shrink-0 font-semibold text-slate-800">撞机与回弹</span>
                      <span>
                        落点有敌方棋子时将其全部撞回停机坪；己方同格叠机同行；点数超出终点格会向后回弹。
                      </span>
                    </li>
                  </ul>
                </section>

                <section className="border-t border-slate-100 pt-4">
                  <h4 className="mb-2.5 text-xs font-bold tracking-wide text-emerald-700">
                    03. 快捷操控与视角
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
      </div>
    </>
  );
};
