'use strict';

/**
 * @typedef {Object} Commit
 * @property {string} hash - Short commit hash
 * @property {string} author - Author name
 * @property {string} email - Author email
 * @property {string} date - ISO date string
 * @property {string} message - Commit message
 * @property {string} repo - Repository name
 * @property {string} repoPath - Absolute path to repository
 */

/**
 * @typedef {Object} ReportEntry
 * @property {string} repo - Repository name
 * @property {string} repoPath - Absolute path to repository
 * @property {Commit[]} commits - Commits for this repo
 */

/**
 * @typedef {Object} DateGroup
 * @property {string} date - Date label (e.g. "2024-01-15")
 * @property {string} label - Human-readable label (e.g. "Today", "Yesterday", or the date)
 * @property {ReportEntry[]} projects - Projects with commits on this date
 * @property {number} totalCommits - Total commits across all projects on this date
 */

/**
 * @typedef {Object} Report
 * @property {DateGroup[]} byDate - Commits grouped by date then project
 * @property {Object.<string, ReportEntry>} byProject - Commits grouped by project
 * @property {number} totalCommits - Total number of commits
 * @property {number} totalRepos - Total number of repos with commits
 * @property {string[]} inactiveRepos - Repos with no matching commits
 * @property {string[]} errors - Any errors encountered
 * @property {Date} generatedAt - When the report was generated
 * @property {boolean} isEmpty - Whether the report has no commits
 */

/**
 * Sanitize a string to remove or escape problematic characters for display.
 * Handles null bytes, control characters, and excessively long strings.
 * @param {string} str - Input string
 * @param {number} [maxLength=500] - Maximum allowed length
 * @returns {string} Sanitized string
 */
