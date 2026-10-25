'use strict';

const childProcess = require('child_process');
const EventEmitter = require('events');
const fs = require('fs');
const path = require('path');
const WebSocket = require('ws');

function ffmpegPath(input) {
  return input.ffmpegPath || 'ffmpeg';
}

function outputPath(directory, fileName) {
  return path.join(directory || '', fileName);
}

function validateCallback(callback) {
  if (typeof callback !== 'function') {
    throw new TypeError('A callback function is required.');
  }
}

function runFFmpeg(executable, args, callback) {
  let child;
  let stderr = '';
  let completed = false;

  const finish = (error) => {
    if (completed) {
      return;
    }
    completed = true;
    callback(error, stderr);
  };

  try {
    child = childProcess.spawn(executable, args, { stdio: ['ignore', 'ignore', 'pipe'] });
  } catch (error) {
    finish(error);
    return;
  }

  child.stderr.on('data', (chunk) => {
    stderr = (stderr + chunk.toString()).slice(-4096);
  });
  child.once('error', finish);
  child.once('close', (code, signal) => {
    if (code === 0) {
      finish(null);
      return;
    }

    const message = signal
      ? `FFmpeg was terminated by signal ${signal}.`
      : `FFmpeg exited with code ${code}.`;
    finish(new Error(stderr.trim() || message));
  });
}

function failureResponse(error, response) {
  return {
    status: 'Failed',
    response: response || '',
    error: error || ''
  };
}

class Stream extends EventEmitter {
  constructor(input) {
    super();
    if (!input || !input.url) {
      throw new TypeError('RTSP URL required.');
    }
    if (!Number.isInteger(input.wsPort) || input.wsPort < 0 || input.wsPort > 65535) {
      throw new TypeError('wsPort must be a valid port number.');
    }

    this.name = input.name || 'stream';
    this.wsCount = 0;
    this.startStream(input);
  }

  start(input) {
    this.startStream(input);
    return this;
  }

  setOptions(input) {
    const userOptions = input.options || {};
    const options = {
      '-rtsp_transport': 'tcp',
      '-i': input.url,
      '-pix_fmt': 'yuv420p',
      '-f': 'mpegts',
      '-codec:v': 'mpeg1video',
      '-codec:a': 'mp2',
      '-r': userOptions['-r'] || 30
    };
    const params = [];

    for (const [key, value] of Object.entries(options)) {
      params.push(key);
      if (String(value) !== '') {
        params.push(String(value));
      }
    }

    for (const [key, value] of Object.entries(userOptions)) {
      if (key !== '-r') {
        params.push(key);
        if (String(value) !== '') {
          params.push(String(value));
        }
      }
    }

    params.push('-');
    return params;
  }

  startStream(input) {
    this.stopping = false;
    this.processFailureHandled = false;
    this.wss = new WebSocket.Server({ port: input.wsPort });
    this.wss.once('listening', () => {
      this.emit('listening', this.wss.address());
    });
    this.wss.on('connection', (socket, request) => {
      this.wsCount = this.wss.clients.size;
      this.onSocketConnect(socket, request);
    });
    this.wss.on('error', (error) => this.emitError(error));
    this.wss.on('close', () => {
      this.emit('close');
    });

    try {
      this.child = childProcess.spawn(
        input.ffmpegPath || 'ffmpeg',
        this.setOptions(input),
        { stdio: ['ignore', 'pipe', 'pipe'] }
      );
    } catch (error) {
      this.handleProcessError(error);
      return;
    }

    this.child.stdout.on('data', (data) => {
      this.wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(data);
        }
      });
      this.emit('data', data);
    });
    this.child.stderr.on('data', (data) => {
      this.emit('stderr', data);
    });
    this.child.once('error', (error) => this.handleProcessError(error));
    this.child.once('close', (code, signal) => {
      this.exitCode = code;
      this.exitSignal = signal;
      if (code !== 0 && !this.stopping) {
        this.handleProcessError(new Error(
          signal ? `FFmpeg was terminated by signal ${signal}.` : `FFmpeg exited with code ${code}.`
        ));
      } else {
        this.closeWebSocketServer();
        this.emit('exit', code, signal);
      }
    });
  }

  handleProcessError(error) {
    if (this.processFailureHandled) {
      return;
    }
    this.processFailureHandled = true;
    this.exitCode = this.exitCode === undefined ? 1 : this.exitCode;
    this.closeWebSocketServer();
    this.emit('exitWithError', error);
    this.emitError(error);
  }

  emitError(error) {
    if (this.listenerCount('error') > 0) {
      this.emit('error', error);
    } else {
      console.error(`${this.name}: ${error.message}`);
    }
  }

  closeWebSocketServer() {
    if (this.wss && !this.webSocketServerClosed) {
      if (!this.wss.address()) {
        if (!this.webSocketClosePending) {
          this.webSocketClosePending = true;
          this.wss.once('listening', () => {
            this.webSocketClosePending = false;
            this.closeWebSocketServer();
          });
          this.wss.once('close', () => {
            this.webSocketServerClosed = true;
          });
        }
        return;
      }
      this.webSocketServerClosed = true;
      this.wss.clients.forEach((client) => client.terminate());
      this.wss.close();
    }
  }

  onSocketConnect(socket, request) {
    this.wsCount = this.wss.clients.size;
    socket.remoteAddress = request.socket.remoteAddress;
    this.emit('connection', socket, request);
    socket.once('close', () => {
      this.wsCount = this.wss.clients.size;
    });
  }

  stop() {
    return this.stopStream();
  }

  stopStream() {
    if (this.stopping) {
      return this;
    }
    this.stopping = true;
    if (this.child && this.child.exitCode === null && !this.child.killed) {
      this.child.kill();
    }
    this.closeWebSocketServer();
    return this;
  }
}

