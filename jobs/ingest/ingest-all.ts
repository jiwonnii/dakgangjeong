/**
 * Runs every ingest script in dependency order, then the bearing_grid
 * precompute (round 5) last, since it reads from `road_segments` and must
 * run after that table is populated. Run with: npm run ingest:all
 *
 * Each script is a separate process (matching how they're invoked
 * individually via their own npm scripts) rather than imported and run
 * in-process, so a failure partway through leaves clear, individually
 * re-runnable state — re-running ingest:all after fixing one script's
 * issue simply re-clears-and-reloads every table again (every ingest
 * script is idempotent via clearBySource/upsert-by-unique-key).
 */

import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const SCRIPTS_IN_ORDER = [
  "ingest-road-segments.ts",
  "ingest-street-trees.ts",
  "ingest-parks.ts",
  "ingest-benches.ts",
  "ingest-streetlights.ts",
  "ingest-risk-zones.ts",
  "ingest-dog-density.ts",
  "ingest-pet-facilities.ts",
  "precompute-bearing-grid.ts"
];

function runScript(scriptFile: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const scriptPath = path.join(__dirname, scriptFile);
    console.log(`\n=== Running ${scriptFile} ===`);

    // Spawned via the `npx tsx` CLI (shell:true for Windows/.cmd
    // resolution) to match how every other script in this project is run
    // (package.json's existing `dev`/`db:check`/`precompute:bearings`
    // scripts all invoke the `tsx` binary the same way), rather than a
    // node --import flag this project does not use anywhere else.
    const child = spawn("npx", ["tsx", scriptPath], {
      stdio: "inherit",
      env: process.env,
      shell: true
    });

    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${scriptFile} exited with code ${code}`));
      }
    });

    child.on("error", reject);
  });
}

async function main(): Promise<void> {
  for (const script of SCRIPTS_IN_ORDER) {
    await runScript(script);
  }

  console.log("\n[ingest-all] All ingest scripts completed successfully.");
}

main().catch((error) => {
  console.error("\n[ingest-all] Failed:", error.message);
  process.exitCode = 1;
});
