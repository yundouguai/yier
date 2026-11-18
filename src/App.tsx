/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { GameHUD } from './components/GameHUD';
import { Overlays } from './components/Overlays';
import { SetupModal } from './components/SetupModal';
import { FlightChessEngine } from './game/FlightChessEngine';
import {
  CHARS,
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
  splashColor: '#3aa66b',
  splashVisible: false,
  shakeKey: 0,
  winnerPid: null,
  players: [],
};

export default function App() {
  const initialParsed = useRef(parseUrlSeats());
  const mountRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<FlightChessEngine | null>(null);

  const [seats, setSeats] = useState<SeatConfig[]>(initialParsed.current.seats);
  const [showSetup, setShowSetup] = useState(!initialParsed.current.hasParam);
  const [sessionId, setSessionId] = useState(0);
  const [autoStart, setAutoStart] = useState(initialParsed.current.hasParam);
  const [snap, setSnap] = useState<GameHudSnapshot>(INITIAL_SNAPSHOT);
  const [contextLost, setContextLost] = useState(false);

  // Mount & manage WebGL engine lifecycle cleanly
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const engine = new FlightChessEngine(
      container,
      seats,
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

  const handleStartGame = useCallback(() => {
    const active = seats.filter((s) => s.on);
    if (active.length < 2) return;
    setShowSetup(false);
    setAutoStart(true);
    setSessionId((id) => id + 1);
  }, [seats]);

  const handleReturnSetup = useCallback(() => {
    setShowSetup(true);
    setAutoStart(false);
    setSessionId((id) => id + 1);
  }, []);

  const handlePlayAgain = useCallback(() => {
    setShowSetup(false);
    setAutoStart(true);
    setSessionId((id) => id + 1);
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return;
      if (e.key === 'p' || e.key === 'P') {
        engineRef.current?.togglePause();
        return;
      }
      if (e.key === 'v' || e.key === 'V') {
        engineRef.current?.cycleCamMode();
        return;
      }
      if (e.key === 'r' || e.key === 'R') {
        engineRef.current?.resetView();
        return;
      }
      if (showSetup || snap.paused || snap.winnerPid !== null) return;

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
  }, [showSetup, snap.paused, snap.winnerPid, snap.phase]);

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

  return (
    <div
      ref={wrapperRef}
      className="relative h-screen w-screen overflow-hidden bg-[#e6d6bc]"
    >
      {/* Dedicated WebGL canvas mount outside React HUD re-renders */}
      <div ref={mountRef} className="fixed inset-0" />

      {!showSetup && (
        <GameHUD
          snap={snap}
          showSetup={showSetup}
          onActionPod={() => engineRef.current?.triggerActionPod()}
          onSetCamMode={(mode) => engineRef.current?.setCamMode(mode)}
          onReturnSetup={handleReturnSetup}
          onTogglePause={() => engineRef.current?.togglePause()}
        />
      )}

      <SetupModal
        open={showSetup}
        seats={seats}
        onChangeSeats={setSeats}
        onStart={handleStartGame}
      />

      <Overlays
        paused={snap.paused}
        winner={winner}
        contextLost={contextLost}
        onResume={() => engineRef.current?.togglePause()}
        onPlayAgain={handlePlayAgain}
        onReturnSetup={handleReturnSetup}
      />
    </div>
  );
}
