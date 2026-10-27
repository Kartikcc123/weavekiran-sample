import React from 'react';

/**
 * WeaveKiran logo emblem matching the reference image:
 * Indian tricolor circular lotus / chakra emblem with saffron, navy, and green elements.
 */
export default function WeaveKiranLogo({ size = 48, className = "" }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <defs>
        <radialGradient id="wkChakraGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#1E3A8A" stopOpacity="0.15" />
          <stop offset="100%" stopColor="#1E3A8A" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="wkSaffron" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FF7A00" />
          <stop offset="100%" stopColor="#E05A1B" />
        </linearGradient>
        <linearGradient id="wkGreen" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#10B981" />
          <stop offset="100%" stopColor="#059669" />
        </linearGradient>
        <linearGradient id="wkNavy" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#1E40AF" />
          <stop offset="100%" stopColor="#1E293B" />
        </linearGradient>
      </defs>

      {/* Outer subtle shadow / glow ring */}
      <circle cx="50" cy="50" r="46" fill="white" stroke="#F1F5F9" strokeWidth="2" />
      <circle cx="50" cy="50" r="42" fill="url(#wkChakraGlow)" />

      {/* Saffron Lotus/Chakra Petals - Top */}
      <path
        d="M50 14 C56 26 64 34 50 44 C36 34 44 26 50 14 Z"
        fill="url(#wkSaffron)"
      />
      <path
        d="M68 22 C68 34 64 42 52 46 C50 36 60 26 68 22 Z"
        fill="url(#wkSaffron)"
        opacity="0.9"
      />
      <path
        d="M32 22 C32 34 36 42 48 46 C50 36 40 26 32 22 Z"
        fill="url(#wkSaffron)"
        opacity="0.9"
      />

      {/* Green Leaves/Petals - Bottom */}
      <path
        d="M50 86 C44 74 36 66 50 56 C64 66 56 74 50 86 Z"
        fill="url(#wkGreen)"
      />
      <path
        d="M32 78 C32 66 36 58 48 54 C50 64 40 74 32 78 Z"
        fill="url(#wkGreen)"
        opacity="0.9"
      />
      <path
        d="M68 78 C68 66 64 58 52 54 C50 64 60 74 68 78 Z"
        fill="url(#wkGreen)"
        opacity="0.9"
      />

      {/* Central Navy Ashok Chakra / Gear */}
      <circle cx="50" cy="50" r="14" fill="white" stroke="#1E40AF" strokeWidth="2.5" />
      <circle cx="50" cy="50" r="4" fill="#1E40AF" />

      {/* 12 Spoke pairs representing the Ashok Chakra */}
      {[...Array(12)].map((_, i) => (
        <line
          key={i}
          x1="50"
          y1="50"
          x2={50 + 13 * Math.cos((i * 30 * Math.PI) / 180)}
          y2={50 + 13 * Math.sin((i * 30 * Math.PI) / 180)}
          stroke="#1E40AF"
          strokeWidth="1.4"
        />
      ))}
    </svg>
  );
}
