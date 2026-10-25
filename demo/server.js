'use strict';

const path = require('node:path');
const { Stream } = require('../');

const url = process.env.CAMERA_RTSP_URL;
if (!url) {
  console.error('Set CAMERA_RTSP_URL to an RTSP stream URL before starting the demo.');
  process.exitCode = 1;
} else {
  const stream = new Stream({
    name: 'demo-camera',
    url,
    wsPort: 7070,
    ffmpegPath: path.join(__dirname, 'ffmpeg.exe'),
    options: {
      '-r': 30
    }
  });

  stream.on('listening', () => {
    console.log('WebSocket stream is available at ws://localhost:7070');
  });
  stream.on('exitWithError', (error) => {
    console.error('FFmpeg stream failed:', error.message);
  });

  const stop = () => {
    stream.stop();
  };
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);
}
