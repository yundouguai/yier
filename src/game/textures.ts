import * as THREE from 'three';
import { PlayerConfig, toColorHex } from './constants';

function prepColorTex(t: THREE.CanvasTexture, anisotropy: number): THREE.CanvasTexture {
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = anisotropy;
  return t;
}

export function createGrassTexture(anisotropy: number): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d')!;
  g.fillStyle = '#5ea84e';
  g.fillRect(0, 0, 256, 256);

  // Subtle organic moss patches
  for (let i = 0; i < 48; i++) {
    g.fillStyle = i % 2 === 0 ? 'rgba(62, 128, 54, 0.22)' : 'rgba(130, 198, 98, 0.2)';
    g.beginPath();
    g.arc(
      Math.random() * 256,
      Math.random() * 256,
      10 + Math.random() * 22,
      0,
      Math.PI * 2,
    );
    g.fill();
  }

  const tones = ['#4f9442', '#6db85a', '#44853a', '#7bc466', '#569f48'];
  for (let i = 0; i < 1800; i++) {
    g.fillStyle = tones[i % tones.length];
    g.globalAlpha = 0.5;
    g.fillRect(
      Math.random() * 256,
      Math.random() * 256,
      1.5 + Math.random() * 2.5,
      2 + Math.random() * 3.5,
    );
  }
  g.globalAlpha = 1;
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(16, 16);
  return prepColorTex(t, anisotropy);
}

export function createMoatTexture(anisotropy: number): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d')!;
  g.fillStyle = '#dcf8fa';
  g.fillRect(0, 0, 256, 256);

  // Subtle luminance variation across channel so vertex colors remain bright & clear
  const band = g.createLinearGradient(0, 0, 0, 256);
  band.addColorStop(0, 'rgba(255, 255, 255, 0.32)');
  band.addColorStop(0.25, 'rgba(182, 238, 245, 0.14)');
  band.addColorStop(0.5, 'rgba(142, 214, 228, 0.22)');
  band.addColorStop(0.75, 'rgba(182, 238, 245, 0.14)');
  band.addColorStop(1, 'rgba(255, 255, 255, 0.32)');
  g.fillStyle = band;
  g.fillRect(0, 0, 256, 256);

  // Seamless periodic flowing current streaks along X (wrapped at x=0/256)
  for (let i = 0; i < 72; i++) {
    g.strokeStyle = [
      'rgba(255, 255, 255, 0.38)',
      'rgba(210, 250, 255, 0.3)',
      'rgba(180, 240, 248, 0.24)',
    ][i % 3];
    g.lineWidth = 1.4 + (i % 3) * 0.9;
    const baseY = ((i * 37) % 240) + 8;
    const amp = 3 + (i % 4) * 1.1;
    const freq = ((i % 3) + 1) * ((Math.PI * 2) / 256);
    const phase = i * 1.1;
    g.beginPath();
    for (let x = 0; x <= 256; x += 8) {
      const y = baseY + Math.sin(x * freq + phase) * amp;
      if (x === 0) g.moveTo(x, y);
      else g.lineTo(x, y);
    }
    g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(4, 1);
  return prepColorTex(t, anisotropy);
}

export function createRiverbedTexture(anisotropy: number): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d')!;

  // Shallow sandy banks transitioning to mossy river-stone channel center
  const grad = g.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, '#c7ba97');
  grad.addColorStop(0.22, '#8fa387');
  grad.addColorStop(0.5, '#59746b');
  grad.addColorStop(0.78, '#8fa387');
  grad.addColorStop(1, '#c7ba97');
  g.fillStyle = grad;
  g.fillRect(0, 0, 256, 256);

  // Subtle periodic sand ripples along flow direction
  for (let i = 0; i < 40; i++) {
    g.strokeStyle = i % 2 === 0 ? 'rgba(225, 212, 178, 0.16)' : 'rgba(48, 68, 62, 0.16)';
    g.lineWidth = 2 + (i % 3);
    const y0 = ((i * 41) % 244) + 6;
    const freq = ((i % 2) + 1) * ((Math.PI * 2) / 256);
    g.beginPath();
    for (let x = 0; x <= 256; x += 8) {
      const y = y0 + Math.sin(x * freq + i) * 3.5;
      if (x === 0) g.moveTo(x, y);
      else g.lineTo(x, y);
    }
    g.stroke();
  }

  // Smooth river pebbles & gravel (wrapped across x=0/256)
  const pebbleColors = ['#9c9482', '#7f8984', '#b4a88d', '#68786e', '#c6ba9e'];
  for (let i = 0; i < 340; i++) {
    const px = (i * 73 + (i % 7) * 19) % 256;
    const py = ((i * 53 + (i % 11) * 17) % 244) + 6;
    const rx = 2.2 + (i % 5) * 1.1;
    const ry = 1.6 + ((i * 3) % 4) * 0.9;
    const rot = ((i * 37) % 314) / 100;
    g.fillStyle = pebbleColors[i % pebbleColors.length];
    g.globalAlpha = 0.52;
    for (const wx of [px, px - 256, px + 256]) {
      if (wx < -12 || wx > 268) continue;
      g.beginPath();
      g.ellipse(wx, py, rx, ry, rot, 0, Math.PI * 2);
      g.fill();
    }
  }
  g.globalAlpha = 1;

  const t = new THREE.CanvasTexture(c);
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.ClampToEdgeWrapping;
  t.repeat.set(8, 1);
  return prepColorTex(t, anisotropy);
}

export function createShoreEarthTexture(anisotropy: number): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d')!;

  // Warm riverbank soil & sandy mud base
  g.fillStyle = '#9c8363';
  g.fillRect(0, 0, 256, 256);

  // Seamless wrapped organic earth & fine sand patches
  for (let i = 0; i < 64; i++) {
    const px = (i * 89 + (i % 5) * 23) % 256;
    const py = (i * 67 + (i % 7) * 19) % 256;
    const rad = 12 + (i % 5) * 6;
    g.fillStyle =
      i % 3 === 0
        ? 'rgba(120, 95, 67, 0.22)'
        : i % 3 === 1
          ? 'rgba(182, 160, 126, 0.22)'
          : 'rgba(138, 114, 84, 0.18)';
    for (const wx of [px, px - 256, px + 256]) {
      for (const wy of [py, py - 256, py + 256]) {
        if (wx < -36 || wx > 292 || wy < -36 || wy > 292) continue;
        g.beginPath();
        g.arc(wx, wy, rad, 0, Math.PI * 2);
        g.fill();
      }
    }
  }

  // Fine sand grit & tiny soil grains (wrapped seamlessly)
  const grains = ['#786047', '#bfa884', '#8b7154', '#cbb796', '#69533d'];
  for (let i = 0; i < 900; i++) {
    const px = (i * 137 + (i % 13) * 17) % 256;
    const py = (i * 97 + (i % 11) * 29) % 256;
    const rx = 1.2 + (i % 4) * 0.7;
    const ry = 1.0 + ((i * 3) % 3) * 0.6;
    g.fillStyle = grains[i % grains.length];
    g.globalAlpha = 0.42;
    for (const wx of [px, px - 256, px + 256]) {
      for (const wy of [py, py - 256, py + 256]) {
        if (wx < -8 || wx > 264 || wy < -8 || wy > 264) continue;
        g.beginPath();
        g.ellipse(wx, wy, rx, ry, (i % 6) * 0.5, 0, Math.PI * 2);
        g.fill();
      }
    }
  }
  g.globalAlpha = 1;

  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return prepColorTex(t, anisotropy);
}

