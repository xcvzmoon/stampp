# CONTEXT — Stampp domain glossary

Canonical product and architecture terms. Prefer these names in code, docs, and reviews.

## Product domain

| Term                      | Meaning                                                                                                      |
| ------------------------- | ------------------------------------------------------------------------------------------------------------ |
| **Workspace**             | Tenancy root. Implemented as a Better Auth organization. All product data is workspace-scoped.               |
| **Member**                | A user’s membership in a workspace, carrying a role.                                                         |
| **Role**                  | `owner` \| `admin` \| `manager` \| `member` \| `guest` — maps to permission strings.                         |
| **Permission**            | Stable string such as `time:write:own`, `time:approve`, `reports:view:cost`.                                 |
| **Client**                | External customer of a workspace; optional parent of projects.                                               |
| **Project**               | Unit of billable work; may belong to a client.                                                               |
| **Task**                  | Optional breakdown under a project.                                                                          |
| **Time entry**            | Recorded work: interval or duration, optional project/task, billable flag.                                   |
| **Running timer**         | The single open time entry for a user in a workspace (v0.1 policy).                                          |
| **Attendance record**     | Clock-in/clock-out punch pair separate from project time; one open punch per member per workspace.           |
| **Time-off type**         | Workspace leave category with optional annual allowance; paid/unpaid and approval policy.                    |
| **Time-off request**      | Inclusive date range leave request (`pending` \| `approved` \| `rejected` \| `canceled`) with business days. |
| **Holiday**               | Workspace non-working calendar date excluded from time-off day counts.                                       |
| **Billable rate**         | Revenue rate applied to billable hours.                                                                      |
| **Labor cost rate**       | Internal cost rate applied to tracked hours.                                                                 |
| **Effective rate**        | Resolved rate for a user/project/task at a point in time (see Rates module).                                 |
| **Timesheet**             | Weekly approval row for a member (`submitted` \| `approved` \| `rejected`); freezes edits when not draft.    |
| **Expense**               | Reimbursable cost record (category, amount minor + currency, optional S3 receipt).                           |
| **Invoice**               | Client billing document generated from billable time/expenses; status machine + payments.                    |
| **Project budget**        | Hours and/or money ceiling with threshold alerts (`warning` / `exceeded`).                                   |
| **Personal access token** | Workspace-scoped API credential (`stpp_…`); Bearer auth for product routes.                                  |

## Architecture modules (deep modules)

| Module                | Interface (external seam)                                      | Implementation hides                                              |
| --------------------- | -------------------------------------------------------------- | ----------------------------------------------------------------- |
| **WorkspaceAccess**   | `enterWorkspace(event, permission)` → `AuthorizedContext`      | Session, membership load, permission check, scoped db             |
| **AuthorizedContext** | `{ userId, workspaceId, role, db }`                            | `db` already bound to workspace; cannot query other tenants       |
| **TimeTracking**      | `start` · `stop` · `addManual` · `update` · `remove` · `range` | Overlap, single running timer, UTC/tz, duplicate/split, audit     |
| **Attendance**        | `clockIn` · `clockOut` · `current` · manual correct            | Single open punch, duration, work date/timezone, audit            |
| **TimeOff**           | `request` · `withdraw` · `approve` · `balance` · `calendar`    | Status machine, weekday/holiday day counts, allowance balances    |
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
