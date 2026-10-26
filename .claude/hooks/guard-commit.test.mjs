// Runs the guard-commit hook as Claude Code does (JSON on stdin) against a throwaway repository.
// Usage: node --test .claude/hooks/*.test.mjs
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { after, before, describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';

const HOOK = join(dirname(fileURLToPath(import.meta.url)), 'guard-commit.mjs');
let repo;

function run(command, cwd = repo) {
  const input = JSON.stringify({ cwd, tool_input: { command } });
  return spawnSync(process.execPath, [HOOK], { input, encoding: 'utf8' }).status;
}

function file(path, content = 'x') {
  mkdirSync(dirname(join(repo, path)), { recursive: true });
  writeFileSync(join(repo, path), content);
}

before(() => {
  repo = mkdtempSync(join(tmpdir(), 'guard-commit-'));
  execFileSync('git', ['init', '-q'], { cwd: repo });
  ['backend/.env', 'backend/.env.local', '.env.example', 'certs/a.pem', '.idea/workspace.xml', '.vscode/settings.json',
   'backend/.vscode/launch.json', 'frontend/.vscode/mcp.json', '.claude/settings.local.json', 'README.md',
   'backend/src/App.java'].forEach((p) => file(p));
});

after(() => rmSync(repo, { recursive: true, force: true }));

describe('blocks forbidden paths however they are named', () => {
  for (const command of [
    'git add backend/.env',
    'git add "backend/.env"',
    "git add 'backend/.env.local'",
    'git add backend/',
    'git add backend/ && git commit -m x',
    'git add certs/a.pem',
    'git add .idea',
    'git add .vscode',
    'git add backend/.vscode',
    'git add .claude/settings.local.json',
    'git stage backend/.env',
    'git -C backend add .env',
    'git add "backend/*.env*"',
  ]) {
    test(command, () => assert.equal(run(command), 2));
  }
});

describe('blocks blanket staging', () => {
  for (const command of ['git add -A', 'git add .', 'git add --all', 'git add :/']) {
    test(command, () => assert.equal(run(command), 2));
  }
});

describe('allows legitimate commands', () => {
  for (const command of [
    'git add README.md backend/src/App.java',
    'git add .env.example',
    'git add frontend/.vscode/mcp.json',
    'git commit -m "docs: explain git add . and .env handling"',
    "git commit -m \"$(cat <<'EOF'\ndocs: never git add -A\nEOF\n)\"",
    'git status',
    'ls -la',
  ]) {
    test(command, () => assert.equal(run(command), 0));
  }
});

test('blocks a commit when a forbidden file is already staged', () => {
  execFileSync('git', ['add', '-f', 'backend/.env'], { cwd: repo });
  try {
    assert.equal(run('git commit -m "chore: tidy"'), 2);
  } finally {
    execFileSync('git', ['reset', '-q', 'backend/.env'], { cwd: repo });
  }
});

test('fails open on malformed input', () => {
  assert.equal(spawnSync(process.execPath, [HOOK], { input: 'not json' }).status, 0);
});
