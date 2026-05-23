# memory-tencentdb-ctl.sh — memory_tencentdb Operations Script

> Use this together with [`install_hermes_memory_tencentdb.sh`](./install_hermes_memory_tencentdb.sh).
> First run the install script to deploy the plugin and Node dependencies. After that, use `memory-tencentdb-ctl.sh` for all routine start/stop and configuration tasks.

## 1. Operating modes

The script supports two modes. **Standalone mode is the default** and does not touch `~/.hermes` at all:

| Mode | How to activate | What it does | What it does not do |
|---|---|---|---|
| `standalone` (default) | No arguments required | Starts/stops the Gateway; writes `$TDAI_DATA_DIR/tdai-gateway.json`; stores logs under `$TDAI_DATA_DIR/logs/` | Does not write `$HERMES_HOME/env.d/`, does not modify `$HERMES_HOME/config.yaml`, and does not read Hermes-related env vars |
| `hermes` | Add `--hermes` on the command line, or set `MEMORY_TENCENTDB_MODE=hermes` in the environment | Everything from standalone mode, plus `config llm` also writes `$HERMES_HOME/env.d/memory-tencentdb-llm.sh`; stores logs under `$HERMES_HOME/logs/memory_tencentdb/`; enables the `enable-hermes-memory` subcommand | — |

> **Why does Hermes mode write an extra env file?**
> Because Hermes starts the Gateway as a supervisor-managed child process and passes it an inherited environment with `os.environ.copy()`. In that setup, the Gateway does not read your interactive shell session directly, so Hermes must `source` `$HERMES_HOME/env.d/*.sh` to pass the required credentials through. In standalone mode, the Gateway reads `tdai-gateway.json` on its own, so no extra env file is needed.

## 2. Paths

> **Path variable convention**: This section and all examples below use `$HERMES_HOME` to refer to the Hermes home directory. The default is **`~/.hermes`**, but you can override it with an environment variable (for example, `export HERMES_HOME=/srv/hermes`). Both the script and Hermes itself honor this variable.
>
> Since 0.4.x, all TDAI-related data and code are stored under a single root directory, `$MEMORY_TENCENTDB_ROOT` (default: `~/.memory-tencentdb`):
>
> - `$TDAI_INSTALL_DIR` defaults to `$MEMORY_TENCENTDB_ROOT/tdai-memory-openclaw-plugin` (that is, `~/.memory-tencentdb/tdai-memory-openclaw-plugin`)
> - `$TDAI_DATA_DIR` defaults to `$MEMORY_TENCENTDB_ROOT/memory-tdai` (that is, `~/.memory-tencentdb/memory-tdai`)
>
> Whenever these variables appear below, you can override them globally by exporting the value first and then running the command.
> Older versions used `~/tdai-memory-openclaw-plugin` and `~/memory-tdai`; `install_hermes_memory_tencentdb.sh` automatically migrates those legacy directories to the new locations during upgrade.

| Path | standalone | hermes | Purpose |
|---|---|---|---|
| `$TDAI_INSTALL_DIR` | ✅ | ✅ | Plugin source + `node_modules` + `src/gateway/server.ts` |
| `$TDAI_DATA_DIR/tdai-gateway.json` | ✅ | ✅ | Main Gateway config: `llm` / `memory.embedding` / `memory.tcvdb` / `memory.storeBackend`, mode `0600` |
| `$TDAI_DATA_DIR/logs/` | ✅ logs | — | `gateway.stdout.log` / `gateway.stderr.log` / `gateway.pid` |
| `$HERMES_HOME/logs/memory_tencentdb/` | — | ✅ logs | Same files as above, just in a different directory |
| `$HERMES_HOME/env.d/memory-tencentdb-llm.sh` | — | ✅ | Sourced before Hermes starts to inject LLM credentials into the supervisor-managed Gateway child process |
| `$HERMES_HOME/config.yaml` | — | ✅ | `enable-hermes-memory` updates its `memory.provider` |
| Gateway listener | `127.0.0.1:8420` | `127.0.0.1:8420` | Can be overridden with `MEMORY_TENCENTDB_GATEWAY_HOST/PORT` |

