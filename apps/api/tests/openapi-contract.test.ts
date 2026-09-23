import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as v from 'valibot';
import { describe, expect, it } from 'vite-plus/test';

const productOperations = [
  'get /api/v1/workspaces/{workspaceId}/clients',
  'post /api/v1/workspaces/{workspaceId}/clients',
  'get /api/v1/workspaces/{workspaceId}/clients/{clientId}',
  'patch /api/v1/workspaces/{workspaceId}/clients/{clientId}',
  'delete /api/v1/workspaces/{workspaceId}/clients/{clientId}',
  'get /api/v1/workspaces/{workspaceId}/projects',
  'post /api/v1/workspaces/{workspaceId}/projects',
  'get /api/v1/workspaces/{workspaceId}/projects/{projectId}',
  'patch /api/v1/workspaces/{workspaceId}/projects/{projectId}',
  'delete /api/v1/workspaces/{workspaceId}/projects/{projectId}',
  'get /api/v1/workspaces/{workspaceId}/projects/{projectId}/budget',
  'get /api/v1/workspaces/{workspaceId}/projects/budgets',
  'get /api/v1/workspaces/{workspaceId}/projects/{projectId}/tasks',
  'post /api/v1/workspaces/{workspaceId}/projects/{projectId}/tasks',
  'patch /api/v1/workspaces/{workspaceId}/tasks/{taskId}',
  'delete /api/v1/workspaces/{workspaceId}/tasks/{taskId}',
  'get /api/v1/workspaces/{workspaceId}/tags',
  'post /api/v1/workspaces/{workspaceId}/tags',
  'patch /api/v1/workspaces/{workspaceId}/tags/{tagId}',
  'delete /api/v1/workspaces/{workspaceId}/tags/{tagId}',
  'get /api/v1/workspaces/{workspaceId}/timer',
  'post /api/v1/workspaces/{workspaceId}/timer/start',
  'post /api/v1/workspaces/{workspaceId}/timer/{entryId}/stop',
  'get /api/v1/workspaces/{workspaceId}/time-entries',
  'post /api/v1/workspaces/{workspaceId}/time-entries',
  'patch /api/v1/workspaces/{workspaceId}/time-entries/{entryId}',
  'delete /api/v1/workspaces/{workspaceId}/time-entries/{entryId}',
  'get /api/v1/workspaces/{workspaceId}/time-entries/weekly',
  'post /api/v1/workspaces/{workspaceId}/time-entries/copy-previous-week',
  'post /api/v1/workspaces/{workspaceId}/time-entries/{entryId}/duplicate',
  'get /api/v1/workspaces/{workspaceId}/reports/summary',
  'get /api/v1/workspaces/{workspaceId}/reports/detailed',
  'get /api/v1/workspaces/{workspaceId}/reports/weekly',
  'get /api/v1/workspaces/{workspaceId}/reports/profitability',
  'get /api/v1/workspaces/{workspaceId}/reports/utilization',
  'get /api/v1/workspaces/{workspaceId}/rates',
  'post /api/v1/workspaces/{workspaceId}/rates',
  'delete /api/v1/workspaces/{workspaceId}/rates/{rateId}',
  'get /api/v1/workspaces/{workspaceId}/rates/effective',
  'get /api/v1/workspaces/{workspaceId}/timesheets',
  'get /api/v1/workspaces/{workspaceId}/timesheets/own',
  'post /api/v1/workspaces/{workspaceId}/timesheets/submit',
  'post /api/v1/workspaces/{workspaceId}/timesheets/withdraw',
  'get /api/v1/workspaces/{workspaceId}/timesheets/pending',
  'post /api/v1/workspaces/{workspaceId}/timesheets/{timesheetId}/approve',
  'post /api/v1/workspaces/{workspaceId}/timesheets/{timesheetId}/reject',
  'get /api/v1/workspaces/{workspaceId}/expenses',
  'post /api/v1/workspaces/{workspaceId}/expenses',
  'patch /api/v1/workspaces/{workspaceId}/expenses/{expenseId}',
  'delete /api/v1/workspaces/{workspaceId}/expenses/{expenseId}',
  'post /api/v1/workspaces/{workspaceId}/expenses/{expenseId}/receipt',
  'get /api/v1/workspaces/{workspaceId}/expenses/{expenseId}/receipt',
  'get /api/v1/workspaces/{workspaceId}/invoices',
  'post /api/v1/workspaces/{workspaceId}/invoices',
  'post /api/v1/workspaces/{workspaceId}/invoices/generate',
  'get /api/v1/workspaces/{workspaceId}/invoices/{invoiceId}',
  'patch /api/v1/workspaces/{workspaceId}/invoices/{invoiceId}',
  'post /api/v1/workspaces/{workspaceId}/invoices/{invoiceId}/status',
  'post /api/v1/workspaces/{workspaceId}/invoices/{invoiceId}/payments',
  'get /api/v1/workspaces/{workspaceId}/invoices/{invoiceId}/pdf',
  'get /api/v1/workspaces/{workspaceId}/tokens',
  'post /api/v1/workspaces/{workspaceId}/tokens',
  'delete /api/v1/workspaces/{workspaceId}/tokens/{tokenId}',
  'get /api/v1/workspaces/{workspaceId}/export',
  'get /api/v1/workspaces/{workspaceId}/attendance',
  'post /api/v1/workspaces/{workspaceId}/attendance',
  'get /api/v1/workspaces/{workspaceId}/attendance/current',
  'post /api/v1/workspaces/{workspaceId}/attendance/clock-in',
  'post /api/v1/workspaces/{workspaceId}/attendance/clock-out',
  'patch /api/v1/workspaces/{workspaceId}/attendance/{recordId}',
  'delete /api/v1/workspaces/{workspaceId}/attendance/{recordId}',
  'get /api/v1/workspaces/{workspaceId}/time-off/types',
  'post /api/v1/workspaces/{workspaceId}/time-off/types',
  'patch /api/v1/workspaces/{workspaceId}/time-off/types/{typeId}',
  'delete /api/v1/workspaces/{workspaceId}/time-off/types/{typeId}',
  'get /api/v1/workspaces/{workspaceId}/time-off/holidays',
  'post /api/v1/workspaces/{workspaceId}/time-off/holidays',
  'delete /api/v1/workspaces/{workspaceId}/time-off/holidays/{holidayId}',
  'get /api/v1/workspaces/{workspaceId}/time-off/requests',
  'post /api/v1/workspaces/{workspaceId}/time-off/requests',
  'get /api/v1/workspaces/{workspaceId}/time-off/requests/pending',
  'post /api/v1/workspaces/{workspaceId}/time-off/requests/{requestId}/approve',
  'post /api/v1/workspaces/{workspaceId}/time-off/requests/{requestId}/reject',
  'post /api/v1/workspaces/{workspaceId}/time-off/requests/{requestId}/withdraw',
  'get /api/v1/workspaces/{workspaceId}/time-off/balances',
  'get /api/v1/workspaces/{workspaceId}/time-off/calendar',
  'get /api/v1/workspaces/{workspaceId}/schedules/capacities',
  'put /api/v1/workspaces/{workspaceId}/schedules/capacity',
  'get /api/v1/workspaces/{workspaceId}/schedules/assignments',
  'post /api/v1/workspaces/{workspaceId}/schedules/assignments',
  'patch /api/v1/workspaces/{workspaceId}/schedules/assignments/{assignmentId}',
  'delete /api/v1/workspaces/{workspaceId}/schedules/assignments/{assignmentId}',
  'get /api/v1/workspaces/{workspaceId}/schedules/workload',
  'get /api/v1/workspaces/{workspaceId}/kiosk/devices',
  'post /api/v1/workspaces/{workspaceId}/kiosk/devices',
  'patch /api/v1/workspaces/{workspaceId}/kiosk/devices/{deviceId}',
  'delete /api/v1/workspaces/{workspaceId}/kiosk/devices/{deviceId}',
  'post /api/v1/workspaces/{workspaceId}/kiosk/devices/{deviceId}/rotate-key',
  'put /api/v1/workspaces/{workspaceId}/kiosk/pin',
  'delete /api/v1/workspaces/{workspaceId}/kiosk/pin',
  'post /api/v1/workspaces/{workspaceId}/kiosk/qr.rotate',
  'get /api/v1/workspaces/{workspaceId}/kiosk/credentials',
  'post /api/v1/workspaces/{workspaceId}/kiosk/punch',
];

