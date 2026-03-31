require('dotenv').config();
const express = require('express');
const axios = require('axios');
const mongoose = require('mongoose');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const gemini = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
if (process.env.GEMINI_API_KEY) console.log('✅ Gemini connected');

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const VERIFY_TOKEN = process.env.VERIFY_TOKEN;
const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN;
const PORT = process.env.PORT || 3000;

// ---------------- MONGODB ----------------

mongoose
  .connect(process.env.DB_URL.replace('/?', '/aapki_pooja?'))
  .then(() => console.log('✅ MongoDB connected'))
  .catch(err => console.error('❌ MongoDB error:', err.message));

const productSchema = new mongoose.Schema(
  {
    id: String,
    name: String,
    quantity: Number,
    color: String,
    size: String,
  },
  { collection: 'products' },
);

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

      // If message is already a product ID, skip Gemini
      const directMatch = text
        .trim()
        .toUpperCase()
        .match(/^[A-Z]\d{3}$/);
      const productId = directMatch
        ? directMatch[0]
        : await extractProductId(text);
      console.log('Extracted ID:', productId);

      let productInfo = null;
      if (productId) {
        const product = await Product.findOne({ id: productId });
        if (product) {
          productInfo = { found: true, name: product.name, id: product.id, quantity: product.quantity };
        } else {
          productInfo = { found: false, id: productId };
        }
      }

      const reply = await generateReply(text, productInfo);
      await sendMessage(senderId, reply);
    }
  }
});

// ---------------- GEMINI FUNCTIONS ----------------

async function extractProductId(text) {
  const prompt = `You are a product ID extractor. Extract the product ID from the message below. A product ID is a letter followed by exactly 3 digits (e.g. P001, S003, P002). The message may be in any language including Hindi/Hinglish. Reply with ONLY the product ID in uppercase (e.g. P001). If no product ID is found or mentioned, reply with ONLY the word "null". Do not add any explanation.

Message: "${text}"`;

  try {
    const result = await gemini.generateContent(prompt);
    const response = result.response.text().trim().toUpperCase();
    const match = response.match(/[A-Z]\d{3}/);
    if (match) return match[0];
    return null;
  } catch (err) {
    console.error('❌ Gemini error:', err.message);
    return null;
  }
}

async function generateReply(userMessage, productInfo) {
  let context;
  if (!productInfo) {
    context = `The user did not mention any product ID. Politely ask them to provide a product ID (format: letter + 3 digits, e.g. P001) so you can check availability.`;
  } else if (!productInfo.found) {
    context = `The user asked about product ID "${productInfo.id}" but it was not found in our catalog. Politely inform them.`;
  } else if (productInfo.quantity > 0) {
    context = `Product "${productInfo.name}" (ID: ${productInfo.id}) is available with ${productInfo.quantity} pieces in stock. Share this good news politely.`;
  } else {
    context = `Product "${productInfo.name}" (ID: ${productInfo.id}) is currently out of stock. Inform the user politely and apologize.`;
  }

  const prompt = `You are a friendly customer support assistant for an online clothing store called "Aapki Pooja".

User message: "${userMessage}"
Situation: ${context}

Instructions:
- Detect the language of the user message (Hindi, English, or Hinglish) and reply in the SAME language
- Be polite, warm, and conversational
- Keep the reply short (1-2 sentences max)
- Do not use markdown, asterisks, or formatting — plain text only`;

  try {
    const result = await gemini.generateContent(prompt);
    return result.response.text().trim();
  } catch (err) {
    console.error('❌ Gemini reply error:', err.message);
    // Fallback to plain text if Gemini fails
    if (!productInfo) return 'Please provide a product ID (e.g. P001) so I can check availability for you.';
    if (!productInfo.found) return `Product ID "${productInfo.id}" not found.`;
    if (productInfo.quantity > 0) return `Yes, ${productInfo.name} (${productInfo.id}) is available (${productInfo.quantity} pieces).`;
    return `Sorry, ${productInfo.name} (${productInfo.id}) is currently out of stock.`;
  }
}

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
    console.error(
      '❌ Error sending reply:',
      error.response?.data || error.message,
    );
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
        { params: { access_token: PAGE_ACCESS_TOKEN } },
      );
      console.log('✅ Instagram account subscribed to webhook messages');
    } catch (err) {
      console.error(
        '⚠️  Subscription error:',
        err.response?.data?.error?.message || err.message,
      );
    }
  }
});
