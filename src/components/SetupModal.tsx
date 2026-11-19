import React from 'react';
import { CHARS, CHAR_KEYS, CharKey, toColorHex } from '../game/constants';
import { CharacterAvatar } from './CharacterAvatar';

interface SetupModalProps {
  open: boolean;
  localChars: CharKey[];
  canResume: boolean;
  hasChanges: boolean;
  onChangeLocalChars: (next: CharKey[]) => void;
  onResume: () => void;
  onStart: () => void;
}

export const SetupModal: React.FC<SetupModalProps> = ({
  open,
  localChars,
  canResume,
  hasChanges,
  onChangeLocalChars,
  onResume,
  onStart,
}) => {
  if (!open) return null;

  const localCount = localChars.length;
  const needMatch = 4 - localCount;

  const cycleChar = (idx: number, dir: number) => {
    const cur = localChars[idx];
    const opts = CHAR_KEYS.filter(
      (k) => k === cur || !localChars.some((c, i) => i !== idx && c === k),
    );
    const nextChar = opts[(opts.indexOf(cur) + dir + opts.length) % opts.length];
    onChangeLocalChars(localChars.map((c, i) => (i === idx ? nextChar : c)));
  };

  const addLocalPlayer = () => {
    if (localCount >= 4) return;
    const free = CHAR_KEYS.find((k) => !localChars.includes(k));
    if (!free) return;
    onChangeLocalChars([...localChars, free]);
  };

  const removeLocalPlayer = (idx: number) => {
    if (localCount <= 1) return;
    onChangeLocalChars(localChars.filter((_, i) => i !== idx));
  };

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-[2px]">
      <div className="anim-card-pop w-full max-w-[430px] max-h-[92vh] overflow-y-auto rounded-[22px] bg-white px-6 py-6 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-[22px] font-bold text-slate-900">一二布布 · 3D 古城飞行棋</h2>
            <p className="mt-1 text-[13px] text-slate-500">
              {canResume
                ? '可继续当前对局，或调整本地玩家重新匹配开局'
                : '添加 1–4 名本地玩家并选择角色，空余席位将在线匹配补齐'}
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

        <div className="mt-4 space-y-2.5">
          {localChars.map((charKey, idx) => {
            const C = CHARS[charKey];
            return (
              <div
                key={idx}
                className="flex items-center gap-2 rounded-[14px] bg-[#F5F7FA] px-3 py-2.5"
              >
                <span
                  className="shrink-0 rounded-lg px-2 py-1 text-xs font-bold text-white whitespace-nowrap"
                  style={{ backgroundColor: C.uiColor }}
                >
                  玩家{idx + 1}
                </span>

                <button
                  type="button"
                  onClick={() => cycleChar(idx, -1)}
                  aria-label="上一个角色"
                  className="ml-1 h-7 w-7 shrink-0 rounded-[9px] border border-slate-200 bg-white text-[11px] text-slate-600 transition-colors hover:border-[#3aa66b] hover:text-[#3aa66b] cursor-pointer"
                >
                  ◀
                </button>

                <div className="flex flex-1 items-center justify-center gap-2 min-w-0">
                  <CharacterAvatar charKey={charKey} size={30} />
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span
                      className="inline-block h-2.5 w-2.5 shrink-0 rounded-full border border-black/20"
                      style={{ backgroundColor: toColorHex(C.color) }}
                    />
                    <b className="truncate text-[14px] text-slate-800">{C.name}</b>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => cycleChar(idx, 1)}
                  aria-label="下一个角色"
                  className="h-7 w-7 shrink-0 rounded-[9px] border border-slate-200 bg-white text-[11px] text-slate-600 transition-colors hover:border-[#3aa66b] hover:text-[#3aa66b] cursor-pointer"
                >
                  ▶
                </button>

                {localCount > 1 && (
                  <button
                    type="button"
                    onClick={() => removeLocalPlayer(idx)}
                    aria-label={`移除玩家${idx + 1}`}
                    className="ml-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-[9px] border border-slate-200 bg-white text-xs text-slate-400 transition-colors hover:border-rose-300 hover:bg-rose-50 hover:text-rose-500 cursor-pointer"
                  >
                    ✕
                  </button>
                )}
              </div>
            );
          })}

          {localCount < 4 && (
            <button
              type="button"
              onClick={addLocalPlayer}
              className="flex w-full items-center justify-center gap-1.5 rounded-[14px] border-2 border-dashed border-slate-200 bg-slate-50/70 py-2.5 text-[13px] font-semibold text-slate-600 transition-colors hover:border-[#3aa66b] hover:bg-emerald-50/40 hover:text-[#2c9a60] cursor-pointer"
            >
              <span className="text-base leading-none">＋</span>
              <span>添加本地玩家（{localCount}/4）</span>
            </button>
          )}
        </div>

        {canResume ? (
          <div className="mt-5 flex items-center gap-2.5">
            <button
              type="button"
              onClick={onResume}
              className="flex-1 rounded-[14px] bg-gradient-to-b from-[#42b878] to-[#2c9a60] py-3 text-[15px] font-bold text-white shadow-[0_4px_0_#1f7a49] transition-transform active:translate-y-0.5 whitespace-nowrap cursor-pointer"
            >
              继续当前对局
            </button>
            <button
              type="button"
              onClick={onStart}
              className="flex-1 rounded-[14px] border border-slate-200 bg-slate-50 py-3 text-[14px] font-bold text-slate-700 transition-colors hover:bg-slate-100 whitespace-nowrap cursor-pointer"
            >
              {hasChanges
                ? needMatch > 0
                  ? '重新匹配'
                  : '应用并重开'
                : needMatch > 0
                  ? '重新匹配'
                  : '重新开局'}
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={onStart}
            className="mt-5 w-full rounded-[14px] bg-gradient-to-b from-[#42b878] to-[#2c9a60] py-3 text-base font-bold text-white shadow-[0_4px_0_#1f7a49] transition-transform active:translate-y-0.5 cursor-pointer"
          >
            {needMatch > 0
              ? `开始匹配（自动补齐 ${needMatch} 位对手）`
              : '开始游戏（4 位本地玩家）'}
          </button>
        )}

        <p className="mt-3.5 text-center text-[11px] leading-relaxed text-slate-400">
          经典7格边棋盘 · 空格快捷掷骰 · 数字键1~4快捷选子 · 1:1 摇摇车手办
        </p>
      </div>
    </div>
  );
};
