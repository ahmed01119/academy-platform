import { ImageResponse } from 'next/og';

export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

export default function AppleIcon() {
  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'radial-gradient(circle at 50% 30%, #1E293B 0%, #0F172A 70%, #070C18 100%)',
        borderRadius: 40,
        border: '2px solid rgba(0, 214, 255, 0.4)',
      }}
    >
      <svg width="124" height="124" viewBox="0 0 240 240" fill="none">
        <defs>
          <linearGradient id="apUpper" x1="15%" y1="10%" x2="90%" y2="85%">
            <stop offset="0%" stopColor="#0A3BFF" />
            <stop offset="40%" stopColor="#0077FF" />
            <stop offset="80%" stopColor="#00C4FF" />
            <stop offset="100%" stopColor="#00E5FF" />
          </linearGradient>
          <linearGradient id="apLower" x1="10%" y1="20%" x2="85%" y2="95%">
            <stop offset="0%" stopColor="#15803D" />
            <stop offset="35%" stopColor="#22C55E" />
            <stop offset="75%" stopColor="#4ADE80" />
            <stop offset="100%" stopColor="#84F06B" />
          </linearGradient>
          <radialGradient id="apBall" cx="35%" cy="30%" r="70%">
            <stop offset="0%" stopColor="#FFFFFF" />
            <stop offset="65%" stopColor="#E2E8F0" />
            <stop offset="100%" stopColor="#94A3B8" />
          </radialGradient>
        </defs>

        {/* Lower Green Wing */}
        <path
          d="M 125 108 C 155 120, 182 142, 172 170 C 162 196, 125 208, 92 205 C 62 202, 38 185, 25 174 C 48 182, 85 190, 114 184 C 138 178, 150 162, 142 148 C 132 132, 102 122, 78 114 C 52 105, 34 94, 45 78 C 52 88, 72 98, 96 103 Z"
          fill="url(#apLower)"
        />

        {/* Upper Blue/Cyan Wing */}
        <path
          d="M 30 75 C 35 52, 65 30, 108 24 C 152 18, 192 35, 206 68 C 218 95, 202 124, 172 136 C 145 147, 115 142, 100 134 C 122 136, 152 130, 170 114 C 186 98, 188 74, 172 56 C 152 36, 118 34, 88 42 C 60 50, 42 64, 30 75 Z"
          fill="url(#apUpper)"
        />

        {/* Football In Upper Bowl */}
        <g transform="translate(142, 82)">
          <circle cx="0" cy="0" r="32" fill="url(#apBall)" stroke="#94A3B8" strokeWidth="1.5" />
          <polygon points="0,-10 9,-3 6,8 -6,8 -9,-3" fill="#0F172A" />
          <polygon points="0,-10 0,-24 12,-30 16,-20 9,-3" fill="#1E293B" />
          <polygon points="-22,-6 -28,-18 -16,-24 0,-24 -9,-3" fill="#0F172A" />
          <polygon points="9,-3 23,-3 30,8 22,18 6,8" fill="#1E293B" />
          <polygon points="-6,8 -14,20 -26,16 -28,4 -9,-3" fill="#0F172A" />
          <polygon points="6,8 4,24 -8,25 -14,20 -6,8" fill="#1E293B" />
          <circle cx="-12" cy="-14" r="3" fill="#FFFFFF" opacity="0.8" />
        </g>
      </svg>
    </div>,
    { ...size },
  );
}
