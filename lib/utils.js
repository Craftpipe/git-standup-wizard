'use strict';

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

// ---------------------------------------------------------------------------
// Date formatting helpers
// ---------------------------------------------------------------------------

/**
 * Format a Date object as a YYYY-MM-DD string in local time.
 * @param {Date} date - Date to format
 * @returns {string} Formatted date string, or empty string on invalid input
 */
function formatDate(date) {
  if (!date || !(date instanceof Date) || isNaN(date.getTime())) {
    return '';
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

/**
 * Format a Date object as a human-readable date/time string.
 * @param {Date} date - Date to format
 * @param {Object} [options] - Formatting options
 * @param {boolean} [options.includeTime=true] - Whether to include time component
 * @param {boolean} [options.includeSeconds=false] - Whether to include seconds
 * @returns {string} Formatted date/time string, or empty string on invalid input
 */
function formatDateTime(date, options) {
  if (!date || !(date instanceof Date) || isNaN(date.getTime())) {
    return '';
  }

  const opts = options || {};
  const includeTime = opts.includeTime !== false;
  const includeSeconds = opts.includeSeconds === true;

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  let result = `${year}-${month}-${day}`;

  if (includeTime) {
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    result += ` ${hours}:${minutes}`;

    if (includeSeconds) {
      const seconds = String(date.getSeconds()).padStart(2, '0');
      result += `:${seconds}`;
    }
  }

  return result;
}

/**
 * Return a relative human-readable label for a date compared to today.
 * Returns "Today", "Yesterday", or the formatted date string.
 * @param {Date|string} date - Date to label
 * @returns {string} Human-readable label
 */
function getRelativeDateLabel(date) {
  let d;

  if (typeof date === 'string') {
    d = new Date(date);
  } else if (date instanceof Date) {
    d = date;
  } else {
    return '';
  }

  if (isNaN(d.getTime())) {
    return '';
  }

  const today = new Date();
  const todayStr = formatDate(today);
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const yesterdayStr = formatDate(yesterday);
  const dateStr = formatDate(d);

  if (dateStr === todayStr) {
    return 'Today';
  }

  if (dateStr === yesterdayStr) {
    return 'Yesterday';
  }

  return dateStr;
}

/**
 * Parse a date string or Date object into a valid Date, returning null on failure.
 * @param {string|Date} value - Value to parse
 * @returns {Date|null} Parsed Date or null
 */
function parseDate(value) {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    return isNaN(value.getTime()) ? null : value;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }

    const d = new Date(trimmed);
    return isNaN(d.getTime()) ? null : d;
  }

  return null;
}

/**
 * Format a duration in milliseconds as a human-readable string.
 * @param {number} ms - Duration in milliseconds
 * @returns {string} Human-readable duration (e.g. "2h 15m", "45s")
 */
function formatDuration(ms) {
  if (typeof ms !== 'number' || isNaN(ms) || ms < 0) {
    return '0s';
  }

  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const parts = [];

  if (hours > 0) {
    parts.push(`${hours}h`);
  }

  if (minutes > 0) {
    parts.push(`${minutes}m`);
  }

  if (seconds > 0 || parts.length === 0) {
    parts.push(`${seconds}s`);
  }

  return parts.join(' ');
}

// ---------------------------------------------------------------------------
// Path validation helpers
// ---------------------------------------------------------------------------

/**
 * Check whether a given path string is an absolute path.
 * @param {string} filePath - Path to check
 * @returns {boolean}
 */
function isAbsolutePath(filePath) {
  if (!filePath || typeof filePath !== 'string') {
    return false;
  }

  return path.isAbsolute(filePath);
}

/**
 * Check whether a path exists on the filesystem.
 * @param {string} filePath - Path to check
 * @returns {boolean}
 */
function pathExists(filePath) {
  if (!filePath || typeof filePath !== 'string') {
    return false;
  }

  try {
    return fs.existsSync(filePath);
  } catch (_) {
    return false;
  }
}

/**
 * Check whether a path points to an existing directory.
 * @param {string} dirPath - Path to check
 * @returns {boolean}
 */
