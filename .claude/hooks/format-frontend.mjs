// PostToolUse hook: formats a frontend file with the project's Prettier right after Claude edits it.
// Never blocks: a formatting failure is reported but the edit stands.
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { isAbsolute, join, relative, resolve } from 'node:path';

const FORMATTED = /\.(ts|html|css|scss|json)$/;

const input = JSON.parse(readFileSync(0, 'utf8'));
const file = input.tool_input?.file_path;
const root = process.env.CLAUDE_PROJECT_DIR ?? input.cwd ?? process.cwd();
const frontend = join(root, 'frontend');
const prettier = join(frontend, 'node_modules', 'prettier', 'bin', 'prettier.cjs');

const rel = file ? relative(frontend, resolve(file)) : '';
const inFrontend = rel !== '' && !rel.startsWith('..') && !isAbsolute(rel); // other drive on Windows: absolute
if (!inFrontend || !FORMATTED.test(file) || /node_modules|package-lock\.json$/.test(file) || !existsSync(prettier)) {
  process.exit(0);
}

try {
  execFileSync(process.execPath, [prettier, '--write', '--log-level', 'warn', resolve(file)], {
    cwd: frontend,
    stdio: ['ignore', 'ignore', 'pipe'],
  });
} catch (error) {
  console.error(`Prettier could not format ${file}: ${error.stderr ?? error.message}`);
}
