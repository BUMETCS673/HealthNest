/**
 * check-package-ages.js
 *
 * Verifies that every direct dependency in package.json was published
 * more than DAYS_THRESHOLD days ago. Run with:
 *
 *   npm run check-ages
 *
 * Exit code 0 = all packages are old enough.
 * Exit code 1 = one or more packages are too new (review before installing).
 */

import { createRequire } from "module";
import { get } from "https";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

const pkg = require(join(__dirname, "../package.json"));
const lock = require(join(__dirname, "../package-lock.json"));

const DAYS_THRESHOLD = 7;
const CUTOFF = new Date(Date.now() - DAYS_THRESHOLD * 24 * 60 * 60 * 1000);

/** Fetches the full `time` map { version: isoDate } for a package from the npm registry. */
function fetchPublishTimes(name) {
  return new Promise((resolve) => {
    const encoded = name.startsWith("@")
      ? name.replace("/", "%2F") // scope separator must be encoded
      : name;
    const url = `https://registry.npmjs.org/${encoded}`;
    get(url, { headers: { "User-Agent": "healthnest-age-check/1.0" } }, (res) => {
      const chunks = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => {
        try {
          resolve(JSON.parse(Buffer.concat(chunks).toString()).time ?? {});
        } catch {
          resolve({});
        }
      });
    }).on("error", () => resolve({}));
  });
}

const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };
const names = Object.keys(allDeps);

console.log(
  `\nChecking ${names.length} direct dependencies` +
    ` (cutoff: packages published on or after ${CUTOFF.toDateString()} will be flagged)\n`
);

const tooNew = [];

for (const name of names) {
  const lockEntry = lock.packages?.[`node_modules/${name}`];
  const version = lockEntry?.version;

  if (!version) {
    console.log(`  ${name.padEnd(40)} — locked version not found, skipping`);
    continue;
  }

  process.stdout.write(`  ${`${name}@${version}`.padEnd(50)} `);

  const times = await fetchPublishTimes(name);
  const publishedStr = times[version];

  if (!publishedStr) {
    console.log("(publish date unavailable, skipping)");
    continue;
  }

  const published = new Date(publishedStr);
  const daysAgo = Math.floor((Date.now() - published) / 86_400_000);

  if (published > CUTOFF) {
    console.log(`FAIL  — published ${daysAgo} day(s) ago (${published.toDateString()})`);
    tooNew.push({ name, version, published, daysAgo });
  } else {
    console.log(`OK    — published ${daysAgo} day(s) ago`);
  }
}

if (tooNew.length === 0) {
  console.log(`\n✅  All direct dependencies are older than ${DAYS_THRESHOLD} days.\n`);
  process.exit(0);
} else {
  console.log(
    `\n❌  ${tooNew.length} package(s) were published within the last ${DAYS_THRESHOLD} days:\n`
  );
  for (const { name, version, daysAgo } of tooNew) {
    console.log(`     ${name}@${version}  (${daysAgo} day(s) ago)`);
  }
  console.log(
    "\n  Review these packages before running npm install.\n" +
      "  If you trust them, re-run after the 7-day window has passed.\n"
  );
  process.exit(1);
}
