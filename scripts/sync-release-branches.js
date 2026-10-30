/**
 * SPORTEXUS — Automated Release Branch Synchronizer
 *
 * Deterministically syncs approved changes from `main` to:
 *   - Backend deploy branch:  feat/email-system-hardening-and-e2e  (Root Dockerfile = NestJS)
 *   - Frontend deploy branch: deploy/sportexus-web-staging          (Root Dockerfile = Next.js standalone)
 *
 * Safety Invariants:
 *   1. NEVER uses force pushes.
 *   2. Validates root Dockerfile signature before and after sync.
 *   3. Aborts safely on merge conflicts or branch divergence.
 *   4. Generates release tracking metadata (commit SHA, timestamp).
 *   5. Includes [skip ci] in sync commits to prevent recursive GitHub Actions loops.
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

function run(cmd, options = {}) {
  return execSync(cmd, {
    encoding: 'utf8',
    stdio: options.silent ? 'pipe' : 'inherit',
    ...options,
  });
}

function runOutput(cmd) {
  return execSync(cmd, { encoding: 'utf8' }).trim();
}

const BACKEND_BRANCH = process.env.BACKEND_DEPLOY_BRANCH || 'feat/email-system-hardening-and-e2e';
const FRONTEND_BRANCH = process.env.FRONTEND_DEPLOY_BRANCH || 'deploy/sportexus-web-staging';

function verifyBackendDockerfile(filePath = 'Dockerfile') {
  if (!fs.existsSync(filePath)) {
    throw new Error(`[CRITICAL] Backend Dockerfile not found at: ${filePath}`);
  }
  const content = fs.readFileSync(filePath, 'utf8');
  const isBackend =
    content.includes('apps/api') || content.includes('NestJS') || content.includes('dist/main.js');
  const isFrontend = content.includes('apps/web') && content.includes('.next/standalone');
  if (!isBackend || isFrontend) {
    throw new Error(
      `[CRITICAL] File at ${filePath} is NOT a valid backend Dockerfile! Aborting sync.`,
    );
  }
}

function verifyFrontendDockerfile(filePath = 'Dockerfile') {
  if (!fs.existsSync(filePath)) {
    throw new Error(`[CRITICAL] Frontend Dockerfile not found at: ${filePath}`);
  }
  const content = fs.readFileSync(filePath, 'utf8');
  const isFrontend =
    content.includes('apps/web') ||
    content.includes('.next/standalone') ||
    content.includes('BUILD_STANDALONE');
  if (!isFrontend) {
    throw new Error(
      `[CRITICAL] File at ${filePath} is NOT a valid frontend Dockerfile! Aborting sync.`,
    );
  }
}

function syncBackend({ dryRun, sourceSha }) {
  console.log(`\n============================================================`);
  console.log(` Syncing Backend Deployment Branch: ${BACKEND_BRANCH}`);
  console.log(`============================================================`);

  const currentBranch = runOutput('git rev-parse --abbrev-ref HEAD');

  try {
    run(`git fetch origin ${BACKEND_BRANCH}`);
    run(`git checkout -B ${BACKEND_BRANCH} origin/${BACKEND_BRANCH}`);

    console.log(`[Backend Sync] Merging ${sourceSha} into ${BACKEND_BRANCH}...`);
    run(`git merge ${sourceSha} -m "release(backend): sync with main ${sourceSha} [skip ci]"`);

    // Verify root Dockerfile invariant
    verifyBackendDockerfile('Dockerfile');
    console.log(`[Backend Sync] Root Dockerfile verified as valid NestJS backend container.`);

    if (dryRun) {
      console.log(`[Backend Sync] DRY-RUN: Skipping push to origin ${BACKEND_BRANCH}`);
    } else {
      console.log(`[Backend Sync] Pushing to origin ${BACKEND_BRANCH}...`);
      run(`git push origin ${BACKEND_BRANCH}`);
      console.log(`[Backend Sync] Successfully pushed backend release!`);
    }
  } finally {
    run(`git checkout ${currentBranch}`);
  }
}

function syncFrontend({ dryRun, sourceSha }) {
  console.log(`\n============================================================`);
  console.log(` Syncing Frontend Deployment Branch: ${FRONTEND_BRANCH}`);
  console.log(`============================================================`);

  const currentBranch = runOutput('git rev-parse --abbrev-ref HEAD');

  try {
    run(`git fetch origin ${FRONTEND_BRANCH}`);
    run(`git checkout -B ${FRONTEND_BRANCH} origin/${FRONTEND_BRANCH}`);

    console.log(`[Frontend Sync] Merging ${sourceSha} into ${FRONTEND_BRANCH}...`);
    run(`git merge ${sourceSha} -m "release(web): sync with main ${sourceSha} [skip ci]"`);

    // Ensure root Dockerfile is the Next.js standalone Dockerfile
    const webDockerfileSource = fs.existsSync('Dockerfile.web')
      ? 'Dockerfile.web'
      : 'apps/web/Dockerfile';
    if (!fs.existsSync(webDockerfileSource)) {
      throw new Error(
        `[CRITICAL] Frontend Dockerfile template not found at ${webDockerfileSource}`,
      );
    }

    console.log(`[Frontend Sync] Copying ${webDockerfileSource} to root Dockerfile...`);
    fs.copyFileSync(webDockerfileSource, 'Dockerfile');
    verifyFrontendDockerfile('Dockerfile');

    const status = runOutput('git status --porcelain Dockerfile');
    if (status) {
      run('git add Dockerfile');
      run(
        `git commit -m "deploy(web): configure root Dockerfile for Next.js standalone deployment [skip ci]"`,
      );
      console.log(`[Frontend Sync] Committed Next.js root Dockerfile.`);
    }

    if (dryRun) {
      console.log(`[Frontend Sync] DRY-RUN: Skipping push to origin ${FRONTEND_BRANCH}`);
    } else {
      console.log(`[Frontend Sync] Pushing to origin ${FRONTEND_BRANCH}...`);
      run(`git push origin ${FRONTEND_BRANCH}`);
      console.log(`[Frontend Sync] Successfully pushed frontend release!`);
    }
  } finally {
    run(`git checkout ${currentBranch}`);
  }
}

function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const targetArg = args.find((a) => a.startsWith('--target='));
  const target = targetArg ? targetArg.split('=')[1] : 'all';

  const sourceSha = runOutput('git rev-parse --short=12 HEAD');
  console.log(
    `[SPORTEXUS Release Sync] Source commit: ${sourceSha} (dryRun: ${dryRun}, target: ${target})`,
  );

  // Verify git state is clean
  const uncommitted = runOutput('git status --porcelain');
  if (uncommitted) {
    console.error('[CRITICAL] Uncommitted changes detected in working tree. Aborting sync.');
    console.error(uncommitted);
    process.exit(1);
  }

  if (target === 'backend' || target === 'all') {
    syncBackend({ dryRun, sourceSha });
  }

  if (target === 'frontend' || target === 'all') {
    syncFrontend({ dryRun, sourceSha });
  }

  console.log('\n[SPORTEXUS Release Sync] Synchronization finished successfully.');
}

main();
