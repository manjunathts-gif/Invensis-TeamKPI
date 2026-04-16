// Cloudflare Pages Function — Supabase proxy
// Secures the Supabase anon key behind origin validation
// Only requests from invensis.myteamkpi.com are forwarded

const SUPABASE_URL = 'https://vnibbqgpdtzamztmhheu.supabase.co';
const ALLOWED_ORIGINS = [
  'https://invensis.myteamkpi.com',
  'https://invensis-teamkpi.pages.dev',
];

export async function onRequest(context) {
  const { request, env } = context;
  const origin = request.headers.get('Origin') || '';
  const referer = request.headers.get('Referer') || '';

  // ── Handle CORS preflight ──────────────────────────────
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders(origin),
    });
  }

  // ── Origin check — block requests not from your app ───
  const isAllowedOrigin = ALLOWED_ORIGINS.some(o => origin.startsWith(o));
  const isAllowedReferer = ALLOWED_ORIGINS.some(o => referer.startsWith(o));
  const isDirectBrowserAccess = !origin && !referer; // e.g. typing URL directly

  // Allow if origin matches, or if it's a same-origin request (no Origin header)
  // Block if Origin header is present but doesn't match allowed list
  if (origin && !isAllowedOrigin) {
    return new Response(JSON.stringify({ error: 'Forbidden' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // ── Block direct browser URL access (no Referer from app) ──
  // This stops someone just typing the URL in a browser
  if (isDirectBrowserAccess && request.method === 'GET') {
    // Allow HEAD requests (used for count queries internally)
    if (request.method !== 'HEAD') {
      return new Response(JSON.stringify({ error: 'Direct access not permitted' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }

  // ── Build target Supabase URL ──────────────────────────
  const url = new URL(request.url);
  // Strip /db prefix — path is /db/rest/v1/... → /rest/v1/...
  const targetPath = url.pathname.replace(/^\/db/, '');
  const targetUrl = SUPABASE_URL + targetPath + url.search;

  // ── Forward request to Supabase ───────────────────────
  try {
    const supabaseResponse = await fetch(targetUrl, {
      method: request.method,
      headers: {
        'Content-Type': 'application/json',
        'apikey': request.headers.get('apikey') || '',
        'Authorization': request.headers.get('Authorization') || '',
        'Prefer': request.headers.get('Prefer') || '',
        'Range': request.headers.get('Range') || '',
        'X-Client-Info': 'kpi-proxy/1.0',
      },
      body: ['POST', 'PUT', 'PATCH'].includes(request.method)
        ? await request.text()
        : undefined,
    });

    const responseBody = await supabaseResponse.text();

    return new Response(responseBody, {
      status: supabaseResponse.status,
      headers: {
        'Content-Type': supabaseResponse.headers.get('Content-Type') || 'application/json',
        'Content-Range': supabaseResponse.headers.get('Content-Range') || '',
        ...corsHeaders(origin),
      },
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: 'Proxy error', message: err.message }), {
      status: 502,
      headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
    });
  }
}

function corsHeaders(origin) {
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin)
    ? origin
    : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS, HEAD',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey, Prefer, Range',
    'Access-Control-Expose-Headers': 'Content-Range',
  };
}
