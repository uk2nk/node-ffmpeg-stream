
const WebSocket = require('ws');
var EventEmitter = require('events');     
const child_process = require('child_process')
const { exec } = require("child_process");

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
	
	this.child.on('exit', (code, signal) => {
    if (code === 1) {
      console.error('RTSP stream exited with error');	  
      this.exitCode = 1
      return this.emit('exitWithError')
    }
  })
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
	this.wsCount=this.wss.clients.size;	  
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
class RecordNSnap extends EventEmitter {

recordVideo=function(input,callback)
{ 
  if(!input.url || input.url?.length==0)
  {
    return  callback({"status":"Failed","response":"Rtsp URL required","error":error}); 
  }
  input.filePath=input.filePath?.length>0?input.filePath:"";
  input.fileName=input.fileName?.length>0?input.fileName:"record_"+getCurrentDatewithTime();
  input.second=input.second?.length>0?input.second:"5";
  console.log("Recording started...");
  exec("ffmpeg -rtsp_transport tcp -i "+input.url+" -t "+input.second+" "+input.filePath+input.fileName , (error, stdout, stderr) => {
		
    if (error) {
      
      console.log(error);	
      console.log("Recording completed...");
    return  callback({"status":"Failed","response":"","error":error});       
    }
   else if (stderr) {
     if(input.recordType?.toLowerCase()=='download'){
      var fileContent = fs.readFileSync(input.filePath+input.fileName);
      var base64=Buffer.from(fileContent).toString('base64');
      console.log(stderr);	
      console.log("Recording completed...");      
      fs.unlink(input.filePath+input.fileName, function() {
				console.log(input.fileName +" is successfully unlinked.");
			});
      
      if(!input.fileMimeType || input.fileMimeType?.length==0)
      {
        return  callback({"status":"Failed","response":"File Mime type(fileMimeType) is required for download URL.","error":""}); 
      }
      return  callback({"status":"Success","response":"data:"+input.fileMimeType+";base64,"+base64,"error":""});       
    }
    else {
      console.log(stderr);	
      console.log("Recording completed...");      
      return  callback({"status":"Success","response":"Recorded file stored into the given path [ "+input.filePath+input.fileName+"]","error":""});       
    }    
			
    }
   else{
    console.log("Recording completed...");
    console.log(stdout);		
  return callback({"status":"Success","response":stdout,"error":""});  
   	
   }
   
		});
	
	}
	
  getCurrentDatewithTime=function ()
  {
    let date_ob = new Date();
  
  // current date
  // adjust 0 before single digit date
  let date = ("0" + date_ob.getDate()).slice(-2);
  
  // current month
  let month = ("0" + (date_ob.getMonth() + 1)).slice(-2);
  
  // current year
  let year = date_ob.getFullYear();
  
  // current hours
  let hours = date_ob.getHours();
  
  // current minutes
  let minutes = date_ob.getMinutes();
  
  // current seconds
  let seconds = date_ob.getSeconds();
  
  // prints date in YYYY-MM-DD format
  console.log(year + "-" + month + "-" + date);
  
  // prints date & time in YYYY-MM-DD HH:MM:SS format
  let val=year+month + date +hours+minutes+seconds
  console.log(val);
  return val;
  }
  

}
module.exports ={
	Stream:Stream,
  RecordNSnap:RecordNSnap
}