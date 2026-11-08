import Phaser from 'phaser';

/** Real milliseconds per game minute at 1x speed. A full day takes 3 minutes. */
export const MS_PER_GAME_MINUTE = 125;
export const SPEEDS = [0, 1, 2, 4] as const;

/**
 * Game time in minutes since Day 1, 00:00. Emits 'minute' (with the delta),
 * 'hour' and 'day'. Speed 0 pauses everything that runs on game time.
 */
export class Clock extends Phaser.Events.EventEmitter {
  /** Starts on Day 1 at 7:00 AM. */
  time = 7 * 60;
  speed = 1;
  private lastSpeed = 1;

  get day() {
    return Math.floor(this.time / 1440) + 1;
  }

  /** Minutes since midnight today. */
  get minuteOfDay() {
    return this.time % 1440;
  }

  get label() {
    const m = Math.floor(this.minuteOfDay);
    const h24 = Math.floor(m / 60);
    const h = h24 % 12 || 12;
    return `${h}:${String(m % 60).padStart(2, '0')} ${h24 < 12 ? 'AM' : 'PM'}`;
  }

  /** Calendar date in November, the month of the harvest. */
  get dateLabel() {
    return `Nov ${((this.day - 1) % 30) + 1}`;
  }

  setSpeed(s: number) {
    if (s > 0) this.lastSpeed = s;
    this.speed = s;
    this.emit('speed', s);
  }

  togglePause() {
    this.setSpeed(this.speed ? 0 : this.lastSpeed);
  }

  /** Advances by real milliseconds; returns game minutes elapsed. */
  tick(ms: number): number {
    if (!this.speed) return 0;
    const dt = (Math.min(ms, 100) / MS_PER_GAME_MINUTE) * this.speed;
    const before = this.time;
    this.time += dt;
    if (Math.floor(this.time / 60) !== Math.floor(before / 60)) this.emit('hour', Math.floor(this.minuteOfDay / 60));
    if (Math.floor(this.time / 1440) !== Math.floor(before / 1440)) this.emit('day', this.day);
    this.emit('minute', dt);
    return dt;
  }

  /** True once when game time crosses the given minute of the day during the last tick. */
  crossed(minuteOfDay: number, dt: number) {
    const now = this.minuteOfDay;
    const prev = now - dt;
    return prev < minuteOfDay && now >= minuteOfDay;
  }
}
