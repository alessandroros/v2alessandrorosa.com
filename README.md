# alessandrorosa.com

My personal website hosted at [alessandrorosa.com](https://alessandrorosa.com)

Built with [Nuxt 4](https://nuxt.com) (Vue 3), [Tailwind CSS 4](https://tailwindcss.com)
and [Nuxt Content](https://content.nuxt.com), deployed to Cloudflare Pages.

## 🚀 Getting started

### Requirements

- Node.js `22.14.0` (see [.nvmrc](./.nvmrc) — `nvm use` picks it up)
- pnpm `9.6.0` (`corepack enable` installs the version pinned in `package.json`)

### Setup

```bash
pnpm install
cp .env.example .env
```

Then fill in [.env](./.env.example). Every variable is optional: the sections
that depend on a missing key simply do not render, so the site runs fine with an
empty `.env` while you work on the layout.

| Variable                                                                          | Powers                                      |
| --------------------------------------------------------------------------------- | ------------------------------------------- |
| `NUXT_GITHUB_USERNAME`, `NUXT_GITHUB_API_KEY`                                     | Starred repositories on the home page       |
| `NUXT_WAKATIME_API_KEY`                                                           | Programming metrics, hero language sentence |
| `NUXT_STRAVA_CLIENT_ID`, `NUXT_STRAVA_CLIENT_SECRET`, `NUXT_STRAVA_REFRESH_TOKEN` | Activity stats (`/lazy`)                    |
| `NUXT_UPSTASH_REDIS_REST_URL`, `NUXT_UPSTASH_REDIS_REST_TOKEN`                    | API response caching                        |

### Run

```bash
pnpm dev
```

The dev server starts on <http://localhost:3000>.

## 📜 Scripts

| Command             | What it does                                  |
| ------------------- | --------------------------------------------- |
| `pnpm dev`          | Dev server with HMR                           |
| `pnpm build`        | Production build (Cloudflare Pages preset)    |
| `pnpm preview`      | Serve the production build locally            |
| `pnpm generate`     | Fully prerendered static output               |
| `pnpm typecheck`    | `vue-tsc` over the project                    |
| `pnpm lint`         | ESLint (`lint:fix` to autofix)                |
| `pnpm format`       | Prettier (`format:check` to verify only)      |

There is also a [justfile](./justfile) wrapping the common combinations —
`just precommit` runs lint, format and typecheck in one go.

## 📁 Layout

```
app/
  components/   Vue components (Hero, Projects, TechStack, KPI, Footer, …)
  composables/  Shared site data, e.g. the nav and footer link list
  pages/        Routes — home, blog/[...slug], lazy
  assets/css/   Tailwind entry point and design tokens
content/blog/   Blog posts as markdown, rendered by Nuxt Content
server/api/     Server routes proxying GitHub, Strava and WakaTime
public/fonts/   Self-hosted variable fonts (latin subset)
public/icons/   Self-hosted tech stack icons
```

## 🎨 Design

Three typefaces, three roles: **Source Serif 4** for headings, **Inter** for body
and UI, **JetBrains Mono** for numbers and code. Fonts are self-hosted from
`public/fonts` — no third-party requests.

Design tokens live in [main.css](./app/assets/css/main.css): the accent
(`--color-accent`, with contrast-safe variants per theme) and a single surface
system (`--surface`, `--surface-border`) shared by every card.

Spacing follows three steps: `gap-24` between page blocks, `gap-6` inside a
section, `gap-3` between tightly related items.

Adding a blog post: `./create-blog-post.ps1` scaffolds the markdown file, or add
one by hand under `content/blog/`.

## 🔧 Maintenance

### Redis Keep-Alive

The site uses Upstash Redis for caching. On the free tier, databases are deleted after 28 days of inactivity.

**To prevent this:**

- An endpoint `/api/health/redis` is available for health checks
- Set up a cron job to call this endpoint at least once per day
- See [REDIS-KEEPALIVE.md](./REDIS-KEEPALIVE.md) for setup instructions

**Test the endpoint:**

```powershell
# Local
.\test-redis-health.ps1

# Production
.\test-redis-health.ps1 -Production
```

### Cache invalidation

`./invalidate-cache.ps1` clears the cached API responses.

## 📄 License

[MIT](./LICENSE)
