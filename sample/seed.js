/**
 * sample/seed.js
 * Sends a sample telemetry POST to your local server.
 *
 * Usage:
 *   npm run seed
 * or
 *   node sample/seed.js http://localhost:3000
 */

const fetch = require('node-fetch');

const target = process.argv[2] || 'http://localhost:3000/api/metrics?v=L7ip';
const sample = {
  id: 'session-demo-1',
  timestamp: Date.now(),
  env: {
    userAgent: 'Mozilla/5.0 (X11; Linux x86_64)',
    language: 'en-US',
    online: true,
    downlink: 9.2,
    effectiveType: '4g',
    rtt: 42,
    saveData: false,
    type: 'wifi',
    timezone: 'Asia/Kolkata',
    locale: 'en-US',
    offsetMinutes: -330,
    href: 'https://example.com/demo',
    referrer: ''
  },
  trace: [
    { event: 'telemetry_start', timestamp: Date.now() },
    { event: 'click', timestamp: Date.now() + 500, data: { x: 120, y: 80 } }
  ],
  pings: [
    { site: 'example.com', url: 'https://example.com/favicon.ico', start: Date.now(), duration: 50, timeout: false, error: false }
  ]
};

(async () => {
  try {
    const resp = await fetch(target, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(sample)
    });
    const body = await resp.json();
    console.log('status', resp.status, body);
  } catch (err) {
    console.error(err);
  }
})();
