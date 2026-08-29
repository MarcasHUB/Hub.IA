import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const suspicious = /Ã[£§µ¡©ª­ºš‰]|â[”€]|Â·/u;

function frontendFiles(directory: string): string[] {
  return readdirSync(directory).flatMap(name => {
    const path = join(directory, name);
    if (path.includes(join('infrastructure', 'supabase', 'migrations'))) return [];
    return statSync(path).isDirectory()
      ? frontendFiles(path)
      : /\.(ts|tsx|css|html)$/u.test(name) ? [path] : [];
  });
}

test('frontend source does not contain common mojibake sequences', () => {
  const affected = frontendFiles(join(process.cwd(), 'src'))
    .filter(path => suspicious.test(readFileSync(path, 'utf8')));
  assert.deepEqual(affected, []);
});
