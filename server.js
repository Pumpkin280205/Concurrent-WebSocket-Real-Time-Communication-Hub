const WebSocket = require('ws');
const { createClient } = require('redis');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const LOG_FILE = path.join(__dirname, 'logs', 'transactions.log');

const redis = createClient({ url: process.env.REDIS_URL || 'redis://localhost:6379' });
redis.on('error', err => console.error('[redis]', err.message));

// channels: name -> Set of websockets
const channels = new Map();

function logTransaction(user, channel, text) {
  const entry = JSON.stringify({ ts: new Date().toISOString(), user, channel, text }) + '\n';
  fs.appendFileSync(LOG_FILE, entry);
}

function broadcast(channel, message) {
  const clients = channels.get(channel);
  if (!clients) return;
  const data = JSON.stringify(message);
  for (const client of clients) {
    if (client.readyState === WebSocket.OPEN) client.send(data);
  }
}

async function start() {
  await redis.connect();
  fs.mkdirSync(path.dirname(LOG_FILE), { recursive: true });

  const wss = new WebSocket.Server({ port: PORT });
  console.log(`WS hub listening on :${PORT}`);

  wss.on('connection', (ws, req) => {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const user = url.searchParams.get('user') || 'anonymous';
    const channel = url.searchParams.get('channel') || 'general';

    // cache active user in Redis (socket id -> user)
    const socketId = req.headers['sec-websocket-key'];
    redis.hSet('active:users', socketId, JSON.stringify({ user, channel, connectedAt: Date.now() }));

    // join channel
    if (!channels.has(channel)) channels.set(channel, new Set());
    channels.get(channel).add(ws);

    broadcast(channel, { type: 'system', text: `${user} joined ${channel}`, user: 'system' });

    ws.on('message', raw => {
      let parsed;
      try { parsed = JSON.parse(raw); } catch { return; }
      const { channel: c, text } = parsed || {};
      if (!c || typeof text !== 'string') return;

      const target = c; // client can switch channels per message
      if (!channels.has(target)) channels.set(target, new Set());
      channels.get(target).add(ws);

      logTransaction(user, target, text);
      broadcast(target, { type: 'chat', user, channel: target, text, ts: new Date().toISOString() });
    });

    ws.on('close', () => {
      redis.hDel('active:users', socketId);
      for (const [, clients] of channels) clients.delete(ws);
    });
  });
}

start().catch(err => { console.error(err); process.exit(1); });
