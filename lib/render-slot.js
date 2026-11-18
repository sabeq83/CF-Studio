import fs from 'fs';
import path from 'path';
import os from 'os';
import { getDb } from './db.js';

export class RenderYieldError extends Error {
  constructor(message = 'Render job yielded to production priority') {
    super(message);
    this.name = 'RenderYieldError';
  }
}

/**
 * Returns the directory used for render slot locks.
 */
export function getRenderSlotDir() {
  if (process.env.RENDER_SLOT_DIR) {
    return process.env.RENDER_SLOT_DIR;
  }
  return path.join(os.homedir(), '.cfstudio', 'render-slots');
}

/**
 * Ensures the slot directory exists safely.
 */
function ensureSlotDir() {
  try {
    const dir = getRenderSlotDir();
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    return dir;
  } catch (err) {
    console.warn('[RenderSlot] Warning: Could not create slot dir:', err.message);
    return null;
  }
}

/**
 * Acquires a production render slot.
 * GUARANTEE: Never throws — if anything fails, returns a dummy release() so production is never blocked.
 * 
 * @param {Object} options
 * @param {string} [options.env]
 * @param {string} [options.jobRef]
 * @param {string} [options.type] - 're_campaign' | 'pillar_campaign' | 're_multiplier'
 * @returns {Promise<{ release: () => Promise<void> }>}
 */
export async function acquireProductionSlot(options = {}) {
  const {
    env = process.env.PG_SEARCH_PATH?.split(',')[0]?.trim() || 'staging',
    jobRef = 'unknown',
    type = 'production'
  } = options;

  const dir = ensureSlotDir();
  if (!dir) {
    return { release: async () => {} };
  }

  const cleanRef = String(jobRef).replace(/[^a-zA-Z0-9_-]/g, '_');
  const lockFileName = `production-${cleanRef}-${Date.now()}.lock`;
  const lockFilePath = path.join(dir, lockFileName);

  const heartbeatIntervalMs = 10_000;
  const ttlMs = 30_000;

  const writeLockData = () => {
    try {
      const data = {
        id: lockFileName,
        pid: process.pid,
        env,
        jobRef,
        type,
        startedAt: Date.now(),
        updatedAt: Date.now(),
        expiresAt: Date.now() + ttlMs
      };
      fs.writeFileSync(lockFilePath, JSON.stringify(data, null, 2), 'utf8');
      return true;
    } catch (err) {
      console.warn('[RenderSlot] Failed to write lock file:', err.message);
      return false;
    }
  };

  const written = writeLockData();
  if (!written) {
    return { release: async () => {} };
  }

  console.log(`[RenderSlot] Acquired production slot for ${type} (ref: ${jobRef}) -> ${lockFileName}`);

  // Heartbeat updater
  const timer = setInterval(() => {
    try {
      if (fs.existsSync(lockFilePath)) {
        const raw = fs.readFileSync(lockFilePath, 'utf8');
        const data = JSON.parse(raw);
        data.updatedAt = Date.now();
        data.expiresAt = Date.now() + ttlMs;
        fs.writeFileSync(lockFilePath, JSON.stringify(data, null, 2), 'utf8');
      } else {
        clearInterval(timer);
      }
    } catch (_) {
      // Ignore heartbeat update failures safely
    }
  }, heartbeatIntervalMs);

  if (timer.unref) timer.unref();

  let released = false;
  const release = async () => {
    if (released) return;
    released = true;
    try {
      clearInterval(timer);
    } catch (_) {}
    try {
      if (fs.existsSync(lockFilePath)) {
        fs.unlinkSync(lockFilePath);
        console.log(`[RenderSlot] Released production slot for ${type} (ref: ${jobRef})`);
      }
    } catch (err) {
      console.warn('[RenderSlot] Warning: Failed to delete lock file on release:', err.message);
    }
  };

  return { release };
}

/**
 * Checks whether any production slot is currently active.
 * Synchronous and resilient.
 * 
 * @returns {boolean}
 */
export function isProductionActive() {
  try {
    const dir = getRenderSlotDir();
    if (!fs.existsSync(dir)) return false;

    const files = fs.readdirSync(dir);
    const now = Date.now();

    for (const f of files) {
      if (!f.endsWith('.lock')) continue;
      const fullPath = path.join(dir, f);
      try {
        const content = fs.readFileSync(fullPath, 'utf8');
        const data = JSON.parse(content);
        if (data && typeof data.expiresAt === 'number') {
          if (data.expiresAt > now) {
            // Found an active unexpired lock
            return true;
          } else {
            // Expired lock, clean up opportunistically
            try { fs.unlinkSync(fullPath); } catch (_) {}
          }
        }
      } catch (_) {
        // Corrupted lock file, ignore
      }
    }
    return false;
  } catch (_) {
    return false;
  }
}

/**
 * Checks if production is scheduled to run in the near future (e.g. within 5 minutes).
 * Returns earliest scheduled timestamp in ms, or null if none.
 * 
 * @returns {Promise<number|null>}
 */
export async function getNextScheduledProductionAt() {
  try {
    const db = getDb();
    if (!db || !db.prepare) return null;

    try {
      const row = await db.prepare(
        "SELECT MIN(scheduled_at) as next_at FROM affiliate_content_schedules WHERE status = 'pending' AND scheduled_at >= NOW() AND scheduled_at <= NOW() + INTERVAL '5 minutes'"
      ).get();
      if (row?.next_at) {
        const ts = new Date(row.next_at).getTime();
        if (!isNaN(ts)) return ts;
      }
    } catch (_) {}

    return null;
  } catch (_) {
    return null;
  }
}
