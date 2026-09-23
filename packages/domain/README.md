# @stampp/domain

Pure domain rules for Stampp. No HTTP, no database, no side effects. Other packages depend on this one; this package depends on nothing in the monorepo.

## What lives here

| Module                                                                 | Concern                                                   |
| ---------------------------------------------------------------------- | --------------------------------------------------------- |
| `money`                                                                | Integer minor units, same-currency arithmetic             |
| `duration`                                                             | Interval and duration math                                |
| `rates`                                                                | Effective-rate resolution and as-of windows               |
| `permissions`                                                          | Stable `Permission` strings and role grants               |
| `roles`                                                                | Built-in ladder (`owner` … `guest`) and custom-role merge |
| `timeOff`                                                              | Request status machine, business-day counts               |
| `timesheets`                                                           | Submit/approve freeze rules                               |
| `attendance`                                                           | Punch pair rules                                          |
| `approvalChains`                                                       | Multi-stage run advancement                               |
| `scheduling`                                                           | Capacity vs assignment flags                              |
| `budgets`, `expenses`, `invoices`                                      | Money and threshold rules                                 |
| `kiosk`, `sso`, `saml`, `scim`, `webhooks`, `import`, `auditRetention` | Domain types and invariants                               |

## Usage

```ts
import { money, addMoney, resolveEffectiveRates, hasPermission } from '@stampp/domain';
```

Keep handlers thin: validate at the edge (`@stampp/shared`), authorize with `@stampp/access`, then call domain functions. Do not import `drizzle`, `h3`, or Nitro here.

## Rate precedence

Fixed and not workspace-configurable: task → project → user-in-project → user → workspace. History is versioned as-of; rate changes never rewrite past rows.

## Test

Unit tests live in `tests/` and run with the repo suite:

```bash
vp run test
vp run typecheck
```
