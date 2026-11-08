import Phaser from 'phaser';

/**
 * Tiny pixel-art sprites defined as text maps. Each character is one art pixel;
 * '.' is transparent. Rendered at PX screen pixels per art pixel.
 */
const PX = 2;

const COLORS: Record<string, number> = {
  o: 0xd9822b, // pumpkin orange
  O: 0xb5641c, // pumpkin shade
  y: 0xffd75e, // candle / glow yellow
  Y: 0xf2a65a, // flame orange
  g: 0x5f8a2e, // stalk green
  G: 0x3f6b2a, // dark green
  k: 0x2a1a10, // near black
  t: 0xd8b56a, // tan / dried husk
  T: 0xa8843f, // dark tan
  h: 0x5c3c24, // hat brown
  f: 0xe8c98a, // burlap face
  s: 0xe2c15a, // straw
  S: 0xb8962b, // straw shade
  r: 0xc8532b, // red
  R: 0x8f3b1f, // dark red
  b: 0x3d5a80, // denim
  p: 0x7a5232, // wood pole
  w: 0xf1ead8, // wax white
  u: 0x7b3f8c, // grape purple
  n: 0xe8e0d0, // bone
};

const SPRITES: Record<string, string[]> = {
  pumpkin: [
    '...gG...',
    '.oOooOo.',
    'oOooooOo',
    'oOooooOo',
    'oOooooOo',
    '.oOooOo.',
  ],
  pumpkinSmall: [
    '..g..',
    '.oOo.',
    'oOoOo',
    '.oOo.',
  ],
  jackolantern: [
    '...kk...',
    '...gG...',
    '.oOooOo.',
    'oyOooyOo',
    'oooooooo',
    'oyykyyyo',
    '.oOooOo.',
  ],
  hay: [
    'sssSsssSssss',
    'sSssssSsssSs',
    'SSSSSSSSSSSS',
    'ssSsssssSsss',
    'sssssSssssSs',
    'SSSSSSSSSSSS',
    'sSsssSsssssS',
  ],
  corn: [
    '..g..',
    '.tg..',
    '..gt.',
    '..g.t',
    '.ygg.',
    '.yg..',
    '.ygt.',
    '..g..',
    't.g..',
    '.tgy.',
    '..gy.',
    '..gy.',
    '.tg..',
    '..g..',
    '..gt.',
    '.TTT.',
  ],
  scarecrow: [
    '...hhh...',
    '...hhh...',
    '.hhhhhhh.',
    '...fff...',
    '...kfk...',
    '...fff...',
    'ssrrrrrss',
    's.rrRrr.s',
    '..rRrrr..',
    '..rrrRr..',
    '...bbb...',
    '...b.b...',
    '...b.b...',
    '...s.s...',
    '....p....',
    '....p....',
  ],
  cornucopia: [
    '.......ory..',
    '....ttTouyg.',
    '..tTttTyorgu',
    '.tTttTtoyrgu',
    'tTttTttTrrg.',
    '.TttTt......',
    '..T.........',
  ],
  wreath: [
    '...rOy...',
    '.OyrOyrO.',
    '.r.....y.',
    'O.......r',
    'y.......O',
    'r.......y',
    '.O..R..r.',
    '.yrRRRrO.',
    '...rRr...',
  ],
  candle: [
    '.y.',
    '.Y.',
    '.w.',
    '.w.',
    'www',
  ],
  turkeyLeg: [
    '....oO',
    '...oOO',
    '..oOO.',
    '.nn...',
    'nn....',
  ],
  pie: [
    '.TTTTTT.',
    'ToOoOoOT',
    'TTTTTTTT',
  ],
};

/** Generates every sprite above as a texture keyed by its name. */
export function buildSprites(scene: Phaser.Scene) {
  for (const [key, rows] of Object.entries(SPRITES)) {
    const w = Math.max(...rows.map((r) => r.length));
    const g = scene.make.graphics({ x: 0, y: 0 }, false);
    rows.forEach((row, y) => {
      [...row].forEach((ch, x) => {
        const c = COLORS[ch];
        if (c === undefined) return;
        g.fillStyle(c, 1);
        g.fillRect(x * PX, y * PX, PX, PX);
      });
    });
    g.generateTexture(key, w * PX, rows.length * PX);
    g.destroy();
  }
}
