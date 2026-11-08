import Phaser from 'phaser';
import type { Theme } from './themes';

const BLOCK = 16;
const PX = 2; // each "pixel" of block art is 2x2 screen pixels

/** Small deterministic PRNG so block textures look the same every run. */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

function shade(color: number, amount: number): number {
  const c = Phaser.Display.Color.IntegerToColor(color);
  const f = (v: number) => Phaser.Math.Clamp(Math.round(v * (1 + amount)), 0, 255);
  return Phaser.Display.Color.GetColor(f(c.red), f(c.green), f(c.blue));
}

/** Draws a noisy block made of chunky pixels and saves it as a texture. */
function noisyBlock(
  scene: Phaser.Scene, key: string, base: number, dark: number, seed: number,
  top?: { color: number; dark: number; rows: number },
) {
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  const r = rng(seed);
  const n = BLOCK / PX;
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const isTop = top && (y < top.rows || (y === top.rows && r() < 0.5));
      const c = isTop ? (r() < 0.3 ? top!.dark : top!.color) : r() < 0.28 ? dark : r() < 0.15 ? shade(base, 0.12) : base;
      g.fillStyle(c, 1);
      g.fillRect(x * PX, y * PX, PX, PX);
    }
  }
  g.generateTexture(key, BLOCK, BLOCK);
  g.destroy();
}

/** Builds all procedural textures for the given theme. No image files needed. */
export function buildTextures(scene: Phaser.Scene, theme: Theme) {
  const p = theme.palette;
  noisyBlock(scene, 'grass', p.dirt, p.dirtDark, 11, { color: p.grass, dark: p.grassDark, rows: 2 });
  noisyBlock(scene, 'dirt', p.dirt, p.dirtDark, 23);
  noisyBlock(scene, 'stone', p.stone, p.stoneDark, 37);

  // Leaf particle: a tiny 3x3 chunky pixel shape, tinted per particle.
  const leaf = scene.make.graphics({ x: 0, y: 0 }, false);
  leaf.fillStyle(0xffffff, 1);
  leaf.fillRect(2, 0, 2, 2);
  leaf.fillRect(0, 2, 6, 2);
  leaf.fillRect(2, 4, 2, 2);
  leaf.generateTexture('leaf', 6, 6);
  leaf.destroy();

  // Pumpkin decor block.
  const pk = scene.make.graphics({ x: 0, y: 0 }, false);
  pk.fillStyle(0x3f6b2a, 1); pk.fillRect(6, 0, 4, 4);
  pk.fillStyle(0xd9822b, 1); pk.fillRect(0, 4, 16, 12);
  pk.fillStyle(0xb5641c, 1); pk.fillRect(4, 4, 2, 12); pk.fillRect(10, 4, 2, 12);
  pk.generateTexture('pumpkin', 16, 16);
  pk.destroy();

  // Hay bale decor block.
  const hay = scene.make.graphics({ x: 0, y: 0 }, false);
  hay.fillStyle(0xe2c15a, 1); hay.fillRect(0, 0, 16, 12);
  hay.fillStyle(0xb8962b, 1); hay.fillRect(0, 4, 16, 2); hay.fillRect(4, 0, 2, 12);
  hay.generateTexture('hay', 16, 12);
  hay.destroy();
}