function sanitizeString(str, maxLength) {
  if (str === null || str === undefined) {
    return '';
  }

  var max = typeof maxLength === 'number' ? maxLength : 500;

  if (typeof str !== 'string') {
    try {
      str = String(str);
    } catch (_) {
      return '';
    }
  }

  // Remove null bytes
  str = str.replace(/\0/g, '');

  // Remove other control characters except tab and newline
  str = str.replace(/[\x01-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

  // Trim whitespace
  str = str.trim();

  // Truncate if too long
  if (str.length > max) {
    str = str.slice(0, max) + '...';
  }

  return str;
}

/**
 * Format a Date object as a YYYY-MM-DD string in local time.
 * @param {Date} date - Date to format
 * @returns {string} Formatted date string
 */
function formatDateKey(date) {
  if (!(date instanceof Date) || isNaN(date.getTime())) {
    return 'unknown-date';
  }

  var year = date.getFullYear();
  var month = String(date.getMonth() + 1).padStart(2, '0');
  var day = String(date.getDate()).padStart(2, '0');

  return year + '-' + month + '-' + day;
}

/**
 * Get a human-readable label for a date key relative to today.
 * @param {string} dateKey - Date string in YYYY-MM-DD format
 * @returns {string} Label such as "Today", "Yesterday", or the date string
 */
function getDateLabel(dateKey) {
  if (!dateKey || dateKey === 'unknown-date') {
    return 'Unknown Date';
  }

  var today = formatDateKey(new Date());

  var yesterdayDate = new Date();
  yesterdayDate.setDate(yesterdayDate.getDate() - 1);
  var yesterday = formatDateKey(yesterdayDate);

  if (dateKey === today) {
    return 'Today (' + dateKey + ')';
  }

  if (dateKey === yesterday) {
    return 'Yesterday (' + dateKey + ')';
  }

  return dateKey;
}

/**
 * Parse a commit's date string into a YYYY-MM-DD key.
 * Falls back to 'unknown-date' if parsing fails.
 * @param {string} dateStr - ISO date string from commit
 * @returns {string} Date key
 */
function parseDateKey(dateStr) {
  if (!dateStr) {
    return 'unknown-date';
  }

  try {
    var d = new Date(dateStr);
    if (isNaN(d.getTime())) {
      return 'unknown-date';
    }
    return formatDateKey(d);
  } catch (_) {
    return 'unknown-date';
  }
}

/**
 * Sanitize a single commit object, ensuring all fields are safe strings.
 * @param {Commit} commit - Raw commit object
 * @returns {Commit} Sanitized commit object
 */
function sanitizeCommit(commit) {
  if (!commit || typeof commit !== 'object') {
    return null;
  }

  return {
    hash: sanitizeString(commit.hash, 40),
    author: sanitizeString(commit.author, 200),
    email: sanitizeString(commit.email, 200),
    date: sanitizeString(commit.date, 100),
    message: sanitizeString(commit.message, 500),
    repo: sanitizeString(commit.repo, 200),
    repoPath: sanitizeString(commit.repoPath, 1000)
  };
}

/**
 * Group an array of commits by repository name.
 * @param {Commit[]} commits - Array of sanitized commits
 * @returns {Object.<string, ReportEntry>} Map of repo name to ReportEntry
 */
function groupByProject(commits) {
  var result = {};

  if (!Array.isArray(commits) || commits.length === 0) {
    return result;
  }

  for (var i = 0; i < commits.length; i++) {
    var commit = commits[i];

    if (!commit) {
      continue;
    }

    var repoKey = commit.repo || 'unknown-repo';

    if (!result[repoKey]) {
      result[repoKey] = {
        repo: repoKey,
        repoPath: commit.repoPath || '',
        commits: []
      };
    }

    result[repoKey].commits.push(commit);
  }

  return result;
}

/**
 * Group an array of commits by date, then by repository within each date.
 * @param {Commit[]} commits - Array of sanitized commits
 * @returns {DateGroup[]} Array of date groups sorted descending (most recent first)
 */
function groupByDate(commits) {
  if (!Array.isArray(commits) || commits.length === 0) {
    return [];
  }

  // Build a map: dateKey -> { repoKey -> ReportEntry }
  var dateMap = {};

  for (var i = 0; i < commits.length; i++) {
    var commit = commits[i];

    if (!commit) {
      continue;
    }

    var dateKey = parseDateKey(commit.date);
    var repoKey = commit.repo || 'unknown-repo';

    if (!dateMap[dateKey]) {
      dateMap[dateKey] = {};
    }

    if (!dateMap[dateKey][repoKey]) {
      dateMap[dateKey][repoKey] = {
        repo: repoKey,
        repoPath: commit.repoPath || '',
        commits: []
      };
    }

    dateMap[dateKey][repoKey].commits.push(commit);
  }

  // Convert map to sorted array
  var dateKeys = Object.keys(dateMap);

  // Sort descending (most recent first), unknown-date goes last
  dateKeys.sort(function (a, b) {
    if (a === 'unknown-date') return 1;
    if (b === 'unknown-date') return -1;
    if (a > b) return -1;
    if (a < b) return 1;
    return 0;
  });

  var result = [];

  for (var j = 0; j < dateKeys.length; j++) {
    var dk = dateKeys[j];
    var repoMap = dateMap[dk];
    var projects = [];
    var totalCommits = 0;

    var repoKeys = Object.keys(repoMap);

    // Sort repos alphabetically for consistent output
    repoKeys.sort();

    for (var k = 0; k < repoKeys.length; k++) {
      var entry = repoMap[repoKeys[k]];
      totalCommits += entry.commits.length;
      projects.push(entry);
    }

    result.push({
      date: dk,
      label: getDateLabel(dk),
      projects: projects,
      totalCommits: totalCommits
    });
  }

  return result;
}

/**
 * Validate and filter raw commits, discarding any that are malformed.
 * @param {*} rawCommits - Raw input (should be an array of commit objects)
 * @returns {{ valid: Commit[], skipped: number }} Validated commits and skip count
 */
function validateCommits(rawCommits) {
  if (!Array.isArray(rawCommits)) {
    return { valid: [], skipped: 0 };
  }

  var valid = [];
  var skipped = 0;

  for (var i = 0; i < rawCommits.length; i++) {
    var raw = rawCommits[i];

    if (!raw || typeof raw !== 'object') {
      skipped++;
      continue;
    }

    var sanitized = sanitizeCommit(raw);

    if (!sanitized) {
      skipped++;
      continue;
    }

    // A commit must have at least a hash or a message to be meaningful
    if (!sanitized.hash && !sanitized.message) {
      skipped++;
      continue;
    }

    valid.push(sanitized);
  }

  return { valid: valid, skipped: skipped };
}

/**
 * Generate a structured report from raw scan results.
 *
 * Accepts either a ScanResult object (with a `commits` array and optional
 * `inactiveRepos` / `errors` arrays) or a plain array of commit objects.
 *
 * @param {Object|Commit[]} scanResult - Raw scan result or array of commits
 * @returns {Report} Structured report object
 */
function generateReport(scanResult) {
  var rawCommits = [];
  var inactiveRepos = [];
  var errors = [];

  // Accept either a ScanResult object or a bare array
  if (Array.isArray(scanResult)) {
    rawCommits = scanResult;
  } else if (scanResult && typeof scanResult === 'object') {
    rawCommits = Array.isArray(scanResult.commits) ? scanResult.commits : [];
    inactiveRepos = Array.isArray(scanResult.inactiveRepos)
      ? scanResult.inactiveRepos.map(function (r) { return sanitizeString(r, 1000); })
      : [];
    errors = Array.isArray(scanResult.errors)
      ? scanResult.errors.map(function (e) { return sanitizeString(e, 1000); })
      : [];
  }

  // Validate and sanitize commits
  var validation = validateCommits(rawCommits);

  if (validation.skipped > 0) {
    errors.push('Skipped ' + validation.skipped + ' malformed commit(s) during report generation.');
  }

  var commits = validation.valid;

  // Build grouped structures
  var byDate = groupByDate(commits);
  var byProject = groupByProject(commits);

  // Collect unique repos that have commits
  var activeRepoNames = Object.keys(byProject);

  var report = {
    byDate: byDate,
    byProject: byProject,
    totalCommits: commits.length,
    totalRepos: activeRepoNames.length,
    inactiveRepos: inactiveRepos,
    errors: errors,
    generatedAt: new Date(),
    isEmpty: commits.length === 0
  };

  return report;
}

/**
 * Get a flat, chronologically sorted array of all commits from a report.
 * @param {Report} report - Generated report object
 * @returns {Commit[]} Sorted commits (most recent first)
 */
function getFlatCommits(report) {
  if (!report || !report.byDate || !Array.isArray(report.byDate)) {
    return [];
  }

  var flat = [];

  for (var i = 0; i < report.byDate.length; i++) {
    var dateGroup = report.byDate[i];

    if (!dateGroup || !Array.isArray(dateGroup.projects)) {
      continue;
    }

    for (var j = 0; j < dateGroup.projects.length; j++) {
      var project = dateGroup.projects[j];

      if (!project || !Array.isArray(project.commits)) {
        continue;
      }

      for (var k = 0; k < project.commits.length; k++) {
        flat.push(project.commits[k]);
      }
    }
  }

  return flat;
}

/**
 * Summarize a report into a plain object suitable for logging or debugging.
 * @param {Report} report - Generated report object
 * @returns {Object} Summary object
 */
function summarizeReport(report) {
  if (!report) {
    return {
      totalCommits: 0,
      totalRepos: 0,
      datesCovered: [],
      inactiveRepos: [],
      isEmpty: true,
      errors: []
    };
  }

  var datesCovered = Array.isArray(report.byDate)
    ? report.byDate.map(function (dg) { return dg.date; })
    : [];

  return {
    totalCommits: report.totalCommits || 0,
    totalRepos: report.totalRepos || 0,
    datesCovered: datesCovered,
    inactiveRepos: report.inactiveRepos || [],
    isEmpty: report.isEmpty === true,
    errors: report.errors || []
  };
}

module.exports = {
  generateReport: generateReport,
  groupByDate: groupByDate,
  groupByProject: groupByProject,
  getFlatCommits: getFlatCommits,
  summarizeReport: summarizeReport,
  sanitizeString: sanitizeString,
  formatDateKey: formatDateKey,
  getDateLabel: getDateLabel
};