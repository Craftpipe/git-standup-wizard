# git-standup-wizard

A CLI tool that automatically generates daily standup reports by scanning your local git repositories. Perfect for developers who can't remember what they worked on yesterday.

## What It Does

- **Scans multiple repositories** from a root directory
- **Extracts commits** within a configurable time window
- **Filters by author** (optional — omit to see commits from all authors)
- **Groups commits** by project and date for easy reading
- **Generates formatted reports** showing work from yesterday, today, and flagged inactive repos
- **Outputs a copy-paste standup template** so you can paste directly into Slack/Teams
- **Exports to markdown file** for sharing with your team

## Installation

```bash
npm install -g git-standup-wizard
```

Or install locally in your project:

```bash
npm install --save-dev git-standup-wizard
```

## Usage

### Basic Usage — No Arguments Required

```bash
git-standup-wizard
```

Scans all git repos in the current directory and displays a standup report for **all authors** over the last 24 hours. No configuration needed.

### Specify Root Directory

```bash
git-standup-wizard --root ~/projects
```

### Filter by Author Email (optional)

```bash
git-standup-wizard --author "your.email@example.com"
```

When `--author` is omitted, commits from **all authors** are included.

### Custom Time Window

```bash
git-standup-wizard --window 48
```

### Output to File

```bash
git-standup-wizard --output standup.md
```

### Combined Example

```bash
git-standup-wizard --repos ~/projects --author "dev@example.com" --window 24 --output report.md
```

## Options

| Flag | Short | Description | Default |
|------|-------|-------------|---------|
| `--repos <paths...>` | `-r` | Root directory/directories to scan for repos | Current directory |
| `--author <email>` | `-a` | Filter commits by author email (optional) | All authors |
| `--name <name>` | `-n` | Filter commits by author name (optional) | All authors |
| `--window <hours>` | `-w` | Hours to look back | `24` |
| `--output <path>` | `-o` | Save report to markdown file | Print to terminal |
| `--max-depth <n>` | | Max directory depth for repo discovery | `2` |
| `--include-merges` | | Include merge commits | Excluded |
| `--config <path>` | `-c` | Path to `.env` file or directory containing one | Auto-detected |
| `--verbose` | `-v` | Enable verbose logging | Off |
| `--help` | | Show help message | — |
| `--version` | | Show version | — |

## Environment Variables

You can configure the tool via a `.env` file in your project root or via shell environment variables:

| Variable | Description | Default |
|----------|-------------|---------|
| `STANDUP_AUTHOR_EMAIL` | Author email filter (optional) | All authors |
| `STANDUP_AUTHOR_NAME` | Author name filter (optional) | All authors |
| `STANDUP_REPO_PATHS` | Comma-separated paths to scan | Current directory |
| `STANDUP_WINDOW_HOURS` | Hours to look back | `24` |
| `STANDUP_MAX_DEPTH` | Max directory scan depth | `2` |
| `STANDUP_OUTPUT_PATH` | Path to write markdown report | — |
| `STANDUP_INCLUDE_MERGES` | Set to `true` to include merge commits | `false` |

See `examples/sample.env` for a ready-to-copy template.

## Output Example

```
📊 STANDUP REPORT — Monday, December 15, 2024

   Generated : 2024-12-15 09:02
   Author    : (all authors)
   Window    : Last 24h (since 2024-12-14 09:02)
   Repos     : 3 active, 1 inactive

────────────────────────────────────────────────────────────

### Today — 2024-12-15

  📁 project-alpha
    `a1b2c3d` 08:47  feat: add rate limiting middleware
    `e4f5a6b` 08:15  fix: correct JWT expiry check

  📁 project-beta
    `7c8d9e0` 07:58  chore: upgrade dependencies

────────────────────────────────────────────────────────────

⚠️  INACTIVE REPOS (no commits in window)
  • legacy-service

────────────────────────────────────────────────────────────

📋 STANDUP TEMPLATE (copy-paste ready)

  Yesterday:
    - [project-alpha] refactor: extract auth helpers
  Today:
    - [project-alpha] feat: add rate limiting middleware
    - [project-alpha] fix: correct JWT expiry check
    - [project-beta] chore: upgrade dependencies
  Blockers: None
```

## FAQ

**Do I need to configure anything before running?**  
No. Run `git-standup-wizard` with no arguments in any directory that contains git repositories and it will work immediately, showing commits from all authors.

**How do I filter to just my commits?**  
Pass your email: `git-standup-wizard --author you@example.com`

**Can I scan multiple directories?**  
Yes: `git-standup-wizard -r ~/projects/frontend ~/projects/backend`

**How deep does it scan for repos?**  
By default 2 levels deep. Increase with `--max-depth 4`.

**Can I save the report as a file?**  
Yes: `git-standup-wizard --output standup.md` — this writes a formatted markdown file while still printing to the terminal.

**Where do I put my `.env` file?**  
In the directory where you run the command, or any parent directory. The tool walks up the tree to find it automatically.

## License

MIT — see [LICENSE](LICENSE)

---

*Built with AI by Craftpipe — support@heijnesdigital.com*