export function createBrickBankTexture(anisotropy: number): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  g.fillStyle = '#728188';
  g.fillRect(0, 0, 128, 128);
  const bw = 32;
  const bh = 10;
  for (let y = 0, r = 0; y < 128 + bh; y += bh, r++) {
    for (let x = (r % 2 ? bw / 2 : 0) - bw; x < 128 + bw; x += bw) {
      const v = 0.9 + Math.random() * 0.16;
      g.fillStyle = `rgb(${(142 * v) | 0},${(158 * v) | 0},${(166 * v) | 0})`;
      g.fillRect(x + 1, y + 1, bw - 2, bh - 2);
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(9, 9);
  return prepColorTex(t, anisotropy);
}

export function createStoneDeckTexture(anisotropy: number): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  const g = c.getContext('2d')!;
  g.fillStyle = '#969ea2';
  g.fillRect(0, 0, 512, 512);
  for (let y = 0; y < 512; y += 64) {
    for (let x = 0; x < 512; x += 64) {
      const v = 0.95 + Math.random() * 0.1;
      g.fillStyle = `rgb(${(152 * v) | 0},${(160 * v) | 0},${(164 * v) | 0})`;
      g.fillRect(x + 2, y + 2, 60, 60);
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(4, 4);
  return prepColorTex(t, anisotropy);
}

export function createWallBrickTexture(anisotropy: number): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d')!;
  g.fillStyle = '#77828d';
  g.fillRect(0, 0, 256, 256);
  g.strokeStyle = '#59636d';
  g.lineWidth = 3;
  for (let y = 0; y <= 256; y += 32) {
    g.beginPath();
    g.moveTo(0, y + 0.5);
    g.lineTo(256, y + 0.5);
    g.stroke();
    const off = (y / 32) % 2 ? 32 : 0;
    for (let x = off; x <= 256; x += 64) {
      g.beginPath();
      g.moveTo(x + 0.5, y);
      g.lineTo(x + 0.5, y + 32);
      g.stroke();
    }
  }
  for (let i = 0; i < 200; i++) {
    g.fillStyle =
      Math.random() < 0.5
        ? `rgba(214,203,182,${Math.random() * 0.06})`
        : `rgba(38,50,58,${Math.random() * 0.08})`;
    g.beginPath();
    g.arc(Math.random() * 256, Math.random() * 256, 2 + Math.random() * 9, 0, Math.PI * 2);
    g.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return prepColorTex(t, anisotropy);
}

export function createCourtyardGrassTexture(anisotropy: number): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d')!;
  g.fillStyle = '#81ab5b';
  g.fillRect(0, 0, 256, 256);
  const tones = ['#77a052', '#8eb566', '#719b4c', '#95ba6f'];
  for (let i = 0; i < 700; i++) {
    g.fillStyle = tones[i & 3];
    g.globalAlpha = 0.4;
    g.fillRect(
      Math.random() * 256,
      Math.random() * 256,
      2 + Math.random() * 3,
      1 + Math.random() * 2,
    );
  }
  g.globalAlpha = 1;
  const flowers = ['#f2d05a', '#e77fa2', '#ffffff', '#d96a4b'];
  for (let i = 0; i < 2; i++) {
    for (let j = 0; j < 2; j++) {
      const x = (i + 0.5) * 128 + (Math.random() - 0.5) * 30;
      const y = (j + 0.5) * 128 + (Math.random() - 0.5) * 30;
      g.fillStyle = flowers[(i * 2 + j) % 4];
      for (let k = 0; k < 5; k++) {
        const a = (k / 5) * Math.PI * 2;
        g.beginPath();
        g.arc(x + Math.cos(a) * 4, y + Math.sin(a) * 4, 2.5, 0, Math.PI * 2);
        g.fill();
      }
      g.fillStyle = '#f0c94f';
      g.beginPath();
      g.arc(x, y, 2, 0, Math.PI * 2);
      g.fill();
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(2.2, 2.2);
  return prepColorTex(t, anisotropy);
}

function mixHexWithWood(hex: number, woodRatio: number): string {
  const r0 = (hex >> 16) & 255;
  const g0 = (hex >> 8) & 255;
  const b0 = hex & 255;
  // Warm honey-elm / light sandalwood (#ceae86) so stained wood stays bright, warm, and antique
  const r = Math.round(r0 * (1 - woodRatio) + 206 * woodRatio);
  const g = Math.round(g0 * (1 - woodRatio) + 174 * woodRatio);
  const b = Math.round(b0 * (1 - woodRatio) + 134 * woodRatio);
  return `rgb(${r},${g},${b})`;
}

function paintWoodGrain(
  g: CanvasRenderingContext2D,
  size: number,
  seed: number,
  darkAlpha = 0.12,
  lightAlpha = 0.085,
) {
  // Subtle organic timber fiber bands & gentle growth-ring waves
  const step = Math.max(3, Math.round(size / 48));
  for (let y = 0; y < size; y += step) {
    const isLight = ((y / step + seed) | 0) % 3 === 0;
    g.strokeStyle = isLight
      ? `rgba(252, 236, 206, ${lightAlpha})`
      : `rgba(56, 32, 16, ${darkAlpha * (0.65 + ((y * 7 + seed) % 5) * 0.1)})`;
    g.lineWidth = 1 + (((y + seed) % 3) === 0 ? 1.0 : 0.4);
    const freq = (Math.PI * 2) / size;
    const phase = (y * 0.27 + seed * 1.3) % 6.28;
    const amp = 1.6 + ((y + seed) % 4) * 0.85;
    g.beginPath();
    for (let x = 0; x <= size; x += 12) {
      const wy = y + Math.sin(x * freq + phase) * amp + Math.cos(x * freq * 2 - phase) * 0.6;
      if (x === 0) g.moveTo(x, wy);
      else g.lineTo(x, wy);
    }
    g.stroke();
  }

  // Fine wood pores / flecks along grain
  for (let i = 0; i < 110; i++) {
    const px = (i * 83 + seed * 41) % size;
    const py = (i * 107 + seed * 29) % size;
    const len = 6 + (i % 5) * 4;
    g.strokeStyle =
      i % 2 === 0
        ? `rgba(54, 30, 14, ${darkAlpha * 0.78})`
        : `rgba(252, 236, 204, ${lightAlpha * 0.85})`;
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(px, py);
    g.lineTo(px + len, py + ((i % 3) - 1) * 0.8);
    g.stroke();
  }
}

export function createHardwoodFrameTexture(anisotropy: number): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d')!;
  g.fillStyle = '#9c6d49';
  g.fillRect(0, 0, 256, 256);

  const grad = g.createLinearGradient(0, 0, 256, 256);
  grad.addColorStop(0, 'rgba(255, 232, 196, 0.1)');
  grad.addColorStop(0.5, 'rgba(0, 0, 0, 0)');
  grad.addColorStop(1, 'rgba(44, 24, 12, 0.1)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 256, 256);

  paintWoodGrain(g, 256, 17, 0.14, 0.09);

  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(2, 2);
  return prepColorTex(t, anisotropy);
}

export function createAncientTileTexture(
  colorHex: number,
  isNeutral: boolean,
  isYier: boolean,
  anisotropy: number,
): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 192;
  const g = c.getContext('2d')!;

  const baseFill = isNeutral
    ? '#b6906a'
    : isYier
      ? '#e5d6b8'
      : mixHexWithWood(colorHex, 0.24);
  g.fillStyle = baseFill;
  g.fillRect(0, 0, 192, 192);

  // Gentle hand-rubbed wood oil sheen & soft edge patina
  const rad = g.createRadialGradient(96, 96, 16, 96, 96, 132);
  rad.addColorStop(0, 'rgba(255, 244, 218, 0.14)');
  rad.addColorStop(0.72, 'rgba(255, 244, 218, 0.0)');
  rad.addColorStop(1, 'rgba(56, 32, 16, 0.11)');
  g.fillStyle = rad;
  g.fillRect(0, 0, 192, 192);

  paintWoodGrain(g, 192, colorHex & 255, isNeutral ? 0.14 : 0.1, isYier ? 0.11 : 0.08);

  // Carved mortise wood chamfer & inlaid border groove
  g.strokeStyle = 'rgba(58, 32, 16, 0.30)';
  g.lineWidth = 4;
  g.strokeRect(4, 4, 184, 184);

  g.strokeStyle = isYier
    ? 'rgba(84, 52, 28, 0.36)'
    : isNeutral
      ? 'rgba(246, 232, 206, 0.42)'
      : 'rgba(252, 242, 222, 0.42)';
  g.lineWidth = 2;
  g.strokeRect(14, 14, 164, 164);

  // Subtle carved wooden corner fretwork
  const corners: [number, number, number, number][] = [
    [14, 14, 1, 1],
    [178, 14, -1, 1],
    [14, 178, 1, -1],
    [178, 178, -1, -1],
  ];
  g.strokeStyle = isYier
    ? 'rgba(78, 48, 26, 0.42)'
    : isNeutral
      ? 'rgba(248, 234, 208, 0.46)'
      : 'rgba(252, 244, 226, 0.48)';
  g.lineWidth = 2;
  for (const [cx, cy, sx, sy] of corners) {
    g.beginPath();
    g.moveTo(cx + sx * 16, cy);
    g.lineTo(cx + sx * 16, cy + sy * 10);
    g.lineTo(cx + sx * 8, cy + sy * 10);
    g.moveTo(cx, cy + sy * 16);
    g.lineTo(cx + sx * 10, cy + sy * 16);
    g.stroke();
  }

  return prepColorTex(new THREE.CanvasTexture(c), anisotropy);
}

export function createCellMedallionTexture(
  accentHex: number,
  isNeutral: boolean,
  isYier: boolean,
  anisotropy: number,
): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 192;
  const g = c.getContext('2d')!;
  g.clearRect(0, 0, 192, 192);

  const ringStroke = isNeutral
    ? 'rgba(248, 236, 212, 0.84)'
    : isYier
      ? 'rgba(82, 52, 28, 0.78)'
      : 'rgba(250, 242, 224, 0.88)';
  const innerStroke = isNeutral
    ? 'rgba(74, 46, 24, 0.48)'
    : isYier
      ? 'rgba(132, 92, 54, 0.58)'
      : mixHexWithWood(accentHex, 0.34);

  // Outer boxwood / dark-walnut inlaid circle ring
  g.strokeStyle = ringStroke;
  g.lineWidth = 9;
  g.beginPath();
  g.arc(96, 96, 76, 0, Math.PI * 2);
  g.stroke();

  g.strokeStyle = innerStroke;
  g.lineWidth = 4;
  g.beginPath();
  g.arc(96, 96, 61, 0, Math.PI * 2);
  g.stroke();

  g.fillStyle = ringStroke;
  for (let k = 0; k < 4; k++) {
    const a = (k * Math.PI) / 2;
    const nx = 96 + Math.cos(a) * 68;
    const ny = 96 + Math.sin(a) * 68;
    g.beginPath();
    g.arc(nx, ny, 3.6, 0, Math.PI * 2);
    g.fill();
  }

  return prepColorTex(new THREE.CanvasTexture(c), anisotropy);
}

export function createGoalTriangleTexture(
  colorHex: number | null,
  isYier: boolean,
  anisotropy: number,
): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  const g = c.getContext('2d')!;

  const fillCol =
    colorHex === null
      ? '#b28c66'
      : isYier
        ? '#e4d4b6'
        : mixHexWithWood(colorHex, 0.24);

  g.fillStyle = fillCol;
  g.fillRect(0, 0, 512, 512);

  // Warm wood oil patina from center toward outer rail
  const grad = g.createLinearGradient(256, 0, 256, 512);
  grad.addColorStop(0, 'rgba(54, 30, 14, 0.11)');
  grad.addColorStop(0.5, 'rgba(255, 242, 214, 0.08)');
  grad.addColorStop(1, 'rgba(52, 28, 12, 0.13)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 512, 512);

  paintWoodGrain(g, 512, (colorHex ?? 90) & 255, 0.11, 0.08);

  // Carved wooden plank joinery seams fanning radially
  g.strokeStyle = 'rgba(56, 30, 14, 0.18)';
  g.lineWidth = 3;
  g.beginPath();
  g.moveTo(256, 0);
  g.lineTo(128, 512);
  g.moveTo(256, 0);
  g.lineTo(384, 512);
  g.stroke();

  for (const r of [170, 290, 425]) {
    g.beginPath();
    g.arc(256, 0, r, Math.PI * 0.28, Math.PI * 0.72);
    g.stroke();
  }

  // Burned-wood / boxwood key-fret (回纹) band near outer wood rail
  const fretCol =
    isYier || colorHex === null
      ? 'rgba(72, 44, 24, 0.38)'
      : 'rgba(248, 236, 210, 0.46)';
  g.strokeStyle = fretCol;
  g.lineWidth = 4;
  g.strokeRect(20, 464, 472, 34);
  for (let x = 36; x <= 468; x += 36) {
    g.beginPath();
    g.moveTo(x, 498);
    g.lineTo(x, 474);
    g.lineTo(x + 20, 474);
    g.lineTo(x + 20, 488);
    g.lineTo(x + 10, 488);
    g.stroke();
  }

  g.strokeStyle =
    isYier || colorHex === null
      ? 'rgba(76, 48, 26, 0.32)'
      : 'rgba(250, 240, 216, 0.40)';
  g.lineWidth = 4;
  g.beginPath();
  g.moveTo(32, 456);
  g.lineTo(480, 456);
  g.lineTo(256, 30);
  g.closePath();
  g.stroke();

  return prepColorTex(new THREE.CanvasTexture(c), anisotropy);
}

export function createDiceAltarTexture(anisotropy: number): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  const g = c.getContext('2d')!;

  // Warm antique rosewood wooden dial inlaid with pale boxwood
  const bg = g.createRadialGradient(256, 256, 24, 256, 256, 256);
  bg.addColorStop(0, '#8e5f3d');
  bg.addColorStop(0.66, '#71482b');
  bg.addColorStop(0.9, '#57361f');
  bg.addColorStop(1, '#432815');
  g.fillStyle = bg;
  g.fillRect(0, 0, 512, 512);

  paintWoodGrain(g, 512, 64, 0.15, 0.08);

  // Warm boxwood inlaid outer rings
  g.strokeStyle = '#dac39a';
  g.lineWidth = 11;
  g.beginPath();
  g.arc(256, 256, 236, 0, Math.PI * 2);
  g.stroke();

  g.strokeStyle = '#b4986d';
  g.lineWidth = 4;
  g.beginPath();
  g.arc(256, 256, 218, 0, Math.PI * 2);
  g.stroke();

  // 24 boxwood compass ticks
  g.strokeStyle = 'rgba(242, 226, 196, 0.65)';
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2;
    const r0 = i % 3 === 0 ? 194 : 204;
    g.lineWidth = i % 3 === 0 ? 4 : 2;
    g.beginPath();
    g.moveTo(256 + Math.cos(a) * r0, 256 + Math.sin(a) * r0);
    g.lineTo(256 + Math.cos(a) * 215, 256 + Math.sin(a) * 215);
    g.stroke();
  }

  // Octagonal timber inlay lines
  g.strokeStyle = 'rgba(236, 216, 182, 0.48)';
  g.lineWidth = 3;
  g.beginPath();
  for (let i = 0; i <= 8; i++) {
    const a = (i * Math.PI) / 4 + Math.PI / 8;
    const px = 256 + Math.cos(a) * 182;
    const py = 256 + Math.sin(a) * 182;
    if (i === 0) g.moveTo(px, py);
    else g.lineTo(px, py);
  }
  g.stroke();

  // Inner boxwood circle & carved 8-petal lotus
  g.strokeStyle = '#dcc7a0';
  g.lineWidth = 6;
  g.beginPath();
  g.arc(256, 256, 132, 0, Math.PI * 2);
  g.stroke();

  g.strokeStyle = 'rgba(238, 220, 188, 0.48)';
  g.lineWidth = 3;
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4;
    g.beginPath();
    g.arc(256 + Math.cos(a) * 84, 256 + Math.sin(a) * 84, 34, a - 1.0, a + 1.0);
    g.stroke();
  }

  g.strokeStyle = 'rgba(244, 228, 198, 0.66)';
  g.lineWidth = 4;
  g.beginPath();
  g.arc(256, 256, 46, 0, Math.PI * 2);
  g.stroke();

  return prepColorTex(new THREE.CanvasTexture(c), anisotropy);
}

