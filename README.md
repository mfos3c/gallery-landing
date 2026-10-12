# gallery-landing

Landing page for **[Galeri Piyasa](https://gallery.mfosec.xyz)** — market price intelligence for Turkish car dealers. ASCII / terminal theme (black background, yellow-green accents), same design language as the app.

- Dependency-free static site: `public/index.html`, `public/style.css`, `public/app.js`
- **Live demo**: the `whats_it_worth` terminal runs the app's estimate logic in the browser (same trim + same year + mileage ±15% + same damage group, relaxed step by step when there are fewer than 5 matches) on `public/demo-egea.json`. The data comes from the app's mock generator — not real listings.
- Hosting: Cloudflare Workers (static assets) on the custom domain `gallery.mfosec.xyz` (`wrangler.jsonc`).

## Local preview

```bash
npx wrangler dev        # or: python3 -m http.server -d public 4500
```

## Deploy (GitHub Actions)

Every push to `main` deploys via `.github/workflows/deploy.yml`. One-time setup:

1. Cloudflare → **Account API tokens** → **Create Token** → template **Edit Cloudflare Workers**; account = yours, zone = `mfosec.xyz`.
2. Repository secrets:
   ```bash
   gh secret set CLOUDFLARE_API_TOKEN      # paste the token
   gh secret set CLOUDFLARE_ACCOUNT_ID     # optional (not needed if the token is scoped to one account)
   ```
3. `gh workflow run deploy` (or push). The first deploy creates the custom domain, its DNS record and the certificate automatically.

## Refreshing the demo data

In the main app repo: `npx tsx scripts/export-landing-demo.ts`, then copy the generated `landing/public/demo-egea.json` here.
