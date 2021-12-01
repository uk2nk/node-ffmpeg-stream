# node-ffmpeg-stream
To convert rtsp stream to websocket stream for multi view purpose
1. RTSP Stream to Websocket
2. RTSP Stream to Recording(Download & Storing into the file location)
3. RTSP Stream to Screenshot(Take picture from Stream) 
### Usage:

```
$ npm i node-ffmpeg-stream
```
## 1. RTSP Stream to Websocket

### On server
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
#### To stop running stream 

This method should be called when you have `0 socket connection` or to disconnect to all the viewers(sockets).
```
stream.stop();	
```
##### Socket Connection Image
![CMD Running Snapshot](/assets/screenshot/stream.running.PNG)



### On Client
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

## 2. RTSP Stream to Recording(Download & Storing into the file location)
### On server
```
RecordNSnap = require('node-ffmpeg-stream').RecordNSnap;  

var input ={
    "url": "rtsp://wowzaec2demo.streamlock.net/vod/mp4:BigBuckBunny_115k.mp4",
    "second": "60",                 // by default 5 sec
    "filePath": "D:\\Records\\",    // by default ""
    "fileName": "test5.mp4",        // your output filename with extension like mp4,avi & et.,
    "fileMimeType":"video/mp4",     // Mime type for download file via javascript & advanced javascript
    "recordType":"download"         // can be download or store
}
objRecordNSnap=new RecordNSnap();
 objRecordNSnap.recordVideo(input,function(resp){	
	res.send(resp);
 })
  
   
```
### File download output
```
input = {
    "url": "rtsp://wowzaec2demo.streamlock.net/vod/mp4:BigBuckBunny_115k.mp4",
    "second": "1",
    "filePath": "F:\\",
    "fileName": "test5.mp4",
    "fileMimeType":"video/mp4",
    "recordType":"download"
}

```

![CMD File Download Output](/assets/screenshot/record.download.PNG)

### File store output
```
input = {
    "url": "rtsp://wowzaec2demo.streamlock.net/vod/mp4:BigBuckBunny_115k.mp4",
    "second": "1",
    "filePath": "F:\\",
    "fileName": "test5.mp4",
    "fileMimeType":"video/mp4",
    "recordType":"store"
}

```
![CMD File Store Output](/assets/screenshot/record.store.PNG)


## Dependencies

1. [FFMPEG.exe](https://ffmpeg.org/download.html) - exe file should be in same place of js file
2. [jsmpeg.min.js](https://cdnjs.com/libraries/jsmpeg)
