import { CELL_W, cellX } from '../config';
import type { PlacedRoom, Tower } from './Tower';

/** Floors per game minute an elevator car travels. */
const CAR_SPEED = 0.8;
/** Game minutes the doors stay open at a stop. */
const DWELL = 2;
export const CAR_CAPACITY = 6;

/** Anything that can ride: the elevator only needs to know where it is going. */
export interface Rider {
  id: number;
  dest: number;
  /** Called when the car reaches the rider's floor and they step out. */
  arrive(): void;
  board(shaft: Shaft): void;
}

export interface Shaft {
  /** Left cell of the shaft; elevator rooms stacked at the same cell form one shaft. */
  cell: number;
  /** Centre x in pixels. */
  x: number;
  bottom: number;
  top: number;
  car: number;
  dir: -1 | 0 | 1;
  doorTimer: number;
  stops: Set<number>;
  riders: Rider[];
  waiting: Map<number, Rider[]>;
}

export interface Stairs {
  floor: number;
  /** Bottom-left x (on `floor`) and top-right x (on `floor + 1`). */
  x0: number;
  x1: number;
}

export type Leg =
  | { kind: 'stairs'; from: number; to: number; enterX: number; exitX: number }
  | { kind: 'elevator'; shaft: Shaft; from: number; to: number; x: number };

/** Elevators and stairs: finds routes between floors and runs the elevator cars. */
export class Transit {
  shafts: Shaft[] = [];
  stairs: Stairs[] = [];

  constructor(private tower: Tower) {
    const rebuild = () => this.rebuild();
    tower.on('room-added', rebuild);
    tower.on('room-removed', rebuild);
  }

  rebuild() {
    const lifts: PlacedRoom[] = [];
    this.stairs = [];
    for (const r of this.tower.rooms.values()) {
      if (r.def.id === 'elevator') lifts.push(r);
      if (r.def.id === 'stairs') {
        const x = cellX(r.cell);
        this.stairs.push({ floor: r.floor, x0: x + 2, x1: x + r.def.width * CELL_W - 2 });
      }
    }
    // Group stacked elevator rooms into shafts.
    lifts.sort((a, b) => a.cell - b.cell || a.floor - b.floor);
    const next: Shaft[] = [];
    for (const r of lifts) {
      const last = next[next.length - 1];
      if (last && last.cell === r.cell && last.top === r.floor - 1) {
        last.top = r.floor;
        continue;
      }
      next.push({
        cell: r.cell, x: cellX(r.cell) + (r.def.width * CELL_W) / 2, bottom: r.floor, top: r.floor,
        car: r.floor, dir: 0, doorTimer: 0, stops: new Set(), riders: [], waiting: new Map(),
      });
    }
    // Keep existing cars (and their riders) where a shaft still covers them.
    for (const s of next) {
      const old = this.shafts.find((o) => o.cell === s.cell && o.car >= s.bottom && o.car <= s.top);
      if (!old) continue;
      Object.assign(s, { car: old.car, dir: old.dir, doorTimer: old.doorTimer, riders: old.riders });
      for (const [f, list] of old.waiting) if (f >= s.bottom && f <= s.top) s.waiting.set(f, list);
      for (const f of old.stops) if (f >= s.bottom && f <= s.top) s.stops.add(f);
    }
    this.shafts = next;
  }

  /** Fewest-transfers route from one floor to another, or null if there is no way. */
  route(from: number, to: number, nearX: number): Leg[] | null {
    if (from === to) return [];
    const prev = new Map<number, { floor: number; leg: Leg }>();
    const seen = new Set([from]);
    const queue = [from];
    while (queue.length) {
      const f = queue.shift()!;
      const options: Leg[] = [];
      for (const s of this.shafts) {
        if (f < s.bottom || f > s.top) continue;
        // Prefer riding straight to the destination when this shaft reaches it.
        const targets = to >= s.bottom && to <= s.top ? [to] : range(s.bottom, s.top);
        for (const t of targets) if (t !== f) options.push({ kind: 'elevator', shaft: s, from: f, to: t, x: s.x });
      }
      for (const st of this.stairs) {
        if (st.floor === f) options.push({ kind: 'stairs', from: f, to: f + 1, enterX: st.x0, exitX: st.x1 });
        if (st.floor === f - 1) options.push({ kind: 'stairs', from: f, to: f - 1, enterX: st.x1, exitX: st.x0 });
      }
      options.sort((a, b) => Math.abs(legX(a) - nearX) - Math.abs(legX(b) - nearX));
      for (const leg of options) {
        if (seen.has(leg.to)) continue;
        seen.add(leg.to);
        prev.set(leg.to, { floor: f, leg });
        if (leg.to === to) {
          const legs: Leg[] = [];
          for (let cur = to; cur !== from; cur = prev.get(cur)!.floor) legs.unshift(prev.get(cur)!.leg);
          return legs;
        }
        queue.push(leg.to);
      }
    }
    return null;
  }

  /** A rider presses the call button. */
  call(shaft: Shaft, floor: number, rider: Rider) {
    const list = shaft.waiting.get(floor) ?? [];
    list.push(rider);
    shaft.waiting.set(floor, list);
    shaft.stops.add(floor);
  }

  /** Removes a rider from any queue or car, e.g. when their room is demolished. */
  forget(rider: Rider) {
    for (const s of this.shafts) {
      s.riders = s.riders.filter((r) => r !== rider);
      for (const [f, list] of s.waiting) s.waiting.set(f, list.filter((r) => r !== rider));
    }
  }

  update(dt: number) {
    for (const s of this.shafts) this.step(s, dt);
  }

  private step(s: Shaft, dt: number) {
    if (s.doorTimer > 0) {
      s.doorTimer -= dt;
      return;
    }
    if (s.riders.length < CAR_CAPACITY) for (const [f, list] of s.waiting) if (list.length) s.stops.add(f);
    if (!s.stops.size) {
      s.dir = 0;
      return;
    }
    const stops = [...s.stops];
    const ahead = stops.filter((f) => (s.dir > 0 ? f >= s.car : s.dir < 0 ? f <= s.car : true));
    const pool = ahead.length ? ahead : stops;
    const target = pool.reduce((a, b) => (Math.abs(b - s.car) < Math.abs(a - s.car) ? b : a));
    const diff = target - s.car;
    s.dir = diff > 0 ? 1 : diff < 0 ? -1 : s.dir;
    const move = CAR_SPEED * dt;
    if (Math.abs(diff) > move) {
      s.car += Math.sign(diff) * move;
      return;
    }
    s.car = target;
    this.arrive(s, target);
  }

  private arrive(s: Shaft, floor: number) {
    s.stops.delete(floor);
    s.doorTimer = DWELL;
    const out = s.riders.filter((r) => r.dest === floor);
    s.riders = s.riders.filter((r) => r.dest !== floor);
    out.forEach((r) => r.arrive());
    const waiting = s.waiting.get(floor) ?? [];
    while (waiting.length && s.riders.length < CAR_CAPACITY) {
      const r = waiting.shift()!;
      s.riders.push(r);
      s.stops.add(r.dest);
      r.board(s);
    }
  }
}

function legX(l: Leg) {
  return l.kind === 'elevator' ? l.x : l.enterX;
}

function range(a: number, b: number) {
  const out: number[] = [];
  for (let i = a; i <= b; i++) out.push(i);
  return out;
}
