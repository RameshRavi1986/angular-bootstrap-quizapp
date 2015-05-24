/** Service to get the questions from count.io
	It uses spinnerservice to start and stop the spinner
**/
var QuizQuestionsService=function($http,$q,QuizModel,spinnerService){
	this.$http=$http;
	this.$q=$q;
	this.QuizModel=QuizModel;
	this.spinnerService=spinnerService;
	
};
// Method which updates the count.io with answers.
QuizQuestionsService.prototype.count=function(type,group){
	var service=this;
	this.$http.post("http://count.io/vb/"+group+"/"+type+"+")
		.success(function(data){
			service.QuizModel.nextQuestion();
			 service.spinnerService.stopSpinner();
	});
			 service.spinnerService.startSpinner();//S
};