export function createStartPadTexture(P: PlayerConfig, anisotropy: number): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d')!;
  const isYier = P.key === 'yier';
  const fillCol = isYier ? '#e4d4b6' : mixHexWithWood(P.color, 0.22);
  const inkCol = isYier ? '#553720' : '#fcf5e6';
  const subCol = isYier ? '#785435' : 'rgba(246, 234, 208, 0.88)';

  g.fillStyle = fillCol;
  g.fillRect(0, 0, 256, 256);

  const grad = g.createRadialGradient(128, 128, 22, 128, 128, 128);
  grad.addColorStop(0, 'rgba(255, 244, 218, 0.14)');
  grad.addColorStop(1, 'rgba(56, 32, 16, 0.12)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 256, 256);

  paintWoodGrain(g, 256, P.color & 255, 0.11, 0.08);

  // Carved wooden seal rings
  g.strokeStyle = inkCol;
  g.lineWidth = 10;
  g.beginPath();
  g.arc(128, 128, 110, 0, Math.PI * 2);
  g.stroke();

  g.strokeStyle = subCol;
  g.lineWidth = 4;
  g.beginPath();
  g.arc(128, 128, 94, 0, Math.PI * 2);
  g.stroke();

  g.strokeStyle = subCol;
  g.lineWidth = 3;
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4;
    g.beginPath();
    g.moveTo(128 + Math.cos(a) * 94, 128 + Math.sin(a) * 94);
    g.lineTo(128 + Math.cos(a) * 107, 128 + Math.sin(a) * 107);
    g.stroke();
  }

  g.fillStyle = inkCol;
  g.font = 'bold 54px "Songti SC","Noto Serif SC",Georgia,serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText('起 程', 128, 108);
  g.font = 'bold 26px Georgia,"Times New Roman",serif';
  g.fillStyle = subCol;
  g.fillText('START', 128, 162);
  return prepColorTex(new THREE.CanvasTexture(c), anisotropy);
}

