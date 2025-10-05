#!/usr/bin/env node
// Build a static overlays manifest for GitHub Pages (no serverless API available)
import { promises as fs } from 'node:fs';
import path from 'node:path';

async function main() {
  const publicDir = path.resolve(process.cwd(), 'public');
  const overlaysDir = path.join(publicDir, 'overlays');
  let stats;
  try {
    stats = await fs.stat(overlaysDir);
  } catch {
    console.error('[manifest] overlays dir not found:', overlaysDir);
    process.exit(0);
  }
  if (!stats.isDirectory()) {
    console.error('[manifest] overlays is not a directory');
    process.exit(1);
  }
  const entries = await fs.readdir(overlaysDir);
  const exts = new Set(['.png', '.jpg', '.jpeg', '.tif', '.tiff', '.webp']);
  const files = [];
  for (const file of entries) {
    const ext = path.extname(file).toLowerCase();
    if (!exts.has(ext)) continue;
    const name = path.parse(file).name;
    const p = path.posix.join('/overlays', file);
    files.push({ id: name, name, file, path: p, extension: ext });
  }
  const manifest = { success: true, folder: '/overlays', count: files.length, files };
  const outPath = path.join(overlaysDir, 'manifest.json');
  await fs.writeFile(outPath, JSON.stringify(manifest, null, 2), 'utf8');
  console.log(`[manifest] wrote ${outPath} (${files.length} files)`);
}

main().catch((e) => {
  console.error('[manifest] failed:', e);
  process.exit(1);
});
