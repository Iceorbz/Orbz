import Phaser from 'phaser';
import { activeTheme as theme } from '../themes';
import { clock, tool, tower, world, type Selection } from '../state';
import { FLOOR_COST, type PlacedRoom } from '../sim/Tower';
import { floorName } from '../sim/People';
import { SPEEDS } from '../sim/Clock';
import type { TowerScene } from './TowerScene';

const BAR_H = 44;
const FONT = 'monospace';
const GOLD = 0xf2c14e;
const PANEL_W = 260;

interface ToolEntry {
  id: string;
  name: string;
  short: string;
  sub: string;
  color: number;
  desc: string;
}

/** Screen-space HUD: clock and money on top, build menu at the bottom, draft confirm bar, info panel. */
export class UIScene extends Phaser.Scene {
  private towerScene!: TowerScene;
  private menu!: Phaser.GameObjects.Container;
  private menuH = 58;
  private buttons: { id: string; bg: Phaser.GameObjects.Rectangle }[] = [];
  private speedButtons: { speed: number; bg: Phaser.GameObjects.Rectangle }[] = [];
  private info!: Phaser.GameObjects.Text;
  private toastText!: Phaser.GameObjects.Text;
  private toastTimer?: Phaser.Time.TimerEvent;
  private timeText!: Phaser.GameObjects.Text;
  private confirmBar!: Phaser.GameObjects.Container;
  private confirmLabel!: Phaser.GameObjects.Text;
  private confirmOk!: Phaser.GameObjects.Rectangle;
  private panel!: Phaser.GameObjects.Container;
  private panelBg!: Phaser.GameObjects.Rectangle;
  private panelText!: Phaser.GameObjects.Text;
  private panelAction!: Phaser.GameObjects.Text;
  private selection: Selection = null;
  private following: number | null = null;
  private armedDemolish = false;
  private entries: ToolEntry[] = [];

  constructor() {
    super('ui');
  }

  create() {
    this.towerScene = this.scene.get('tower') as TowerScene;
    this.input.addPointer(1);
    this.buildTopBar();
    this.buildMenu();
    this.buildConfirmBar();
    this.buildPanel();

    this.info = this.add
      .text(12, 0, '', {
        fontFamily: FONT, fontSize: '12px', color: theme.palette.hudText, backgroundColor: '#2b1d14cc', padding: { x: 6, y: 4 },
      })
      .setOrigin(0, 1);
    this.toastText = this.add
      .text(0, BAR_H + 12, '', {
        fontFamily: FONT, fontSize: '14px', color: '#fbe3b0', backgroundColor: '#5c3c24ee', padding: { x: 10, y: 6 },
        align: 'center', wordWrap: { width: 520 },
      })
      .setOrigin(0.5, 0).setVisible(false).setDepth(50);

    this.layout();
    this.scale.on('resize', () => this.layout());
    this.setInfo();

    this.towerScene.events.on('tool-cancel', () => this.selectTool(null));
    this.towerScene.events.on('toast', (msg: string) => this.toast(msg));
    this.towerScene.events.on('select', (sel: Selection) => this.showSelection(sel));
    this.input.keyboard?.on('keydown-ESC', () => {
      if (!this.towerScene.draft) this.selectTool(null);
    });
    clock.on('speed', () => this.paintSpeeds());
  }

  update() {
    this.timeText.setText(`Day ${clock.day}  ${clock.dateLabel}  ${clock.label}`);
    this.updateConfirmBar();
    if (this.selection) this.refreshPanel();
  }

  // ---------- Top bar ----------

  private topBg!: Phaser.GameObjects.Rectangle;
  private topLine!: Phaser.GameObjects.Rectangle;
  private moneyText!: Phaser.GameObjects.Text;
  private speedGroup!: Phaser.GameObjects.Container;

