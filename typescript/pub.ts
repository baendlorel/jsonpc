import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { execSync } from 'node:child_process';

class Version {
  major: number;
  minor: number;
  patch: number;

  constructor(public version: string) {
    const [major, minor, patch] = version.split('.').map(Number);
    this.major = major;
    this.minor = minor;
    this.patch = patch;
  }

  bump() {
    this.patch++;
    return this;
  }

  toString() {
    return `${this.major}.${this.minor}.${this.patch}`;
  }
}

const pkg = JSON.parse(readFileSync(join(import.meta.dirname, 'package.json'), 'utf-8'));
pkg.version = new Version(pkg.version).bump().toString();

writeFileSync(join(import.meta.dirname, 'package.json'), JSON.stringify(pkg, null, 2) + '\n', 'utf-8');

const readme = readFileSync(join(import.meta.dirname, '..', 'README.md'), 'utf-8');
writeFileSync(
  join(import.meta.dirname, 'README.md'),
  readme.replace(`src="./assets/jsonpc.png"`, `src="../assets/jsonpc.png"`),
  'utf-8',
);

execSync(`pnpm build`, { cwd: import.meta.dirname });
execSync(`npm publish`, { cwd: import.meta.dirname });
