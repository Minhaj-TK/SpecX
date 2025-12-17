require('dotenv').config();
const path = require('path');
const express = require('express');
const { Client, GatewayIntentBits } = require('discord.js');

const TOKEN = process.env.DISCORD_TOKEN;
const CHANNEL_ID = process.env.CHANNEL_ID;
// CHANGED: Default to port 3000 (standard), remove Spaceify specific 25405
const PORT = process.env.PORT || 3000;

if (!TOKEN || !CHANNEL_ID) {
  console.error('Please set DISCORD_TOKEN and CHANNEL_ID in .env');
  process.exit(1);
}

// ---------- Discord bot ----------
const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

client.once('ready', () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
});

// ---------- Web server ----------
const app = express();

// Parse JSON bodies (for base64 image)
app.use(express.json({ limit: '10mb' }));

// Serve static files from 'public' folder
app.use(express.static(path.join(__dirname, 'public')));
// Fallback if files are in root
app.use(express.static(__dirname));

// Simple health check
app.get('/health', (req, res) => {
  res.json({ ok: true });
});

// Receive image from browser and send to Discord
app.post('/upload', async (req, res) => {
  try {
    const { imageBase64, challenge } = req.body;

    if (!imageBase64) {
      console.log('❌ Upload request missing imageBase64');
      return res.status(400).json({ ok: false, error: 'No imageBase64 provided' });
    }

    // Determine extension (jpg or png)
    const isJpeg = imageBase64.startsWith('data:image/jpeg');
    const ext = isJpeg ? 'jpg' : 'png';

    // Remove prefix to get raw base64
    const base64Data = imageBase64.split(',')[1] || imageBase64;
    const buffer = Buffer.from(base64Data, 'base64');

    const channel = await client.channels.fetch(CHANNEL_ID);
    if (!channel || !channel.isTextBased()) {
      console.error(`❌ Channel ${CHANNEL_ID} not found or not text-based.`);
      return res.status(500).json({ ok: false, error: 'Channel error' });
    }

    // Send to Discord
    await channel.send({
      content: `📸 **${challenge || 'New frame from camera game!'}**`,
      files: [
        {
          attachment: buffer,
          name: `camera-frame-${Date.now()}.${ext}`
        }
      ]
    });

    console.log(`✅ Image sent to Discord (${ext})`);
    res.json({ ok: true });

  } catch (err) {
    console.error('❌ Error in /upload:', err);
    res.status(500).json({ ok: false, error: 'Server error' });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`🌐 Web server running on http://localhost:${PORT}`);
});

// Login bot
client.login(TOKEN).catch(err => {
  console.error('Failed to login to Discord:', err);
  process.exit(1);
});
