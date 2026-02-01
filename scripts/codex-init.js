const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const files = [
  'docs/CODEX_INIT.md',
  'docs/PROJECT_PLAN.md'
];

for (const file of files) {
  const fullPath = path.join(root, file);
  if (!fs.existsSync(fullPath)) {
    console.log(`[missing] ${file}`);
    continue;
  }
  const content = fs.readFileSync(fullPath, 'utf8');
  console.log(`\n===== ${file} =====\n`);
  console.log(content.trim());
}
