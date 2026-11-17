import React from 'react';
import { HudPlayerSnapshot } from '../game/constants';

interface OverlaysProps {
  paused: boolean;
  winner: HudPlayerSnapshot | null;
  contextLost: boolean;
  onResume: () => void;
  onPlayAgain: () => void;
  onReturnSetup: () => void;
}

export const Overlays: React.FC<OverlaysProps> = ({
  paused,
  winner,
  contextLost,
  onResume,
  onPlayAgain,
  onReturnSetup,
}) => {
  return (
    <>
      {paused && (
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

      {winner && (
        <div className="fixed inset-0 z-25 flex items-center justify-center bg-slate-950/50 p-4">
          <div className="anim-card-pop rounded-[24px] bg-white px-10 py-10 text-center shadow-2xl">
            <div className="text-[56px]">
              {winner.species === 'panda' ? '🐼' : '🐻'}🏆
            </div>
            <h2 className="mt-2.5 mb-1 text-[26px] font-bold text-slate-900">
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
