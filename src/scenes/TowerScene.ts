import Phaser from 'phaser';
import {
  CELL_W, FLOOR_H, GROUND_Y, LOT_CELLS, LOT_X, MAX_BASEMENTS, MAX_FLOORS,
  WORLD_H, WORLD_W, cellX, floorY,
} from '../config';
import { activeTheme as theme } from '../themes';
import { buildTextures } from '../textures';
import { buildSprites } from '../decor/sprites';
import { drawLobby } from '../decor/lobby';

/** The side-view cutaway of the tower and its lot. */
export class TowerScene extends Phaser.Scene {
  private dragStart?: { x: number; y: number; scrollX: number; scrollY: number };

  constructor() {
    super('tower');
  }

  create() {
    buildTextures(this, theme);
    buildSprites(this);
    this.drawSky();
    this.drawGround();
    this.drawGrid();
    this.drawLobby();
    this.addLeaves();
    this.setupCamera();
    this.scene.launch('ui');
  }

  private drawSky() {
    const p = theme.palette;
    const sky = this.add.graphics();
    sky.fillGradientStyle(p.skyTop, p.skyTop, p.skyBottom, p.skyBottom, 1);
    sky.fillRect(0, 0, WORLD_W, GROUND_Y);
    // Blocky hills on the horizon for depth.
    const hills = this.add.graphics();
    hills.fillStyle(p.grassDark, 0.35);
    for (let x = 0; x < WORLD_W; x += CELL_W * 2) {
      const h = 40 + Math.round((Math.sin(x / 140) + Math.sin(x / 57)) * 18 / 8) * 8;
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
    g.lineStyle(1, 0xffffff, 0.12);
    const top = floorY(MAX_FLOORS - 1);
    const bottom = floorY(-MAX_BASEMENTS) + FLOOR_H;
    for (let c = 0; c <= LOT_CELLS; c++) g.lineBetween(cellX(c), top, cellX(c), bottom);
    for (let f = -MAX_BASEMENTS; f <= MAX_FLOORS; f++) {
      const y = floorY(f) + FLOOR_H;
      g.lineBetween(LOT_X, y, cellX(LOT_CELLS), y);
    }
    this.input.keyboard?.on('keydown-G', () => g.setVisible(!g.visible));
  }

  /** The lobby on the ground floor. Building other rooms arrives in step 2. */
  private drawLobby() {
    const lobby = theme.rooms.find((r) => r.kind === 'lobby')!;
    const cells = lobby.width * 4;
    const start = Math.floor(LOT_CELLS / 2) - cells / 2;
    drawLobby(this, theme, cellX(start), floorY(0), cells * CELL_W, FLOOR_H);
  }

  private addLeaves() {
    this.add.particles(0, 0, 'leaf', {
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
    });
  }

  private setupCamera() {
    const cam = this.cameras.main;
    cam.setBounds(0, 0, WORLD_W, WORLD_H);
    cam.setZoom(2.5);
    cam.centerOn(cellX(LOT_CELLS / 2), GROUND_Y - FLOOR_H * 1.5);

    // Drag with right or middle mouse (left is saved for building), or any button for now.
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      this.dragStart = { x: p.x, y: p.y, scrollX: cam.scrollX, scrollY: cam.scrollY };
    });
    this.input.on('pointerup', () => (this.dragStart = undefined));
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (!this.dragStart || !p.isDown) return;
      cam.scrollX = this.dragStart.scrollX - (p.x - this.dragStart.x) / cam.zoom;
      cam.scrollY = this.dragStart.scrollY - (p.y - this.dragStart.y) / cam.zoom;
    });
    this.input.on('wheel', (_p: unknown, _o: unknown, _dx: number, dy: number) => {
      cam.setZoom(Phaser.Math.Clamp(cam.zoom * (dy > 0 ? 0.9 : 1.1), 0.6, 3));
    });

    // Keyboard panning.
    const keys = this.input.keyboard?.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT') as
      Record<string, Phaser.Input.Keyboard.Key> | undefined;
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
