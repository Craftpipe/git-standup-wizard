'use strict';

const path = require('path');

/**
 * Format a Date as YYYY-MM-DD.
 */
function fmtDate(d) {
  return d.toISOString().slice(0, 10);
}

/**
 * Format a Date as HH:MM.
 */
function fmtTime(d) {
  return d.toISOString().slice(11, 16);
}

/**
 * Format a Date as YYYY-MM-DD HH:MM.
 */
function fmtDateTime(d) {
  return `${fmtDate(d)} ${fmtTime(d)}`;
}

/**
 * Build a structured report object from scan results + config.
 *
 * @param {object} scanResult  Output of scanRepositories()
 * @param {object} config      Full config object
 * @returns {object}           Structured report
 */
function buildReport(scanResult, config) {
  const { repos, totalCommits } = scanResult;
  const { authorEmail, authorName, since, until, windowHours } = config;

  // Determine display label for author filter
  let authorLabel;
  if (authorEmail) {
    authorLabel = authorEmail;
  } else if (authorName) {
    authorLabel = authorName;
  } else {
    authorLabel = '(all authors)';
  }

  const activeRepos   = repos.filter(r => r.active);
  const inactiveRepos = repos.filter(r => !r.active);

  return {
    generatedAt: new Date(),
    author: authorLabel,
    authorFiltered: !!(authorEmail || authorName),
    windowHours,
    since,
    until,
    totalCommits,
    activeRepos,
    inactiveRepos,
    allRepos: repos,
  };
}

/**
 * Render the report as a terminal-friendly string.
 *
 * @param {object} report  Output of buildReport()
 * @returns {string}
 */
function formatReport(report) {
  const lines = [];

  const dateLabel = report.generatedAt.toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });

  lines.push('');
  lines.push(`📊 STANDUP REPORT — ${dateLabel}`);
  lines.push('');
  lines.push(`   Generated : ${fmtDateTime(report.generatedAt)}`);
  lines.push(`   Author    : ${report.author}`);
  lines.push(`   Window    : Last ${report.windowHours}h (since ${fmtDateTime(report.since)})`);
  lines.push(`   Repos     : ${report.activeRepos.length} active, ${report.inactiveRepos.length} inactive`);
  lines.push('');
  lines.push('─'.repeat(60));

  if (report.totalCommits === 0 && report.allRepos.length === 0) {
    lines.push('');
    lines.push('  No git repositories found in the scanned paths.');
    lines.push('');
    return lines.join('\n');
  }

  if (report.totalCommits === 0) {
    lines.push('');
    const filterNote = report.authorFiltered
      ? ` by ${report.author}`
      : '';
    lines.push(`  No commits found${filterNote} in the last ${report.windowHours} hour(s).`);
    lines.push('');
  } else {
    // Group commits by date then by repo
    const byDate = {};
    for (const repo of report.activeRepos) {
      for (const commit of repo.commits) {
        const day = fmtDate(commit.date);
        if (!byDate[day]) byDate[day] = {};
        if (!byDate[day][repo.name]) byDate[day][repo.name] = [];
        byDate[day][repo.name].push(commit);
      }
    }

    const sortedDays = Object.keys(byDate).sort().reverse();
    const todayStr     = fmtDate(new Date());
    const yesterdayStr = fmtDate(new Date(Date.now() - 86400000));

    for (const day of sortedDays) {
      let dayLabel = day;
      if (day === todayStr)     dayLabel = `Today — ${day}`;
      if (day === yesterdayStr) dayLabel = `Yesterday — ${day}`;

      lines.push('');
      lines.push(`### ${dayLabel}`);

      for (const [repoName, commits] of Object.entries(byDate[day])) {
        lines.push('');
        lines.push(`  📁 ${repoName}`);
        for (const c of commits) {
          lines.push(`    \`${c.hash}\` ${fmtTime(c.date)}  ${c.message}`);
        }
      }
    }
    lines.push('');
  }

  // Inactive repos
  if (report.inactiveRepos.length > 0) {
    lines.push('─'.repeat(60));
    lines.push('');
    lines.push('⚠️  INACTIVE REPOS (no commits in window)');
    for (const r of report.inactiveRepos) {
      lines.push(`  • ${r.name}`);
    }
    lines.push('');
  }

  // Copy-paste standup template
  lines.push('─'.repeat(60));
  lines.push('');
  lines.push('📋 STANDUP TEMPLATE (copy-paste ready)');
  lines.push('');

  if (report.totalCommits === 0) {
    lines.push('  Yesterday: (no commits recorded)');
    lines.push('  Today    : ');
    lines.push('  Blockers : None');
  } else {
    const todayStr     = fmtDate(new Date());
    const yesterdayStr = fmtDate(new Date(Date.now() - 86400000));

    const todayCommits     = [];
    const yesterdayCommits = [];

    for (const repo of report.activeRepos) {
      for (const c of repo.commits) {
        const day = fmtDate(c.date);
        if (day === todayStr)     todayCommits.push({ repo: repo.name, ...c });
        if (day === yesterdayStr) yesterdayCommits.push({ repo: repo.name, ...c });
      }
    }

    lines.push('  Yesterday:');
    if (yesterdayCommits.length === 0) {
      lines.push('    (no commits)');
    } else {
      for (const c of yesterdayCommits) {
        lines.push(`    - [${c.repo}] ${c.message}`);
      }
    }
    lines.push('  Today:');
    if (todayCommits.length === 0) {
      lines.push('    (no commits yet)');
    } else {
      for (const c of todayCommits) {
        lines.push(`    - [${c.repo}] ${c.message}`);
      }
    }
    lines.push('  Blockers: None');
  }

  lines.push('');
  lines.push('─'.repeat(60));
  lines.push('  Built with AI by Craftpipe');
  lines.push('');

  return lines.join('\n');
}

module.exports = { buildReport, formatReport };