  private buildTopBar() {
    const p = theme.palette;
    this.topBg = this.add.rectangle(0, 0, 10, BAR_H, p.hud, 0.95).setOrigin(0).setInteractive();
    this.topLine = this.add.rectangle(0, BAR_H, 10, 3, 0xe08a2e).setOrigin(0);
    this.add.text(12, 13, theme.title, { fontFamily: FONT, fontSize: '16px', color: p.accentText, fontStyle: 'bold' });
    this.moneyText = this.add.text(240, 14, '', { fontFamily: FONT, fontSize: '15px', color: p.hudText });
    const showMoney = (m: number) => this.moneyText.setText(`$${m.toLocaleString()}`).setColor(m < 0 ? '#ff7b6b' : p.hudText);
    showMoney(tower.money);
    tower.on('money', showMoney);
    this.timeText = this.add.text(380, 14, '', { fontFamily: FONT, fontSize: '15px', color: p.hudText });

    this.speedGroup = this.add.container(0, 6);
    const labels = ['❚❚', '1×', '2×', '4×'];
    SPEEDS.forEach((s, i) => {
      const bg = this.add.rectangle(i * 46, 0, 42, 32, 0x3d2a1c).setOrigin(0).setStrokeStyle(2, 0x5c3c24);
      const t = this.add.text(i * 46 + 21, 16, labels[i], { fontFamily: FONT, fontSize: '14px', color: p.hudText }).setOrigin(0.5);
      bg.setInteractive({ useHandCursor: true }).on('pointerdown', () => clock.setSpeed(s));
      this.speedGroup.add([bg, t]);
      this.speedButtons.push({ speed: s, bg });
    });
    this.paintSpeeds();
  }

  private paintSpeeds() {
    for (const b of this.speedButtons) {
      const on = b.speed === clock.speed;
      b.bg.setFillStyle(on ? 0x8f3b1f : 0x3d2a1c).setStrokeStyle(2, on ? GOLD : 0x5c3c24);
    }
  }

  // ---------- Build menu ----------

  private buildMenu() {
    this.entries = [
      { id: 'floor', name: 'Floor', short: 'Floor', sub: `$${FLOOR_COST}/cell`, color: 0x7a5232, desc: 'Lay empty floor first, then put rooms on it. Drag the gold handles to resize.' },
      ...theme.rooms
        .filter((r) => r.kind !== 'lobby')
        .map((r) => ({ id: r.id, name: r.name, short: r.short, sub: `$${r.cost.toLocaleString()}`, color: r.color, desc: r.description })),
      { id: 'demolish', name: 'Demolish', short: 'Demolish', sub: 'refund 50%', color: 0x8f3b1f, desc: 'Tear down a room or an empty floor.' },
    ];
    this.menu = this.add.container(0, 0);
  }

  /** Lays the build buttons out in as many rows as the screen width needs. */
  private layoutMenu(w: number, h: number) {
    this.menu.removeAll(true);
    this.buttons = [];
    const n = this.entries.length;
    const cols = Math.max(3, Math.min(n, Math.floor((w - 8) / 104)));
    const rows = Math.ceil(n / cols);
    const bw = Math.min(150, (w - 8) / cols - 6);
    const bh = 42;
    this.menuH = rows * (bh + 6) + 10;
    this.menu.setPosition(0, h - this.menuH);
    const p = theme.palette;
    const bg = this.add.rectangle(0, 0, w, this.menuH, p.hud, 0.95).setOrigin(0).setInteractive();
    const line = this.add.rectangle(0, 0, w, 3, 0xe08a2e).setOrigin(0);
    this.menu.add([bg, line]);
    this.entries.forEach((e, i) => {
      const x = 6 + (i % cols) * (bw + 6);
      const y = 8 + Math.floor(i / cols) * (bh + 6);
      const btn = this.add.rectangle(x, y, bw, bh, 0x3d2a1c).setOrigin(0).setStrokeStyle(2, 0x5c3c24);
      const sw = this.add.rectangle(x + 7, y + 7, 12, bh - 14, e.color).setOrigin(0).setStrokeStyle(1, 0x000000, 0.6);
      const name = this.add.text(x + 25, y + 6, e.short, { fontFamily: FONT, fontSize: '12px', color: p.hudText });
      const cost = this.add.text(x + 25, y + 23, e.sub, { fontFamily: FONT, fontSize: '11px', color: p.accentText });
      btn.setInteractive({ useHandCursor: true })
        .on('pointerover', () => this.setInfo(`${e.name}: ${e.desc}`))
        .on('pointerout', () => this.setInfo())
        .on('pointerdown', () => this.selectTool(tool.current === e.id ? null : e.id));
      this.menu.add([btn, sw, name, cost]);
      this.buttons.push({ id: e.id, bg: btn });
    });
    this.paintTools();
  }

  private paintTools() {
    for (const b of this.buttons) {
      const on = b.id === tool.current;
      b.bg.setStrokeStyle(2, on ? GOLD : 0x5c3c24).setFillStyle(on ? 0x5c3c24 : 0x3d2a1c);
    }
  }

  private selectTool(id: string | null) {
    tool.current = id;
    this.paintTools();
    this.towerScene.toolChanged();
    this.setInfo();
    if (id) this.closePanel();
  }