function isDirectory(dirPath) {
  if (!dirPath || typeof dirPath !== 'string') {
    return false;
  }

  try {
    const stat = fs.statSync(dirPath);
    return stat.isDirectory();
  } catch (_) {
    return false;
  }
}

/**
 * Check whether a path points to an existing file.
 * @param {string} filePath - Path to check
 * @returns {boolean}
 */
function isFile(filePath) {
  if (!filePath || typeof filePath !== 'string') {
    return false;
  }

  try {
    const stat = fs.statSync(filePath);
    return stat.isFile();
  } catch (_) {
    return false;
  }
}

/**
 * Resolve a path, expanding leading ~ to the user's home directory.
 * @param {string} filePath - Path to resolve
 * @returns {string} Resolved absolute path
 */
function resolvePath(filePath) {
  if (!filePath || typeof filePath !== 'string') {
    return '';
  }

  const trimmed = filePath.trim();

  if (!trimmed) {
    return '';
  }

  if (trimmed.startsWith('~')) {
    return path.join(os.homedir(), trimmed.slice(1));
  }

  return path.resolve(trimmed);
}

/**
 * Validate that a path is safe to use — non-empty, resolvable, and free of
 * null bytes or obviously dangerous traversal sequences.
 * @param {string} filePath - Path to validate
 * @returns {{ valid: boolean, reason: string }} Validation result
 */
function validatePath(filePath) {
  if (!filePath || typeof filePath !== 'string') {
    return { valid: false, reason: 'Path must be a non-empty string' };
  }

  const trimmed = filePath.trim();

  if (!trimmed) {
    return { valid: false, reason: 'Path must not be blank' };
  }

  if (trimmed.includes('\0')) {
    return { valid: false, reason: 'Path contains null bytes' };
  }

  // Resolve to catch traversal after expansion
  const resolved = resolvePath(trimmed);

  if (!resolved) {
    return { valid: false, reason: 'Path could not be resolved' };
  }

  return { valid: true, reason: '' };
}

/**
 * Ensure a directory exists, creating it (and any parents) if necessary.
 * @param {string} dirPath - Directory path to ensure
 * @returns {{ success: boolean, error: string }} Result
 */
function ensureDirectory(dirPath) {
  if (!dirPath || typeof dirPath !== 'string') {
    return { success: false, error: 'Directory path must be a non-empty string' };
  }

  try {
    const resolved = resolvePath(dirPath);

    if (!resolved) {
      return { success: false, error: 'Could not resolve directory path' };
    }

    if (!fs.existsSync(resolved)) {
      fs.mkdirSync(resolved, { recursive: true });
    }

    return { success: true, error: '' };
  } catch (err) {
    return { success: false, error: err.message || String(err) };
  }
}

// ---------------------------------------------------------------------------
// Shell command execution wrapper
// ---------------------------------------------------------------------------

/**
 * @typedef {Object} ExecResult
 * @property {boolean} success - Whether the command exited with code 0
 * @property {string} stdout - Standard output from the command
 * @property {string} stderr - Standard error output (if captured)
 * @property {number|null} exitCode - Exit code, or null if unknown
 * @property {string} [error] - Error message if execution failed
 */

/**
 * Execute a shell command synchronously and return a structured result.
 * Never throws — all errors are captured in the returned object.
 *
 * @param {string} command - Shell command to execute
 * @param {Object} [options] - Execution options
 * @param {string} [options.cwd] - Working directory for the command
 * @param {number} [options.timeout=10000] - Timeout in milliseconds
 * @param {string} [options.encoding='utf8'] - Output encoding
 * @param {Object} [options.env] - Environment variables (merged with process.env)
 * @param {number} [options.maxBuffer=1048576] - Maximum output buffer size in bytes (default 1 MB)
 * @returns {ExecResult}
 */
