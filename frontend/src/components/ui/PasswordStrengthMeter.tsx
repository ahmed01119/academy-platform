'use client';

import React from 'react';
import { Check, ShieldAlert, ShieldCheck } from 'lucide-react';

export interface PasswordCriteria {
  minLength: boolean;
  hasUpper: boolean;
  hasLower: boolean;
  hasNumber: boolean;
  hasSpecial: boolean;
}

export function evaluatePassword(password: string): {
  criteria: PasswordCriteria;
  score: number;
  labelAr: string;
  labelEn: string;
  colorClass: string;
  barColor: string;
} {
  const criteria: PasswordCriteria = {
    minLength: password.length >= 8 && password.length <= 128,
    hasUpper: /[A-Z]/.test(password),
    hasLower: /[a-z]/.test(password),
    hasNumber: /[0-9]/.test(password),
    hasSpecial: /[^A-Za-z0-9]/.test(password),
  };

  const score = Object.values(criteria).filter(Boolean).length;

  if (password.length === 0) {
    return {
      criteria,
      score: 0,
      labelAr: 'أدخل كلمة المرور',
      labelEn: 'Enter password',
      colorClass: 'text-(--text-muted)',
      barColor: 'bg-(--border-subtle)',
    };
  }

  if (score <= 1) {
    return {
      criteria,
      score: 1,
      labelAr: 'ضعيفة جداً',
      labelEn: 'Very Weak',
      colorClass: 'text-rose-500',
      barColor: 'bg-rose-500',
    };
  }

  if (score === 2) {
    return {
      criteria,
      score: 2,
      labelAr: 'ضعيفة',
      labelEn: 'Weak',
      colorClass: 'text-orange-500',
      barColor: 'bg-orange-500',
    };
  }

  if (score === 3) {
    return {
      criteria,
      score: 3,
      labelAr: 'متوسطة',
      labelEn: 'Moderate',
      colorClass: 'text-amber-500',
      barColor: 'bg-amber-500',
    };
  }

  if (score === 4) {
    return {
      criteria,
      score: 4,
      labelAr: 'جيدة',
      labelEn: 'Good',
      colorClass: 'text-blue-500',
      barColor: 'bg-blue-500',
    };
  }

  return {
    criteria,
    score: 5,
    labelAr: 'قوية ومحصنة',
    labelEn: 'Strong & Secure',
    colorClass: 'text-emerald-500',
    barColor: 'bg-emerald-500',
  };
}

interface PasswordStrengthMeterProps {
  password: string;
  locale?: string;
  showChecklist?: boolean;
}

export function PasswordStrengthMeter({
  password,
  locale = 'ar',
  showChecklist = true,
}: PasswordStrengthMeterProps) {
  const isAr = locale === 'ar';
  const { criteria, score, labelAr, labelEn, colorClass, barColor } = evaluatePassword(password);

  if (!password && !showChecklist) return null;

  return (
    <div className="space-y-2 mt-2 text-xs">
      {/* Strength Bar & Label */}
      <div className="flex items-center justify-between text-[11px] font-semibold">
        <span className="text-(--text-muted) flex items-center gap-1.5">
          {score >= 5 ? (
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
          ) : (
            <ShieldAlert className="h-3.5 w-3.5 text-(--text-muted)" />
          )}
          <span>{isAr ? 'قوة كلمة المرور:' : 'Password Strength:'}</span>
        </span>
        <span className={`font-bold transition-colors ${colorClass}`}>
          {isAr ? labelAr : labelEn}
        </span>
      </div>

      {/* 5-Segment Bar */}
      <div className="grid grid-cols-5 gap-1.5 h-1.5">
        {[1, 2, 3, 4, 5].map((level) => (
          <div
            key={level}
            className={`h-full rounded-full transition-all duration-300 ${
              score >= level ? barColor : 'bg-(--border-subtle)'
            }`}
          />
        ))}
      </div>

      {/* Requirements Checklist */}
      {showChecklist && (
        <div className="rounded-xl border border-(--border-subtle) bg-(--bg-surface-subtle)/60 p-3 space-y-1.5 text-[11px] mt-2">
          <div className="font-semibold text-(--text-muted) mb-1">
            {isAr ? 'معايير كلمة المرور القوية:' : 'Strong Password Requirements:'}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
            {/* 8+ Chars */}
            <div
              className={`flex items-center gap-1.5 transition-colors ${
                criteria.minLength ? 'text-emerald-500 font-medium' : 'text-(--text-muted)'
              }`}
            >
              {criteria.minLength ? (
                <Check className="h-3.5 w-3.5 shrink-0" />
              ) : (
                <span className="h-3 w-3 rounded-full border border-(--border-subtle) shrink-0 inline-block" />
              )}
              <span>{isAr ? '8 أحرف على الأقل (حتى 128)' : '8+ characters (up to 128)'}</span>
            </div>

            {/* Uppercase */}
            <div
              className={`flex items-center gap-1.5 transition-colors ${
                criteria.hasUpper ? 'text-emerald-500 font-medium' : 'text-(--text-muted)'
              }`}
            >
              {criteria.hasUpper ? (
                <Check className="h-3.5 w-3.5 shrink-0" />
              ) : (
                <span className="h-3 w-3 rounded-full border border-(--border-subtle) shrink-0 inline-block" />
              )}
              <span>{isAr ? 'حرف كبير واحد على الأقل (A-Z)' : 'At least one uppercase (A-Z)'}</span>
            </div>

            {/* Lowercase */}
            <div
              className={`flex items-center gap-1.5 transition-colors ${
                criteria.hasLower ? 'text-emerald-500 font-medium' : 'text-(--text-muted)'
              }`}
            >
              {criteria.hasLower ? (
                <Check className="h-3.5 w-3.5 shrink-0" />
              ) : (
                <span className="h-3 w-3 rounded-full border border-(--border-subtle) shrink-0 inline-block" />
              )}
              <span>{isAr ? 'حرف صغير واحد على الأقل (a-z)' : 'At least one lowercase (a-z)'}</span>
            </div>

            {/* Number */}
            <div
              className={`flex items-center gap-1.5 transition-colors ${
                criteria.hasNumber ? 'text-emerald-500 font-medium' : 'text-(--text-muted)'
              }`}
            >
              {criteria.hasNumber ? (
                <Check className="h-3.5 w-3.5 shrink-0" />
              ) : (
                <span className="h-3 w-3 rounded-full border border-(--border-subtle) shrink-0 inline-block" />
              )}
              <span>{isAr ? 'رقم واحد على الأقل (0-9)' : 'At least one number (0-9)'}</span>
            </div>

            {/* Special Symbol */}
            <div
              className={`flex items-center gap-1.5 transition-colors sm:col-span-2 ${
                criteria.hasSpecial ? 'text-emerald-500 font-medium' : 'text-(--text-muted)'
              }`}
            >
              {criteria.hasSpecial ? (
                <Check className="h-3.5 w-3.5 shrink-0" />
              ) : (
                <span className="h-3 w-3 rounded-full border border-(--border-subtle) shrink-0 inline-block" />
              )}
              <span>
                {isAr
                  ? 'رمز أو علامة خاصة (!@#$%^&*...)'
                  : 'At least one special symbol (!@#$%^&*)'}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

