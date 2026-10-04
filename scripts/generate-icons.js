import fs from 'fs';
import path from 'path';
import zlib from 'zlib';

function createPNG(width, height, isMaskable = false) {
  // RGBA buffer
  const rowBytes = width * 4;
  const rawBuffer = Buffer.alloc(height * (rowBytes + 1));

  const centerX = width / 2;
  const centerY = height / 2;
  const radius = width * (isMaskable ? 0.35 : 0.42);
  const innerRadius = radius * 0.7;

  let offset = 0;
  for (let y = 0; y < height; y++) {
    rawBuffer[offset++] = 0; // Filter type 0 (None)

    for (let x = 0; x < width; x++) {
      const dx = x - centerX;
      const dy = y - centerY;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // Default dark theme background (#020617)
      let r = 2;
      let g = 6;
      let b = 23;
      let a = 255;

      if (dist < radius) {
        // Indigo gradient emblem (#6366f1)
        const t = Math.min(1, Math.max(0, dist / radius));
        r = Math.round(99 * (1 - t * 0.3));
        g = Math.round(102 * (1 - t * 0.3));
        b = Math.round(241 * (1 - t * 0.2));

        // White 'A' letterform pattern in center
        const nx = (x - centerX) / innerRadius;
        const ny = (y - centerY) / innerRadius;

        // Simple stylized 'A' check
        const inLeftLeg = Math.abs(ny - (nx * 2 + 0.5)) < 0.25 && ny > -0.7 && ny < 0.7;
        const inRightLeg = Math.abs(ny - (-nx * 2 + 0.5)) < 0.25 && ny > -0.7 && ny < 0.7;
        const inBar = Math.abs(ny - 0.1) < 0.12 && Math.abs(nx) < 0.38;

        if (inLeftLeg || inRightLeg || inBar) {
          r = 255;
          g = 255;
          b = 255;
        }

        // Emerald accent dot on top right
        const dotDist = Math.sqrt(Math.pow(nx - 0.45, 2) + Math.pow(ny + 0.5, 2));
        if (dotDist < 0.18) {
          r = 16;
          g = 185;
          b = 129;
        }
      }

      rawBuffer[offset++] = r;
      rawBuffer[offset++] = g;
      rawBuffer[offset++] = b;
      rawBuffer[offset++] = a;
    }
  }

  // Compress with zlib
  const compressed = zlib.deflateSync(rawBuffer);

  // Helper for CRC32
  const crcTable = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      if (c & 1) c = 0xedb88320 ^ (c >>> 1);
      else c = c >>> 1;
    }
    crcTable[n] = c;
  }

  function crc32(buf) {
    let c = 0xffffffff;
    for (let i = 0; i < buf.length; i++) {
      c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
    }
    return (c ^ 0xffffffff) >>> 0;
  }

  function makeChunk(type, data) {
    const len = data.length;
    const chunk = Buffer.alloc(12 + len);
    chunk.writeUInt32BE(len, 0);
    chunk.write(type, 4, 4, 'ascii');
    data.copy(chunk, 8);
    const crc = crc32(chunk.subarray(4, 8 + len));
    chunk.writeUInt32BE(crc, 8 + len);
    return chunk;
  }

  // PNG Signature
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  // IHDR
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // Bit depth
  ihdr[9] = 6; // Color type (RGBA)
  ihdr[10] = 0; // Compression
  ihdr[11] = 0; // Filter
  ihdr[12] = 0; // Interlace

  const ihdrChunk = makeChunk('IHDR', ihdr);
  const idatChunk = makeChunk('IDAT', compressed);
  const iendChunk = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

const publicDir = path.resolve('public');
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

// 1. 192x192 PNG
fs.writeFileSync(path.join(publicDir, 'pwa-192x192.png'), createPNG(192, 192, false));
console.log('Created pwa-192x192.png');

// 2. 512x512 PNG
fs.writeFileSync(path.join(publicDir, 'pwa-512x512.png'), createPNG(512, 512, false));
console.log('Created pwa-512x512.png');

// 3. Maskable 512x512 PNG (with 15% safe zone margin)
fs.writeFileSync(path.join(publicDir, 'pwa-maskable-512x512.png'), createPNG(512, 512, true));
console.log('Created pwa-maskable-512x512.png');

// 4. Apple Touch Icon (180x180 PNG)
fs.writeFileSync(path.join(publicDir, 'apple-touch-icon.png'), createPNG(180, 180, false));
console.log('Created apple-touch-icon.png');

// 5. Favicon
fs.writeFileSync(path.join(publicDir, 'favicon.ico'), createPNG(32, 32, false));
console.log('Created favicon.ico');
