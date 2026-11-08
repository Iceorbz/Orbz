import Phaser from 'phaser';
import type { Theme } from '../themes';

const WOOD_DARK = 0x3b2414;
const WOOD = 0x7a5232;
const PLANK_A = 0xa8743f;
const PLANK_B = 0x9a6836;
const WAINSCOT = 0x6b4426;
const STONE = 0x8a827a;
const STONE_DARK = 0x645d57;

/**
 * Draws the decorated harvest lobby with its top-left corner at (x, y).
 * Everything is procedural pixel art so the theme can restyle it later.
 */
export function drawLobby(scene: Phaser.Scene, theme: Theme, x: number, y: number, w: number, h: number) {
  const g = scene.add.graphics();
  const floorTop = y + h - 8;

  // Back wall: vertical wooden planks with seams and nail dots.
  for (let px = 0; px < w; px += 8) {
    g.fillStyle(px % 16 ? PLANK_B : PLANK_A, 1).fillRect(x + px, y, 8, h);
    g.fillStyle(0x000000, 0.18).fillRect(x + px, y, 1, h);
    g.fillStyle(0x2a1a10, 0.5).fillRect(x + px + 3, y + 10, 2, 2).fillRect(x + px + 3, y + h - 28, 2, 2);
  }

  // Wainscot panel along the lower wall.
  g.fillStyle(WAINSCOT, 1).fillRect(x, floorTop - 16, w, 16);
  g.fillStyle(theme.rooms[0].accent, 1).fillRect(x, floorTop - 18, w, 2);
  for (let px = 6; px < w - 10; px += 20) {
    g.fillStyle(0x000000, 0.18).fillRect(x + px, floorTop - 13, 14, 10);
  }

  // Floor: checker tiles.
  for (let px = 0; px < w; px += 8) {
    g.fillStyle((px / 8) % 2 ? 0x5c3c24 : 0x8a5a32, 1).fillRect(x + px, floorTop, 8, 4);
    g.fillStyle((px / 8) % 2 ? 0x8a5a32 : 0x5c3c24, 1).fillRect(x + px, floorTop + 4, 8, 4);
  }

  // Ceiling beam.
  g.fillStyle(WOOD_DARK, 1).fillRect(x, y, w, 6);
  g.fillStyle(0xe08a2e, 1).fillRect(x, y + 6, w, 2);

  // Windows with a sunset view.
  const winW = 30;
  const winH = 22;
  const winY = y + 12;
  const windows = [x + 26, x + w - 26 - winW];
  for (const wx of windows) {
    g.fillStyle(WOOD_DARK, 1).fillRect(wx - 3, winY - 3, winW + 6, winH + 6);
    g.fillGradientStyle(0xf2a65a, 0xf2a65a, 0xfbe3b0, 0xfbe3b0, 1).fillRect(wx, winY, winW, winH);
    g.fillStyle(0x8a9a3b, 1).fillRect(wx, winY + winH - 5, winW, 5);
    // A little autumn tree in the window.
    g.fillStyle(0x5c3c24, 1).fillRect(wx + 20, winY + 10, 2, 8);
    g.fillStyle(0xc8532b, 1).fillRect(wx + 16, winY + 4, 10, 6);
    g.fillStyle(0xe08a2e, 1).fillRect(wx + 18, winY + 2, 6, 4);
    // Mullions.
    g.fillStyle(WOOD_DARK, 1).fillRect(wx + winW / 2 - 1, winY, 2, winH).fillRect(wx, winY + winH / 2 - 1, winW, 2);
    // Sill with a little pumpkin.
    g.fillStyle(WOOD, 1).fillRect(wx - 5, winY + winH + 3, winW + 10, 3);
    scene.add.image(wx + 6, winY + winH + 3, 'pumpkinSmall').setOrigin(0.5, 1);
  }

  // Stone pillars on both ends.
  for (const px of [x, x + w - 10]) {
    g.fillStyle(STONE, 1).fillRect(px, y, 10, h);
    for (let py = 0; py < h; py += 8) {
      g.fillStyle(STONE_DARK, 1).fillRect(px, y + py, 10, 1);
      g.fillRect(px + ((py / 8) % 2 ? 3 : 7), y + py, 1, 8);
    }
    g.fillStyle(STONE_DARK, 1).fillRect(px - 1, y + 6, 12, 3);
  }

  // Leaf bunting strung across the ceiling.
  const colors = [0xc8532b, 0xe08a2e, 0xf2c14e, 0x8f3b1f];
  g.lineStyle(1, 0x2a1a10, 0.8);
  const sag = (t: number) => Math.sin(t * Math.PI) * 5;
  for (let i = 0, px = 12; px < w - 18; px += 10, i++) {
    const t = (px - 12) / (w - 30);
    const sy = y + 9 + sag(t);
    g.fillStyle(colors[i % colors.length], 1);
    g.fillTriangle(x + px, sy, x + px + 8, sy, x + px + 4, sy + 7);
  }

  // Double door with a wreath.
  const doorW = 30;
  const doorH = 36;
  const dx = x + w / 2 - doorW / 2;
  const dy = floorTop - doorH;
  g.fillStyle(WOOD_DARK, 1).fillRect(dx - 3, dy - 3, doorW + 6, doorH + 3);
  g.fillStyle(0x6b4426, 1).fillRect(dx, dy, doorW / 2 - 1, doorH).fillRect(dx + doorW / 2 + 1, dy, doorW / 2 - 1, doorH);
  g.fillStyle(0x000000, 0.2);
  for (const ox of [dx + 3, dx + doorW / 2 + 4]) g.fillRect(ox, dy + 4, 8, 12).fillRect(ox, dy + 20, 8, 12);
  g.fillStyle(0xf2c14e, 1).fillRect(dx + doorW / 2 - 4, dy + 20, 2, 2).fillRect(dx + doorW / 2 + 2, dy + 20, 2, 2);
  scene.add.image(dx + doorW / 2, dy + 2, 'wreath').setOrigin(0.5, 0);

  // Rug in front of the door.
  g.fillStyle(0x8f3b1f, 1).fillRect(dx - 12, floorTop, doorW + 24, 3);
  g.fillStyle(0xf2c14e, 1).fillRect(dx - 12, floorTop + 3, doorW + 24, 1);

  // Corn stalks flanking the door.
  scene.add.image(dx - 10, floorTop, 'corn').setOrigin(0.5, 1);
  scene.add.image(dx + doorW + 10, floorTop, 'corn').setOrigin(0.5, 1);

  // Reception desk with a pie and a candle.
  const deskX = x + w / 2 - 78;
  g.fillStyle(WOOD, 1).fillRect(deskX, floorTop - 14, 40, 14);
  g.fillStyle(0x000000, 0.2).fillRect(deskX + 3, floorTop - 11, 15, 9).fillRect(deskX + 22, floorTop - 11, 15, 9);
  g.fillStyle(WOOD_DARK, 1).fillRect(deskX - 2, floorTop - 16, 44, 3);
  scene.add.image(deskX + 10, floorTop - 16, 'pie').setOrigin(0.5, 1);
  const candle = scene.add.image(deskX + 32, floorTop - 16, 'candle').setOrigin(0.5, 1);
  glow(scene, candle.x, candle.y - 9, 10, 0xffd75e);

  // Cornucopia on a side table.
  const tableX = x + w / 2 + 44;
  g.fillStyle(WOOD_DARK, 1).fillRect(tableX, floorTop - 12, 30, 3);
  g.fillStyle(WOOD, 1).fillRect(tableX + 3, floorTop - 9, 2, 9).fillRect(tableX + 25, floorTop - 9, 2, 9);
  scene.add.image(tableX + 15, floorTop - 12, 'cornucopia').setOrigin(0.5, 1);

  // Hay bales with pumpkins stacked in the corners.
  scene.add.image(x + 26, floorTop, 'hay').setOrigin(0.5, 1);
  scene.add.image(x + 22, floorTop - 14, 'pumpkin').setOrigin(0.5, 1);
  scene.add.image(x + 34, floorTop - 14, 'pumpkinSmall').setOrigin(0.5, 1);
  scene.add.image(x + w - 50, floorTop, 'hay').setOrigin(0.5, 1);
  scene.add.image(x + w - 50, floorTop - 14, 'turkeyLeg').setOrigin(0.5, 1);

  // Scarecrow greeter.
  scene.add.image(x + w - 24, floorTop, 'scarecrow').setOrigin(0.5, 1);

  // Hanging jack-o'-lanterns with flickering glow.
  for (const fx of [0.3, 0.7]) {
    const lx = x + Math.round(w * fx);
    g.lineStyle(1, 0x2a1a10, 1).lineBetween(lx, y + 8, lx, y + 16);
    glow(scene, lx, y + 23, 16, 0xffb347);
    scene.add.image(lx, y + 16, 'jackolantern').setOrigin(0.5, 0);
  }

  // Outer shell: roof trim and a hanging wooden sign.
  g.fillStyle(WOOD_DARK, 1).fillRect(x - 4, y - 4, w + 8, 4);
  g.fillStyle(0xe08a2e, 1).fillRect(x - 4, y - 6, w + 8, 2);
  const label = theme.rooms.find((r) => r.kind === 'lobby')!.name.toUpperCase();
  const sign = scene.add.text(x + w / 2, y - 10, label, {
    fontFamily: 'monospace', fontSize: '11px', color: '#fbe3b0', fontStyle: 'bold',
    backgroundColor: '#5c3c24', padding: { x: 6, y: 3 },
  }).setOrigin(0.5, 1);
  g.lineStyle(1, 0x2a1a10, 1)
    .lineBetween(sign.x - sign.width / 2 + 6, sign.y, sign.x - sign.width / 2 + 6, y - 6)
    .lineBetween(sign.x + sign.width / 2 - 6, sign.y, sign.x + sign.width / 2 - 6, y - 6);
  scene.add.image(sign.x - sign.width / 2 - 6, y - 6, 'pumpkinSmall').setOrigin(0.5, 1);
  scene.add.image(sign.x + sign.width / 2 + 6, y - 6, 'pumpkinSmall').setOrigin(0.5, 1);
}

/** A soft additive glow that flickers like candlelight. */
function glow(scene: Phaser.Scene, x: number, y: number, r: number, color: number) {
  const c = scene.add.circle(x, y, r, color, 0.28).setBlendMode(Phaser.BlendModes.ADD);
  scene.tweens.add({
    targets: c, alpha: { from: 0.18, to: 0.38 }, scale: { from: 0.9, to: 1.1 },
    duration: 300 + Math.random() * 300, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
  });
}
