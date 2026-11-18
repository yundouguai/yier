import React from 'react';
import {
  CHARS,
  CHAR_KEYS,
  SEAT_NAMES,
  SeatConfig,
  toColorHex,
} from '../game/constants';

interface SetupModalProps {
  open: boolean;
  seats: SeatConfig[];
  canResume: boolean;
  hasChanges: boolean;
  onChangeSeats: (next: SeatConfig[]) => void;
  onResume: () => void;
  onStart: () => void;
}

export const SetupModal: React.FC<SetupModalProps> = ({
  open,
  seats,
  canResume,
  hasChanges,
  onChangeSeats,
  onResume,
  onStart,
}) => {
  if (!open) return null;

  const activeCount = seats.filter((s) => s.on).length;

  const toggleSeat = (j: number, checked: boolean) => {
    const next = seats.map((s, idx) => (idx === j ? { ...s, on: checked } : { ...s }));
    const taken = new Set(
      next.filter((q, idx) => q.on && idx !== j).map((q) => q.char),
    );
    if (taken.has(next[j].char)) {
      const free = CHAR_KEYS.filter((k) => !taken.has(k));
      if (free.length) next[j].char = free[0];
    }
    onChangeSeats(next);
  };

  const cycleChar = (j: number, dir: number) => {
    const s = seats[j];
    const opts = CHAR_KEYS.filter(
      (k) => k === s.char || !seats.some((q, i) => q.on && i !== j && q.char === k),
    );
    const nextChar = opts[(opts.indexOf(s.char) + dir + opts.length) % opts.length];
    onChangeSeats(seats.map((item, idx) => (idx === j ? { ...item, char: nextChar } : item)));
  };

  const toggleType = (j: number) => {
    onChangeSeats(
      seats.map((item, idx) =>
        idx === j ? { ...item, type: item.type === 'ai' ? 'human' : 'ai' } : item,
      ),
    );
  };

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-slate-950/45 p-4">
      <div className="anim-card-pop w-full max-w-[430px] max-h-[92vh] overflow-y-auto rounded-[22px] bg-white px-6 py-6 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-[22px] font-bold text-slate-900">一二布布 · 3D 古城飞行棋</h2>
            <p className="mt-1 text-[13px] text-slate-500">
              {canResume
                ? '对局已暂停 · 可继续当前进度或修改阵容重新开局'
                : '选择 2–4 位玩家，挑选角色与操控方式'}
            </p>
          </div>
          {canResume && (
            <button
              type="button"
              onClick={onResume}
              aria-label="关闭并返回对局"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-sm text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800 cursor-pointer"
            >
              ✕
            </button>
          )}
        </div>

        <div className="mt-4 space-y-2">
          {seats.map((s, j) => {
            const C = CHARS[s.char];
            const humanIdx = seats
              .slice(0, j + 1)
              .filter((q) => q.on && q.type === 'human').length;
            const typeLabel =
              s.type === 'ai' ? '🤖 AI' : s.on ? `🧑 玩家${humanIdx}` : '🧑 玩家';
            return (
              <div
                key={j}
                className={`flex items-center gap-2 rounded-[14px] bg-[#F5F7FA] px-3 py-2.5 transition-opacity ${
                  s.on ? 'opacity-100' : 'opacity-45'
                }`}
              >
                <label className="flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={s.on}
                    onChange={(e) => toggleSeat(j, e.target.checked)}
                    className="h-4 w-4 cursor-pointer accent-[#2c9a60]"
                  />
                </label>

                <span className="w-7 text-xs text-slate-500 whitespace-nowrap">
                  {SEAT_NAMES[j]}
                </span>

                <button
                  type="button"
                  onClick={() => cycleChar(j, -1)}
                  aria-label="上一个角色"
                  className="h-7 w-7 rounded-[9px] border border-slate-200 bg-white text-[11px] text-slate-600 transition-colors hover:border-[#3aa66b] hover:text-[#3aa66b] cursor-pointer"
                >
                  ◀
                </button>

                <span className="flex min-w-[96px] items-center justify-center gap-1.5">
                  <span
                    className="inline-block h-3.5 w-3.5 shrink-0 rounded-full border border-black/25 shadow-inner"
                    style={{ backgroundColor: toColorHex(C.color) }}
                  />
                  <b className="text-[14px] text-slate-800 whitespace-nowrap">{C.name}</b>
                </span>

                <button
                  type="button"
                  onClick={() => cycleChar(j, 1)}
                  aria-label="下一个角色"
                  className="h-7 w-7 rounded-[9px] border border-slate-200 bg-white text-[11px] text-slate-600 transition-colors hover:border-[#3aa66b] hover:text-[#3aa66b] cursor-pointer"
                >
                  ▶
                </button>

                <button
                  type="button"
                  onClick={() => toggleType(j)}
                  className="ml-auto min-w-[82px] rounded-[9px] border border-slate-200 bg-white px-2.5 py-1.5 text-center text-xs font-medium text-slate-700 whitespace-nowrap transition-colors hover:border-sky-500 cursor-pointer"
                >
                  {typeLabel}
                </button>
              </div>
            );
          })}
        </div>

        {canResume ? (
          <div className="mt-4 flex items-center gap-2.5">
            <button
              type="button"
              onClick={onResume}
              className="flex-1 rounded-[14px] bg-gradient-to-b from-[#42b878] to-[#2c9a60] py-3 text-[15px] font-bold text-white shadow-[0_4px_0_#1f7a49] transition-transform active:translate-y-0.5 whitespace-nowrap cursor-pointer"
            >
              继续当前对局
            </button>
            <button
              type="button"
              disabled={activeCount < 2}
              onClick={onStart}
              className="flex-1 rounded-[14px] border border-slate-200 bg-slate-50 py-3 text-[14px] font-bold text-slate-700 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50 whitespace-nowrap cursor-pointer"
            >
              {activeCount < 2
                ? `至少选 2 人`
                : hasChanges
                  ? '应用并重开'
                  : '重新开局'}
            </button>
          </div>
        ) : (
          <button
            type="button"
            disabled={activeCount < 2}
            onClick={onStart}
            className="mt-4 w-full rounded-[14px] bg-gradient-to-b from-[#42b878] to-[#2c9a60] py-3 text-base font-bold text-white shadow-[0_4px_0_#1f7a49] transition-transform active:translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60 disabled:grayscale disabled:shadow-none cursor-pointer"
          >
            {activeCount < 2
              ? `至少选择 2 位玩家（当前 ${activeCount} 位）`
              : `开始游戏（${activeCount} 位玩家）`}
          </button>
        )}

        <p className="mt-3.5 text-center text-[11px] leading-relaxed text-slate-400">
          经典7格边棋盘 · 空格快捷掷骰 · 数字键1~4快捷选子 · 1:1 摇摇车手办
        </p>
      </div>
    </div>
  );
};
