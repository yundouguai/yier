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

export function createStartPadTexture(P: PlayerConfig, anisotropy: number): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d')!;
  const hexColor = toColorHex(P.color);
  const strokeCol = P.key === 'yier' ? '#4A4A55' : '#FFFFFF';
  g.fillStyle = hexColor;
  g.fillRect(0, 0, 256, 256);
  g.strokeStyle = strokeCol;
  g.lineWidth = 14;
  g.beginPath();
  g.arc(128, 128, 108, 0, Math.PI * 2);
  g.stroke();
  g.fillStyle = strokeCol;
  g.font = 'bold 46px system-ui,"PingFang SC",sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText('START', 128, 104);
  g.font = 'bold 34px system-ui,"PingFang SC",sans-serif';
  g.fillText('起点', 128, 158);
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
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  g.fillStyle = '#FBF7EF';
  g.fillRect(0, 0, 128, 128);
  g.strokeStyle = '#D8CDB8';
  g.lineWidth = 6;
  g.strokeRect(6, 6, 116, 116);
  g.fillStyle = '#3A352C';
  const P: Record<number, [number, number][]> = {
    1: [[64, 64]],
    2: [
      [38, 38],
      [90, 90],
    ],
    3: [
      [34, 34],
      [64, 64],
      [94, 94],
    ],
    4: [
      [38, 38],
      [90, 38],
      [38, 90],
      [90, 90],
    ],
    5: [
      [38, 38],
      [90, 38],
      [64, 64],
      [38, 90],
      [90, 90],
    ],
    6: [
      [38, 34],
      [90, 34],
      [38, 64],
      [90, 64],
      [38, 94],
      [90, 94],
    ],
  };
  for (const [x, y] of P[n]) {
    g.beginPath();
    g.arc(x, y, 11, 0, Math.PI * 2);
    g.fill();
  }
  return prepColorTex(new THREE.CanvasTexture(c), anisotropy);
}

export function createNumberBadgeTexture(num: number, anisotropy: number): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  g.fillStyle = '#1f9d55';
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
  g.fillText(String(num), 64, 68);
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