export function createHeadFaceTexture(P: PlayerConfig, anisotropy: number): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 256;
  const g = c.getContext('2d')!;
  g.fillStyle = toColorHex(P.body);
  g.fillRect(0, 0, 512, 256);
  return prepColorTex(new THREE.CanvasTexture(c), anisotropy);
}

export function createDiceFaceTexture(n: number, anisotropy: number): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d')!;

  // Smooth creamy porcelain-ivory Q-version die surface
  const bg = g.createRadialGradient(112, 108, 18, 128, 128, 178);
  bg.addColorStop(0, '#fffdf9');
  bg.addColorStop(0.65, '#f7efe0');
  bg.addColorStop(1, '#e8dac2');
  g.fillStyle = bg;
  g.fillRect(0, 0, 256, 256);

  // Subtle rounded cushion inset line (no sharp boxy corners)
  g.strokeStyle = 'rgba(186, 158, 122, 0.22)';
  g.lineWidth = 4;
  g.beginPath();
  g.roundRect(34, 34, 188, 188, 46);
  g.stroke();

  const P: Record<number, [number, number][]> = {
    1: [[128, 128]],
    2: [
      [82, 82],
      [174, 174],
    ],
    3: [
      [76, 76],
      [128, 128],
      [180, 180],
    ],
    4: [
      [82, 82],
      [174, 82],
      [82, 174],
      [174, 174],
    ],
    5: [
      [80, 80],
      [176, 80],
      [128, 128],
      [80, 176],
      [176, 176],
    ],
    6: [
      [82, 72],
      [174, 72],
      [82, 128],
      [174, 128],
      [82, 184],
      [174, 184],
    ],
  };

  if (n === 1) {
    const isYier = true;
    const outline = '#3a231a';
    const fur = isYier ? '#ffffff' : '#c69069';
    const cheek = isYier ? '#f7aa9c' : '#f2c56d';

    g.save();
    g.translate(128, isYier ? 124 : 132);
    g.lineJoin = 'round';
    g.lineCap = 'round';

    // 一二底部黑色小领结
    if (isYier) {
      g.fillStyle = outline;
      g.beginPath();
      g.ellipse(-14, 72, 16, 11, -0.35, 0, Math.PI * 2);
      g.ellipse(14, 72, 16, 11, 0.35, 0, Math.PI * 2);
      g.fill();
    }

    // 耳朵
    for (const sx of [-1, 1]) {
      g.fillStyle = isYier ? outline : fur;
      g.strokeStyle = outline;
      g.lineWidth = 6;
      g.beginPath();
      g.arc(sx * 54, -52, 22, 0, Math.PI * 2);
      g.fill();
      g.stroke();
      if (!isYier) {
        g.fillStyle = outline;
        g.beginPath();
        g.arc(sx * 54, -52, 12, 0, Math.PI * 2);
        g.fill();
      }
    }

    // 圆润胖脸轮廓
    g.fillStyle = fur;
    g.strokeStyle = outline;
    g.lineWidth = 6.5;
    g.beginPath();
    g.ellipse(0, 4, 74, 64, 0, 0, Math.PI * 2);
    g.fill();
    g.stroke();

    // 腮红
    g.fillStyle = cheek;
    for (const sx of [-1, 1]) {
      g.beginPath();
      g.ellipse(sx * 48, 22, 16, 12.5, 0, 0, Math.PI * 2);
      g.fill();
    }

    // 豆豆眼
    g.fillStyle = outline;
    for (const sx of [-1, 1]) {
      g.beginPath();
      g.arc(sx * 31, 6, 7.2, 0, Math.PI * 2);
      g.fill();
    }

    // 张开的小嘴与粉红舌头
    g.fillStyle = '#ef7a88';
    g.strokeStyle = outline;
    g.lineWidth = 4.5;
    g.beginPath();
    g.ellipse(0, 26, 8.5, 11.5, 0, 0, Math.PI * 2);
    g.fill();
    g.stroke();

    // ω 上唇
    g.fillStyle = fur;
    g.beginPath();
    g.rect(-13, 8, 26, 10);
    g.fill();
    g.strokeStyle = outline;
    g.lineWidth = 4.5;
    g.beginPath();
    g.moveTo(-10, 14);
    g.quadraticCurveTo(-5, 22, 0, 15);
    g.quadraticCurveTo(5, 22, 10, 14);
    g.stroke();

    // 举在左脸侧的小爪爪（比心/小拳头）
    g.fillStyle = fur;
    g.strokeStyle = outline;
    g.lineWidth = 5.5;
    g.beginPath();
    g.ellipse(-38, 44, 18, 16, -0.25, 0, Math.PI * 2);
    g.fill();
    g.stroke();
    g.beginPath();
    g.arc(-30, 35, 6.5, -0.4, Math.PI * 1.1);
    g.stroke();

    g.restore();
    return prepColorTex(new THREE.CanvasTexture(c), anisotropy);
  }

  const isRed = n === 1 || n === 4;
  const pipRadius = n === 1 ? 35 : 22.5;
  for (const [x, y] of P[n]) {
    // Soft recessed cushion halo under each pip
    g.fillStyle = 'rgba(255, 252, 244, 0.85)';
    g.beginPath();
    g.arc(x, y + 2, pipRadius + 3.5, 0, Math.PI * 2);
    g.fill();

    if (n === 1) {
      g.strokeStyle = 'rgba(235, 92, 74, 0.22)';
      g.lineWidth = 4;
      g.beginPath();
      g.arc(x, y, pipRadius + 7, 0, Math.PI * 2);
      g.stroke();
    }

    const pg = g.createRadialGradient(x - pipRadius * 0.25, y - pipRadius * 0.25, 2, x, y, pipRadius);
    if (isRed) {
      pg.addColorStop(0, '#f06352');
      pg.addColorStop(0.75, '#d94434');
      pg.addColorStop(1, '#ae2e20');
    } else {
      pg.addColorStop(0, '#624b3e');
      pg.addColorStop(0.75, '#46342b');
      pg.addColorStop(1, '#2f221b');
    }
    g.fillStyle = pg;
    g.beginPath();
    g.arc(x, y, pipRadius, 0, Math.PI * 2);
    g.fill();

    // Cute Q-version glossy bead shine
    g.fillStyle = 'rgba(255, 255, 255, 0.42)';
    g.beginPath();
    g.ellipse(
      x - pipRadius * 0.3,
      y - pipRadius * 0.32,
      pipRadius * 0.26,
      pipRadius * 0.16,
      -0.6,
      0,
      Math.PI * 2,
    );
    g.fill();
  }
  return prepColorTex(new THREE.CanvasTexture(c), anisotropy);
}

