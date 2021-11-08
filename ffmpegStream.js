
const WebSocket = require('ws');
var EventEmitter = require('events');     
const child_process = require('child_process')


class Stream extends EventEmitter {
	
  constructor(input) {
    super();	
      this.start(input);
    
  }
  start(input) {
    this.startStream(input);
  }
  setOptions(input) {
	  console.log(input)	 
    const options = {
      "-rtsp_transport": "tcp",
      "-i": input.url,
      "-f": "mpegts",
      "-codec:v": "mpeg1video",
      "-codec:a": "mp2",           
      "-r": input.options["-r"]?input.options["-r"]:30,
    };
    let params = [];
    for (let key in options) {
      params.push(key);
      if (String(options[key]) !== "") {
        params.push(String(options[key]));
      }
    }
	this.additionalFlags = []
  if (input.options) {
    for (let key in input.options) {
		if(key !== '-r'){
      this.additionalFlags.push(key)
      if (String(input.options[key]) !== '' ) {
        this.additionalFlags.push(String(input.options[key]))
      }
	  }
    }
  }
  params.push(...this.additionalFlags);
  console.log(params);
    params.push("-");
    return params;
  }
  startStream(input) {
    this.wss = new WebSocket.Server({ port: input.wsPort });
    this.child = child_process.spawn("ffmpeg", this.setOptions(input));	
	 console.log(this.child);
    this.child.stdout.on("data", (data) => {
      this.wss.clients.forEach((client) => {
        client.send(data);
      });
      return this.emit("data", data);
    });
  }
  stopStream= function()
  {	 
	  this.wss.close();  
	  this.child.kill();
	  return this;
  }
}

module.exports ={
	Stream:Stream
}