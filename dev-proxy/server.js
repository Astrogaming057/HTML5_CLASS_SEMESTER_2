const express = require('express');
const http = require('http');
const WebSocket = require('ws');

const app = express();
app.use(express.json());

// Simple in-memory machine registry (for dev only)
// username -> Map(machineId -> ws)
const machines = new Map();

// Health check
app.get('/health', (req, res) => {
  res.json({ ok: true });
});

// List machines for a user (dev-only, no real auth yet)
app.get('/machines', (req, res) => {
  const username = req.query.username;
  if (!username) {
    return res.status(400).json({ ok: false, error: 'username is required' });
  }

  const userMachines = machines.get(username);
  const list = userMachines ? Array.from(userMachines.keys()) : [];
  res.json({ ok: true, machines: list });
});

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

wss.on('connection', (ws, req) => {
  const token = req.headers['x-auth-token'];
  const machineId = req.headers['x-machine-id'] || 'unknown';

  // For now, treat token as username
  const username = token || 'anonymous';

  if (!machines.has(username)) {
    machines.set(username, new Map());
  }
  machines.get(username).set(machineId, ws);

  ws.on('message', (data) => {
    let msg;
    try {
      msg = JSON.parse(data);
    } catch {
      return;
    }

    if (msg.type === 'REGISTER_MACHINE') {
      // For now, nothing extra – already stored above
      return;
    }

    if (msg.type === 'FORWARD_TO_MACHINE') {
      const { targetMachineId, payload } = msg;
      const targetWs = machines.get(username)?.get(targetMachineId);
      if (targetWs && targetWs.readyState === WebSocket.OPEN) {
        targetWs.send(JSON.stringify({
          ...payload,
          fromMachineId: machineId,
        }));
      }
    }
  });

  ws.on('close', () => {
    const userMachines = machines.get(username);
    if (userMachines) {
      userMachines.delete(machineId);
    }
  });
});

const PORT = process.env.PORT || 9978;
server.listen(PORT, () => {
  console.log(`Dev proxy server listening on port ${PORT}`);
});

