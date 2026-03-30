'use strict';

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

/**
 * Return true if `dir` is the root of a git repository (contains a .git entry).
 */
function isGitRepo(dir) {
  try {
    return fs.existsSync(path.join(dir, '.git'));
  } catch (_) {
    return false;
  }
}

/**
 * Recursively find git repositories under `rootDir` up to `maxDepth` levels deep.
 * Depth 0 means only check rootDir itself.
 */
function findRepos(rootDir, maxDepth, currentDepth = 0) {
  const repos = [];
  if (!fs.existsSync(rootDir)) return repos;

  if (isGitRepo(rootDir)) {
    repos.push(rootDir);
    // Don't descend into nested repos
    return repos;
  }

  if (currentDepth >= maxDepth) return repos;

  let entries;
  try {
    entries = fs.readdirSync(rootDir, { withFileTypes: true });
  } catch (_) {
    return repos;
  }

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (entry.name.startsWith('.')) continue;
    const child = path.join(rootDir, entry.name);
    repos.push(...findRepos(child, maxDepth, currentDepth + 1));
  }

  return repos;
}

/**
 * Run git log in `repoDir` and return an array of commit objects.
 *
 * When authorEmail or authorName is provided the --author flag is used to
 * filter commits. When NEITHER is provided all commits in the window are
 * returned regardless of author.
 *
 * @param {string} repoDir
 * @param {object} opts
 * @param {string|null} opts.authorEmail
 * @param {string|null} opts.authorName
 * @param {Date}   opts.since
 * @param {Date}   opts.until
 * @param {boolean} opts.includeMerges
 * @param {boolean} opts.verbose
 * @returns {Array<{hash:string, date:Date, author:string, email:string, message:string}>}
 */
function getCommits(repoDir, opts) {
  const { authorEmail, authorName, since, until, includeMerges, verbose } = opts;

  const sinceIso = since.toISOString();
  const untilIso = until.toISOString();

  // Format: hash|unix-timestamp|author-name|author-email|subject
  const format = '%H|%at|%an|%ae|%s';

  const args = [
    'git', 'log',
    `--format=${format}`,
    `--after=${sinceIso}`,
    `--before=${untilIso}`,
  ];

  // Only add --author when a filter is actually specified
  if (authorEmail) {
    args.push(`--author=${authorEmail}`);
  } else if (authorName) {
    args.push(`--author=${authorName}`);
  }
  // If neither is set, omit --author entirely → all authors

  if (!includeMerges) {
    args.push('--no-merges');
  }

  const cmd = args.map(a => {
    // Quote arguments that contain spaces or special chars
    if (/[\s"'<>|&;()$]/.test(a)) return `"${a.replace(/"/g, '\\"')}"`;
    return a;
  }).join(' ');

  if (verbose) {
    console.log(`[INFO]   Running: ${cmd}  (in ${repoDir})`);
  }

  let output;
  try {
    output = execSync(cmd, {
      cwd: repoDir,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 15000,
    });
  } catch (err) {
    if (verbose) {
      console.warn(`[WARN] git log failed in ${repoDir}: ${err.message}`);
    }
    return [];
  }

  const commits = [];
  for (const line of output.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const parts = trimmed.split('|');
    if (parts.length < 5) continue;
    const [hash, ts, author, email, ...msgParts] = parts;
    commits.push({
      hash: hash.slice(0, 7),
      date: new Date(parseInt(ts, 10) * 1000),
      author,
      email,
      message: msgParts.join('|'),
    });
  }
  return commits;
}

/**
 * Scan all repo paths, discover git repositories, and collect commits.
 *
 * @param {object} config  Full config object from loadConfig
 * @returns {{
 *   repos: Array<{repoDir:string, name:string, commits:Array, active:boolean}>,
 *   totalCommits: number,
 *   scannedPaths: string[]
 * }}
 */
function scanRepositories(config) {
  const {
    repoPaths,
    authorEmail,
    authorName,
    since,
    until,
    maxDepth,
    includeMerges,
    verbose,
  } = config;

  const allRepoDirs = [];
  for (const rootPath of repoPaths) {
    const found = findRepos(rootPath, maxDepth);
    for (const r of found) {
      if (!allRepoDirs.includes(r)) allRepoDirs.push(r);
    }
  }

  if (verbose) {
    console.log(`[INFO] Found ${allRepoDirs.length} git repository/repositories.`);
  }

  const repos = [];
  let totalCommits = 0;

  for (const repoDir of allRepoDirs) {
    const name = path.basename(repoDir);
    const commits = getCommits(repoDir, {
      authorEmail,
      authorName,
      since,
      until,
      includeMerges,
      verbose,
    });

    const active = commits.length > 0;
    totalCommits += commits.length;

    repos.push({ repoDir, name, commits, active });
  }

  return { repos, totalCommits, scannedPaths: repoPaths };
}

module.exports = { scanRepositories, findRepos, getCommits };
