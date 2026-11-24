#!/usr/bin/env bash
# Tests for runtime-templates/state-manager.js (full + lite profiles). Uses a temp dir only.
set -u
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

pass=0; fail=0
check() { # name expected_code actual_code
  if [ "$2" = "$3" ]; then pass=$((pass+1)); else fail=$((fail+1)); echo "FAIL: $1 (expected $2, got $3)"; fi
}
state_is() { # name feature expected_state
  local file=".agents/memory/features/$2.json"
  [ "$2" = "default" ] && file=".agents/memory/state.json"
  node -e 'const s=require(process.argv[1]);process.exit(s.current_state===process.argv[2]?0:1)' "$PWD/$file" "$3"
  check "$1" 0 $?
}
setup() { # profile-file
  rm -rf "$TMP/proj"; mkdir -p "$TMP/proj/.agents/config" "$TMP/proj/.agents/scripts"
  cd "$TMP/proj" || exit 1
  cp "$ROOT/runtime-templates/$1" .agents/config/workflow.json
  cp "$ROOT/runtime-templates/state-manager.js" .agents/scripts/state-manager.js
}
sm() { node .agents/scripts/state-manager.js "$@" >/dev/null 2>&1; }

# ---------- full profile ----------
setup workflow.json
F="--feature auth"

sm update --proposal INIT $F;                         check "INIT creates feature state" 0 $?
sm update --proposal EXECUTE_BE $F;                   check "invalid proposal from DESIGN_NEEDED" 1 $?
sm update --proposal PLAN_COMPLEX $F;                 check "plan complex" 0 $?
sm update --proposal APPROVE $F;                      check "human gate without quote is refused" 4 $?
state_is "state unchanged after refused approval" auth ADR_GATE
sm update --proposal APPROVE $F --approved-by-user "ok, duyệt ADR"; check "human gate with quote passes" 0 $?
grep -q '"user_reply":"ok, duyệt ADR"' .agents/memory/approvals.log; check "approval appended to audit log" 0 $?

sm update --proposal EXECUTE_BE $F;                   check "execute backend" 0 $?
state_is "backend goes to TEST_GATE (no bypass)" auth TEST_GATE
sm update --proposal PASS $F;                         check "PASS without runs refused" 2 $?
sm update --proposal PASS $F --evidence x.json;       check "--evidence rejected" 2 $?
sm test --phase red --cmd "true" $F;                  check "RED that passes is refused" 3 $?
sm test --phase red --cmd "echo '1 failed'; exit 1" $F; check "RED that fails is recorded" 0 $?
sm update --proposal PASS $F;                         check "PASS with RED only refused" 2 $?
sm test --phase green --cmd "false" $F;               check "GREEN that fails is refused" 3 $?
sm test --phase green --cmd "echo '12 passed'" $F;    check "GREEN recorded" 0 $?
sm update --proposal PASS $F --dry-run;               check "dry-run PASS ok" 0 $?
state_is "dry-run did not write" auth TEST_GATE
sm update --proposal PASS $F --cases "isolation; happy path"; check "PASS with script-run RED+GREEN" 0 $?
node -e 's=require("./.agents/memory/features/auth.json");process.exit(s.last_evidence.red.exit_code===1&&s.last_evidence.cases.length===2&&Object.keys(s.test_runs).length===0?0:1)'
check "evidence stored, runs consumed" 0 $?
ls .agents/memory/test-runs/auth-green-*.log >/dev/null 2>&1; check "raw test log written" 0 $?

sm update --proposal SUCCESS_WITH_UI $F;              check "review gate needs approval" 4 $?
sm update --proposal SUCCESS_WITH_UI $F --approved-by-user "LGTM"; check "review approved" 0 $?
sm update --proposal APPROVE $F --approved-by-user "làm FE đi"; check "BE->FE approved" 0 $?
state_is "FE work returns to LOCKED_DECISION" auth LOCKED_DECISION
sm update --proposal EXECUTE_FE $F;                   check "execute FE" 0 $?
sm test --phase green --cmd "true" $F;                check "GREEN without RED" 0 $?
sm update --proposal PASS $F --skip-red "pure styling";        check "skip-red without approval refused" 4 $?
sm update --proposal PASS $F --skip-red "pure styling" --approved-by-user "ok bỏ RED"; check "skip-red with approval" 0 $?
sm update --proposal APPROVE $F --approved-by-user "ok"; check "review FE" 0 $?
sm update --proposal PROPOSE_DEPLOY $F;               check "propose deploy" 0 $?
sm update --proposal APPROVE $F;                      check "deploy gate refused without quote" 4 $?

# feature isolation + ops path cannot skip DEPLOYMENT_GATE
sm update --proposal PLAN_PATCH --feature billing;    check "second feature independent" 0 $?
sm update --proposal EXECUTE_OPS --feature billing;   check "ops from locked decision" 0 $?
state_is "ops lands on DEPLOYMENT_GATE" billing DEPLOYMENT_GATE
state_is "auth untouched by billing" auth DEPLOYMENT_GATE
sm list;                                              check "list works" 0 $?
sm update --proposal INIT --feature "../evil";        check "path traversal slug refused" 1 $?

# retries -> BLOCKED -> resume needs approval
sm update --proposal INIT --feature retry
sm update --proposal PLAN_PATCH --feature retry
for _ in 1 2 3; do sm update --proposal FAILURE --feature retry; done
state_is "3 failures -> BLOCKED" retry BLOCKED
sm update --proposal RESUME_PATCH --feature retry --reset-retries; check "resume needs approval" 4 $?
sm update --proposal RESUME_PATCH --feature retry --reset-retries --approved-by-user "thử lại"; check "resume with approval" 0 $?

# legacy default (no --feature) still works
sm update --proposal INIT;                            check "legacy default state" 0 $?
state_is "legacy state.json used" default DESIGN_NEEDED

# ---------- lite profile ----------
setup workflow.lite.json
sm update --proposal INIT;                            check "lite init" 0 $?
state_is "lite starts IN_PROGRESS" default IN_PROGRESS
sm update --proposal READY_FOR_TEST;                  check "lite to test gate" 0 $?
sm test --phase red --cmd "exit 1"; sm test --phase green --cmd "true"
sm update --proposal PASS;                            check "lite PASS" 0 $?
sm update --proposal APPROVE --approved-by-user "xong"; check "lite completion" 0 $?
state_is "lite archived" default READY_TO_ARCHIVE

echo "state-manager tests: $pass passed, $fail failed"
[ "$fail" -eq 0 ]
