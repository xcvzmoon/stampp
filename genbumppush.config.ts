import { defineConfig } from 'genbumppush';

export default defineConfig({
  hooks: {
    before: ['vp run fmt', 'vp run lint', 'vp run check'],
  },
  github: {
    enabled: true,
  },
});
