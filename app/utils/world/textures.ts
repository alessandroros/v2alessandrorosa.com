import * as THREE from 'three';
import type { Heightmap } from './terrain';

/* Canvas-drawn textures for the props on the refuge table. */

function canvasTexture(
  w: number,
  h: number,
  draw: (ctx: CanvasRenderingContext2D) => void,
) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (ctx) draw(ctx);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

function rand(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

export function planksTexture(repeat = 1) {
  const t = canvasTexture(1024, 1024, (ctx) => {
    const r = rand(7);
    const plank = 1024 / 8;
    for (let p = 0; p < 8; p++) {
      const base = 92 + r() * 30;
      ctx.fillStyle = `rgb(${base + 40},${base + 8},${base - 30})`;
      ctx.fillRect(0, p * plank, 1024, plank);
      for (let g = 0; g < 60; g++) {
        const y = p * plank + r() * plank;
        ctx.strokeStyle = `rgba(${40 + r() * 30},${25 + r() * 20},10,${0.08 + r() * 0.18})`;
        ctx.lineWidth = 0.6 + r() * 1.8;
        ctx.beginPath();
        ctx.moveTo(0, y);
        for (let x = 0; x <= 1024; x += 64)
          ctx.lineTo(x, y + Math.sin(x / 90 + g) * 3 * r());
        ctx.stroke();
      }
      if (r() > 0.4) {
        ctx.fillStyle = 'rgba(50,28,12,.35)';
        ctx.beginPath();
        ctx.ellipse(
          r() * 1024,
          p * plank + plank / 2,
          10 + r() * 14,
          5 + r() * 6,
          0,
          0,
          Math.PI * 2,
        );
        ctx.fill();
      }
      ctx.fillStyle = 'rgba(20,10,4,.65)';
      ctx.fillRect(0, p * plank, 1024, 3);
    }
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat, repeat);
  return t;
}

/**
 * A real topographic map of the area: contour lines traced from the same
 * heightmap as the 3D terrain, with forest, rock and lakes tinted like a
 * hiking map, and the route to Cima Tosa in red.
 */
export function topoMapTexture(
  map: Heightmap,
  marks: { label: string; u: number; v: number }[],
) {
  const W = 1200;
  const H = Math.round((W * map.meta.height) / map.meta.width);
  return canvasTexture(W, H, (ctx) => {
    const { width: mw, height: mh } = map.meta;
    const img = ctx.createImageData(W, H);
    const hAt = (x: number, y: number) =>
      map.data[
        Math.min(mh - 1, Math.floor((y / H) * mh)) * mw +
          Math.min(mw - 1, Math.floor((x / W) * mw))
      ] ?? 0;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const h = hAt(x, y);
        const band = Math.floor(h / 50);
        const right = Math.floor(hAt(x + 1, y) / 50);
        const down = Math.floor(hAt(x, y + 1) / 50);
        let r = 238,
          g = 230,
          b = 210;
        const flat = h === hAt(x + 2, y) && h === hAt(x, y + 2) && h < 1300;
        if (flat) [r, g, b] = [168, 205, 222];
        else if (h < 1950) [r, g, b] = [214, 226, 190];
        else if (h > 2450) [r, g, b] = [226, 222, 214];
        if (!flat && (band !== right || band !== down)) {
          const index = band % 10 === 0 || right % 10 === 0;
          [r, g, b] = index ? [150, 96, 52] : [190, 140, 96];
        }
        const k = (y * W + x) * 4;
        img.data[k] = r;
        img.data[k + 1] = g;
        img.data[k + 2] = b;
        img.data[k + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);

    // Route from Monte Spinale towards Cima Tosa.
    const spinale = marks.find((m) => m.label.startsWith('M. Spinale'));
    const tosa = marks.find((m) => m.label.startsWith('C. Tosa'));
    if (spinale && tosa) {
      ctx.strokeStyle = '#c42a1c';
      ctx.lineWidth = 4;
      ctx.setLineDash([12, 8]);
      ctx.beginPath();
      const steps = 12;
      for (let s = 0; s <= steps; s++) {
        const t = s / steps;
        const x =
          (spinale.u + (tosa.u - spinale.u) * t + Math.sin(t * 9) * 0.015) * W;
        const y = (spinale.v + (tosa.v - spinale.v) * t) * H;
        if (s) ctx.lineTo(x, y);
        else ctx.moveTo(x, y);
      }
      ctx.stroke();
      ctx.setLineDash([]);
    }

    ctx.font = '600 22px Georgia, serif';
    for (const m of marks) {
      ctx.fillStyle = '#2b2118';
      ctx.beginPath();
      ctx.moveTo(m.u * W, m.v * H - 8);
      ctx.lineTo(m.u * W - 7, m.v * H + 5);
      ctx.lineTo(m.u * W + 7, m.v * H + 5);
      ctx.fill();
      ctx.fillText(m.label, m.u * W + 12, m.v * H + 6);
    }

    // Title block and border.
    ctx.fillStyle = 'rgba(250,246,236,.92)';
    ctx.fillRect(24, 24, 430, 96);
    ctx.strokeStyle = '#2b2118';
    ctx.lineWidth = 2;
    ctx.strokeRect(24, 24, 430, 96);
    ctx.fillStyle = '#2b2118';
    ctx.font = '700 34px Georgia, serif';
    ctx.fillText('DOLOMITI DI BRENTA', 42, 68);
    ctx.font = '20px Georgia, serif';
    ctx.fillText('Carta escursionistica · 1:25 000', 42, 100);
    ctx.lineWidth = 6;
    ctx.strokeRect(3, 3, W - 6, H - 6);
    // Fold lines.
    ctx.strokeStyle = 'rgba(80,60,40,.18)';
    ctx.lineWidth = 2;
    for (const f of [1 / 3, 2 / 3]) {
      ctx.beginPath();
      ctx.moveTo(W * f, 0);
      ctx.lineTo(W * f, H);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.moveTo(0, H / 2);
    ctx.lineTo(W, H / 2);
    ctx.stroke();
  });
}

export function bookCoverTexture() {
  return canvasTexture(512, 700, (ctx) => {
    const g = ctx.createLinearGradient(0, 0, 512, 700);
    g.addColorStop(0, '#7a2a20');
    g.addColorStop(1, '#4d1712');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 512, 700);
    const r = rand(3);
    for (let i = 0; i < 4000; i++) {
      ctx.fillStyle = `rgba(0,0,0,${r() * 0.08})`;
      ctx.fillRect(r() * 512, r() * 700, 2, 2);
    }
    ctx.strokeStyle = '#c9a45c';
    ctx.lineWidth = 4;
    ctx.strokeRect(34, 34, 444, 632);
    ctx.lineWidth = 1.5;
    ctx.strokeRect(46, 46, 420, 608);
    ctx.fillStyle = '#d8b56a';
    ctx.textAlign = 'center';
    ctx.font = '700 46px Georgia, serif';
    ctx.fillText('LIBRO', 256, 270);
    ctx.fillText('DI VETTA', 256, 330);
    ctx.font = 'italic 24px Georgia, serif';
    ctx.fillText('Monte Spinale · 2104 m', 256, 400);
    ctx.beginPath();
    ctx.moveTo(196, 470);
    ctx.lineTo(256, 420);
    ctx.lineTo(286, 445);
    ctx.lineTo(316, 430);
    ctx.lineTo(356, 470);
    ctx.closePath();
    ctx.fill();
  });
}

export function ropeTexture() {
  const t = canvasTexture(256, 64, (ctx) => {
    ctx.fillStyle = '#c0392b';
    ctx.fillRect(0, 0, 256, 64);
    for (let x = -64; x < 320; x += 32) {
      ctx.fillStyle = '#f1c40f';
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x + 10, 0);
      ctx.lineTo(x + 26, 64);
      ctx.lineTo(x + 16, 64);
      ctx.fill();
      ctx.fillStyle = '#1f2d5a';
      ctx.fillRect(x + 22, 0, 3, 64);
    }
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(60, 1);
  return t;
}

export interface ScreenInfo {
  temperature: string;
  sky: string;
  time: string;
}

export function drawTerminal(ctx: CanvasRenderingContext2D, info: ScreenInfo) {
  ctx.fillStyle = '#0b1210';
  ctx.fillRect(0, 0, 640, 400);
  ctx.font = '19px "JetBrains Mono", Menlo, monospace';
  const lines: [string, string][] = [
    ['#7be08a', 'alessandro@spinale:~$ kubectl get nodes'],
    ['#cfe8d8', 'NAME          STATUS   AGE'],
    ['#cfe8d8', 'brenta-01     Ready    5y'],
    ['#cfe8d8', 'brenta-02     Ready    5y'],
    ['#7be08a', 'alessandro@spinale:~$ curl -s meteo/cima-tosa'],
    ['#ffd27a', `{"temp": "${info.temperature}", "sky": "${info.sky}"}`],
    ['#7be08a', `alessandro@spinale:~$ date +%H:%M`],
    ['#cfe8d8', info.time],
    ['#7be08a', 'alessandro@spinale:~$ █'],
  ];
  lines.forEach(([color, text], i) => {
    ctx.fillStyle = color;
    ctx.fillText(text, 22, 44 + i * 38);
  });
}

export function drawRadio(ctx: CanvasRenderingContext2D, info: ScreenInfo) {
  ctx.fillStyle = '#2d302c';
  ctx.fillRect(0, 0, 640, 384);
  ctx.fillStyle = '#1b1d1a';
  for (let y = 40; y < 344; y += 18) {
    for (let x = 40; x < 300; x += 18) {
      if ((x - 170) ** 2 + (y - 192) ** 2 < 140 ** 2) {
        ctx.beginPath();
        ctx.arc(x, y, 5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
  ctx.fillStyle = '#ffb547';
  ctx.fillRect(340, 70, 260, 130);
  ctx.fillStyle = '#3a2508';
  ctx.font = '600 22px "JetBrains Mono", Menlo, monospace';
  ctx.fillText('CIMA TOSA', 356, 104);
  ctx.font = '700 52px "JetBrains Mono", Menlo, monospace';
  ctx.fillText(info.temperature, 356, 168);
  ctx.fillStyle = '#d7d2c4';
  ctx.font = '20px "JetBrains Mono", Menlo, monospace';
  ctx.fillText(info.sky.toUpperCase(), 344, 240);
  ctx.fillText('FM 104.3 · BRENTA', 344, 272);
  for (const [x, label] of [
    [380, 'VOL'],
    [520, 'TUNE'],
  ] as const) {
    ctx.fillStyle = '#111';
    ctx.beginPath();
    ctx.arc(x, 320, 26, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#8b8b80';
    ctx.fillText(label, x - 22, 372);
  }
}

export function screenTexture(
  draw: (ctx: CanvasRenderingContext2D, info: ScreenInfo) => void,
  h = 400,
) {
  const canvas = document.createElement('canvas');
  canvas.width = 640;
  canvas.height = h;
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const update = (info: ScreenInfo) => {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    draw(ctx, info);
    texture.needsUpdate = true;
  };
  return { texture, update };
}
