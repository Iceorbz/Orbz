import type { Theme } from './types';

export const thanksgiving: Theme = {
  id: 'thanksgiving',
  title: 'Harvest Haunt Tower',
  tagline: 'The undead are coming home for the feast.',
  palette: {
    skyTop: 0xf2a65a,
    skyBottom: 0xfbe3b0,
    nightTop: 0x1b1430,
    nightBottom: 0x4a2f4f,
    grass: 0x8a9a3b,
    grassDark: 0x66752a,
    dirt: 0x7a5232,
    dirtDark: 0x5c3c24,
    stone: 0x77706a,
    stoneDark: 0x5a5450,
    hud: 0x2b1d14,
    hudText: '#fbe3b0',
    accentText: '#f2a65a',
  },
  particleColors: [0xc8532b, 0xe08a2e, 0xb8862b, 0x8f3b1f],
  rooms: [
    {
      id: 'lobby', short: 'Lobby', name: 'Gourd Lobby', width: 16, cost: 0, color: 0xa8743f, accent: 0xe08a2e,
      kind: 'lobby', description: 'Hay bales and a pumpkin welcome mat.',
    },
    {
      id: 'crypt', short: 'Crypt', name: 'Cozy Crypt Apartment', width: 8, cost: 6000, color: 0x6b5a6e, accent: 0xc8532b,
      kind: 'home', rent: 500, capacity: 3, description: 'Autumn wreath on the coffin. A zombie family lives here.',
    },
    {
      id: 'feast', short: 'Feast Hall', name: 'Harvest Feast Hall', width: 12, cost: 15000, color: 0x8f3b1f, accent: 0xf2c14e,
      kind: 'food', stars: 2, spend: 25, capacity: 12, description: 'Long tables, turkey legs and a lot of groaning.',
    },
    {
      id: 'bakery', short: 'Pie Bakery', name: 'Pumpkin Pie Bakery', width: 6, cost: 8000, color: 0xd9822b, accent: 0xfbe3b0,
      kind: 'food', spend: 15, capacity: 5, description: 'Fresh pies, slightly haunted.',
    },
    {
      id: 'market', short: 'Market', name: 'Cornucopia Market', width: 10, cost: 12000, color: 0xb8862b, accent: 0x8a9a3b,
      kind: 'shop', stars: 2, spend: 20, capacity: 8, description: 'Gourds, corn and bone-shaped candles.',
    },
    {
      id: 'office', short: 'Office', name: 'Haunted Office', width: 9, cost: 10000, color: 0x5a6b5e, accent: 0xb8862b,
      kind: 'office', rent: 800, capacity: 4, description: 'Skeletons doing spreadsheets.',
    },
    {
      id: 'stairs', short: 'Stairs', name: 'Creaky Stairs', width: 2, cost: 1000, color: 0x5c3c24, accent: 0xa8743f,
      kind: 'transport', description: 'Connects this floor to the one above. Slow, but the dead are patient.',
    },
    {
      id: 'elevator', short: 'Elevator', name: 'Bone Elevator', width: 4, cost: 5000, color: 0x3d3a40, accent: 0xe8e0d0,
      kind: 'transport', description: 'Rattles a bit. Carries six monsters. Stack them to make a shaft.',
    },
  ],
  foods: ['turkey leg', 'pumpkin pie', 'cranberry goo', 'corn on the cob', 'stuffing', 'brain gravy'],
  names: [
    'Gourdon', 'Bonnie', 'Mort', 'Grisly', 'Cran', 'Pumpkina', 'Rattles', 'Marrow', 'Ghoulia', 'Stuffy',
    'Squashley', 'Tibia', 'Gravy', 'Nutmeg', 'Femur', 'Rotney', 'Cobb', 'Yamuel', 'Scapula', 'Drumstick',
  ],
  decor: ['hay bale', 'pumpkin', 'gourd pile', 'autumn wreath', 'corn stalk', 'scarecrow'],
};
