# CONTEXT — Stampp domain glossary

Canonical product and architecture terms. Prefer these names in code, docs, and reviews.

## Product domain

| Term                      | Meaning                                                                                                             |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| **Workspace**             | Tenancy root. Implemented as a Better Auth organization. All product data is workspace-scoped.                      |
| **Member**                | A user’s membership in a workspace, carrying a role.                                                                |
| **Role**                  | `owner` \| `admin` \| `manager` \| `member` \| `guest`, or a workspace custom role over the same permissions.       |
| **Custom role**           | Workspace-defined permission set using the shared Permission vocabulary; overrides the built-in role when assigned. |
| **SSO provider**          | Workspace OIDC configuration (issuer, client, optional email-domain allow-list) used for single sign-on.            |
| **SAML provider**         | Workspace SAML IdP configuration (entity id, SSO URL, signing cert) used for SP-initiated single sign-on.           |
| **SCIM token**            | Workspace bearer token for IdP-driven user/group provisioning against `/scim/v2`.                                   |
| **Import job**            | Workspace import run (CSV or vendor CSV) with dry-run preview and row counters.                                     |
| **Audit retention**       | Workspace policy for how long `audit_events` rows are kept before purge.                                            |
| **Permission**            | Stable string such as `time:write:own`, `time:approve`, `reports:view:cost`.                                        |
| **Client**                | External customer of a workspace; optional parent of projects.                                                      |
| **Project**               | Unit of billable work; may belong to a client.                                                                      |
| **Task**                  | Optional breakdown under a project.                                                                                 |
| **Time entry**            | Recorded work: interval or duration, optional project/task, billable flag.                                          |
| **Running timer**         | The single open time entry for a user in a workspace (v0.1 policy).                                                 |
| **Attendance record**     | Clock-in/clock-out punch pair separate from project time; one open punch per member per workspace.                  |
| **Time-off type**         | Workspace leave category with optional annual allowance; paid/unpaid and approval policy.                           |
| **Time-off request**      | Inclusive date range leave request (`pending` \| `approved` \| `rejected` \| `canceled`) with business days.        |
| **Holiday**               | Workspace non-working calendar date excluded from time-off day counts.                                              |
| **Member capacity**       | Weekly working hours for a member; baseline for scheduling and overbooking checks.                                  |
| **Project assignment**    | Member hours per week on a project for an inclusive date range.                                                     |
| **Kiosk device**          | Registered shared clock device authorized by a one-time device key; punches attendance only.                        |
| **Kiosk credential**      | Member PIN and/or QR token (hashes only) used to punch from a kiosk.                                                |
| **Approval chain**        | Ordered multi-stage approver list for timesheets or time-off requests (1–5 stages).                                 |
| **Approval run**          | Active instance of a chain for one submission; advances until final approve or reject.                              |
| **Billable rate**         | Revenue rate applied to billable hours.                                                                             |
| **Labor cost rate**       | Internal cost rate applied to tracked hours.                                                                        |
| **Effective rate**        | Resolved rate for a user/project/task at a point in time (see Rates module).                                        |
| **Timesheet**             | Weekly approval row for a member (`submitted` \| `approved` \| `rejected`); freezes edits when not draft.           |
| **Expense**               | Reimbursable cost record (category, amount minor + currency, optional S3 receipt).                                  |
| **Invoice**               | Client billing document generated from billable time/expenses; status machine + payments.                           |
| **Project budget**        | Hours and/or money ceiling with threshold alerts (`warning` / `exceeded`).                                          |
| **Personal access token** | Workspace-scoped API credential (`stpp_…`); Bearer auth for product routes.                                         |
| **Webhook subscription**  | Workspace HTTPS endpoint with a signing secret; receives selected product events.                                   |
| **Webhook delivery**      | One attempt chain for an event to a subscription (`pending` → `success` / `failed` → `dead`).                       |
| **Idempotency-Key**       | Optional client key on `/api/v1` mutations; replays the stored response for safe retries.                           |

## Architecture modules (deep modules)

| Module                | Interface (external seam)                                      | Implementation hides                                              |
| --------------------- | -------------------------------------------------------------- | ----------------------------------------------------------------- |
| **WorkspaceAccess**   | `enterWorkspace(event, permission)` → `AuthorizedContext`      | Session, membership load, permission check, scoped db             |
| **AuthorizedContext** | `{ userId, workspaceId, role, db }`                            | `db` already bound to workspace; cannot query other tenants       |
| **TimeTracking**      | `start` · `stop` · `addManual` · `update` · `remove` · `range` | Overlap, single running timer, UTC/tz, duplicate/split, audit     |
| **Attendance**        | `clockIn` · `clockOut` · `current` · manual correct            | Single open punch, duration, work date/timezone, audit            |
| **TimeOff**           | `request` · `withdraw` · `approve` · `balance` · `calendar`    | Status machine, weekday/holiday day counts, allowance balances    |
| **Scheduling**        | `capacity` · `assign` · `workload`                             | Weekly capacity, scheduled vs tracked, over/under flags           |
| **Kiosk**             | `register` · `pin` · `qr` · `punch`                            | Device key auth, attendance-only punches, no project time         |
| **ApprovalChains**    | `configure` · `start` · `decide` · `cancel`                    | Multi-stage runs, step gating, final entity decision              |
| **Rates**             | `resolveEffectiveRates` + as-of windows                        | Precedence task → project → user-in-project → user → org; history |
| **Timesheets**        | `submit` · `withdraw` · `approve` · `reject`                   | Status machine, week freeze, entry locks                          |
| **MailDispatch**      | `notify(event)` where event is invite/timesheet/invoice/…      | BullMQ enqueue, worker, UnEmail driver, templates                 |
| **AuditTrail**        | `record(actor, action, entity, before, after, meta)`           | Append-only `audit_events` adapter                                |

## Package vocabulary

| Package               | Contains                                                                  |
| --------------------- | ------------------------------------------------------------------------- |
| **packages/domain**   | Pure domain: money, duration, rate types, rounding. No HTTP, no DB.       |
| **packages/shared**   | Valibot HTTP schemas, error codes, DTO types for the API surface.         |
| **packages/access**   | WorkspaceAccess + AuthorizedContext.                                      |
| **packages/database** | Drizzle schemas, scoped-db factory, migrations.                           |
| **packages/mailer**   | UnEmail driver selection, templates, MailDispatch adapter implementation. |
| **packages/sdk**      | Typed public API client over personal access tokens.                      |

## Decisions already locked

- Better Auth organization **=** Workspace (no duplicate workspaces table in v0.1).
- UnEmail is **transport only**; BullMQ owns durable jobs.
- Valkey is **required** (cache + BullMQ broker).
- Varlock owns env/secrets; Valibot owns request validation.
- Audit is recorded **inside deep modules**, not HTTP middleware.
- Rate precedence is **fixed** (not workspace-configurable) with historical as-of resolution.
- Rate changes **never rewrite history** — supersede with a new version or revoke going forward.
- Submitted/approved timesheets **freeze** member time edits; approve locks `time_entries.locked_at`.
- RLS is **defense in depth**; product handlers still filter `workspace_id` on every query.
- PATs authenticate product APIs via `Authorization: Bearer stpp_…` (same workspaceAccess seam).
- node-caged (pointer-compressed Node) is **optional later**; default runtime remains official Node.
