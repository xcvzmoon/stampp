import { createFsDrain } from 'evlog/fs';
import { definePlugin } from 'nitro';

const drain = createFsDrain();

export default definePlugin((nitroApp) => {
  if (!import.meta.dev) return;
  nitroApp.hooks.hook('evlog:drain', drain);
});
