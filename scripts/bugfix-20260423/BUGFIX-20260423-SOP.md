# Bugfix-20260423 Image Build SOP

> **Applicable version**: OpenClaw 2026.4.23
> **Issue fixed**: Issue #73806 — Zod schema `.strict()` rejects `hooks.allowConversationAccess`, preventing non-bundled plugins from registering conversation hooks
> **Script location**: `scripts/bugfix-20260423.sh`

---

## Step 1: Stop the Gateway

```bash
openclaw gateway stop
```

Confirm that it has stopped:

```bash
ps aux | grep gateway
```

Make sure no `openclaw-gateway` process is still running.

---

## Step 2: Apply the patch

```bash
cd /path/to/memory-tdai/scripts
bash bugfix-20260423.sh
```

---

## Step 3: Verify

### 3.1 Verify the openclaw.json configuration

```bash
cat ~/.openclaw/openclaw.json | python3 -m json.tool | grep allowConversationAccess
```

Expected output:

```
"allowConversationAccess": true
```

Confirm that it appears under `plugins.entries.memory-tencentdb.hooks`.

### 3.2 Verify the Zod schema dist file

First locate the OpenClaw installation directory (the path varies by environment; the example below is illustrative only):

```bash
# Option 1: locate it automatically with which
OC_DIR=$(node -e "const p=require('path'),f=require('fs'); \
  const bin=require('child_process').execSync('which openclaw',{encoding:'utf8'}).trim(); \
  let d=p.dirname(f.realpathSync(bin)); \
  while(d!=p.dirname(d)){if(f.existsSync(p.join(d,'package.json'))){console.log(d);break;}d=p.dirname(d);}")
echo "$OC_DIR"

# Option 2: specify it manually (sample path; replace it with your real environment)
# OC_DIR=~/.local/share/pnpm/global/5/.pnpm/openclaw@2026.4.23_@napi-rs+canvas@0.1.100/node_modules/openclaw
```

Then inspect `zod-schema-BhKK4qYw.js`:

```bash
cat "$OC_DIR/dist/zod-schema-BhKK4qYw.js" | grep allowConversationAccess -n
```

Verification checklist:

1. `allowConversationAccess` appears in the output.
2. It appears **exactly once** (only one matching line).
3. The surrounding context on that line looks like: `allowPromptInjection:z.boolean().optional(),allowConversationAccess:z.boolean().optional()}).strict().optional()`

---

## After verification succeeds

Once both verification steps pass, restart the Gateway:

```bash
openclaw gateway run
```
