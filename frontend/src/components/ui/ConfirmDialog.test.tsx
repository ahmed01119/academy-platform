import React from 'react';
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { LocaleProvider } from '@/contexts/locale-context';
import { ConfirmDialog, ConfirmProvider, useConfirm } from './ConfirmDialog';

const noop = () => undefined;

function renderDialog(props: Partial<React.ComponentProps<typeof ConfirmDialog>> = {}) {
  return renderToStaticMarkup(
    <LocaleProvider>
      <ConfirmDialog
        isOpen
        options={{ message: 'Are you sure you want to revoke this invitation?' }}
        onConfirm={noop}
        onCancel={noop}
        {...props}
      />
    </LocaleProvider>,
  );
}

describe('ConfirmDialog', () => {
  it('renders the caller message verbatim inside an accessible dialog', () => {
    const html = renderDialog();
    expect(html).toContain('role="dialog"');
    expect(html).toContain('aria-modal="true"');
    expect(html).toContain('Are you sure you want to revoke this invitation?');
  });

  it('uses the danger button for destructive confirmations', () => {
    const html = renderDialog({ options: { message: 'Remove?', isDestructive: true } });
    expect(html).toContain('bg-rose-600');
  });

  it('uses the primary button for non-destructive confirmations', () => {
    const html = renderDialog({ options: { message: 'Mark all present?' } });
    expect(html).not.toContain('bg-rose-600');
    expect(html).toContain('bg-(--accent-primary)');
  });

  it('falls back to localized default title and actions (Arabic default locale)', () => {
    const html = renderDialog();
    expect(html).toContain('تأكيد الإجراء');
    expect(html).toContain('إلغاء');
    expect(html).toContain('تأكيد');
  });

  it('honours custom title and button labels', () => {
    const html = renderDialog({
      options: { message: 'm', title: 'Close session', confirmText: 'Lock', cancelText: 'Back' },
    });
    expect(html).toContain('Close session');
    expect(html).toContain('Lock');
    expect(html).toContain('Back');
  });

  it('renders nothing when closed', () => {
    expect(renderDialog({ isOpen: false })).toBe('');
  });
});

describe('useConfirm', () => {
  function Probe() {
    const requestConfirmation = useConfirm();
    return <span>{typeof requestConfirmation}</span>;
  }

  it('is available inside ConfirmProvider', () => {
    const html = renderToStaticMarkup(
      <LocaleProvider>
        <ConfirmProvider>
          <Probe />
        </ConfirmProvider>
      </LocaleProvider>,
    );
    expect(html).toContain('function');
  });

  it('fails loudly when used outside ConfirmProvider', () => {
    expect(() => renderToStaticMarkup(<Probe />)).toThrow(/ConfirmProvider/);
  });
});
