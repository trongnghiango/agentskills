#!/usr/bin/env node

/**
 * state-manager.js
 * Reference implementation for ka-workflow and ka-plan state management.
 * Relies only on Node.js core modules.
 */

const fs = require('fs');
const path = require('path');

const AGENTS_DIR = path.resolve('.agents');
const STATE_FILE = path.join(AGENTS_DIR, 'memory', 'state.json');
const WORKFLOW_FILE = path.join(AGENTS_DIR, 'config', 'workflow.json');

// Ensure directories exist
function ensureDirectories() {
  if (!fs.existsSync(AGENTS_DIR)) {
    fs.mkdirSync(AGENTS_DIR, { recursive: true });
  }
  const memoryDir = path.join(AGENTS_DIR, 'memory');
  if (!fs.existsSync(memoryDir)) {
    fs.mkdirSync(memoryDir, { recursive: true });
  }
  const configDir = path.join(AGENTS_DIR, 'config');
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }
}

// Load configurations
function loadWorkflow() {
  if (!fs.existsSync(WORKFLOW_FILE)) {
    console.error(`❌ Workflow file not found at: ${WORKFLOW_FILE}`);
    console.error('Please make sure you copied workflow.json into .agents/config/workflow.json');
    process.exit(1);
  }
  try {
    return JSON.parse(fs.readFileSync(WORKFLOW_FILE, 'utf8'));
  } catch (err) {
    console.error('❌ Error parsing workflow.json:', err.message);
    process.exit(1);
  }
}

function loadState() {
  if (!fs.existsSync(STATE_FILE)) {
    return {
      current_state: "DESIGN_NEEDED",
      route: null,
      completed_file: null,
      retries: {},
      resets: {},
      history: []
    };
  }
  try {
    return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
  } catch (err) {
    console.error('❌ Error parsing state.json. Starting fresh.', err.message);
    return {
      current_state: "DESIGN_NEEDED",
      route: null,
      completed_file: null,
      retries: {},
      resets: {},
      history: []
    };
  }
}

function saveState(state) {
  ensureDirectories();
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), 'utf8');
}

// Parse Command Line Arguments
const args = process.argv.slice(2);
const command = args[0];

if (!command || (command !== 'get' && command !== 'update')) {
  console.log(`
Usage:
  node state-manager.js get
  node state-manager.js update --proposal <PROPOSAL_KEY> [--route <ROUTE>] [--completed-file <PATH>] [--reset-retries]
`);
  process.exit(1);
}

if (command === 'get') {
  ensureDirectories();
  const state = loadState();
  console.log(JSON.stringify(state, null, 2));
  process.exit(0);
}

// Parse key-value arguments for 'update'
let proposal = null;
let route = null;
let completedFile = null;
let resetRetries = false;

for (let i = 1; i < args.length; i++) {
  if (args[i] === '--proposal') {
    proposal = args[i + 1];
    i++;
  } else if (args[i] === '--route') {
    route = args[i + 1];
    i++;
  } else if (args[i] === '--completed-file') {
    completedFile = args[i + 1];
    i++;
  } else if (args[i] === '--reset-retries') {
    resetRetries = true;
  }
}

if (!proposal) {
  console.error('❌ Error: --proposal <PROPOSAL_KEY> is required for update.');
  process.exit(1);
}

ensureDirectories();
const workflow = loadWorkflow();
const state = loadState();

// Special behavior: INIT proposal resets everything
if (proposal.toUpperCase() === 'INIT') {
  const oldState = state.current_state;
  state.current_state = workflow.initial || "DESIGN_NEEDED";
  state.route = null;
  state.completed_file = null;
  state.retries = {};
  state.resets = {};
  state.history.push({
    timestamp: new Date().toISOString(),
    from: oldState,
    to: state.current_state,
    trigger: "INIT"
  });
  saveState(state);
  console.log(`🔔 TRANSITION: [${oldState}] -> [${state.current_state}] (INIT)`);
  process.exit(0);
}

const currentStateName = state.current_state;
const currentStateConfig = workflow.states[currentStateName];

if (!currentStateConfig) {
  console.error(`❌ Error: Current state '${currentStateName}' is not defined in workflow.json.`);
  process.exit(1);
}

const transitions = currentStateConfig.transitions || {};
const upperProposal = proposal.toUpperCase();

// Look for matching transition key (case insensitive)
let matchedProposalKey = null;
for (const key of Object.keys(transitions)) {
  if (key.toUpperCase() === upperProposal) {
    matchedProposalKey = key;
    break;
  }
}

if (!matchedProposalKey) {
  // If the proposal is "FAILURE" and not explicitly configured, we increment retries
  if (upperProposal === 'FAILURE') {
    handleFailure(state, currentStateName);
    process.exit(0);
  }
  
  console.error(`❌ Error: Proposal '${proposal}' is not a valid transition from state '${currentStateName}'.`);
  console.error(`Available transitions: ${Object.keys(transitions).join(', ')}`);
  process.exit(1);
}

const nextState = transitions[matchedProposalKey];

// Check reset logic for BLOCKED state
if (currentStateName === 'BLOCKED' && resetRetries) {
  const resetCount = state.resets[state.last_blocked_state] || 0;
  if (resetCount >= 3) {
    console.log(`⚠️ Warning: Max reset retries exceeded (3/3) for state '${state.last_blocked_state}'.`);
    console.log(`🔔 TRANSITION: [BLOCKED] -> [DESIGN_NEEDED] (Returning to design instead of retrying)`);
    state.current_state = 'DESIGN_NEEDED';
    state.route = null;
    state.completed_file = null;
    state.retries = {};
    state.resets = {};
    state.history.push({
      timestamp: new Date().toISOString(),
      from: 'BLOCKED',
      to: 'DESIGN_NEEDED',
      trigger: 'RESET_LIMIT_EXCEEDED'
    });
    saveState(state);
    process.exit(0);
  }
  
  // Register reset
  state.resets[state.last_blocked_state] = resetCount + 1;
  state.retries[state.last_blocked_state] = 0; // Reset retries for that state
  console.log(`🔄 Resetting retries for state '${state.last_blocked_state}' (Reset ${resetCount + 1}/3)`);
}

// Make transition
const oldState = state.current_state;
state.current_state = nextState;

if (route) state.route = route;
if (completedFile) state.completed_file = completedFile;

// Reset retry count on successful transition
if (oldState !== nextState) {
  state.retries[oldState] = 0;
}

state.history.push({
  timestamp: new Date().toISOString(),
  from: oldState,
  to: nextState,
  trigger: matchedProposalKey,
  route: route || undefined,
  completed_file: completedFile || undefined
});

saveState(state);
console.log(`🔔 TRANSITION: [${oldState}] -> [${nextState}]`);

// Helper function to handle failure transitions
function handleFailure(state, failedState) {
  const currentRetries = state.retries[failedState] || 0;
  const newRetries = currentRetries + 1;
  state.retries[failedState] = newRetries;
  
  console.log(`⚠️ Warning: Failure reported in state '${failedState}' (Retry ${newRetries}/3)`);
  
  if (newRetries >= 3) {
    console.log(`🛑 Error: Max retries exceeded in state '${failedState}'. Transitioning to BLOCKED.`);
    state.last_blocked_state = failedState;
    state.current_state = 'BLOCKED';
    state.history.push({
      timestamp: new Date().toISOString(),
      from: failedState,
      to: 'BLOCKED',
      trigger: 'MAX_RETRIES_EXCEEDED'
    });
  }
  
  saveState(state);
}