All paths can be overridden with environment variables of the same names. Listed again here for quick reference: `MEMORY_TENCENTDB_ROOT` (default `~/.memory-tencentdb`), `TDAI_INSTALL_DIR` (default `$MEMORY_TENCENTDB_ROOT/tdai-memory-openclaw-plugin`), `TDAI_DATA_DIR` (default `$MEMORY_TENCENTDB_ROOT/memory-tdai`), `HERMES_HOME` (default `~/.hermes`), `MEMORY_TENCENTDB_LOG_DIR`, and `MEMORY_TENCENTDB_GATEWAY_HOST/PORT`.

Dependencies: `bash`, `python3`, `node >= 22`, `npx`, and either `lsof` or `ss`.

## 3. Installation & invocation

The script is published inside the npm package under `node_modules/.../scripts/`, but it is **not** registered as a `bin` command. If you want to invoke it by a global command name, you must create a symlink yourself.

### 3.1 Run directly from the npm package (no setup required)

```bash
npm install @tencentdb-agent-memory/memory-tencentdb

# Installed within a project; compute the path dynamically with npm root
"$(npm root)/@tencentdb-agent-memory/memory-tencentdb/scripts/memory-tencentdb-ctl.sh" --help

# For a global install, use npm root -g instead
"$(npm root -g)/@tencentdb-agent-memory/memory-tencentdb/scripts/memory-tencentdb-ctl.sh" --help
```

`npm root` / `npm root -g` returns the correct directory for all package managers (npm / pnpm / yarn) and different prefix configurations, so you do not have to hardcode a `node_modules/` path. This is ideal for one-off or temporary use.

### 3.2 Symlink into PATH (recommended for ops / long-term use)

No matter where the script comes from (a git-cloned repository, an npm-installed package, or a custom deployment directory), first compute the script path into a variable, then create the symlink from there. That way, you do not need to care whether the repository lives under `~/code/`, `/opt/`, or somewhere else.

```bash
# Step 1: locate the real path of memory-tencentdb-ctl.sh (choose any source)

# (a) From a git repository (run from the repo root or any subdirectory)
SCRIPT="$(git -C "$(git rev-parse --show-toplevel)" ls-files | \
          grep -E 'scripts/memory-tencentdb-ctl\.sh$' | head -1)"
SCRIPT="$(git rev-parse --show-toplevel)/$SCRIPT"

# (b) From a package installed globally with npm
SCRIPT="$(npm root -g)/@tencentdb-agent-memory/memory-tencentdb/scripts/memory-tencentdb-ctl.sh"

# (c) From a project's local node_modules
SCRIPT="$(npm root)/@tencentdb-agent-memory/memory-tencentdb/scripts/memory-tencentdb-ctl.sh"

# (d) A fully handwritten absolute path (for example, a non-standard deployment location)
SCRIPT="/opt/tdai/scripts/memory-tencentdb-ctl.sh"

# Step 2: verify the path, then create the symlink
test -f "$SCRIPT" && echo "ok: $SCRIPT" || { echo "not found"; exit 1; }
chmod +x "$SCRIPT"
sudo ln -sf "$SCRIPT" /usr/local/bin/memory-tencentdb-ctl

# Use the same pattern to link install_hermes_memory_tencentdb.sh as install-memory-tencentdb (optional)
INSTALL_SCRIPT="$(dirname "$SCRIPT")/install_hermes_memory_tencentdb.sh"
test -f "$INSTALL_SCRIPT" && {
  chmod +x "$INSTALL_SCRIPT"
  sudo ln -sf "$INSTALL_SCRIPT" /usr/local/bin/install-memory-tencentdb
}
```

After that, you can run `memory-tencentdb-ctl …` / `install-memory-tencentdb …` directly.

> **Why not register it with `npm bin` directly?** These two scripts are operations tools, not part of the package's core API. The main repository deliberately expects users to register them in PATH **explicitly**, which avoids accidentally polluting the global command namespace and prevents npm uninstall from silently removing the operations entry point.

## 4. Lifecycle management (common to both modes)

```bash
memory-tencentdb-ctl start        # If :8420 is already in use, return immediately; otherwise spawn in the background and wait for /health to pass
memory-tencentdb-ctl stop         # SIGTERM first; SIGKILL if it has not exited within 5s
memory-tencentdb-ctl restart
memory-tencentdb-ctl status       # Print mode, port, data/log paths, and process status
memory-tencentdb-ctl health       # GET /health; implemented in pure python3, no curl required
memory-tencentdb-ctl logs         # tail -f stdout + stderr
memory-tencentdb-ctl logs err 500 # Show only the most recent 500 stderr lines
```

