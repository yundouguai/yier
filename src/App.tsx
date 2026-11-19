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
  gmDie: null,
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

export default function App() {
  const initialParsed = useRef(parseUrlSeats());
  const initialLocalChars: CharKey[] = initialParsed.current.hasParam
    ? initialParsed.current.seats.filter((s) => s.on && s.type === 'human').map((s) => s.char)
    : ['yier'];

  const mountRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<FlightChessEngine | null>(null);
  const matchTimersRef = useRef<number[]>([]);

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
    );
    engineRef.current = engine;

    return () => {
      engine.dispose();
      engineRef.current = null;
    };
    // Re-create engine only when starting a new game session
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  const launchMatchWithSeats = useCallback((locals: CharKey[], opps: CharKey[]) => {
    const nextSeats: SeatConfig[] = [
      ...locals.map((char) => ({ on: true, char, type: 'human' as const })),
      ...opps.map((char) => ({ on: true, char, type: 'ai' as const })),
    ];
    setActiveLocalChars([...locals]);
    setActiveSeats(nextSeats);
    setShowSetup(false);
    setMatchmaking(null);
    setAutoStart(true);
    setSnap((prev) => ({ ...prev, paused: false }));
    setSessionId((id) => id + 1);
  }, []);

  const handleStartGame = useCallback(() => {
    if (draftLocalChars.length < 1 || draftLocalChars.length > 4) return;
    clearMatchTimers();
    engineRef.current?.setPaused(false);
    setSnap((prev) => ({ ...prev, paused: false }));

    if (draftLocalChars.length === 4) {
      launchMatchWithSeats(draftLocalChars, []);
      return;
    }

    const matchedChars = pickRandomOpponents(draftLocalChars);
    const needCount = matchedChars.length;
    const totalWaitMs = 2200 + Math.floor(Math.random() * 2600); // 2.2s ~ 4.8s

    setShowSetup(false);
    setMatchmaking({
      localChars: [...draftLocalChars],
      matchedChars,
      joinedCount: 0,
    });

    for (let k = 1; k <= needCount; k++) {
      const stepDelay = Math.floor((totalWaitMs * k) / (needCount + 0.5));
      const tid = window.setTimeout(() => {
        setMatchmaking((prev) => (prev ? { ...prev, joinedCount: k } : null));
      }, stepDelay);
      matchTimersRef.current.push(tid);
    }

    const doneTid = window.setTimeout(() => {
      launchMatchWithSeats(draftLocalChars, matchedChars);
    }, totalWaitMs);
    matchTimersRef.current.push(doneTid);
  }, [clearMatchTimers, draftLocalChars, launchMatchWithSeats]);

  const handleCancelMatchmaking = useCallback(() => {
    clearMatchTimers();
    setMatchmaking(null);
    setShowSetup(true);
  }, [clearMatchTimers]);

  const handleReturnSetup = useCallback(() => {
    if (snap.phase !== 'idle' && snap.winnerPid === null) {
      setDraftLocalChars([...activeLocalChars]);
      engineRef.current?.setPaused(true);
      setShowSetup(true);
    } else {
      setShowSetup(true);
      setAutoStart(false);
      setSessionId((id) => id + 1);
    }
  }, [activeLocalChars, snap.phase, snap.winnerPid]);

  const handleResumeFromSetup = useCallback(() => {
    setDraftLocalChars([...activeLocalChars]);
    setShowSetup(false);
    engineRef.current?.setPaused(false);
  }, [activeLocalChars]);

  const handlePlayAgain = useCallback(() => {
    setShowSetup(false);
    setMatchmaking(null);
    setAutoStart(true);
    setSnap((prev) => ({ ...prev, paused: false }));
    setSessionId((id) => id + 1);
  }, []);

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
  }, [showSetup, matchmaking, snap.paused, snap.winnerPid, snap.phase]);

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

  const hideHud = showSetup || matchmaking !== null;

  return (
    <div
      ref={wrapperRef}
      className="relative h-screen w-screen overflow-hidden bg-[#e6d6bc]"
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
          onSetCamMode={(mode) => engineRef.current?.setCamMode(mode)}
          onResetView={() => engineRef.current?.resetView()}
          onReturnSetup={handleReturnSetup}
          onTogglePause={() => engineRef.current?.togglePause()}
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
        contextLost={contextLost}
        matchmaking={matchmaking}
        onCancelMatchmaking={handleCancelMatchmaking}
        onResume={() => engineRef.current?.togglePause()}
        onPlayAgain={handlePlayAgain}
        onReturnSetup={handleReturnSetup}
      />
    </div>
  );
}
