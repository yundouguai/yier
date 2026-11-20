/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { GameHUD } from './components/GameHUD';
import { MatchmakingState, Overlays } from './components/Overlays';
import { SetupModal } from './components/SetupModal';
import { FlightChessEngine } from './game/FlightChessEngine';
import { isAudioMuted, toggleAudioMuted } from './game/audio';
import {
  AI_PERSONALITY_ORDER,
  AiPersonality,
  CHARS,
  CHAR_KEYS,
  CharKey,
  DEFAULT_SEATS,
  GameHudSnapshot,
  SeatConfig,
} from './game/constants';

function parseUrlSeats(): { seats: SeatConfig[]; hasParam: boolean } {
  const raw = new URLSearchParams(window.location.search).get('p');
  if (!raw) return { seats: DEFAULT_SEATS.map((s) => ({ ...s })), hasParam: false };
  const list = raw
    .split(',')
    .map((item) => {
      const [k, t] = item.split('.');
      if (k in CHARS) {
        return {
          on: true,
          char: k as CharKey,
          type: (t === 'a' ? 'ai' : 'human') as 'ai' | 'human',
        };
      }
      return null;
    })
    .filter((v): v is SeatConfig => v !== null);

  if (list.length >= 2 && list.length <= 4) {
    return { seats: list, hasParam: true };
  }
  return { seats: DEFAULT_SEATS.map((s) => ({ ...s })), hasParam: false };
}

const INITIAL_SNAPSHOT: GameHudSnapshot = {
  phase: 'idle',
  turn: 0,
  die: null,
  twinDice: null,
  hudDieFace: 6,
  hudDieRolling: false,
  hudDiePopKey: 0,
  sixChain: 0,
  movableCount: 0,
  paused: false,
  camMode: 'follow',
  secondsLeft: null,
  message: null,
  messageColor: null,
  messageKey: 0,
  splashText: null,
  splashAvatar: '🐼',
  splashCharKey: 'yier',
  splashColor: '#3aa66b',
  splashVisible: false,
  shakeKey: 0,
  winnerPid: null,
  rankings: [],
  gmDie: null,
  turnUsedAtkDef: false,
  armedSixDie: false,
  armedTwinDice: false,
  armedRefuel: false,
  pendingItemTarget: null,
  targetChoices: [],
  shopOffer: null,
  shopSecondsLeft: null,
  shopPid: null,
  latestEmote: null,
  giftQuestEvent: null,
  players: [],
};

function pickRandomOpponents(localChars: CharKey[]): CharKey[] {
  const pool = CHAR_KEYS.filter((k) => !localChars.includes(k));
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, Math.max(0, 4 - localChars.length));
}

function pickRandomPersonalities(count: number): AiPersonality[] {
  if (count <= 0) return [];
  const others = AI_PERSONALITY_ORDER.filter((p) => p !== 'tactician');
  for (let i = others.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [others[i], others[j]] = [others[j], others[i]];
  }
  const picked: AiPersonality[] = ['tactician', ...others.slice(0, count - 1)];
  for (let i = picked.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [picked[i], picked[j]] = [picked[j], picked[i]];
  }
  return picked;
}

