// VOIDPULSE — hand-in program for make.fun's "Make the best game" bounty.
//
// The game itself is the static site in game/ (open game/index.html in any
// desktop browser, no build step, no network). This program's one job is to
// hand it in the way the bounty asks: copy game/ and screenshots/ into the
// output directory and write dossier.json there with the kit's vendored
// library, so the judge reads exactly the files that were submitted.
//
// Run it the way the grader does:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
// Play the game locally instead with: node serve.ts

import { cpSync, existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repoRoot = fileURLToPath(new URL('.', import.meta.url));
const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// The bounty takes 3 or 4 screenshots; refuse early rather than hand in an
// entry the gate would turn away.
const screenshotDir = join(repoRoot, 'screenshots');
const shots = existsSync(screenshotDir)
  ? readdirSync(screenshotDir).filter((name) => /\.(png|jpe?g)$/i.test(name) && !name.startsWith('.'))
  : [];
if (shots.length < 3 || shots.length > 4) {
  throw new Error(`VOIDPULSE needs 3 or 4 screenshots in screenshots/, found ${shots.length}`);
}

mkdirSync(outputDir, { recursive: true });
cpSync(join(repoRoot, 'game'), join(outputDir, 'game'), { recursive: true });
cpSync(screenshotDir, join(outputDir, 'screenshots'), { recursive: true });

// Caps mirror the gate's reference values: the dossier text is capped at
// 160 KiB, a screenshot at 256 KiB, and game/ at 993 files and 48 MiB.
writeFileSync(
  join(outputDir, 'dossier.json'),
  buildDossier(outputDir, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);
