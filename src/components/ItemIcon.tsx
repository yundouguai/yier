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
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 32 32"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className={`shrink-0 ${className}`}
        >
          <rect
            x="3"
            y="3"
            width="26"
            height="26"
            rx="7"
            fill="#fff7ed"
            stroke="#e87a24"
            strokeWidth="2.4"
          />
          <circle cx="10.5" cy="9.5" r="2.1" fill="#e87a24" />
          <circle cx="21.5" cy="9.5" r="2.1" fill="#e87a24" />
          <circle cx="10.5" cy="16" r="2.1" fill="#e87a24" />
          <circle cx="21.5" cy="16" r="2.1" fill="#e87a24" />
          <circle cx="10.5" cy="22.5" r="2.1" fill="#e87a24" />
          <circle cx="21.5" cy="22.5" r="2.1" fill="#e87a24" />
        </svg>
      );

    case 'twinDice':
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 32 32"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className={`shrink-0 ${className}`}
        >
          <rect
            x="2.5"
            y="7.5"
            width="17"
            height="17"
            rx="4.5"
            fill="#fff1f2"
            stroke="#d94862"
            strokeWidth="2.1"
          />
          <circle cx="7.5" cy="12.5" r="1.6" fill="#d94862" />
          <circle cx="14.5" cy="19.5" r="1.6" fill="#d94862" />
          <rect
            x="12.5"
            y="4"
            width="17"
            height="17"
            rx="4.5"
            fill="#ffe4e6"
            stroke="#d94862"
            strokeWidth="2.1"
          />
          <circle cx="17.5" cy="9" r="1.6" fill="#d94862" />
          <circle cx="21" cy="12.5" r="1.6" fill="#d94862" />
          <circle cx="24.5" cy="16" r="1.6" fill="#d94862" />
          <path
            d="M23 26.5l3.5-2.5-1.4 3.8 2.4 1.2-4.5 1z"
            fill="#f59e0b"
          />
        </svg>
      );

    case 'refuel':
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 32 32"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className={`shrink-0 ${className}`}
        >
          {/* Cute airplane fuel pod / green boost tank */}
          <rect
            x="6"
            y="7"
            width="15"
            height="20"
            rx="4.5"
            fill="#dcfce7"
            stroke="#2c9a60"
            strokeWidth="2.2"
          />
          <rect x="9.5" y="10.5" width="8" height="5.5" rx="1.6" fill="#86efac" stroke="#2c9a60" strokeWidth="1.4" />
          <path
            d="M13.5 18.5c1.8 1.9 2.5 3.1 2.5 4.2a2.5 2.5 0 1 1-5 0c0-1.1.7-2.3 2.5-4.2z"
            fill="#2c9a60"
          />
          <path
            d="M21 12.5h3.2a2.2 2.2 0 0 1 2.2 2.2v6.6a2.2 2.2 0 0 1-2.2 2.2H21"
            stroke="#2c9a60"
            strokeWidth="2.2"
            strokeLinecap="round"
          />
          <path
            d="M24.2 8.5l2.5 2.5"
            stroke="#2c9a60"
            strokeWidth="2.2"
            strokeLinecap="round"
          />
        </svg>
      );

    case 'shield':
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 32 32"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className={`shrink-0 ${className}`}
        >
          <path
            d="M16 3.5L26.5 7.5v7.8c0 6.6-4.4 11.7-10.5 13.7C9.9 27 5.5 21.9 5.5 15.3V7.5L16 3.5z"
            fill="#e0f2fe"
            stroke="#2b8bd4"
            strokeWidth="2.3"
            strokeLinejoin="round"
          />
          <path
            d="M16 6.8l7 2.7v5.7c0 4.8-3 8.5-7 10.1V6.8z"
            fill="#bae6fd"
          />
          <path
            d="M16 10.5l1.3 2.7 3 .4-2.2 2.1.5 3-2.6-1.4-2.6 1.4.5-3-2.2-2.1 3-.4 1.3-2.7z"
            fill="#2b8bd4"
          />
        </svg>
      );

    case 'missile':
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 32 32"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className={`shrink-0 ${className}`}
        >
          <path
            d="M24.5 7.5c-5.2.5-9.7 2.8-13.2 6.3l-2.6 2.6 6.9 6.9 2.6-2.6c3.5-3.5 5.8-8 6.3-13.2z"
            fill="#f3e8ff"
            stroke="#8b5cf6"
            strokeWidth="2.2"
            strokeLinejoin="round"
          />
          <path
            d="M24.5 7.5c-1.8.2-3.6.7-5.2 1.5l3.7 3.7c.8-1.6 1.3-3.4 1.5-5.2z"
            fill="#ef4444"
          />
          <circle cx="17.2" cy="14.8" r="2.1" fill="#8b5cf6" />
          <path
            d="M9.8 18.2l-3.8-.5 2.4-2.4M13.8 22.2l.5 3.8 2.4-2.4"
            stroke="#8b5cf6"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M8.5 23.5c-2.2.4-3.8 1.6-4.2 3.8 2.2-.4 3.4-2 3.8-4.2z"
            fill="#f97316"
          />
        </svg>
      );
  }
};
