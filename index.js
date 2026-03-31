require('dotenv').config();
const express = require('express');
const axios = require('axios');
const mongoose = require('mongoose');

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const VERIFY_TOKEN = process.env.VERIFY_TOKEN;
const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN;
const PORT = process.env.PORT || 3000;

// ---------------- MONGODB ----------------

mongoose.connect(process.env.DB_URL.replace('/?', '/aapki_pooja?'))
  .then(() => console.log('✅ MongoDB connected'))
  .catch(err => console.error('❌ MongoDB error:', err.message));

const productSchema = new mongoose.Schema({
  id: String,
  name: String,
  quantity: Number,
  color: String,
  size: String,
}, { collection: 'products' });

const Product = mongoose.model('Product', productSchema);

// ---------------- TEST ROUTE ----------------

app.get('/', (req, res) => {
  res.send('Server working');
});

app.get('/test', (req, res) => {
  res.send('Webhook OK');
});

app.get('/privacy', (req, res) => {
  res.send(`<html><body>
    <h1>Privacy Policy - Corporate Couple Bot</h1>
    <p>This application is a private Instagram automation bot used by the account owner only.</p>
    <p>We do not collect, store, or share any personal data of users. Messages are processed in real-time and are not saved anywhere.</p>
    <p>This bot only responds to direct messages sent to the Corporate Couple Instagram account.</p>
    <p>For any questions, contact us via Instagram: @corporate_couple_31</p>
  </body></html>`);
});

// ---------------- WEBHOOK VERIFY ----------------

app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    console.log('Webhook verified');
    return res.status(200).send(challenge);
  }

  return res.sendStatus(403);
});

// ---------------- WEBHOOK RECEIVE ----------------

app.post('/webhook', async (req, res) => {
  res.sendStatus(200);

  console.log('--- INCOMING WEBHOOK ---');
  console.log(JSON.stringify(req.body, null, 2));

  const body = req.body;

  if (body.object !== 'instagram' && body.object !== 'page') {
    console.log('Ignoring non-instagram/page event');
    return;
  }

  for (const entry of body.entry || []) {
    for (const event of entry.messaging || []) {
      const senderId = event.sender?.id;
      const message = event.message;

      if (!message || message.is_echo) continue;

      const text = message.text;

      if (!text) continue;

      console.log('Message:', text);

      const product = await Product.findOne({ id: text.trim().toUpperCase() });

      let reply;
      if (product) {
        if (product.quantity > 0) {
          reply = `Yes, ${product.name} (${product.id}) is available (${product.quantity} pieces)`;
        } else {
          reply = `No, ${product.name} (${product.id}) is not available`;
        }
      } else {
        reply = `Product ID "${text.trim()}" not found`;
      }

      await sendMessage(senderId, reply);
    }
  }
});

// ---------------- SEND MESSAGE ----------------

async function sendMessage(id, text) {
  try {
    await axios.post(
      'https://graph.instagram.com/v21.0/me/messages',
      {
        recipient: { id },
        message: { text },
      },
      {
        params: {
          access_token: PAGE_ACCESS_TOKEN,
        },
      },
    );
    console.log('✅ Reply sent successfully to:', id);
  } catch (error) {
    console.error('❌ Error sending reply:', error.response?.data || error.message);
  }
}

// ---------------- START SERVER ----------------

app.listen(PORT, async () => {
  console.log('Server running on port', PORT);
  console.log('Webhook:', `http://localhost:${PORT}/webhook`);

  // Auto-subscribe Instagram account to receive webhook events
  const INSTAGRAM_ACCOUNT_ID = process.env.INSTAGRAM_ACCOUNT_ID;
  if (INSTAGRAM_ACCOUNT_ID && PAGE_ACCESS_TOKEN) {
    try {
      await axios.post(
        `https://graph.instagram.com/v21.0/${INSTAGRAM_ACCOUNT_ID}/subscribed_apps`,
        { subscribed_fields: 'messages' },
        { params: { access_token: PAGE_ACCESS_TOKEN } }
      );
      console.log('✅ Instagram account subscribed to webhook messages');
    } catch (err) {
      console.error('⚠️  Subscription error:', err.response?.data?.error?.message || err.message);
    }
  }
});
