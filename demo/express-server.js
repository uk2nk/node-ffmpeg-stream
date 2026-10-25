'use strict';

const express = require('express');
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

  stream.on('exitWithError', (error) => {
    console.error('FFmpeg stream failed:', error.message);
  });

  const app = express();
  app.use(express.static(__dirname));

  const server = app.listen(3000, () => {
    console.log('Demo page: http://localhost:3000');
    console.log('WebSocket stream: ws://localhost:7070');
  });

  const shutdown = () => {
    stream.stop();
    server.close();
  };
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
}
