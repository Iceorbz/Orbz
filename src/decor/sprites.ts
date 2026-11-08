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
  c: 0x8a827a, // stone
  C: 0x645d57, // dark stone
  m: 0x6b5a6e, // crypt purple
  e: 0x9ad06a, // screen green
  z: 0x7fae5a, // zombie skin
  Z: 0x5e8a44, // zombie shade
  P: 0x4a3b5c, // trousers
  N: 0xc9bfae, // bone shade
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
  coffin: [
    '..hhhhhhhhhhhh..',
    '.hpppppppppppph.',
    'hppppppnnpppppph',
    'hpppppnnnnppppph',
    '.hpppppnnppppph.',
    '..hhhhhhhhhhhh..',
  ],
  crate: [
    'hpppphpppph',
    'pTTTTpTTTTp',
    'hpppphpppph',
    'pTTTTpTTTTp',
    'hpppphpppph',
  ],
  monitor: [
    'kkkkkkkk',
    'keeGeeek',
    'keGeeeGk',
    'keeeeeek',
    'kkkkkkkk',
    '...kk...',
    '..kkkk..',
  ],
  chair: [
    'h....',
    'h....',
    'h....',
    'hhhhh',
    'h...h',
    'h...h',
  ],
  oven: [
    'CcccCcccCccc',
    'cCcccCcccCcc',
    'ccCkkkkkkCcc',
    'cCkYyYyYYkCc',
    'cCkyYyYyykCc',
    'cCkrRrRrrkCc',
    'cccCcccCcccc',
    'CCCCCCCCCCCC',
  ],
  turkey: [
    '...TTTT...',
    '.TTttttTT.',
    'TttttttttT',
    'TtTttttTtT',
    '.nTTTTTTn.',
    '..nnnnnn..',
  ],
  bookshelf: [
    'hhhhhhhh',
    'hrbyRubh',
    'hhhhhhhh',
    'hubrryuh',
    'hhhhhhhh',
    'hyRbuubh',
    'hhhhhhhh',
  ],
  tombstone: [
    '.cccc.',
    'ccCCcc',
    'cCccCc',
    'ccCCcc',
    'cccccc',
    'gggggg',
  ],
  pie: [
    '.TTTTTT.',
    'ToOoOoOT',
    'TTTTTTTT',
  ],
};

const ZOMBIE_TOP = [
  '..hhh...',
  '.zzzzz..',
  '.zzzkz..',
  '.zzzzzz.',
  '..zzZ...',
  '.bbbbzzz',
  '.bbbbb..',
  '.bbbbb..',
  '.PPPPP..',
];
const SKELETON_TOP = [
  '..nnn...',
  '.nnnnn..',
  '.nkknk..',
  '.nnnnn..',
  '..nkn...',
  '..nnn...',
  '.nNnNnnn',
  '.nNnNn..',
  '..nnn...',
];
const PILGRIM_HAT = ['..kkkk..', '..kyyk..', '.kkkkkk.'];
const LEGS_A = (c: string) => [`.${c}${c}.${c}${c}..`, `.${c}${c}..${c}${c}.`, `.${c}....${c}.`, 'kk....kk'];
const LEGS_B = (c: string) => [`..${c}${c}${c}...`, `..${c}${c}${c}...`, `..${c}.${c}...`, '..kk.kk.'];

/** Monster patrons, each with two walking frames: `${kind}_0` and `${kind}_1`. */
export const MONSTER_KINDS = ['zombie', 'skeleton', 'pilgrim', 'skelpilgrim'] as const;
export type MonsterKind = (typeof MONSTER_KINDS)[number];
const MONSTERS: Record<MonsterKind, [string[], string[]]> = {
  zombie: [[...ZOMBIE_TOP, ...LEGS_A('P')], [...ZOMBIE_TOP, ...LEGS_B('P')]],
  skeleton: [[...SKELETON_TOP, ...LEGS_A('n')], [...SKELETON_TOP, ...LEGS_B('n')]],
  pilgrim: [
    [...PILGRIM_HAT, ...ZOMBIE_TOP.slice(1), ...LEGS_A('P')],
    [...PILGRIM_HAT, ...ZOMBIE_TOP.slice(1), ...LEGS_B('P')],
  ],
  skelpilgrim: [
    [...PILGRIM_HAT, ...SKELETON_TOP.slice(1), ...LEGS_A('n')],
    [...PILGRIM_HAT, ...SKELETON_TOP.slice(1), ...LEGS_B('n')],
  ],
};
for (const [kind, frames] of Object.entries(MONSTERS)) {
  frames.forEach((rows, i) => (SPRITES[`${kind}_${i}`] = rows));
}

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
