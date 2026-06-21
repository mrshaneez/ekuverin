# ekuveri.com

A single-page site for the Maldives and a launchpad for the apps you deploy yourself.
The Apps tab can read a link and publish a card for **all** visitors — with adding/removing
locked to you by an admin token.

## Files

```
index.html      the whole site (fonts, styles, and scripts are embedded)
api/apps.js      serverless function: public reads, token-gated writes
README.md        this file
```

`index.html` works on its own with no backend — added apps are saved on the device that
added them. Deploy `api/apps.js` and the same added apps become shared for everyone.

## Deploy on Vercel

1. **Put these files in a project** (a Git repo, or drag-and-drop into a new Vercel project).
   Keep `api/apps.js` exactly at that path — Vercel turns it into `https://yoursite/api/apps`.

2. **Create a KV store.** In the Vercel dashboard: *Storage → Create → KV* (Upstash Redis),
   then **connect it to this project**. That automatically adds the `KV_REST_API_URL` and
   `KV_REST_API_TOKEN` environment variables the function needs.

3. **Set your admin token.** *Project → Settings → Environment Variables* → add
   `ADMIN_TOKEN` with any long secret string you choose. This is what unlocks editing on the site.

4. **Deploy.** Once live, the site detects the backend automatically and switches from
   on-device mode to shared mode.

## Managing your apps

- On your live site, open the **Apps** tab and click **manage**.
- Paste your `ADMIN_TOKEN`. It's stored only in your browser and sent only when you add or remove.
- Add an app: click **+ Add an app**, paste the URL. The page reads its title and description
  and publishes a card visible to everyone.
- Remove an app: hover a card you added and click **×**.

Visitors who don't have the token simply see your apps — they can't add or remove anything.

## Notes

- Reading a link's title/description uses a public preview service. If a page can't be read
  (private/auth-walled), the card falls back to the domain name; you can edit it afterward.
- The Dhivehi fonts (MV Aaamu FK for headings, Faruma for body) are embedded in `index.html`,
  so the script renders correctly everywhere, including iPhones.
- To rotate access, change `ADMIN_TOKEN` in Vercel and re-enter the new value via **manage**.
