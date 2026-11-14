'use client';

import React from 'react';

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

export interface PageHeaderProps {
  title: string;
  description?: string;
  /**
   * Breadcrumbs are displayed exclusively in the top navigation bar (Topbar)
   * to maintain a clean layout without duplicate breadcrumb trails.
   */
  breadcrumbs?: BreadcrumbItem[];
  badge?: React.ReactNode;
  actions?: React.ReactNode;
  icon?: React.ComponentType<{ className?: string }> | React.ReactNode;
  children?: React.ReactNode;
}

export function PageHeader({
  title,
  description,
  breadcrumbs: _breadcrumbs,
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
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-(--accent-primary)/10 text-[var(--accent-primary)]">
        <IconComponent className="h-5 w-5" />
      </div>
    );
  };
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between pb-2 border-b border-(--border-subtle)">
      <div className="space-y-1">
        <div className="flex items-center gap-2.5 flex-wrap">
          {renderIcon()}
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-(--text-main)">
            {title}
          </h1>
          {badge}
        </div>
        {description && (
          <p className="text-xs sm:text-sm text-(--text-muted) max-w-2xl leading-relaxed">
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
