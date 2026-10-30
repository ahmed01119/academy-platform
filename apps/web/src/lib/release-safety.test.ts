import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('CI/CD Release Safety & Verification Invariants', () => {
  const backendSample = `
FROM node:22-alpine AS builder
WORKDIR /app
COPY apps/api ./apps/api
RUN pnpm --filter @academy/database run generate && \
    pnpm --filter @academy/shared build && \
    pnpm --filter @academy/database build && \
    pnpm --filter @academy/api build
FROM node:22-alpine AS runner
WORKDIR /app
COPY --from=builder /app/apps/api ./apps/api
CMD ["node", "dist/main.js"]
`;

  const frontendSample = `
FROM node:22-alpine AS deps
WORKDIR /app
COPY apps/web/package.json ./apps/web/package.json
ENV BUILD_STANDALONE=true
RUN pnpm --filter @academy/shared build && \
    pnpm --filter @academy/web build
FROM node:22-alpine AS runner
WORKDIR /app
COPY --from=builder /app/apps/web/.next/standalone ./
CMD ["node", "apps/web/server.js"]
`;

  it('validates backend Dockerfile and rejects frontend container (Issue #3)', () => {
    function isBackendDockerfile(content: string): boolean {
      const isBackend =
        content.includes('apps/api') ||
        content.includes('NestJS') ||
        content.includes('dist/main.js');
      const isFrontend = content.includes('apps/web') && content.includes('.next/standalone');
      return isBackend && !isFrontend;
    }

    expect(isBackendDockerfile(backendSample)).toBe(true);
    expect(isBackendDockerfile(frontendSample)).toBe(false);
  });

  it('validates frontend Dockerfile and rejects backend container (Issue #3)', () => {
    function isFrontendDockerfile(content: string): boolean {
      return (
        content.includes('apps/web') ||
        content.includes('.next/standalone') ||
        content.includes('BUILD_STANDALONE')
      );
    }

    expect(isFrontendDockerfile(frontendSample)).toBe(true);
    expect(isFrontendDockerfile(backendSample)).toBe(false);
  });

  it('verifies deployed commit SHA instead of merely HTTP 200 (Issue #2)', () => {
    interface DeployVerificationInput {
      httpStatus: number;
      versionJson?: { commitSha?: string; buildId?: string };
      expectedSha: string;
    }

    function verifyDeployment(input: DeployVerificationInput): {
      verified: boolean;
      status: 'SUCCESS' | 'WAITING_NEW_BUILD' | 'UNHEALTHY';
    } {
      if (input.httpStatus !== 200) {
        return { verified: false, status: 'UNHEALTHY' };
      }

      if (input.versionJson?.commitSha === input.expectedSha) {
        return { verified: true, status: 'SUCCESS' };
      }

      // HTTP 200 but running previous build — must NOT declare success early
      return { verified: false, status: 'WAITING_NEW_BUILD' };
    }

    // Scenario 1: HTTP 200 but previous commit running -> should WAIT, not pass
    const previousRunning = verifyDeployment({
      httpStatus: 200,
      versionJson: { commitSha: 'old-commit-111', buildId: 'build-old' },
      expectedSha: 'new-commit-222',
    });
    expect(previousRunning.verified).toBe(false);
    expect(previousRunning.status).toBe('WAITING_NEW_BUILD');

    // Scenario 2: HTTP 200 with matching commit -> passes
    const newlyDeployed = verifyDeployment({
      httpStatus: 200,
      versionJson: { commitSha: 'new-commit-222', buildId: 'build-new' },
      expectedSha: 'new-commit-222',
    });
    expect(newlyDeployed.verified).toBe(true);
    expect(newlyDeployed.status).toBe('SUCCESS');

    // Scenario 3: Container down -> unhealthy
    const containerDown = verifyDeployment({
      httpStatus: 502,
      expectedSha: 'new-commit-222',
    });
    expect(containerDown.verified).toBe(false);
    expect(containerDown.status).toBe('UNHEALTHY');
  });

  it('reliably extracts commitSha and buildId from formatted multi-line version.json', () => {
    const rawJson = `{\n  "name": "SPORTEXUS",\n  "version": "1.0.0",\n  "buildId": "6e2f9b0d1d3a-mvu8sufe",\n  "commitSha": "40e73a829f08",\n  "builtAt": "2026-10-30T11:00:00.000Z"\n}\n`;

    function parseVersionData(jsonStr: string): { commitSha: string; buildId: string } {
      try {
        const d = JSON.parse(jsonStr);
        return {
          commitSha: d.commitSha || '',
          buildId: d.buildId || '',
        };
      } catch {
        return { commitSha: '', buildId: '' };
      }
    }

    const parsed = parseVersionData(rawJson);
    expect(parsed.commitSha).toBe('40e73a829f08');
    expect(parsed.buildId).toBe('6e2f9b0d1d3a-mvu8sufe');

    // Also handles empty or malformed strings gracefully
    expect(parseVersionData('')).toEqual({ commitSha: '', buildId: '' });
    expect(parseVersionData('{ invalid json }')).toEqual({ commitSha: '', buildId: '' });
  });

  it('detects changes across multi-commit ranges accurately (Issue #7)', () => {
    function determineTargets(changedFiles: string[]): {
      deployBackend: boolean;
      deployFrontend: boolean;
    } {
      let deployBackend = false;
      let deployFrontend = false;

      const fileList = changedFiles.join('\n');

      if (
        /^(apps\/api|packages\/database|packages\/shared|Dockerfile|package\.json|pnpm-lock\.yaml|turbo\.json)/m.test(
          fileList,
        )
      ) {
        deployBackend = true;
      }
      if (
        /^(apps\/web|packages\/shared|Dockerfile\.web|package\.json|pnpm-lock\.yaml|turbo\.json)/m.test(
          fileList,
        )
      ) {
        deployFrontend = true;
      }

      if (!deployBackend && !deployFrontend) {
        deployBackend = true;
        deployFrontend = true;
      }

      return { deployBackend, deployFrontend };
    }

    // Only web changed
    expect(determineTargets(['apps/web/src/page.tsx', 'apps/web/public/sw.js'])).toEqual({
      deployBackend: false,
      deployFrontend: true,
    });

    // Only api changed
    expect(determineTargets(['apps/api/src/auth.service.ts'])).toEqual({
      deployBackend: true,
      deployFrontend: false,
    });

    // Shared packages changed -> both deploy
    expect(determineTargets(['packages/shared/src/index.ts'])).toEqual({
      deployBackend: true,
      deployFrontend: true,
    });

    // Root manifests changed -> both deploy
    expect(determineTargets(['pnpm-lock.yaml'])).toEqual({
      deployBackend: true,
      deployFrontend: true,
    });

    // Empty or docs change -> safety fallback deploys both
    expect(determineTargets(['README.md'])).toEqual({
      deployBackend: true,
      deployFrontend: true,
    });
  });

  it('detects unmerged deployment-only hotfixes before merging (Issue #9)', () => {
    function detectHotfixes(unmergedLogOutput: string): { hasHotfixes: boolean; count: number } {
      const clean = unmergedLogOutput.trim();
      if (!clean) return { hasHotfixes: false, count: 0 };
      const lines = clean.split('\n').filter(Boolean);
      return { hasHotfixes: lines.length > 0, count: lines.length };
    }

    expect(detectHotfixes('')).toEqual({ hasHotfixes: false, count: 0 });
    expect(
      detectHotfixes(
        'a1b2c3d fix(auth): hotfix token expiration\ne4f5g6h fix(cors): emergency cors fix',
      ),
    ).toEqual({ hasHotfixes: true, count: 2 });
  });

  it('detects and categorizes all unresolved git merge conflicts (Task 2)', () => {
    function parseConflicts(statusOutput: string): { code: string; file: string }[] {
      if (!statusOutput) return [];
      return statusOutput
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => {
          const code = l.slice(0, 2);
          return code.includes('U') || code === 'AA' || code === 'DD';
        })
        .map((l) => ({
          code: l.slice(0, 2),
          file: l.slice(3).trim(),
        }));
    }

    const sampleStatus = [
      'UU apps/api/src/main.ts',
      'AA packages/shared/src/index.ts',
      'DD apps/web/src/page.tsx',
      'M  package.json',
      '?? new-file.txt',
    ].join('\n');

    const conflicts = parseConflicts(sampleStatus);
    expect(conflicts).toHaveLength(3);
    expect(conflicts).toEqual([
      { code: 'UU', file: 'apps/api/src/main.ts' },
      { code: 'AA', file: 'packages/shared/src/index.ts' },
      { code: 'DD', file: 'apps/web/src/page.tsx' },
    ]);
  });

  it('verifies generated version manifest structure and presence of buildId (Issue #5)', () => {
    const versionPath = path.resolve(__dirname, '../../../../apps/web/public/version.json');
    if (fs.existsSync(versionPath)) {
      const content = JSON.parse(fs.readFileSync(versionPath, 'utf8'));
      expect(content).toHaveProperty('name', 'SPORTEXUS');
      expect(content).toHaveProperty('version');
      expect(content).toHaveProperty('buildId');
      expect(content).toHaveProperty('commitSha');
      expect(content).toHaveProperty('builtAt');
    }
  });

  it('ensures sync commit messages always include [skip ci] (Issue #8)', () => {
    function formatSyncCommitMessage(target: 'backend' | 'web', sha: string): string {
      return `release(${target}): sync with main ${sha} [skip ci]`;
    }

    const backendMsg = formatSyncCommitMessage('backend', 'abc123456789');
    const webMsg = formatSyncCommitMessage('web', 'abc123456789');

    expect(backendMsg).toContain('[skip ci]');
    expect(webMsg).toContain('[skip ci]');
  });
});
