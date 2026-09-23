/* oxlint-disable anti-slop/no-unknown-parameters, anti-slop/no-unknown-returns, anti-slop/no-unsafe-dictionary-type, anti-slop/require-safety-comment-for-type-assertion, anti-slop/no-known-value-widening -- This module is the parse/compare boundary for untyped OpenAPI JSON documents. */
/**
 * OpenAPI breaking-change detection for the public `/api/v1` contract.
 * Additive changes are allowed; removals and tightening are breaking.
 */
import * as v from 'valibot';

export type OpenApiSchemaNode = {
  type?: string | string[];
  required?: string[];
  properties?: Record<string, OpenApiSchemaNode>;
};

export type OpenApiOperation = {
  description?: string;
  summary?: string;
  requestBody?: {
    content?: Record<string, { schema?: OpenApiSchemaNode }>;
  };
  responses?: Record<
    string,
    {
      description?: string;
      content?: Record<string, { schema?: OpenApiSchemaNode }>;
    }
  >;
};

export type OpenApiDocument = {
  openapi: string;
  info: { title: string; version: string; description?: string };
  paths: Record<string, Record<string, OpenApiOperation>>;
  components?: {
    schemas?: Record<string, OpenApiSchemaNode>;
    securitySchemes?: Record<string, unknown>;
    responses?: Record<string, unknown>;
  };
};

export type BreakingChange = {
  kind:
    | 'path_removed'
    | 'operation_removed'
    | 'required_request_property_added'
    | 'response_status_removed'
    | 'schema_property_removed'
    | 'schema_type_changed'
    | 'security_scheme_removed';
  path: string;
  detail: string;
};

const HTTP_METHODS = new Set(['get', 'put', 'post', 'delete', 'options', 'head', 'patch', 'trace']);

const schemaNodeSchema: v.GenericSchema<OpenApiSchemaNode> = v.looseObject({
  type: v.optional(v.union([v.string(), v.array(v.string())])),
  required: v.optional(v.array(v.string())),
  properties: v.optional(
    v.record(
      v.string(),
      v.lazy(() => schemaNodeSchema),
    ),
  ),
});

const jsonContentSchema = v.object({
  schema: v.optional(schemaNodeSchema),
});

const operationSchema: v.GenericSchema<OpenApiOperation> = v.looseObject({
  description: v.optional(v.string()),
  summary: v.optional(v.string()),
  requestBody: v.optional(
    v.object({
      content: v.optional(v.record(v.string(), jsonContentSchema)),
    }),
  ),
  responses: v.optional(
    v.record(
      v.string(),
      v.object({
        description: v.optional(v.string()),
        content: v.optional(v.record(v.string(), jsonContentSchema)),
      }),
    ),
  ),
});

const openApiDocumentSchema: v.GenericSchema<OpenApiDocument> = v.looseObject({
  openapi: v.string(),
  info: v.object({
    title: v.string(),
    version: v.string(),
    description: v.optional(v.string()),
  }),
  paths: v.record(v.string(), v.record(v.string(), operationSchema)),
  components: v.optional(
    v.looseObject({
      schemas: v.optional(v.record(v.string(), schemaNodeSchema)),
      securitySchemes: v.optional(v.record(v.string(), v.unknown())),
      responses: v.optional(v.record(v.string(), v.unknown())),
    }),
  ),
});

function parseDocument(input: unknown, label: string): OpenApiDocument {
  const result = v.safeParse(openApiDocumentSchema, input);
  if (!result.success) {
    throw new Error(`OpenAPI ${label} document failed schema validation`);
  }
  return result.output;
}

function operationKeys(paths: OpenApiDocument['paths']): Set<string> {
  const keys = new Set<string>();
  for (const [path, methods] of Object.entries(paths)) {
    for (const method of Object.keys(methods)) {
      if (HTTP_METHODS.has(method)) {
        keys.add(`${method} ${path}`);
      }
    }
  }
  return keys;
}

function collectRequiredAdded(
  before: OpenApiSchemaNode,
  after: OpenApiSchemaNode,
  location: string,
  changes: BreakingChange[],
  path: string,
): void {
  const beforeRequired = new Set(before.required ?? []);
  for (const name of after.required ?? []) {
    if (!beforeRequired.has(name)) {
      changes.push({
        kind: 'required_request_property_added',
        path,
        detail: `${location}.required += ${name}`,
      });
    }
  }

  const beforeProps = before.properties ?? {};
  const afterProps = after.properties ?? {};
  for (const [propName, afterProp] of Object.entries(afterProps)) {
    const beforeProp = beforeProps[propName];
    if (!beforeProp) {
      continue;
    }
    collectTypeChanged(beforeProp, afterProp, `${location}.${propName}`, changes, path);
    collectRequiredAdded(beforeProp, afterProp, `${location}.${propName}`, changes, path);
  }
}

