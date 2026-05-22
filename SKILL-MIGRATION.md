---
name: openclaw-memory-tencentdb-migration
description: Help existing users migrate the OpenClaw memory plugin from the old package @tdai/memory-tdai to the new package @tencentdb-agent-memory/memory-tencentdb. Trigger when the user mentions "plugin migration", "change the memory plugin package name", "memory-tdai upgrade", "package rename", or reports installation errors related to the old package.
version: 1.0.0
---

## Purpose

Help existing users who have installed `@tdai/memory-tdai` (old package name) migrate smoothly to `@tencentdb-agent-memory/memory-tencentdb` (new package name), ensuring existing memory data is preserved and configuration is fully restored.

## Background

- **Old package name**: `@tdai/memory-tdai` (plugin ID: `memory-tdai`)
- **New package name**: `@tencentdb-agent-memory/memory-tencentdb` (plugin ID: `memory-tencentdb`)
- The old and new plugins share the same data directory (`~/.openclaw/memory-tdai/`); uninstalling the old plugin **does not delete the data directory**, so existing memory data is unaffected
- Uninstalling the old plugin **does remove** that plugin's configuration section from `openclaw.json`, so it must be backed up first

## Applicable scenarios

- The user has installed `@tdai/memory-tdai` and needs to migrate to the new package name
- The user gets a 404 / not found error when running `openclaw plugins install @tdai/memory-tdai`
- The user has been told the old package is deprecated and needs to migrate

## Out-of-scope scenarios

- The user has never installed a memory plugin (use the `openclaw-memory-tencentdb-setup` skill instead)
- The user is using another memory plugin (such as `openclaw-mem0`)

## Standard workflow

### 1) Confirm current state

Confirm whether the old plugin is installed:

```bash
openclaw plugins list | grep -i memory
```

Expected: `memory-tdai` or `@tdai/memory-tdai` is in the loaded state.

If the old plugin is not shown, skip the migration process and use the `openclaw-memory-tencentdb-setup` skill for a fresh installation.

### 2) Back up existing configuration (critical step)

Uninstalling the old plugin removes its configuration section from `openclaw.json`. **You must back it up first**.

Run the following command to extract the old plugin configuration:

```bash
cat ~/.openclaw/openclaw.json | python3 -c "
import sys, json
cfg = json.load(sys.stdin)
plugins = cfg.get('plugins', {}).get('entries', {})
old_cfg = plugins.get('memory-tdai', {})
if old_cfg:
    print(json.dumps(old_cfg, indent=2, ensure_ascii=False))
    with open('/tmp/memory-tdai-config-backup.json', 'w') as f:
        json.dump(old_cfg, f, indent=2, ensure_ascii=False)
    print('\n✅ Configuration backed up to /tmp/memory-tdai-config-backup.json')
else:
    print('⚠️ memory-tdai configuration section not found (default configuration may be used)')
"
```

**Pay special attention to whether the following configuration exists; if present, it must be recorded**:

- `embedding` configuration (`provider`, `baseUrl`, `apiKey`, `model`, `dimensions`, `proxyUrl`)
- `extraction.model` (model used for extraction)
- `persona.model` (model used for persona generation)
- `capture.excludeAgents` (excluded agent list)
- `capture.l0l1RetentionDays` (data retention days)

### 3) Confirm the data directory exists

```bash
ls -la ~/.openclaw/memory-tdai/
```

Expected files/directories include: `conversations/`, `records/`, `scene_blocks/`, `vectors.db`, `persona.md`, and so on.

Record current data volume as the baseline for post-migration verification:

```bash
echo "=== Pre-migration data statistics ==="
wc -l ~/.openclaw/memory-tdai/conversations/*.jsonl 2>/dev/null || echo "No conversation data"
wc -l ~/.openclaw/memory-tdai/records/*.jsonl 2>/dev/null || echo "No record data"
ls ~/.openclaw/memory-tdai/scene_blocks/*.md 2>/dev/null | wc -l | xargs -I{} echo "Scene blocks: {} total"
wc -c ~/.openclaw/memory-tdai/persona.md 2>/dev/null || echo "No persona"
```

### 4) Uninstall the old plugin

```bash
openclaw plugins uninstall memory-tdai
```

After running it, confirm:

- The `memory-tdai` configuration section has been removed from `openclaw.json` (expected behavior)
- The `~/.openclaw/memory-tdai/` data directory **still exists** (it is not deleted)

```bash
# Verify that the data directory still exists
ls ~/.openclaw/memory-tdai/ && echo "✅ Data directory is intact" || echo "❌ Data directory is missing!"
```

### 5) Install the new plugin

```bash
openclaw plugins install @tencentdb-agent-memory/memory-tencentdb
```

