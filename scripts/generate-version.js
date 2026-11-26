/**
 * SPORTEXUS — Version Manifest & Service Worker Stamping Generator
 *
 * Generates frontend/public/version.json before the Next.js build (release builds only, see shouldWriteManifest).
 * Exposes non-sensitive build metadata (buildId, version, builtAt).
 * Stamps frontend/public/sw.js with the buildId to guarantee browser SW byte-diff
 * and automatic cache-purge on release activation.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

function getExistingManifest() {
  try {
    const targetPath = path.resolve(__dirname, '../frontend/public/version.json');
    if (fs.existsSync(targetPath)) {
      return JSON.parse(fs.readFileSync(targetPath, 'utf8'));
    }
  } catch {}
  return null;
}

function getCommitSha() {
  if (process.env.COMMIT_SHA) {
    return process.env.COMMIT_SHA.slice(0, 12);
  }
  if (process.env.GITHUB_SHA) {
    return process.env.GITHUB_SHA.slice(0, 12);
  }
  try {
    return execSync('git rev-parse --short=12 HEAD', { encoding: 'utf8' }).trim();
  } catch {
    const existing = getExistingManifest();
    if (existing?.commitSha && !existing.commitSha.startsWith('standalone-')) {
      return existing.commitSha;
    }
    return 'standalone-' + Date.now().toString(36);
  }
}

function getPackageVersion() {
  try {
    const pkgPath = path.resolve(__dirname, '../package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    return pkg.version || '1.0.0';
  } catch {
    return '1.0.0';
  }
}

/**
 * Environment variables that identify a release build (CI, deploy pipeline, release-branch sync,
 * Docker build args). SPORTEXUS_STAMP_VERSION=1 forces regeneration on demand.
 */
const RELEASE_ENV_KEYS = ['COMMIT_SHA', 'GITHUB_SHA', 'BUILD_ID', 'CI', 'SPORTEXUS_STAMP_VERSION'];

/**
 * version.json and sw.js are tracked in git. Regenerating them on every local `next build` rewrote
 * tracked files (new commitSha/builtAt) and left the working tree dirty. Only release builds — or a
 * checkout where the manifest does not exist yet — need fresh metadata; a plain local build keeps
 * the existing manifest. The runtime only compares `buildId`, which is preserved either way.
 */
function shouldWriteManifest({ env, manifestExists }) {
  if (!manifestExists) return true;
  return RELEASE_ENV_KEYS.some((key) => {
    const value = env[key];
    return typeof value === 'string' && value.trim() !== '' && value !== '0' && value !== 'false';
  });
}

function main() {
  const targetDir = path.resolve(__dirname, '../frontend/public');
  const manifestPath = path.join(targetDir, 'version.json');
  if (!shouldWriteManifest({ env: process.env, manifestExists: fs.existsSync(manifestPath) })) {
    console.log(
      '[Version Generator] Local build: keeping existing version.json and sw.js (set SPORTEXUS_STAMP_VERSION=1 to regenerate).',
    );
    return;
  }

  const version = getPackageVersion();
  const commitSha = getCommitSha();
  const existing = getExistingManifest();
  const buildId =
    process.env.BUILD_ID ||
    (existing?.buildId && !existing.buildId.startsWith('standalone-')
      ? existing.buildId
      : `${commitSha}-${Date.now().toString(36)}`);
  const builtAt = new Date().toISOString();

  const manifest = {
    name: 'SPORTEXUS',
    version,
    buildId,
    commitSha,
    builtAt,
  };

  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n', 'utf8');
  console.log(`[Version Generator] Generated ${manifestPath}:`, manifest);

  // Stamp sw.js with the buildId so browsers detect byte change and trigger lifecycle update
  const swPath = path.join(targetDir, 'sw.js');
  if (fs.existsSync(swPath)) {
    let swContent = fs.readFileSync(swPath, 'utf8');
    const updatedSw = swContent.replace(
      /const VERSION = ['"][^'"]+['"];/,
      `const VERSION = 'sportexus-shell-${buildId}';`,
    );
    if (updatedSw !== swContent) {
      fs.writeFileSync(swPath, updatedSw, 'utf8');
      console.log(`[Version Generator] Stamped ${swPath} with VERSION: sportexus-shell-${buildId}`);
    }
  }
}

module.exports = { shouldWriteManifest, RELEASE_ENV_KEYS };

if (require.main === module) {
  main();
}
