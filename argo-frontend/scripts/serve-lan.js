/**
 * Inicia ng serve escuchando en la IP de la LAN (no solo localhost).
 */
const { spawn } = require('child_process');
const os = require('os');

function lanIp() {
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] || []) {
      if (net.family === 'IPv4' && !net.internal) {
        return net.address;
      }
    }
  }
  return '0.0.0.0';
}

const ip = lanIp();
const port = process.env.PORT || '4200';
/** 0.0.0.0 permite localhost y acceso LAN; --host con IP fija rompe localhost en Windows. */
const bindHost = process.env.ARGO_SERVE_HOST || '0.0.0.0';

console.log('');
console.log('[ARGO Frontend]');
console.log(`  Local:  http://localhost:${port}/login`);
console.log(`  Red:    http://${ip}:${port}/login`);
console.log('  (Desde otro PC use la URL de Red)');
console.log('');

const ng = process.platform === 'win32' ? 'ng.cmd' : 'ng';
const child = spawn(
  ng,
  ['serve', '--host', bindHost, '--port', port, '--disable-host-check'],
  { stdio: 'inherit', shell: true, cwd: require('path').join(__dirname, '..') },
);

child.on('exit', (code) => process.exit(code ?? 0));
