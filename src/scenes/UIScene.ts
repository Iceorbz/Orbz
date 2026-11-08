import Phaser from 'phaser';
import { activeTheme as theme } from '../themes';
import { tool, tower } from '../state';

const BAR_H = 40;
const MENU_H = 58;
const BTN_W = 144;
const FONT = 'monospace';

interface Button {
  id: string;
  bg: Phaser.GameObjects.Rectangle;
}

/** Screen-space HUD: money bar on top, build menu along the bottom, toasts. */
export class UIScene extends Phaser.Scene {
  private buttons: Button[] = [];
  private info!: Phaser.GameObjects.Text;
  private toastText!: Phaser.GameObjects.Text;
  private toastTimer?: Phaser.Time.TimerEvent;

  constructor() {
    super('ui');
  }

  create() {
    const p = theme.palette;

    // Top bar.
    const top = this.add.rectangle(0, 0, this.scale.width, BAR_H, p.hud, 0.94).setOrigin(0).setInteractive();
    const topLine = this.add.rectangle(0, BAR_H, this.scale.width, 3, 0xe08a2e).setOrigin(0);
    this.add.text(12, 11, theme.title, { fontFamily: FONT, fontSize: '16px', color: p.accentText, fontStyle: 'bold' });
    const money = this.add.text(250, 12, '', { fontFamily: FONT, fontSize: '15px', color: p.hudText });
    const showMoney = (m: number) => {
      money.setText(`$ ${m.toLocaleString()}`).setColor(m < 0 ? '#ff7b6b' : p.hudText);
    };
    showMoney(tower.money);
    tower.on('money', showMoney);
    this.add.text(400, 12, 'Day 1  ·  Nov 1  ·  ☆☆☆☆☆', { fontFamily: FONT, fontSize: '15px', color: p.hudText });

    // Build menu.
    const menu = this.add.rectangle(0, 0, this.scale.width, MENU_H, p.hud, 0.94).setOrigin(0).setInteractive();
    const menuLine = this.add.rectangle(0, 0, this.scale.width, 3, 0xe08a2e).setOrigin(0);
    const tools = theme.rooms.filter((r) => r.kind !== 'lobby');
    const entries = [
      ...tools.map((r) => ({ id: r.id, name: r.name, sub: `$${r.cost.toLocaleString()}`, color: r.color, desc: r.description })),
      { id: 'demolish', name: 'Demolish', sub: 'refund 50%', color: 0x8f3b1f, desc: 'Tear a room down. Clear what is above it first.' },
    ];
    const group = this.add.container(0, 0);
    entries.forEach((e, i) => {
      const x = 8 + i * (BTN_W + 6);
      const bg = this.add.rectangle(x, 8, BTN_W, MENU_H - 14, 0x3d2a1c).setOrigin(0).setStrokeStyle(2, 0x5c3c24);
      const sw = this.add.rectangle(x + 8, 16, 14, 28, e.color).setOrigin(0).setStrokeStyle(1, 0x000000, 0.6);
      const name = this.add.text(x + 28, 13, shortName(e.name), {
        fontFamily: FONT, fontSize: '11px', color: p.hudText,
      });
      const cost = this.add.text(x + 28, 30, e.sub, { fontFamily: FONT, fontSize: '11px', color: p.accentText });
      bg.setInteractive({ useHandCursor: true })
        .on('pointerover', () => this.info.setText(`${e.name}: ${e.desc}`))
        .on('pointerout', () => this.info.setText(this.idleInfo()))
        .on('pointerdown', () => this.select(tool.current === e.id ? null : e.id));
      group.add([bg, sw, name, cost]);
      this.buttons.push({ id: e.id, bg });
    });

    this.info = this.add
      .text(12, 0, this.idleInfo(), {
        fontFamily: FONT, fontSize: '12px', color: p.hudText, backgroundColor: '#2b1d14cc', padding: { x: 6, y: 4 },
      })
      .setOrigin(0, 1);

    this.toastText = this.add
      .text(0, BAR_H + 14, '', {
        fontFamily: FONT, fontSize: '14px', color: '#fbe3b0', backgroundColor: '#5c3c24ee', padding: { x: 10, y: 6 },
      })
      .setOrigin(0.5, 0)
      .setVisible(false);

    const layout = (w: number, h: number) => {
      top.setSize(w, BAR_H);
      topLine.setSize(w, 3);
      menu.setPosition(0, h - MENU_H).setSize(w, MENU_H);
      menuLine.setPosition(0, h - MENU_H).setSize(w, 3);
      group.setPosition(0, h - MENU_H);
      this.info.setPosition(12, h - MENU_H - 8);
      this.toastText.setX(w / 2);
    };
    layout(this.scale.width, this.scale.height);
    this.scale.on('resize', (s: Phaser.Structs.Size) => layout(s.width, s.height));

    const towerScene = this.scene.get('tower');
    towerScene.events.on('tool-cancel', () => this.select(null));
    towerScene.events.on('toast', (msg: string) => this.toast(msg));
    this.input.keyboard?.on('keydown-ESC', () => this.select(null));
  }

  private idleInfo() {
    return tool.current
      ? 'Click to place · Right-click or Esc to stop · Drag to pan'
      : 'Pick a room below to build · Drag or WASD to pan · Wheel to zoom · G toggles grid';
  }

  private select(id: string | null) {
    tool.current = id;
    for (const b of this.buttons) b.bg.setStrokeStyle(2, b.id === id ? 0xf2c14e : 0x5c3c24).setFillStyle(b.id === id ? 0x5c3c24 : 0x3d2a1c);
    this.info.setText(this.idleInfo());
  }

  private toast(msg: string) {
    this.toastText.setText(msg).setVisible(true);
    this.toastTimer?.remove();
    this.toastTimer = this.time.delayedCall(1800, () => this.toastText.setVisible(false));
  }
}

/** Drops the leading adjective so names fit on a button ("Cozy Crypt Apartment" -> "Crypt Apartment"). */
function shortName(name: string) {
  const words = name.split(' ');
  return words.length > 2 ? words.slice(1).join(' ') : name;
}
