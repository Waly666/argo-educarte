const os = require('os');

/** Direcciones IPv4 de esta máquina (Wi‑Fi / Ethernet), sin loopback */
function getLanIpv4() {
  const nets = os.networkInterfaces();
  const out = [];
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] || []) {
      if (net.family === 'IPv4' && !net.internal) {
        out.push({ name, address: net.address });
      }
    }
  }
  return out;
}

function primaryLanIp() {
  const list = getLanIpv4();
  return list[0]?.address || null;
}

module.exports = { getLanIpv4, primaryLanIp };
