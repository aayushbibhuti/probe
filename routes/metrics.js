/**
 * routes/metrics.js
 * POST /api/metrics?v=...
 *
 * - Accepts JSON telemetry payloads
 * - Optional decoding (XOR+base64) if client sends encoded string
 * - Validates payload shape with AJV
 * - Persists to MongoDB telemetry collection
 * - Adds server metadata (receivedAt, clientV, clientIp)
 */

const express = require('express');
const Ajv = require('ajv').default;
const router = express.Router();
const ajv = new Ajv({ allErrors: true, removeAdditional: true });

let db = null;
function setDb(mongoDb) {
  db = mongoDb;
}
module.exports.setDb = setDb;

// --- basic schema (trimmed but strict for main fields) ---
const telemetrySchema = {
  type: 'object',
  required: ['timestamp', 'env'],
  properties: {
    id: { type: 'string' },
    timestamp: { type: 'integer' },
    env: {
      type: 'object',
      required: ['userAgent'],
      properties: {
        userAgent: { type: 'string' },
        language: { type: 'string' },
        online: { type: 'boolean' },
        downlink: { type: ['number', 'null'] },
        effectiveType: { type: ['string', 'null'] },
        rtt: { type: ['number', 'null'] },
        saveData: { type: ['boolean', 'null'] },
        type: { type: ['string', 'null'] },
        timezone: { type: ['string', 'null'] },
        locale: { type: ['string', 'null'] },
        offsetMinutes: { type: ['integer', 'null'] },
        href: { type: ['string', 'null'] },
        referrer: { type: ['string', 'null'] }
      },
      additionalProperties: true
    },
    trace: {
      type: 'array',
      items: {
        type: 'object',
        required: ['event', 'timestamp'],
        properties: {
          event: { type: 'string' },
          timestamp: { type: 'integer' },
          data: { type: 'object' }
        },
        additionalProperties: true
      }
    },
    pings: {
      type: 'array',
      items: {
        type: 'object',
        required: ['url', 'duration'],
        properties: {
          site: { type: ['string', 'null'] },
          url: { type: 'string' },
          start: { type: ['integer', 'null'] },
          duration: { type: 'number' },
          timeout: { type: 'boolean' },
          error: { type: 'boolean' }
        },
        additionalProperties: true
      }
    },
    meta: { type: 'object' }
  },
  additionalProperties: true
};
const validate = ajv.compile(telemetrySchema);

// --- helper: decode XOR+Base64 if needed ---
// If payload body is a string (not parsed JSON), and vParam is present,
// we attempt to base64-decode and XOR with vParam as key.
// This mirrors how some clients obfuscate payloads.
function tryDecodeMaybe(bodyString, vParam) {
  if (!bodyString || typeof bodyString !== 'string') return null;
  // Remove whitespace and try base64
  const b64 = bodyString.trim();
  try {
    const buffer = Buffer.from(b64, 'base64');
    if (!vParam) {
      // plain base64 -> JSON
      return buffer.toString('utf8');
    }
    // XOR with the vParam bytes (repeating key)
    const key = Buffer.from(String(vParam));
    for (let i = 0; i < buffer.length; i++) {
      buffer[i] = buffer[i] ^ key[i % key.length];
    }
    return buffer.toString('utf8');
  } catch (err) {
    return null;
  }
}

function extractClientIp(req) {
  return (req.headers['x-forwarded-for'] || req.ip || req.connection.remoteAddress || '').split(',')[0].trim();
}

// very small in-memory bucket limiter to protect DB (process-local)
const buckets = new Map();
function allowRequest(ip) {
  const WINDOW = 60_000; // 1 minute
  const MAX = process.env.RATE_LIMIT_MAX ? parseInt(process.env.RATE_LIMIT_MAX) : 300;
  const now = Date.now();
  const b = buckets.get(ip) || { ts: now, count: 0 };
  if (now - b.ts > WINDOW) {
    b.ts = now;
    b.count = 0;
  }
  b.count++;
  buckets.set(ip, b);
  return b.count <= MAX;
}

router.post('/', async (req, res) => {
  try {
    const vParam = (req.query.v || '').toString();
    const clientIp = extractClientIp(req);

    if (!allowRequest(clientIp)) {
      return res.status(429).json({ error: 'rate_limited' });
    }

    // If body is an object (express.json parsed it), use directly.
    // If body is a string (maybe encoded), attempt decode.
    let payload = req.body;

    if (typeof payload === 'string') {
      const decoded = tryDecodeMaybe(payload, vParam);
      if (!decoded) {
        return res.status(400).json({ error: 'cannot_decode_payload' });
      }
      try {
        payload = JSON.parse(decoded);
      } catch (err) {
        return res.status(400).json({ error: 'invalid_json_after_decode' });
      }
    }

    if (!payload || typeof payload !== 'object') {
      return res.status(400).json({ error: 'invalid_payload' });
    }

    // enrich with server metadata
    payload.receivedAt = Date.now();
    payload.clientV = vParam || null;
    payload.meta = payload.meta || {};
    payload.meta.clientIp = clientIp;

    // Validate schema
    const ok = validate(payload);
    if (!ok) {
      // Return limited error info to avoid leaking schema internals
      return res.status(400).json({ error: 'invalid_schema', details: validate.errors });
    }

    // Persist (if DB configured)
    if (!db) {
      console.warn('No DB configured - telemetry dropped (dev mode).');
    } else {
      const col = db.collection('telemetry');
      await col.insertOne(payload);
    }

    return res.status(201).json({ status: 'ok' });
  } catch (err) {
    console.error('metrics handler error', err);
    return res.status(500).json({ error: 'server_error' });
  }
});

module.exports = { router, setDb };
