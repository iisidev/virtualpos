const express = require('express');
const cors = require('cors');

const app = express();
const port = process.env.PORT || 8080;
const webhookUrl = process.env.WEBHOOK_URL || 'http://api:3000/api/v1/whatsapp/webhook';
const apiKey = process.env.API_KEY || 'claw_sec_token_999';

app.use(cors());
app.use(express.json());

// In-memory message store for live monitoring
const messageStore = [];

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'healthy', timestamp: new Date().toISOString() });
});

app.get('/v1/status', (req, res) => {
  res.json({
    gateway: 'OpenClaw Enterprise WhatsApp Gateway',
    version: '2.4.0',
    status: 'ONLINE',
    session_active: true,
    webhook_url: webhookUrl,
    active_connections: 1,
    messages_processed: messageStore.length,
  });
});

app.get('/v1/messages', (req, res) => {
  res.json(messageStore.slice(-50).reverse());
});

// Outbound endpoint called by NestJS backend to send WhatsApp vouchers & balance replies
app.post('/v1/messages', (req, res) => {
  const authHeader = req.headers.authorization;
  if (apiKey && authHeader !== `Bearer ${apiKey}`) {
    // If auth provided but mismatched, reject
    if (authHeader && !authHeader.includes(apiKey)) {
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
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, message }),
    });

    const data = await response.json();
    res.json({
      success: true,
      forwarded_to: webhookUrl,
      backend_response: data,
    });
  } catch (err) {
    res.status(502).json({
      success: false,
      error: `Error al contactar webhook en ${webhookUrl}: ${err.message}`,
    });
  }
});

app.listen(port, '0.0.0.0', () => {
  console.log(`🟢 OpenClaw WhatsApp Gateway activo en http://0.0.0.0:${port}`);
  console.log(`🔗 Webhook destino configurado: ${webhookUrl}`);
});
