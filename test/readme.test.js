const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('README documents the project title', () => {
  const readmePath = path.join(__dirname, '..', 'README.md');
  const readme = fs.readFileSync(readmePath, 'utf8');

  assert.match(readme, /^# Prueba/m);
});
