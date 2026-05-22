---
name: openclaw-memory-tencentdb-setup
description: Use this to install, configure, and verify the @tencentdb-agent-memory/memory-tencentdb plugin in an OpenClaw environment. Trigger when the user mentions "install the memory plugin", "configure memory-tencentdb", "enable long-term memory/recall", or reports related errors.
version: 1.0.0
---

## Purpose

Provide OpenClaw with durable local long-term memory (L0→L1→L2→L3) without relying on an externally hosted memory service, and complete the full one-time loop from installation and configuration to acceptance verification.

## Applicable scenarios

- The user asks to install or enable `memory-tencentdb` in OpenClaw
- The user needs to configure recall, extraction, persona, cleanup, or related parameters
- The user reports "the plugin is installed but there is no memory / no recall / no vector search"

## Out-of-scope scenarios

- The user only wants an explanation of memory concepts and does not need a real deployment
- The user wants to integrate with a non-OpenClaw host (confirm the target framework first)

## Standard workflow

### 1) Environment precheck

First confirm the baseline versions:

- OpenClaw: `>= 2026.3.13`
- Node.js: `>= 22.16.0`

Run:

```bash
openclaw --version
node -v
```

If the versions do not meet the requirements, upgrade first before continuing.

### 2) Install the plugin

Run the installation command:

```bash
openclaw plugins install @tencentdb-agent-memory/memory-tencentdb
```

If it is already installed, update it instead:

```bash
openclaw plugins update memory-tencentdb
```

### 3) Write the minimal configuration

Edit `~/.openclaw/openclaw.json` and ensure it contains:

```json
{
  "memory-tencentdb": {
    "enabled": true
  }
}
```

Note: this plugin supports zero-config startup; it can run the basic capabilities without adding any other fields.

### 4) Add recommended configuration as needed (common in production)

Add the following groups based on the user's needs:

- `capture`: conversation capture and retention policy
- `extraction`: L1 extraction and deduplication
- `pipeline`: L1→L2→L3 scheduling
- `recall`: recall count, threshold, and strategy
- `persona`: scene and persona trigger parameters
- `embedding`: vector search configuration (remote OpenAI-compatible service)

Recommended template:

```json
{
  "memory-tencentdb": {
    "capture": {
      "enabled": true,
      "excludeAgents": [],
      "l0l1RetentionDays": 90,
      "cleanTime": "03:00"
    },
    "extraction": {
      "enabled": true,
      "enableDedup": true,
      "maxMemoriesPerSession": 10,
      "model": "provider/model"
    },
    "pipeline": {
      "everyNConversations": 5,
      "enableWarmup": true,
      "l1IdleTimeoutSeconds": 600,
      "l2DelayAfterL1Seconds": 10,
      "l2MinIntervalSeconds": 900,
      "l2MaxIntervalSeconds": 3600,
      "sessionActiveWindowHours": 24
    },
    "recall": {
      "enabled": true,
      "maxResults": 5,
      "scoreThreshold": 0.3,
      "strategy": "hybrid"
    },
    "persona": {
      "triggerEveryN": 50,
      "maxScenes": 15,
      "backupCount": 3,
      "sceneBackupCount": 10,
      "model": "provider/model"
    },
    "embedding": {
      "enabled": true,
      "provider": "openai",
      "baseUrl": "https://api.openai.com/v1",
      "apiKey": "${EMBEDDING_API_KEY}",
      "model": "text-embedding-3-small",
      "dimensions": 1536,
      "conflictRecallTopK": 5
    }
  }
}
```

### 5) Key configuration rules (avoid silent degradation)

- When `embedding.provider = "none"`, vector capabilities are disabled and only keyword search remains.
- If a remote `provider` is configured (such as `openai` / `deepseek`), all of the following must also be provided:
  - `apiKey`
  - `baseUrl`
  - `model`
  - `dimensions`
- If any of the above is missing, the plugin continues running but automatically degrades to non-vector mode.
- `l0l1RetentionDays`:
  - `0` means never clean up
  - non-`0` values should usually be `>=3`
  - if set to `1~2`, `allowAggressiveCleanup` must be explicitly enabled

### 6) Restart and verify that it takes effect

Run:

```bash
openclaw gateway restart
```

Checklist:

- Gateway logs contain the `[memory-tdai]` prefix
- The data directory has been created: `~/.openclaw/state/memory-tdai/`
- It contains at least: `conversations/`, `records/`, `scene_blocks/`, `vectors.db`

### 7) Functional smoke test

Run a minimal conversation loop and verify:

1. Have 2~3 consecutive turns and provide memorable information (preferences, constraints, background).
2. Start a new turn and check whether recalled context is injected.
3. In the Agent, call:
   - `tdai_memory_search`
   - `tdai_conversation_search`
4. Confirm that the newly generated content can be retrieved.

## Troubleshooting quick reference

- No plugin logs: check whether `memory-tencentdb.enabled` is `true` in `openclaw.json`, and confirm the Gateway was restarted.
- Records exist but no recall: check `recall.enabled` and whether `scoreThreshold` is too high.
- No vector results: check whether the `embedding` quartet (`apiKey/baseUrl/model/dimensions`) is complete.
- Cleanup is too aggressive and leaves too little history: check `l0l1RetentionDays` and `allowAggressiveCleanup`.
- Configuration changed but behavior did not: confirm you edited `~/.openclaw/openclaw.json`, then restart the Gateway again.

## Security and compliance constraints

- Treat `apiKey` as sensitive information; do not expose it in chat, logs, or screenshots.
- Prefer injecting secrets through environment variables; keep only placeholders in configuration examples.
- Modify only the `memory-tencentdb` configuration section, and avoid overwriting other user plugin configuration.

## Definition of Done

Before ending the task, all of the following must be true:

- The plugin install/update command succeeded
- `openclaw.json` contains valid `memory-tencentdb` configuration
- The Gateway has been restarted
- `[memory-tdai]` logs are visible
- The data directory and key files have been generated
- At least 1 search tool call successfully returned results

## Delivery wording template

You may tell the user after completion:

- Completed `memory-tencentdb` installation and configuration, and restarted the Gateway.
- Verified that logs and the data directory are active, and the memory pipeline is usable.
- For next-step optimization, tune `recall.scoreThreshold`, `pipeline.everyNConversations`, `persona.triggerEveryN`, and `embedding` model parameters.