export default function App() {
  const initialParsed = useRef(parseUrlSeats());
  const initialLocalChars: CharKey[] = initialParsed.current.hasParam
    ? initialParsed.current.seats.filter((s) => s.on && s.type === 'human').map((s) => s.char)
    : ['yier'];

  const mountRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<FlightChessEngine | null>(null);
  const matchTimersRef = useRef<number[]>([]);
  const transitionWaitRef = useRef(false);

  const [activeSeats, setActiveSeats] = useState<SeatConfig[]>(initialParsed.current.seats);
  const [activeLocalChars, setActiveLocalChars] = useState<CharKey[]>(
    initialLocalChars.length > 0 ? initialLocalChars : ['yier'],
  );
  const [draftLocalChars, setDraftLocalChars] = useState<CharKey[]>(
    initialLocalChars.length > 0 ? initialLocalChars : ['yier'],
  );
  const [showSetup, setShowSetup] = useState(!initialParsed.current.hasParam);
  const [matchmaking, setMatchmaking] = useState<MatchmakingState | null>(null);
  const [sessionId, setSessionId] = useState(0);
  const [autoStart, setAutoStart] = useState(initialParsed.current.hasParam);
  const [snap, setSnap] = useState<GameHudSnapshot>(INITIAL_SNAPSHOT);
  const [contextLost, setContextLost] = useState(false);
  const [muted, setMuted] = useState(isAudioMuted);
  const [allHumansPrompt, setAllHumansPrompt] = useState(false);
  const [allHumansDismissed, setAllHumansDismissed] = useState(false);

  const clearMatchTimers = useCallback(() => {
    matchTimersRef.current.forEach((id) => window.clearTimeout(id));
    matchTimersRef.current = [];
  }, []);

  useEffect(() => {
    return () => clearMatchTimers();
  }, [clearMatchTimers]);

  const canResume = snap.phase !== 'idle' && snap.winnerPid === null && !matchmaking;
  const hasSeatChanges = JSON.stringify(draftLocalChars) !== JSON.stringify(activeLocalChars);

  // Mount & manage WebGL engine lifecycle cleanly
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const engine = new FlightChessEngine(
      container,
      activeSeats,
      autoStart,
      (nextSnap) => setSnap(nextSnap),
      (lost) => setContextLost(lost),
      () => {
        if (!transitionWaitRef.current) return;
        transitionWaitRef.current = false;
        const revealTid = window.setTimeout(() => {
          setMatchmaking((prev) => (prev ? { ...prev, closing: true } : null));
          engineRef.current?.startMatch();
          const doneTid = window.setTimeout(() => {
            setMatchmaking(null);
          }, 360);
          matchTimersRef.current.push(doneTid);
        }, 120);
        matchTimersRef.current.push(revealTid);
      },
    );
    engineRef.current = engine;

    return () => {
      engine.dispose();
      engineRef.current = null;
    };
    // Re-create engine only when starting a new game session
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  const launchMatchWithSeats = useCallback(
    (
      locals: CharKey[],
      opps: CharKey[],
      viaMatchmaking: boolean,
      oppPersonalities?: AiPersonality[],
    ) => {
      clearMatchTimers();
      setAllHumansPrompt(false);
      setAllHumansDismissed(false);
      const personalities = oppPersonalities ?? pickRandomPersonalities(opps.length);
      const nextSeats: SeatConfig[] = [
        ...locals.map((char) => ({ on: true, char, type: 'human' as const })),
        ...opps.map((char, idx) => ({
          on: true,
          char,
          type: 'ai' as const,
          personality: personalities[idx],
        })),
      ];
      setActiveLocalChars([...locals]);
      setActiveSeats(nextSeats);
      setShowSetup(false);
      setSnap((prev) => ({ ...prev, paused: false }));

      if (viaMatchmaking) {
        setAutoStart(false);
        transitionWaitRef.current = true;
        // 保持匹配弹窗不关闭，直到后台新场景加载并渲染完首帧后再自然淡出
        const buildTid = window.setTimeout(() => {
          setSessionId((id) => id + 1);
        }, 30);
        matchTimersRef.current.push(buildTid);
      } else {
        transitionWaitRef.current = false;
        setMatchmaking(null);
        setAutoStart(true);
        setSessionId((id) => id + 1);
      }
    },
    [clearMatchTimers],
  );

  const handleStartGame = useCallback(() => {
    if (draftLocalChars.length < 1 || draftLocalChars.length > 4) return;
    clearMatchTimers();
    engineRef.current?.setPaused(false);
    setSnap((prev) => ({ ...prev, paused: false }));

    if (draftLocalChars.length === 4) {
      launchMatchWithSeats(draftLocalChars, [], false);
      return;
    }

    const matchedChars = pickRandomOpponents(draftLocalChars);
    const matchedPersonalities = pickRandomPersonalities(matchedChars.length);
    const needCount = matchedChars.length;

    // 首位对手正常匹配（1.0s~1.9s），后续对手更快补齐（每位 0.26s~0.48s）
    let elapsedMs = 1000 + Math.floor(Math.random() * 900);
    const stepDelays: number[] = [];
    for (let k = 1; k <= needCount; k++) {
      if (k > 1) {
        elapsedMs += 260 + Math.floor(Math.random() * 220);
      }
      stepDelays.push(elapsedMs);
    }
    const totalWaitMs = elapsedMs + 320;

    setShowSetup(false);
    setMatchmaking({
      localChars: [...draftLocalChars],
      matchedChars,
      matchedPersonalities,
      joinedCount: 0,
      launching: false,
      closing: false,
    });

    stepDelays.forEach((stepDelay, idx) => {
      const k = idx + 1;
      const tid = window.setTimeout(() => {
        setMatchmaking((prev) => (prev ? { ...prev, joinedCount: k } : null));
      }, stepDelay);
      matchTimersRef.current.push(tid);
    });

    const doneTid = window.setTimeout(() => {
      setMatchmaking((prev) =>
        prev ? { ...prev, joinedCount: needCount, launching: true } : null,
      );
      launchMatchWithSeats(draftLocalChars, matchedChars, true, matchedPersonalities);
    }, totalWaitMs);
    matchTimersRef.current.push(doneTid);
  }, [clearMatchTimers, draftLocalChars, launchMatchWithSeats]);

  const handleCancelMatchmaking = useCallback(() => {
    clearMatchTimers();
    transitionWaitRef.current = false;
    setMatchmaking(null);
    setShowSetup(true);
  }, [clearMatchTimers]);

  const handleReturnSetup = useCallback(() => {
    if (snap.phase !== 'idle' && snap.winnerPid === null) {
      setDraftLocalChars([...activeLocalChars]);
      engineRef.current?.setPaused(true);
      setShowSetup(true);
    } else {
      clearMatchTimers();
      transitionWaitRef.current = false;
      setMatchmaking(null);
      setShowSetup(true);
      setAutoStart(false);
      setSessionId((id) => id + 1);
    }
  }, [activeLocalChars, clearMatchTimers, snap.phase, snap.winnerPid]);

  const handleResumeFromSetup = useCallback(() => {
    setDraftLocalChars([...activeLocalChars]);
    setShowSetup(false);
    engineRef.current?.setPaused(false);
  }, [activeLocalChars]);

  const handlePlayAgain = useCallback(() => {
    clearMatchTimers();
    transitionWaitRef.current = false;
    setAllHumansPrompt(false);
    setAllHumansDismissed(false);
    setDraftLocalChars([...activeLocalChars]);
    setMatchmaking(null);
    setShowSetup(true);
    setAutoStart(false);
    setSnap((prev) => ({ ...prev, paused: false, winnerPid: null, phase: 'idle' }));
    setSessionId((id) => id + 1);
  }, [activeLocalChars, clearMatchTimers]);

  const handleToggleMute = useCallback(() => {
    setMuted(toggleAudioMuted());
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return;
      if (e.key === 'v' || e.key === 'V') {
        engineRef.current?.cycleCamMode();
        return;
      }
      if (e.key === 'r' || e.key === 'R') {
        engineRef.current?.resetView();
        return;
      }
      if (showSetup || matchmaking !== null) return;
      if (e.key === 'p' || e.key === 'P') {
        engineRef.current?.togglePause();
        return;
      }
      if (snap.paused || snap.winnerPid !== null) return;

      if (e.key === 'Escape' && snap.pendingItemTarget !== null) {
        engineRef.current?.cancelItemTarget();
        return;
      }

      if (e.code === 'Space' || e.code === 'Enter') {
        e.preventDefault();
        engineRef.current?.triggerActionPod();
      } else if (
        snap.phase === 'awaitMove' &&
        ['1', '2', '3', '4'].includes(e.key)
      ) {
        engineRef.current?.pickMovableIndex(Number(e.key) - 1);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [showSetup, matchmaking, snap.paused, snap.winnerPid, snap.phase, snap.pendingItemTarget]);

  const humanPlayers = snap.players.filter((p) => p.type === 'human');
  const allHumansFinished =
    humanPlayers.length > 0 && humanPlayers.every((p) => p.doneCount === 4);

  const isPlaying = snap.phase !== 'over' && snap.phase !== 'idle';

  useEffect(() => {
    if (
      !allHumansFinished ||
      allHumansDismissed ||
      !isPlaying ||
      showSetup ||
      matchmaking !== null
    ) {
      return;
    }
    const tid = window.setTimeout(() => {
      setAllHumansPrompt(true);
    }, 6000);
    return () => window.clearTimeout(tid);
  }, [allHumansFinished, allHumansDismissed, isPlaying, showSetup, matchmaking]);

  const winner =
    snap.winnerPid !== null ? (snap.players[snap.winnerPid] ?? null) : null;

  const wrapperRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = wrapperRef.current;
    if (!el || snap.shakeKey === 0) return;
    el.classList.remove('anim-shake');
    void el.offsetWidth;
    el.classList.add('anim-shake');
  }, [snap.shakeKey]);

  const hideHud = showSetup || (matchmaking !== null && !matchmaking.closing);

  return (
    <div
      ref={wrapperRef}
      className="relative h-screen w-screen overflow-hidden bg-[#dbe8df]"
    >
      {/* Dedicated WebGL canvas mount outside React HUD re-renders */}
      <div ref={mountRef} className="fixed inset-0" />

      {!hideHud && (
        <GameHUD
          snap={snap}
          showSetup={showSetup}
          muted={muted}
          onToggleMute={handleToggleMute}
          onSetGmDie={(val) => engineRef.current?.setGmDie(val)}
          onActionPod={() => engineRef.current?.triggerActionPod()}
          onUseItem={(item) => engineRef.current?.useItem(item)}
          onPickItemTarget={(pid, idx) => engineRef.current?.pickItemTarget(pid, idx)}
          onCancelItemTarget={() => engineRef.current?.cancelItemTarget()}
          onPickShopItem={(item) => engineRef.current?.pickShopItem(item)}
          onSetCamMode={(mode) => engineRef.current?.setCamMode(mode)}
          onResetView={() => engineRef.current?.resetView()}
          onReturnSetup={handleReturnSetup}
          onTogglePause={() => engineRef.current?.togglePause()}
          onHumanEmote={(pid) => engineRef.current?.reactToHumanEmote(pid)}
        />
      )}

      <SetupModal
        open={showSetup}
        localChars={draftLocalChars}
        canResume={canResume}
        hasChanges={hasSeatChanges}
        onChangeLocalChars={setDraftLocalChars}
        onResume={handleResumeFromSetup}
        onStart={handleStartGame}
      />

      <Overlays
        paused={snap.paused && !showSetup && matchmaking === null}
        winner={winner}
        players={snap.players}
        rankings={snap.rankings}
        contextLost={contextLost}
        matchmaking={matchmaking}
        allHumansFinishedPrompt={allHumansPrompt}
        onCancelMatchmaking={handleCancelMatchmaking}
        onResume={() => engineRef.current?.togglePause()}
        onPlayAgain={handlePlayAgain}
        onReturnSetup={handleReturnSetup}
        onSpectate={() => {
          setAllHumansPrompt(false);
          setAllHumansDismissed(true);
        }}
      />
    </div>
  );
}
