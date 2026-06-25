const unzipper = require('unzipper');
const path = require('path');

const p = process.argv[2] || path.join(__dirname, '../backups/argo-respaldo-20260612-201355-pre-reset.zip');

unzipper.Open.file(p).then(async (z) => {
  const f = z.files.find((x) => x.path === 'db/config.jsonl');
  if (!f) {
    console.log('no config.jsonl');
    return;
  }
  const buf = await f.buffer();
  const lines = buf.toString().split(/\n/).filter(Boolean);
  const keys = {};
  const dups = [];
  for (const l of lines) {
    const m = l.match(/"clave"\s*:\s*"([^"]+)"/);
    if (!m) continue;
    const k = m[1];
    if (keys[k]) dups.push(k);
    keys[k] = (keys[k] || 0) + 1;
  }
  console.log('file', path.basename(p));
  console.log('config lines', lines.length);
  console.log('duplicate claves', [...new Set(dups)]);
});