export function createNumberBadgeTexture(
  label: number | string,
  anisotropy: number,
  bgColor = '#1f9d55',
): THREE.CanvasTexture {
  const text = String(label);
  const c = document.createElement('canvas');
  c.height = 128;
  if (text.length <= 1) {
    c.width = 128;
    const g = c.getContext('2d')!;
    g.fillStyle = bgColor;
    g.beginPath();
    g.arc(64, 64, 54, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = '#ffffff';
    g.lineWidth = 8;
    g.stroke();
    g.fillStyle = '#ffffff';
    g.font = 'bold 72px system-ui,sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(text, 64, 68);
  } else {
    c.width = text.length >= 6 ? 320 : text.length >= 4 ? 264 : 216;
    const g = c.getContext('2d')!;
    const pad = 10;
    const w = c.width - pad * 2;
    const h = 108;
    const r = h / 2;
    g.fillStyle = bgColor;
    g.beginPath();
    g.roundRect(pad, 10, w, h, r);
    g.fill();
    g.strokeStyle = '#ffffff';
    g.lineWidth = 8;
    g.stroke();
    g.fillStyle = '#ffffff';
    g.font = text.length >= 6 ? 'bold 54px system-ui,sans-serif' : 'bold 62px system-ui,sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(text, c.width / 2, 66);
  }
  const tex = prepColorTex(new THREE.CanvasTexture(c), anisotropy);
  tex.userData.aspect = c.width / c.height;
  return tex;
}

export function createGatePlaqueTexture(
  title: string,
  anisotropy: number,
): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 768;
  c.height = 240;
  const g = c.getContext('2d')!;

  // 古城深墨青漆匾底（高对比度）
  const bg = g.createRadialGradient(384, 120, 30, 384, 120, 420);
  bg.addColorStop(0, '#1e2e3b');
  bg.addColorStop(0.75, '#15212b');
  bg.addColorStop(1, '#0d151c');
  g.fillStyle = bg;
  g.fillRect(0, 0, 768, 240);

  // 描金回纹内框与四角装饰
  g.strokeStyle = '#ecc559';
  g.lineWidth = 6;
  g.strokeRect(12, 12, 744, 216);

  g.strokeStyle = 'rgba(245, 212, 108, 0.65)';
  g.lineWidth = 3;
  g.strokeRect(24, 24, 720, 192);

  const corners: [number, number, number, number][] = [
    [24, 24, 1, 1],
    [744, 24, -1, 1],
    [24, 216, 1, -1],
    [744, 216, -1, -1],
  ];
  g.fillStyle = '#f2cc62';
  for (const [cx, cy, sx, sy] of corners) {
    g.fillRect(cx, cy, sx * 18, sy * 6);
    g.fillRect(cx, cy, sx * 6, sy * 18);
  }

  // 超清晰大号金字楷书「熊 熊 坊」
  const chars = Array.from(title);
  const display = chars.join(' ');
  g.font = '900 124px "STKaiti","KaiTi","PingFang SC","Microsoft YaHei","Songti SC",serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';

  g.strokeStyle = 'rgba(10, 14, 18, 0.88)';
  g.lineWidth = 10;
  g.lineJoin = 'round';
  g.strokeText(display, 384, 126);

  const textGrad = g.createLinearGradient(0, 48, 0, 196);
  textGrad.addColorStop(0, '#fff4b8');
  textGrad.addColorStop(0.5, '#f5cb54');
  textGrad.addColorStop(1, '#d89d28');
  g.fillStyle = textGrad;
  g.fillText(display, 384, 124);

  return prepColorTex(new THREE.CanvasTexture(c), anisotropy);
}

