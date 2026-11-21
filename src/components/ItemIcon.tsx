import React from 'react';
import { ItemType } from '../game/constants';

interface ItemIconProps {
  item: ItemType;
  size?: number;
  className?: string;
}

export const ItemIcon: React.FC<ItemIconProps> = ({
  item,
  size = 20,
  className = '',
}) => {
  switch (item) {
    case 'sixDie':
      // 幸运草莓蛋糕
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 32 32"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className={`shrink-0 ${className}`}
          aria-hidden="true"
        >
          {/* 蛋糕底座 */}
          <rect
            x="5"
            y="14"
            width="22"
            height="13"
            rx="4.5"
            fill="#fff1f2"
            stroke="#5c3a28"
            strokeWidth="2"
          />
          {/* 粉色奶油波浪 */}
          <path
            d="M5 17.5c2 2 4.5 2 6.5 0 2 2 4.5 2 6.5 0 2 2 4.5 2 6.5 0 1 1 2 1.2 2.5.8V16a3 3 0 0 0-3-3H8a3 3 0 0 0-3 3v1.5z"
            fill="#fda4af"
            stroke="#5c3a28"
            strokeWidth="1.8"
            strokeLinejoin="round"
          />
          {/* 蛋糕夹心层 */}
          <line x1="6.5" y1="22.5" x2="25.5" y2="22.5" stroke="#fb7185" strokeWidth="2" strokeLinecap="round" />
          {/* 顶部大草莓 */}
          <path
            d="M16 5.5c2.8 0 4.6 2.1 4.1 4.8-.5 2.4-2.4 3.9-4.1 3.9s-3.6-1.5-4.1-3.9c-.5-2.7 1.3-4.8 4.1-4.8z"
            fill="#f43f5e"
            stroke="#5c3a28"
            strokeWidth="1.8"
          />
          {/* 草莓叶子 */}
          <path
            d="M13.2 6.2c1-.9 2-.9 2.8-.1.8-.8 1.8-.8 2.8.1"
            stroke="#22c55e"
            strokeWidth="2.1"
            strokeLinecap="round"
          />
          <circle cx="14.7" cy="9.4" r="0.7" fill="#ffe4e6" />
          <circle cx="17.2" cy="10.2" r="0.7" fill="#ffe4e6" />
        </svg>
      );

    case 'twinDice':
      // 双倍珍珠奶茶
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 32 32"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className={`shrink-0 ${className}`}
          aria-hidden="true"
        >
          {/* 左杯吸管 */}
          <path d="M9.5 4.5l1.5 5.5" stroke="#ec4899" strokeWidth="2.4" strokeLinecap="round" />
          {/* 左杯身 */}
          <path
            d="M5 11.5h11l-1.4 14.5a2 2 0 0 1-2 1.8H8.4a2 2 0 0 1-2-1.8L5 11.5z"
            fill="#fde68a"
            stroke="#5c3a28"
            strokeWidth="1.9"
            strokeLinejoin="round"
          />
          <ellipse cx="10.5" cy="11.5" rx="5.8" ry="1.9" fill="#fbcfe8" stroke="#5c3a28" strokeWidth="1.7" />
          <circle cx="8.8" cy="24.5" r="1.15" fill="#5c3a28" />
          <circle cx="11.8" cy="25" r="1.15" fill="#5c3a28" />

          {/* 右杯吸管 */}
          <path d="M23 4.5l-1.4 5.5" stroke="#14b8a6" strokeWidth="2.4" strokeLinecap="round" />
          {/* 右杯身 */}
          <path
            d="M16 12h11l-1.4 14a2 2 0 0 1-2 1.8h-4.2a2 2 0 0 1-2-1.8L16 12z"
            fill="#fed7aa"
            stroke="#5c3a28"
            strokeWidth="1.9"
            strokeLinejoin="round"
          />
          <ellipse cx="21.5" cy="12" rx="5.8" ry="1.9" fill="#bae6fd" stroke="#5c3a28" strokeWidth="1.7" />
          <circle cx="19.8" cy="24.6" r="1.15" fill="#5c3a28" />
          <circle cx="22.8" cy="24.2" r="1.15" fill="#5c3a28" />
        </svg>
      );

    case 'refuel':
      // 再来一口小饼干
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 32 32"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className={`shrink-0 ${className}`}
          aria-hidden="true"
        >
          <path
            d="M16 4.5c6.3 0 11.5 5.2 11.5 11.5S22.3 27.5 16 27.5 4.5 22.3 4.5 16c0-4.2 2.2-7.8 5.6-9.8.6 1.5 2.1 2.4 3.7 2.1.6-1.4 1.3-2.9 2.2-3.8z"
            fill="#f6c478"
            stroke="#5c3a28"
            strokeWidth="2.1"
            strokeLinejoin="round"
          />
          <circle cx="11.5" cy="14" r="1.7" fill="#6b3f24" />
          <circle cx="19.5" cy="12.5" r="1.6" fill="#6b3f24" />
          <circle cx="15.5" cy="19.5" r="1.8" fill="#6b3f24" />
          <circle cx="21.5" cy="19.5" r="1.4" fill="#6b3f24" />
          <circle cx="10.5" cy="21" r="1.3" fill="#6b3f24" />
          {/* 俏皮小爱心点缀 */}
          <path
            d="M25.5 6.5c.8-.9 2.2-.2 1.8 1-.4 1.1-1.8 1.9-1.8 1.9s-1.4-.8-1.8-1.9c-.4-1.2 1-1.9 1.8-1z"
            fill="#fb7185"
          />
        </svg>
      );

    case 'shield':
      // 软绵绵泡泡罩
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 32 32"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className={`shrink-0 ${className}`}
          aria-hidden="true"
        >
          <circle
            cx="16"
            cy="16"
            r="11.5"
            fill="#e0f2fe"
            fillOpacity="0.85"
            stroke="#3b9ae1"
            strokeWidth="2.2"
          />
          {/* 彩虹梦幻弧边 */}
          <path
            d="M7.8 11.2A10 10 0 0 1 20.5 7"
            stroke="#f472b6"
            strokeWidth="2"
            strokeLinecap="round"
            opacity="0.75"
          />
          <path
            d="M24.2 20.8A10 10 0 0 1 11.5 25"
            stroke="#a78bfa"
            strokeWidth="2"
            strokeLinecap="round"
            opacity="0.75"
          />
          {/* 泡泡高光 */}
          <ellipse cx="11.5" cy="11.2" rx="2.6" ry="1.5" transform="rotate(-35 11.5 11.2)" fill="#ffffff" />
          <circle cx="9.2" cy="14.8" r="1" fill="#ffffff" />
          {/* 小副泡泡 */}
          <circle cx="26.5" cy="7.5" r="2.2" fill="#e0f2fe" stroke="#60a5fa" strokeWidth="1.4" />
        </svg>
      );

    case 'missile':
      // 奶油派炸弹
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 32 32"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className={`shrink-0 ${className}`}
          aria-hidden="true"
        >
          {/* 锡纸派托盘 */}
          <path
            d="M4.5 20.5h23l-2.4 5a2.5 2.5 0 0 1-2.2 1.4H9.1a2.5 2.5 0 0 1-2.2-1.4l-2.4-5z"
            fill="#cbd5e1"
            stroke="#5c3a28"
            strokeWidth="2"
            strokeLinejoin="round"
          />
          {/* 蓬松大奶油 */}
          <path
            d="M6 20.5c-.6-2.5 1.3-4.6 3.8-4.5.3-2.6 2.7-4.5 6.2-4.5s5.9 1.9 6.2 4.5c2.5-.1 4.4 2 3.8 4.5H6z"
            fill="#fffbeb"
            stroke="#5c3a28"
            strokeWidth="2"
            strokeLinejoin="round"
          />
          {/* 顶部樱桃 */}
          <circle cx="16" cy="9.5" r="3" fill="#ef4444" stroke="#5c3a28" strokeWidth="1.8" />
          <path d="M16.5 6.8c.8-1.5 2.2-2.2 3.5-2" stroke="#5c3a28" strokeWidth="1.6" strokeLinecap="round" />
          <circle cx="15" cy="8.7" r="0.8" fill="#fecaca" />
        </svg>
      );
  }
};
