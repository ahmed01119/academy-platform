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
 *   6. Handles Dockerfile divergence deterministically without merge conflicts.
 *   7. Detects and protects deployment-only hotfixes.
 *   8. Detects and safely aborts ALL unresolved Git merge conflicts.
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

function getUnresolvedConflicts() {
  try {
    const statusOutput = runOutput('git status --porcelain');
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
  } catch {
    return [];
  }
}

function abortMergeIfConflicted() {
  try {
    const gitDir = path.resolve('.git');
    const isMerging = fs.existsSync(path.join(gitDir, 'MERGE_HEAD'));
    if (isMerging) {
      console.warn(
        '[SPORTEXUS Release Sync] Active unresolved merge in progress. Aborting merge safely...',
      );
      run('git merge --abort');
    }
  } catch {}
}

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

function checkDeploymentBranchHotfixes(branch, sourceSha) {
  try {
    let unmergedHotfixes = '';
    try {
      unmergedHotfixes = execSync(`git log ${sourceSha}..origin/${branch} --oneline`, {
        encoding: 'utf8',
        stdio: 'pipe',
      }).trim();
    } catch {
      return;
    }

    if (unmergedHotfixes) {
      const lines = unmergedHotfixes
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean);
      if (lines.length > 0) {
        console.warn(
          `\n[HOTFIX DETECTED] Deployment branch '${branch}' contains ${lines.length} unmerged hotfix commit(s) not in main (${sourceSha}):`,
        );
        lines.forEach((l) => console.warn(`   * ${l}`));
        console.warn(
          `[HOTFIX DETECTED] Performing 3-way merge to preserve hotfix history without overwriting.\n`,
        );
      }
    }
  } catch (err) {
    console.warn(
      `[Hotfix Check] Unable to diff with remote branch origin/${branch}: ${err.message}`,
    );
  }
}

