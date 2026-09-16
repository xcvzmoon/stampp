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
          content: 'Build full-stack Nuxt app',
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
  modules: ['@nuxt/ui', '@pinia/nuxt', '@vueuse/nuxt', 'pinia-plugin-persistedstate/nuxt'],
  runtimeConfig: {
    public: {
      /** Better Auth base URL including basePath. Empty path prefix yields same-origin `/api/auth`. */
      authBaseURL: 'http://localhost:3001/api/auth',
    },
  },
});
