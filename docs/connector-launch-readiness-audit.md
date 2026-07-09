# Connector Launch Readiness Audit

**Audit date:** July 9, 2026
**Owner:** Connector Agent
**Integration owner:** Chief of Staff thread
**Scope:** Existing source registry, runtime router, connector implementations, activation behavior, source-native contact handling, and safe local tests. No connector code, environment files, production code, or launch copy was changed. No enrichment lookup or paid-credit call was made.

## Connector Summary

**Launch verdict: conditionally beta-usable, not yet ready for broad source-coverage claims.**

The current runtime can produce useful reports from USAspending.gov, Grants.gov, and Federal Register without credentials. Those three public endpoints responded successfully on July 9, 2026, and representative Reparel, Jammcard, and SchoolGig queries returned raw source records. Existing report artifacts also show useful USAspending/Grants evidence for all three regression companies.

The scan router uses `Promise.allSettled`, so a connector rejection is isolated instead of automatically failing the full scan. Missing SAM.gov credentials also skip SAM safely. However, none of the external discovery connectors has a request timeout. A slow or hung source can therefore prevent `Promise.allSettled` from resolving and stall scan completion. Most connector HTTP failures are also converted to empty arrays, making an outage look like “zero matches” with no persistent source health or activation record.

The launch source set is narrower than the product's source-facing surfaces imply:

- Runtime discovery implementations: USAspending.gov, SAM.gov, Grants.gov, Federal Register, and a deliberately disabled state/local routing stub.
- Runtime contact enrichment implementation: Snov, after source-native contact preference and Clay fallback logic.
- Smoke-test-only, not runtime discovery: Regulations.gov, Census, BLS, FRED, O*NET, DOL, USAJOBS, and College Scorecard.
- No implementation or smoke test found: CMS.

SAM.gov and Snov credentials are missing in this worktree. SAM is therefore unavailable for active federal solicitation coverage; Snov correctly returns a non-configured result in enrichment code, but the source registry currently labels Snov `Active` regardless of credential state.

## Runtime And Activation Findings

1. Playbooks activate `usaspending.gov` and `federal_register` for Reparel, Jammcard, and SchoolGig. They place `grants.gov` and `sam.gov` in `planned_source_categories`.
2. The discovery router nevertheless attempts Grants.gov and SAM.gov when either source is active **or planned**. Grants.gov therefore runs in production today despite being marked planned by playbooks. SAM.gov runs only when `SAM_API_KEY` is configured.
3. Planned state/local categories invoke the state/local connector, but it intentionally returns no records until a real posting, source URL, deadline/timing, and buyer/contact path can be verified. This is safe and avoids presenting portal links as opportunities.
4. USAspending, Grants.gov, Federal Register, and SAM.gov preserve source name, source URL, query used, evidence, and source-specific raw metadata. Grants.gov structures a program contact in `pointOfContact`; SAM.gov preserves its source-native contact array. Both give appropriate warnings about contact role.
5. There is no persisted `last_tested_at`, result count, actionable count, error, latency, or activation event for source runs. The admin source catalog is configuration guidance, not a connector health log.

## Source Health Matrix

Statuses use the required project vocabulary: `active`, `planned`, `needs_api_key`, `failing`, or `disabled`.

