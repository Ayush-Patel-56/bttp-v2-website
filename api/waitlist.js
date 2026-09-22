// Vercel Serverless Function: POST /api/waitlist
//
// This is the fix for audit findings BTTP-01 (unauthenticated public write
// endpoint) and BTTP-05 (no-cors hides failures). The browser now only ever
// talks to this same-origin endpoint. The Google Apps Script URL and the
// shared secret used to authenticate to it live only in server env vars,
// never in client JS.
//
// Required environment variables (set in Vercel project settings):
//   GOOGLE_SCRIPT_URL        - the Apps Script /exec URL (see google-apps-script.gs)
//   WAITLIST_SHARED_SECRET   - random string, must match SHARED_SECRET in the Apps Script

// Best-effort in-memory rate limit. This resets whenever the serverless
// instance cold-starts, so it is not a durable guarantee - it is a cheap
// second layer behind the honeypot, not a replacement for one.
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const RATE_LIMIT_MAX = 5;
const hits = new Map();

function isRateLimited(key) {
  const now = Date.now();
  const timestamps = (hits.get(key) || []).filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
  timestamps.push(now);
  hits.set(key, timestamps);
  if (hits.size > 5000) {
    // Cheap cleanup so the Map cannot grow unbounded across a long-lived instance.
    for (const [k, v] of hits) {
      if (v.every((t) => now - t >= RATE_LIMIT_WINDOW_MS)) hits.delete(k);
    }
  }
  return timestamps.length > RATE_LIMIT_MAX;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^[0-9+\-\s()]{7,20}$/;

// Google Sheets treats a cell starting with =, +, -, or @ as a formula.
// Prefix such values with a straight quote so nothing can execute if the
// sheet is later opened in Excel/Sheets (BTTP-01 formula-injection note).
function sanitizeCell(value) {
  const v = String(value ?? '');
  return /^[=+\-@]/.test(v) ? `'${v}` : v;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'method_not_allowed' });
  }

  const ip =
    (req.headers['x-forwarded-for'] || '').split(',')[0].trim() ||
    req.socket?.remoteAddress ||
    'unknown';

  if (isRateLimited(ip)) {
    return res.status(429).json({ ok: false, error: 'rate_limited' });
  }

  // Vercel's Node.js runtime parses application/json bodies for us, but
  // accessing req.body throws on malformed JSON (see Vercel docs).
  let body;
  try {
    body = req.body;
  } catch {
    return res.status(400).json({ ok: false, error: 'invalid_json' });
  }
  if (!body || typeof body !== 'object') {
    return res.status(400).json({ ok: false, error: 'invalid_json' });
  }

  const { email, phone, comment, website } = body;

  // Honeypot: a real visitor never fills this hidden field in. A bot filling
  // every field usually will. Silently report success so we don't teach
  // scrapers which field to skip.
  if (website) {
    return res.status(200).json({ ok: true });
  }

  const cleanEmail = typeof email === 'string' ? email.trim() : '';
  const cleanPhone = typeof phone === 'string' ? phone.trim() : '';
  const cleanComment = typeof comment === 'string' ? comment.trim().slice(0, 2000) : '';

  if (!cleanEmail || !EMAIL_RE.test(cleanEmail)) {
    return res.status(400).json({ ok: false, error: 'invalid_email' });
  }
  if (cleanPhone && !PHONE_RE.test(cleanPhone)) {
    return res.status(400).json({ ok: false, error: 'invalid_phone' });
  }

  const scriptUrl = process.env.GOOGLE_SCRIPT_URL;
  const sharedSecret = process.env.WAITLIST_SHARED_SECRET;
  if (!scriptUrl || !sharedSecret) {
    console.error('waitlist: missing GOOGLE_SCRIPT_URL or WAITLIST_SHARED_SECRET env var');
    return res.status(500).json({ ok: false, error: 'server_not_configured' });
  }

  try {
    const upstream = await fetch(scriptUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        secret: sharedSecret,
        email: sanitizeCell(cleanEmail),
        phone: sanitizeCell(cleanPhone),
        comment: sanitizeCell(cleanComment)
      })
    });

    // Apps Script's ContentService always responds HTTP 200, so the real
    // outcome is in the JSON body rather than the status code.
    let upstreamBody = null;
    try {
      upstreamBody = await upstream.json();
    } catch {
      // fall through - treated as an error below
    }

    if (!upstream.ok || !upstreamBody || upstreamBody.result !== 'success') {
      console.error('waitlist: upstream Apps Script rejected the request', upstream.status, upstreamBody);
      return res.status(502).json({ ok: false, error: 'upstream_error' });
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('waitlist: failed to reach Apps Script', err);
    return res.status(502).json({ ok: false, error: 'upstream_unreachable' });
  }
}
