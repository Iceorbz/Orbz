import Phaser from 'phaser';
import {
  CELL_W, FLOOR_H, GROUND_Y, LOT_CELLS, LOT_X, MAX_BASEMENTS, MAX_FLOORS,
  WORLD_H, WORLD_W, cellX, floorY,
} from '../config';
import { activeTheme as theme } from '../themes';
import { buildTextures } from '../textures';
import { buildSprites } from '../decor/sprites';
import { drawRoom } from '../decor/rooms';
import { drawFloors } from '../decor/floors';
import { clock, tool, tower, transit, world, type Selection } from '../state';
import { FLOOR_COST, type PlacedRoom } from '../sim/Tower';
import { People } from '../sim/People';

/** Screen pixels the pointer may move before a press counts as a drag instead of a tap. */
const CLICK_SLOP = 8;
/** Default width, in cells, of a new floor draft. */
const FLOOR_DRAFT = 8;

/** A build or demolish waiting for the player to confirm it. */
interface Draft {
  tool: string;
  floor: number;
  cell: number;
  /** Last cell (inclusive). For rooms this is cell + width - 1. */
  end: number;
  /** Demolish target. */
  room?: PlacedRoom;
}

export interface DraftView {
  x: number;
  y: number;
  w: number;
  ok: boolean;
  label: string;
}

type PressMode = 'pan' | 'move' | 'resize-left' | 'resize-right';

/** The side-view cutaway of the tower: building, drafts, monsters and the camera. */
export class TowerScene extends Phaser.Scene {
  private roomViews = new Map<number, Phaser.GameObjects.Container>();
  private roomLayer!: Phaser.GameObjects.Container;
  private floorG!: Phaser.GameObjects.Graphics;
  private ghost!: Phaser.GameObjects.Graphics;
  private ghostLabel!: Phaser.GameObjects.Text;
  private cars!: Phaser.GameObjects.Graphics;
  private highlight!: Phaser.GameObjects.Graphics;
  private night!: Phaser.GameObjects.Rectangle;
  private people!: People;
  draft: Draft | null = null;
  selection: Selection = null;
  private press?: {
    x: number; y: number; scrollX: number; scrollY: number; dragging: boolean;
    mode: PressMode; startCell: number; startFloor: number; draft?: Draft;
  };
  private pinch?: { dist: number; zoom: number };
  private hoverPointer?: Phaser.Input.Pointer;

  constructor() {
    super('tower');
  }

  create() {
    buildTextures(this, theme);
    buildSprites(this);
    this.drawSky();
    this.drawGround();
    this.drawGrid();
    this.floorG = this.add.graphics();
    this.roomLayer = this.add.container(0, 0);
    this.cars = this.add.graphics().setDepth(5.5);
    this.highlight = this.add.graphics().setDepth(9);
    this.ghost = this.add.graphics().setDepth(10);
    this.ghostLabel = this.add
      .text(0, 0, '', {
        fontFamily: 'monospace', fontSize: '10px', color: '#fbe3b0',
        backgroundColor: '#2b1d14dd', padding: { x: 3, y: 2 },
      })
      .setOrigin(0.5, 1).setDepth(11).setVisible(false);
    this.addLeaves();

    tower.on('room-added', (r: PlacedRoom) => this.showRoom(r));
    tower.on('room-removed', (r: PlacedRoom) => {
      this.roomViews.get(r.uid)?.destroy();
      this.roomViews.delete(r.uid);
      if (this.selection?.type === 'room' && this.selection.uid === r.uid) this.select(null);
    });
    tower.on('floors', () => drawFloors(this.floorG, tower));
    tower.on('income', (r: PlacedRoom, amount: number) => this.moneyPop(r, amount));
    tower.init();

    this.people = new People(this, tower, transit, clock);
    world.people = this.people;
    this.people.on('toast', (msg: string) => this.events.emit('toast', msg));

    this.setupCamera();
    this.setupInput();
    this.scene.launch('ui');
  }

  update(_t: number, delta: number) {
    const dt = clock.tick(delta);
    this.people.update(dt);
    this.drawCars();
    this.drawNight();
    this.drawHighlight();
  }

