# Architecture Checklists (from ka-think, merged into ka-plan 6.0)

## NFR checklist (Architecture mode, mandatory)

```
📊 Non-Functional Requirements
Performance:     [req/s, latency target, or "not critical now"]
Scale:           [users, data volume, peak traffic]
Security:        [data sensitivity, compliance]
Reliability:     [downtime tolerance, data-loss tolerance]
Maintainability: [team size, on-call expectation]
Cost:            [infrastructure budget]
```
Unknown → propose a default and tag it `[ASSUMPTION]`.

## Risk assessment (per approach, Architecture mode)

```
⚠️ Risk Assessment — [Approach X]
High risk:     - [risk] → Mitigation: [strategy]
Medium risk:   - [risk] → Mitigation: [strategy]
Breaking changes:          - [impacted components]
Irreversible after commit: - [one-way-door decisions]
```
Decision log for Architecture mode adds: impact scope, one-way door (yes → extra confirmation), ADR number.

## Questioning checklist

**Structural integrity**
- State boundary: domain-level or UI-level data? Who owns it?
- Boundary violations: responsibilities crossing layers?
- Contract location: shared schemas in a dedicated contract package?

**Security & data safety**
- Tenant id derived from secure context, never client input?
- Side effects emitted only after the DB transaction commits?
- Validation boundary between untrusted input and domain logic?

**Coupling & maintainability**
- Direct import of another module's repository/service?
- Cascade surface: what else changes if this changes?
- Single source of truth for shared structures?

**Resilience**
- Failure mode: graceful degradation if component X dies?
- Idempotency: safe to retry without duplicate effects?
- Observability: how would you debug this at 3 AM?

Flag a critical violation immediately — do not wait for the end.

## Proof of knowledge

Every non-trivial recommendation:
1. **Statement** — the rule or recommendation.
2. **Reasoning** — why it applies here.
3. **Evidence**, strongest available: (a) documented internal standard/ADR → (b) widely adopted industry pattern → (c) concrete failure example → (d) explicit new proposal ("not yet documented — add an ADR if adopted").

When something is (d), say so; the user may challenge it.
