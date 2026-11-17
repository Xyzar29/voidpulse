// The between-wave draft. Every upgrade is data plus an apply function over
// the player's mutable build state, so the draft UI in main.js stays dumb:
// it asks for three offers, shows them, and applies the picked one.

export function freshBuild() {
  return {
    fireRateBonus: 0, // fraction added to base shots per second
    damageBonus: 0,
    extraProjectiles: 0,
    speedBonus: 0, // fraction
    dashCooldownBonus: 0, // fraction removed from the cooldown
    pierce: 0,
    blades: 0,
    aegis: false,
    comboWindowBonus: 0, // seconds added to the combo window
  };
}

export const UPGRADES = [
  {
    id: 'rapid',
    name: 'Rapid Cycler',
    icon: '»',
    blurb: '+20% fire rate. More bolts, more often.',
    canTake: () => true,
    apply: (build) => { build.fireRateBonus += 0.2; },
  },
  {
    id: 'heavy',
    name: 'Heavy Rounds',
    icon: '◆',
    blurb: '+1 damage per bolt. Big shapes crack faster.',
    canTake: () => true,
    apply: (build) => { build.damageBonus += 1; },
  },
  {
    id: 'split',
    name: 'Split Cannon',
    icon: '⋔',
    blurb: '+1 projectile per shot, fanned out beside the first.',
    canTake: (build) => build.extraProjectiles < 4,
    apply: (build) => { build.extraProjectiles += 1; },
  },
  {
    id: 'thrusters',
    name: 'Ion Thrusters',
    icon: '➤',
    blurb: '+12% move speed. Outrun the swarm.',
    canTake: () => true,
    apply: (build) => { build.speedBonus += 0.12; },
  },
  {
    id: 'reactor',
    name: 'Dash Reactor',
    icon: '↯',
    blurb: 'Dash recharges 30% faster.',
    canTake: (build) => build.dashCooldownBonus < 0.65,
    apply: (build) => { build.dashCooldownBonus += 0.3; },
  },
  {
    id: 'pierce',
    name: 'Piercing Rounds',
    icon: '➶',
    blurb: 'Bolts pass through +1 enemy before they fade.',
    canTake: (build) => build.pierce < 3,
    apply: (build) => { build.pierce += 1; },
  },
  {
    id: 'blades',
    name: 'Orbit Blade',
    icon: '✦',
    blurb: 'A plasma blade circles your ship, shredding what it touches.',
    canTake: (build) => build.blades < 3,
    apply: (build) => { build.blades += 1; },
  },
  {
    id: 'aegis',
    name: 'Aegis Plating',
    icon: '⬡',
    blurb: 'A shield eats one hit, then recharges over 18 seconds.',
    canTake: (build) => !build.aegis,
    apply: (build) => { build.aegis = true; },
  },
  {
    id: 'combo',
    name: 'Combo Extender',
    icon: '∞',
    blurb: 'Kills keep your multiplier alive 1.5s longer.',
    canTake: (build) => build.comboWindowBonus < 3,
    apply: (build) => { build.comboWindowBonus += 1.5; },
  },
  {
    id: 'repair',
    name: 'Repair Nanobots',
    icon: '✚',
    blurb: 'Restore 2 hearts now, and raise max hearts by 1.',
    canTake: (build, hearts, maxHearts) => maxHearts < 7 || hearts < maxHearts,
    apply: (build) => { build.pendingRepair = true; },
  },
];

/** Pick three distinct offers the current build can still take. */
export function draftThree(build, hearts, maxHearts) {
  const pool = UPGRADES.filter((upgrade) => upgrade.canTake(build, hearts, maxHearts));
  const offers = [];
  while (offers.length < 3 && pool.length > 0) {
    const index = Math.floor(Math.random() * pool.length);
    offers.push(pool.splice(index, 1)[0]);
  }
  return offers;
}
