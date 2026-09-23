import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vite-plus/test';
import { findBreakingChanges } from '~/server/utils/openapiContract.ts';

const builtSpecPath = fileURLToPath(
  new URL('../.output/public/api/v1/openapi.json', import.meta.url),
);
const snapshotPath = fileURLToPath(new URL('../openapi.snapshot.json', import.meta.url));

describe('openapi breaking-change gate', () => {
  it('classifies removals as breaking and additions as safe', () => {
    const snapshot = {
      openapi: '3.1.0',
      info: { title: 'Stampp API', version: '1.0.0' },
      paths: {
        '/api/v1/workspaces/{workspaceId}/tags': {
          get: {
            responses: {
              '200': {
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      required: ['items'],
                      properties: {
                        items: { type: 'array' },
                        nextCursor: { type: ['string', 'null'] },
                      },
                    },
                  },
                },
              },
            },
          },
          post: {
            requestBody: {
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    required: ['name'],
                    properties: { name: { type: 'string' } },
                  },
                },
              },
            },
            responses: { '201': { description: 'created' } },
          },
        },
      },
      components: {
        securitySchemes: {
          sessionCookie: { type: 'apiKey' },
          personalAccessToken: { type: 'http' },
        },
      },
    };

    const breakingCurrent = {
      ...snapshot,
      paths: {
        '/api/v1/workspaces/{workspaceId}/tags': {
          get: {
            responses: {
              '200': {
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      required: ['items'],
                      properties: { items: { type: 'array' } },
                    },
                  },
                },
              },
            },
          },
          post: {
            requestBody: {
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    required: ['name', 'color'],
                    properties: {
                      name: { type: 'number' },
                      color: { type: 'string' },
                    },
                  },
                },
              },
            },
            responses: {},
          },
        },
      },
      components: {
        securitySchemes: { sessionCookie: { type: 'apiKey' } },
      },
    };

    const changes = findBreakingChanges(snapshot, breakingCurrent);
    const kinds = changes.map((change) => change.kind);
    expect(kinds).toContain('schema_property_removed');
    expect(kinds).toContain('required_request_property_added');
    expect(kinds).toContain('schema_type_changed');
    expect(kinds).toContain('response_status_removed');
    expect(kinds).toContain('security_scheme_removed');

    const additive = {
      ...snapshot,
      paths: {
        ...snapshot.paths,
        '/api/v1/workspaces/{workspaceId}/tags/{tagId}': {
          get: { responses: { '200': { description: 'ok' } } },
        },
      },
      components: {
        securitySchemes: {
          ...snapshot.components.securitySchemes,
          serviceToken: { type: 'http' },
        },
      },
    };
    expect(findBreakingChanges(snapshot, additive)).toEqual([]);
  });

  it('matches the built document against the committed snapshot', () => {
    if (!existsSync(snapshotPath) || !existsSync(builtSpecPath)) {
      return;
    }
    const changes = findBreakingChanges(
      JSON.parse(readFileSync(snapshotPath, 'utf8')),
      JSON.parse(readFileSync(builtSpecPath, 'utf8')),
    );
    expect(changes).toEqual([]);
  });
});