  private setInfo(text?: string) {
    const entry = this.entries.find((e) => e.id === tool.current);
    const idle = !entry
      ? 'Tap a room or monster to inspect it · Pick a tool below to build · Drag to pan · Pinch or wheel to zoom · Space pauses'
      : entry.id === 'demolish'
        ? 'Tap what you want to demolish, then tap ✓ to confirm'
        : `Tap to place a draft · Drag it to adjust · Tap ✓ (or tap the draft again) to build`;
    this.info.setText(text ?? idle);
  }

  // ---------- Draft confirm bar ----------

  private buildConfirmBar() {
    this.confirmBar = this.add.container(0, 0).setDepth(40).setVisible(false);
    const bg = this.add.rectangle(0, 0, 10, 34, 0x2b1d14, 0.95).setOrigin(0.5, 1).setStrokeStyle(2, 0x5c3c24).setInteractive();
    this.confirmLabel = this.add.text(0, -17, '', { fontFamily: FONT, fontSize: '12px', color: '#fbe3b0' }).setOrigin(0.5);
    this.confirmOk = this.add.rectangle(0, -17, 30, 26, 0x3f6b2a).setStrokeStyle(2, 0x9ad06a).setInteractive({ useHandCursor: true });
    const okText = this.add.text(0, -17, '✓', { fontFamily: FONT, fontSize: '16px', color: '#ffffff', fontStyle: 'bold' }).setOrigin(0.5);
    const cancel = this.add.rectangle(0, -17, 30, 26, 0x8f3b1f).setStrokeStyle(2, 0xff7b6b).setInteractive({ useHandCursor: true });
    const cancelText = this.add.text(0, -17, '✕', { fontFamily: FONT, fontSize: '16px', color: '#ffffff', fontStyle: 'bold' }).setOrigin(0.5);
    this.confirmOk.on('pointerdown', () => this.towerScene.confirmDraft());
    cancel.on('pointerdown', () => this.towerScene.cancelDraft());
    this.confirmBar.add([bg, this.confirmLabel, this.confirmOk, okText, cancel, cancelText]);
    this.confirmBar.setData('parts', { bg, okText, cancel, cancelText });
  }

  private updateConfirmBar() {
    const v = this.towerScene.draftView();
    if (!v) {
      this.confirmBar.setVisible(false);
      return;
    }
    const { bg, okText, cancel, cancelText } = this.confirmBar.getData('parts');
    this.confirmLabel.setText(v.label).setColor(v.ok ? '#fbe3b0' : '#ff9b8b');
    const width = this.confirmLabel.width + 92;
    bg.setSize(width, 34);
    bg.setOrigin(0.5, 1);
    this.confirmLabel.setX(-width / 2 + 12 + this.confirmLabel.width / 2);
    this.confirmOk.setX(width / 2 - 56).setFillStyle(v.ok ? 0x3f6b2a : 0x4a4440).setStrokeStyle(2, v.ok ? 0x9ad06a : 0x6a6460);
    okText.setX(width / 2 - 56).setAlpha(v.ok ? 1 : 0.4);
    cancel.setX(width / 2 - 20);
    cancelText.setX(width / 2 - 20);
    const x = Phaser.Math.Clamp(v.x + v.w / 2, width / 2 + 4, this.scale.width - width / 2 - 4);
    const y = Phaser.Math.Clamp(v.y - 6, BAR_H + 42, this.scale.height - this.menuH - 4);
    this.confirmBar.setPosition(x, y).setVisible(true);
  }

  // ---------- Info panel ----------

  private buildPanel() {
    this.panel = this.add.container(0, BAR_H + 10).setVisible(false).setDepth(30);
    this.panelBg = this.add.rectangle(0, 0, PANEL_W, 100, 0x2b1d14, 0.96).setOrigin(0).setStrokeStyle(2, 0xe08a2e).setInteractive();
    this.panelText = this.add.text(12, 10, '', {
      fontFamily: FONT, fontSize: '12px', color: '#fbe3b0', lineSpacing: 4, wordWrap: { width: PANEL_W - 36 },
    });
    const close = this.add.text(PANEL_W - 10, 8, '✕', { fontFamily: FONT, fontSize: '16px', color: '#fbe3b0' })
      .setOrigin(1, 0).setInteractive({ useHandCursor: true });
    close.on('pointerdown', () => this.towerScene.select(null));
    this.panelAction = this.add.text(12, 0, '', {
      fontFamily: FONT, fontSize: '13px', color: '#ffffff', backgroundColor: '#8f3b1f', padding: { x: 10, y: 6 },
    }).setInteractive({ useHandCursor: true });
    this.panelAction.on('pointerdown', () => this.panelActionPressed());
    this.panel.add([this.panelBg, this.panelText, close, this.panelAction]);
  }

