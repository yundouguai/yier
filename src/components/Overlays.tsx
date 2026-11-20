import React from 'react';
import {
  AiPersonality,
  CHARS,
  CharKey,
  HudPlayerSnapshot,
} from '../game/constants';
import { CharacterAvatar } from './CharacterAvatar';

export interface MatchmakingState {
  localChars: CharKey[];
  matchedChars: CharKey[];
  matchedPersonalities?: AiPersonality[];
  joinedCount: number;
  launching?: boolean;
  closing?: boolean;
}

interface OverlaysProps {
  paused: boolean;
  winner: HudPlayerSnapshot | null;
  players: HudPlayerSnapshot[];
  rankings: number[];
  contextLost: boolean;
  matchmaking: MatchmakingState | null;
  allHumansFinishedPrompt: boolean;
  onCancelMatchmaking: () => void;
  onResume: () => void;
  onPlayAgain: () => void;
  onReturnSetup: () => void;
  onSpectate: () => void;
}

export const Overlays: React.FC<OverlaysProps> = ({
  paused,
  winner,
  players,
  rankings,
  contextLost,
  matchmaking,
  allHumansFinishedPrompt,
  onCancelMatchmaking,
  onResume,
  onPlayAgain,
  onReturnSetup,
  onSpectate,
}) => {
  const getRoleLabel = (idx: number) => {
    const p = players[idx];
    if (!p) return '';
    if (p.type === 'human') {
      const hNum = players.slice(0, idx + 1).filter((x) => x.type === 'human').length;
      return `玩家${hNum}`;
    }
    const oNum = players.slice(0, idx + 1).filter((x) => x.type === 'ai').length;
    return `对手${oNum}`;
  };

  const isLaunching = Boolean(matchmaking?.launching);
  const isClosing = Boolean(matchmaking?.closing);

  return (
    <>
      {matchmaking && (
        <div
          className={`fixed inset-0 z-35 flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm transition-opacity duration-300 ease-out ${
            isClosing ? 'opacity-0 pointer-events-none' : 'opacity-100'
          }`}
        >
          <div
            className={`anim-card-pop w-full max-w-[400px] rounded-[24px] bg-white px-6 py-7 text-center shadow-2xl transition-all duration-300 ease-out ${
              isClosing ? 'scale-95 opacity-0' : 'scale-100 opacity-100'
            }`}
          >
            <div
              className={`mx-auto flex h-12 w-12 items-center justify-center rounded-2xl text-2xl transition-colors duration-300 ${
                isLaunching ? 'bg-emerald-100' : 'bg-emerald-50'
              }`}
            >
              {isLaunching ? (
                <span>✨</span>
              ) : (
                <span className="inline-block animate-spin">🌐</span>
              )}
            </div>
            <h2 className="mt-3 text-xl font-bold text-slate-900">
              {isLaunching ? '匹配完成，正在加载棋盘…' : '正在在线匹配对手…'}
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              {isLaunching
                ? '4 位玩家已就位，场景加载完成后自动进入'
                : `已就位 ${Math.min(4, matchmaking.localChars.length + matchmaking.joinedCount)}/4 位玩家，即将进入古城棋盘`}
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

            {isLaunching ? (
              <div className="mt-5 flex items-center justify-center gap-2 py-2 text-xs font-semibold text-emerald-700">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-ping" />
                <span>棋盘加载中，请稍候…</span>
              </div>
            ) : (
              <button
                type="button"
                onClick={onCancelMatchmaking}
                className="mt-5 rounded-xl border border-slate-200 bg-slate-50 px-5 py-2 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-100 cursor-pointer"
              >
                取消匹配
              </button>
            )}
          </div>
        </div>
      )}

      {paused && !matchmaking && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="已暂停"
          className="fixed inset-0 z-25 flex items-center justify-center bg-slate-950/55 p-4"
        >
          <div className="anim-card-pop w-[90vw] max-w-[340px] rounded-[24px] bg-white px-8 py-8 text-center shadow-2xl">
            <div className="text-[48px]">⏸️</div>
            <h2 className="mt-2 mb-4 text-2xl font-bold text-slate-900">已暂停</h2>
            <div className="flex flex-col gap-2.5">
              <button
                type="button"
                onClick={onResume}
                className="w-full rounded-[14px] bg-gradient-to-b from-[#42b878] to-[#2c9a60] px-8 py-3 text-base font-bold text-white shadow-[0_4px_0_#1f7a49] cursor-pointer"
              >
                继续游戏
              </button>
              <button
                type="button"
                onClick={onReturnSetup}
                className="w-full rounded-[14px] border border-slate-200 bg-slate-50 px-6 py-2.5 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-100 cursor-pointer"
              >
                返回设置 / 重新开局
              </button>
            </div>
          </div>
        </div>
      )}

      {allHumansFinishedPrompt && !winner && !matchmaking && (
        <div className="fixed inset-0 z-25 flex items-center justify-center bg-slate-950/45 p-4">
          <div className="anim-card-pop w-full max-w-[380px] rounded-[24px] bg-white px-7 py-7 text-center shadow-2xl">
            <div className="text-[46px]">🎉</div>
            <h2 className="mt-2 text-[22px] font-bold text-slate-900">玩家已全部完赛</h2>
            <p className="mt-1.5 text-sm text-slate-500">
              当前对局仍在继续，你可以选择立即重开一局或继续观战。
            </p>
            <div className="mt-6 flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={onPlayAgain}
                className="flex-1 rounded-[14px] bg-gradient-to-b from-[#42b878] to-[#2c9a60] px-5 py-2.5 text-sm font-bold text-white shadow-[0_4px_0_#1f7a49] cursor-pointer"
              >
                立即重开一局
              </button>
              <button
                type="button"
                onClick={onSpectate}
                className="flex-1 rounded-[14px] border border-slate-200 bg-slate-50 px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                继续观战
              </button>
            </div>
          </div>
        </div>
      )}

      {winner && !matchmaking && (
        <div className="fixed inset-0 z-25 flex items-center justify-center bg-slate-950/50 p-4">
          <div className="anim-card-pop w-full max-w-[420px] rounded-[24px] bg-white px-7 py-8 text-center shadow-2xl">
            <div className="flex items-center justify-center gap-2">
              <CharacterAvatar charKey={winner.charKey} size={58} />
              <span className="text-[40px]">🏆</span>
            </div>
            <h2 className="mt-2.5 mb-1 text-[24px] font-bold text-slate-900">
              {winner.name} 夺冠！
            </h2>
            <p className="mb-4 text-xs text-slate-500">
              本局完整排名榜单
            </p>

            <div className="mb-5 space-y-2 text-left">
              {rankings.map((pid, rankIdx) => {
                const pl = players[pid];
                if (!pl) return null;
                const medal =
                  rankIdx === 0
                    ? '🥇'
                    : rankIdx === 1
                      ? '🥈'
                      : rankIdx === 2
                        ? '🥉'
                        : '4';
                return (
                  <div
                    key={pid}
                    className={`flex items-center gap-2.5 rounded-xl border px-3 py-2 ${
                      rankIdx === 0
                        ? 'border-amber-200 bg-amber-50/70'
                        : 'border-slate-100 bg-slate-50/70'
                    }`}
                  >
                    <span className="w-6 text-center text-base font-extrabold text-slate-600">
                      {medal}
                    </span>
                    <CharacterAvatar charKey={pl.charKey} size={30} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <b className="truncate text-sm text-slate-800">{pl.name}</b>
                        <span
                          className="rounded px-1.5 py-0.5 text-[10px] font-bold text-white"
                          style={{ backgroundColor: pl.uiColor }}
                        >
                          {getRoleLabel(pid)}
                        </span>
                      </div>
                    </div>
                    <span className="text-xs font-bold text-slate-500 tabular-nums">
                      {pl.doneCount === 4 ? '已完赛' : `${pl.doneCount}/4`}
                    </span>
                  </div>
                );
              })}
            </div>

            <div className="flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={onPlayAgain}
                className="flex-1 rounded-[14px] bg-gradient-to-b from-[#42b878] to-[#2c9a60] px-6 py-3 text-base font-bold text-white shadow-[0_4px_0_#1f7a49] cursor-pointer"
              >
                再来一局
              </button>
              <button
                type="button"
                onClick={onReturnSetup}
                className="flex-1 rounded-[14px] border border-slate-200 bg-slate-50 px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-100 cursor-pointer"
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