Startup command resolution order:

1. Environment variable `MEMORY_TENCENTDB_GATEWAY_CMD` (the value written by `install_hermes_memory_tencentdb.sh` into `/etc/profile.d/memory-tencentdb-env.sh`).
2. Fallback to `sh -c 'cd $TDAI_INSTALL_DIR && exec npx tsx src/gateway/server.ts'`.

Environment files sourced automatically at startup:

- In both modes: `/etc/profile.d/memory-tencentdb-env.sh`
- Hermes mode only: `/etc/profile.d/hermes-env.sh` and `$HERMES_HOME/env.d/*.sh`

## 5. Configure LLM / Embedding / VDB

All three kinds of credentials are stored in `$TDAI_DATA_DIR/tdai-gateway.json` (`0600`, written atomically). **In `--hermes` mode, `config llm` also writes an env file**; Embedding and VDB never write env files.

### 5.1 LLM

```bash
# standalone mode: write tdai-gateway.json only
memory-tencentdb-ctl config llm \
  --api-key   "sk-xxxxxxxxxxxx" \
  --base-url  "https://api.openai.com/v1" \
  --model     "gpt-4o" \
  --restart

# hermes mode: tdai-gateway.json + $HERMES_HOME/env.d/memory-tencentdb-llm.sh
memory-tencentdb-ctl --hermes config llm \
  --api-key   "sk-xxxxxxxxxxxx" \
  --base-url  "https://api.openai.com/v1" \
  --model     "gpt-4o" \
  --restart
```

