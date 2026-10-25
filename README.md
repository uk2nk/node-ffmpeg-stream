# node-ffmpeg-stream

`node-ffmpeg-stream` uses FFmpeg to:

- Convert an RTSP input into an MPEG-TS stream delivered over WebSocket.
- Record a time-limited clip to a file or return it as a Base64 data URL.
- Capture a still image to a file or return it as a Base64 data URL.

The library manages FFmpeg processes; it does not include FFmpeg or provide a
camera. Supply an RTSP source that your FFmpeg installation can access.

## Dependencies and requirements

`npm install node-ffmpeg-stream` installs the Node.js package and its npm
dependency, `ws` (the WebSocket server library), automatically. You do not need
to install `ws` separately.

You must provide these runtime requirements:

- Node.js 18 or newer.
- FFmpeg installed and available as `ffmpeg` on `PATH`, or an explicit
  `ffmpegPath` in the operation's options.
- Network access from the server to the RTSP camera or media source.

For browser playback of the WebSocket video, the demo uses a local JSMpeg
browser player file. Recording and snapshot operations do not require a browser
player.

### Install FFmpeg on Windows

FFmpeg is a separate program, not an npm dependency. Download a Windows build
from [ffmpeg.org](https://ffmpeg.org/download.html), extract it, and add the
folder containing `ffmpeg.exe` (usually `C:\ffmpeg\bin`) to your Windows
`Path`. Open a new terminal and verify it is available:

```powershell
ffmpeg -version
```

Alternatively, pass the full executable path as `ffmpegPath` in the stream or
recording/snapshot options, for example:
`C:\ffmpeg\bin\ffmpeg.exe`.

### JSMpeg browser player

The demo includes `demo/jsmpeg.min.js`, so playback does not depend on an
external CDN. The bundled JSMpeg player is MIT-licensed; see
[`demo/JSMPEG-LICENSE.txt`](./demo/JSMPEG-LICENSE.txt). If you replace the
player bundle, keep the applicable license notice.

Install the package:

```sh
npm install node-ffmpeg-stream
```

Download FFmpeg from [ffmpeg.org](https://ffmpeg.org/download.html) and check
that it is available:

```sh
ffmpeg -version
```

## RTSP to WebSocket

Create a stream in your Node.js server:

```js
const { Stream } = require('node-ffmpeg-stream');

const stream = new Stream({
  name: 'lobby-camera',
  url: process.env.CAMERA_RTSP_URL,
  wsPort: 7070,
  options: {
    '-r': 30,
    '-stats': ''
  }
});

stream.on('exitWithError', (error) => {
  console.error('Camera stream failed:', error.message);
});

// When your application no longer needs the stream:
stream.stop();
```

`wsPort` is the local TCP port used by the WebSocket server. Use `0` to let
the operating system choose an available port. `options` contains additional
FFmpeg flags; use an empty string for a flag that takes no value. The library
sets RTSP-over-TCP input and MPEG-TS/MPEG-1 video output options itself.

The existing `stopStream()` method remains available as an alias for `stop()`.
`Stream` emits `data` for FFmpeg output, `stderr` for FFmpeg diagnostic output,
`listening` with the bound WebSocket address once the server is ready, `exit`
when FFmpeg exits, and `exitWithError` if it cannot start or exits unsuccessfully.

The WebSocket endpoint sends MPEG-TS data suitable for a compatible client such
as JSMpeg. A minimal browser example:

```html
<canvas id="stream"></canvas>
<script src="/jsmpeg.min.js"></script>
<script>
  const player = new JSMpeg.Player('ws://localhost:7070', {
    canvas: document.getElementById('stream')
  });
</script>
```

Serve the client library from your application or another trusted source.
Do not expose an unauthenticated camera stream to an untrusted network; this
package does not implement WebSocket authentication or access control.

### Run the browser demo

The [`demo/`](./demo/) folder contains a minimal HTML/JavaScript client. To try
it:

1. Set `CAMERA_RTSP_URL` to an RTSP URL the server can access.
2. Put `ffmpeg.exe` in the `demo/` folder, or edit the `ffmpegPath` setting in
   the demo server to point to your FFmpeg executable.
3. Start the included demo server, which starts `Stream` on port `7070`:

   ```sh
   node demo/server.js
   ```

4. Serve the `demo/` folder using a local static-file server (for example,
   VS Code Live Server), then open its `index.html` page in a browser.
5. Leave the WebSocket URL as `ws://localhost:7070` when running locally, then
   select **Connect**.

To serve the page with Express instead of a separate static-file server, install
the development dependencies and start the included Express demo server:

```sh
npm install
node demo/express-server.js
```

The Express server also expects `ffmpeg.exe` in `demo/`. Open
`http://localhost:3000`; the WebSocket stream remains on port `7070`.

If your application uses HTTPS, use a secure WebSocket URL (`wss://`) and
configure your server or reverse proxy to provide TLS; browsers generally
block insecure `ws://` connections from HTTPS pages.

## Record a clip

`recordVideo(input, callback)` uses the callback-based API from earlier
versions. The clip duration defaults to 5 seconds. A stored recording returns
a success response describing its path:

```js
const { RecordNSnap } = require('node-ffmpeg-stream');

const capture = new RecordNSnap();

capture.recordVideo({
  url: process.env.CAMERA_RTSP_URL,
  second: 30,
  filePath: './recordings',
  fileName: 'lobby.mp4',
  recordType: 'store'
}, (result) => {
  if (result.status !== 'Success') {
    console.error('Recording failed:', result.error || result.response);
    return;
  }
  console.log(result.response);
});
```

For a Base64 data URL instead of a stored file, use `recordType: 'download'`
and provide `fileMimeType`:

```js
capture.recordVideo({
  url: process.env.CAMERA_RTSP_URL,
  second: 10,
  fileName: 'clip.mp4',
  fileMimeType: 'video/mp4',
  recordType: 'download'
}, (result) => {
  if (result.status === 'Success') {
    // result.response is a data:video/mp4;base64,... URL
    res.send(result.response);
  } else {
    res.status(500).send(result.error || result.response);
  }
});
```

`filePath` defaults to the current working directory. The output extension
should match a container supported by your FFmpeg build. Download mode creates
a temporary output file and removes it after reading it.

## Capture a snapshot

Use `takeSnap(input, callback)` to save an image:

```js
capture.takeSnap({
  url: process.env.CAMERA_RTSP_URL,
  imagePath: './snapshots',
  imageName: 'lobby.jpg',
  snapType: 'store'
}, (result) => {
  if (result.status !== 'Success') {
    console.error('Snapshot failed:', result.error || result.response);
    return;
  }
  console.log(result.response);
});
```

For a data URL, use `snapType: 'download'` and provide `imageMimeType`
(for example, `image/jpeg`). The success response contains the data URL in
`base64`, the file name in `filename`, and the MIME type in `imagetype`.
Snapshots default to a two-second seek before capture. The output file name
defaults to a timestamped JPEG name.

## FFmpeg executable path

If FFmpeg is not on `PATH`, set `ffmpegPath` on a stream or operation:

```js
const stream = new Stream({
  name: 'lobby-camera',
  url: process.env.CAMERA_RTSP_URL,
  wsPort: 7070,
  ffmpegPath: 'C:\\tools\\ffmpeg\\bin\\ffmpeg.exe'
});
```

The same `ffmpegPath` option is supported by `recordVideo` and `takeSnap`.

## Running tests

The test suite uses Node's built-in test runner and mocks FFmpeg, so it does
not require a camera, network stream, or special output drive:

```sh
npm test
```

## Troubleshooting

- **FFmpeg not found:** run `ffmpeg -version` in the same environment as the
  Node.js process, or set `ffmpegPath`.
- **RTSP connection fails:** check the camera URL, credentials, network route,
  and that FFmpeg can reach the camera from the server.
- **Recording or snapshot fails:** check that the output folder exists and
  that the Node.js process can write to it. Check the returned `error` field
  for FFmpeg diagnostics.
- **No browser video:** confirm the client can connect to the configured
  WebSocket port and supports the MPEG-TS/MPEG-1 stream output.

Avoid logging RTSP URLs if they contain credentials.
