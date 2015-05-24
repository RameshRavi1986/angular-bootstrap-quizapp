// Service which is used by spinner directive

var spinnerService=function(){
	this.spinnerConfig={};
	this.spinnerConfig.class="myname";
	
};
// Method to start timer
spinnerService.prototype.startSpinner=function(){
	this.spinnerConfig.class="showSpinner";

};
// Method to stop timer
spinnerService.prototype.stopSpinner=function(){
	this.spinnerConfig.class="";

};