| source_name | status | credential_required | credential_configured | last_tested_at | query_used | result_count | actionable_count | error_message / notes |
|---|---|---:|---:|---|---|---:|---:|---|
| USAspending.gov | `active` | No | N/A | 2026-07-09 | `live music`; regression probes: `durable medical equipment`, `live music`, `teacher recruitment` | Project smoke: 1; regression probes: 3 each | Not measured | Public endpoint healthy. Fresh filtered report evaluation unavailable in this worktree. |
| SAM.gov | `needs_api_key` | Yes: `SAM_API_KEY` | No | 2026-07-09 | Test skipped before query; planned defaults include `live music services`, `entertainment services`, `teacher recruitment` | 0 | 0 | `SAM_API_KEY` not configured. Router skips the connector and scan completion continues. |
| Grants.gov | `active` | No | N/A | 2026-07-09 | `arts education`; regression probes: `durable medical equipment`, `live music`, `teacher recruitment` | Project smoke: search + detail succeeded; regression probes: 5 each | Not measured | Smoke detail had no source contact. Connector can still emit a search hit when detail fetch fails, with reduced detail/contact data. |
| Federal Register | `active` | No | N/A | 2026-07-09 | `durable medical equipment`, `live music`, `teacher recruitment` | 3 each | Not measured | Direct endpoint smoke passed. No dedicated project smoke-test function exists. Connector correctly treats records as monitor/research context. |
| Regulations.gov | `planned` | Yes: `REGULATIONS_API_KEY` | No | 2026-07-09 | Test skipped before `music` query | 0 | 0 | Smoke-test-only. No source registry entry, runtime connector, or router activation. |
| Census | `planned` | Yes in current test: `CENSUS_API_KEY` | No | 2026-07-09 | Test skipped before California ACS population query | 0 | 0 | Smoke-test-only. No runtime connector or activation path. |
| BLS | `planned` | Yes in current test: `BLS_API_KEY` | No | 2026-07-09 | Test skipped before CPI series `CUUR0000SA0` | 0 | 0 | Smoke-test-only. No runtime connector or activation path. |
| FRED | `planned` | Yes: `FRED_API_KEY` | No | 2026-07-09 | Test skipped before unemployment series `UNRATE` | 0 | 0 | Smoke-test-only. No runtime connector or activation path. |
| O*NET | `planned` | Yes: `ONET_API_KEY` | No | 2026-07-09 | Test skipped before `musician` occupation search | 0 | 0 | Smoke-test-only. No runtime connector or activation path. |
| CMS | `planned` | No project credential contract found | No credential expected/unknown | Not tested | None | 0 | 0 | No connector, registry entry, router activation, or test found. CMS appears only in content/sample context. |
| DOL | `planned` | Yes: `DOL_API_KEY` | No | 2026-07-09 | Test skipped before OSHA accident sample | 0 | 0 | Smoke-test-only. Existing test checks OSHA accidents, not workforce funding/opportunity records. |
| USAJOBS | `planned` | Yes: `USAJOBS_API_KEY` + `USAJOBS_USER_AGENT` | No | 2026-07-09 | Test skipped before `music` jobs query | 0 | 0 | Smoke-test-only. No runtime connector or activation path. |
| College Scorecard | `planned` | Yes: `COLLEGE_SCORECARD_API_KEY` | No | 2026-07-09 | Test skipped before school-name `music` query | 0 | 0 | Smoke-test-only. No runtime connector or activation path. |
| Snov | `needs_api_key` | Yes: `SNOV_CLIENT_ID` + `SNOV_CLIENT_SECRET` | No | 2026-07-09 | OAuth test skipped; no domain lookup attempted | 0 | 0 | No credits spent. Runtime returns `not_configured`; registry incorrectly reports `Active` regardless of configuration. |

`actionable_count` is intentionally reported as “Not measured” for healthy public endpoints because endpoint hits are not the same as filtered Opportunity Scanner rows. The fresh report evaluator could not run without `.data/local-db.json`.

## Launch Value, Failure Behavior, And Next Test

