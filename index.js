#!/usr/bin/env node
'use strict';

const path = require('path');
const { program } = require('commander');
const { loadConfig } = require('./lib/config-loader');
const { scanRepositories } = require('./lib/git-scanner');
const { buildReport, formatReport } = require('./lib/formatter');
const { exportMarkdown } = require('./lib/markdown-exporter');

const pkg = require('./package.json');

program
  .name('git-standup-wizard')
  .description('Generate daily standup reports by scanning local git repositories.')
  .version(pkg.version)
  .option('-c, --config <path>', 'Path to config file or directory containing .env')
  .option('-r, --repos <paths...>', 'One or more repository or root scan paths')
  .option('-a, --author <email>', 'Author email to filter commits by (optional — omit to show all authors)')
  .option('-n, --name <name>', 'Author name to filter commits by (optional)')
  .option('-w, --window <hours>', 'Time window in hours to look back (default: 24)', parseFloat)
  .option('-o, --output <path>', 'Write markdown report to this file path')
  .option('--max-depth <depth>', 'Maximum directory depth for repo scanning (default: 2)', parseInt)
  .option('--include-merges', 'Include merge commits in the report')
  .option('-v, --verbose', 'Enable verbose logging')
  .addHelpText('after', `
Examples:
  $ git-standup-wizard
      Scan current directory, show commits from ALL authors in the last 24h.

  $ git-standup-wizard -r ~/projects -a jane.doe@example.com
      Scan ~/projects and filter commits by author email.

  $ git-standup-wizard -r ~/projects/api ~/projects/frontend -w 48
      Scan two specific directories, looking back 48 hours.

  $ git-standup-wizard -r ~/projects -a jane.doe@example.com -o report.md
      Generate a standup report and also write it to report.md.

  $ git-standup-wizard -r ~/projects --include-merges -v
      Include merge commits and enable verbose output.

  $ git-standup-wizard -c /path/to/project/.env -r ~/projects
      Load configuration from a specific .env file location.

Environment variables (can be set in .env or shell):
  STANDUP_AUTHOR_EMAIL    Author email to filter commits by (optional)
  STANDUP_AUTHOR_NAME     Author name to filter commits by (optional)
  STANDUP_REPO_PATHS      Comma-separated list of repo/root paths to scan
  STANDUP_WINDOW_HOURS    Hours to look back (default: 24)
  STANDUP_MAX_DEPTH       Max directory scan depth (default: 2)
  STANDUP_OUTPUT_PATH     Path to write markdown report
  STANDUP_INCLUDE_MERGES  Set to "true" to include merge commits
`)
  .parse(process.argv);

const cliOpts = program.opts();

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  // 1. Load configuration (env file + CLI overrides)
  const configDir = cliOpts.config
    ? path.resolve(cliOpts.config)
    : process.cwd();

  const { config, warnings, errors, success } = loadConfig(configDir, {
    repoPaths:     cliOpts.repos,
    authorEmail:   cliOpts.author,
    authorName:    cliOpts.name,
    windowHours:   cliOpts.window,
    outputPath:    cliOpts.output,
    maxDepth:      cliOpts.maxDepth,
    includeMerges: cliOpts.includeMerges,
    verbose:       cliOpts.verbose,
  });

  // Surface warnings
  for (const w of warnings) {
    console.warn(`[WARN] ${w}`);
  }

  // Config loading should always succeed now, but guard defensively
  if (!success || !config) {
    for (const e of errors) {
      console.error(`[ERROR] ${e}`);
    }
    process.exit(1);
  }

  if (config.verbose) {
    console.log('[INFO] Configuration loaded successfully.');
    console.log(`[INFO] Author filter : ${
      config.authorEmail || config.authorName || '(none — showing all authors)'
    }`);
    console.log(`[INFO] Window        : ${config.windowHours} hour(s)`);
    console.log(`[INFO] Since         : ${config.since.toISOString()}`);
    console.log(`[INFO] Until         : ${config.until.toISOString()}`);
    console.log(`[INFO] Scanning ${config.repoPaths.length} path(s) for git repositories…`);
  }

  // 2. Scan repositories
  let scanResult;
  try {
    scanResult = scanRepositories(config);
  } catch (err) {
    console.error(`[ERROR] Repository scan failed: ${err.message}`);
    if (config.verbose) console.error(err.stack);
    process.exit(1);
  }

  if (config.verbose) {
    console.log(`[INFO] Scan complete. ${scanResult.repos.length} repo(s) found, ` +
      `${scanResult.totalCommits} commit(s) matched.`);
  }

  // 3. Build structured report
  const report = buildReport(scanResult, config);

  // 4. Print to terminal
  const terminalOutput = formatReport(report);
  console.log(terminalOutput);

  // 5. Optionally write markdown file
  if (config.outputPath) {
    try {
      exportMarkdown(report, config.outputPath);
      console.log(`[INFO] Markdown report written to: ${config.outputPath}`);
    } catch (err) {
      console.error(`[ERROR] Failed to write markdown report: ${err.message}`);
      if (config.verbose) console.error(err.stack);
      // Non-fatal — terminal output already printed, exit 0
    }
  }

  process.exit(0);
}

main().catch(err => {
  console.error(`[ERROR] Unexpected error: ${err.message}`);
  process.exit(1);
});