export function createWakeTexture(anisotropy: number): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  g.clearRect(0, 0, 128, 128);

  // V-shaped soft foam trails starting near bottom-center (stern) and fanning upward
  const drawStream = (sx: number, sy: number, ex: number, ey: number, w0: number, w1: number) => {
    const grad = g.createLinearGradient(sx, sy, ex, ey);
    grad.addColorStop(0, 'rgba(235, 252, 255, 0.55)');
    grad.addColorStop(0.45, 'rgba(220, 248, 255, 0.28)');
    grad.addColorStop(1, 'rgba(220, 248, 255, 0)');
    g.strokeStyle = grad;
    g.lineCap = 'round';
    g.lineWidth = w0;
    g.beginPath();
    g.moveTo(sx, sy);
    g.quadraticCurveTo((sx + ex) * 0.5, (sy + ey) * 0.55, ex, ey);
    g.stroke();

    g.lineWidth = w1;
    g.beginPath();
    g.moveTo(sx, sy - 4);
    g.lineTo(ex, ey);
    g.stroke();
  };

  drawStream(58, 114, 24, 18, 8, 3);
  drawStream(70, 114, 104, 18, 8, 3);

  // Soft curved stern chevrons
  for (let i = 0; i < 4; i++) {
    const t = i / 3;
    const y = 104 - t * 68;
    const spread = 12 + t * 28;
    const alpha = 0.42 * (1 - t * 0.85);
    g.strokeStyle = `rgba(240, 253, 255, ${alpha.toFixed(2)})`;
    g.lineWidth = 4 - t * 1.8;
    g.beginPath();
    g.moveTo(64 - spread, y - 10);
    g.quadraticCurveTo(64, y + 6, 64 + spread, y - 10);
    g.stroke();
  }

  return prepColorTex(new THREE.CanvasTexture(c), anisotropy);
}

export function createWaterNormalTexture(anisotropy: number): THREE.DataTexture {
  const N = 128;
  const data = new Uint8Array(N * N * 4);
  const tau = Math.PI * 2;
  const hAt = (u: number, v: number) =>
    Math.sin(tau * (u + 2 * v)) * 0.52 +
    Math.cos(tau * (2 * u - v) + 0.8) * 0.34 +
    Math.sin(tau * (3 * u + 2 * v) + 1.9) * 0.14;
  const eps = 1 / N;
  const strength = 1.75;

  for (let y = 0; y < N; y++) {
    const v = y / N;
    for (let x = 0; x < N; x++) {
      const u = x / N;
      const dx = (hAt(u + eps, v) - hAt(u - eps, v)) * strength;
      const dy = (hAt(u, v + eps) - hAt(u, v - eps)) * strength;
      const len = Math.hypot(dx, dy, 1);
      const idx = (y * N + x) * 4;
      data[idx] = Math.round(((-dx / len) * 0.5 + 0.5) * 255);
      data[idx + 1] = Math.round(((-dy / len) * 0.5 + 0.5) * 255);
      data[idx + 2] = Math.round(((1 / len) * 0.5 + 0.5) * 255);
      data[idx + 3] = 255;
    }
  }
  const t = new THREE.DataTexture(data, N, N, THREE.RGBAFormat);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(6, 2);
  t.magFilter = THREE.LinearFilter;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.generateMipmaps = true;
  t.anisotropy = anisotropy;
  t.needsUpdate = true;
  return t;
}

export function createHullFoamTexture(anisotropy: number): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 256;
  const g = c.getContext('2d')!;
  g.clearRect(0, 0, 128, 256);

  // Soft white waterline contact ripple hugging a pointed boat silhouette
  const drawRing = (rx: number, ry: number, alpha: number, lw: number) => {
    g.save();
    g.strokeStyle = `rgba(235, 252, 255, ${alpha})`;
    g.lineWidth = lw;
    g.beginPath();
    g.moveTo(64, 128 - ry);
    g.bezierCurveTo(64 + rx * 0.95, 128 - ry * 0.45, 64 + rx * 0.95, 128 + ry * 0.45, 64, 128 + ry);
    g.bezierCurveTo(64 - rx * 0.95, 128 + ry * 0.45, 64 - rx * 0.95, 128 - ry * 0.45, 64, 128 - ry);
    g.closePath();
    g.stroke();
    g.restore();
  };

  drawRing(44, 108, 0.52, 7);
  drawRing(51, 117, 0.24, 5);
  return prepColorTex(new THREE.CanvasTexture(c), anisotropy);
}



