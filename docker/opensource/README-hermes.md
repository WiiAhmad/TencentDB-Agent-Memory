# Hermes + TDAI Memory — Unified Open-Source Image

Hermes Agent and the TDAI Memory plugin are preinstalled, so a single container runs both services together.
You only need to configure one API key to enable Hermes conversations plus the four-layer memory system.

## Architecture

```
┌──────────────────────────────────────────────────────┐
│                  Inside the container                │
│                                                      │
│  ┌──────────────────────┐    ┌─────────────────────┐ │
│  │  Hermes Agent        │    │  TDAI Memory        │ │
│  │  (Python)            │───▶│  Gateway (Node.js)  │ │
│  │                      │HTTP│  :8420              │ │
│  │  memory_tencentdb    │    │                     │ │
│  │  plugin (built in)   │    │  Local SQLite store │ │
│  └──────────────────────┘    └─────────────────────┘ │
│                                                      │
│  Unified model config (Hermes + TDAI share one set  │
│  of MODEL_* variables)                              │
└──────────────────────────────────────────────────────┘
```

## Quick start

```bash
# Build (does not depend on project source code; can be run from any directory)
docker build -f Dockerfile.hermes -t hermes-memory .

# Run (stays in the background; Gateway starts automatically)
docker run -d \
  --name hermes-memory \
  --restart unless-stopped \
  -p 8420:8420 \
  -e MODEL_API_KEY="your-api-key" \
  -e MODEL_BASE_URL="https://api.lkeap.cloud.tencent.com/v1" \
  -e MODEL_NAME="deepseek-v3.2" \
  -e MODEL_PROVIDER="custom" \
  -v hermes_data:/opt/data \
  hermes-memory

# Verify the Gateway
curl http://localhost:8420/health

# Enter a Hermes conversation
docker exec -it hermes-memory hermes
```

> The image includes default values for Tencent Cloud DeepSeek-V3.2. If you are using that model, you can omit `MODEL_BASE_URL` / `MODEL_NAME` / `MODEL_PROVIDER` and pass only `MODEL_API_KEY`.

## How it works

When the container starts (`CMD`), it automatically performs these steps:

1. Sync `MODEL_*` environment variables to the Gateway (`export TDAI_LLM_*`)
2. Generate `/opt/data/config.yaml` (Hermes config, including model parameters and `memory.provider: memory_tencentdb`)
3. Generate `/opt/data/.env` (writes `OPENAI_API_KEY` for Hermes to read)
4. Start the TDAI Memory Gateway in the foreground (Node.js, listens on :8420, keeps the container alive)

When you enter a conversation with `docker exec -it hermes-memory hermes`, Hermes reads the config files above from `$HERMES_HOME` (`/opt/data`) and automatically connects to the running Gateway. The `memory_tencentdb` plugin communicates with the local Gateway over HTTP to handle conversation capture, memory extraction, scene construction, and persona generation through the four-layer L0→L1→L2→L3 pipeline.

## Environment variables

### Unified model configuration (shared by Hermes + TDAI)

| Variable | Default | Description |
|------|--------|------|
| `MODEL_API_KEY` | - | LLM API key (**required; pass it at runtime with `-e`**) |
| `MODEL_BASE_URL` | `https://api.lkeap.cloud.tencent.com/v1` | LLM API endpoint |
| `MODEL_NAME` | `deepseek-v3.2` | Model name |
| `MODEL_PROVIDER` | `custom` | Model provider: custom/openrouter/anthropic/openai/gemini |

Users only need to configure the `MODEL_*` variables above. At container startup they are automatically synced to Hermes (`config.yaml` + `.env`) and the Gateway (`TDAI_LLM_*` environment variables).

### Service configuration

| Variable | Default | Description |
|------|--------|------|
| `TDAI_GATEWAY_PORT` | `8420` | Gateway port |
| `TDAI_GATEWAY_HOST` | `0.0.0.0` | Gateway bind address |
| `TDAI_DATA_DIR` | `/opt/data/tdai-memory` | Memory data directory |
| `HERMES_HOME` | `/opt/data` | Hermes data directory |

## Data persistence

All data is stored in the `/opt/data` volume:

```
/opt/data/
├── tdai-memory/          # TDAI memory data (SQLite + scene files)
│   ├── memories.sqlite   # L0/L1 data
│   ├── scene_blocks/     # L2 scene files
│   ├── persona.md        # L3 persona
│   └── checkpoint.json   # Pipeline state
├── sessions/             # Hermes session history
├── skills/               # Hermes skills
├── config.yaml           # Hermes config (generated automatically at startup)
├── .env                  # Environment variables (generated automatically at startup)
└── gateway.log           # Gateway logs
```

## Troubleshooting

```bash
# View Gateway logs
docker exec hermes-memory cat /opt/data/tdai-memory/gateway.log

# Check Gateway health
docker exec hermes-memory curl -s http://localhost:8420/health | python3 -m json.tool

# Manually test memory recall
docker exec hermes-memory curl -s -X POST http://localhost:8420/recall \
  -H "Content-Type: application/json" \
  -d '{"query":"test","session_key":"debug"}'

# View the generated Hermes config
docker exec hermes-memory cat /opt/data/config.yaml

# View environment variable sync results
docker exec hermes-memory env | grep -E '(MODEL_|TDAI_LLM_)'

# Enter the container for debugging
docker exec -it hermes-memory bash
```

## Build notes

The Dockerfile does not depend on copying local source code and does not depend on the root user:

- **TDAI Memory Gateway**: fetched from the npm registry via `npm install @tencentdb-agent-memory/memory-tencentdb@latest`
- **Hermes Agent**: fetched from GitHub via the official install script and installed to `/usr/local/lib/hermes-agent/`
- **memory_tencentdb plugin**: the npm package already includes the `hermes-plugin/` directory, which is automatically symlinked during the build into Hermes's built-in plugin path (`/usr/local/lib/hermes-agent/plugins/memory/`)

All runtime paths inside the container are absolute paths and do not depend on `$HOME` or a specific user, so the image can run as a non-root user.
