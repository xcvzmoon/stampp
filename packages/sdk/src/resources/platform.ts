import type {
  CreatePersonalAccessTokenInput,
  CreateRateInput,
  RateListQuery,
  ResolveRatesQuery,
} from '@stampp/shared';
import type { ApiTransport, RequestOptions } from '../http.ts';
import * as v from 'valibot';
import {
  effectiveRatesDtoSchema,
  personalAccessTokenCreatedSchema,
  personalAccessTokenListSchema,
  rateDtoSchema,
  rateListSchema,
} from '../schemas.ts';

const emptySchema = v.optional(v.null());

export function createRatesApi(transport: ApiTransport) {
  const root = () => `/api/v1/workspaces/${transport.workspaceId}`;

  return {
    list(query: Partial<RateListQuery> = {}, options?: RequestOptions) {
      return transport.request(rateListSchema, 'GET', `${root()}/rates`, {
        ...options,
        query: { ...query, ...options?.query },
      });
    },
    create(body: CreateRateInput, options?: RequestOptions) {
      return transport.request(rateDtoSchema, 'POST', `${root()}/rates`, { ...options, body });
    },
    revoke(rateId: string, options?: RequestOptions) {
      return transport.request(rateDtoSchema, 'DELETE', `${root()}/rates/${rateId}`, options);
    },
    resolveEffective(query: Partial<ResolveRatesQuery> = {}, options?: RequestOptions) {
      return transport.request(effectiveRatesDtoSchema, 'GET', `${root()}/rates/effective`, {
        ...options,
        query: { ...query, ...options?.query },
      });
    },
  };
}

export function createTokensApi(transport: ApiTransport) {
  const root = () => `/api/v1/workspaces/${transport.workspaceId}`;

  return {
    list(options?: RequestOptions) {
      return transport.request(personalAccessTokenListSchema, 'GET', `${root()}/tokens`, options);
    },
    create(body: CreatePersonalAccessTokenInput, options?: RequestOptions) {
      return transport.request(personalAccessTokenCreatedSchema, 'POST', `${root()}/tokens`, {
        ...options,
        body,
      });
    },
    revoke(tokenId: string, options?: RequestOptions) {
      return transport.request(emptySchema, 'DELETE', `${root()}/tokens/${tokenId}`, options);
    },
  };
}