| Source | Current launch value | Current failure behavior | Next safe test |
|---|---|---|---|
| USAspending.gov | Core money-moved evidence, funded buyers, recipients, agencies, and prior buying patterns. Strongest current source for Reparel; useful for Jammcard and SchoolGig market maps. | Non-2xx responses are silently skipped per award-type group. A thrown request is isolated by the router, but there is no request timeout or health event. | Run fresh Reparel, Jammcard, and SchoolGig scans; confirm source URLs, historical labels, buyer/channel paths, and no stale award framed as an open bid. |
| SAM.gov | Only implemented source for active federal solicitations, sources sought, notices, and source-native contracting contacts. | Missing key returns/skips cleanly. Per-query HTTP failures are silently converted to no results. No timeout or activation log. | Founder-approved key setup, then `test:sam` for Reparel medical/orthotics, Jammcard live performance, and SchoolGig teacher recruitment terms; verify notice types and deadlines. |
| Grants.gov | Active/forecasted funding, eligibility signals, deadlines, applicants/recipients, and program contacts. Strong current value for Jammcard and SchoolGig; secondary funded-buyer value for Reparel. | Search/detail non-2xx responses become empty/null. A missing detail response can reduce evidence and contact data without recording a health failure. No timeout. | Run fresh three-company scans and manually validate direct-apply versus funded-buyer classification, deadlines, and program-contact labeling. |
| Federal Register | Early policy, reimbursement, program-design, and demand context; most relevant to Reparel and selected workforce/arts policy lanes. | Non-2xx becomes zero records; thrown request is isolated by router. No timeout or health record. | Add a repeatable smoke path using the three regression terms, then confirm policy records remain `Monitor Policy`/research unless paired with a buyer, grant, or procurement path. |
| Regulations.gov | Potential public-comment and rulemaking context. Not needed for the first beta action workflow. | Not called by runtime, so it cannot break scans. Test is skipped without key. | Keep planned. After core workflow validation, run credential-only smoke and compare incremental value against Federal Register before considering activation. |
| Census | Market/geography context, not a direct opportunity source. | Not called by runtime. | Keep planned; later test only if a specific report decision needs geographic market sizing. |
| BLS | Workforce and occupation context for SchoolGig/Jammcard lanes, not a direct lead source. | Not called by runtime. | Keep planned; later test a job/occupation series tied to a defined action field, not generic CPI. |
| FRED | Macro context only; lowest immediate action value. | Not called by runtime. | Keep planned; no launch test needed before the opportunity-to-action flow is validated. |
| O*NET | Occupation/role taxonomy that could sharpen workforce matching and target roles. | Not called by runtime. | Keep planned; later compare role/lane quality for SchoolGig and Jammcard before activation. |
| CMS | High potential reimbursement/program context for Reparel, but no current runtime source value. | Not called by runtime. | Keep planned; first define the specific CMS record type and revenue action it would improve. Do not add a connector solely for broader coverage. |
| DOL | Potential workforce grants/program context for SchoolGig and Jammcard. Current smoke target (OSHA accidents) does not prove that value. | Not called by runtime. | Keep planned; later replace/augment the test only after defining a specific DOL funding or program source that maps to an action. |
| USAJOBS | Hiring-demand context and agency workforce patterns, not procurement by itself. | Not called by runtime. | Keep planned; later test whether postings improve SchoolGig buyer/program targeting without being mislabeled as sales opportunities. |
| College Scorecard | Institution discovery/context for SchoolGig; not direct funding or procurement. | Not called by runtime. | Keep planned; later validate whether it improves institution targeting after the core action table is stable. |
| Snov | P1 email/contact enrichment after a buyer/recipient domain and target roles are validated. Source-native contacts are preferred first. | Missing credentials return `not_configured` and do not affect scan discovery. A lookup failure is caught and persisted as a provider result. No credits were used in this audit. | Correct status reporting, validate buyer-domain resolution, then run one founder-approved capped lookup on a qualified paid-report target. |

## Regression Company Readiness

| Company | Current useful sources | Readiness assessment | Gap before connector sign-off |
|---|---|---|---|
| Reparel | USAspending is proven in existing report artifacts; Grants.gov and Federal Register endpoints are reachable for DME/health terms. | Useful for buyer/channel and reimbursement-context reports. The current active set can produce a report without SAM or Snov. | Fresh filtering/actionability check is required. Active VA/medical procurement coverage remains unverified until SAM is configured and tested. |
| Jammcard | Existing artifacts show USAspending and Grants.gov arts/music signals; both public endpoints and Federal Register responded to live-music terms. | Best-covered of the three for current grant, funded-recipient, arts, and cultural-programming lanes. | Fresh scan must confirm expired grants and historical awards are correctly labeled and that policy noise remains low. Local/state opportunity routes remain intentionally disabled. |
| SchoolGig | Existing artifacts show USAspending and Grants.gov educator-workforce/arts-education evidence; endpoints responded to teacher-recruitment terms. | Current sources can support workforce, funded-partner, and arts-education reports without breaking on missing optional keys. | Fresh scan must confirm health/justice noise is still suppressed and that grant contacts are not presented as sales buyers. Active staffing/procurement coverage remains unverified without SAM. |

**Overall:** the active sources are sufficient for a tightly scoped beta centered on funded-buyer, grant, and policy signals. They are not sufficient to claim comprehensive active procurement, vertical-source, or labor-market coverage. Missing optional keys do not currently break scan completion, but lack of connector timeouts means external latency still can.

## P0 Launch Blockers

