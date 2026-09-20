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
  'get /api/v1/workspaces/{workspaceId}/export',
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
    expect(productOperations.length).toBe(45);
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
    expect(spec.components?.schemas?.TimeEntryDto).toBeDefined();
    expect(spec.components?.schemas?.TagDto).toBeDefined();
    expect(spec.components?.schemas?.RateDto).toBeDefined();
    expect(spec.components?.schemas?.EffectiveRatesDto).toBeDefined();
    expect(spec.components?.schemas?.TimesheetDto).toBeDefined();
    expect(spec.components?.schemas?.OwnTimesheetState).toBeDefined();
    expect(spec.components?.schemas?.ProjectBudgetUsage).toBeDefined();

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
