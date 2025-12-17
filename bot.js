require('dotenv').config();
const path = require('path');
const express = require('express');
const { Client, GatewayIntentBits } = require('discord.js');

const TOKEN = process.env.DISCORD_TOKEN;
const CHANNEL_ID = process.env.CHANNEL_ID;
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

// Serve static files
// This assumes 'index.html' and 'script.js' are in a folder named 'public'
// OR if they are in the root folder, use express.static(__dirname)
app.use(express.static(path.join(__dirname, 'public')));

// Fallback: If 'public' folder doesn't exist, try serving from root (useful for simple setups)
app.use(express.static(__dirname));

// Simple health check
app.get('/health', (req, res) => {
  res.json({ ok: true });
});

// Receive image from browser and send to Discord
app.post('/upload', async (req, res) => {
  try {
    const { imageBase64 } = req.body;

    if (!imageBase64) {
      return res.status(400).json({ ok: false, error: 'No imageBase64 provided' });
    }

    // imageBase64 is a data URL like "data:image/png;base64,...."
    const base64Data = imageBase64.split(',')[1] || imageBase64;
    const buffer = Buffer.from(base64Data, 'base64');

    const channel = await client.channels.fetch(CHANNEL_ID);
    if (!channel || !channel.isTextBased()) {
      return res.status(500).json({ ok: false, error: 'Channel not found or not text-based' });
    }

    await channel.send({
      content: '📸 New frame from camera game!',
      files: [
        {
          attachment: buffer,
          name: `camera-frame-${Date.now()}.png`
        }
      ]
    });

    res.json({ ok: true });
  } catch (err) {
    console.error('Error in /upload:', err);
    res.status(500).json({ ok: false, error: 'Server error' });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`🌐 Web server running on http://localhost:${PORT}`);
  console.log(`   (Also accessible via kartcage.com if configured)`);
});

// Login bot
client.login(TOKEN).catch(err => {
  console.error('Failed to login to Discord:', err);
  process.exit(1);
});