import Phaser from 'phaser';
import { LOT_CELLS, MAX_BASEMENTS, MAX_FLOORS } from '../config';
import type { RoomDef, Theme } from '../themes';

export interface PlacedRoom {
  uid: number;
  def: RoomDef;
  floor: number;
  cell: number;
}

export type PlaceCheck = { ok: true } | { ok: false; reason: string };

export const START_MONEY = 100_000;
/** Fraction of a room's cost refunded when it is demolished. */
export const REFUND = 0.5;

/**
 * The tower's data model: money and which cells of which floors hold which rooms.
 * Emits 'room-added', 'room-removed' and 'money' events; scenes listen and redraw.
 */
export class Tower extends Phaser.Events.EventEmitter {
  money = START_MONEY;
  readonly rooms = new Map<number, PlacedRoom>();
  private nextUid = 1;
  /** floor -> cell -> room uid */
  private grid = new Map<number, (number | null)[]>();

  constructor(readonly theme: Theme) {
    super();
  }

  /** Puts the lobby in the middle of the ground floor. Call once at startup. */
  init() {
    const lobby = this.theme.rooms.find((r) => r.kind === 'lobby')!;
    this.add(lobby, 0, Math.floor((LOT_CELLS - lobby.width) / 2));
  }

  roomAt(floor: number, cell: number): PlacedRoom | undefined {
    const uid = this.grid.get(floor)?.[cell];
    return uid ? this.rooms.get(uid) : undefined;
  }

  private occupied(floor: number, cell: number) {
    return !!this.grid.get(floor)?.[cell];
  }

  canPlace(def: RoomDef, floor: number, cell: number): PlaceCheck {
    if (def.kind === 'lobby') return { ok: false, reason: 'There is only one lobby' };
    if (cell < 0 || cell + def.width > LOT_CELLS) return { ok: false, reason: 'Off the edge of the lot' };
    if (floor >= MAX_FLOORS || floor < -MAX_BASEMENTS) return { ok: false, reason: 'Too high' };
    if (def.kind === 'transport' && floor === MAX_FLOORS - 1) return { ok: false, reason: 'Nothing above to connect to' };
    for (let c = cell; c < cell + def.width; c++) {
      if (this.occupied(floor, c)) return { ok: false, reason: 'Space is taken' };
    }
    if (floor > 0) {
      for (let c = cell; c < cell + def.width; c++) {
        if (!this.occupied(floor - 1, c)) return { ok: false, reason: 'Needs a floor underneath' };
      }
    } else if (floor < 0) {
      for (let c = cell; c < cell + def.width; c++) {
        if (!this.occupied(floor + 1, c)) return { ok: false, reason: 'Basements must be under the tower' };
      }
    }
    if (this.money < def.cost) return { ok: false, reason: 'Not enough money' };
    return { ok: true };
  }

  place(def: RoomDef, floor: number, cell: number): PlaceCheck {
    const check = this.canPlace(def, floor, cell);
    if (!check.ok) return check;
    this.spend(def.cost);
    this.add(def, floor, cell);
    return check;
  }

  canRemove(room: PlacedRoom): PlaceCheck {
    if (room.def.kind === 'lobby') return { ok: false, reason: "The lobby can't be demolished" };
    // Something resting on this room (or hanging below a basement) would lose its support.
    const neighbour = room.floor >= 0 ? room.floor + 1 : room.floor - 1;
    for (let c = room.cell; c < room.cell + room.def.width; c++) {
      if (this.occupied(neighbour, c)) {
        return { ok: false, reason: room.floor >= 0 ? 'Remove what is above it first' : 'Remove what is below it first' };
      }
    }
    return { ok: true };
  }

  remove(room: PlacedRoom): PlaceCheck {
    const check = this.canRemove(room);
    if (!check.ok) return check;
    const row = this.grid.get(room.floor)!;
    for (let c = room.cell; c < room.cell + room.def.width; c++) row[c] = null;
    this.rooms.delete(room.uid);
    this.earn(Math.round(room.def.cost * REFUND));
    this.emit('room-removed', room);
    return check;
  }

  spend(amount: number) {
    this.money -= amount;
    this.emit('money', this.money);
  }

  earn(amount: number) {
    this.money += amount;
    this.emit('money', this.money);
  }

  private add(def: RoomDef, floor: number, cell: number) {
    let row = this.grid.get(floor);
    if (!row) this.grid.set(floor, (row = new Array(LOT_CELLS).fill(null)));
    const room: PlacedRoom = { uid: this.nextUid++, def, floor, cell };
    for (let c = cell; c < cell + def.width; c++) row[c] = room.uid;
    this.rooms.set(room.uid, room);
    this.emit('room-added', room);
  }
}
