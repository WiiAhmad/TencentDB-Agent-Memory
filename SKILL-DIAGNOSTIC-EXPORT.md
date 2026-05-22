---
name: openclaw-diagnostic-export
description: Help users export on-site diagnostic data for OpenClaw + the memory-tencentdb (formerly memory-tdai) memory plugin for troubleshooting. Trigger when the user mentions "export diagnostic data", "export diagnostic", "on-site data", "troubleshooting", "export logs", "collect on-site data", or "package on-site data".
version: 1.0.0
---

## Purpose

Package OpenClaw logs, memory plugin data (L0~L3), and redacted configuration into a local archive that the user can manually send to the engineering team after confirming it is safe to share.

> **Naming note**: The plugin has been renamed from `@tdai/memory-tdai` to `@tencentdb-agent-memory/memory-tencentdb`, but the data directory remains `~/.openclaw/memory-tdai/` (hard-coded in code). In this skill, every reference to the `memory-tdai` directory means the actual data directory path, independent of the plugin ID.

## Export workflow

### Step 1: Confirm the environment

Before exporting, first confirm that the OpenClaw working directory exists and is accessible:

```bash
# Detect working directory (priority: environment variable > ~/.openclaw > ~/.clawdbot)
OPENCLAW_DIR="${OPENCLAW_STATE_DIR:-$HOME/.openclaw}"
[ -d "$OPENCLAW_DIR" ] || OPENCLAW_DIR="$HOME/.clawdbot"
ls -la "$OPENCLAW_DIR/" 2>/dev/null && echo "✅ Found: $OPENCLAW_DIR" || echo "❌ OpenClaw working directory not found"
```

Confirm that the memory-tdai subdirectory exists:

```bash
ls -la "$OPENCLAW_DIR/memory-tdai/" 2>/dev/null
```

### Step 2: Run the export script

Run the export script under the project's `scripts/` directory:

```bash
bash scripts/export-diagnostic.sh
```

> The script is located at `scripts/export-diagnostic.sh` in this project. If you run it through `pnpm` or another method, ensure the working directory is the project root.

By default, the script writes the archive to `~/Downloads/openclaw-diagnostic-<timestamp>.tar.gz`.

To specify another output directory:

```bash
bash scripts/export-diagnostic.sh /tmp
```

### Step 3: Confirm the export result

After the script finishes, check the output:

1. **Confirm the archive was generated** — the script prints the archive path and size at the end
2. **Tell the user what it contains**:

| File/directory | Contents | Privacy risk |
|-----------|------|---------|
| `env-info.txt` | System version, OpenClaw version, directory structure, disk usage | Low |
| `logs/` | OpenClaw gateway logs + rolling logs (last 3 days, up to 5000 lines per file) | Low |
| `memory-tdai/` | Full memory plugin data: L0 conversations, L1 memories, L2 scenes, L3 persona, SQLite database, checkpoint | **High** — contains raw user conversations |
| `openclaw-config-redacted.json` | Redacted configuration (API Key/Token/Password/Secret removed; models/channels/env replaced as whole sections) | Low |
| `plugins-info.txt` | Installed plugin list and versions | Low |

3. **Remind the user**:
   - The configuration file has been automatically redacted; sensitive values such as API Key and Token have been replaced with `***REDACTED***`
   - **Memory data (`memory-tdai/`) contains raw user conversations**; send it only after confirming it can be shared
   - The archive is stored locally and **is not uploaded automatically**; the user must send it to the engineering team manually

### Step 4: Tell the user the next steps

After export completes, tell the user:

1. The archive has been saved locally (print the exact path)
2. Please inspect the contents and manually send it to the engineering team via WeCom/email or another agreed channel
3. If only part of the data is needed (for example, only logs or only configuration), unzip it and send selectively

## Export contents in detail

### OpenClaw log locations

