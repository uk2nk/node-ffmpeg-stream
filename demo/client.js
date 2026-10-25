'use strict';

const form = document.getElementById('connection-form');
const urlInput = document.getElementById('websocket-url');
const connectButton = form.querySelector('button[type="submit"]');
const disconnectButton = document.getElementById('disconnect');
const status = document.getElementById('status');
const screen = document.getElementById('screen');
const canvas = document.getElementById('video');
let player;

// state: idle | connecting | live | error (drives the CSS colors and LIVE badge)
function setStatus(message, state) {
  status.textContent = message;
  status.dataset.state = state;
  screen.dataset.state = state;
}

function setConnected(connected) {
  connectButton.disabled = connected;
  disconnectButton.disabled = !connected;
  urlInput.disabled = connected;
}

function disconnect(message, state = 'idle') {
  if (player) {
    player.destroy();
    player = undefined;
  }
  setConnected(false);
  setStatus(message, state);
}

form.addEventListener('submit', (event) => {
  event.preventDefault();
  disconnect('Connecting...', 'connecting');

  let websocketUrl;
  try {
    websocketUrl = new URL(urlInput.value);
  } catch {
    setStatus('Enter a valid WebSocket URL.', 'error');
    return;
  }

  if (websocketUrl.protocol !== 'ws:' && websocketUrl.protocol !== 'wss:') {
    setStatus('The URL must use ws:// or wss://.', 'error');
    return;
  }
  if (typeof JSMpeg === 'undefined') {
    setStatus('Could not load JSMpeg. Confirm demo\\jsmpeg.min.js exists and reload this page.', 'error');
    return;
  }

  setConnected(true);
  let gotFrame = false;
  player = new JSMpeg.Player(websocketUrl.toString(), {
    canvas,
    autoplay: true,
    audio: false,
    onSourceEstablished: () => {
      setStatus('Connected. Waiting for video...', 'connecting');
    },
    onVideoDecode: () => {
      if (!gotFrame) {
        gotFrame = true;
        setStatus('Streaming live.', 'live');
      }
    },
    onSourceCompleted: () => {
      disconnect('The stream ended.');
    }
  });
  setStatus('Connecting to stream...', 'connecting');
});

disconnectButton.addEventListener('click', () => {
  disconnect('Disconnected.');
});
