# Stampp web app

The web app uses Nuxt 4, Vue 3, Nuxt UI, and Pinia. It talks to Better Auth and the workspace API through the public URLs declared in `.env.schema`.

Run it from the repository root after creating `apps/web/.env`:

```bash
vp run web dev
```

The local app opens on `http://localhost:3000`. Keep browser-visible configuration under `NUXT_PUBLIC_*`; server secrets belong to the API.
