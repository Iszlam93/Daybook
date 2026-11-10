# Daybook Notion helper

A tiny Cloudflare Worker that lets Daybook talk to Notion. It is optional: Daybook works without it, and you only need it for the Notion plug-in.

## Why a helper is needed

- Notion's API blocks requests made straight from a web page.
- Notion's "Sign in with Notion" needs a client secret, and a secret must never be shipped inside a web page.

The helper solves both. **Your Notion data passes through it**, so run your own copy (it takes about ten minutes and is free) or use one you trust. It stores nothing and logs nothing; the access token stays in your browser.

## Set it up

1. **Create a Notion public integration.** Go to <https://www.notion.so/profile/integrations>, create a new integration, set the type to **Public**, and add your Daybook app address as a redirect URI, for example `https://yourname.github.io/daybook/app/`. It must match exactly, including the trailing slash. Copy the OAuth client ID and secret.
2. **Deploy the helper.** In this `worker/` folder:

   ```bash
   npm install -g wrangler
   wrangler login
   wrangler secret put NOTION_CLIENT_ID
   wrangler secret put NOTION_CLIENT_SECRET
   wrangler deploy
   ```

   In `wrangler.toml`, set `ALLOWED_ORIGINS` to your site, for example `https://yourname.github.io`.
3. **Tell Daybook about it.** Edit `js/config.js`:

   ```js
   window.DAYBOOK_CONFIG = {
     helperUrl: "https://daybook-helper.yourname.workers.dev",
     notionClientId: "your-oauth-client-id"
   };
   ```
4. Open Daybook, go to **Settings, Plug-ins, Notion** and choose **Connect with Notion**. Pick the pages and databases to share, then choose the database that holds your tasks and match its columns.

## Without sign-in

If you do not want to create a public integration, make an **internal** integration instead, copy its secret token, share your database with it, and paste the token and your helper URL under **Advanced** in the Notion card. You still need the helper for the CORS part.

## What the helper allows

Only these Notion calls are forwarded: search, read a database, query a database, create a page, update a page, and read the current user. Everything else is refused.

## Test it

```bash
curl https://daybook-helper.yourname.workers.dev/health
# {"ok":true}
```
