var assert = require('assert');
 var fs = require("fs");
describe('video-stream', function() {
 
return it('should not throw an error when instantiated', function(done) {
 Stream = require('../').Stream;
  stream = new Stream({
  name: 'name',
  url: 'rtsp://wowzaec2demo.streamlock.net/vod/mp4:BigBuckBunny_115k.mp4',  
  wsPort: 7070,  
  options: { 
    '-stats': '', 
    '-r': 30
  }
});
return setTimeout(() => {
       stream.stopStream();	
        return done();
      }, 2500);


})
});

describe('record-stream',function(){
	return it('Stream recording should work.',function(done){
		RecordNSnap = require('../').RecordNSnap;  

var input ={
    "url": "rtsp://wowzaec2demo.streamlock.net/vod/mp4:BigBuckBunny_115k.mp4",
    "second": "3",                 
    "filePath": "F:\\",    
    "fileName": "test_1.mp4",        
    "fileMimeType":"video/mp4",     
    "recordType":"download"         
}
objRecordNSnap=new RecordNSnap();
 objRecordNSnap.recordVideo(input,function(resp){	
	return done();
 })
	});
	
	
});

describe("snapshot-from-stream",function(){
	return it('Stream Snapshot Should be in F: ',function(done){
		RecordNSnap = require('../').RecordNSnap;  

var input = {
    "url": "rtsp://wowzaec2demo.streamlock.net/vod/mp4:BigBuckBunny_115k.mp4",    
    "imagePath": "F:\\",              
    "imageName": "test_1.jpeg",        
    "imageMimeType":"image/jpeg",     
    "snapType":"store"             
}
objRecordNSnap=new RecordNSnap();
 objRecordNSnap.takeSnap(input,function(resp){	
	return done();
 })
	});
});