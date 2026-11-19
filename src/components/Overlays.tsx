import React from 'react';
import { CHARS, CharKey, HudPlayerSnapshot } from '../game/constants';
import { CharacterAvatar } from './CharacterAvatar';

export interface MatchmakingState {
  localChars: CharKey[];
  matchedChars: CharKey[];
  joinedCount: number;
}

interface OverlaysProps {
  paused: boolean;
  winner: HudPlayerSnapshot | null;
  contextLost: boolean;
  matchmaking: MatchmakingState | null;
  onCancelMatchmaking: () => void;
  onResume: () => void;
  onPlayAgain: () => void;
  onReturnSetup: () => void;
}

export const Overlays: React.FC<OverlaysProps> = ({
  paused,
  winner,
  contextLost,
  matchmaking,
  onCancelMatchmaking,
  onResume,
  onPlayAgain,
  onReturnSetup,
}) => {
  return (
    <>
      {matchmaking && (
        <div className="fixed inset-0 z-35 flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm">
          <div className="anim-card-pop w-full max-w-[400px] rounded-[24px] bg-white px-6 py-7 text-center shadow-2xl">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-2xl">
              <span className="inline-block animate-spin">🌐</span>
            </div>
            <h2 className="mt-3 text-xl font-bold text-slate-900">正在在线匹配对手…</h2>
            <p className="mt-1 text-xs text-slate-500">
              已就位 {Math.min(4, matchmaking.localChars.length + matchmaking.joinedCount)}/4 位玩家，即将进入古城棋盘
            </p>

            <div className="mt-5 grid grid-cols-4 gap-2">
              {Array.from({ length: 4 }, (_, i) => {
                const isLocal = i < matchmaking.localChars.length;
                const oppIdx = i - matchmaking.localChars.length;
                const joined = isLocal || oppIdx < matchmaking.joinedCount;
                const charKey = isLocal
                  ? matchmaking.localChars[i]
                  : joined
                    ? matchmaking.matchedChars[oppIdx]
                    : null;
                const label = isLocal ? `玩家${i + 1}` : `对手${oppIdx + 1}`;
                const C = charKey ? CHARS[charKey] : null;

                return (
                  <div
                    key={i}
                    className={`flex flex-col items-center rounded-2xl border px-2 py-3 transition-all duration-300 ${
                      joined
                        ? 'border-emerald-200 bg-emerald-50/50 scale-100 opacity-100'
                        : 'border-dashed border-slate-200 bg-slate-50 scale-95 opacity-60'
                    }`}
                  >
                    {charKey ? (
                      <CharacterAvatar charKey={charKey} size={42} />
                    ) : (
                      <div className="flex h-[42px] w-[42px] items-center justify-center rounded-full bg-slate-200/80 text-sm font-bold text-slate-400 animate-pulse">
                        ?
                      </div>
                    )}
                    <span
                      className="mt-2 rounded px-1.5 py-0.5 text-[10px] font-bold text-white"
                      style={{
                        backgroundColor: C ? C.uiColor : '#94a3b8',
                      }}
                    >
                      {label}
                    </span>
                    <span className="mt-1 truncate max-w-full text-[11px] font-semibold text-slate-700">
                      {C ? C.name : '匹配中…'}
                    </span>
                  </div>
                );
              })}
            </div>

            <button
              type="button"
              onClick={onCancelMatchmaking}
              className="mt-5 rounded-xl border border-slate-200 bg-slate-50 px-5 py-2 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-100 cursor-pointer"
            >
              取消匹配
            </button>
          </div>
        </div>
      )}

      {paused && !matchmaking && (
        <div className="fixed inset-0 z-25 flex items-center justify-center bg-slate-950/55 p-4">
          <div className="anim-card-pop rounded-[24px] bg-white px-12 py-10 text-center shadow-2xl">
            <div className="text-[52px]">⏸️</div>
            <h2 className="mt-2.5 mb-5 text-2xl font-bold text-slate-900">已暂停</h2>
            <button
              type="button"
              onClick={onResume}
              className="rounded-[14px] bg-gradient-to-b from-[#42b878] to-[#2c9a60] px-8 py-3 text-base font-bold text-white shadow-[0_4px_0_#1f7a49] cursor-pointer"
            >
              继续游戏
            </button>
          </div>
        </div>
      )}

      {winner && !matchmaking && (
        <div className="fixed inset-0 z-25 flex items-center justify-center bg-slate-950/50 p-4">
          <div className="anim-card-pop rounded-[24px] bg-white px-10 py-10 text-center shadow-2xl">
            <div className="flex items-center justify-center gap-2">
              <CharacterAvatar charKey={winner.charKey} size={64} />
              <span className="text-[44px]">🏆</span>
            </div>
            <h2 className="mt-3 mb-1 text-[26px] font-bold text-slate-900">
              {winner.name} 获胜！
            </h2>
            <p className="mb-5 text-sm text-slate-500">
              率先完成 4 架飞机，赢得比赛！
            </p>
            <div className="flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={onPlayAgain}
                className="rounded-[14px] bg-gradient-to-b from-[#42b878] to-[#2c9a60] px-7 py-3 text-base font-bold text-white shadow-[0_4px_0_#1f7a49] cursor-pointer"
              >
                再来一局
              </button>
              <button
                type="button"
                onClick={onReturnSetup}
                className="rounded-[14px] border border-slate-200 bg-slate-50 px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                修改阵容
              </button>
            </div>
          </div>
        </div>
      )}

      {contextLost && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/65 p-4">
          <div className="rounded-2xl bg-white px-8 py-6 text-center shadow-2xl">
            <h3 className="text-lg font-bold text-slate-900">3D 渲染上下文暂时中断</h3>
            <p className="mt-1 text-sm text-slate-500">
              正在尝试恢复图形上下文，如果未自动恢复可刷新页面。
            </p>
          </div>
        </div>
      )}
    </>
  );
};
