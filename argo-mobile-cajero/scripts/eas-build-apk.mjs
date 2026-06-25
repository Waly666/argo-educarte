/**
 * EAS Build desde monorepo: sube solo esta app (no todo ARGO-EDUCARTE).
 * Uso: node scripts/eas-build-apk.mjs [preview|production]
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const profile = process.argv[2] || 'preview';

const env = {
  ...process.env,
  EAS_NO_VCS: '1',
  EAS_PROJECT_ROOT: appRoot,
};

const result = spawnSync(
  'pnpm',
  ['dlx', 'eas-cli@18.13.0', 'build', '--platform', 'android', '--profile', profile, '--non-interactive'],
  { cwd: appRoot, env, stdio: 'inherit', shell: true },
);

process.exit(result.status ?? 1);
