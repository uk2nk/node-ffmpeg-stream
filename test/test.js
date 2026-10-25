'use strict';

const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { PassThrough } = require('node:stream');
const test = require('node:test');
const childProcess = require('node:child_process');

function fakeChild() {
  const child = new EventEmitter();
  child.stdout = new PassThrough();
  child.stderr = new PassThrough();
  child.exitCode = null;
  child.killed = false;
  child.kill = () => {
    child.killed = true;
    child.exitCode = 0;
    child.emit('close', 0, null);
    return true;
  };
  return child;
}

function mockSpawn(t, implementation) {
  const originalSpawn = childProcess.spawn;
  childProcess.spawn = implementation;
  t.after(() => {
    childProcess.spawn = originalSpawn;
  });
}

test('Stream defaults optional FFmpeg options and stops through both method names', async (t) => {
  let spawnedArgs;
  const child = fakeChild();
  mockSpawn(t, (executable, args) => {
    assert.equal(executable, 'ffmpeg');
    spawnedArgs = args;
    return child;
  });

  const { Stream } = require('../');
  const stream = new Stream({ url: 'rtsp://camera.example/live', wsPort: 0 });
  await new Promise((resolve) => stream.wss.once('listening', resolve));

  assert.equal(spawnedArgs[spawnedArgs.indexOf('-r') + 1], '30');
  assert.equal(stream.stop(), stream);
  await new Promise((resolve) => stream.wss.once('close', resolve));
  assert.equal(child.killed, true);
});

test('Stream accepts an explicit FFmpeg executable and additional options', (t) => {
  let executable;
  let spawnedArgs;
  const child = fakeChild();
  mockSpawn(t, (command, args) => {
    executable = command;
    spawnedArgs = args;
    return child;
  });

  const { Stream } = require('../');
  const stream = new Stream({
    url: 'rtsp://camera.example/live',
    wsPort: 0,
    ffmpegPath: 'C:\\tools\\ffmpeg.exe',
    options: { '-r': 25, '-stats': '' }
  });

  assert.equal(executable, 'C:\\tools\\ffmpeg.exe');
  assert.equal(spawnedArgs[spawnedArgs.indexOf('-r') + 1], '25');
  assert.ok(spawnedArgs.includes('-stats'));
  stream.stopStream();
});

test('recordVideo passes shell metacharacters as literal FFmpeg arguments', async (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'node-ffmpeg-stream-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  let spawnedArgs;
  let spawnOptions;

  mockSpawn(t, (executable, args, options) => {
    spawnedArgs = args;
    spawnOptions = options;
    const child = fakeChild();
    setImmediate(() => {
      fs.writeFileSync(args[args.length - 1], 'video bytes');
      child.stderr.write('FFmpeg progress output');
      child.emit('close', 0, null);
    });
    return child;
  });

  const { RecordNSnap } = require('../');
  const result = await new Promise((resolve) => {
    new RecordNSnap().recordVideo({
      url: 'rtsp://camera.example/live?token=a&echo=$(literal)',
      second: 3,
      filePath: directory,
      fileName: 'recording;$(literal)&name.mp4',
      fileMimeType: 'video/mp4',
      recordType: 'download'
    }, resolve);
  });

  assert.equal(spawnedArgs[spawnedArgs.indexOf('-i') + 1], 'rtsp://camera.example/live?token=a&echo=$(literal)');
  assert.equal(spawnedArgs[spawnedArgs.length - 1], path.join(directory, 'recording;$(literal)&name.mp4'));
  assert.notEqual(spawnOptions.shell, true);
  assert.equal(result.status, 'Success');
  assert.equal(result.response, 'data:video/mp4;base64,dmlkZW8gYnl0ZXM=');
  assert.equal(fs.existsSync(path.join(directory, 'recording;$(literal)&name.mp4')), false);
});

test('takeSnap passes shell metacharacters as literal FFmpeg arguments', async (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'node-ffmpeg-stream-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  let spawnedArgs;
  let spawnOptions;

  mockSpawn(t, (executable, args, options) => {
    spawnedArgs = args;
    spawnOptions = options;
    const child = fakeChild();
    setImmediate(() => {
      fs.writeFileSync(args[args.length - 1], 'image bytes');
      child.emit('close', 0, null);
    });
    return child;
  });

  const { RecordNSnap } = require('../');
  const result = await new Promise((resolve) => {
    new RecordNSnap().takeSnap({
      url: 'rtsp://camera.example/live',
      imagePath: directory,
      imageName: 'snapshot;$(literal)&name.jpg',
      imageMimeType: 'image/jpeg',
      snapType: 'download'
    }, resolve);
  });

  assert.equal(result.status, 'Success');
  assert.equal(result.filename, 'snapshot;$(literal)&name.jpg');
  assert.equal(result.base64, 'data:image/jpeg;base64,aW1hZ2UgYnl0ZXM=');
  assert.equal(spawnedArgs[spawnedArgs.length - 1], path.join(directory, 'snapshot;$(literal)&name.jpg'));
  assert.notEqual(spawnOptions.shell, true);
  assert.equal(fs.existsSync(path.join(directory, 'snapshot;$(literal)&name.jpg')), false);
});

test('recordVideo reports missing URL through its legacy callback response', async () => {
  const { RecordNSnap } = require('../');
  const result = await new Promise((resolve) => {
    new RecordNSnap().recordVideo({}, resolve);
  });

  assert.equal(result.status, 'Failed');
  assert.equal(result.response, 'Rtsp URL required');
});
