// PostToolUse hook: formats a frontend file with the project's Prettier right after Claude edits it.
// Never blocks: a formatting failure is reported but the edit stands.
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

const FORMATTED = /\.(ts|html|css|scss|json)$/;

const input = JSON.parse(readFileSync(0, 'utf8'));
const file = input.tool_input?.file_path;
const root = process.env.CLAUDE_PROJECT_DIR ?? input.cwd ?? process.cwd();
const frontend = join(root, 'frontend');
const prettier = join(frontend, 'node_modules', 'prettier', 'bin', 'prettier.cjs');

const inFrontend = file && !relative(frontend, resolve(file)).startsWith('..');
if (!inFrontend || !FORMATTED.test(file) || file.includes('node_modules') || !existsSync(prettier)) {
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
