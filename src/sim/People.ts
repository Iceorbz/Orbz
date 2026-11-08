import Phaser from 'phaser';
import { CELL_W, FLOOR_H, cellX, floorY } from '../config';
import { MONSTER_KINDS, type MonsterKind } from '../decor/sprites';
import type { Clock } from './Clock';
import type { PlacedRoom, Tower } from './Tower';
import type { Leg, Rider, Shaft, Transit } from './Transit';

/** Pixels walked per game minute. */
const WALK = 9;
/** Game minutes to climb one flight of stairs. */
const CLIMB = 6;

type Role = 'resident' | 'worker' | 'visitor';
type State = 'walking' | 'waiting' | 'riding' | 'climbing' | 'inside' | 'away';

const rand = (a: number, b: number) => a + Math.random() * (b - a);
const pick = <T>(list: readonly T[]) => list[Math.floor(Math.random() * list.length)];

export function moodLabel(stress: number) {
  return stress > 70 ? 'Furious' : stress > 40 ? 'Grumpy' : stress > 15 ? 'Fine' : 'Happy';
}

export function floorName(f: number) {
  return f === 0 ? 'Ground floor' : f > 0 ? `Floor ${f}` : `Basement ${-f}`;
}

export class Monster implements Rider {
  state: State = 'away';
  floor = 0;
  /** Fractional floor while riding or climbing. */
  y = 0;
  x = 0;
  dest = 0;
  activity = 'Arriving';
  shaft?: Shaft;
  sprite: Phaser.GameObjects.Image;
  /** Room they live or work in. */
  base?: PlacedRoom;
  /** Room they are visiting right now (food, shop). */
  visiting?: PlacedRoom;
  insideUntil = 0;
  /** 0 is calm, 100 is furious. Long elevator waits raise it; time at home, work or a meal lowers it. */
  stress = 0;
  private waited = 0;
  /** Personal schedule offsets so everyone doesn't move at once. */
  readonly leaveAt = rand(8 * 60, 9.5 * 60);
  readonly returnAt = rand(16.5 * 60, 18.5 * 60);
  readonly lunchAt = rand(11.75 * 60, 12.75 * 60);
  readonly dinnerAt = rand(18.25 * 60, 19.75 * 60);
  private legs: Leg[] = [];
  private finalX = 0;
  private walkTo: number | null = null;
  private onDone?: () => void;
  private climb?: { fromX: number; toX: number; from: number; to: number; t: number };
  private stride = 0;
  private queueOffset = 0;

  constructor(
    readonly id: number,
    readonly name: string,
    readonly kind: MonsterKind,
    readonly role: Role,
    private people: People,
    scene: Phaser.Scene,
  ) {
    this.sprite = scene.add.image(0, 0, `${kind}_0`).setOrigin(0.5, 1).setVisible(false);
  }

  get title() {
    const noun = this.kind.startsWith('skel') ? 'Skeleton' : 'Zombie';
    return `${this.name} the ${noun}`;
  }

  /** Appears at the edge of the lot on the ground floor. */
  enter() {
    this.floor = 0;
    this.y = 0;
    const [a, b] = this.people.landEdges();
    this.x = Math.random() < 0.5 ? a : b;
    this.state = 'walking';
    this.sprite.setVisible(true);
  }

  /** Plans a trip; returns false when there is no way to get there. */
  goTo(floor: number, x: number, activity: string, onDone: () => void): boolean {
    const legs = this.people.transit.route(this.floor, floor, this.x);
    if (!legs) return false;
    this.legs = legs;
    this.finalX = x;
    this.onDone = onDone;
    this.activity = activity;
    this.state = 'walking';
    this.sprite.setVisible(true);
    this.next();
    return true;
  }

  /** Walks to the nearest lot edge and disappears. */
  leave(activity = 'Heading out', then?: () => void) {
    const [left, right] = this.people.landEdges();
    const exitX = Math.abs(this.x - left) < Math.abs(this.x - right) ? left : right;
    const ok = this.goTo(0, exitX, activity, () => {
      this.state = 'away';
      this.activity = 'Out of the tower';
      this.sprite.setVisible(false);
      then?.();
    });
    if (!ok) {
      this.state = 'away';
      this.sprite.setVisible(false);
      then?.();
    }
  }

