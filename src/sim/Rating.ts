import Phaser from 'phaser';
import type { People } from './People';
import type { Tower } from './Tower';

interface Goal {
  stars: number;
  population: number;
  /** Room id that must exist. */
  needs?: string;
}

const GOALS: Goal[] = [
  { stars: 2, population: 20 },
  { stars: 3, population: 60, needs: 'feast' },
  { stars: 4, population: 150, needs: 'market' },
  { stars: 5, population: 300 },
];

/** Raises the star rating as the tower grows. Emits 'promoted' with the new star count. */
export class Rating extends Phaser.Events.EventEmitter {
  constructor(private tower: Tower, private people: People) {
    super();
  }

  next(): Goal | undefined {
    return GOALS.find((g) => g.stars === this.tower.stars + 1);
  }

  /** Short text for the HUD, like "Next ★ 12/20 monsters". */
  progress(): string {
    const g = this.next();
    if (!g) return 'Top rating!';
    const pop = this.people.population();
    const need = g.needs ? this.tower.theme.rooms.find((r) => r.id === g.needs) : undefined;
    const hasNeed = !g.needs || [...this.tower.rooms.values()].some((r) => r.def.id === g.needs);
    const extra = need && !hasNeed ? ` + ${need.short}` : '';
    return `Next ★: ${Math.min(pop, g.population)}/${g.population} monsters${extra}`;
  }

  check() {
    const g = this.next();
    if (!g) return;
    const hasNeed = !g.needs || [...this.tower.rooms.values()].some((r) => r.def.id === g.needs);
    if (this.people.population() >= g.population && hasNeed) {
      this.tower.stars = g.stars;
      const unlocked = this.tower.theme.rooms.filter((r) => r.stars === g.stars).map((r) => r.name);
      unlocked.push('more land on both sides');
      this.emit('promoted', g.stars, unlocked);
    }
  }
}
