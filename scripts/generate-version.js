/**
 * SPORTEXUS — Version Manifest Generator
 *
 * Generates apps/web/public/version.json before Next.js build.
 * Exposes non-sensitive build metadata (buildId, version, builtAt).
 * Client-side AppUpdateNotifier uses this to detect new releases without querying Neon.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

function getCommitSha() {
  if (process.env.GITHUB_SHA) {
    return process.env.GITHUB_SHA.slice(0, 12);
  }
  try {
    return execSync('git rev-parse --short=12 HEAD', { encoding: 'utf8' }).trim();
  } catch {
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
  const buildId = process.env.BUILD_ID || `${commitSha}-${Date.now().toString(36)}`;
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
}

main();
