const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const dist = path.join(root, 'dist');

const entries = [
  'index.html',
  'about.html',
  'account.html',
  'leaderboard.html',
  'admin.html',
  '_headers',
  'src',
  'assets',
  'data'
];

fs.rmSync(dist, { recursive: true, force: true });
fs.mkdirSync(dist, { recursive: true });

for (const entry of entries) {
  const source = path.join(root, entry);
  const target = path.join(dist, entry);

  if (!fs.existsSync(source)) {
    throw new Error(`Missing build input: ${entry}`);
  }

  fs.cpSync(source, target, {
    recursive: true,
    filter: filePath => !filePath.endsWith('.DS_Store')
  });
}

console.log(`Built static app in ${path.relative(root, dist)}`);
