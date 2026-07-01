# Opportunity Scanner Automation Prompt Drafts

These are durable prompts to test manually before scheduling Codex automations. Use worktrees for scheduled runs when possible so automation changes do not collide with active local work.

## Daily Operating Review

Schedule: weekday morning or manual session start.

```text
Use the Chief of Staff Agent for Opportunity Scanner.

Inspect the current repo state, Git status, recent changed files, existing agent briefs, docs, and local scan/test artifacts. Do not write code unless there is an obvious broken operating-system file that needs a small repair.

Produce a concise founder-facing operating review:

1. What changed since the last review, if detectable
2. Current launch-readiness status
3. Active workstreams
4. Blockers and risks
5. Highest-leverage action for today
6. Recommended agent assignments
7. Git/checkpoint recommendation

Only report findings that matter for getting Opportunity Scanner closer to usable MVP/beta.
```

## Weekly Launch Readiness Review

Schedule: weekly.

```text
Use the Chief of Staff Agent and Project Management Agent for Opportunity Scanner.

Review the repo, docs, agent briefs, current product state, open risks, and available test outputs. Do not redesign from scratch.

Produce a weekly launch readiness review:

1. What shipped or improved
2. What is blocked
3. What is risky
4. What should be killed or deferred
5. What should happen next
6. Whether the product is closer to launch
7. Next sprint proposal with owners and acceptance criteria

Keep the review founder-friendly and execution-oriented.
```

## Regression QA Review

Schedule: after report logic, connector, scoring, or playbook changes.

```text
Use the Project Management Agent, Back-End Agent, Connector Agent, Front-End Agent, and Product Strategy & Product Marketing Agent as needed.

Run or inspect the report quality checks for the golden examples: Reparel, Jammcard, and SchoolGig. If commands cannot run, report the environment blocker clearly.

Assess whether each scan produces useful, sourced, actionable opportunity signals with:

- target organization
- source
- signal type
- revenue motion
- actionability
- contact path
- next best action
- workflow-ready payload state

Flag regressions, irrelevant signals, missing source credibility, exposed debug/internal data, and front-end/back-end data contract mismatches.

Return:

1. QA status
2. Pass/fail by example company
3. Highest-priority fixes
4. Owner agent for each fix
5. Definition of done
```

## Agent System Health Check

Schedule: after major agent or operating-process edits.

```text
Review `AGENTS.md` and `.agents/*.md` for Opportunity Scanner.

Check whether the agent system still preserves these boundaries:

- Chief of Staff Agent is founder-facing orchestrator
- Product Strategy & Product Marketing Agent owns product direction and positioning
- Project Management Agent owns task tracking and completion discipline
- Front-End Agent owns user-facing experience
- Back-End Agent owns data/action/report/workflow logic
- Connector Agent owns external source integrations

Identify duplication, role confusion, stale product priorities, missing launch criteria, and unclear handoffs. Make small documentation fixes if needed, then summarize what changed.
```
