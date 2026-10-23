/**
 * generateCodeforcesCalibration.mjs
 *
 * Reproducible data-generation script for Codeforces contest rating normalization.
 * Fetches official user.ratedList?activeOnly=true, calculates exact empirical CDF percentiles,
 * and saves a verifiable snapshot with source payload SHA-256 integrity hash.
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function generateCalibration() {
  const url = 'https://codeforces.com/api/user.ratedList?activeOnly=true';
  console.log(`Fetching Codeforces active rated contestants from: ${url}`);

  const res = await fetch(url, {
    headers: { 'User-Agent': 'ScholrBoard-Calibration/1.0' }
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch Codeforces API: ${res.status} ${res.statusText}`);
  }

  const rawBuffer = Buffer.from(await res.arrayBuffer());
  const sha256 = crypto.createHash('sha256').update(rawBuffer).digest('hex');
  const json = JSON.parse(rawBuffer.toString('utf-8'));

  if (json.status !== 'OK') {
    throw new Error(`Codeforces API returned non-OK status: ${json.comment || json.status}`);
  }

  const users = Array.isArray(json.result) ? json.result : [];
  const ratings = users
    .map(u => u.rating)
    .filter(r => typeof r === 'number' && !isNaN(r))
    .sort((a, b) => a - b);

  const n = ratings.length;
  console.log(`Successfully parsed ${n} active rated contestants.`);
  console.log(`Payload SHA-256: ${sha256}`);

  const getPercentile = (r) => {
    let count = 0;
    for (let i = 0; i < n; i++) {
      if (ratings[i] <= r) count++;
      else break;
    }
    return Number(((count / n) * 100.0).toFixed(2));
  };

  const thresholds = [
    600, 700, 800, 900, 1000, 1100, 1200, 1300, 1400,
    1500, 1600, 1750, 1900, 2100, 2400, 2600, 3000
  ];

  const anchors = thresholds.map(t => [t, getPercentile(t)]);

  const snapshot = {
    metadata: {
      source: url,
      sourceEndpoint: 'Codeforces API user.ratedList?activeOnly=true',
      populationDefinition: 'Active rated contestants who competed in at least 1 rated contest during the last month (~30 days)',
      populationSize: n,
      snapshotTimestamp: new Date().toISOString(),
      sourcePayloadSha256: sha256,
      calibrationVersion: 'v1.1.0-cf-empirical',
      freshnessMaxDays: 180,
      minRating: ratings[0],
      maxRating: ratings[n - 1],
      method: 'empirical_cdf_piecewise_linear'
    },
    anchors
  };

  const outDir = path.resolve(__dirname, '../data');
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  const outFile = path.join(outDir, 'codeforces_calibration_snapshot.json');
  fs.writeFileSync(outFile, JSON.stringify(snapshot, null, 2), 'utf-8');
  console.log(`Snapshot artifact written to: ${outFile}`);
  return snapshot;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  generateCalibration().catch(err => {
    console.error('Calibration generation failed:', err);
    process.exit(1);
  });
}

export { generateCalibration };
