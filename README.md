# gallery-landing

[Galeri Piyasa](https://gallery.mfosec.xyz) tanıtım sayfası — ASCII / terminal teması (siyah zemin, sarı-yeşil vurgu), uygulamayla aynı tasarım dili.

- Bağımlılıksız statik site: `public/index.html`, `public/style.css`, `public/app.js`
- **Canlı demo**: “bu_arac_kac_para” terminali, uygulamadaki tahmin mantığını (aynı versiyon + yıl + km ±%15 + hasar grubu, gerekirse gevşetme) tarayıcıda `public/demo-egea.json` üzerinde çalıştırır. Veri uygulamanın MOCK üreticisinden gelir; gerçek ilan değildir.
- Yayın: Cloudflare Workers (statik assets) + custom domain `gallery.mfosec.xyz` (`wrangler.jsonc`).

## Yerel önizleme

```bash
npx wrangler dev        # veya: python3 -m http.server -d public 4500
```

## Deploy (GitHub Actions)

`main`'e her push `.github/workflows/deploy.yml` ile deploy edilir. Bir kerelik kurulum:

1. Cloudflare → **Account API tokens** → **Create Token** → şablon **Edit Cloudflare Workers**; hesap = kendi hesabın, zone = `mfosec.xyz`.
2. Repo secret'ları:
   ```bash
   gh secret set CLOUDFLARE_API_TOKEN      # token'ı yapıştır
   gh secret set CLOUDFLARE_ACCOUNT_ID     # isteğe bağlı (token tek hesaba bağlıysa gerekmez)
   ```
3. `gh workflow run deploy` (veya bir push). İlk deploy custom domain'i, DNS kaydını ve sertifikayı otomatik oluşturur.

## Demo verisini yenileme

Ana uygulama reposunda: `npx tsx scripts/export-landing-demo.ts` → üretilen `landing/public/demo-egea.json` bu repoya kopyalanır.
