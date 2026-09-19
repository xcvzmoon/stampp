import { createFsDrain } from 'evlog/fs';

/**
 * Local wide-event sink — NDJSON under .evlog/logs.
 */
const drain = createFsDrain();

export default defineNitroPlugin((nitroApp) => {
  // Local files are a development convenience — never a production sink.
  if (!import.meta.dev) return;
  nitroApp.hooks.hook('evlog:drain', drain);
});
