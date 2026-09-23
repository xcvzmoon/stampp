# @stampp/shared

HTTP contracts for Stampp: Valibot request/response schemas, error codes, and DTO types shared by the API, web app, and SDK. Depends on `@stampp/domain` for core types and Valibot for validation.

## What lives here

| Area               | Modules                                                                                        |
| ------------------ | ---------------------------------------------------------------------------------------------- |
| Core               | `schemas.ts`, `catalog.ts`, `errors.ts`, `publicApi.ts`, `organization.ts`                     |
| Time               | `time.ts`, `timesheets.ts`, `attendance.ts`, `timeOff.ts`, `scheduling.ts`                     |
| Rates and money    | `rates.ts`, `budgets.ts`, `expenses.ts`, `invoices.ts`                                         |
| Admin and security | `roles.ts`, `sso.ts`, `saml.ts`, `scim.ts`, `audit.ts`, `webhooks.ts`, `import.ts`, `kiosk.ts` |
| Approvals          | `approvalChains.ts`                                                                            |
| Reporting          | `reports.ts`, `advancedReports.ts`                                                             |

Exported from `src/index.ts`. Import as:

```ts
import { ERROR_CODES, type ApiError, type ApiResult } from '@stampp/shared';
```

## Error codes

`ERROR_CODES` is the stable vocabulary for API failures (`rate.invalid_target`, `time.overlap`, and so on). Map codes to HTTP status in one place (`apps/api/server/utils/errors.ts`). Clients surface `code`, `status`, and `requestId`.

## Validation

Prefer composable `v.pipe(...)` schemas at the boundary. Parse once when a request enters the API; inner layers trust typed input. Reuse these schemas in the web form layer and in `@stampp/sdk` instead of redeclaring shapes.

## Conventions

- Keep schemas additive and explicit. No `any`, no broad `object` inputs.
- DTO types mirror the wire format. Domain types stay in `@stampp/domain`.
- When you add a product route, extend the matching module here first so API, UI, and SDK stay aligned.

## Test

```bash
vp run test
vp run typecheck
```
