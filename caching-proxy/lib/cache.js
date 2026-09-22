const fs = require("fs");
const os = require("os");
const path = require("path");

// Cache is persisted to disk so that:
//  1. It survives server restarts.
//  2. `caching-proxy --clear-cache` (run as a separate process) can wipe it
//     even though it doesn't share memory with a running server process.
const CACHE_DIR = path.join(os.homedir(), ".caching-proxy");
const CACHE_FILE = path.join(CACHE_DIR, "cache.json");

console.log(CACHE_DIR, "\n", CACHE_FILE);

function ensureDir() {
  if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
  }
}

function loadCache() {
  ensureDir();
  if (!fs.existsSync(CACHE_FILE)) return {};
  try {
    const raw = fs.readFileSync(CACHE_FILE, "utf-8");

  
    return raw ? JSON.parse(raw) : {};
  } catch (err) {
    // Corrupt or unreadable cache file - start fresh rather than crashing.
    console.error(
      "Warning: could not read cache file, starting with an empty cache.",
      err.message,
    );
    return {};
  }
}

function persist(data) {
  ensureDir();
  fs.writeFileSync(CACHE_FILE, JSON.stringify(data), "utf-8");
}

let cacheData = loadCache();

module.exports = {
  /** Retrieve a cached entry by key, or undefined if not present. */
  get(key) {
    return cacheData[key];
  },

  /** Store an entry under key and persist to disk immediately. */
  set(key, value) {
    cacheData[key] = value;
    persist(cacheData);
  },

  /** Wipe the entire cache, in memory and on disk. */
  clear() {
    cacheData = {};
    persist(cacheData);
  },

  /** Path to the underlying cache file, mostly useful for debugging/tests. */
  location() {
    return CACHE_FILE;
  },
};
