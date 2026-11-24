#!/usr/bin/env bash
# Test TEST_EVIDENCE_GATE enforcement in state-manager.js. Uses a temp dir only.
set -u
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
cd "$TMP" || exit 1
mkdir -p .agents/config .agents/memory .agents/scripts
cp "$ROOT/runtime-templates/workflow.json" .agents/config/workflow.json
cp "$ROOT/runtime-templates/state-manager.js" .agents/scripts/state-manager.js

pass=0; fail=0
check() { # name expected_code actual_code
  if [ "$2" = "$3" ]; then pass=$((pass+1)); else fail=$((fail+1)); echo "FAIL: $1 (expected $2, got $3)"; fi
}

node .agents/scripts/state-manager.js update --proposal INIT >/dev/null 2>&1
node -e 'const fs=require("fs");const p=".agents/memory/state.json";const s=JSON.parse(fs.readFileSync(p));s.current_state="TEST_GATE";fs.writeFileSync(p,JSON.stringify(s,null,2))'

node .agents/scripts/state-manager.js update --proposal PASS >/dev/null 2>&1
check "PASS without evidence must fail" 2 $?

printf '{"command":"pnpm test x"}\n' > partial.json
node .agents/scripts/state-manager.js update --proposal PASS --evidence partial.json >/dev/null 2>&1
check "PASS with incomplete evidence must fail" 2 $?

cat > evidence.json <<'JSON'
{"command":"pnpm test x","red_output":"1 failed","green_output":"12 passed","cases":["isolation"]}
JSON
node .agents/scripts/state-manager.js update --proposal PASS --evidence evidence.json >/dev/null 2>&1
check "PASS with full evidence must succeed" 0 $?

node -e 'const s=require("./.agents/memory/state.json");process.exit(s.current_state==="BUILD_DONE"&&s.last_evidence?"0":"1")'
check "state advanced with recorded evidence" 0 $?

node -e 'const fs=require("fs");const p=".agents/memory/state.json";const s=JSON.parse(fs.readFileSync(p));s.current_state="TEST_GATE";fs.writeFileSync(p,JSON.stringify(s,null,2))'
node .agents/scripts/state-manager.js update --proposal PASS --evidence evidence.json --dry-run >/dev/null 2>&1
check "dry-run with evidence exits 0" 0 $?
node -e 'const s=require("./.agents/memory/state.json");process.exit(s.current_state==="TEST_GATE"?"0":"1")'
check "dry-run must not write state" 0 $?

node .agents/scripts/state-manager.js update --proposal EXECUTE_TEST --dry-run >/dev/null 2>&1
check "invalid proposal fails" 1 $?

echo "state-manager gate tests: $pass passed, $fail failed"
[ "$fail" -eq 0 ]
