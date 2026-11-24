# Language & Autonomous Interaction Standard

## 1. Core Principle
This standard governs the dual-language operational contract for all AI agents, subagents, and skills across the repository.

> **Rule of Thumb**: 
> - **Autonomous Execution & Internal State** = **English (EN)**
> - **User Interaction & Output Deliverables** = **User's Input Language (VI/EN)**

---

## 2. Autonomous Execution (English Only)

All autonomous, internal, and programmatic tasks must be conducted strictly in **English**:
1. **Chain of Thought & Internal Reasoning**: Hidden thinking, scratchpads, planning trees, and step evaluations.
2. **Tool Invocations & Shell Commands**: Tool arguments, script execution, CLI parameters, and API requests.
3. **Internal Memory & State Artifacts**:
   - `.agents/memory/decisions.json`
   - `.agents/memory/state.json`
   - `.agents/config/workflow.json`
   - Code comments, commit messages, variable names, and schemas.
4. **Skill Instructions & System Prompts**: All `SKILL.md` definitions, checklists, rule validations, and references must be authored in English to ensure deterministic LLM instruction-following and maximum reasoning capability.

---

## 3. User Interaction & Deliverables (Mirror User Language)

All outward-facing communications must strictly adapt to the **user's chosen language**:
1. **Conversational Prompts & Questions**:
   - Clarifying questions from `ka-intake`.
   - Socratic guidance, exploratory questions, and options from `ka-plan` and `ka-think`.
   - Risk-tier confirmations and parameter confirmations from `ka-execute` and `git-guardian`.
2. **Deliverables & Reports**:
   - Final responses in the chat.
   - User-facing artifacts, progress reports, handoff summaries (`docs/handoff/`), and verification reports.
   - If the user asks in **Vietnamese**, the agent MUST reply, ask clarifying questions, request confirmations, and deliver reports in **Vietnamese**.
   - If the user asks in **English**, the agent MUST respond in **English**.
3. **Technical Terms & Code Entities**:
   - Keep technical terms (e.g. *Clean Architecture*, *Port & Adapter*, *FSM*, *Pull Request*, *Commit Hash*) and code identifiers (file paths, function names) intact while explaining them naturally in the user's language.

---

## 4. Operational Matrix

| Workflow Stage | Component / Skill | Internal Processing | User-Facing Output |
|---|---|---|---|
| **Intake** | `ka-intake` | Checklist validation in EN | Batched questions in User Language (VI/EN) |
| **Design** | `ka-plan` (incl. `ka-think` alias) | Architectural reasoning in EN; writes `decisions.json` in EN | Mode E/Q/D/A dialogue & summaries in User Language |
| **Lifecycle & Routing** | `ka-workflow` (incl. `ka-execute` alias) | State transitions, schema validation & payloads in EN | Gate & risk-tier confirmation prompts in User Language |
| **Git Safety** | `git-guardian` | Command risk evaluation in EN | Warning prompts & pre/post-flight reports in User Language |
| **Implementation** | `ka-be`, `ka-fe`, `ka-db-schema`, `ka-ops`, `ka-test` | Code, tests, and configuration in EN | Task status summary in User Language |
| **Review & Audit** | `ka-review` | AST/pattern grep analysis in EN | Code review report in User Language |
| **Handoff** | `ka-handoff` | Analyzes git & runtime state in EN | Handoff markdown document matching user's context |
