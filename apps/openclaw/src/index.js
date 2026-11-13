const express = require('express');
const cors = require('cors');
const path = require('path');
const QRCode = require('qrcode');

const app = express();
const port = process.env.PORT || 8080;

let config = {
  webhookUrl: process.env.WEBHOOK_URL || 'http://api:3000/api/v1/whatsapp/webhook',
  apiKey: process.env.API_KEY || 'claw_sec_token_999',
  botNumber: process.env.BOT_NUMBER || '50588888888',
  status: 'ONLINE',
  sessionActive: true,
  sessionQrPayload: `2@${Date.now()},OpenClawAuth,CorpCreditPOS,50588888888`,
};

app.use(cors());
app.use(express.json());

// In-memory message store for live monitoring
const messageStore = [];

// ================= WEB UI =================
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'ui.html'));
});

// ================= HEALTH & STATUS =================
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'healthy', timestamp: new Date().toISOString() });
});

app.get('/v1/status', (req, res) => {
  res.json({
    gateway: 'OpenClaw Enterprise WhatsApp Gateway',
    version: '2.4.0',
    status: config.status,
    session_active: config.sessionActive,
    webhook_url: config.webhookUrl,
    api_key: config.apiKey,
    bot_number: config.botNumber,
    active_connections: 1,
    messages_processed: messageStore.length,
    uptime_seconds: Math.floor(process.uptime()),
  });
});

// ================= DYNAMIC CONFIGURATION =================
app.post('/v1/config', (req, res) => {
  const { webhook_url, api_key, bot_number } = req.body;
  if (webhook_url) config.webhookUrl = webhook_url.trim();
  if (api_key) config.apiKey = api_key.trim();
  if (bot_number) config.botNumber = bot_number.trim();

  console.log(`[OpenClaw Gateway] Configuración actualizada: Webhook -> ${config.webhookUrl}, Bot -> ${config.botNumber}`);

  res.json({
    success: true,
    webhook_url: config.webhookUrl,
    api_key: config.apiKey,
    bot_number: config.botNumber,
    status: config.status,
    session_active: config.sessionActive,
  });
});

// Test webhook connectivity
app.post('/v1/ping-webhook', async (req, res) => {
  const startTime = Date.now();
  try {
    const pingPayload = {
      from: config.botNumber,
      message: 'PING_HEALTHCHECK',
    };

    const response = await fetch(config.webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(pingPayload),
    });

    const latencyMs = Date.now() - startTime;
    let data;
    try {
      data = await response.json();
    } catch {
      data = { statusText: response.statusText };
    }

    res.json({
      success: response.ok,
      status_code: response.status,
      latency_ms: latencyMs,
      target_url: config.webhookUrl,
      response: data,
    });
  } catch (err) {
    res.status(502).json({
      success: false,
      error: `Error al contactar ${config.webhookUrl}: ${err.message}`,
      target_url: config.webhookUrl,
    });
  }
});

// ================= QR & SESSION =================
app.get('/v1/session/qr', async (req, res) => {
  try {
    const qrImage = await QRCode.toDataURL(config.sessionQrPayload, {
      width: 250,
      margin: 2,
      color: {
        dark: '#0F172A',
        light: '#FFFFFF',
      },
    });

    res.json({
      session_active: config.sessionActive,
      bot_number: config.botNumber,
      qr_payload: config.sessionQrPayload,
      qr_image: qrImage,
    });
  } catch (err) {
    res.status(500).json({ error: `Error generando QR: ${err.message}` });
  }
});

app.post('/v1/session/restart', (req, res) => {
  config.sessionQrPayload = `2@${Date.now()},OpenClawAuth,CorpCreditPOS,${config.botNumber}`;
  config.sessionActive = true;
  console.log('[OpenClaw Gateway] Sesión de WhatsApp Web reiniciada');
  res.json({
    success: true,
    message: 'Sesión reiniciada con éxito',
    new_payload: config.sessionQrPayload,
  });
});

// ================= MESSAGING ENDPOINTS =================
app.get('/v1/messages', (req, res) => {
  res.json(messageStore.slice(-100).reverse());
});

app.delete('/v1/messages', (req, res) => {
  messageStore.length = 0;
  res.json({ success: true, message: 'Historial de mensajes limpiado' });
});

// Outbound endpoint called by NestJS backend to send WhatsApp vouchers & balance replies
app.post('/v1/messages', (req, res) => {
  const authHeader = req.headers.authorization;
  if (config.apiKey && authHeader !== `Bearer ${config.apiKey}`) {
    if (authHeader && !authHeader.includes(config.apiKey)) {
      return res.status(401).json({ error: 'Unauthorized: Invalid API key' });
    }
  }

  const { recipient, type, text } = req.body;
  if (!recipient || !text || !text.body) {
    return res.status(400).json({ error: 'Missing required parameters: recipient, text.body' });
  }

  const messageId = `CLAW-OUT-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  const record = {
    id: messageId,
    direction: 'OUTBOUND',
    to: recipient,
    body: text.body,
    timestamp: new Date().toISOString(),
    status: 'DELIVERED',
  };

  messageStore.push(record);
  console.log(`[OpenClaw Gateway] Mensaje enviado a ${recipient}:`, text.body.substring(0, 80) + '...');

  res.status(200).json({
    success: true,
    message_id: messageId,
    recipient,
    status: 'DELIVERED',
    timestamp: record.timestamp,
  });
});

// Inbound webhook simulation / trigger endpoint to test customer interactions
app.post('/v1/webhook/simulate', async (req, res) => {
  const { from, message } = req.body;
  if (!from || !message) {
    return res.status(400).json({ error: 'Parameters "from" and "message" are required' });
  }

  const inboundRecord = {
    id: `CLAW-IN-${Date.now()}`,
    direction: 'INBOUND',
    from,
    body: message,
    timestamp: new Date().toISOString(),
    status: 'FORWARDED_TO_BACKEND',
  };
  messageStore.push(inboundRecord);

  try {
    const response = await fetch(config.webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, message }),
    });

    const data = await response.json();
    res.json({
      success: true,
      forwarded_to: config.webhookUrl,
      backend_response: data,
    });
  } catch (err) {
    res.status(502).json({
      success: false,
      error: `Error al contactar webhook en ${config.webhookUrl}: ${err.message}`,
    });
  }
});

app.listen(port, '0.0.0.0', () => {
  console.log(`🟢 OpenClaw WhatsApp Gateway activo en http://0.0.0.0:${port}`);
  console.log(`🔗 Webhook destino configurado: ${config.webhookUrl}`);
});
