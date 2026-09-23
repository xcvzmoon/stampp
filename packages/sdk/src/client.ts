import type { ApiTransport, ClientConfig, HttpMethod, RequestOptions } from './http.ts';
import { createTransport } from './http.ts';
import { createClientsApi, createProjectsApi, createTagsApi } from './resources/catalog.ts';
import { createRatesApi, createTokensApi } from './resources/platform.ts';
import { createTimeApi } from './resources/time.ts';
import { createTimesheetsApi } from './resources/timesheets.ts';

export type StamppClient = {
  workspaceId: string;
  clients: ReturnType<typeof createClientsApi>;
  projects: ReturnType<typeof createProjectsApi>;
  tags: ReturnType<typeof createTagsApi>;
  time: ReturnType<typeof createTimeApi>;
  timesheets: ReturnType<typeof createTimesheetsApi>;
  rates: ReturnType<typeof createRatesApi>;
  tokens: ReturnType<typeof createTokensApi>;
};

export function createStamppClient(config: ClientConfig): StamppClient {
  const transport: ApiTransport = createTransport(config);

  return {
    workspaceId: transport.workspaceId,
    clients: createClientsApi(transport),
    projects: createProjectsApi(transport),
    tags: createTagsApi(transport),
    time: createTimeApi(transport),
    timesheets: createTimesheetsApi(transport),
    rates: createRatesApi(transport),
    tokens: createTokensApi(transport),
  };
}

export type { HttpMethod, RequestOptions };
