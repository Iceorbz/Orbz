import Phaser from 'phaser';
import { LOT_CELLS, MAX_BASEMENTS, MAX_FLOORS } from '../config';
import type { RoomDef, Theme } from '../themes';

export interface PlacedRoom {
  uid: number;
  def: RoomDef;
  floor: number;
  cell: number;
  /** Ids of monsters who live or work here, or are visiting right now. */
  occupants: number[];
  earnedToday: number;
  earnedTotal: number;
  /** Game minute when a vacant home or office will next attract tenants. */
  nextTenantAt?: number;
}

export type PlaceCheck = { ok: true } | { ok: false; reason: string };

export const START_MONEY = 100_000;
/** Fraction of the cost refunded when something is demolished. */
export const REFUND = 0.5;
/** Cost of one cell of empty floor. */
export const FLOOR_COST = 500;

/**
 * The tower's data model: money, empty floor slabs, and which cells hold which rooms.
 * Floor 0 is the ground; every other floor needs floor slabs before rooms can go in.
 * Emits 'room-added', 'room-removed', 'floors' and 'money'.
 */
export class Tower extends Phaser.Events.EventEmitter {
  money = START_MONEY;
  readonly rooms = new Map<number, PlacedRoom>();
  private nextUid = 1;
  /** floor -> cell -> room uid */
  private grid = new Map<number, (number | null)[]>();
  /** floor -> cell -> has an empty floor slab */
  private slabs = new Map<number, boolean[]>();

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

  occupied(floor: number, cell: number) {
    return !!this.grid.get(floor)?.[cell];
  }

  hasSlab(floor: number, cell: number) {
    return !!this.slabs.get(floor)?.[cell];
  }

  /** Floors (other than the ground) that have at least one slab, for drawing. */
  slabRows(): [number, boolean[]][] {
    return [...this.slabs.entries()];
  }

  /** A floor slab rests on the slab below it, or on a ground-floor room. Basements hang the other way. */
  private slabSupported(floor: number, cell: number) {
    const next = floor > 0 ? floor - 1 : floor + 1;
    return next === 0 ? this.occupied(0, cell) : this.hasSlab(next, cell);
  }

  canPlaceSlab(floor: number, cell: number): PlaceCheck {
    if (floor === 0) return { ok: false, reason: 'The ground floor needs no floor' };
    if (cell < 0 || cell >= LOT_CELLS) return { ok: false, reason: 'Off the edge of the lot' };
    if (floor >= MAX_FLOORS || floor < -MAX_BASEMENTS) return { ok: false, reason: 'Too far' };
    if (this.hasSlab(floor, cell)) return { ok: false, reason: 'Already built' };
    if (!this.slabSupported(floor, cell)) {
      return { ok: false, reason: floor > 0 ? 'Needs something underneath' : 'Basements go under the tower' };
    }
    if (this.money < FLOOR_COST) return { ok: false, reason: 'Not enough money' };
    return { ok: true };
  }

  /** Builds slabs across [from, to]. Returns how many were built and the first problem hit. */
  placeSlabs(floor: number, from: number, to: number): { placed: number; reason?: string } {
    let placed = 0;
    let reason: string | undefined;
    for (let c = Math.min(from, to); c <= Math.max(from, to); c++) {
      const check = this.canPlaceSlab(floor, c);
      if (!check.ok) {
        if (check.reason !== 'Already built') reason ??= check.reason;
        continue;
      }
      let row = this.slabs.get(floor);
      if (!row) this.slabs.set(floor, (row = new Array(LOT_CELLS).fill(false)));
      row[c] = true;
      this.money -= FLOOR_COST;
      placed++;
    }
    if (placed) {
      this.emit('money', this.money);
      this.emit('floors');
    }
    return { placed, reason };
  }

  /** Slab cells in [from, to] that could be built, for previews. */
  countPlaceableSlabs(floor: number, from: number, to: number) {
    let n = 0;
    for (let c = Math.min(from, to); c <= Math.max(from, to); c++) {
      const check = this.canPlaceSlab(floor, c);
      if (check.ok || check.reason === 'Not enough money') n++;
    }
    return n;
  }

  canRemoveSlab(floor: number, cell: number): PlaceCheck {
    if (this.occupied(floor, cell)) return { ok: false, reason: 'Remove the room first' };
    if (this.hasSlab(floor > 0 ? floor + 1 : floor - 1, cell)) {
      return { ok: false, reason: floor > 0 ? 'Remove the floor above first' : 'Remove the floor below first' };
    }
    return { ok: true };
  }

  /** Removes the whole empty run of slab around a cell. */
  removeSlabRun(floor: number, cell: number): PlaceCheck & { removed?: number } {
    const row = this.slabs.get(floor);
    if (!row?.[cell]) return { ok: false, reason: 'Nothing here' };
    let a = cell;
    let b = cell;
    while (a > 0 && row[a - 1] && !this.occupied(floor, a - 1)) a--;
    while (b < LOT_CELLS - 1 && row[b + 1] && !this.occupied(floor, b + 1)) b++;
    let removed = 0;
    for (let c = a; c <= b; c++) {
      if (!this.canRemoveSlab(floor, c).ok) continue;
      row[c] = false;
      removed++;
    }
    if (!removed) return this.canRemoveSlab(floor, cell);
    this.earn(Math.round(removed * FLOOR_COST * REFUND));
    this.emit('floors');
    return { ok: true, removed };
  }

  canPlace(def: RoomDef, floor: number, cell: number): PlaceCheck {
    if (def.kind === 'lobby') return { ok: false, reason: 'There is only one lobby' };
    if (cell < 0 || cell + def.width > LOT_CELLS) return { ok: false, reason: 'Off the edge of the lot' };
    if (floor >= MAX_FLOORS || floor < -MAX_BASEMENTS) return { ok: false, reason: 'Too far' };
    for (let c = cell; c < cell + def.width; c++) {
      if (this.occupied(floor, c)) return { ok: false, reason: 'Space is taken' };
    }
    if (floor !== 0) {
      for (let c = cell; c < cell + def.width; c++) {
        if (!this.hasSlab(floor, c)) return { ok: false, reason: 'Build a floor here first' };
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
    if (room.floor === 0) {
      for (let c = room.cell; c < room.cell + room.def.width; c++) {
        if (this.hasSlab(1, c) || this.hasSlab(-1, c)) return { ok: false, reason: 'Remove the floors resting on it first' };
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

  /** Money earned by a room: adds to its stats and the bank, and tells the view to show a pop-up. */
  income(room: PlacedRoom, amount: number) {
    room.earnedToday += amount;
    room.earnedTotal += amount;
    this.earn(amount);
    this.emit('income', room, amount);
  }

  private add(def: RoomDef, floor: number, cell: number) {
    let row = this.grid.get(floor);
    if (!row) this.grid.set(floor, (row = new Array(LOT_CELLS).fill(null)));
    const room: PlacedRoom = { uid: this.nextUid++, def, floor, cell, occupants: [], earnedToday: 0, earnedTotal: 0 };
    for (let c = cell; c < cell + def.width; c++) row[c] = room.uid;
    this.rooms.set(room.uid, room);
    this.emit('room-added', room);
  }
}
