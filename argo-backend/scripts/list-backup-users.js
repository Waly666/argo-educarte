const unzipper = require('unzipper');
const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '..', 'backups');

(async () => {
  const zips = fs.readdirSync(dir).filter((f) => f.endsWith('.zip')).sort();
  for (const z of zips) {
    const zip = await unzipper.Open.file(path.join(dir, z));
    const f = zip.files.find((x) => x.path === 'db/usuarios.jsonl');
    if (!f) {
      console.log(z, '(sin usuarios)');
      continue;
    }
    const buf = await f.buffer();
    const users = buf
      .toString()
      .split('\n')
      .filter(Boolean)
      .map((l) => JSON.parse(l))
      .filter((u) => u.rol === 'admin' || /waly/i.test(u.username))
      .map((u) => u.username);
    console.log(z, users.join(', ') || '(ninguno)');
  }
})();
