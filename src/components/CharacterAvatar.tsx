import React from 'react';
import { CHARS, CharKey, toColorHex } from '../game/constants';

interface CharacterAvatarProps {
  charKey: CharKey;
  size?: number;
  className?: string;
}

export const CharacterAvatar: React.FC<CharacterAvatarProps> = ({
  charKey,
  size = 32,
  className = '',
}) => {
  const C = CHARS[charKey];
  const bodyHex = toColorHex(C.body);
  const earHex = toColorHex(C.ear);
  const blushHex = toColorHex(C.blush);
  const bgHex = toColorHex(C.baseTint);
  const isPanda = C.species === 'panda';

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`shrink-0 ${className}`}
      aria-label={C.name}
    >
      <circle cx="32" cy="32" r="30" fill={bgHex} stroke={C.uiColor} strokeWidth="2.5" />

      {/* Ears */}
      <circle cx="16" cy="19" r="8.5" fill={earHex} stroke="#3b261d" strokeWidth="2.2" />
      <circle cx="48" cy="19" r="8.5" fill={earHex} stroke="#3b261d" strokeWidth="2.2" />
      {!isPanda && (
        <>
          <circle cx="16" cy="19.5" r="4.5" fill="#3b261d" opacity="0.72" />
          <circle cx="48" cy="19.5" r="4.5" fill="#3b261d" opacity="0.72" />
        </>
      )}

      {/* Chubby loaf head */}
      <ellipse
        cx="32"
        cy="35"
        rx="21"
        ry="18"
        fill={bodyHex}
        stroke="#3b261d"
        strokeWidth="2.4"
      />

      {/* Character-specific cute accent */}
      {charKey === 'caomei' && (
        <path
          d="M42 17c2.2-2.5 5.5-.5 4.2 2.4-1.1 2.4-4.2 3.6-4.2 3.6s-3.1-1.2-4.2-3.6C36.5 16.5 39.8 14.5 42 17z"
          fill="#ff6b81"
          stroke="#3b261d"
          strokeWidth="1.4"
        />
      )}
      {charKey === 'xiangyu' && (
        <path
          d="M32 13l1.6 3.2 3.5.5-2.5 2.4.6 3.5-3.2-1.7-3.2 1.7.6-3.5-2.5-2.4 3.5-.5L32 13z"
          fill="#b497f0"
          stroke="#3b261d"
          strokeWidth="1.3"
        />
      )}
      {charKey === 'mocha' && (
        <path
          d="M32 17c0-4 3.5-7 7-6-1 3.5-3.5 5.5-7 6zm0 0c0-3.5-3-6-6-5 1 3 3 4.5 6 5z"
          fill="#7fa845"
          stroke="#3b261d"
          strokeWidth="1.4"
          strokeLinejoin="round"
        />
      )}
      {charKey === 'haiyan' && (
        <circle cx="44" cy="16" r="3.4" fill="#8fd3f4" stroke="#3b261d" strokeWidth="1.3" />
      )}

      {/* Rosy blushes */}
      <ellipse cx="18.5" cy="39" rx="5" ry="3.4" fill={blushHex} opacity="0.88" />
      <ellipse cx="45.5" cy="39" rx="5" ry="3.4" fill={blushHex} opacity="0.88" />

      {/* Eyes */}
      <circle cx="23.5" cy="33.5" r="2.7" fill="#33241c" />
      <circle cx="40.5" cy="33.5" r="2.7" fill="#33241c" />
      <circle cx="22.6" cy="32.5" r="0.9" fill="#ffffff" />
      <circle cx="39.6" cy="32.5" r="0.9" fill="#ffffff" />

      {/* Cute ω mouth */}
      <path
        d="M27.5 36.8c1.1 2.2 3.4 2.2 4.5 0 1.1 2.2 3.4 2.2 4.5 0"
        stroke="#4a2e24"
        strokeWidth="2.1"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
};
