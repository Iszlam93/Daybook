/*
 * Daybook Notion helper (Cloudflare Worker).
 *
 * Why it exists: Notion's API does not allow requests straight from a web page (no CORS),
 * and the OAuth sign-in needs a client secret that must never sit in a web page.
 *
 * What it does, and nothing else:
 *   POST /oauth/token   trades a sign-in code for a Notion access token
 *   ANY  /api/...       forwards a small allow-list of Notion API calls, using the token
 *                       the browser sends in the X-Notion-Token header
 *   GET  /health        says ok
 *
 * It stores nothing and logs nothing. The token lives in the user's browser.
 *
 * Secrets (set with `wrangler secret put`): NOTION_CLIENT_ID, NOTION_CLIENT_SECRET
 * Variable (wrangler.toml): ALLOWED_ORIGINS, a comma separated list such as
 *   "https://yourname.github.io". Leave empty to allow any origin while testing.
 */

const NOTION = "https://api.notion.com/v1";
const NOTION_VERSION = "2022-06-28";

// The only Notion calls Daybook needs.
const ALLOWED = [
  ["POST", /^\/search$/],
  ["GET", /^\/databases\/[0-9a-f-]{32,36}$/i],
  ["POST", /^\/databases\/[0-9a-f-]{32,36}\/query$/i],
  ["POST", /^\/pages$/],
  ["PATCH", /^\/pages\/[0-9a-f-]{32,36}$/i],
  ["GET", /^\/users\/me$/]
];

function corsHeaders(origin, env) {
  const list = String(env.ALLOWED_ORIGINS || "").split(",").map((s) => s.trim()).filter(Boolean);
  const allowOrigin = list.length === 0 ? "*" : (list.indexOf(origin) >= 0 ? origin : "");
  if (!allowOrigin) return null;
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": "GET, POST, PATCH, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Notion-Token",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin"
  };
}

function json(body, status, cors) {
  return new Response(JSON.stringify(body), { status: status || 200, headers: Object.assign({ "Content-Type": "application/json" }, cors || {}) });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const cors = corsHeaders(request.headers.get("Origin") || "", env);
    if (!cors) return json({ error: "origin_not_allowed" }, 403);
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });

    try {
      if (url.pathname === "/health") return json({ ok: true }, 200, cors);

      if (url.pathname === "/oauth/token" && request.method === "POST") {
        if (!env.NOTION_CLIENT_ID || !env.NOTION_CLIENT_SECRET) return json({ error: "helper_not_configured" }, 500, cors);
        const { code, redirect_uri } = await request.json();
        if (!code || !redirect_uri) return json({ error: "missing_code" }, 400, cors);
        const res = await fetch(NOTION + "/oauth/token", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": "Basic " + btoa(env.NOTION_CLIENT_ID + ":" + env.NOTION_CLIENT_SECRET)
          },
          body: JSON.stringify({ grant_type: "authorization_code", code, redirect_uri })
        });
        const data = await res.json();
        // pass back only what the app needs
        if (!res.ok) return json({ error: data.error || "token_exchange_failed", message: data.error_description || data.message }, res.status, cors);
        return json({ access_token: data.access_token, workspace_name: data.workspace_name, workspace_id: data.workspace_id }, 200, cors);
      }

      if (url.pathname.indexOf("/api/") === 0) {
        const token = request.headers.get("X-Notion-Token");
        if (!token) return json({ error: "missing_token" }, 401, cors);
        const path = url.pathname.slice(4);
        const ok = ALLOWED.some(([m, re]) => m === request.method && re.test(path));
        if (!ok) return json({ error: "not_allowed" }, 403, cors);
        const init = {
          method: request.method,
          headers: { "Authorization": "Bearer " + token, "Notion-Version": NOTION_VERSION, "Content-Type": "application/json" }
        };
        if (request.method !== "GET") init.body = await request.text();
        const res = await fetch(NOTION + path + url.search, init);
        return new Response(await res.text(), { status: res.status, headers: Object.assign({ "Content-Type": "application/json" }, cors) });
      }

      return json({ error: "not_found" }, 404, cors);
    } catch (e) {
      return json({ error: "helper_error", message: String(e && e.message || e) }, 502, cors);
    }
  }
};
