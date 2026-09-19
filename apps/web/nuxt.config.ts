export default defineNuxtConfig({
  compatibilityDate: '2026-09-16',
  typescript: {
    typeCheck: true,
    strict: true,
  },
  devtools: {
    enabled: false,
  },
  experimental: {
    typedPages: true,
  },
  hooks: {
    'prepare:types': ({ tsConfig }) => {
      tsConfig.compilerOptions ??= {};
      tsConfig.compilerOptions.rootDir = import.meta.dirname;
    },
  },
  router: {
    options: {
      scrollBehaviorType: 'smooth',
    },
  },
  app: {
    pageTransition: {
      name: 'page',
      mode: 'out-in',
    },
    layoutTransition: {
      name: 'layout',
      mode: 'out-in',
    },
    head: {
      title: 'Stampp',
      charset: 'utf8',
      viewport: 'width=device-width, initial-scale=1',
      meta: [
        {
          name: 'description',
          content: 'Track project time with a self-hosted workspace for teams.',
        },
        {
          name: 'format-detection',
          content: 'no',
        },
        {
          name: 'viewport',
          content: 'width=device-width, initial-scale=1, maximum-scale=1',
        },
      ],
    },
  },
  css: ['~/assets/css/main.css'],
  modules: [
    '@nuxt/ui',
    '@pinia/nuxt',
    '@vueuse/nuxt',
    'pinia-plugin-persistedstate/nuxt',
    'evlog/nuxt',
  ],
  runtimeConfig: {
    public: {
      appUrl: process.env.PUBLIC_APP_URL ?? 'http://localhost:3000',
      apiUrl: process.env.PUBLIC_API_URL ?? 'http://localhost:3001',
      authBaseURL: process.env.NUXT_PUBLIC_AUTH_BASE_URL ?? 'http://localhost:3001/api/auth',
      apiBaseURL: process.env.NUXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3001/api/v1',
    },
  },
  evlog: {
    env: { service: 'stampp-web' },
  },
});