function execCommand(command, options) {
  if (!command || typeof command !== 'string' || !command.trim()) {
    return {
      success: false,
      stdout: '',
      stderr: '',
      exitCode: null,
      error: 'Command must be a non-empty string'
    };
  }

  const opts = options || {};
  const timeout = typeof opts.timeout === 'number' ? opts.timeout : 10000;
  const encoding = opts.encoding || 'utf8';
  const maxBuffer = typeof opts.maxBuffer === 'number' ? opts.maxBuffer : 1024 * 1024;

  const execOptions = {
    encoding,
    timeout,
    maxBuffer,
    stdio: ['pipe', 'pipe', 'pipe']
  };

  if (opts.cwd) {
    execOptions.cwd = opts.cwd;
  }

  if (opts.env && typeof opts.env === 'object') {
    execOptions.env = Object.assign({}, process.env, opts.env);
  }

  try {
    const stdout = execSync(command, execOptions);
    return {
      success: true,
      stdout: typeof stdout === 'string' ? stdout : String(stdout || ''),
      stderr: '',
      exitCode: 0
    };
  } catch (err) {
    const stdout = err.stdout
      ? (typeof err.stdout === 'string' ? err.stdout : err.stdout.toString(encoding))
      : '';
    const stderr = err.stderr
      ? (typeof err.stderr === 'string' ? err.stderr : err.stderr.toString(encoding))
      : '';

    let exitCode = null;

    if (typeof err.status === 'number') {
      exitCode = err.status;
    } else if (err.code && typeof err.code === 'number') {
      exitCode = err.code;
    }

    return {
      success: false,
      stdout,
      stderr,
      exitCode,
      error: err.message || String(err)
    };
  }
}

/**
 * Execute a git command in a specific repository directory.
 * Convenience wrapper around execCommand with sensible git defaults.
 *
 * @param {string} gitArgs - Arguments to pass to git (e.g. "log --oneline")
 * @param {string} repoPath - Absolute path to the git repository
 * @param {Object} [options] - Additional options forwarded to execCommand
 * @returns {ExecResult}
 */
function execGitCommand(gitArgs, repoPath, options) {
  if (!gitArgs || typeof gitArgs !== 'string') {
    return {
      success: false,
      stdout: '',
      stderr: '',
      exitCode: null,
      error: 'Git arguments must be a non-empty string'
    };
  }

  if (!repoPath || typeof repoPath !== 'string') {
    return {
      success: false,
      stdout: '',
      stderr: '',
      exitCode: null,
      error: 'Repository path must be a non-empty string'
    };
  }

  const command = `git ${gitArgs.trim()}`;
  const opts = Object.assign({}, options || {}, { cwd: repoPath });

  return execCommand(command, opts);
}

// ---------------------------------------------------------------------------
// Error message helpers
// ---------------------------------------------------------------------------

/**
 * Build a standardised error message string with an optional context prefix.
 * @param {string} message - Core error message
 * @param {string} [context] - Optional context label (e.g. function or module name)
 * @returns {string} Formatted error message
 */
function buildErrorMessage(message, context) {
  if (!message || typeof message !== 'string') {
    message = 'An unknown error occurred';
  }

  const trimmedMessage = message.trim();

  if (context && typeof context === 'string' && context.trim()) {
    return `[${context.trim()}] ${trimmedMessage}`;
  }

  return trimmedMessage;
}

/**
 * Extract a human-readable message from an unknown thrown value.
 * Handles Error objects, strings, and other types gracefully.
 * @param {*} err - The caught error value
 * @param {string} [fallback='An unknown error occurred'] - Fallback message
 * @returns {string} Human-readable error message
 */
function extractErrorMessage(err, fallback) {
  const defaultFallback = fallback || 'An unknown error occurred';

  if (!err) {
    return defaultFallback;
  }

  if (typeof err === 'string') {
    return err.trim() || defaultFallback;
  }

  if (err instanceof Error) {
    return err.message ? err.message.trim() : defaultFallback;
  }

  if (typeof err === 'object' && err.message) {
    return String(err.message).trim() || defaultFallback;
  }

  try {
    const str = String(err).trim();
    return str || defaultFallback;
  } catch (_) {
    return defaultFallback;
  }
}

/**
 * Format a list of errors into a single multi-line string.
 * @param {string[]} errors - Array of error messages
 * @param {string} [header='Errors:'] - Optional header line
 * @returns {string} Formatted error summary
 */