  stayInside(room: PlacedRoom, until: number, activity: string) {
    this.state = 'inside';
    this.activity = activity;
    this.insideUntil = until;
    this.floor = room.floor;
    this.y = room.floor;
    this.x = cellX(room.cell) + rand(10, room.def.width * CELL_W - 10);
    this.sprite.setFlipX(Math.random() < 0.5);
  }

  private next() {
    const leg = this.legs[0];
    if (!leg) {
      this.walkTo = this.finalX;
      return;
    }
    this.walkTo = leg.kind === 'stairs' ? leg.enterX : leg.x;
  }

  private reached() {
    this.walkTo = null;
    const leg = this.legs[0];
    if (!leg) {
      const done = this.onDone;
      this.onDone = undefined;
      done?.();
      return;
    }
    if (leg.kind === 'stairs') {
      this.state = 'climbing';
      this.climb = { fromX: leg.enterX, toX: leg.exitX, from: leg.from, to: leg.to, t: 0 };
    } else {
      this.state = 'waiting';
      this.dest = leg.to;
      this.queueOffset = rand(-10, 10);
      this.people.transit.call(leg.shaft, leg.from, this);
    }
  }

  board(shaft: Shaft) {
    this.waited = 0;
    this.state = 'riding';
    this.shaft = shaft;
    this.queueOffset = rand(-8, 8);
  }

  arrive() {
    this.floor = this.dest;
    this.y = this.dest;
    this.shaft = undefined;
    this.legs.shift();
    this.state = 'walking';
    this.next();
  }

  update(dt: number) {
    switch (this.state) {
      case 'walking': {
        if (this.walkTo === null) break;
        const d = this.walkTo - this.x;
        const step = WALK * dt;
        this.sprite.setFlipX(d < 0);
        if (Math.abs(d) <= step) {
          this.x = this.walkTo;
          this.reached();
        } else {
          this.x += Math.sign(d) * step;
          this.stride += step;
        }
        break;
      }
      case 'waiting':
        this.stride = 0;
        this.waited += dt;
        // The first ten minutes are fine; after that every minute in line hurts.
        if (this.waited > 10) this.stress = Math.min(100, this.stress + 1.5 * dt);
        break;
      case 'inside':
        this.stress = Math.max(0, this.stress - 0.12 * dt);
        break;
      case 'riding':
        if (this.shaft) {
          this.y = this.shaft.car;
          this.x = this.shaft.x + this.queueOffset;
        }
        break;
      case 'climbing': {
        const c = this.climb!;
        c.t += dt / CLIMB;
        const t = Math.min(1, c.t);
        this.x = c.fromX + (c.toX - c.fromX) * t;
        this.y = c.from + (c.to - c.from) * t;
        this.sprite.setFlipX(c.toX < c.fromX);
        this.stride += dt * 3;
        if (t >= 1) {
          this.floor = c.to;
          this.y = c.to;
          this.climb = undefined;
          this.legs.shift();
          this.state = 'walking';
          this.next();
        }
        break;
      }
    }
    this.draw();
  }

  private draw() {
    if (this.state === 'away') return;
    const waitX = this.state === 'waiting' ? this.queueOffset : 0;
    this.sprite.setPosition(Math.round(this.x + waitX), Math.round(floorY(this.y) + FLOOR_H - 7));
    const frame = this.state === 'walking' || this.state === 'climbing' ? Math.floor(this.stride / 5) % 2 : 1;
    this.sprite.setTexture(`${this.kind}_${frame}`);
    this.sprite.setDepth(this.state === 'riding' ? 6 : 5);
    this.sprite.setTint(this.stress > 70 ? 0xff8a7a : this.stress > 40 ? 0xffe08a : 0xffffff);
  }

