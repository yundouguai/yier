import React, { useEffect, useState } from 'react';
import {
  CHARS,
  CHAR_KEYS,
  CHAR_TALENTS,
  CharKey,
  MAP_ORDER,
  MAPS,
  MapId,
  toColorHex,
} from '../game/constants';
import { CharacterAvatar } from './CharacterAvatar';

interface SetupModalProps {
  open: boolean;
  localChars: CharKey[];
  canResume: boolean;
  hasChanges: boolean;
  selectedMapId: MapId;
  onChangeLocalChars: (next: CharKey[]) => void;
  onChangeMapId: (mapId: MapId) => void;
  onResume: () => void;
  onStart: () => void;
}

export const SetupModal: React.FC<SetupModalProps> = ({
  open,
  localChars,
  canResume,
  hasChanges,
  selectedMapId,
  onChangeLocalChars,
  onChangeMapId,
  onResume,
  onStart,
}) => {
  const [activeIdx, setActiveIdx] = useState(0);

  useEffect(() => {
    if (activeIdx >= localChars.length) {
      setActiveIdx(Math.max(0, localChars.length - 1));
    }
  }, [localChars.length, activeIdx]);

  useEffect(() => {
    if (!open || !canResume) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onResume();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, canResume, onResume]);

  if (!open) return null;

  const localCount = localChars.length;
  const needMatch = 4 - localCount;
  const safeIdx = Math.min(activeIdx, localCount - 1);
  const activeCharKey = localChars[safeIdx] ?? localChars[0];
  const activeChar = CHARS[activeCharKey];
  const activeTalent = CHAR_TALENTS[activeCharKey];

  const selectCharForActive = (targetKey: CharKey) => {
    const ownerIdx = localChars.indexOf(targetKey);
    if (ownerIdx === safeIdx) return;
    if (ownerIdx >= 0) {
      // 点击已被其他本地玩家选中的角色时，直接与对方互换，操作更顺手
      const next = [...localChars];
      next[ownerIdx] = activeCharKey;
      next[safeIdx] = targetKey;
      onChangeLocalChars(next);
    } else {
      onChangeLocalChars(localChars.map((c, i) => (i === safeIdx ? targetKey : c)));
    }
  };

  const addLocalPlayer = () => {
    if (localCount >= 4) return;
    const free = CHAR_KEYS.find((k) => !localChars.includes(k));
    if (!free) return;
    const next = [...localChars, free];
    onChangeLocalChars(next);
    setActiveIdx(next.length - 1);
  };

  const removeLocalPlayer = (idx: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (localCount <= 1) return;
    const next = localChars.filter((_, i) => i !== idx);
    onChangeLocalChars(next);
    if (safeIdx >= next.length) setActiveIdx(next.length - 1);
    else if (idx < safeIdx) setActiveIdx(safeIdx - 1);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="熊熊村 · 飞行棋大作战设置"
      onClick={() => {
        if (canResume) onResume();
      }}
      className="fixed inset-0 z-30 flex items-center justify-center bg-slate-950/48 p-3 sm:p-4 backdrop-blur-[3px]"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="anim-card-pop w-full max-w-[740px] max-h-[94dvh] overflow-y-auto rounded-[24px] bg-white/97 px-5 py-5 sm:px-6 sm:py-6 shadow-2xl border border-white/80"
      >
        {/* 顶部标题栏 */}
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-[20px] sm:text-[22px] font-extrabold text-slate-900">
              熊熊村 · 选择出战小熊与天赋
            </h2>
            <p className="mt-0.5 text-xs sm:text-[13px] text-slate-500">
              {canResume
                ? '可继续当前对局，或调整本地玩家与角色重新匹配开局'
                : '支持 1–4 名本地玩家同屏选角，空余席位将自动在线匹配补齐'}
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

        {/* 1~4 号本地玩家席位切换条 */}
        <div className="mt-4">
          <div className="mb-1.5 flex items-center justify-between text-[11px] font-bold text-slate-500">
            <span>本地玩家席位（点击席位切换选角）</span>
            <span className="text-slate-400">
              本地 {localCount} 人{needMatch > 0 ? ` · 匹配 ${needMatch} 名对手` : ' · 满员同屏'}
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {localChars.map((charKey, idx) => {
              const C = CHARS[charKey];
              const T = CHAR_TALENTS[charKey];
              const isSelected = idx === safeIdx;
              return (
                <div
                  key={idx}
                  role="button"
                  tabIndex={0}
                  onClick={() => setActiveIdx(idx)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setActiveIdx(idx);
                    }
                  }}
                  className={`relative flex items-center gap-2 rounded-2xl border-2 px-2.5 py-2 text-left transition-all cursor-pointer ${
                    isSelected
                      ? 'border-[#2c9a60] bg-emerald-50/75 shadow-sm'
                      : 'border-slate-200 bg-slate-50/80 hover:border-slate-300 hover:bg-slate-100/70'
                  }`}
                >
                  <CharacterAvatar charKey={charKey} size={32} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1">
                      <span
                        className="rounded px-1.5 py-0.2 text-[10px] font-extrabold text-white"
                        style={{ backgroundColor: C.uiColor }}
                      >
                        玩家{idx + 1}
                      </span>
                      {isSelected && (
                        <span className="text-[10px] font-bold text-emerald-700">选角中</span>
                      )}
                    </div>
                    <div className="mt-0.5 truncate text-xs font-extrabold text-slate-800">
                      {C.name}
                    </div>
                    <div className="truncate text-[10px] font-semibold text-slate-500">
                      {T.name}
                    </div>
                  </div>
                  {localCount > 1 && (
                    <button
                      type="button"
                      onClick={(e) => removeLocalPlayer(idx, e)}
                      aria-label={`移除玩家${idx + 1}`}
                      title={`移除玩家${idx + 1}`}
                      className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/90 text-[10px] text-slate-400 border border-slate-200 transition-colors hover:border-rose-300 hover:bg-rose-50 hover:text-rose-500 cursor-pointer"
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
                className="flex flex-col items-center justify-center gap-0.5 rounded-2xl border-2 border-dashed border-emerald-300/80 bg-emerald-50/35 px-2.5 py-2 text-center text-emerald-700 transition-colors hover:border-[#2c9a60] hover:bg-emerald-50 cursor-pointer"
              >
                <span className="text-base font-extrabold leading-none">＋</span>
                <span className="text-[11px] font-bold">添加本地玩家</span>
                <span className="text-[10px] text-emerald-600/80">（{localCount}/4）</span>
              </button>
            )}

            {Array.from({ length: Math.max(0, 3 - localCount) }, (_, emptyIdx) => (
              <div
                key={`ai-slot-${emptyIdx}`}
                className="hidden sm:flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/45 px-2.5 py-2 text-center text-slate-400"
              >
                <span className="text-xs font-semibold">自动匹配对手</span>
                <span className="text-[10px] text-slate-400/80">开局随机角色</span>
              </div>
            ))}
          </div>
        </div>

        {/* 主选角区：左侧选中角色天赋详情 + 右侧 2x3 角色格阵 */}
        <div className="mt-4 grid grid-cols-1 md:grid-cols-12 gap-3.5 items-stretch">
          {/* 左侧：当前席位角色预览与天赋详情 */}
          <div className="md:col-span-5 flex flex-col justify-between rounded-[20px] border border-slate-200/90 bg-gradient-to-b from-slate-50/90 to-white p-4">
            <div className="flex items-center justify-between">
              <span
                className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-extrabold text-white"
                style={{ backgroundColor: activeChar.uiColor }}
              >
                正在为 玩家{safeIdx + 1} 选角
              </span>
              <span
                className="inline-block h-3 w-3 rounded-full border border-black/15"
                style={{ backgroundColor: toColorHex(activeChar.color) }}
                title="阵营颜色"
              />
            </div>

            <div className="my-3 flex flex-col items-center text-center">
              <div className="relative flex items-center justify-center rounded-full bg-white p-2 shadow-sm ring-1 ring-slate-200/80">
                <CharacterAvatar charKey={activeCharKey} size={72} />
              </div>
              <div className="mt-2.5 text-lg font-extrabold text-slate-900">{activeChar.name}</div>
            </div>

            <div
              className="rounded-2xl border px-3.5 py-3 text-left"
              style={{
                backgroundColor: activeTalent.accentBg,
                borderColor: activeTalent.accentBorder,
              }}
            >
              <div className="flex items-center justify-between gap-2">
                <span
                  className="text-xs font-extrabold"
                  style={{ color: activeTalent.accentText }}
                >
                  ✨ 天赋：{activeTalent.name}
                </span>
                <span
                  className="rounded-full bg-white/80 px-2 py-0.5 text-[10px] font-bold"
                  style={{ color: activeTalent.accentText }}
                >
                  {activeTalent.shortTag}
                </span>
              </div>
              <p className="mt-1.5 text-xs leading-relaxed font-medium text-slate-700">
                {activeTalent.desc}
              </p>
            </div>
          </div>

          {/* 右侧：6 位角色 2x3 网格 */}
          <div className="md:col-span-7 grid grid-cols-3 gap-2.5">
            {CHAR_KEYS.map((key) => {
              const C = CHARS[key];
              const T = CHAR_TALENTS[key];
              const ownerIdx = localChars.indexOf(key);
              const isMine = ownerIdx === safeIdx;
              const isOtherLocal = ownerIdx >= 0 && ownerIdx !== safeIdx;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => selectCharForActive(key)}
                  className={`relative flex flex-col items-center justify-center rounded-[18px] border-2 px-2 py-3 text-center transition-all cursor-pointer ${
                    isMine
                      ? 'border-[#2c9a60] bg-emerald-50/70 shadow-sm scale-[1.01]'
                      : isOtherLocal
                        ? 'border-slate-300 bg-slate-100/75 hover:border-slate-400'
                        : 'border-slate-200 bg-white hover:border-[#3aa66b]/70 hover:bg-emerald-50/25'
                  }`}
                >
                  {ownerIdx >= 0 && (
                    <span
                      className="absolute right-1.5 top-1.5 rounded-full px-1.5 py-0.5 text-[9px] font-extrabold text-white shadow-xs"
                      style={{
                        backgroundColor: isMine ? '#2c9a60' : C.uiColor,
                      }}
                    >
                      {isMine ? `✓ 玩家${ownerIdx + 1}` : `玩家${ownerIdx + 1}`}
                    </span>
                  )}

                  <div className={isOtherLocal ? 'opacity-80' : ''}>
                    <CharacterAvatar charKey={key} size={44} />
                  </div>

                  <div className="mt-1.5 flex items-center justify-center gap-1 max-w-full">
                    <span
                      className="inline-block h-2 w-2 shrink-0 rounded-full border border-black/15"
                      style={{ backgroundColor: toColorHex(C.color) }}
                    />
                    <span className="truncate text-xs font-extrabold text-slate-800">{C.name}</span>
                  </div>

                  <span
                    className="mt-1.5 inline-block max-w-full truncate rounded-full border px-2 py-0.5 text-[10px] font-bold"
                    style={{
                      backgroundColor: T.accentBg,
                      color: T.accentText,
                      borderColor: T.accentBorder,
                    }}
                  >
                    {T.name}
                  </span>

                  {isOtherLocal && (
                    <span className="mt-1 text-[9px] font-medium text-slate-400">点击互换</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* 底部地图选择与开局按钮 */}
        <div className="mt-4 pt-3.5 border-t border-slate-100 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="sm:w-[235px] shrink-0">
            {MAP_ORDER.map((id) => {
              const cfg = MAPS[id];
              const active = selectedMapId === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => onChangeMapId(id)}
                  className={`flex w-full items-center justify-between gap-2 rounded-[14px] border-2 px-3 py-2 text-left transition-all cursor-pointer ${
                    active
                      ? 'border-[#2c9a60] bg-emerald-50/70'
                      : 'border-slate-200 bg-slate-50/70 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white text-base shadow-xs">
                      {cfg.icon}
                    </span>
                    <div className="min-w-0">
                      <div className="truncate text-xs font-extrabold text-slate-800">{cfg.name}</div>
                      <div className="truncate text-[10px] font-medium text-slate-500">{cfg.subtitle}</div>
                    </div>
                  </div>
                  {active && (
                    <span className="shrink-0 rounded-full bg-[#2c9a60] px-2 py-0.5 text-[10px] font-extrabold text-white">
                      ✓
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <div className="flex-1">
            {canResume ? (
              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={onResume}
                  className="flex-1 rounded-[14px] bg-gradient-to-b from-[#42b878] to-[#2c9a60] py-3 text-sm sm:text-[15px] font-bold text-white shadow-[0_4px_0_#1f7a49] transition-transform active:translate-y-0.5 whitespace-nowrap cursor-pointer"
                >
                  继续当前对局
                </button>
                <button
                  type="button"
                  onClick={onStart}
                  className="flex-1 rounded-[14px] border border-slate-200 bg-slate-50 py-3 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-100 whitespace-nowrap cursor-pointer"
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
                className="w-full rounded-[14px] bg-gradient-to-b from-[#42b878] to-[#2c9a60] py-3 text-sm sm:text-base font-bold text-white shadow-[0_4px_0_#1f7a49] transition-transform active:translate-y-0.5 cursor-pointer"
              >
                {needMatch > 0
                  ? `开始匹配（自动补齐 ${needMatch} 位对手）`
                  : '开始游戏（4 位本地玩家）'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
