/**
 * Stampp public API integration quickstart.
 * Uses only `@stampp/sdk` and the public docs (packages/sdk/README.md).
 *
 * Env:
 *   STAMPP_BASE_URL       e.g. https://stampp.example
 *   STAMPP_WORKSPACE_ID   workspace / organization id
 *   STAMPP_TOKEN          personal access token (stpp_…)
 */
import { createStamppClient, isStamppApiError } from '@stampp/sdk';

const baseUrl = process.env.STAMPP_BASE_URL;
const workspaceId = process.env.STAMPP_WORKSPACE_ID;
const token = process.env.STAMPP_TOKEN;

if (!baseUrl || !workspaceId || !token) {
  console.error('Set STAMPP_BASE_URL, STAMPP_WORKSPACE_ID, and STAMPP_TOKEN');
  process.exit(1);
}

const client = createStamppClient({ baseUrl, workspaceId, token });

function today() {
  return new Date().toISOString().slice(0, 10);
}

async function main() {
  const clientName = `Integration ${Date.now()}`;
  const createdClient = await client.clients.create({
    name: clientName,
    email: 'ops@example.com',
    notes: 'Created by integration-quickstart',
  });
  console.info('created client', createdClient.id);

  const project = await client.projects.create({
    name: `Quickstart ${Date.now()}`,
    clientId: createdClient.id,
  });
  console.info('created project', project.id);

  const tag = await client.tags.create({ name: `qs-${Date.now().toString(36)}` });

  const entry = await client.time.createEntry({
    kind: 'duration',
    projectId: project.id,
    description: 'Quickstart block',
    billable: true,
    durationMinutes: 30,
    workDate: today(),
    timezone: 'UTC',
    tagIds: [tag.id],
  });
  console.info('created time entry', entry.id, entry.durationMinutes);

  const listed = await client.time.listEntries({ projectId: project.id });
  console.info('listed entries', listed.items.length);

  // Safe retry: same Idempotency-Key replays the first response.
  const key = `quickstart-${entry.id}`;
  const first = await client.time.updateEntry(
    entry.id,
    { description: 'Updated once' },
    { idempotencyKey: key },
  );
  const second = await client.time.updateEntry(
    entry.id,
    { description: 'Updated once' },
    { idempotencyKey: key },
  );
  if (first.id !== second.id) {
    throw new Error('Idempotent update returned a different entry');
  }
  console.info('idempotent update ok');

  await client.time.deleteEntry(entry.id);
  await client.tags.remove(tag.id);
  await client.projects.remove(project.id);
  await client.clients.remove(createdClient.id);
  console.info('cleaned up');
}

try {
  await main();
} catch (error) {
  if (isStamppApiError(error)) {
    console.error('API error', {
      status: error.status,
      code: error.code,
      message: error.message,
      requestId: error.requestId,
      retryAfterSeconds: error.retryAfterSeconds,
    });
    process.exit(1);
  }
  throw error;
}