export function createPropellerDiscTexture(anisotropy = 4): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d')!;
  g.clearRect(0, 0, 256, 256);

  const cx = 128;
  const cy = 128;
  const R = 118;

  const grad = g.createRadialGradient(cx - 16, cy - 18, 12, cx, cy, R);
  grad.addColorStop(0, '#ffffff');
  grad.addColorStop(0.78, '#fdfaf6');
  grad.addColorStop(1, '#f3ece4');

  g.fillStyle = grad;
  g.beginPath();
  g.arc(cx, cy, R, 0, Math.PI * 2);
  g.fill();

  g.strokeStyle = '#4a3228';
  g.lineWidth = 8;
  g.beginPath();
  g.arc(cx, cy, R - 4, 0, Math.PI * 2);
  g.stroke();

  g.strokeStyle = '#4a3228';
  g.lineCap = 'round';
  const ringRadii = [44, 64, 84, 101];
  const groupAngles = [0.25, 2.35, 4.45];

  ringRadii.forEach((r, rIdx) => {
    g.lineWidth = rIdx === 3 ? 4.2 : 4.8;
    groupAngles.forEach((baseAng, gIdx) => {
      const span = 0.52 + (rIdx % 2) * 0.12;
      const a0 = baseAng + rIdx * 0.11;
      const a1 = a0 + span;
      g.beginPath();
      g.arc(cx, cy, r, a0, a1);
      g.stroke();

      if ((rIdx + gIdx) % 2 === 0) {
        g.beginPath();
        g.arc(cx, cy, r, a1 + 0.14, a1 + 0.26);
        g.stroke();
      }
    });
  });

  g.fillStyle = 'rgba(74, 50, 40, 0.10)';
  g.beginPath();
  g.arc(cx, cy, 20, 0, Math.PI * 2);
  g.fill();

  return prepColorTex(new THREE.CanvasTexture(c), anisotropy);
}

export function createLandingPadTexture(P: PlayerConfig, anisotropy = 4): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d')!;
  g.clearRect(0, 0, 256, 256);

  const isYier = P.key === 'yier';
  const mainCol = isYier ? '#553720' : toColorHex(P.color);
  const ringCol = '#fdf7ea';

  // 底盘圆面
  g.fillStyle = mainCol;
  g.beginPath();
  g.arc(128, 128, 120, 0, Math.PI * 2);
  g.fill();

  // 停机坪外圈双环与四角刻度线
  g.strokeStyle = ringCol;
  g.lineWidth = 12;
  g.beginPath();
  g.arc(128, 128, 106, 0, Math.PI * 2);
  g.stroke();

  g.strokeStyle = 'rgba(253, 247, 234, 0.55)';
  g.lineWidth = 5;
  g.setLineDash([18, 12]);
  g.beginPath();
  g.arc(128, 128, 86, 0, Math.PI * 2);
  g.stroke();
  g.setLineDash([]);

  // 中央醒目停机坪 P 字标识
  g.fillStyle = ringCol;
  g.font = '900 132px "Inter", "PingFang SC", "Microsoft YaHei", sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.shadowColor = 'rgba(28, 16, 8, 0.35)';
  g.shadowBlur = 6;
  g.shadowOffsetY = 3;
  g.fillText('P', 128, 134);

  return prepColorTex(new THREE.CanvasTexture(c), anisotropy);
}

