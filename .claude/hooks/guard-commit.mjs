// PreToolUse hook on Bash: blocks a git add / git commit that would version secrets, IDE metadata or
// personal Claude Code settings (rule 2 of CLAUDE.md). Exit code 2 cancels the command and tells Claude why.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const FORBIDDEN = [
  { pattern: /(^|[\/\s])\.env(\.(?!example\b)[\w.-]+)?(\s|$)/, reason: 'environment file' },
  { pattern: /\.(pem|key)(\s|$)/, reason: 'private key' },
  { pattern: /(^|[\/\s])\.idea\/|\.iml(\s|$)/, reason: 'IntelliJ metadata' },
  { pattern: /(^|\s)\.vscode\//, reason: 'editor metadata (only frontend/.vscode/ is versioned)' },
  { pattern: /\.claude\/settings\.local\.json/, reason: 'personal Claude Code settings' },
  { pattern: /CLAUDE\.local\.md/, reason: 'personal Claude Code memory' },
];

const command = JSON.parse(readFileSync(0, 'utf8')).tool_input?.command ?? '';
if (!/\bgit\s+(add|commit)\b/.test(command)) process.exit(0);

if (/\bgit\s+add\s+(-A|--all|\.)(\s|$)/.test(command)) {
  console.error('Stage files by name instead of "git add -A" / "git add ." (see the commit skill).');
  process.exit(2);
}

const violations = new Set();
const check = (text) => {
  const normalized = ` ${text.replace(/\\/g, '/')} `;
  for (const { pattern, reason } of FORBIDDEN) {
    if (pattern.test(normalized)) violations.add(`${text.trim()} (${reason})`);
  }
};

for (const part of command.split(/&&|;|\|\|/)) {
  if (/\bgit\s+add\b/.test(part)) check(part.replace(/.*\bgit\s+add\b/, ''));
}

if (/\bgit\s+commit\b/.test(command)) {
  try {
    const staged = execFileSync('git', ['diff', '--cached', '--name-only'], { encoding: 'utf8' });
    staged.split('\n').filter(Boolean).forEach(check);
  } catch {
    // Not a repository or git unavailable: nothing staged to check.
  }
}

if (violations.size > 0) {
  console.error(`Blocked: these files must never be committed:\n- ${[...violations].join('\n- ')}`);
  process.exit(2);
}