  destroy() {
    this.people.transit.forget(this);
    this.sprite.destroy();
  }
}

/**
 * Every monster in and around the tower: who lives and works where, daily routines,
 * meals and shopping trips, and the money they bring in.
 */
export class People extends Phaser.Events.EventEmitter {
  readonly all = new Map<number, Monster>();
  private nextId = 1;
  /** Rooms we already warned about being unreachable, so the toast doesn't repeat. */
  private warned = new Set<number>();

  constructor(
    private scene: Phaser.Scene,
    private tower: Tower,
    readonly transit: Transit,
    private clock: Clock,
  ) {
    super();
    tower.on('room-removed', (room: PlacedRoom) => this.evict(room));
    tower.on('room-added', (room: PlacedRoom) => {
      if (room.def.kind === 'home' || room.def.kind === 'office') room.nextTenantAt = clock.time + rand(30, 120);
    });
    // Monsters stuck in a shaft that was demolished step out on the nearest floor.
    tower.on('room-removed', () => {
      for (const m of [...this.all.values()]) {
        const stranded =
          (m.state === 'riding' && !transit.shafts.includes(m.shaft!)) ||
          (m.state === 'waiting' && !transit.shafts.some((s) => s.waiting.get(m.floor)?.includes(m)));
        if (!stranded) continue;
        transit.forget(m);
        m.floor = Math.round(m.y);
        m.y = m.floor;
        m.state = 'walking';
        this.sendHomeOrAway(m);
      }
    });
  }

  /** Where monsters appear and disappear: just outside the land you own. */
  landEdges(): [number, number] {
    const [a, b] = this.tower.land();
    return [cellX(a) - 24, cellX(b + 1) + 24];
  }

  private spawn(role: Role, kinds: readonly MonsterKind[] = MONSTER_KINDS) {
    const m = new Monster(this.nextId++, pick(this.tower.theme.names), pick(kinds), role, this, this.scene);
    this.all.set(m.id, m);
    return m;
  }

  private remove(m: Monster) {
    m.destroy();
    this.all.delete(m.id);
  }

  monsterAt(wx: number, wy: number): Monster | undefined {
    for (const m of this.all.values()) {
      if (!m.sprite.visible) continue;
      const b = m.sprite.getBounds();
      Phaser.Geom.Rectangle.Inflate(b, 4, 4);
      if (b.contains(wx, wy)) return m;
    }
    return undefined;
  }

  update(dt: number) {
    if (dt <= 0) return;
    this.transit.update(dt);
    for (const room of this.tower.rooms.values()) this.runRoom(room, dt);
    for (const m of [...this.all.values()]) {
      this.routine(m, dt);
      m.update(dt);
    }
  }

  private runRoom(room: PlacedRoom, dt: number) {
    const def = room.def;
    const now = this.clock.time;
    const tod = this.clock.minuteOfDay;

    // New tenants: a household for a crypt, a team of workers for an office.
    if ((def.kind === 'home' || def.kind === 'office') && !room.occupants.length && room.nextTenantAt && now >= room.nextTenantAt) {
      room.nextTenantAt = undefined;
      this.moveIn(room);
    }
    // Rent: offices pay at close of business, homes in the evening.
    if (room.occupants.length && def.rent) {
      if ((def.kind === 'office' && this.clock.crossed(17 * 60, dt)) || (def.kind === 'home' && this.clock.crossed(20 * 60, dt))) {
        this.tower.income(room, def.rent);
      }
    }
    // Visitors from outside at meal times (food) or through the afternoon (shops).
    if (def.kind === 'food' || def.kind === 'shop') {
      const open =
        def.kind === 'food'
          ? (tod > 11 * 60 && tod < 14 * 60) || (tod > 17 * 60 && tod < 20.5 * 60)
          : tod > 10 * 60 && tod < 20 * 60;
      if (open && room.occupants.length < (def.capacity ?? 4) && Math.random() < 0.02 * dt) this.visitFromOutside(room);
    }
    if (this.clock.crossed(0, dt)) room.earnedToday = 0;
    // Each night, fed-up tenants move out.
    if ((def.kind === 'home' || def.kind === 'office') && room.occupants.length && this.clock.crossed(21 * 60, dt)) {
      if (this.roomMood(room) > 65) {
        this.emit('toast', `Tenants left the ${def.name} on ${floorName(room.floor).toLowerCase()}. The elevator waits were too long.`);
        for (const m of [...this.all.values()]) if (m.base === room) this.quit(m);
        room.occupants = [];
        room.nextTenantAt = now + 12 * 60;
      }
    }
  }

