/** Genera argo-alerta.wav: dos tonos ascendentes (reconocible, ~0.6s). */
const fs = require('fs');
const path = require('path');

const sampleRate = 22050;
const volume = 0.35;

function tone(freq, startSec, durSec) {
  const start = Math.floor(startSec * sampleRate);
  const len = Math.floor(durSec * sampleRate);
  const buf = new Float32Array(len);
  for (let i = 0; i < len; i++) {
    const t = i / sampleRate;
    const env = Math.min(1, i / 200) * Math.max(0, 1 - (i - len + 400) / 400);
    buf[i] = Math.sin(2 * Math.PI * freq * t) * volume * env;
  }
  return { start, buf };
}

const t1 = tone(523.25, 0, 0.22);
const t2 = tone(783.99, 0.28, 0.32);
const total = t2.start + t2.buf.length;
const mix = new Float32Array(total);
for (let i = 0; i < t1.buf.length; i++) mix[t1.start + i] += t1.buf[i];
for (let i = 0; i < t2.buf.length; i++) mix[t2.start + i] += t2.buf[i];

const pcm = Buffer.alloc(mix.length * 2);
for (let i = 0; i < mix.length; i++) {
  const s = Math.max(-1, Math.min(1, mix[i]));
  pcm.writeInt16LE((s < 0 ? s * 0x8000 : s * 0x7fff) | 0, i * 2);
}

const header = Buffer.alloc(44);
header.write('RIFF', 0);
header.writeUInt32LE(36 + pcm.length, 4);
header.write('WAVE', 8);
header.write('fmt ', 12);
header.writeUInt32LE(16, 16);
header.writeUInt16LE(1, 20);
header.writeUInt16LE(1, 22);
header.writeUInt32LE(sampleRate, 24);
header.writeUInt32LE(sampleRate * 2, 28);
header.writeUInt16LE(2, 32);
header.writeUInt16LE(16, 34);
header.write('data', 36);
header.writeUInt32LE(pcm.length, 40);

const out = path.join(__dirname, '..', 'assets', 'sounds', 'argo-alerta.wav');
fs.writeFileSync(out, Buffer.concat([header, pcm]));
console.log('Wrote', out, pcm.length, 'bytes PCM');