export function createShopMedallionTexture(
  accentHex: number,
  isYier: boolean,
  anisotropy = 4,
): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d')!;
  g.clearRect(0, 0, 256, 256);

  const cx = 128;
  const cy = 128;

  // 柔和奶油金圆盘底纹
  const grad = g.createRadialGradient(cx - 16, cy - 22, 14, cx, cy, 114);
  grad.addColorStop(0, '#fffdf5');
  grad.addColorStop(0.68, '#fef2d6');
  grad.addColorStop(1, '#f3d48e');
  g.fillStyle = grad;
  g.beginPath();
  g.arc(cx, cy, 112, 0, Math.PI * 2);
  g.fill();

  // 镶边外环 + 虚线蕾丝圈
  g.strokeStyle = isYier ? '#7a5230' : toColorHex(accentHex === 0xffffff ? 0xb4532a : accentHex);
  g.lineWidth = 9;
  g.beginPath();
  g.arc(cx, cy, 102, 0, Math.PI * 2);
  g.stroke();

  g.strokeStyle = 'rgba(255, 255, 255, 0.9)';
  g.lineWidth = 3.5;
  g.setLineDash([10, 7]);
  g.beginPath();
  g.arc(cx, cy, 88, 0, Math.PI * 2);
  g.stroke();
  g.setLineDash([]);

  // 瓷白小餐盘投影与盘底
  g.fillStyle = 'rgba(130, 82, 38, 0.16)';
  g.beginPath();
  g.ellipse(cx, cy + 54, 62, 16, 0, 0, Math.PI * 2);
  g.fill();

  g.fillStyle = '#ffffff';
  g.strokeStyle = '#e7d7bf';
  g.lineWidth = 3;
  g.beginPath();
  g.ellipse(cx, cy + 50, 56, 14, 0, 0, Math.PI * 2);
  g.fill();
  g.stroke();

  // 草莓小蛋糕双层松软海绵坯体
  const cakeLeft = cx - 44;
  const cakeRight = cx + 44;
  const cakeTop = cy - 10;
  const cakeBottom = cy + 44;

  // 蛋糕底座轮廓（圆角梯形切片感）
  const spongeGrad = g.createLinearGradient(cakeLeft, cakeTop, cakeRight, cakeBottom);
  spongeGrad.addColorStop(0, '#fbd68d');
  spongeGrad.addColorStop(1, '#eab15c');
  g.fillStyle = spongeGrad;
  g.beginPath();
  g.moveTo(cakeLeft + 4, cakeTop + 8);
  g.lineTo(cakeRight - 4, cakeTop + 8);
  g.quadraticCurveTo(cakeRight, cakeBottom, cakeRight - 6, cakeBottom);
  g.lineTo(cakeLeft + 6, cakeBottom);
  g.quadraticCurveTo(cakeLeft, cakeBottom, cakeLeft + 4, cakeTop + 8);
  g.closePath();
  g.fill();
  g.strokeStyle = '#9e5d28';
  g.lineWidth = 3;
  g.stroke();

  // 中间草莓酱 + 淡奶油夹心条
  g.fillStyle = '#fffcf5';
  g.fillRect(cakeLeft + 5, cy + 12, 78, 12);
  g.fillStyle = '#f25767';
  g.fillRect(cakeLeft + 6, cy + 16, 76, 5);

  // 顶部厚实流心奶霜（波浪垂边）
  g.fillStyle = '#fffef9';
  g.strokeStyle = '#b9783f';
  g.lineWidth = 2.6;
  g.beginPath();
  g.moveTo(cakeLeft + 2, cakeTop + 10);
  g.quadraticCurveTo(cx, cakeTop - 16, cakeRight - 2, cakeTop + 10);
  g.bezierCurveTo(cakeRight + 2, cakeTop + 26, cakeRight - 14, cakeTop + 26, cakeRight - 18, cakeTop + 16);
  g.bezierCurveTo(cakeRight - 24, cakeTop + 29, cx + 10, cakeTop + 28, cx + 4, cakeTop + 17);
  g.bezierCurveTo(cx - 2, cakeTop + 30, cakeLeft + 20, cakeTop + 29, cakeLeft + 16, cakeTop + 16);
  g.bezierCurveTo(cakeLeft + 10, cakeTop + 25, cakeLeft - 2, cakeTop + 24, cakeLeft + 2, cakeTop + 10);
  g.closePath();
  g.fill();
  g.stroke();

  // 顶部挤花奶油团
  g.fillStyle = '#ffffff';
  g.strokeStyle = '#cfb08e';
  g.lineWidth = 2;
  g.beginPath();
  g.arc(cx - 14, cy - 16, 13, 0, Math.PI * 2);
  g.arc(cx + 14, cy - 16, 13, 0, Math.PI * 2);
  g.arc(cx, cy - 22, 16, 0, Math.PI * 2);
  g.fill();
  g.stroke();

  // C位大颗水润草莓
  const berryGrad = g.createRadialGradient(cx - 6, cy - 50, 3, cx, cy - 42, 26);
  berryGrad.addColorStop(0, '#ff6b7a');
  berryGrad.addColorStop(0.55, '#e82d42');
  berryGrad.addColorStop(1, '#b51428');
  g.fillStyle = berryGrad;
  g.strokeStyle = '#8b1020';
  g.lineWidth = 2.6;
  g.beginPath();
  g.moveTo(cx, cy - 64);
  g.bezierCurveTo(cx + 22, cy - 64, cx + 22, cy - 34, cx, cy - 24);
  g.bezierCurveTo(cx - 22, cy - 34, cx - 22, cy - 64, cx, cy - 64);
  g.closePath();
  g.fill();
  g.stroke();

  // 草莓表面金黄色小籽
  g.fillStyle = '#ffe999';
  const seedPts: [number, number][] = [
    [-7, -50],
    [6, -51],
    [-10, -40],
    [0, -43],
    [9, -41],
    [-4, -33],
    [5, -34],
  ];
  for (const [sx, sy] of seedPts) {
    g.beginPath();
    g.ellipse(cx + sx, cy + sy, 1.5, 2.2, 0, 0, Math.PI * 2);
    g.fill();
  }

  // 草莓水润高光
  g.fillStyle = 'rgba(255, 255, 255, 0.72)';
  g.beginPath();
  g.ellipse(cx - 7, cy - 53, 3.6, 5.4, -0.35, 0, Math.PI * 2);
  g.fill();

  // 草莓翠绿小叶蒂
  g.fillStyle = '#48b856';
  g.strokeStyle = '#2b7b36';
  g.lineWidth = 2;
  g.beginPath();
  g.moveTo(cx, cy - 62);
  g.quadraticCurveTo(cx - 14, cy - 72, cx - 16, cy - 60);
  g.quadraticCurveTo(cx - 6, cy - 58, cx, cy - 61);
  g.quadraticCurveTo(cx + 6, cy - 58, cx + 16, cy - 60);
  g.quadraticCurveTo(cx + 14, cy - 72, cx, cy - 62);
  g.fill();
  g.stroke();

  // 两侧点缀小草莓粒与薄荷糖珠
  g.fillStyle = '#ff576b';
  g.beginPath();
  g.arc(cx - 29, cy - 6, 5.5, 0, Math.PI * 2);
  g.arc(cx + 29, cy - 6, 5.5, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#ffd65a';
  g.beginPath();
  g.arc(cx - 46, cy - 34, 3.2, 0, Math.PI * 2);
  g.arc(cx + 46, cy - 34, 3.2, 0, Math.PI * 2);
  g.fill();

  return prepColorTex(new THREE.CanvasTexture(c), anisotropy);
}


export function createFlightTakeoffTexture(P: PlayerConfig, anisotropy = 4): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d')!;
  g.clearRect(0, 0, 256, 256);

  const isYier = P.key === 'yier';
  const mainCol = isYier ? '#553720' : toColorHex(P.color);
  const ringCol = '#fdf7ea';

  g.fillStyle = mainCol;
  g.beginPath();
  g.arc(128, 128, 120, 0, Math.PI * 2);
  g.fill();

  g.strokeStyle = ringCol;
  g.lineWidth = 12;
  g.beginPath();
  g.arc(128, 128, 106, 0, Math.PI * 2);
  g.stroke();

  g.strokeStyle = 'rgba(253, 247, 234, 0.55)';
  g.lineWidth = 5;
  g.setLineDash([18, 12]);
  g.beginPath();
  g.arc(128, 128, 86, 0, Math.PI * 2);
  g.stroke();
  g.setLineDash([]);

  g.save();
  g.translate(128, 128);
  g.fillStyle = ringCol;
  g.shadowColor = 'rgba(28, 16, 8, 0.35)';
  g.shadowBlur = 6;
  g.shadowOffsetY = 3;

  g.beginPath();
  g.moveTo(0, -64);
  g.quadraticCurveTo(13, -44, 12, -14);
  g.lineTo(10, 42);
  g.lineTo(0, 56);
  g.lineTo(-10, 42);
  g.lineTo(-12, -14);
  g.quadraticCurveTo(-13, -44, 0, -64);
  g.closePath();
  g.fill();

  g.beginPath();
  g.moveTo(11, -18);
  g.lineTo(66, 16);
  g.lineTo(66, 30);
  g.lineTo(10, 12);
  g.lineTo(-10, 12);
  g.lineTo(-66, 30);
  g.lineTo(-66, 16);
  g.lineTo(-11, -18);
  g.closePath();
  g.fill();

  g.beginPath();
  g.moveTo(8, 34);
  g.lineTo(34, 54);
  g.lineTo(34, 64);
  g.lineTo(0, 50);
  g.lineTo(-34, 64);
  g.lineTo(-34, 54);
  g.lineTo(-8, 34);
  g.closePath();
  g.fill();
  g.restore();

  return prepColorTex(new THREE.CanvasTexture(c), anisotropy);
}
