'use client';

import React from 'react';
import Link from 'next/link';

interface SportexusLogoProps {
  variant?: 'full' | 'symbol' | 'icon';
  theme?: 'dark' | 'light' | 'auto';
  className?: string;
  href?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showTagline?: boolean;
}

export function SportexusLogo({
  variant = 'full',
  theme = 'auto',
  className = '',
  href,
  size = 'md',
  showTagline = false,
}: SportexusLogoProps) {
  const sizeClasses = {
    sm: { symbol: 'h-7 w-7', text: 'text-lg', subtitle: 'text-[9px]' },
    md: { symbol: 'h-9 w-9 sm:h-10 sm:w-10', text: 'text-xl sm:text-2xl', subtitle: 'text-[10px]' },
    lg: { symbol: 'h-12 w-12', text: 'text-2xl sm:text-3xl', subtitle: 'text-xs' },
    xl: { symbol: 'h-16 w-16', text: 'text-3xl sm:text-4xl', subtitle: 'text-sm' },
  }[size];

  const content = (
    <div
      dir="ltr"
      style={{ unicodeBidi: 'isolate' }}
      className={`inline-flex items-center gap-3 select-none group ${className}`}
    >
      {/* Dynamic S Logo Symbol with Football */}
      <div
        className={`relative shrink-0 flex items-center justify-center transition-transform duration-200 group-hover:scale-105 ${sizeClasses.symbol}`}
      >
        <svg
          viewBox="0 0 240 240"
          fill="none"
          className="w-full h-full drop-shadow-[0_4px_12px_rgba(10,59,255,0.25)]"
        >
          <defs>
            <linearGradient id="symUpper" x1="15%" y1="10%" x2="90%" y2="85%">
              <stop offset="0%" stopColor="#0A3BFF" />
              <stop offset="40%" stopColor="#0077FF" />
              <stop offset="80%" stopColor="#00C4FF" />
              <stop offset="100%" stopColor="#00E5FF" />
            </linearGradient>
            <linearGradient id="symLower" x1="10%" y1="20%" x2="85%" y2="95%">
              <stop offset="0%" stopColor="#15803D" />
              <stop offset="35%" stopColor="#22C55E" />
              <stop offset="75%" stopColor="#4ADE80" />
              <stop offset="100%" stopColor="#84F06B" />
            </linearGradient>
            <radialGradient id="symBall" cx="35%" cy="30%" r="70%">
              <stop offset="0%" stopColor="#FFFFFF" />
              <stop offset="65%" stopColor="#E2E8F0" />
              <stop offset="100%" stopColor="#94A3B8" />
            </radialGradient>
          </defs>

          {/* Lower Green Wing */}
          <path
            d="M 125 108 C 155 120, 182 142, 172 170 C 162 196, 125 208, 92 205 C 62 202, 38 185, 25 174 C 48 182, 85 190, 114 184 C 138 178, 150 162, 142 148 C 132 132, 102 122, 78 114 C 52 105, 34 94, 45 78 C 52 88, 72 98, 96 103 Z"
            fill="url(#symLower)"
          />

          {/* Upper Blue/Cyan Wing */}
          <path
            d="M 30 75 C 35 52, 65 30, 108 24 C 152 18, 192 35, 206 68 C 218 95, 202 124, 172 136 C 145 147, 115 142, 100 134 C 122 136, 152 130, 170 114 C 186 98, 188 74, 172 56 C 152 36, 118 34, 88 42 C 60 50, 42 64, 30 75 Z"
            fill="url(#symUpper)"
          />

          {/* Lead Feather */}
          <path
            d="M 28 78 C 42 66, 68 52, 98 46 C 70 56, 48 74, 34 96 C 31 89, 29 83, 28 78 Z"
            fill="#00D6FF"
          />

          {/* Football In Upper Bowl */}
          <g transform="translate(142, 82)">
            <circle cx="2" cy="3" r="32" fill="#0F172A" opacity="0.35" />
            <circle cx="0" cy="0" r="32" fill="url(#symBall)" stroke="#CBD5E1" strokeWidth="1.2" />
            <polygon points="0,-10 9,-3 6,8 -6,8 -9,-3" fill="#0F172A" />
            <polygon points="0,-10 0,-24 12,-30 16,-20 9,-3" fill="#1E293B" opacity="0.95" />
            <line x1="0" y1="-10" x2="0" y2="-24" stroke="#94A3B8" strokeWidth="1.5" />
            <polygon points="-22,-6 -28,-18 -16,-24 0,-24 -9,-3" fill="#0F172A" opacity="0.85" />
            <polygon points="9,-3 23,-3 30,8 22,18 6,8" fill="#1E293B" opacity="0.9" />
            <polygon points="-6,8 -14,20 -26,16 -28,4 -9,-3" fill="#0F172A" opacity="0.9" />
            <polygon points="6,8 4,24 -8,25 -14,20 -6,8" fill="#1E293B" opacity="0.9" />
            <circle cx="-12" cy="-14" r="3" fill="#FFFFFF" opacity="0.8" />
          </g>

          <path
            d="M 112 186 C 134 180, 148 166, 142 152 C 146 164, 134 176, 112 182 C 86 188, 54 182, 32 174 C 52 180, 84 188, 112 186 Z"
            fill="#84F06B"
            opacity="0.8"
          />
        </svg>
      </div>

      {/* Sportexus Wordmark */}
      {variant !== 'symbol' && (
        <div className="flex flex-col leading-none">
          <div className="flex items-baseline">
            <span
              className={`font-black tracking-tight ${
                theme === 'light'
                  ? 'text-[#0F172A]'
                  : theme === 'dark'
                    ? 'text-white'
                    : 'text-[var(--text-main)]'
              } ${sizeClasses.text}`}
            >
              Sport
            </span>
            <span
              className={`font-extrabold bg-gradient-to-r from-[#00D6FF] via-[#10B981] to-[#22C55E] bg-clip-text text-transparent ${sizeClasses.text}`}
            >
              exus
            </span>
            <span className="text-[10px] font-bold text-[#00D6FF] ms-0.5 -translate-y-2 opacity-80">
              ™
            </span>
          </div>

          <span
            className={`font-bold tracking-[0.22em] uppercase text-[var(--text-muted)] mt-1 ${sizeClasses.subtitle}`}
          >
            ACADEMY PLATFORM
          </span>

          {showTagline && (
            <span className="text-[11px] font-medium text-[var(--text-muted)] mt-0.5 tracking-normal">
              One Platform. Every Academy.
            </span>
          )}
        </div>
      )}
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="inline-flex items-center no-underline">
        {content}
      </Link>
    );
  }

  return content;
}
