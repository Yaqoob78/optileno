# Optileno

**Every small change has a price.** Optileno helps freelancers on fixed-price projects stop doing free work by accident. Set up a project's scope in a minute, paste each client request as it arrives, and Optileno says whether it's in scope, a revision round, or extra, and why. Then charge it (the client approves in one tap) or gift it (shown to the client with its value).

- Landing page: `/`
- App: `/app` (local-first: everything is stored in the browser, no account)
- Client scope page: `/s#…` (the page's content travels inside the link after `#`, so it never reaches a server)
- Privacy and terms: `/privacy`, `/terms`

Strategy and launch: [docs/STRATEGY.md](docs/STRATEGY.md), [docs/LAUNCH-PLAN.md](docs/LAUNCH-PLAN.md) (first 7 days, SEO, infrastructure), [docs/GO-TO-MARKET.md](docs/GO-TO-MARKET.md).
Landing art: [docs/LANDING-ASSETS.md](docs/LANDING-ASSETS.md) (prompts and specs) and [tools/story-assets](tools/story-assets) (turns images into WebP + depth maps).

## Develop

```bash
cd frontend
npm install
npm run dev        # http://localhost:3000
npm test           # vitest: verdict engine, ledger, share links, import sanitising
npm run build      # typecheck + production build
```

Requires Node 20.19+ (Vite 8).

## Structure

```
frontend/
  src/
    lib/        pure logic: verdict engine, ledger, reply drafts, share links, store, templates
    app/        the app (desk, project page, verdict sheet, scope editor, settings)
    client/     the client-facing scope page
    landing/    the landing page: journey/ is the WebGL "living painting" story (DepthStage.ts, scenes.ts, chapters)
    legal/      privacy and terms
    styles/     design tokens (base.css) plus one stylesheet per area
  public/       icons, OG image, robots, sitemap, llms.txt; story/ holds the scene art and depth maps
```

## Deploy

Vercel, project root `frontend/`. Build `npm run build`, output `dist/`. `vercel.json` handles SPA rewrites, headers, and the apex → www redirect.

## History

Earlier versions (the AI daily planner, and the short-lived capacity planner) are archived locally in `optileno-old/` (git-ignored; it contains secrets) and in git history (tag `v1-archive`).
