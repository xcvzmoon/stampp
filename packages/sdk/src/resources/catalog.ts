import type {
  CreateClientInput,
  CreateProjectInput,
  CreateTagInput,
  CreateTaskInput,
  UpdateClientInput,
  UpdateProjectInput,
  UpdateTagInput,
  UpdateTaskInput,
} from '@stampp/shared';
import type { ApiTransport, RequestOptions } from '../http.ts';
import {
  clientDtoSchema,
  clientListSchema,
  projectDtoSchema,
  projectListSchema,
  tagDtoSchema,
  tagListSchema,
  taskDtoSchema,
  taskListSchema,
} from '../schemas.ts';

function root(transport: ApiTransport): string {
  return `/api/v1/workspaces/${transport.workspaceId}`;
}

export function createClientsApi(transport: ApiTransport) {
  return {
    list(
      query: { limit?: number; cursor?: string; search?: string } = {},
      options?: RequestOptions,
    ) {
      return transport.request(clientListSchema, 'GET', `${root(transport)}/clients`, {
        ...options,
        query: { ...query, ...options?.query },
      });
    },
    create(body: CreateClientInput, options?: RequestOptions) {
      return transport.request(clientDtoSchema, 'POST', `${root(transport)}/clients`, {
        ...options,
        body,
      });
    },
    get(clientId: string, options?: RequestOptions) {
      return transport.request(
        clientDtoSchema,
        'GET',
        `${root(transport)}/clients/${clientId}`,
        options,
      );
    },
    update(clientId: string, body: UpdateClientInput, options?: RequestOptions) {
      return transport.request(clientDtoSchema, 'PATCH', `${root(transport)}/clients/${clientId}`, {
        ...options,
        body,
      });
    },
    remove(clientId: string, options?: RequestOptions) {
      return transport.requestEmpty('DELETE', `${root(transport)}/clients/${clientId}`, options);
    },
  };
}

export function createProjectsApi(transport: ApiTransport) {
  return {
    list(
      query: {
        limit?: number;
        cursor?: string;
        status?: string;
        clientId?: string;
        search?: string;
      } = {},
      options?: RequestOptions,
    ) {
      return transport.request(projectListSchema, 'GET', `${root(transport)}/projects`, {
        ...options,
        query: { ...query, ...options?.query },
      });
    },
    create(body: CreateProjectInput, options?: RequestOptions) {
      return transport.request(projectDtoSchema, 'POST', `${root(transport)}/projects`, {
        ...options,
        body,
      });
    },
    get(projectId: string, options?: RequestOptions) {
      return transport.request(
        projectDtoSchema,
        'GET',
        `${root(transport)}/projects/${projectId}`,
        options,
      );
    },
    update(projectId: string, body: UpdateProjectInput, options?: RequestOptions) {
      return transport.request(
        projectDtoSchema,
        'PATCH',
        `${root(transport)}/projects/${projectId}`,
        { ...options, body },
      );
    },
    remove(projectId: string, options?: RequestOptions) {
      return transport.requestEmpty('DELETE', `${root(transport)}/projects/${projectId}`, options);
    },
    listTasks(
      projectId: string,
      query: { limit?: number; cursor?: string; status?: string } = {},
      options?: RequestOptions,
    ) {
      return transport.request(
        taskListSchema,
        'GET',
        `${root(transport)}/projects/${projectId}/tasks`,
        {
          ...options,
          query: { ...query, ...options?.query },
        },
      );
    },
    createTask(projectId: string, body: CreateTaskInput, options?: RequestOptions) {
      return transport.request(
        taskDtoSchema,
        'POST',
        `${root(transport)}/projects/${projectId}/tasks`,
        { ...options, body },
      );
    },
    updateTask(taskId: string, body: UpdateTaskInput, options?: RequestOptions) {
      return transport.request(taskDtoSchema, 'PATCH', `${root(transport)}/tasks/${taskId}`, {
        ...options,
        body,
      });
    },
    removeTask(taskId: string, options?: RequestOptions) {
      return transport.requestEmpty('DELETE', `${root(transport)}/tasks/${taskId}`, options);
    },
  };
}

export function createTagsApi(transport: ApiTransport) {
  return {
    list(
      query: { limit?: number; cursor?: string; search?: string } = {},
      options?: RequestOptions,
    ) {
      return transport.request(tagListSchema, 'GET', `${root(transport)}/tags`, {
        ...options,
        query: { ...query, ...options?.query },
      });
    },
    create(body: CreateTagInput, options?: RequestOptions) {
      return transport.request(tagDtoSchema, 'POST', `${root(transport)}/tags`, {
        ...options,
        body,
      });
    },
    update(tagId: string, body: UpdateTagInput, options?: RequestOptions) {
      return transport.request(tagDtoSchema, 'PATCH', `${root(transport)}/tags/${tagId}`, {
        ...options,
        body,
      });
    },
    remove(tagId: string, options?: RequestOptions) {
      return transport.requestEmpty('DELETE', `${root(transport)}/tags/${tagId}`, options);
    },
  };
}