  private moveIn(room: PlacedRoom) {
    const isOffice = room.def.kind === 'office';
    const count = isOffice ? room.def.capacity ?? 3 : 2 + Math.floor(Math.random() * ((room.def.capacity ?? 3) - 1));
    const kinds: readonly MonsterKind[] = isOffice ? ['skeleton', 'skelpilgrim', 'zombie'] : MONSTER_KINDS;
    const family: Monster[] = [];
    for (let i = 0; i < count; i++) {
      const m = this.spawn(isOffice ? 'worker' : 'resident', kinds);
      m.base = room;
      room.occupants.push(m.id);
      family.push(m);
    }
    // Office workers start tomorrow morning if it's already after hours.
    const tod = this.clock.minuteOfDay;
    if (isOffice && (tod > 16 * 60 || tod < 7 * 60)) return;
    family.forEach((m, i) => {
      m.enter();
      m.x += (i - 1) * 12;
      this.goToBase(m, isOffice ? 'Starting a new job' : 'Moving in');
    });
  }

  private goToBase(m: Monster, activity: string) {
    const room = m.base;
    if (!room || !this.tower.rooms.has(room.uid)) return this.quit(m);
    const ok = m.goTo(room.floor, cellX(room.cell) + (room.def.width * CELL_W) / 2, activity, () => {
      m.stayInside(room, Infinity, room.def.kind === 'office' ? 'Working' : pick(['Relaxing at home', 'Napping in the coffin', 'Eating leftovers']));
    });
    if (!ok) this.unreachable(m, room);
  }

  private unreachable(m: Monster, room: PlacedRoom) {
    if (!this.warned.has(room.uid)) {
      this.warned.add(room.uid);
      this.emit('toast', `Monsters can't reach the ${room.def.name} on ${floorName(room.floor).toLowerCase()}. Add stairs or an elevator.`);
    }
    // Tenants give up and the room is tried again later.
    if (m.base === room) {
      for (const id of room.occupants) {
        const other = this.all.get(id);
        if (other && other.base === room) {
          other.base = undefined;
          other.leave('Giving up', () => this.remove(other));
        }
      }
      room.occupants = [];
      room.nextTenantAt = this.clock.time + 180;
    } else {
      m.leave('Giving up', () => this.remove(m));
    }
  }

  private visitFromOutside(room: PlacedRoom) {
    const m = this.spawn('visitor');
    m.enter();
    if (!this.visit(m, room)) {
      this.remove(m);
    }
  }

  /** Sends a monster to eat or shop; they pay on arrival and then go back to what they were doing. */
  private visit(m: Monster, room: PlacedRoom): boolean {
    room.occupants.push(m.id);
    m.visiting = room;
    const verb = room.def.kind === 'food' ? 'Going to eat at' : 'Shopping at';
    const ok = m.goTo(room.floor, cellX(room.cell) + rand(12, room.def.width * CELL_W - 12), `${verb} the ${room.def.name}`, () => {
      if (!this.tower.rooms.has(room.uid)) return this.afterVisit(m);
      this.tower.income(room, room.def.spend ?? 10);
      m.stress = Math.max(0, m.stress - (room.def.kind === 'food' ? 20 : 10));
      const food = pick(this.tower.theme.foods);
      m.stayInside(room, this.clock.time + rand(30, 60), room.def.kind === 'food' ? `Eating ${food}` : 'Browsing the gourds');
    });
    if (!ok) {
      room.occupants = room.occupants.filter((id) => id !== m.id);
      m.visiting = undefined;
    }
    return ok;
  }

