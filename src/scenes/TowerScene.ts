import Phaser from 'phaser';
import {
  CELL_W, FLOOR_H, GROUND_Y, LOT_CELLS, LOT_X, MAX_BASEMENTS, MAX_FLOORS,
  WORLD_H, WORLD_W, cellX, floorY,
} from '../config';
import { activeTheme as theme } from '../themes';
import { buildTextures } from '../textures';
import { buildSprites } from '../decor/sprites';
import { drawRoom } from '../decor/rooms';
import { tool, tower } from '../state';
import type { PlacedRoom } from '../sim/Tower';

/** Pixels the pointer may move before a press counts as a drag instead of a click. */
const CLICK_SLOP = 6;

/** The side-view cutaway of the tower and its lot. */
export class TowerScene extends Phaser.Scene {
  private roomLayer!: Phaser.GameObjects.Container;
  private roomViews = new Map<number, Phaser.GameObjects.Container>();
  private ghost!: Phaser.GameObjects.Graphics;
  private ghostLabel!: Phaser.GameObjects.Text;
  private press?: { x: number; y: number; scrollX: number; scrollY: number; dragging: boolean };

  constructor() {
    super('tower');
  }

  create() {
    buildTextures(this, theme);
    buildSprites(this);
    this.drawSky();
    this.drawGround();
    this.drawGrid();
    this.roomLayer = this.add.container(0, 0);
    this.ghost = this.add.graphics().setDepth(10);
    this.ghostLabel = this.add
      .text(0, 0, '', {
        fontFamily: 'monospace', fontSize: '10px', color: '#fbe3b0',
        backgroundColor: '#2b1d14dd', padding: { x: 3, y: 2 },
      })
      .setOrigin(0.5, 1)
      .setDepth(11)
      .setVisible(false);
    this.addLeaves();

    tower.on('room-added', (r: PlacedRoom) => this.showRoom(r));
    tower.on('room-removed', (r: PlacedRoom) => {
      this.roomViews.get(r.uid)?.destroy();
      this.roomViews.delete(r.uid);
    });
    tower.init();

    this.setupCamera();
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => this.updateGhost(p));
    this.input.keyboard?.on('keydown-ESC', () => this.events.emit('tool-cancel'));
    this.input.mouse?.disableContextMenu();
    this.scene.launch('ui');
  }

  private showRoom(r: PlacedRoom) {
    const view = drawRoom(this, theme, r.def, cellX(r.cell), floorY(r.floor), r.def.width * CELL_W, FLOOR_H);
    this.roomLayer.add(view);
    this.roomViews.set(r.uid, view);
  }

  private drawSky() {
    const p = theme.palette;
    const sky = this.add.graphics();
    sky.fillGradientStyle(p.skyTop, p.skyTop, p.skyBottom, p.skyBottom, 1);
    sky.fillRect(0, 0, WORLD_W, GROUND_Y);
    const hills = this.add.graphics();
    hills.fillStyle(p.grassDark, 0.35);
    for (let x = 0; x < WORLD_W; x += CELL_W * 2) {
      const h = 40 + Math.round(((Math.sin(x / 140) + Math.sin(x / 57)) * 18) / 8) * 8;
      hills.fillRect(x, GROUND_Y - h, CELL_W * 2, h);
    }
  }

  private drawGround() {
    const rows = Math.ceil((WORLD_H - GROUND_Y) / 16);
    this.add.tileSprite(0, GROUND_Y, WORLD_W, 16, 'grass').setOrigin(0);
    this.add.tileSprite(0, GROUND_Y + 16, WORLD_W, 16 * 3, 'dirt').setOrigin(0);
    this.add.tileSprite(0, GROUND_Y + 64, WORLD_W, 16 * rows, 'stone').setOrigin(0);
  }

  /** Faint floor and cell lines over the buildable lot. Toggled with G. */
  private drawGrid() {
    const g = this.add.graphics();
    g.lineStyle(1, 0xffffff, 0.1);
    const top = floorY(MAX_FLOORS - 1);
    const bottom = floorY(-MAX_BASEMENTS) + FLOOR_H;
    for (let c = 0; c <= LOT_CELLS; c++) g.lineBetween(cellX(c), top, cellX(c), bottom);
    for (let f = -MAX_BASEMENTS; f <= MAX_FLOORS; f++) {
      const y = floorY(f) + FLOOR_H;
      g.lineBetween(LOT_X, y, cellX(LOT_CELLS), y);
    }
    this.input.keyboard?.on('keydown-G', () => g.setVisible(!g.visible));
  }

  private addLeaves() {
    this.add
      .particles(0, 0, 'leaf', {
        x: { min: 0, max: WORLD_W },
        y: { min: GROUND_Y - 1600, max: GROUND_Y - 40 },
        lifespan: 9000,
        speedY: { min: 30, max: 60 },
        speedX: { min: -30, max: 10 },
        rotate: { min: 0, max: 360 },
        scale: { min: 1, max: 2 },
        tint: theme.particleColors,
        frequency: 60,
        quantity: 1,
        alpha: { start: 1, end: 0.6 },
      })
      .setDepth(20);
  }

  private floorAt(p: Phaser.Input.Pointer) {
    return Math.floor((GROUND_Y - p.worldY) / FLOOR_H);
  }

  private cellAt(p: Phaser.Input.Pointer) {
    return Math.floor((p.worldX - LOT_X) / CELL_W);
  }

  /** Left cell of a room of this width centred on the pointer. */
  private placeCell(p: Phaser.Input.Pointer, width: number) {
    return Math.round((p.worldX - LOT_X) / CELL_W - width / 2);
  }

  private updateGhost(p: Phaser.Input.Pointer) {
    this.ghost.clear();
    this.ghostLabel.setVisible(false);
    const id = tool.current;
    if (!id) return;

    if (id === 'demolish') {
      const room = tower.roomAt(this.floorAt(p), this.cellAt(p));
      if (!room) return;
      const ok = tower.canRemove(room);
      const color = ok.ok ? 0xff5533 : 0x888888;
      const x = cellX(room.cell);
      const y = floorY(room.floor);
      const w = room.def.width * CELL_W;
      this.ghost.fillStyle(color, 0.35).fillRect(x, y, w, FLOOR_H);
      this.ghost.lineStyle(2, color, 1).strokeRect(x, y, w, FLOOR_H);
      const refund = Math.round(room.def.cost / 2).toLocaleString();
      this.label(x + w / 2, y, ok.ok ? `Demolish ${room.def.name} (+$${refund})` : ok.reason);
      return;
    }

    const def = theme.rooms.find((r) => r.id === id);
    if (!def) return;
    const floor = this.floorAt(p);
    const cell = this.placeCell(p, def.width);
    const ok = tower.canPlace(def, floor, cell);
    const x = cellX(cell);
    const y = floorY(floor);
    const w = def.width * CELL_W;
    this.ghost.fillStyle(def.color, 0.55).fillRect(x, y, w, FLOOR_H);
    this.ghost.lineStyle(2, ok.ok ? 0x7cff6b : 0xff5533, 1).strokeRect(x, y, w, FLOOR_H);
    this.label(x + w / 2, y, ok.ok ? `${def.name}  $${def.cost.toLocaleString()}` : ok.reason);
  }

  private label(x: number, y: number, text: string) {
    this.ghostLabel.setText(text).setPosition(x, y - 3).setVisible(true);
  }

  /** Left click with a tool selected builds or demolishes. */
  private click(p: Phaser.Input.Pointer) {
    const id = tool.current;
    if (!id) return;
    if (id === 'demolish') {
      const room = tower.roomAt(this.floorAt(p), this.cellAt(p));
      if (!room) return;
      const res = tower.remove(room);
      this.events.emit('toast', res.ok ? `Demolished ${room.def.name}` : res.reason);
    } else {
      const def = theme.rooms.find((r) => r.id === id)!;
      const res = tower.place(def, this.floorAt(p), this.placeCell(p, def.width));
      this.events.emit('toast', res.ok ? `Built ${def.name}` : res.reason);
    }
    this.updateGhost(p);
  }

  private setupCamera() {
    const cam = this.cameras.main;
    cam.setBounds(0, 0, WORLD_W, WORLD_H);
    cam.setZoom(2.5);
    cam.centerOn(cellX(LOT_CELLS / 2), GROUND_Y - FLOOR_H * 1.5);

    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (p.rightButtonDown()) {
        this.events.emit('tool-cancel');
        return;
      }
      this.press = { x: p.x, y: p.y, scrollX: cam.scrollX, scrollY: cam.scrollY, dragging: false };
    });
    this.input.on('pointerup', (p: Phaser.Input.Pointer) => {
      if (this.press && !this.press.dragging && p.leftButtonReleased()) this.click(p);
      this.press = undefined;
    });
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (!this.press || !p.isDown) return;
      const dx = p.x - this.press.x;
      const dy = p.y - this.press.y;
      if (!this.press.dragging && Math.hypot(dx, dy) < CLICK_SLOP) return;
      this.press.dragging = true;
      cam.scrollX = this.press.scrollX - dx / cam.zoom;
      cam.scrollY = this.press.scrollY - dy / cam.zoom;
    });
    this.input.on('wheel', (_p: unknown, _o: unknown, _dx: number, dy: number) => {
      cam.setZoom(Phaser.Math.Clamp(cam.zoom * (dy > 0 ? 0.9 : 1.1), 0.6, 4));
    });

    const keys = this.input.keyboard?.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT') as
      | Record<string, Phaser.Input.Keyboard.Key>
      | undefined;
    this.events.on('update', (_t: number, dt: number) => {
      if (!keys) return;
      const speed = (0.6 * dt) / cam.zoom;
      if (keys.A.isDown || keys.LEFT.isDown) cam.scrollX -= speed;
      if (keys.D.isDown || keys.RIGHT.isDown) cam.scrollX += speed;
      if (keys.W.isDown || keys.UP.isDown) cam.scrollY -= speed;
      if (keys.S.isDown || keys.DOWN.isDown) cam.scrollY += speed;
    });
  }
}
