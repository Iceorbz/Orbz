import Phaser from 'phaser';
import { activeTheme as theme } from '../themes';

/** Screen-space HUD drawn on top of the tower. */
export class UIScene extends Phaser.Scene {
  constructor() {
    super('ui');
  }

  create() {
    const p = theme.palette;
    const bar = this.add.graphics();
    const draw = () => {
      bar.clear();
      bar.fillStyle(p.hud, 0.92).fillRect(0, 0, this.scale.width, 36);
      bar.fillStyle(0xe08a2e, 1).fillRect(0, 36, this.scale.width, 3);
    };
    draw();
    this.scale.on('resize', draw);

    this.add.text(12, 9, theme.title, { fontFamily: 'monospace', fontSize: '16px', color: p.accentText, fontStyle: 'bold' });
    this.add.text(260, 11, '$ 100,000', { fontFamily: 'monospace', fontSize: '14px', color: p.hudText });
    this.add.text(400, 11, 'Day 1  ·  Nov 1  ·  ☆☆☆☆☆', { fontFamily: 'monospace', fontSize: '14px', color: p.hudText });

    const help = this.add
      .text(12, this.scale.height - 10, 'Drag or WASD to pan · Wheel to zoom · G toggles grid', {
        fontFamily: 'monospace', fontSize: '12px', color: p.hudText, backgroundColor: '#2b1d14aa', padding: { x: 6, y: 4 },
      })
      .setOrigin(0, 1);
    this.scale.on('resize', (s: Phaser.Structs.Size) => help.setY(s.height - 10));
  }
}
