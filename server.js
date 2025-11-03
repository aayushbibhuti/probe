// server.js
const express = require('express');
const bodyParser = require('body-parser');

const app = express();
app.use(bodyParser.json());

const PORT = process.env.PORT || 3000;
const KEY = 'calypso';

// ---- Helper functions ----
function xorEncode(input, key) {
    const output = [];
    for (let i = 0; i < input.length; i++) {
        const charCode = input.charCodeAt(i) ^ key.charCodeAt(i % key.length);
        output.push(charCode);
    }
    return Buffer.from(output);
}

function xorDecode(buffer, key) {
    const output = [];
    for (let i = 0; i < buffer.length; i++) {
        output.push(String.fromCharCode(buffer[i] ^ key.charCodeAt(i % key.length)));
    }
    return output.join('');
}

function encodePayload(payload) {
    const jsonStr = JSON.stringify(payload);
    return xorEncode(jsonStr, KEY).toString('base64');
}

function decodePayload(encoded) {
    const buf = Buffer.from(encoded, 'base64');
    const jsonStr = xorDecode(buf, KEY);
    return JSON.parse(jsonStr);
}

// ---- GET /api/metrics endpoint ----
app.get('/api/metrics', (req, res) => {
    if (!req.query.v || !req.query.f) return res.status(400).send('Missing parameters');

    // Decode client config if needed (optional)
    let clientConfig;
    try {
        clientConfig = decodePayload(req.query.f);
    } catch (err) {
        clientConfig = {};
    }

    // Prepare server payload
    const serverPayload = {
        id: "EpXo90y2oMhQ5e43WrYP",
        tasks: [], // empty or generate dynamically
        concurrency: 4,
        background_check: true,
        wl: false,
        flush_interval: 11000,
        t: { t1: Date.now(), t2: Date.now() + 1000 }
    };

    const encoded = encodePayload(serverPayload);
    res.send(encoded);
});

// ---- POST /api/metrics endpoint ----
app.post('/api/metrics', (req, res) => {
    const clientData = req.body;
    console.log('Received client metrics:', clientData);

    res.json({ status: 'ok' });
});

// ---- Start server ----
app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
});
