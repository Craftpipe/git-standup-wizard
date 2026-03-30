'use strict';

const fs   = require('fs');
const path = require('path');

/**
 * Format a Date as YYYY-MM-DD.
 */
function fmtDate(d) {
  return d.toISOString().slice(0, 10);
}

/**
 * Format a Date as YYYY-MM-DD HH:MM.
 */
function fmtDateTime(d) {
  return d.toISOString().slice(0, 16).replace('T', ' ');
}

/**
 * Format a Date as HH:MM.
 */
function fmtTime(d) {
  return d.toISOString().slice(11, 16);
}

/**
 * Export a structured report as a markdown file.
 *
 * @param {object} report   Output of buildReport()
 * @param {string} outPath  Destination file path
 */
function exportMarkdown(report, outPath) {
  const lines = [];

  const dateLabel = report.generatedAt.toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });

  lines.push(`# Standup Report — ${dateLabel}`);
  lines.push('');
  lines.push(`**Generated:** ${fmtDateTime(report.generatedAt)}  `);
  lines.push(`**Author:** ${report.author}  `);
  lines.push(`**Window:** Last ${report.windowHours}h (since ${fmtDateTime(report.since)})  `);
  lines.push(`**Repositories scanned:** ${report.activeRepos.length} active, ${report.inactiveRepos.length} inactive`);
  lines.push('');
  lines.push('---');
  lines.push('');

  // Summary table
  lines.push('## Summary');
  lines.push('');
  lines.push('| Metric | Value |');
  lines.push('|--------|-------|');
  lines.push(`| Total commits | ${report.totalCommits} |`);
  lines.push(`| Active repositories | ${report.activeRepos.length} |`);
  lines.push(`| Inactive repositories | ${report.inactiveRepos.length} |`);
  lines.push(`| Date range | ${fmtDate(report.since)} → ${fmtDate(report.until)} |`);
  lines.push('');
  lines.push('---');
  lines.push('');

  if (report.totalCommits === 0) {
    const filterNote = report.authorFiltered ? ` by ${report.author}` : '';
    lines.push(`*No commits found${filterNote} in the last ${report.windowHours} hour(s).*`);
    lines.push('');
  } else {
    // Activity by date
    lines.push('## Activity by Date');
    lines.push('');

    const byDate = {};
    for (const repo of report.activeRepos) {
      for (const commit of repo.commits) {
        const day = fmtDate(commit.date);
        if (!byDate[day]) byDate[day] = {};
        if (!byDate[day][repo.name]) byDate[day][repo.name] = [];
        byDate[day][repo.name].push(commit);
      }
    }

    const todayStr     = fmtDate(new Date());
    const yesterdayStr = fmtDate(new Date(Date.now() - 86400000));
    const sortedDays   = Object.keys(byDate).sort().reverse();

    for (const day of sortedDays) {
      let dayLabel = day;
      if (day === todayStr)     dayLabel = `Today — ${day}`;
      if (day === yesterdayStr) dayLabel = `Yesterday — ${day}`;

      lines.push(`### ${dayLabel}`);
      lines.push('');

      for (const [repoName, commits] of Object.entries(byDate[day])) {
        lines.push(`#### 📁 ${repoName}`);
        lines.push('');
        lines.push('| Hash | Time | Message |');
        lines.push('|------|------|---------|');
        for (const c of commits) {
          lines.push(`| \`${c.hash}\` | ${fmtTime(c.date)} | ${c.message} |`);
        }
        lines.push('');
      }

      lines.push('---');
      lines.push('');
    }

    // Activity by project
    lines.push('## Activity by Project');
    lines.push('');

    for (const repo of report.activeRepos) {
      lines.push(`### ${repo.name}`);
      lines.push('');
      for (const c of repo.commits) {
        lines.push(`- \`${c.hash}\` — **${c.message}** *(${fmtDateTime(c.date)})*`);
      }
      lines.push('');
    }

    lines.push('---');
    lines.push('');
  }

  // Inactive repos
  if (report.inactiveRepos.length > 0) {
    lines.push('## Inactive Repositories');
    lines.push('');
    lines.push('These repositories had no commits in the reporting window:');
    lines.push('');
    for (const r of report.inactiveRepos) {
      lines.push(`- ${r.name}`);
    }
    lines.push('');
    lines.push('---');
    lines.push('');
  }

  // Standup template
  lines.push('## Copy-Paste Standup Template');
  lines.push('');

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

  lines.push('**Yesterday:**');
  if (yesterdayCommits.length === 0) {
    lines.push('- (no commits)');
  } else {
    for (const c of yesterdayCommits) {
      lines.push(`- [${c.repo}] ${c.message}`);
    }
  }
  lines.push('');
  lines.push('**Today:**');
  if (todayCommits.length === 0) {
    lines.push('- (no commits yet)');
  } else {
    for (const c of todayCommits) {
      lines.push(`- [${c.repo}] ${c.message}`);
    }
  }
  lines.push('');
  lines.push('**Blockers:** None');
  lines.push('');
  lines.push('---');
  lines.push('');
  lines.push('*Built with AI by Craftpipe*');

  const resolved = path.resolve(outPath);
  fs.mkdirSync(path.dirname(resolved), { recursive: true });
  fs.writeFileSync(resolved, lines.join('\n'), 'utf8');
}

module.exports = { exportMarkdown };