1. **Protect scan completion with bounded connector requests.** Add per-source timeouts/cancellation and an overall discovery deadline before public launch. `Promise.allSettled` handles rejection, not a request that never settles.
2. **Resolve the SAM launch promise.** Either configure `SAM_API_KEY` with founder approval and pass Reparel/Jammcard/SchoolGig smoke + report tests, or explicitly scope beta claims so active federal solicitations are not implied. Do not silently present SAM as scanned when it was skipped.
3. **Complete a fresh end-to-end regression.** The report evaluator failed because `.data/local-db.json` is absent, and the launch-environment checker reported all required launch variables missing in this worktree. Endpoint health alone cannot sign off filtered relevance, actionability, source labeling, or scan completion.
4. **Align source status with actual runtime coverage before launch.** Runtime-active, credential-blocked, test-only/planned, and disabled sources must not be conflated. In particular, the registry's unconditional Snov `Active` status is inaccurate, and CMS/Regulations/BLS/Census/DOL content references should not be interpreted as live connector evidence.

## P1 Improvements

1. Persist a source activation/health record with source name, status, credential state, started/completed time, query count, raw result count, accepted/actionable count, latency, and sanitized error.
2. Add Federal Register to the project smoke-test script and make the script selectable by source so operators can avoid all enrichment providers during connector checks.
3. Record suppressed HTTP failures instead of converting every failure to an indistinguishable empty result.
4. Make Snov registry status depend on `isSnovConfigured()` and retain source-native-contact-first behavior. Validate domain and role before any paid lookup.
5. Clarify activation semantics: `planned_source_categories` should not implicitly mean “run now” unless that behavior is intentionally documented.
6. Improve source-specific tests before activating any context source. BLS should test workforce evidence, and DOL should test workforce funding/program data rather than generic CPI/OSHA samples.

## Dependencies And Blockers

- Founder approval is required to add credentials. No secret values were viewed or printed; only configured/missing state was checked.
- `SAM_API_KEY`, `SNOV_CLIENT_ID`, and `SNOV_CLIENT_SECRET` are missing in this worktree.
- Regulations.gov, Census, BLS, FRED, O*NET, DOL, USAJOBS, and College Scorecard test credentials are also missing.
- The local regression database `.data/local-db.json` is absent, so current actionable counts and full report quality could not be measured.
- CMS has no implementation or safe test path in the current repository.

## Tests Run

| Test | Result |
|---|---|
| `scripts/check-launch-env.mjs` | Completed with expected non-zero status: 0/5 required and 0/3 recommended launch variables configured in this worktree. Only configured/missing state was reported. |
| `scripts/test-api-connectors.mjs` | Passed USAspending.gov (1 sample award) and Grants.gov search + detail (detail without contact). All credentialed government/context and enrichment tests warned as not configured; no paid/enrichment endpoint was called. |
| `scripts/test-sam-connector.mjs` | Skipped safely because `SAM_API_KEY` is not configured; exited successfully. |
| Safe USAspending regression probes | HTTP 200; 3 raw sample award results each for Reparel (`durable medical equipment`), Jammcard (`live music`), and SchoolGig (`teacher recruitment`). |
| Safe Grants.gov regression probes | HTTP 200; 5 raw search results each for the same three representative terms. |
| Safe Federal Register regression probes | HTTP 200; 3 raw document results each for the same three representative terms. |
| `scripts/evaluate-local-reports.mjs` | Blocked: `.data/local-db.json` does not exist. No current actionable-count result is available. |

## Changed Files

- `docs/connector-launch-readiness-audit.md` — created this audit only.

## Recommended Next Actions

1. Chief of Staff assigns P0 connector timeouts and sanitized activation logging to Connector + Back-End with a shared result contract.
2. Founder decides whether SAM-backed active procurement is required for beta; if yes, approve credential setup and run the three-company test matrix.
3. Restore or generate fresh local regression scans, run the report evaluator, and manually review source labels, deadlines, contact roles, and next actions.
4. Launch with the narrow validated source set. Keep Regulations.gov, Census, BLS, FRED, O*NET, CMS, DOL, USAJOBS, and College Scorecard planned until the core opportunity-to-action workflow is proven.

**Do not add more APIs before the core workflow is validated.** The highest-leverage connector work is reliability, truthful status, current regression evidence, and action quality from the sources already implemented.
