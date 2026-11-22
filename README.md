# WS Hub — Concurrent WebSocket Real-Time Communication Hub

Instant-messaging backend with live full-duplex pipelines.

## What it does

- WebSocket server (native `ws`) — multiple chat channels
- Active users cached in Redis (`active:users`, keyed by socket id)
- Every message timestamped and appended to `logs/transactions.log`

## Run it

Requires Node 18+ and a running Redis at `redis://localhost:6379`.

```powershell
npm install
npm start
# PORT=4000 REDIS_URL=redis://localhost:6379 npm start   # optional overrides
```

Connect a client:

```
ws://localhost:3000?user=alice&channel=general
```

Send a message:

```json
{ "channel": "general", "text": "hello" }
```

Each message is broadcast to that channel's subscribers and logged with an ISO timestamp to `logs/transactions.log`.

## What was skipped / not checked

- No auth, TLS, reconnect heartbeat tuning, message-history persistence beyond timestamps, tests, or Docker — none were asked for. If you need production hardening, add those next.