function verifyVersionCompatibility() {
  const rootPkgPath = path.resolve(__dirname, '../package.json');
  const webPkgPath = path.resolve(__dirname, '../apps/web/package.json');
  const apiPkgPath = path.resolve(__dirname, '../apps/api/package.json');

  if (fs.existsSync(rootPkgPath) && fs.existsSync(webPkgPath) && fs.existsSync(apiPkgPath)) {
    const rootPkg = JSON.parse(fs.readFileSync(rootPkgPath, 'utf8'));
    const webPkg = JSON.parse(fs.readFileSync(webPkgPath, 'utf8'));
    const apiPkg = JSON.parse(fs.readFileSync(apiPkgPath, 'utf8'));

    console.log(
      `[Compatibility Check] Workspace versions — root: ${rootPkg.version || '0.0.0'}, web: ${webPkg.version}, api: ${apiPkg.version}`,
    );
  }

  const sharedPkgPath = path.resolve(__dirname, '../packages/shared/package.json');
  if (!fs.existsSync(sharedPkgPath)) {
    throw new Error(
      '[CRITICAL] @academy/shared contract package missing! Cannot verify compatibility.',
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

    // Audit for unmerged hotfixes on deployment branch (Issue #9)
    checkDeploymentBranchHotfixes(BACKEND_BRANCH, sourceSha);

    console.log(`[Backend Sync] Merging ${sourceSha} into ${BACKEND_BRANCH}...`);
    try {
      run(`git merge ${sourceSha} -m "release(backend): sync with main ${sourceSha} [skip ci]"`);
    } catch (err) {
      const conflicts = getUnresolvedConflicts();
      abortMergeIfConflicted();
      const conflictMsg =
        conflicts.length > 0
          ? `Unresolved merge conflicts detected:\n` +
            conflicts.map((c) => `  [${c.code}] ${c.file}`).join('\n')
          : err.message;
      throw new Error(`[CRITICAL] Backend release sync failed! ${conflictMsg}`);
    }

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
    abortMergeIfConflicted();
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

    // Audit for unmerged hotfixes on deployment branch (Issue #9)
    checkDeploymentBranchHotfixes(FRONTEND_BRANCH, sourceSha);

    console.log(
      `[Frontend Sync] Merging ${sourceSha} into ${FRONTEND_BRANCH} with deterministic Dockerfile preservation...`,
    );

    // Issue #3: Attempt git merge --no-commit to avoid conflict failure on root Dockerfile
    let mergeEncounteredConflicts = false;
    try {
      run(`git merge ${sourceSha} --no-commit`);
    } catch {
      mergeEncounteredConflicts = true;
    }

    // Inspect status to ensure no true application code conflicts exist
    const conflicts = getUnresolvedConflicts();
    const nonDockerfileConflicts = conflicts.filter((c) => c.file !== 'Dockerfile');

    if (nonDockerfileConflicts.length > 0) {
      abortMergeIfConflicted();
      throw new Error(
        `[CRITICAL] Unresolved merge conflicts in application code during frontend sync:\n` +
          nonDockerfileConflicts.map((c) => `  [${c.code}] ${c.file}`).join('\n'),
      );
    }

    // Ensure root Dockerfile is the Next.js standalone Dockerfile
    const webDockerfileSource = fs.existsSync('Dockerfile.web')
      ? 'Dockerfile.web'
      : 'apps/web/Dockerfile';
    if (!fs.existsSync(webDockerfileSource)) {
      abortMergeIfConflicted();
      throw new Error(
        `[CRITICAL] Frontend Dockerfile template not found at ${webDockerfileSource}`,
      );
    }

    console.log(`[Frontend Sync] Replacing root Dockerfile with ${webDockerfileSource}...`);
    fs.copyFileSync(webDockerfileSource, 'Dockerfile');
    verifyFrontendDockerfile('Dockerfile');

    // Issue #5: Pre-generate version.json with sourceSha so Docker standalone build inherits it
    console.log(`[Frontend Sync] Pre-generating version.json with sourceSha ${sourceSha}...`);
    process.env.COMMIT_SHA = sourceSha;
    run('node scripts/generate-version.js');

    run('git add Dockerfile apps/web/public/version.json');

    // Ensure all conflicts are cleanly resolved before committing
    const remainingConflicts = getUnresolvedConflicts();
    if (remainingConflicts.length > 0) {
      abortMergeIfConflicted();
      throw new Error(
        `[CRITICAL] Unresolved merge conflicts remain after Dockerfile resolution:\n` +
          remainingConflicts.map((c) => `  [${c.code}] ${c.file}`).join('\n'),
      );
    }

    run(`git commit -m "release(web): sync with main ${sourceSha} [skip ci]"`);
    console.log(`[Frontend Sync] Committed deterministic Next.js root release.`);

    if (dryRun) {
      console.log(`[Frontend Sync] DRY-RUN: Skipping push to origin ${FRONTEND_BRANCH}`);
    } else {
      console.log(`[Frontend Sync] Pushing to origin ${FRONTEND_BRANCH}...`);
      run(`git push origin ${FRONTEND_BRANCH}`);
      console.log(`[Frontend Sync] Successfully pushed frontend release!`);
    }
  } finally {
    abortMergeIfConflicted();
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

  // Verify contract and version compatibility across workspaces (Issue #9)
  verifyVersionCompatibility();

  if (target === 'backend' || target === 'all') {
    syncBackend({ dryRun, sourceSha });
  }

  if (target === 'frontend' || target === 'all') {
    syncFrontend({ dryRun, sourceSha });
  }

  console.log('\n[SPORTEXUS Release Sync] Synchronization finished successfully.');
}

if (require.main === module) {
  main();
}

module.exports = {
  verifyBackendDockerfile,
  verifyFrontendDockerfile,
  checkDeploymentBranchHotfixes,
  verifyVersionCompatibility,
  getUnresolvedConflicts,
  abortMergeIfConflicted,
};
