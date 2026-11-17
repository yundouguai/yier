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
  g.fillStyle = '#86a45b';
  g.fillRect(0, 0, 256, 256);
  const tones = ['#7a9851', '#90ae64', '#6f8d47', '#98b46b', '#a2bc73'];
  for (let i = 0; i < 1400; i++) {
    g.fillStyle = tones[i % tones.length];
    g.globalAlpha = 0.45;
    g.fillRect(
      Math.random() * 256,
      Math.random() * 256,
      2 + Math.random() * 3,
      1 + Math.random() * 2,
    );
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(12, 12);
  return prepColorTex(t, anisotropy);
}

export function createMoatTexture(anisotropy: number): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d')!;
  g.fillStyle = '#5c99ad';
  g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 42; i++) {
    g.strokeStyle = [
      'rgba(185,228,238,.28)',
      'rgba(130,185,205,.25)',
      'rgba(255,255,255,.16)',
    ][i % 3];
    g.lineWidth = 1 + Math.random() * 2;
    const y = Math.random() * 256;
    g.beginPath();
    g.moveTo(0, y);
    for (let x = 0; x <= 256; x += 16) {
      g.lineTo(x, y + Math.sin(x * 0.06 + i) * 5);
    }
    g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(8, 3);
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