const openApiDocumentSchema = v.object({
  openapi: v.string(),
  info: v.object({
    title: v.string(),
    version: v.string(),
  }),
  paths: v.record(v.string(), v.record(v.string(), v.unknown())),
  components: v.optional(
    v.object({
      schemas: v.optional(v.record(v.string(), v.unknown())),
      securitySchemes: v.optional(v.record(v.string(), v.unknown())),
    }),
  ),
});

const specPath = fileURLToPath(new URL('../.output/public/api/v1/openapi.json', import.meta.url));

function loadBuiltSpec() {
  if (!existsSync(specPath)) {
    return null;
  }
  const result = v.safeParse(openApiDocumentSchema, JSON.parse(readFileSync(specPath, 'utf8')));
  if (!result.success) {
    throw new Error('Built OpenAPI document failed schema validation');
  }
  return result.output;
}

function operationKey(path: string, method: string): string {
  return `${method} ${path}`;
}

describe('v0.1 openapi contract', () => {
  it('documents every UI-used product operation', () => {
    expect(productOperations).toContain('get /api/v1/workspaces/{workspaceId}/tags');
    expect(productOperations).toContain('post /api/v1/workspaces/{workspaceId}/timer/start');
    expect(productOperations).toContain('get /api/v1/workspaces/{workspaceId}/export');
    expect(productOperations.length).toBe(103);
  });

  it('keeps product routes workspace-scoped', () => {
    for (const op of productOperations) {
      expect(op).toContain('/api/v1/workspaces/{workspaceId}/');
    }
  });

  it('includes every product operation in the built Nitro OpenAPI document', () => {
    const spec = loadBuiltSpec();
    if (!spec) {
      return;
    }
    expect(spec.openapi).toBe('3.1.0');
    expect(spec.info.title).toBe('Stampp API');
    expect(spec.components?.securitySchemes?.sessionCookie).toBeDefined();
    expect(spec.components?.securitySchemes?.kioskDeviceKey).toBeDefined();
    expect(spec.components?.schemas?.TimeEntryDto).toBeDefined();
    expect(spec.components?.schemas?.TagDto).toBeDefined();
    expect(spec.components?.schemas?.RateDto).toBeDefined();
    expect(spec.components?.schemas?.EffectiveRatesDto).toBeDefined();
    expect(spec.components?.schemas?.TimesheetDto).toBeDefined();
    expect(spec.components?.schemas?.OwnTimesheetState).toBeDefined();
    expect(spec.components?.schemas?.AttendanceDto).toBeDefined();
    expect(spec.components?.schemas?.CurrentAttendance).toBeDefined();
    expect(spec.components?.schemas?.AttendanceList).toBeDefined();
    expect(spec.components?.schemas?.TimeOffTypeDto).toBeDefined();
    expect(spec.components?.schemas?.TimeOffRequestDto).toBeDefined();
    expect(spec.components?.schemas?.TimeOffBalanceList).toBeDefined();
    expect(spec.components?.schemas?.HolidayDto).toBeDefined();
    expect(spec.components?.schemas?.TimeOffCalendarResult).toBeDefined();
    expect(spec.components?.schemas?.CapacityDto).toBeDefined();
    expect(spec.components?.schemas?.AssignmentDto).toBeDefined();
    expect(spec.components?.schemas?.WorkloadResult).toBeDefined();
    expect(spec.components?.schemas?.KioskDeviceDto).toBeDefined();
    expect(spec.components?.schemas?.KioskCredentialDto).toBeDefined();
    expect(spec.components?.schemas?.KioskPunchResult).toBeDefined();
    expect(spec.components?.schemas?.ProjectBudgetUsage).toBeDefined();
    expect(spec.components?.schemas?.ExpenseDto).toBeDefined();
    expect(spec.components?.schemas?.InvoiceDto).toBeDefined();
    expect(spec.components?.schemas?.ProfitabilityReport).toBeDefined();
    expect(spec.components?.schemas?.UtilizationReport).toBeDefined();
    expect(spec.components?.schemas?.PersonalAccessTokenDto).toBeDefined();

    const available = new Set<string>();
    for (const [path, methods] of Object.entries(spec.paths)) {
      for (const method of Object.keys(methods)) {
        available.add(operationKey(path, method.toLowerCase()));
      }
    }
    for (const op of productOperations) {
      expect(available.has(op)).toBe(true);
    }
  });
});
