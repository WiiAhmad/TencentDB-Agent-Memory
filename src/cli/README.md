# memory-tdai CLI

The `openclaw memory-tdai` command namespace provides offline data management tools.

## Runtime support

The offline CLI workflows in this repository are supported in both environments:

- Node 22 + npm
- Bun via the explicit `bun:*` package scripts

## seed — Import historical conversation data

Import a historical conversation JSON file into the memory pipeline and run the full L0→L1→L2→L3 flow. This is useful for:

- Loading existing conversation data into the memory system
- Batch-testing memory extraction quality
- Migrating or restoring memory data

### Usage

```bash
openclaw memory-tdai seed --input <file> [options]
```

### Parameters

| Parameter | Required | Description |
|------|------|------|
| `--input <file>` | ✅ | Path to the input JSON file |
| `--output-dir <dir>` | — | Output directory (defaults to an auto-generated timestamped directory) |
| `--session-key <key>` | — | Fallback session key (used when the input data is missing one) |
| `--config <file>` | — | Config override file (JSON, deep-merged with the plugin config in `openclaw.json`) |
| `--strict-round-role` | — | Strictly validate that each conversation round contains both `user` and `assistant` messages |
| `--yes` | — | Skip interactive confirmation prompts (such as auto-filling timestamps) |

### Examples

```bash
# Basic usage
openclaw memory-tdai seed --input conversations.json

# Specify an output directory
openclaw memory-tdai seed --input data.json --output-dir ./seed-output

# Use a custom config override (for example, to tune pipeline parameters)
openclaw memory-tdai seed --input data.json --config seed-config.json

# Skip all confirmations
openclaw memory-tdai seed --input data.json --yes

# Strict mode + custom configuration
openclaw memory-tdai seed --input data.json --config seed-config.json --strict-round-role --yes
```

### Input file formats

Two JSON formats are supported:

#### Format A: Object wrapper

```json
{
  "sessions": [
    {
      "sessionKey": "user-alice",
      "sessionId": "conv-001",
      "conversations": [
        [
          { "role": "user", "content": "Hello", "timestamp": 1711929600000 },
          { "role": "assistant", "content": "Hello! How can I help you?", "timestamp": 1711929601000 }
        ],
        [
          { "role": "user", "content": "How's the weather today?" },
          { "role": "assistant", "content": "It's sunny today, a great day to go out." }
        ]
      ]
    }
  ]
}
```

#### Format B: Top-level array

```json
[
  {
    "sessionKey": "user-alice",
    "conversations": [
      [
        { "role": "user", "content": "Hello" },
        { "role": "assistant", "content": "Hello!" }
      ]
    ]
  }
]
```

#### Field descriptions

| Field | Type | Required | Description |
|------|------|------|------|
| `sessionKey` | string | ✅ | Session identifier (for example, a user ID or channel name) |
| `sessionId` | string | — | Session instance ID (a single `sessionKey` may contain multiple `sessionId` values) |
| `conversations` | message[][] | ✅ | Array of conversation rounds, where each round is a group of messages |
| `role` | string | ✅ | Message role: `user` or `assistant` |
| `content` | string | ✅ | Message content |
| `timestamp` | number \| string | — | Timestamp: epoch milliseconds or an ISO 8601 string. If omitted, `seed` will prompt to auto-fill it |

### Config overrides

`--config` accepts a JSON file and performs a **two-level deep merge** with the plugin config in `openclaw.json`:

- If both top-level keys are objects → shallow-merge them, preserving unoverridden fields from the base config
- For all other value types → replace directly

A common use case is making the pipeline more aggressive during `seed` to speed up processing:

```json
{
  "pipeline": {
    "everyNConversations": 3,
    "enableWarmup": false,
    "l1IdleTimeoutSeconds": 2,
    "l2DelayAfterL1Seconds": 1,
    "l2MinIntervalSeconds": 1,
    "l2MaxIntervalSeconds": 10
  }
}
```

If you need to seed into an isolated TCVDB database:

```json
{
  "storeBackend": "tcvdb",
  "tcvdb": {
    "database": "my_seed_test_db"
  },
  "pipeline": {
    "everyNConversations": 3,
    "enableWarmup": false,
    "l1IdleTimeoutSeconds": 2
  }
}
```

### Output directory structure

```
<output-dir>/
├── conversations/          — L0 JSONL files
├── records/                — L1 JSONL files
├── scene_blocks/           — L2 scene blocks
├── vectors.db              — SQLite vector database (sqlite backend only)
├── .metadata/
│   ├── manifest.json       — Metadata (store binding + seed run record)
│   └── checkpoint.json     — Pipeline progress
└── .backup/                — Rolling backups
```

After seed completes, `manifest.json` records the run details:

```json
{
  "version": 1,
  "createdAt": "2026-04-01T22:00:00.000Z",
  "store": {
    "type": "sqlite",
    "sqlite": { "path": "vectors.db" }
  },
  "seed": {
    "inputFile": "conversations.json",
    "sessions": 3,
    "rounds": 42,
    "messages": 128,
    "startedAt": "2026-04-01T22:00:00.000Z",
    "completedAt": "2026-04-01T22:05:30.000Z"
  }
}
```
