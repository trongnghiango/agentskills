#!/usr/bin/env node
'use strict';

/**
 * state-manager.js — lifecycle state store for ka-workflow / ka-plan.
 * Node.js core modules only.
 *
 * What it enforces (the parts an agent cannot talk its way past):
 *   - Only transitions declared in workflow.json are accepted.
 *   - Human gates (`"approval": "human"`) require --approved-by-user "<verbatim user reply>";
 *     every approval is appended to .agents/memory/approvals.log for audit.
 *   - TEST_EVIDENCE_GATE (`"verify": "test_runs"`) only passes on test runs that THIS script
 *     executed itself (`test --phase red|green`), never on agent-written JSON.
 *   - State is scoped per feature (--feature <slug>) so parallel features do not collide.
 *
 * Exit codes: 0 ok | 1 usage / invalid transition | 2 missing test evidence |
 *             3 test run did not match its phase | 4 human approval missing
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');

const AGENTS_DIR = path.resolve('.agents');
const MEMORY_DIR = path.join(AGENTS_DIR, 'memory');
const FEATURES_DIR = path.join(MEMORY_DIR, 'features');
const RUNS_DIR = path.join(MEMORY_DIR, 'test-runs');
const APPROVAL_LOG = path.join(MEMORY_DIR, 'approvals.log');
const LEGACY_STATE_FILE = path.join(MEMORY_DIR, 'state.json');
const WORKFLOW_FILE = path.join(AGENTS_DIR, 'config', 'workflow.json');

const RETRY_LIMIT = 3;
const RESET_LIMIT = 3;
const OUTPUT_TAIL = 4000;
const SLUG = /^[a-z0-9][a-z0-9._-]{0,63}$/i;
const VALUE_FLAGS = new Set([
  'feature', 'proposal', 'route', 'completed-file', 'approved-by-user',
  'skip-red', 'cases', 'phase', 'cmd', 'timeout', 'evidence',
]);
const BOOL_FLAGS = new Set(['dry-run', 'reset-retries']);

const USAGE = `
Usage:
  node state-manager.js get    [--feature <slug>]
  node state-manager.js list
  node state-manager.js test   --phase red|green --cmd "<test command>" [--feature <slug>] [--timeout <sec>] [--dry-run]
  node state-manager.js update --proposal <KEY> [--feature <slug>] [--route <ROUTE>] [--completed-file <PATH>]
                               [--approved-by-user "<user reply, verbatim>"] [--skip-red "<reason>"]
                               [--cases "case a; case b"] [--reset-retries] [--dry-run]
`;

function die(message, code = 1) {
  console.error(`❌ ${message}`);
  process.exit(code);
}

function parseArgs(argv) {
  const flags = {};
  for (let i = 1; i < argv.length; i++) {
    const raw = argv[i];
    if (!raw.startsWith('--')) die(`Unexpected argument: ${raw}\n${USAGE}`);
    const name = raw.slice(2);
    if (BOOL_FLAGS.has(name)) {
      flags[name] = true;
    } else if (VALUE_FLAGS.has(name)) {
      if (i + 1 >= argv.length) die(`Flag --${name} needs a value.`);
      flags[name] = argv[++i];
    } else {
      die(`Unknown flag: --${name}\n${USAGE}`);
    }
  }
  return { command: argv[0], flags };
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function sha256(text) {
  return crypto.createHash('sha256').update(text).digest('hex').slice(0, 12);
}

function loadWorkflow() {
  if (!fs.existsSync(WORKFLOW_FILE)) {
    die(`Workflow file not found at ${WORKFLOW_FILE}\n   Copy runtime-templates/workflow.json (or workflow.lite.json) to .agents/config/workflow.json`);
  }
  try {
    return JSON.parse(fs.readFileSync(WORKFLOW_FILE, 'utf8'));
  } catch (err) {
    return die(`Cannot parse workflow.json: ${err.message}`);
  }
}

function featureSlug(flags) {
  if (!flags.feature) return null;
  if (!SLUG.test(flags.feature)) die(`Invalid --feature '${flags.feature}'. Use letters, digits, '.', '_' or '-'.`);
  return flags.feature;
}

function stateFile(feature) {
  return feature ? path.join(FEATURES_DIR, `${feature}.json`) : LEGACY_STATE_FILE;
}

function freshState(workflow, feature) {
  return {
    feature: feature || 'default',
    profile: workflow.profile || 'full',
    current_state: workflow.initial || 'DESIGN_NEEDED',
    route: null,
    completed_file: null,
    retries: {},
    resets: {},
    test_runs: {},
    history: [],
  };
}

function loadState(workflow, feature) {
  const file = stateFile(feature);
  if (!fs.existsSync(file)) return freshState(workflow, feature);
  let state;
  try {
    state = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (err) {
    // Never silently start fresh: that would erase gate progress and history.
    return die(`Cannot parse ${file}: ${err.message}\n   Fix or remove the file manually.`);
  }
  return { ...freshState(workflow, feature), ...state };
}

function saveState(state, feature) {
  const file = stateFile(feature);
  ensureDir(path.dirname(file));
  state.updated_at = new Date().toISOString();
  fs.writeFileSync(file, `${JSON.stringify(state, null, 2)}\n`, 'utf8');
}

function gitHead() {
  const r = spawnSync('git', ['rev-parse', '--short', 'HEAD'], { encoding: 'utf8' });
  return r.status === 0 ? r.stdout.trim() : null;
}

// ---------- commands ----------

function cmdGet(flags) {
  const workflow = loadWorkflow();
  console.log(JSON.stringify(loadState(workflow, featureSlug(flags)), null, 2));
}

function cmdList() {
  const rows = [];
  if (fs.existsSync(LEGACY_STATE_FILE)) rows.push(['(default)', LEGACY_STATE_FILE]);
  if (fs.existsSync(FEATURES_DIR)) {
    for (const f of fs.readdirSync(FEATURES_DIR).filter((n) => n.endsWith('.json')).sort()) {
      rows.push([f.replace(/\.json$/, ''), path.join(FEATURES_DIR, f)]);
    }
  }
  if (rows.length === 0) {
    console.log('No feature state yet.');
    return;
  }
  for (const [name, file] of rows) {
    try {
      const s = JSON.parse(fs.readFileSync(file, 'utf8'));
      console.log(`${name.padEnd(28)} ${String(s.current_state).padEnd(20)} ${s.updated_at || ''}`);
    } catch {
      console.log(`${name.padEnd(28)} <unreadable>`);
    }
  }
}

function cmdTest(flags) {
  const phase = flags.phase;
  if (phase !== 'red' && phase !== 'green') die('--phase must be "red" or "green".');
  if (!flags.cmd || !flags.cmd.trim()) die('--cmd "<test command>" is required.');
  const feature = featureSlug(flags);
  const workflow = loadWorkflow();
  const state = loadState(workflow, feature);
  const timeoutSec = Number(flags.timeout || 600);

  console.log(`🧪 Running ${phase.toUpperCase()} phase: ${flags.cmd}`);
  const r = spawnSync(flags.cmd, {
    shell: true, encoding: 'utf8', timeout: timeoutSec * 1000, maxBuffer: 64 * 1024 * 1024,
  });
  const output = `${r.stdout || ''}${r.stderr || ''}`;
  let exitCode = typeof r.status === 'number' ? r.status : 1;
  if (r.error && r.error.code === 'ETIMEDOUT') exitCode = 124;
  const tail = output.slice(-OUTPUT_TAIL);
  const at = new Date().toISOString();

  const expectedOk = phase === 'green';
  const matched = expectedOk ? exitCode === 0 : exitCode !== 0;
  console.log(tail.split('\n').slice(-15).join('\n'));

  if (!matched) {
    if (!flags['dry-run'] && phase === 'green' && state.test_runs.green) {
      delete state.test_runs.green; // latest green run failed: earlier green no longer counts
      saveState(state, feature);
    }
    const why = phase === 'red'
      ? 'RED phase must FAIL, but the command exited 0. Write a failing test first (or justify --skip-red at PASS with user approval).'
      : `GREEN phase must pass, but the command exited ${exitCode}.`;
    die(why, 3);
  }

  const record = {
    phase, command: flags.cmd, exit_code: exitCode, at, git_head: gitHead(),
    output_sha256: sha256(output), output_tail: tail, log_file: null,
  };
  if (flags['dry-run']) {
    console.log(`🧪 Dry run: ${phase} run matched (exit ${exitCode}); nothing recorded.`);
    return;
  }
  ensureDir(RUNS_DIR);
  record.log_file = path.join(RUNS_DIR, `${state.feature}-${phase}-${at.replace(/[:.]/g, '-')}.log`);
  fs.writeFileSync(record.log_file, output, 'utf8');
  state.test_runs = state.test_runs || {};
  state.test_runs[phase] = record;
  if (phase === 'red') delete state.test_runs.green; // GREEN must come after RED
  saveState(state, feature);
  console.log(`✅ Recorded ${phase.toUpperCase()} run (exit ${exitCode}, sha256:${record.output_sha256}) → ${record.log_file}`);
}

function needsHumanApproval(cfg, key) {
  if (cfg.approval !== 'human') return false;
  if (Array.isArray(cfg.approval_for)) return cfg.approval_for.map((k) => k.toUpperCase()).includes(key);
  return key !== 'FAILURE' && key !== 'FAIL';
}

function requireApproval(flags, gateName) {
  const quote = (flags['approved-by-user'] || '').trim();
  if (quote.length < 2) {
    die(`Gate '${gateName}' requires human approval.\n   Ask the user, then re-run with --approved-by-user "<their reply, verbatim>".\n   Never invent this value.`, 4);
  }
  return quote;
}

function verifyTestRuns(state, flags, gateName) {
  const runs = state.test_runs || {};
  if (!runs.green) {
    die(`Gate '${gateName}' needs a GREEN run recorded by this script:\n   node .agents/scripts/state-manager.js test --phase green --cmd "<test command>"`, 2);
  }
  const skipRed = (flags['skip-red'] || '').trim();
  let approval = null;
  if (!runs.red) {
    if (!skipRed) {
      die(`Gate '${gateName}' needs a RED run (test failing before the change):\n   node .agents/scripts/state-manager.js test --phase red --cmd "<test command>"\n   No RED possible (pure refactor, config, docs)? Use --skip-red "<reason>" with --approved-by-user.`, 2);
    }
    approval = requireApproval(flags, `${gateName} (skip RED)`);
  } else if (Date.parse(runs.green.at) < Date.parse(runs.red.at)) {
    die('GREEN run is older than RED run. Re-run the GREEN phase after the fix.', 2);
  }
  const cases = (flags.cases || '').split(';').map((c) => c.trim()).filter(Boolean);
  return {
    gate: gateName,
    red: runs.red || null,
    green: runs.green,
    skip_red_reason: skipRed || null,
    cases,
    approval,
    accepted_at: new Date().toISOString(),
  };
}

function appendApproval(entry) {
  ensureDir(MEMORY_DIR);
  fs.appendFileSync(APPROVAL_LOG, `${JSON.stringify(entry)}\n`, 'utf8');
}

function handleFailure(state, feature, failedState) {
  const retries = (state.retries[failedState] || 0) + 1;
  state.retries[failedState] = retries;
  console.log(`⚠️ Failure reported in state '${failedState}' (retry ${retries}/${RETRY_LIMIT})`);
  if (retries >= RETRY_LIMIT) {
    console.log(`🛑 Max retries exceeded in '${failedState}'. Transitioning to BLOCKED.`);
    state.last_blocked_state = failedState;
    state.current_state = 'BLOCKED';
    state.history.push({ timestamp: new Date().toISOString(), from: failedState, to: 'BLOCKED', trigger: 'MAX_RETRIES_EXCEEDED' });
  }
  saveState(state, feature);
}

function cmdUpdate(flags) {
  if (flags.evidence) {
    die('--evidence is no longer accepted: agent-written evidence cannot be trusted.\n   Record runs with: state-manager.js test --phase red|green --cmd "<test command>"', 2);
  }
  if (!flags.proposal) die(`--proposal <KEY> is required.\n${USAGE}`);
  const feature = featureSlug(flags);
  const dryRun = Boolean(flags['dry-run']);
  const workflow = loadWorkflow();
  const state = loadState(workflow, feature);
  const key = flags.proposal.toUpperCase();
  const now = () => new Date().toISOString();

  if (key === 'INIT') {
    const old = state.current_state;
    const next = freshState(workflow, feature);
    next.history = [...state.history, { timestamp: now(), from: old, to: next.current_state, trigger: 'INIT' }];
    if (dryRun) return console.log(`🧪 Dry run: [${old}] -> [${next.current_state}] (INIT, no write)`);
    saveState(next, feature);
    return console.log(`🔔 TRANSITION: [${old}] -> [${next.current_state}] (INIT)`);
  }

  const from = state.current_state;
  const cfg = workflow.states[from];
  if (!cfg) die(`Current state '${from}' is not defined in workflow.json.`);
  const transitions = cfg.transitions || {};
  const matched = Object.keys(transitions).find((k) => k.toUpperCase() === key);

  if (!matched) {
    if (key === 'FAILURE') {
      if (dryRun) return console.log(`🧪 Dry run: FAILURE would count a retry in '${from}' (no write)`);
      return handleFailure(state, feature, from);
    }
    die(`Proposal '${flags.proposal}' is not a valid transition from '${from}'.\n   Available: ${Object.keys(transitions).join(', ') || '(none — terminal state)'}`);
  }

  const gateName = cfg.gate || from;
  let to = transitions[matched];
  let approval = null;
  let evidence = null;

  if (needsHumanApproval(cfg, matched.toUpperCase())) approval = requireApproval(flags, gateName);
  if (cfg.verify === 'test_runs' && matched.toUpperCase() === 'PASS') {
    evidence = verifyTestRuns(state, flags, gateName);
    approval = approval || evidence.approval;
  }

  if (from === 'BLOCKED' && flags['reset-retries']) {
    const blocked = state.last_blocked_state;
    const resets = state.resets[blocked] || 0;
    if (resets >= RESET_LIMIT) {
      console.log(`⚠️ Max resets (${RESET_LIMIT}/${RESET_LIMIT}) reached for '${blocked}'. Returning to the initial state instead of retrying.`);
      to = workflow.initial || 'DESIGN_NEEDED';
      state.retries = {};
      state.resets = {};
    } else {
      state.resets[blocked] = resets + 1;
      state.retries[blocked] = 0;
      console.log(`🔄 Resetting retries for '${blocked}' (reset ${resets + 1}/${RESET_LIMIT})`);
    }
  }

  if (dryRun) {
    return console.log(`🧪 Dry run: [${from}] -> [${to}] via '${matched}'${approval ? ' (approval present)' : ''} (no write)`);
  }

  if (approval) {
    appendApproval({ timestamp: now(), feature: state.feature, gate: gateName, transition: matched, from, to, user_reply: approval });
  }
  if (evidence) {
    state.last_evidence = evidence;
    state.test_runs = {};
  }
  if (to === 'BLOCKED') state.last_blocked_state = from;
  if (flags.route) state.route = flags.route;
  if (flags['completed-file']) state.completed_file = flags['completed-file'];
  if (from !== to) state.retries[from] = 0;
  state.current_state = to;
  state.history.push({
    timestamp: now(),
    from,
    to,
    trigger: matched,
    route: flags.route || undefined,
    completed_file: flags['completed-file'] || undefined,
    approved_by_user: approval || undefined,
    evidence_sha256: evidence ? evidence.green.output_sha256 : undefined,
  });
  saveState(state, feature);
  console.log(`🔔 TRANSITION: [${from}] -> [${to}]`);
}

// ---------- main ----------

const { command, flags } = parseArgs(process.argv.slice(2));
switch (command) {
  case 'get': cmdGet(flags); break;
  case 'list': cmdList(); break;
  case 'test': cmdTest(flags); break;
  case 'update': cmdUpdate(flags); break;
  default:
    console.log(USAGE);
    process.exit(1);
}
