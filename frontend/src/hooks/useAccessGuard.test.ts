import { describe, expect, it } from 'vitest';
import { planRedirect } from './useAccessGuard';

describe('planRedirect (useAccessGuard navigation planner)', () => {
  it('does nothing and clears memory when no redirect is needed (pending or allowed)', () => {
    expect(planRedirect({ target: null, pathname: '/players', lastRedirect: '/login' })).toEqual({
      navigateTo: null,
      lastRedirect: null,
    });
  });

  it('navigates once to a new target (direct URL access while signed out)', () => {
    expect(planRedirect({ target: '/login', pathname: '/players', lastRedirect: null })).toEqual({
      navigateTo: '/login',
      lastRedirect: '/login',
    });
  });

  it('does not push the same redirect twice while the decision is unchanged', () => {
    expect(
      planRedirect({ target: '/login', pathname: '/players', lastRedirect: '/login' }),
    ).toEqual({
      navigateTo: null,
      lastRedirect: '/login',
    });
  });

  it('never redirects to the route the user is already on (e.g. VIEWER on /dashboard)', () => {
    expect(
      planRedirect({ target: '/dashboard', pathname: '/dashboard', lastRedirect: null }),
    ).toEqual({ navigateTo: null, lastRedirect: null });
  });

  it('redirects again when the target changes (e.g. tenant switch to a coach membership)', () => {
    expect(
      planRedirect({ target: '/coach', pathname: '/players', lastRedirect: '/login' }),
    ).toEqual({ navigateTo: '/coach', lastRedirect: '/coach' });
  });

  it('a simulated effect sequence settles without loops', () => {
    // Re-renders with the same decision must not produce more than one navigation.
    let memory: string | null = null;
    const pushes: string[] = [];
    for (let render = 0; render < 10; render++) {
      const step = planRedirect({ target: '/coach', pathname: '/players', lastRedirect: memory });
      memory = step.lastRedirect;
      if (step.navigateTo) pushes.push(step.navigateTo);
    }
    expect(pushes).toEqual(['/coach']);
  });
});
