import { defineHandler } from 'nitro';
import { getAuth } from '~/server/utils/auth.ts';

export default defineHandler((event) => {
  return getAuth().handler(event.req);
});