### 6) Restore configuration

Write the configuration backed up in step 2 back to `openclaw.json`. Note that the new plugin's configuration key is `memory-tencentdb`:

```bash
python3 -c "
import json, os

# Read backup configuration
backup_path = '/tmp/memory-tdai-config-backup.json'
if os.path.exists(backup_path):
    with open(backup_path) as f:
        old_cfg = json.load(f)
    print('📋 Backed-up configuration contents:')
    print(json.dumps(old_cfg, indent=2, ensure_ascii=False))
else:
    old_cfg = {'enabled': True}
    print('⚠️ Backup not found; using minimal configuration')

# Read current openclaw.json
config_path = os.path.expanduser('~/.openclaw/openclaw.json')
with open(config_path) as f:
    cfg = json.load(f)

# Write new plugin configuration
cfg.setdefault('plugins', {}).setdefault('entries', {})['memory-tencentdb'] = old_cfg

with open(config_path, 'w') as f:
    json.dump(cfg, f, indent=2, ensure_ascii=False)

print('\n✅ Configuration written to memory-tencentdb')
"
```

If the backup is missing or the user needs to restore manually, at minimum ensure the minimal configuration is present:

```json
{
  "memory-tencentdb": {
    "enabled": true
  }
}
```

### 7) Restart the Gateway and verify

```bash
openclaw gateway restart
```

Checklist:

- Gateway logs contain the `[memory-tdai]` prefix (note: the log tag remains memory-tdai; this is normal)
- Data directory contents are unchanged

```bash
echo "=== Post-migration verification ==="
# Confirm the new plugin is loaded
openclaw plugins list | grep -i memory

# Confirm data volume matches the pre-migration baseline
wc -l ~/.openclaw/memory-tdai/conversations/*.jsonl 2>/dev/null
wc -l ~/.openclaw/memory-tdai/records/*.jsonl 2>/dev/null
```

### 8) Functional smoke verification

Run one conversation to confirm the memory pipeline works:

1. Send a message that contains personal information (such as preferences or habits)
2. Confirm the logs include output related to `[before_prompt_build]` and `[agent_end]`
3. If embedding is configured, confirm vector search works (no embedding errors in logs)

## Rollback plan

If issues occur after migration, roll back quickly:

```bash
# 1. Uninstall the new plugin
openclaw plugins uninstall memory-tencentdb

# 2. Reinstall the old plugin (if the npm source is still available)
openclaw plugins install @tdai/memory-tdai

# 3. Restore configuration manually (from backup)
# Write the contents of /tmp/memory-tdai-config-backup.json back to the memory-tdai section in openclaw.json

# 4. Restart
openclaw gateway restart
```

## Troubleshooting

| Symptom | Possible cause | Solution |
|------|----------|----------|
| No logs from the new plugin | `enabled` is not set to `true` in configuration | Check `memory-tencentdb.enabled` in `openclaw.json` |
| Error installing the new plugin | npm source unavailable | Check network / npm registry configuration |
| No historical memories after migration | Configuration restore is incomplete | Compare `/tmp/memory-tdai-config-backup.json` with the current configuration |
| embedding error | `apiKey` or related configuration is missing | Restore the `embedding` configuration section from the backup |
| Data directory is empty | Abnormal deletion during uninstall (very rare) | Check whether `~/.openclaw/memory-tdai/` exists |

## Security and compliance constraints

- Backup file `/tmp/memory-tdai-config-backup.json` may contain `apiKey`; delete it after migration: `rm /tmp/memory-tdai-config-backup.json`
- Do not display `apiKey` in chat or logs in plain text
- Modify only the `memory-tencentdb` configuration section; do not affect other user plugins

## Definition of Done

Migration is complete only when all of the following are true:

- [x] Old plugin `@tdai/memory-tdai` has been uninstalled
- [x] New plugin `@tencentdb-agent-memory/memory-tencentdb` has been installed and loaded
- [x] `openclaw.json` contains complete `memory-tencentdb` configuration (including user-customized embedding and related configuration)
- [x] Gateway has been restarted
- [x] Logs contain the `[memory-tdai]` prefix
- [x] Data directory is intact, and data volume matches the pre-migration baseline
- [x] At least 1 conversation has verified that the memory pipeline works
- [x] Sensitive information in the backup file has been cleaned up

## Delivery wording template

> Memory plugin migration completed:
> - Old plugin `@tdai/memory-tdai` → new plugin `@tencentdb-agent-memory/memory-tencentdb`
> - Existing memory data was fully preserved (conversations/records/scene blocks/vector database were unaffected)
> - Configuration was fully restored from the old plugin (including custom embedding / extraction / persona configuration)
> - Gateway was restarted, and the memory pipeline was verified successfully