- JSON write target: `$.llm.{baseUrl, apiKey, model}`.
- Env file output (`--hermes` only): `TDAI_LLM_*` plus `MEMORY_TENCENTDB_LLM_*` aliases (the Python provider's `get_config_schema()` reads the latter).

### 5.2 Embedding

Disabled by default (`provider=none`). To enable a remote OpenAI-compatible service:

```bash
memory-tencentdb-ctl config embedding \
  --provider   openai \
  --api-key    "sk-xxxx" \
  --base-url   "https://api.openai.com/v1" \
  --model      "text-embedding-3-small" \
  --dimensions 1536 \
  --restart

# Disable embedding (fall back to BM25/keyword recall)
memory-tencentdb-ctl config embedding --provider none --restart
```

- JSON write target: `$.memory.embedding.{provider, baseUrl, apiKey, model, dimensions, enabled, proxyUrl?}`.
- The `qclaw` provider additionally requires `--proxy-url`.
- Validation rules match `parseConfig()` in `src/config.ts`: `dimensions` must be a positive integer, and any provider other than `none` must include `apiKey/baseUrl/model/dimensions`; if anything is missing, the command fails without writing a half-valid JSON file.

### 5.3 VectorDB (Tencent Cloud VDB / tcvdb)

```bash
memory-tencentdb-ctl config vdb \
  --url       "http://xxx-vdb.tencentclb.com:8100" \
  --username  root \
  --api-key   "YOUR-VDB-API-KEY" \
  --database  "openclaw_memory" \
  --alias     "primary" \
  --embedding-model "bge-large-zh" \
  --ca-pem    "/etc/ssl/vdb-ca.pem" \
  --restart
```

- JSON write target: `$.memory.tcvdb.{url, username, apiKey, database, alias?, caPemPath?, embeddingModel?}`.
- By default this also switches `$.memory.storeBackend` to `"tcvdb"`; if you only want to preload the config without switching yet, add `--no-set-backend`.
- `--ca-pem` writes only the path and does not copy the file; the script verifies that it is readable.

### 5.4 Revert to local SQLite (disable the VDB backend)

```bash
# Default: keep memory.tcvdb credentials for an easy switch back later, and only change storeBackend to sqlite
memory-tencentdb-ctl config vdb-off --restart

# Also remove Tencent Cloud VDB credentials such as url / apiKey / database from the JSON
memory-tencentdb-ctl config vdb-off --purge-creds --restart
```

- JSON write target: set `$.memory.storeBackend` to `"sqlite"`; with `--purge-creds`, also remove the entire `$.memory.tcvdb` block.
- Other top-level blocks such as `$.llm` and `$.memory.embedding` are **left completely intact**, and Hermes-side `memory.provider` is **unchanged** (it remains `memory_tencentdb`; only its internal storage switches back to SQLite).
- If the config file does not exist, the command emits a `warn` and writes a minimal config containing only `{"memory":{"storeBackend":"sqlite"}}`.
- This is a complete mirror of `config vdb`: it can be combined with `--dry-run` and `--restart`.

### 5.5 View the current configuration

```bash
memory-tencentdb-ctl config show
```

- Prints `tdai-gateway.json`, automatically redacting `apiKey` / `password` / `token` fields as `<redacted:NN chars>`.
- In Hermes mode, it also prints `$HERMES_HOME/env.d/memory-tencentdb-*.sh` (with the API key redacted as well), so you can paste it directly into a ticket.

## 6. Enable Hermes integration (`--hermes` mode only)

```bash
memory-tencentdb-ctl --hermes enable-hermes-memory
```

This command is idempotent: it changes the `provider:` under the `memory:` section in `$HERMES_HOME/config.yaml` to `memory_tencentdb` (adding the whole section if it does not exist). Restart Hermes after the change:

```bash
source "$HERMES_HOME/env.d/memory-tencentdb-llm.sh"
pkill -f hermes-agent || true
hermes
```

> **About the write strategy**: the script uses a two-path, format-preserving approach and **never rewrites the entire YAML file**:
>
> 1. **Preferred**: if [`ruamel.yaml`](https://yaml.readthedocs.io/) is available, it uses round-trip editing to preserve comments, key order, quoting, and indentation exactly (recommended: `pip install --user ruamel.yaml` for maximum fidelity, but it is **not required**);
> 2. **Fallback**: if ruamel is not installed, it performs a minimal in-place line edit and rewrites only the `provider:` line, copying the indentation prefix **character for character** from sibling keys in the same section (zero guessing, zero formatting damage);
> 3. If the `memory:` section does not exist, it appends a minimal section at the end of the file, borrowing indentation from child keys in other top-level sections.
>
> In tests against a real `~/.hermes/config.yaml`, a byte-for-byte diff shows that every byte remains identical except the `provider` value itself.

Calling this command outside Hermes mode exits immediately with an error.

> If you want the opposite behavior — keep the Hermes provider unchanged, but switch TDAI's internal storage back to SQLite — use `config vdb-off` from §5.4 instead. You do not need to, and **should not**, change Hermes's `memory.provider`.

## 7. Common usage flows

### Scenario A: Deploy the Gateway standalone (without Hermes)

```bash
# 1) Install
#    For ways to set INSTALL_SCRIPT, see §3.2 above (git rev-parse / npm root / manual path all work)
#    For example, from the git repo root: INSTALL_SCRIPT="$(git rev-parse --show-toplevel)/scripts/install_hermes_memory_tencentdb.sh"
#                 from a global npm install:  INSTALL_SCRIPT="$(npm root -g)/@tencentdb-agent-memory/memory-tencentdb/scripts/install_hermes_memory_tencentdb.sh"
bash "$INSTALL_SCRIPT"

# 2) Configure only the credentials required by the Gateway
memory-tencentdb-ctl config llm       --api-key "sk-..." --base-url "https://api.openai.com/v1" --model gpt-4o
memory-tencentdb-ctl config embedding --provider openai --api-key "sk-..." --base-url "https://api.openai.com/v1" \
                                      --model text-embedding-3-small --dimensions 1536
memory-tencentdb-ctl config vdb       --url "http://xxx:8100" --api-key "..." --database openclaw_memory

# 3) Start + self-check
memory-tencentdb-ctl start
memory-tencentdb-ctl status
memory-tencentdb-ctl health      # Expected: {"status":"ok",...}
```

### Scenario B: Integrate with Hermes

```bash
# 1) Install (same as Scenario A; compute INSTALL_SCRIPT as shown in §3.2 above)
bash "$INSTALL_SCRIPT"

# 2) Add --hermes everywhere (or export MEMORY_TENCENTDB_MODE=hermes once)
memory-tencentdb-ctl --hermes config llm --api-key "sk-..." --base-url "https://api.openai.com/v1" --model gpt-4o
memory-tencentdb-ctl --hermes config embedding --provider openai --api-key "sk-..." \
                                               --base-url "https://api.openai.com/v1" \
                                               --model text-embedding-3-small --dimensions 1536
memory-tencentdb-ctl --hermes config vdb --url "http://xxx:8100" --api-key "..." --database openclaw_memory

# 3) Start the Gateway (Hermes supervisor usually manages this; this is a manual fallback)
memory-tencentdb-ctl --hermes start
memory-tencentdb-ctl --hermes status

# 4) Enable the provider in Hermes config, then restart Hermes
memory-tencentdb-ctl --hermes enable-hermes-memory
source "$HERMES_HOME/env.d/memory-tencentdb-llm.sh"
pkill -f hermes-agent ; hermes
```

If you do not want to type `--hermes` every time, you can do this instead:

```bash
export MEMORY_TENCENTDB_MODE=hermes
```

After that, all invocations automatically run in Hermes mode and you no longer need to add `--hermes` on the command line.

### Scenario C: Temporarily switch TDAI storage back to SQLite (while keeping Hermes integration)

This is useful when VDB is unavailable, during troubleshooting, or for offline development. Hermes still sees `memory.provider` as `memory_tencentdb`, while the Gateway writes to local SQLite instead.

```bash
# (A) Default: keep memory.tcvdb credentials and only switch storeBackend back to sqlite
memory-tencentdb-ctl config vdb-off --restart

# (B) After troubleshooting, switch back to vdb: at the moment you must rerun config vdb once
#     and provide the required fields again, even if the JSON still contains the credentials.
#     The script treats this as a validated redeclaration, not as a toggle.
memory-tencentdb-ctl config vdb \
  --url "http://xxx-vdb.tencentclb.com:8100" \
  --api-key "<YOUR KEY>" \
  --database "openclaw_memory" \
  --restart

# (C) Give up on vdb entirely: purge the credentials
memory-tencentdb-ctl config vdb-off --purge-creds --restart
```

> The reason (B) does not provide a no-argument `vdb-on` is that the original `config vdb` subcommand applies strict validation to `--url/--api-key/--database`, which prevents users from assembling a half-valid config. If you want to reactivate already-stored credentials with a single command too, ask the maintainer to add a `config vdb-on`; its implementation would mirror `vdb-off` exactly.

> **Do not** change `memory.provider` in `~/.hermes/config.yaml` just to "switch back to SQLite". Hermes should still see the `memory_tencentdb` provider; the storage backend change is internal to the Gateway and completely transparent to Hermes.

## 8. Global options & debugging tips

- All write operations support `--dry-run` (put it at the very front of the command), which prints what would be written without touching disk:
  ```bash
  memory-tencentdb-ctl --dry-run config llm --api-key k --base-url https://x --model m
  ```
- Sensitive files are always written with mode `0600`; `env.d/memory-tencentdb-llm.sh` contains the API key in plain text, so **do not** commit it.
- If startup fails, run `memory-tencentdb-ctl logs err 200` to inspect stderr; running it once in the foreground usually makes the error easier to see:
  ```bash
  cd "$TDAI_INSTALL_DIR" && npx tsx src/gateway/server.ts
  ```
- Port conflict: `MEMORY_TENCENTDB_GATEWAY_PORT=18420 memory-tencentdb-ctl restart`.
- Verify whether Hermes picked up the new env values (Hermes mode):
  ```bash
  tr '\0' '\n' < /proc/$(pgrep -n hermes-agent)/environ | grep -E 'TDAI_|MEMORY_TENCENTDB_'
  ```

## 9. Exit codes

| Code | Meaning |
|---|---|
| 0 | Success |
| 1 | Invalid arguments / business validation failure (for example, `--base-url` is not http(s), or a Hermes-only command is called in standalone mode) |
| 2 | Disk write failure (disk full, insufficient permissions, and so on) |
| 127 | Missing dependency (`python3` / `node` / `npx`) |

---

If you want to wrap this in a systemd unit, define a `Type=forking` service around `memory-tencentdb-ctl start` / `memory-tencentdb-ctl stop`. The Gateway is a stateless HTTP sidecar and does not depend on the systemd readiness protocol.
