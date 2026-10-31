/**
 * SPORTEXUS — Version Manifest & Service Worker Stamping Generator
 *
 * Generates apps/web/public/version.json before Next.js build.
 * Exposes non-sensitive build metadata (buildId, version, builtAt).
 * Stamps apps/web/public/sw.js with the buildId to guarantee browser SW byte-diff
 * and automatic cache-purge on release activation.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

function getExistingManifest() {
  try {
    const targetPath = path.resolve(__dirname, '../apps/web/public/version.json');
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

function main() {
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

  const targetDir = path.resolve(__dirname, '../apps/web/public');
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  const targetPath = path.join(targetDir, 'version.json');
  fs.writeFileSync(targetPath, JSON.stringify(manifest, null, 2) + '\n', 'utf8');
  console.log(`[Version Generator] Generated ${targetPath}:`, manifest);

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

main();