  private afterVisit(m: Monster) {
    const room = m.visiting;
    if (room) room.occupants = room.occupants.filter((id) => id !== m.id);
    m.visiting = undefined;
    this.sendHomeOrAway(m);
  }

  private sendHomeOrAway(m: Monster) {
    if (m.role === 'visitor' || !m.base) return m.leave('Heading home', () => this.remove(m));
    const tod = this.clock.minuteOfDay;
    const offHours = m.role === 'worker' ? tod >= 17 * 60 || tod < 8 * 60 : false;
    if (offHours) return m.leave('Going home for the night');
    this.goToBase(m, m.role === 'worker' ? 'Back to work' : 'Heading home');
  }

  private quit(m: Monster) {
    m.base = undefined;
    if (m.state === 'away') this.remove(m);
    else m.leave('Moving out', () => this.remove(m));
  }

  private nearestFood(m: Monster) {
    const options = [...this.tower.rooms.values()].filter(
      (r) => r.def.kind === 'food' && r.occupants.length < (r.def.capacity ?? 4) && this.transit.route(m.floor, r.floor, m.x),
    );
    options.sort((a, b) => Math.abs(a.floor - m.floor) - Math.abs(b.floor - m.floor));
    return options[0];
  }

  /** Daily routine decisions for one monster. */
  private routine(m: Monster, dt: number) {
    const c = this.clock;
    if (m.state === 'inside' && c.time >= m.insideUntil && m.visiting) return this.afterVisit(m);
    if (m.role === 'resident' && m.base) {
      if (c.crossed(m.leaveAt, dt) && m.state === 'inside' && !m.visiting) m.leave('Off to haunt the town');
      if (c.crossed(m.returnAt, dt) && m.state === 'away') {
        m.enter();
        this.goToBase(m, 'Coming home');
      }
      if (c.crossed(m.dinnerAt, dt) && m.state === 'inside' && !m.visiting && Math.random() < 0.45) {
        const food = this.nearestFood(m);
        if (food) this.visit(m, food);
      }
    }
    if (m.role === 'worker' && m.base) {
      if (c.crossed(m.leaveAt - 30, dt) && m.state === 'away') {
        m.enter();
        this.goToBase(m, 'Commuting to work');
      }
      if (c.crossed(m.lunchAt, dt) && m.state === 'inside' && !m.visiting && Math.random() < 0.5) {
        const food = this.nearestFood(m);
        if (food) this.visit(m, food);
      }
      if (c.crossed(17 * 60 + (m.leaveAt % 30), dt) && m.state === 'inside' && !m.visiting) m.leave('Clocking out');
    }
  }

  /** A room was demolished: its tenants move out and visitors head off. */
  private evict(room: PlacedRoom) {
    for (const m of [...this.all.values()]) {
      if (m.base === room) this.quit(m);
      else if (m.visiting === room) this.afterVisit(m);
    }
  }

  /** Average stress of a room's tenants (0 when empty). */
  roomMood(room: PlacedRoom) {
    const list = room.occupants.map((id) => this.all.get(id)).filter((m): m is Monster => !!m && m.base === room);
    return list.length ? list.reduce((a, m) => a + m.stress, 0) / list.length : 0;
  }

  /** Monsters who live or work in the tower. */
  population() {
    let n = 0;
    for (const m of this.all.values()) if (m.base) n++;
    return n;
  }

  /** Text for the info panel. */
  describe(m: Monster): string[] {
    const where = m.state === 'away' ? 'Away' : m.state === 'riding' ? 'In the elevator' : floorName(Math.round(m.y));
    const lines = [m.title, m.activity, `Where: ${where}`, `Mood: ${moodLabel(m.stress)}`];
    if (m.base) lines.push(`${m.role === 'worker' ? 'Works at' : 'Lives in'}: ${m.base.def.name}, ${floorName(m.base.floor).toLowerCase()}`);
    else lines.push('Just visiting');
    return lines;
  }
}
