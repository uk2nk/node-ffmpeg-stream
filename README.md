# node-ffmpeg-stream
To convert rtsp stream to websocket stream for multi view purpose

### Usage:

```
$ npm i node-ffmpeg-stream
```

### On server:
```
Stream = require('node-ffmpeg-stream').Stream;
stream = new Stream({
  name: 'name',//name that can be used in future  
  url: 'rtsp://wowzaec2demo.streamlock.net/vod/mp4:BigBuckBunny_115k.mp4',  //Stream URL
  wsPort: 7070,  //Streaming will be transferred via this port
  options: { // ffmpeg options 
    '-stats': '', // print progress report during encoding, can be no value ''
    '-r': 30 // frame rate (Hz value, fraction or abbreviation) - By default it set to 30 if no value specified
  }
})
    
```

### On client:
```
<html>
<body>
	<canvas id="stream"></canvas>
</body>

<script type="text/javascript" src="jsmpeg.min.js"></script>
<script type="text/javascript">
	player = new JSMpeg.Player('ws://localhost:7070', {
	  canvas: document.getElementById('stream') // stream should be a canvas DOM element
	})	
</script>
</html>
```

## Dependencies

1. [FFMPEG.exe](https://ffmpeg.org/download.html) - exe file should be in same place of js file
2. [jsmpeg.min.js](https://cdnjs.com/libraries/jsmpeg)
