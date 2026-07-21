// Generate placeholder PNG icons for Tauri
// Run with: node scripts/generate-icons.js
// Produces a 1024x1024 icon and the required smaller variants.
// Uses zero dependencies — manual PNG encoding with zlib.

import { writeFileSync, mkdirSync } from 'fs';
import { deflateSync } from 'zlib';

const SIZE = 1024;
const BG = [139, 111, 71]; // #8B6F47 (paper theme accent)
const FG = [255, 255, 255]; // white

// Create pixel data (RGBA)
const pixels = Buffer.alloc(SIZE * SIZE * 4);
for (let y = 0; y < SIZE; y++) {
  for (let x = 0; x < SIZE; x++) {
    const i = (y * SIZE + x) * 4;
    // Background color
    pixels[i] = BG[0];
    pixels[i + 1] = BG[1];
    pixels[i + 2] = BG[2];
    pixels[i + 3] = 255;
  }
}

// Draw a simple "V" shape in white
const drawV = () => {
  const cx = SIZE / 2;
  const top = SIZE * 0.22;
  const bot = SIZE * 0.72;
  const stroke = SIZE * 0.09;
  for (let y = top; y <= bot; y++) {
    const t = (y - top) / (bot - top);
    const spread = t * (SIZE * 0.28);
    const leftX = cx - spread - stroke / 2;
    const rightX = cx + spread + stroke / 2;
    const leftX2 = cx - spread + stroke / 2;
    const rightX2 = cx + spread - stroke / 2;
    for (let x = leftX; x <= leftX2; x++) {
      if (x >= 0 && x < SIZE) {
        const i = (Math.floor(y) * SIZE + Math.floor(x)) * 4;
        pixels[i] = FG[0];
        pixels[i + 1] = FG[1];
        pixels[i + 2] = FG[2];
      }
    }
    for (let x = rightX2; x <= rightX; x++) {
      if (x >= 0 && x < SIZE) {
        const i = (Math.floor(y) * SIZE + Math.floor(x)) * 4;
        pixels[i] = FG[0];
        pixels[i + 1] = FG[1];
        pixels[i + 2] = FG[2];
      }
    }
  }
};
drawV();

// Round corners
const cornerRadius = SIZE * 0.18;
for (let y = 0; y < SIZE; y++) {
  for (let x = 0; x < SIZE; x++) {
    const i = (y * SIZE + x) * 4;
    const dx = Math.max(0, cornerRadius - x, x - (SIZE - 1 - cornerRadius));
    const dy = Math.max(0, cornerRadius - y, y - (SIZE - 1 - cornerRadius));
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > cornerRadius) {
      pixels[i + 3] = 0; // transparent
    }
  }
}

// Encode PNG
function crc32(buf) {
  let c, table = [];
  for (let n = 0; n < 256; n++) {
    c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function encodePng(width, height, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type: RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  // Add filter byte (0) to each scanline
  const rowSize = width * 4;
  const filtered = Buffer.alloc((rowSize + 1) * height);
  for (let y = 0; y < height; y++) {
    filtered[y * (rowSize + 1)] = 0;
    rgba.copy(filtered, y * (rowSize + 1) + 1, y * rowSize, (y + 1) * rowSize);
  }
  const idat = deflateSync(filtered);

  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

// Resize by nearest-neighbor
function resize(src, srcSize, dstSize) {
  const out = Buffer.alloc(dstSize * dstSize * 4);
  const scale = srcSize / dstSize;
  for (let y = 0; y < dstSize; y++) {
    for (let x = 0; x < dstSize; x++) {
      const sx = Math.floor(x * scale);
      const sy = Math.floor(y * scale);
      const si = (sy * srcSize + sx) * 4;
      const di = (y * dstSize + x) * 4;
      out[di] = pixels[si];
      out[di + 1] = pixels[si + 1];
      out[di + 2] = pixels[si + 2];
      out[di + 3] = pixels[si + 3];
    }
  }
  return out;
}

mkdirSync('src-tauri/icons', { recursive: true });

// Generate required sizes
const sizes = [
  { name: '32x32.png', size: 32 },
  { name: '128x128.png', size: 128 },
  { name: '128x128@2x.png', size: 256 },
  { name: 'icon.png', size: 512 },
];

for (const { name, size } of sizes) {
  const data = resize(pixels, SIZE, size);
  const png = encodePng(size, size, data);
  writeFileSync(`src-tauri/icons/${name}`, png);
  console.log(`Created src-tauri/icons/${name} (${size}x${size})`);
}

// Also create icon.ico and icon.icns placeholders
// For now, just copy the 256x256 as icon.ico (Windows will accept PNG-in-ICO in some versions)
// and write a simple .icns header for macOS
// For a real build, the user should run `tauri icon` to generate proper formats

// Create a simple .ico (just a single PNG embedded - works on modern Windows)
const icoPng = encodePng(64, 64, resize(pixels, SIZE, 64));
// ICO header: reserved(2) + type(2) + count(2) + entries(16 * count)
const icoHeader = Buffer.alloc(6 + 16);
icoHeader.writeUInt16LE(0, 0); // reserved
icoHeader.writeUInt16LE(1, 2); // type: icon
icoHeader.writeUInt16LE(1, 4); // count
// ICONDIRENTRY
icoHeader.writeUInt8(64, 6); // width
icoHeader.writeUInt8(64, 7); // height
icoHeader.writeUInt8(0, 8); // colors
icoHeader.writeUInt8(0, 9); // reserved
icoHeader.writeUInt16LE(1, 10); // planes
icoHeader.writeUInt16LE(32, 12); // bit count
icoHeader.writeUInt32LE(icoPng.length, 14); // size
icoHeader.writeUInt32LE(6 + 16, 18); // offset
writeFileSync('src-tauri/icons/icon.ico', Buffer.concat([icoHeader, icoPng]));
console.log('Created src-tauri/icons/icon.ico');

// Create a minimal .icns (Apple icon format) - just use PNG embedded
const icnsPng = encodePng(256, 256, resize(pixels, SIZE, 256));
// icns header
const icnsHeader = Buffer.alloc(8);
icnsHeader.write('icns', 0, 'ascii');
const totalLen = 8 + 8 + icnsPng.length;
icnsHeader.writeUInt32BE(totalLen, 4);
// ic07 entry (128x128 PNG)
const icnsEntry = Buffer.alloc(8);
icnsEntry.write('ic07', 0, 'ascii');
icnsEntry.writeUInt32BE(8 + icnsPng.length, 4);
writeFileSync('src-tauri/icons/icon.icns', Buffer.concat([icnsHeader, icnsEntry, icnsPng]));
console.log('Created src-tauri/icons/icon.icns');

console.log('\nAll icons generated!');
console.log('For production, run: npx tauri icon <path-to-1024x1024.png>');
