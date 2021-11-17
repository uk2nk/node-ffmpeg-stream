
const WebSocket = require('ws');
var EventEmitter = require('events');     
const child_process = require('child_process')


class Stream extends EventEmitter {
	
  constructor(input) {
    super();
	this.name=input.name;	
    this.start(input);
    this.wsCount=0;
  }
  start(input) {
    this.startStream(input);
  }
  setOptions(input) {	  	 
    const options = {		
      "-rtsp_transport": "tcp", 
	"-i": input.url,	
"-pix_fmt":"yuv420p",	
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

    params.push("-");
	console.log(params)
    return params;
  }
  startStream(input) {	
var inputData=[];
var gettingInputData,gettingOutputData;  

    this.wss = new WebSocket.Server({ port: input.wsPort }); 	
    this.child = child_process.spawn("ffmpeg", this.setOptions(input),{
    detached: false
  });
   console.log(this.name+ " Stream Started...");
    console.log("Waiting for socket connection(s)...");
    this.child.stdout.on("data", (data) => {	
	this.wss.clients.forEach((client) => {		 
        client.send(data);
      }); 
      return this.emit("data", data);
    });
	
	this.child.stderr.on("data", (data) => {	
		 data = data.toString();			 
		if (data.indexOf('Input #') !== -1) { 		
	   gettingInputData=true;	  
    }	
	if (data.indexOf('Output #') !== -1) {
      gettingInputData = false	 
      gettingOutputData = true
	  console.log(data);
    }
	 if(gettingInputData){	
  	 console.log(data);
	 this.wss.clients.forEach((client) => {	
		console.log("Inside Clients");	 
        client.send(data);
      }); 
      return this.emit("data", data);
	 }	
		
	});
 this.wss.on("connection", (socket, request) => {
    this.wsCount=this.wss.clients.size;
	this.onSocketConnect(socket,request);
  })	  
 this.wss.on("close", (socket, request) => {
    console.log(this.name+ " : Stream Stopped.");
  })
  
  }
  
  onSocketConnect = function(socket, request) {  
  
  console.log(this.name +` :: New socket connected [ Total connection(s) : ` + this.wsCount+"]" );    
  socket.remoteAddress = request.connection.remoteAddress
  return socket.on("close", (code, message) => {	 
    return console.log(this.name +` :: Socket disconnected [ Remaining connection(s) : ` + this.wss.clients.size+"]" );  
  })
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