  // ---------- World drawing ----------

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
    this.night = this.add.rectangle(0, 0, WORLD_W, GROUND_Y, p.nightTop, 1).setOrigin(0).setAlpha(0);
    const hills = this.add.graphics();
    hills.fillStyle(p.grassDark, 0.35);
    for (let x = 0; x < WORLD_W; x += CELL_W * 2) {
      const h = 40 + Math.round(((Math.sin(x / 140) + Math.sin(x / 57)) * 18) / 8) * 8;
      hills.fillRect(x, GROUND_Y - h, CELL_W * 2, h);
    }
  }

  /** Darkens the sky from dusk to dawn. */
  private drawNight() {
    const h = clock.minuteOfDay / 60;
    const dark = h < 5 ? 1 : h < 7 ? 1 - (h - 5) / 2 : h < 17 ? 0 : h < 19.5 ? (h - 17) / 2.5 : 1;
    this.night.setAlpha(dark * 0.82);
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

  private drawCars() {
    const g = this.cars.clear();
    for (const s of transit.shafts) {
      const y = floorY(s.car);
      const x = s.x - 22;
      const open = s.doorTimer > 0;
      g.fillStyle(0xe8e0d0, 1).fillRect(x, y + 8, 44, FLOOR_H - 14);
      g.fillStyle(open ? 0xffe2a8 : 0x5a5450, 1).fillRect(x + 3, y + 11, 38, FLOOR_H - 20);
      g.fillStyle(0xc9bfae, 1).fillRect(x + 19, y + 4, 6, 4);
      g.lineStyle(1, 0x2a1a10, 0.8).lineBetween(s.x, floorY(s.top), s.x, y + 4);
    }
  }

  private drawHighlight() {
    const g = this.highlight.clear();
    const sel = this.selection;
    if (sel?.type === 'room') {
      const r = tower.rooms.get(sel.uid);
      if (r) g.lineStyle(2, 0xf2c14e, 1).strokeRect(cellX(r.cell) - 1, floorY(r.floor) - 1, r.def.width * CELL_W + 2, FLOOR_H + 2);
    } else if (sel?.type === 'monster') {
      const m = this.people.all.get(sel.id);
      if (m?.sprite.visible) {
        const b = m.sprite.getBounds();
        g.fillStyle(0xf2c14e, 1).fillTriangle(b.centerX - 4, b.top - 8, b.centerX + 4, b.top - 8, b.centerX, b.top - 3);
      }
    }
  }

  private moneyPop(r: PlacedRoom, amount: number) {
    const t = this.add
      .text(cellX(r.cell) + (r.def.width * CELL_W) / 2, floorY(r.floor) + 10, `+$${amount}`, {
        fontFamily: 'monospace', fontSize: '11px', color: '#f2c14e', fontStyle: 'bold', stroke: '#2b1d14', strokeThickness: 3,
      })
      .setOrigin(0.5, 1).setDepth(12);
    this.tweens.add({ targets: t, y: t.y - 18, alpha: 0, duration: 1400, onComplete: () => t.destroy() });
  }

  // ---------- Drafts ----------

  private makeDraft(id: string, floor: number, centerX: number): Draft | null {
    const cell = Math.floor((centerX - LOT_X) / CELL_W);
    if (id === 'floor') {
      const start = Phaser.Math.Clamp(cell - FLOOR_DRAFT / 2 + 1, 0, LOT_CELLS - FLOOR_DRAFT);
      return { tool: id, floor, cell: start, end: start + FLOOR_DRAFT - 1 };
    }
    if (id === 'demolish') {
      const room = tower.roomAt(floor, cell);
      if (room) return { tool: id, floor, cell: room.cell, end: room.cell + room.def.width - 1, room };
      if (tower.hasSlab(floor, cell)) return { tool: id, floor, cell, end: cell };
      return null;
    }
    const def = theme.rooms.find((r) => r.id === id);
    if (!def) return null;
    const start = Phaser.Math.Clamp(Math.round((centerX - LOT_X) / CELL_W - def.width / 2), 0, LOT_CELLS - def.width);
    return { tool: id, floor, cell: start, end: start + def.width - 1 };
  }

  private checkDraft(d: Draft): { ok: boolean; label: string } {
    if (d.tool === 'floor') {
      const n = tower.countPlaceableSlabs(d.floor, d.cell, d.end);
      if (!n) {
        const why = tower.canPlaceSlab(d.floor, d.cell);
        return { ok: false, label: why.ok ? 'Already built' : why.reason };
      }
      const cost = n * FLOOR_COST;
      return cost > tower.money ? { ok: false, label: 'Not enough money' } : { ok: true, label: `Floor  ${n} cells  $${cost.toLocaleString()}` };
    }
    if (d.tool === 'demolish') {
      if (d.room) {
        const c = tower.canRemove(d.room);
        return c.ok ? { ok: true, label: `Demolish ${d.room.def.name}  +$${Math.round(d.room.def.cost / 2).toLocaleString()}` } : { ok: false, label: c.reason };
      }
      const c = tower.canRemoveSlab(d.floor, d.cell);
      return c.ok ? { ok: true, label: 'Demolish empty floor' } : { ok: false, label: c.reason };
    }
    const def = theme.rooms.find((r) => r.id === d.tool)!;
    const c = tower.canPlace(def, d.floor, d.cell);
    return c.ok ? { ok: true, label: `${def.name}  $${def.cost.toLocaleString()}` } : { ok: false, label: c.reason };
  }

  /** Builds or demolishes what the draft shows. */
  confirmDraft() {
    const d = this.draft;
    if (!d) return;
    let msg: string;
    if (d.tool === 'floor') {
      const res = tower.placeSlabs(d.floor, d.cell, d.end);
      msg = res.placed ? `Built ${res.placed} cells of floor` : res.reason ?? 'Nothing to build';
      if (!res.placed) return this.events.emit('toast', msg);
    } else if (d.tool === 'demolish') {
      const res = d.room ? tower.remove(d.room) : tower.removeSlabRun(d.floor, d.cell);
      msg = res.ok ? (d.room ? `Demolished ${d.room.def.name}` : 'Demolished empty floor') : res.reason;
      if (!res.ok) return this.events.emit('toast', msg);
    } else {
      const def = theme.rooms.find((r) => r.id === d.tool)!;
      const res = tower.place(def, d.floor, d.cell);
      msg = res.ok ? `Built ${def.name}` : res.reason;
      if (!res.ok) return this.events.emit('toast', msg);
    }
    this.events.emit('toast', msg);
    this.draft = null;
    this.redrawGhost();
  }

  cancelDraft() {
    this.draft = null;
    this.redrawGhost();
  }

  /** Where the draft sits on screen, so the UI can float the confirm buttons over it. */
  draftView(): DraftView | null {
    const d = this.draft;
    if (!d) return null;
    const cam = this.cameras.main;
    const v = cam.worldView;
    const check = this.checkDraft(d);
    return {
      x: (cellX(d.cell) - v.x) * cam.zoom,
      y: (floorY(d.floor) - v.y) * cam.zoom,
      w: (d.end - d.cell + 1) * CELL_W * cam.zoom,
      ok: check.ok,
      label: check.label,
    };
  }

  private redrawGhost() {
    this.ghost.clear();
    this.ghostLabel.setVisible(false);
    const d = this.draft ?? this.hoverDraft();
    if (!d) return;
    const x = cellX(d.cell);
    const y = floorY(d.floor);
    const w = (d.end - d.cell + 1) * CELL_W;
    const { ok, label } = this.checkDraft(d);
    const fill = d.tool === 'demolish' ? 0xff5533 : d.tool === 'floor' ? 0x7a5232 : theme.rooms.find((r) => r.id === d.tool)?.color ?? 0xffffff;
    const isDraft = d === this.draft;
    this.ghost.fillStyle(fill, isDraft ? 0.7 : 0.4).fillRect(x, y, w, FLOOR_H);
    this.ghost.lineStyle(2, ok ? 0x7cff6b : 0xff5533, 1).strokeRect(x, y, w, FLOOR_H);
    if (isDraft && d.tool === 'floor') {
      // Resize handles.
      this.ghost.fillStyle(0xf2c14e, 1).fillRect(x - 3, y + FLOOR_H / 2 - 8, 6, 16).fillRect(x + w - 3, y + FLOOR_H / 2 - 8, 6, 16);
    }
    // Drafts get their label from the floating confirm bar; hover previews label themselves.
    if (!isDraft) this.ghostLabel.setText(label).setPosition(x + w / 2, y - 3).setVisible(true);
  }

  /** Mouse-only preview that follows the cursor before anything is tapped. */
  private hoverDraft(): Draft | null {
    const p = this.hoverPointer;
    if (!p || !tool.current || p.wasTouch) return null;
    return this.makeDraft(tool.current, this.floorAt(p.worldY), p.worldX);
  }

  // ---------- Input ----------

  private floorAt(wy: number) {
    return Math.floor((GROUND_Y - wy) / FLOOR_H);
  }

  private draftHit(p: Phaser.Input.Pointer): PressMode | null {
    const d = this.draft;
    if (!d) return null;
    const x = cellX(d.cell);
    const w = (d.end - d.cell + 1) * CELL_W;
    const y = floorY(d.floor);
    const pad = 10 / this.cameras.main.zoom;
    if (p.worldY < y - pad || p.worldY > y + FLOOR_H + pad || p.worldX < x - pad || p.worldX > x + w + pad) return null;
    if (d.tool === 'floor') {
      if (Math.abs(p.worldX - x) <= pad * 1.5) return 'resize-left';
      if (Math.abs(p.worldX - (x + w)) <= pad * 1.5) return 'resize-right';
    }
    return d.tool === 'demolish' ? null : 'move';
  }

  private tap(p: Phaser.Input.Pointer) {
    const id = tool.current;
    if (!id) {
      const m = this.people.monsterAt(p.worldX, p.worldY);
      if (m) return this.select({ type: 'monster', id: m.id });
      const room = tower.roomAt(this.floorAt(p.worldY), Math.floor((p.worldX - LOT_X) / CELL_W));
      return this.select(room ? { type: 'room', uid: room.uid } : null);
    }
    // Tapping the draft again builds it; tapping elsewhere moves it there.
    if (this.draft && this.draftHit(p)) return this.confirmDraft();
    if (this.draft?.tool === 'demolish' && this.draft.room) {
      const again = tower.roomAt(this.floorAt(p.worldY), Math.floor((p.worldX - LOT_X) / CELL_W));
      if (again === this.draft.room) return this.confirmDraft();
    }
    this.draft = this.makeDraft(id, this.floorAt(p.worldY), p.worldX);
    this.redrawGhost();
  }

  select(sel: Selection) {
    this.selection = sel;
    this.events.emit('select', sel);
  }

  /** Called by the UI when the build tool changes. */
  toolChanged() {
    this.draft = null;
    if (tool.current) this.select(null);
    this.redrawGhost();
  }

  followMonster(id: number | null) {
    const cam = this.cameras.main;
    const m = id ? this.people.all.get(id) : undefined;
    if (m) cam.startFollow(m.sprite, true, 0.1, 0.1);
    else cam.stopFollow();
  }

  private setupInput() {
    this.input.addPointer(1);
    this.input.mouse?.disableContextMenu();
    this.input.keyboard?.on('keydown-ESC', () => {
      if (this.draft) this.cancelDraft();
      else this.events.emit('tool-cancel');
    });
    this.input.keyboard?.on('keydown-ENTER', () => this.confirmDraft());
    this.input.keyboard?.on('keydown-SPACE', () => clock.togglePause());

    const cam = this.cameras.main;
    const touching = () => this.input.manager.pointers.filter((pt) => pt.isDown);

    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (p.rightButtonDown()) {
        if (this.draft) this.cancelDraft();
        else this.events.emit('tool-cancel');
        return;
      }
      const down = touching();
      if (down.length >= 2) {
        // Second finger: switch to pinch zoom and drop the pan or drag in progress.
        if (this.press?.draft) this.draft = this.press.draft;
        this.press = undefined;
        this.pinch = { dist: Phaser.Math.Distance.Between(down[0].x, down[0].y, down[1].x, down[1].y), zoom: cam.zoom };
        this.redrawGhost();
        return;
      }
      const mode = this.draftHit(p) ?? 'pan';
      this.press = {
        x: p.x, y: p.y, scrollX: cam.scrollX, scrollY: cam.scrollY, dragging: false, mode,
        startCell: Math.floor((p.worldX - LOT_X) / CELL_W), startFloor: this.floorAt(p.worldY),
        draft: this.draft ? { ...this.draft } : undefined,
      };
    });

    this.input.on('pointerup', (p: Phaser.Input.Pointer) => {
      if (this.pinch) {
        if (touching().length < 2) this.pinch = undefined;
        this.press = undefined;
        return;
      }
      if (this.press && !this.press.dragging && p.leftButtonReleased()) this.tap(p);
      this.press = undefined;
    });

    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      this.hoverPointer = p;
      if (this.pinch) {
        const down = touching();
        if (down.length >= 2) {
          const dist = Phaser.Math.Distance.Between(down[0].x, down[0].y, down[1].x, down[1].y);
          cam.setZoom(Phaser.Math.Clamp((this.pinch.zoom * dist) / this.pinch.dist, 0.6, 4));
        }
        return;
      }
      const pr = this.press;
      if (!pr || !p.isDown) {
        if (!this.draft) this.redrawGhost();
        return;
      }
      const dx = p.x - pr.x;
      const dy = p.y - pr.y;
      if (!pr.dragging && Math.hypot(dx, dy) < CLICK_SLOP) return;
      pr.dragging = true;
      if (pr.mode === 'pan') {
        cam.stopFollow();
        cam.scrollX = pr.scrollX - dx / cam.zoom;
        cam.scrollY = pr.scrollY - dy / cam.zoom;
        return;
      }
      const d = this.draft;
      const base = pr.draft;
      if (!d || !base) return;
      const dc = Math.floor((p.worldX - LOT_X) / CELL_W) - pr.startCell;
      const df = this.floorAt(p.worldY) - pr.startFloor;
      const len = base.end - base.cell;
      if (pr.mode === 'move') {
        d.cell = Phaser.Math.Clamp(base.cell + dc, 0, LOT_CELLS - 1 - len);
        d.end = d.cell + len;
        d.floor = base.floor + df;
      } else if (pr.mode === 'resize-left') {
        d.cell = Phaser.Math.Clamp(base.cell + dc, 0, d.end);
      } else {
        d.end = Phaser.Math.Clamp(base.end + dc, d.cell, LOT_CELLS - 1);
      }
      this.redrawGhost();
    });

    this.input.on('wheel', (_p: unknown, _o: unknown, _dx: number, dy: number) => {
      cam.setZoom(Phaser.Math.Clamp(cam.zoom * (dy > 0 ? 0.9 : 1.1), 0.6, 4));
    });
  }

  private setupCamera() {
    const cam = this.cameras.main;
    cam.setBounds(0, 0, WORLD_W, WORLD_H);
    const narrow = this.scale.width < 700;
    cam.setZoom(narrow ? 1.4 : 2.2);
    cam.centerOn(cellX(LOT_CELLS / 2), GROUND_Y - FLOOR_H * 1.5);

    const keys = this.input.keyboard?.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT') as
      | Record<string, Phaser.Input.Keyboard.Key>
      | undefined;
    this.events.on('update', (_t: number, dt: number) => {
      if (!keys) return;
      const speed = (0.6 * dt) / cam.zoom;
      const any = keys.A.isDown || keys.D.isDown || keys.W.isDown || keys.S.isDown || keys.LEFT.isDown || keys.RIGHT.isDown || keys.UP.isDown || keys.DOWN.isDown;
      if (any) cam.stopFollow();
      if (keys.A.isDown || keys.LEFT.isDown) cam.scrollX -= speed;
      if (keys.D.isDown || keys.RIGHT.isDown) cam.scrollX += speed;
      if (keys.W.isDown || keys.UP.isDown) cam.scrollY -= speed;
      if (keys.S.isDown || keys.DOWN.isDown) cam.scrollY += speed;
    });
  }
}
