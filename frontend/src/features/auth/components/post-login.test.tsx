import React from 'react';
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { LocaleProvider, useLocale } from '@/contexts/locale-context';
import { skeletonPropsFor } from './PostLoginSkeleton';

function ShowLocale() {
  const { locale, dir } = useLocale();
  return (
    <span>
      {locale}/{dir}
    </span>
  );
}

describe('LocaleProvider first render', () => {
  it('renders the locale the server read from the cookie (no Arabic flash in English mode)', () => {
    expect(
      renderToStaticMarkup(
        <LocaleProvider initialLocale="en">
          <ShowLocale />
        </LocaleProvider>,
      ),
    ).toContain('en/ltr');
  });

  it('keeps Arabic as the default when no choice was saved', () => {
    expect(
      renderToStaticMarkup(
        <LocaleProvider>
          <ShowLocale />
        </LocaleProvider>,
      ),
    ).toContain('ar/rtl');
  });
});

describe('skeletonPropsFor (post-login skeleton matches the landing page)', () => {
  it.each([
    ['/coach', 'list'],
    ['/player', 'detail'],
    ['/guardian', 'cards'],
    ['/platform?tab=applications', 'table'],
    ['/dashboard', 'cards'],
    ['/accept-invite?token=x', 'cards'],
  ])('%s -> %s', (destination, variant) => {
    expect(skeletonPropsFor(destination).variant).toBe(variant);
  });

  it('does not treat /players as the player portal', () => {
    expect(skeletonPropsFor('/players').variant).toBe('cards');
  });
});
