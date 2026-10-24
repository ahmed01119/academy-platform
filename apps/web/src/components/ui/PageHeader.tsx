'use client';

import React from 'react';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

export interface PageHeaderProps {
  title: string;
  description?: string;
  breadcrumbs?: BreadcrumbItem[];
  badge?: React.ReactNode;
  actions?: React.ReactNode;
  icon?: React.ComponentType<{ className?: string }> | React.ReactNode;
  children?: React.ReactNode;
}

export function PageHeader({
  title,
  description,
  breadcrumbs,
  badge,
  actions,
  icon: Icon,
  children,
}: PageHeaderProps) {
  const renderIcon = () => {
    if (!Icon) return null;
    if (React.isValidElement(Icon)) return Icon;
    const IconComponent = Icon as React.ComponentType<{ className?: string }>;
    return (
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--brand-primary)]/10 text-[var(--brand-primary)]">
        <IconComponent className="h-5 w-5" />
      </div>
    );
  };
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between pb-2 border-b border-[var(--border-subtle)]">
      <div className="space-y-1">
        {breadcrumbs && breadcrumbs.length > 0 && (
          <nav
            aria-label="Breadcrumb"
            className="flex items-center gap-1.5 text-xs text-[var(--text-muted)] mb-1"
          >
            {breadcrumbs.map((crumb, idx) => {
              const isLast = idx === breadcrumbs.length - 1;
              return (
                <React.Fragment key={crumb.label}>
                  {idx > 0 && <ChevronRight className="h-3 w-3 rtl:rotate-180 opacity-60" />}
                  {isLast || !crumb.href ? (
                    <span className={isLast ? 'text-[var(--text-primary)] font-medium' : ''}>
                      {crumb.label}
                    </span>
                  ) : (
                    <Link
                      href={crumb.href}
                      className="hover:text-[var(--brand-primary)] transition-colors"
                    >
                      {crumb.label}
                    </Link>
                  )}
                </React.Fragment>
              );
            })}
          </nav>
        )}
        <div className="flex items-center gap-2.5 flex-wrap">
          {renderIcon()}
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[var(--text-main)]">
            {title}
          </h1>
          {badge}
        </div>
        {description && (
          <p className="text-xs sm:text-sm text-[var(--text-muted)] max-w-2xl leading-relaxed">
            {description}
          </p>
        )}
      </div>

      {(actions || children) && (
        <div className="flex items-center gap-2.5 flex-wrap shrink-0">
          {actions}
          {children}
        </div>
      )}
    </div>
  );
}

export default PageHeader;
