const video = document.getElementById('video');
const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const statusEl = document.getElementById('status');
const challengeEl = document.getElementById('challenge');
const galleryEl = document.getElementById('gallery');
const galleryImagesEl = document.getElementById('galleryImages');
const downloadBtn = document.getElementById('downloadBtn');

let stream = null;
let captureInterval = null;
let capturedFrames = [];
let captureCount = 0;
const MAX_CAPTURES = 5;

const CHALLENGES = [
  "😁 Show your biggest smile!",
  "😡 Angry face!",
  "😜 Stick your tongue out!",
  "😎 Cool pose!",
  "😱 Surprise face!",
  "😂 Laugh hard!",
  "🤔 Thinking face!",
  "🙃 Upside-down smile!"
];

function randomChallenge() {
  return CHALLENGES[Math.floor(Math.random() * CHALLENGES.length)];
}

async function initCamera() {
  if (stream) return;

  // SECURITY CHECK:
  // Camera access only works on HTTPS (kartcage.com) or Localhost.
  const isLocal = location.hostname === 'localhost' || location.hostname === '127.0.0.1';
  const isSecure = location.protocol === 'https:';

  if (!isLocal && !isSecure) {
    statusEl.innerHTML = '❌ <strong>HTTPS Required!</strong><br>You are on HTTP. Please use https://kartcage.com or localhost.';
    statusEl.style.color = '#ef4444';
    throw new Error('Camera requires HTTPS');
  }

  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
    video.srcObject = stream;
    await video.play();
    statusEl.textContent = '✅ Camera is running. Press "Start Game" to begin!';
    statusEl.style.color = '#e5e7eb';
  } catch (err) {
    console.error('Camera error:', err);
    statusEl.textContent = '❌ Could not access camera. Check permissions.';
    throw err;
  }
}

async function captureAndSendFrame() {
  if (!video.videoWidth || !video.videoHeight) {
    console.warn('Video not ready yet');
    return;
  }

  const canvas = document.createElement('canvas');
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;

  const ctx = canvas.getContext('2d');
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

  const dataUrl = canvas.toDataURL('image/png');

  // Save locally for showing at the end
  capturedFrames.push(dataUrl);
  captureCount++;

  try {
    // UPDATED: Relative path uses the current domain (kartcage.com or localhost) automatically.
    // No hardcoded Spaceify IP/Port.
    await fetch('/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageBase64: dataUrl })
    });
  } catch (err) {
    console.error('Upload failed:', err);
    statusEl.textContent = '⚠️ Failed to send frame to server.';
  }

  // Auto-stop after MAX_CAPTURES
  if (captureCount >= MAX_CAPTURES) {
    stopGame(true);
  }
}

async function startGame() {
  startBtn.disabled = true;
  stopBtn.disabled = true;
  statusEl.textContent = 'Requesting camera permission…';
  galleryEl.style.display = 'none';
  galleryImagesEl.innerHTML = '';
  downloadBtn.style.display = 'none';
  capturedFrames = [];
  captureCount = 0;

  try {
    await initCamera();
  } catch {
    startBtn.disabled = false;
    return;
  }

  challengeEl.textContent = randomChallenge();
  statusEl.textContent = `🎮 Game running! A photo is taken every 5 seconds (total ${MAX_CAPTURES}).`;

  captureInterval = setInterval(() => {
    challengeEl.textContent = randomChallenge();
    captureAndSendFrame();
  }, 5000);

  stopBtn.disabled = false;
}

function stopGame(auto = false) {
  if (captureInterval) {
    clearInterval(captureInterval);
    captureInterval = null;
  }

  if (auto) {
    statusEl.textContent = '✅ Game finished automatically after 5 photos. Here they are!';
  } else {
    statusEl.textContent = '⏹ Game stopped. Here are your photos from the game!';
  }

  challengeEl.textContent = '';
  stopBtn.disabled = true;
  startBtn.disabled = false;

  // Show gallery with all captured frames (big)
  galleryImagesEl.innerHTML = '';
  capturedFrames.forEach((src, index) => {
    const img = document.createElement('img');
    img.src = src;
    img.alt = `Photo ${index + 1}`;
    galleryImagesEl.appendChild(img);
  });

  if (capturedFrames.length > 0) {
    galleryEl.style.display = 'block';
    downloadBtn.style.display = 'inline-block';
  } else {
    galleryEl.style.display = 'none';
    downloadBtn.style.display = 'none';
  }
}

// Convert dataURL to Uint8Array for ZIP
function dataURLToUint8Array(dataURL) {
  const base64 = dataURL.split(',')[1];
  const binary = atob(base64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

// Download all photos as a single ZIP file
async function downloadAllPhotos() {
  if (!capturedFrames.length) {
    alert('No photos to download yet!');
    return;
  }

  const zip = new JSZip();
  capturedFrames.forEach((dataUrl, index) => {
    const imageData = dataURLToUint8Array(dataUrl);
    const fileName = `photo-${index + 1}.png`;
    zip.file(fileName, imageData);
  });

  const blob = await zip.generateAsync({ type: 'blob' });

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'camera-game-photos.zip';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// Optional: stop camera tracks when closing page
window.addEventListener('beforeunload', () => {
  if (stream) {
    stream.getTracks().forEach(t => t.stop());
  }
});

startBtn.addEventListener('click', startGame);
stopBtn.addEventListener('click', () => stopGame(false));
downloadBtn.addEventListener('click', downloadAllPhotos);