class RecordNSnap extends EventEmitter {
  recordVideo(input, callback) {
    validateCallback(callback);
    if (!input || !input.url) {
      callback(failureResponse('', 'Rtsp URL required'));
      return;
    }
    if (input.recordType && input.recordType.toLowerCase() === 'download' && !input.fileMimeType) {
      callback(failureResponse('', 'File Mime type(fileMimeType) is required for download URL.'));
      return;
    }

    const fileName = input.fileName || `record_${this.getCurrentDatewithTime()}.mp4`;
    const file = outputPath(input.filePath, fileName);
    const args = [
      '-rtsp_transport', 'tcp',
      '-i', input.url,
      '-t', String(input.second || 5),
      file
    ];

    runFFmpeg(ffmpegPath(input), args, (error) => {
      if (error) {
        callback(failureResponse(error));
        return;
      }

      if (input.recordType && input.recordType.toLowerCase() === 'download') {
        fs.readFile(file, (readError, contents) => {
          if (readError) {
            callback(failureResponse(readError));
            return;
          }
          fs.unlink(file, (unlinkError) => {
            if (unlinkError) {
              callback(failureResponse(unlinkError));
              return;
            }
            callback({
              status: 'Success',
              response: `data:${input.fileMimeType};base64,${contents.toString('base64')}`,
              error: ''
            });
          });
        });
        return;
      }

      callback({
        status: 'Success',
        response: `Recorded file stored into the given path [ ${file} ]`,
        error: ''
      });
    });
  }

  takeSnap(input, callback) {
    validateCallback(callback);
    if (!input || !input.url) {
      callback(failureResponse('', 'Rtsp URL required'));
      return;
    }
    if (input.snapType && input.snapType.toLowerCase() === 'download' && !input.imageMimeType) {
      callback(failureResponse('', 'Image Mime type(imageMimeType) is required for download URL.'));
      return;
    }

    const fileName = input.imageName || `snapshot_${this.getCurrentDatewithTime()}.jpg`;
    const file = outputPath(input.imagePath, fileName);
    const args = [
      '-rtsp_transport', 'tcp',
      '-ss', '2',
      '-i', input.url,
      '-y',
      '-f', 'image2',
      '-qscale', '0',
      '-frames', '1',
      file
    ];

    runFFmpeg(ffmpegPath(input), args, (error) => {
      if (error) {
        callback(failureResponse(error));
        return;
      }

      if (input.snapType && input.snapType.toLowerCase() === 'download') {
        fs.readFile(file, (readError, contents) => {
          if (readError) {
            callback(failureResponse(readError, 'File creation failed. Please try again...'));
            return;
          }
          fs.unlink(file, (unlinkError) => {
            if (unlinkError) {
              callback(failureResponse(unlinkError));
              return;
            }
            callback({
              status: 'Success',
              base64: `data:${input.imageMimeType};base64,${contents.toString('base64')}`,
              filename: fileName,
              imagetype: input.imageMimeType,
              message: ''
            });
          });
        });
        return;
      }

      callback({
        status: 'Success',
        response: `Snapshot image stored into the given path [ ${file} ]`,
        error: ''
      });
    });
  }

  getCurrentDatewithTime() {
    const date = new Date();
    const pad = (value) => String(value).padStart(2, '0');
    return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}` +
      `${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
  }
}

module.exports = {
  Stream,
  RecordNSnap
};
