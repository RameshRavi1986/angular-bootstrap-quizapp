// Config server file to start the server using node js
module.exports={
startServer:function(){
var express = require('express');
var request= require('request');
var app = express();
app.use("/",express.static("build"));
var http=require("http");
app.get('*vb*',function(req,res){
	console.log(" Redirect to count domain");
	var url=req.url;
	var countUrl=request("http://count.io"+url);
	console.log("http://count.io"+url);
	req.pipe(countUrl);
	countUrl.pipe(res);

});
http.createServer(app).listen(8000);

}

}