  private showSelection(sel: Selection) {
    this.selection = sel;
    this.armedDemolish = false;
    if (!sel) return this.closePanel();
    this.panel.setVisible(true);
    this.refreshPanel();
  }

  private closePanel() {
    this.selection = null;
    this.panel.setVisible(false);
    if (this.following !== null) {
      this.following = null;
      this.towerScene.followMonster(null);
    }
  }

  private refreshPanel() {
    const sel = this.selection;
    const people = world.people;
    let lines: string[] = [];
    let action = '';
    if (sel?.type === 'room') {
      const room = tower.rooms.get(sel.uid);
      if (!room) return this.towerScene.select(null);
      lines = this.describeRoom(room);
      if (room.def.kind !== 'lobby') action = this.armedDemolish ? 'Tap again to demolish' : 'Demolish';
    } else if (sel?.type === 'monster' && people) {
      const m = people.all.get(sel.id);
      if (!m) return this.towerScene.select(null);
      lines = people.describe(m);
      action = this.following === m.id ? 'Stop following' : 'Follow';
    }
    this.panelText.setText(lines.join('\n'));
    this.panelAction.setText(action).setVisible(!!action);
    this.panelAction.setY(this.panelText.height + 20);
    this.panelAction.setBackgroundColor(sel?.type === 'monster' ? '#3f6b2a' : '#8f3b1f');
    this.panelBg.setSize(PANEL_W, this.panelText.height + (action ? 64 : 22));
  }

  private describeRoom(room: PlacedRoom): string[] {
    const def = room.def;
    const people = world.people;
    const names = room.occupants.map((id) => people?.all.get(id)?.title).filter(Boolean) as string[];
    const lines = [def.name.toUpperCase(), floorName(room.floor), def.description, ''];
    switch (def.kind) {
      case 'home':
      case 'office': {
        const who = def.kind === 'home' ? 'Residents' : 'Workers';
        lines.push(names.length ? `${who}: ${names.length}/${def.capacity}` : 'Vacant. New tenants are on their way.');
        names.forEach((n) => lines.push(`  ${n}`));
        lines.push(`Rent: $${def.rent}/day`);
        break;
      }
      case 'food':
      case 'shop':
        lines.push(`Visitors now: ${names.length}/${def.capacity}`, `Each visitor spends $${def.spend}`);
        lines.push(def.kind === 'food' ? 'Busy at lunch and dinner' : 'Open 10 AM to 8 PM');
        break;
      case 'transport':
        lines.push(def.id === 'elevator' ? 'Stack elevators on top of each other to make a taller shaft.' : 'Links this floor to the one above.');
        break;
      case 'lobby':
        lines.push('Every monster enters and leaves through here.');
        break;
    }
    if (def.kind !== 'transport' && def.kind !== 'lobby') {
      lines.push(`Earned today: $${room.earnedToday.toLocaleString()}`, `Earned total: $${room.earnedTotal.toLocaleString()}`);
    }
    return lines;
  }

  private panelActionPressed() {
    const sel = this.selection;
    if (sel?.type === 'room') {
      const room = tower.rooms.get(sel.uid);
      if (!room) return;
      if (!this.armedDemolish) {
        this.armedDemolish = true;
        return;
      }
      const res = tower.remove(room);
      this.toast(res.ok ? `Demolished ${room.def.name}` : res.reason);
      this.armedDemolish = false;
    } else if (sel?.type === 'monster') {
      this.following = this.following === sel.id ? null : sel.id;
      this.towerScene.followMonster(this.following);
    }
  }

  // ---------- Layout & toasts ----------

  private layout() {
    const w = this.scale.width;
    const h = this.scale.height;
    this.topBg.setSize(w, BAR_H);
    this.topLine.setSize(w, 3);
    this.speedGroup.setX(w - 4 * 46 - 6);
    // Hide the clock text when the bar is too narrow to fit it beside the speed buttons.
    this.timeText.setVisible(w > 760);
    this.layoutMenu(w, h);
    this.info.setPosition(8, h - this.menuH - 6).setWordWrapWidth(w - 16);
    this.toastText.setX(w / 2);
    this.panel.setX(w - PANEL_W - 8);
  }

  private toast(msg: string) {
    this.toastText.setText(msg).setVisible(true);
    this.toastTimer?.remove();
    this.toastTimer = this.time.delayedCall(2600, () => this.toastText.setVisible(false));
  }
}
