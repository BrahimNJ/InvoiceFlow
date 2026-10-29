// Writes a shields.io endpoint file: node badge.mjs <out.json> <label> <message> [color]
// A message like "96.48%" is shown with one decimal and coloured by threshold unless a colour is given.
import { writeFileSync } from 'node:fs';

const [out, label, message, color] = process.argv.slice(2);
if (!out || !label || !message) {
  console.error('Usage: node badge.mjs <out.json> <label> <message> [color]');
  process.exit(1);
}

const percent = /^(\d+(?:\.\d+)?)%$/.exec(message);
const value = percent ? Number(percent[1]) : null;
const badge = {
  schemaVersion: 1,
  label,
  message: value === null ? message : `${value.toFixed(1)} %`,
  color: color ?? (value === null ? 'brightgreen' : value >= 95 ? 'brightgreen' : value >= 85 ? 'green' : 'orange'),
};
writeFileSync(out, JSON.stringify(badge) + '\n');
console.log(`${out}: ${label} ${badge.message}`);
