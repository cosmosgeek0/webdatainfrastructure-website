# Web Data Infrastructure public website

Recovery copy of **https://webdatainfrastructure.com**, captured directly from
the running Mumbai origin on **14 October 2026**. `public/` is the exact deployed
public-site file set; `PRODUCTION.sha256` records its checksums. No dashboard,
provider credentials, account records or private IP lists are included.

## Launch without AWS

Requires Node.js 22.13 or newer. No install/build is needed to serve the saved site.

```sh
git clone https://github.com/cosmosgeek0/webdatainfrastructure-website.git
cd webdatainfrastructure-website
npm start
# http://localhost:8080
```

`serve.mjs` serves the pages and assets, including clean `/about`, `/contact`,
`/privacy` and `/terms` routes. `HOST` defaults to `127.0.0.1`; `PORT` to `8080`.
On a container platform set `HOST=0.0.0.0` and use its assigned `PORT`.

```sh
docker build -t wdi-public-site .
docker run -d --name wdi-public-site --restart unless-stopped \
  -p 127.0.0.1:8080:8080 wdi-public-site
```

Put the container behind your new host's HTTPS reverse proxy/custom-domain
service. A static host can instead publish `public/` with clean-URL rewrites for
the four information pages. The API paths must return JSON errors when unavailable,
not an SPA/index.html fallback.

## Live measurements are a separate dependency

By default the portable server returns HTTP 503 for `/api/live`, `/api/seconds`
and `/api/minutes`. The page then labels measurements unavailable and keeps the
website usable. It never invents replacement traffic. To use the currently
running public feed, or a compatible restored public aggregate API:

```sh
METRICS_ORIGIN=https://public-wdi.cosmosgeek.org npm start
```

Only those three read-only aggregate paths are proxied; credentials and client
cookies are never forwarded. The current feed is on AWS Mumbai. If AWS is lost,
live data needs its collector/backend restored separately. Private SQLite ledgers,
collector processes, credentials and AWS KMS keys are **not** in this website repo.
This preserves the website, not the entire infrastructure operation.

## Contact and branding

The existing form posts directly from the browser to FormSubmit for
`contact@webdatainfrastructure.com`. It does not depend on the AWS web server.
Retain that mailbox and verify FormSubmit activation and actual receipt after
moving domains. Do not submit test messages to suppliers. Proposed call times
are manually confirmed by email, not automatic calendar bookings.

Keep both apex and www on the new platform, redirect www to the HTTPS apex, and
leave email DNS records intact. If the domain changes, update canonical/OG URLs,
the sitemap, robots.txt, `src/booking.js` and email links. Preserve existing mail
and Cloudflare Access rules; do not repoint private dashboards to this server.

## Edit and rebuild

```sh
npm ci
npm test
npm run build
```

`public/index.html` is the editable homepage and shared header/footer template.
`public/style.css` and images/fonts are direct source assets. `src/app.js`,
`chart.js`, `data.js` and `booking.js` build `public/app.js`. `src/pages.js` builds
the four information pages and sitemap. The existing `public/scene.js` is kept
as part of the exact deployment snapshot but is not referenced by the current
homepage; obsolete experimental scene sources are not used for rebuilds.

Dependencies are pinned in package-lock.json. Fonts and bundled Three.js retain
their licenses under `licenses/` and in the bundle. Provider logos embedded in
the existing markup are retained as existing site assets; this backup grants no
new trademark permissions.

Before DNS cutover, check HTTPS, each information page, fonts/images, enquiry
receipt, and the honest unavailable/live state of the traffic panel. This backup
operation does not change the live AWS server, DNS, mail or active fleet.