function collectTypeChanged(
  before: OpenApiSchemaNode,
  after: OpenApiSchemaNode,
  location: string,
  changes: BreakingChange[],
  path: string,
): void {
  const beforeType = before.type;
  const afterType = after.type;
  if (beforeType === undefined || afterType === undefined) {
    return;
  }
  const beforeKey = JSON.stringify(beforeType);
  const afterKey = JSON.stringify(afterType);
  if (beforeKey !== afterKey) {
    changes.push({
      kind: 'schema_type_changed',
      path,
      detail: `${location}.type ${beforeKey} -> ${afterKey}`,
    });
  }
}

function collectSchemaRemovals(
  before: OpenApiSchemaNode,
  after: OpenApiSchemaNode,
  location: string,
  changes: BreakingChange[],
  path: string,
): void {
  const beforeProps = before.properties ?? {};
  const afterProps = after.properties ?? {};
  for (const propName of Object.keys(beforeProps)) {
    if (!(propName in afterProps)) {
      changes.push({
        kind: 'schema_property_removed',
        path,
        detail: `${location}.${propName} removed`,
      });
    }
  }
  for (const [propName, beforeProp] of Object.entries(beforeProps)) {
    const afterProp = afterProps[propName];
    if (afterProp) {
      collectSchemaRemovals(beforeProp, afterProp, `${location}.${propName}`, changes, path);
      collectTypeChanged(beforeProp, afterProp, `${location}.${propName}`, changes, path);
    }
  }
}

function responseStatusKeys(operation: OpenApiOperation): Set<string> {
  return new Set(Object.keys(operation.responses ?? {}));
}

function requestBodySchema(operation: OpenApiOperation): OpenApiSchemaNode | null {
  return operation.requestBody?.content?.['application/json']?.schema ?? null;
}

function responseSchema(operation: OpenApiOperation, status: string): OpenApiSchemaNode | null {
  return operation.responses?.[status]?.content?.['application/json']?.schema ?? null;
}

/** Compares the live document against the committed snapshot. */
export function findBreakingChanges(
  snapshotInput: unknown,
  currentInput: unknown,
): BreakingChange[] {
  const snapshot = parseDocument(snapshotInput, 'snapshot');
  const current = parseDocument(currentInput, 'current');
  const changes: BreakingChange[] = [];
  const snapshotOps = operationKeys(snapshot.paths);
  const currentOps = operationKeys(current.paths);

  for (const key of snapshotOps) {
    if (!currentOps.has(key)) {
      const spaceIndex = key.indexOf(' ');
      const method = key.slice(0, spaceIndex);
      const path = key.slice(spaceIndex + 1);
      changes.push({
        kind: snapshot.paths[path] ? 'operation_removed' : 'path_removed',
        path: key,
        detail: `operation ${method.toUpperCase()} ${path} removed`,
      });
    }
  }

  for (const [path, methods] of Object.entries(snapshot.paths)) {
    for (const [method, beforeOp] of Object.entries(methods)) {
      if (!HTTP_METHODS.has(method)) {
        continue;
      }
      const afterOp = current.paths[path]?.[method];
      if (!afterOp) {
        continue;
      }

      for (const status of responseStatusKeys(beforeOp)) {
        if (!responseStatusKeys(afterOp).has(status)) {
          changes.push({
            kind: 'response_status_removed',
            path: `${method} ${path}`,
            detail: `response ${status} removed`,
          });
        }
      }

      const beforeBody = requestBodySchema(beforeOp);
      const afterBody = requestBodySchema(afterOp);
      if (beforeBody && afterBody) {
        collectRequiredAdded(
          beforeBody,
          afterBody,
          'requestBody.schema',
          changes,
          `${method} ${path}`,
        );
        collectSchemaRemovals(
          beforeBody,
          afterBody,
          'requestBody.schema',
          changes,
          `${method} ${path}`,
        );
      }

      for (const status of responseStatusKeys(beforeOp)) {
        const beforeRes = responseSchema(beforeOp, status);
        const afterRes = responseSchema(afterOp, status);
        if (beforeRes && afterRes) {
          collectSchemaRemovals(
            beforeRes,
            afterRes,
            `responses.${status}.schema`,
            changes,
            `${method} ${path}`,
          );
          collectTypeChanged(
            beforeRes,
            afterRes,
            `responses.${status}.schema`,
            changes,
            `${method} ${path}`,
          );
        }
      }
    }
  }

  const beforeSchemes = Object.keys(snapshot.components?.securitySchemes ?? {});
  const afterSchemes = new Set(Object.keys(current.components?.securitySchemes ?? {}));
  for (const scheme of beforeSchemes) {
    if (!afterSchemes.has(scheme)) {
      changes.push({
        kind: 'security_scheme_removed',
        path: 'components.securitySchemes',
        detail: `security scheme ${scheme} removed`,
      });
    }
  }

  return changes;
}
