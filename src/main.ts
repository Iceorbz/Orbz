import Phaser from 'phaser';
import { TowerScene } from './scenes/TowerScene';
import { UIScene } from './scenes/UIScene';
import { tower } from './state';

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: '#1b1424',
  pixelArt: true,
  scale: { mode: Phaser.Scale.RESIZE, width: window.innerWidth, height: window.innerHeight },
  scene: [TowerScene, UIScene],
});

// Handy for poking at the game from the browser console while it's a prototype.
(window as unknown as { orbz: unknown }).orbz = { game, tower };
