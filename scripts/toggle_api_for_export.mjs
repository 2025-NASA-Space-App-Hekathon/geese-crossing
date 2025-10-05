#!/usr/bin/env node
// Temporarily move app/api out of the tree for static export (GitHub Pages)
import { promises as fs } from 'node:fs';
import path from 'node:path';

const mode = process.argv[2] || 'off'; // 'off' => disable API, 'on' => restore

const appDir = path.resolve(process.cwd(), 'app');
const apiDir = path.join(appDir, 'api');
const bakDir = path.resolve(process.cwd(), '.export-bak');
const apiBakDir = path.join(bakDir, 'api');

async function exists(p) { try { await fs.stat(p); return true; } catch { return false; } }

async function main() {
  if (mode === 'off') {
    if (!(await exists(apiDir))) {
      console.log('[toggle-api] no app/api to disable');
      return;
    }
    await fs.mkdir(bakDir, { recursive: true });
    // Clean previous backup if exists
    if (await exists(apiBakDir)) {
      await fs.rm(apiBakDir, { recursive: true, force: true });
    }
    await fs.rename(apiDir, apiBakDir);
    console.log('[toggle-api] app/api disabled for export');
  } else if (mode === 'on') {
    if (!(await exists(apiBakDir))) {
      console.log('[toggle-api] no backup to restore');
      return;
    }
    // Ensure app dir exists
    await fs.mkdir(appDir, { recursive: true });
    await fs.rename(apiBakDir, apiDir);
    // Clean bak dir if empty
    try { await fs.rmdir(bakDir); } catch {}
    console.log('[toggle-api] app/api restored');
  } else {
    console.error('[toggle-api] unknown mode. Use "off" or "on"');
    process.exit(1);
  }
}

main().catch((e) => { console.error('[toggle-api] failed:', e); process.exit(1); });