function formatErrorList(errors, header) {
  if (!Array.isArray(errors) || errors.length === 0) {
    return '';
  }

  const heading = (header && typeof header === 'string') ? header.trim() : 'Errors:';
  const lines = [heading];

  for (const err of errors) {
    if (err && typeof err === 'string' && err.trim()) {
      lines.push(`  - ${err.trim()}`);
    }
  }

  return lines.join('\n');
}

/**
 * Create a structured error object with a message, optional code, and optional context.
 * @param {string} message - Error message
 * @param {Object} [meta] - Optional metadata
 * @param {string} [meta.code] - Error code (e.g. 'ENOENT', 'INVALID_CONFIG')
 * @param {string} [meta.context] - Context label
 * @param {*} [meta.cause] - Underlying cause
 * @returns {{ message: string, code: string|null, context: string|null, cause: *|null }}
 */
function createError(message, meta) {
  const m = meta || {};

  return {
    message: buildErrorMessage(message, m.context),
    code: (m.code && typeof m.code === 'string') ? m.code.trim() : null,
    context: (m.context && typeof m.context === 'string') ? m.context.trim() : null,
    cause: m.cause !== undefined ? m.cause : null
  };
}

// ---------------------------------------------------------------------------
// Miscellaneous utilities
// ---------------------------------------------------------------------------

/**
 * Truncate a string to a maximum length, appending an ellipsis if truncated.
 * @param {string} str - Input string
 * @param {number} [maxLength=80] - Maximum length before truncation
 * @param {string} [ellipsis='...'] - Suffix to append when truncated
 * @returns {string} Possibly truncated string
 */
function truncate(str, maxLength, ellipsis) {
  if (!str || typeof str !== 'string') {
    return '';
  }

  const max = typeof maxLength === 'number' && maxLength > 0 ? maxLength : 80;
  const suffix = typeof ellipsis === 'string' ? ellipsis : '...';

  if (str.length <= max) {
    return str;
  }

  return str.slice(0, max - suffix.length) + suffix;
}

/**
 * Pad a string on the right to a given width.
 * @param {string} str - Input string
 * @param {number} width - Desired total width
 * @param {string} [char=' '] - Padding character
 * @returns {string} Padded string
 */
function padRight(str, width, char) {
  const s = (str == null) ? '' : String(str);
  const padChar = (typeof char === 'string' && char.length === 1) ? char : ' ';
  const w = typeof width === 'number' && width > 0 ? width : 0;

  if (s.length >= w) {
    return s;
  }

  return s + padChar.repeat(w - s.length);
}

/**
 * Deduplicate an array while preserving insertion order.
 * @template T
 * @param {T[]} arr - Input array
 * @returns {T[]} Array with duplicates removed
 */
function unique(arr) {
  if (!Array.isArray(arr)) {
    return [];
  }

  const seen = new Set();
  const result = [];

  for (const item of arr) {
    if (!seen.has(item)) {
      seen.add(item);
      result.push(item);
    }
  }

  return result;
}

/**
 * Safely stringify a value to JSON, returning a fallback string on error.
 * @param {*} value - Value to stringify
 * @param {number} [indent=2] - JSON indentation spaces
 * @returns {string} JSON string or fallback
 */
function safeJsonStringify(value, indent) {
  try {
    return JSON.stringify(value, null, typeof indent === 'number' ? indent : 2);
  } catch (_) {
    return '[unserializable]';
  }
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

module.exports = {
  // Date formatting
  formatDate,
  formatDateTime,
  getRelativeDateLabel,
  parseDate,
  formatDuration,

  // Path validation
  isAbsolutePath,
  pathExists,
  isDirectory,
  isFile,
  resolvePath,
  validatePath,
  ensureDirectory,

  // Shell execution
  execCommand,
  execGitCommand,

  // Error messages
  buildErrorMessage,
  extractErrorMessage,
  formatErrorList,
  createError,

  // Miscellaneous
  truncate,
  padRight,
  unique,
  safeJsonStringify
};