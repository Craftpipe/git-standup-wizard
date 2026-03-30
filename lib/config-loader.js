'use strict';

const fs = require('fs');
const path = require('path');

/**
 * Parse a simple .env file and return key/value pairs.
 * Lines starting with # are comments. Inline comments are stripped.
 * Quoted values have their quotes removed.
 */
function parseEnvFile(filePath) {
  const result = {};
  let raw;
  try {
    raw = fs.readFileSync(filePath, 'utf8');
  } catch (_) {
    return result;
  }
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    let val = trimmed.slice(eqIdx + 1).trim();
    // Strip inline comments (only outside quotes — simple heuristic)
    if (!val.startsWith('"') && !val.startsWith("'")) {
      const commentIdx = val.indexOf(' #');
      if (commentIdx !== -1) val = val.slice(0, commentIdx).trim();
    }
    // Strip surrounding quotes
    if ((val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    result[key] = val;
  }
  return result;
}

/**
 * Locate a .env file starting from configDir and walking up to fs root.
 */
function findEnvFile(configDir) {
  let dir = path.resolve(configDir);
  while (true) {
    const candidate = path.join(dir, '.env');
    if (fs.existsSync(candidate)) return candidate;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

/**
 * Load and validate configuration.
 *
 * Priority (highest → lowest):
 *   1. CLI overrides passed as `cliOverrides`
 *   2. Environment variables (process.env)
 *   3. .env file found near configDir
 *   4. Built-in defaults
 *
 * Author email/name are OPTIONAL. When absent, commits are not filtered by
 * author and the report shows all authors.
 *
 * @param {string} configDir  Directory to start searching for .env
 * @param {object} cliOverrides  Values parsed from CLI flags
 * @returns {{ config: object|null, warnings: string[], errors: string[], success: boolean }}
 */
function loadConfig(configDir, cliOverrides = {}) {
  const warnings = [];
  const errors = [];

  // --- Load .env file (optional) ---
  const envFile = findEnvFile(configDir);
  const envVars = envFile ? parseEnvFile(envFile) : {};

  function get(envKey, cliValue, defaultValue) {
    if (cliValue !== undefined && cliValue !== null && cliValue !== '') return cliValue;
    if (process.env[envKey] !== undefined && process.env[envKey] !== '') return process.env[envKey];
    if (envVars[envKey] !== undefined && envVars[envKey] !== '') return envVars[envKey];
    return defaultValue;
  }

  // --- Author (optional) ---
  const authorEmail = get('STANDUP_AUTHOR_EMAIL', cliOverrides.authorEmail, null) || null;
  const authorName  = get('STANDUP_AUTHOR_NAME',  cliOverrides.authorName,  null) || null;
  // No error if both are absent — we simply scan all authors.

  // --- Repo paths ---
  let repoPaths = cliOverrides.repoPaths || null;
  if (!repoPaths) {
    const raw = get('STANDUP_REPO_PATHS', null, null);
    if (raw) {
      repoPaths = raw.split(',').map(p => p.trim()).filter(Boolean);
    }
  }
  if (!repoPaths || repoPaths.length === 0) {
    repoPaths = [process.cwd()];
  }
  repoPaths = repoPaths.map(p => path.resolve(p));

  // --- Time window ---
  const windowHoursRaw = get('STANDUP_WINDOW_HOURS', cliOverrides.windowHours, 24);
  const windowHours = parseFloat(windowHoursRaw);
  if (isNaN(windowHours) || windowHours <= 0) {
    warnings.push(`Invalid window hours "${windowHoursRaw}", defaulting to 24.`);
  }
  const resolvedWindowHours = (isNaN(windowHours) || windowHours <= 0) ? 24 : windowHours;

  const until = new Date();
  const since = new Date(until.getTime() - resolvedWindowHours * 60 * 60 * 1000);

  // --- Max depth ---
  const maxDepthRaw = get('STANDUP_MAX_DEPTH', cliOverrides.maxDepth, 2);
  const maxDepth = parseInt(maxDepthRaw, 10);
  const resolvedMaxDepth = (isNaN(maxDepth) || maxDepth < 0) ? 2 : maxDepth;

  // --- Output path ---
  const outputPath = get('STANDUP_OUTPUT_PATH', cliOverrides.outputPath, null) || null;

  // --- Include merges ---
  const includeMergesRaw = get('STANDUP_INCLUDE_MERGES', cliOverrides.includeMerges, false);
  const includeMerges = includeMergesRaw === true || includeMergesRaw === 'true';

  // --- Verbose ---
  const verboseRaw = get('STANDUP_VERBOSE', cliOverrides.verbose, false);
  const verbose = verboseRaw === true || verboseRaw === 'true';

  const config = {
    authorEmail,
    authorName,
    repoPaths,
    windowHours: resolvedWindowHours,
    since,
    until,
    maxDepth: resolvedMaxDepth,
    outputPath,
    includeMerges,
    verbose,
  };

  return { config, warnings, errors, success: true };
}

module.exports = { loadConfig };
