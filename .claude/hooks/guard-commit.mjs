// PreToolUse hook on Bash: blocks a git add / git commit that would version secrets, IDE metadata or
// personal Claude Code settings (rule 2 of CLAUDE.md). Exit code 2 cancels the command and tells Claude why.
//
// The hook does not trust the command text: it asks git which paths each `git add` would stage
// (`git add --dry-run`) and checks those, plus what is already staged when a commit runs. Directories,
// globs and quoted paths are resolved exactly as git resolves them; commit messages are never scanned.
// Tests: node --test .claude/hooks/*.test.mjs
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const FORBIDDEN = [
  { test: (p) => /(^|\/)\.env(\.[^/]+)?$/.test(p) && !p.endsWith('.env.example'), reason: 'environment file' },
  { test: (p) => /\.(pem|key)$/.test(p), reason: 'private key' },
  { test: (p) => /(^|\/)\.idea\//.test(p) || /\.(iml|iws|ipr)$/.test(p), reason: 'IntelliJ metadata' },
  { test: (p) => /(^|\/)\.vscode\//.test(p) && !p.startsWith('frontend/.vscode/'), reason: 'editor metadata' },
  { test: (p) => /(^|\/)\.claude\/settings\.local\.json$/.test(p), reason: 'personal Claude Code settings' },
  { test: (p) => /(^|\/)CLAUDE\.local\.md$/.test(p), reason: 'personal Claude Code memory' },
];

const STAGE_ALL = new Set(['-A', '--all', '.', ':/', ':']);

/** Splits a shell command into the words of each simple command, honouring quotes and dropping heredoc bodies. */
function parseCommands(command) {
  const text = command.replace(/<<-?\s*(['"]?)(\w+)\1[^\n]*\n[\s\S]*?\n\s*\2(?=\s|$)/g, '');
  const commands = [[]];
  let word = null;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === "'" || c === '"') {
      const end = text.indexOf(c, i + 1);
      const stop = end < 0 ? text.length : end;
      word = (word ?? '') + text.slice(i + 1, stop);
      i = stop;
    } else if (/\s/.test(c) || '&|;()'.includes(c)) {
      if (word !== null) commands.at(-1).push(word);
      word = null;
      if (!/\s/.test(c)) commands.push([]);
    } else {
      word = (word ?? '') + c;
    }
  }
  if (word !== null) commands.at(-1).push(word);
  return commands.filter((words) => words.length > 0);
}

/** `git [-C dir] [-c k=v] <subcommand> args` → { subcommand, args, cwd }, or null. */
function gitInvocation(words, baseDir) {
  const start = words.indexOf('git');
  if (start < 0) return null;
  let cwd = baseDir;
  let i = start + 1;
  while (i < words.length && words[i].startsWith('-')) {
    if (words[i] === '-C' && words[i + 1]) cwd = resolve(cwd, words[++i]);
    else if (words[i] === '-c') i++;
    i++;
  }
  return words[i] ? { subcommand: words[i], args: words.slice(i + 1), cwd } : null;
}

function git(cwd, args) {
  return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
}

const lines = (text) => text.split('\n').map((l) => l.trim()).filter(Boolean);

/** Repository-relative paths a `git add <args>` would stage. */
function pathsAddedBy(cwd, args) {
  const pathspecs = args.filter((a) => a !== '--' && !a.startsWith('-'));
  if (pathspecs.length === 0) return [];
  const force = args.some((a) => a === '-f' || a === '--force') ? ['--force'] : [];
  try {
    const prefix = git(cwd, ['rev-parse', '--show-prefix']).trim();
    const out = git(cwd, ['add', '--dry-run', '--ignore-missing', ...force, '--', ...pathspecs]);
    return lines(out)
      .map((l) => l.match(/^add '(.+)'$/)?.[1])
      .filter(Boolean)
      .map((p) => prefix + p);
  } catch {
    return [];
  }
}

/** Repository-relative paths a commit would include beyond the index (`-a`). */
function pathsCommittedBy(cwd, args) {
  try {
    const staged = lines(git(cwd, ['diff', '--cached', '--name-only']));
    const all = args.some((a) => a === '--all' || /^-[a-zA-Z]*a[a-zA-Z]*$/.test(a));
    return all ? [...staged, ...lines(git(cwd, ['diff', '--name-only']))] : staged;
  } catch {
    return [];
  }
}

function main() {
  let input;
  try {
    input = JSON.parse(readFileSync(0, 'utf8'));
  } catch {
    // Fail open on malformed input: a broken hook must not block every shell command.
    process.exit(0);
  }
  const command = input.tool_input?.command ?? '';
  if (!/\bgit\b/.test(command)) process.exit(0);

  const baseDir = input.cwd ?? process.cwd();
  const violations = new Map();
  for (const words of parseCommands(command)) {
    const call = gitInvocation(words, baseDir);
    if (!call) continue;
    let paths = [];
    if (call.subcommand === 'add' || call.subcommand === 'stage') {
      if (call.args.some((a) => STAGE_ALL.has(a))) {
        console.error('Stage files by name instead of "git add -A" / "git add ." (see the commit skill).');
        process.exit(2);
      }
      paths = pathsAddedBy(call.cwd, call.args);
    } else if (call.subcommand === 'commit') {
      paths = pathsCommittedBy(call.cwd, call.args);
    }
    for (const path of paths.map((p) => p.replace(/\\/g, '/'))) {
      const rule = FORBIDDEN.find((r) => r.test(path));
      if (rule) violations.set(path, rule.reason);
    }
  }

  if (violations.size > 0) {
    const list = [...violations].map(([path, reason]) => `${path} (${reason})`).join('\n- ');
    console.error(`Blocked: these files must never be committed:\n- ${list}`);
    process.exit(2);
  }
}

main();
