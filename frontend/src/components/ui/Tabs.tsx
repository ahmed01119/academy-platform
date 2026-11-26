'use client';

import React, { createContext, useContext } from 'react';

interface TabsContextValue {
  activeTab: string;
  onChange: (tabId: string) => void;
}

const TabsContext = createContext<TabsContextValue | undefined>(undefined);

export interface TabsProps {
  activeTab?: string;
  value?: string;
  onChange?: (tabId: string) => void;
  onValueChange?: (tabId: string) => void;
  children: React.ReactNode;
  className?: string;
}

export function Tabs({
  activeTab,
  value,
  onChange,
  onValueChange,
  children,
  className = '',
}: TabsProps) {
  const currentTab = value !== undefined ? value : (activeTab ?? '');
  const handleChange = (tabId: string) => {
    onValueChange?.(tabId);
    onChange?.(tabId);
  };

  return (
    <TabsContext.Provider value={{ activeTab: currentTab, onChange: handleChange }}>
      <div className={`space-y-6 ${className}`}>{children}</div>
    </TabsContext.Provider>
  );
}

export interface TabListProps {
  children: React.ReactNode;
  className?: string;
}

export function TabList({ children, className = '' }: TabListProps) {
  return (
    <div
      role="tablist"
      className={`flex items-center gap-2 p-1.5 rounded-2xl bg-(--bg-surface-subtle) border border-(--border-subtle) overflow-x-auto no-scrollbar ${className}`}
    >
      {children}
    </div>
  );
}

export interface TabTriggerProps {
  value: string;
  children: React.ReactNode;
  icon?: React.ReactNode;
  badge?: React.ReactNode | number | string;
  disabled?: boolean;
  className?: string;
}

export function TabTrigger({
  value,
  children,
  icon,
  badge,
  disabled = false,
  className = '',
}: TabTriggerProps) {
  const context = useContext(TabsContext);
  if (!context) {
    throw new Error('TabTrigger must be used within a Tabs component');
  }

  const isActive = context.activeTab === value;

  return (
    <button
      type="button"
      role="tab"
      aria-selected={isActive}
      disabled={disabled}
      onClick={() => context.onChange(value)}
      className={`flex items-center gap-2 px-4 py-2 text-xs sm:text-sm font-bold rounded-xl transition-all duration-200 shrink-0 select-none ${
        isActive
          ? 'bg-(--bg-surface) text-(--accent-primary) shadow-sm border border-(--border-app)'
          : 'text-(--text-muted) hover:text-(--text-main) hover:bg-(--bg-surface)/50'
      } disabled:opacity-40 disabled:cursor-not-allowed ${className}`}
    >
      {icon && <span className="shrink-0">{icon}</span>}
      <span>{children}</span>
      {badge !== undefined && (
        <span
          className={`px-1.5 py-0.5 rounded-md text-[10px] font-extrabold ${
            isActive
              ? 'bg-(--accent-primary)/15 text-(--accent-primary)'
              : 'bg-(--border-subtle) text-(--text-muted)'
          }`}
        >
          {badge}
        </span>
      )}
    </button>
  );
}

export interface TabContentProps {
  value: string;
  children: React.ReactNode;
  className?: string;
}

export function TabContent({ value, children, className = '' }: TabContentProps) {
  const context = useContext(TabsContext);
  if (!context) {
    throw new Error('TabContent must be used within a Tabs component');
  }

  if (context.activeTab !== value) {
    return null;
  }

  return (
    <div role="tabpanel" className={`animate-fade-in ${className}`}>
      {children}
    </div>
  );
}