| Log type | Path | Description |
|---------|------|------|
| Gateway stdout | `~/.openclaw/logs/gateway.log` | Standard output from the gateway daemon |
| Gateway stderr | `~/.openclaw/logs/gateway.err.log` | Error output from the gateway daemon |
| Rolling logs | `/tmp/openclaw/openclaw-YYYY-MM-DD.log` | Date-based rolling logs, JSON Lines format, automatically cleaned after 24h |
| Configuration audit | `~/.openclaw/logs/config-audit.jsonl` | Configuration write audit records |
| Command logs | `~/.openclaw/logs/commands.log` | Command event logs (optional hook) |

### Memory plugin data structure

```
~/.openclaw/memory-tdai/
├── conversations/          — L0 raw conversations (daily JSONL shards)
├── records/                — L1 structured memories (daily JSONL shards)
├── scene_blocks/           — L2 scene Markdown files
├── persona.md              — L3 user profile
├── vectors.db              — SQLite database (vectors + full-text index)
├── .metadata/              — checkpoint, scene_index.json
└── .backup/                — rolling backups
```

### Configuration redaction rules

The export script redacts `openclaw.json` as follows:

| Rule | Handling |
|------|---------|
| Field name matches `apiKey/token/password/secret/credential` and value is a string | Replace with `***REDACTED(Nchars)***` |
| SecretRef object (contains source/provider/id) | Replace id with `***REDACTED***` |
| Top-level `models`, `secrets`, `channels`, and `env` blocks | Replace the whole section with `***REDACTED_SECTION***` |
| token/password under `gateway.auth` | Replace with `***REDACTED***` |
| Other fields (including full `plugins` configuration) | **Preserve as-is** (plugin configuration is critical for troubleshooting) |

## Manual export (fallback when the script is unavailable)

If the export script cannot run (for example, Node.js is unavailable), collect data manually as follows:

```bash
# 1. Create export directory
EXPORT_DIR=~/Downloads/openclaw-diagnostic-$(date +%Y%m%d-%H%M%S)
mkdir -p "$EXPORT_DIR"

# 2. Copy logs
cp -r ~/.openclaw/logs/ "$EXPORT_DIR/logs/" 2>/dev/null
cp /tmp/openclaw/openclaw-$(date +%Y-%m-%d).log "$EXPORT_DIR/" 2>/dev/null

# 3. Copy memory plugin data
cp -r ~/.openclaw/memory-tdai/ "$EXPORT_DIR/memory-tdai/" 2>/dev/null

# 4. Manually redact configuration (must manually delete sensitive fields!)
# Copy the configuration, then use an editor to remove models/secrets/channels blocks and all apiKey/token values
cp ~/.openclaw/openclaw.json "$EXPORT_DIR/openclaw-config-NEEDS-MANUAL-REDACTION.json"

# 5. Package
cd ~/Downloads && tar -czf "$EXPORT_DIR.tar.gz" "$(basename $EXPORT_DIR)"

echo "⚠️ Be sure to manually inspect and remove sensitive information from the configuration before sending!"
```

## Common troubleshooting clues

After diagnostic data is exported, the engineering team usually focuses on the following areas:

| Investigation area | File to inspect | Key information |
|---------|---------|---------|
| Whether the plugin loaded | Search `logs/` for `[memory-tdai]` | Plugin registration and configuration parsing logs (note: the log tag remains `[memory-tdai]`, independent of plugin ID) |
| Whether memory recall works | Search `logs/` for `[recall]` | Search strategy, latency, hit count |
| Whether L1 extraction triggered | Search `logs/` for `[pipeline]` | Scheduling trigger, L1/L2/L3 execution state |
| Whether vector search is available | `plugins.entries` in `openclaw-config-redacted.json` | Whether embedding configuration is correct |
| Data volume / disk usage | `env-info.txt` | du output, file counts |
| checkpoint state | `memory-tdai/.metadata/recall_checkpoint.json` | Progress, cursor, counters |
