import {
  createGeoEnricher,
  createRequestSizeEnricher,
  createTraceContextEnricher,
  createUserAgentEnricher,
} from 'evlog/enrichers';
import { definePlugin } from 'nitro';

const enrichers = [
  createUserAgentEnricher(),
  createGeoEnricher(),
  createRequestSizeEnricher(),
  createTraceContextEnricher(),
];

export default definePlugin((nitroApp) => {
  nitroApp.hooks.hook('evlog:enrich', (ctx) => {
    for (const enrich of enrichers) {
      enrich(ctx);
    }
  });
});
