# ekuveri.com

A single-page site for the Maldives and a launchpad for your apps, with a built-in admin.
Sign in to add/edit apps, manage a documents list, and edit the site's text — all saved to a
shared store so every visitor sees your changes.

## Files

    index.html      the whole site (fonts, styles, scripts embedded)
    api/admin.js    serverless backend: public reads, login, authorized saves
    README.md       this file

index.html works on its own with no backend (it shows the demo cards). Deploy api/admin.js
plus the environment variables below and the admin + shared content come alive.

## Deploy on Vercel

1. Put these files in a project (a Git repo, or the Vercel CLI). Keep api/admin.js at that path.

       npm i -g vercel
       cd ekuveri-site
       vercel            # preview
       vercel --prod     # production

2. Create a KV store. Vercel dashboard -> Storage -> Create -> KV (Upstash Redis) -> connect it
   to this project. This adds KV_REST_API_URL and KV_REST_API_TOKEN automatically.

3. Add the admin environment variables. Project -> Settings -> Environment Variables:

       ADMIN_EMAIL          mr.shaneez@gmail.com
       ADMIN_PASSWORD_HASH  scrypt:5eb31012c2a74ebce3d934f19c0a19be:c39cf1ef2cc9f7f66f4d75d61a112e0d4b8c53c8e02ffc853341447e646104148201a8d1b9239ef3c8793f3d739dedb2154aea2ecbdda16c981680831ceac83a
       AUTH_SECRET          cbb05cd30ab4c30ed2974dd55c145da5b3aeb1cf1630cb89a525ef33fea7c07b

   ADMIN_PASSWORD_HASH is a salted scrypt hash of your password — the plaintext is never stored
   anywhere. AUTH_SECRET signs your login session token; keep it private.

4. Deploy / redeploy. Add ekuveri.com under Settings -> Domains and follow the DNS steps.

## Using the admin

- On the live site, click the small lock icon at the top-right.
- Sign in with your email and password.
- Apps tab: add by link (auto-fills name + description) or edit any field; remove with x; Save apps.
- Documents tab: add title + link rows; they appear on the About page; Save documents.
- Site tab: edit the hero subtitle, About heading and paragraphs, and contact email; Save site text.

Your session lasts 7 days in the browser you signed in from. "Sign out" clears it.

## Changing the password later

Generate a new hash and replace ADMIN_PASSWORD_HASH in Vercel:

    PW='your-new-password' node -e 'const c=require("crypto");const s=c.randomBytes(16);const h=c.scryptSync(process.env.PW,s,64);console.log("scrypt:"+s.toString("hex")+":"+h.toString("hex"))'

## Notes

- Adding an app by link reads its title/description from a public preview service. Private or
  auth-walled pages fall back to the domain name — just edit the fields.
- Documents are link-based (host the files anywhere). True file upload would use Vercel Blob —
  ask if you want that added.
- The Dhivehi fonts (MV Aaamu FK for headings, Faruma for body) are embedded in index.html,
  so the script renders everywhere, including iPhones.
