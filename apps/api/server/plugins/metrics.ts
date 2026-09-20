import { definePlugin } from 'nitro';
import { recordHttpRequest } from '~/server/utils/metrics.ts';

type StartedRequest = {
  method: string;
  route: string;
  startedAt: number;
};

function routeFromRequestUrl(rawUrl: string | undefined): string {
  if (!rawUrl) {
    return 'unknown';
  }
  return rawUrl.split('?')[0] ?? rawUrl;
}

export default definePlugin((nitroApp) => {
  const started = new WeakMap<object, StartedRequest>();

  nitroApp.hooks.hook('request', (event) => {
    started.set(event, {
      method: event.req.method ?? 'GET',
      route: routeFromRequestUrl(event.req.url),
      startedAt: Date.now(),
    });
  });

  nitroApp.hooks.hook('response', (res, event) => {
    const entry = started.get(event);
    if (!entry) {
      return;
    }
    recordHttpRequest(entry.method, entry.route, res.status, Date.now() - entry.startedAt);
  });
});
