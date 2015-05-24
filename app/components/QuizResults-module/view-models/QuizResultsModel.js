/** Model for showing the quiz results comparison page
	It uses QuizResultsModel to get the data.
**/
var QuizResultsModel=function($http,$q,QuizModel,spinnerService){
	this.model={};
	this.$http=$http;
	this.spinnerService=spinnerService;
	this.model.questions=QuizModel.model.questions;
	this.numberOfQuestions=this.model.questions.length;

}

//Method to get the submitted data from count.io
QuizResultsModel.prototype.getResults=function(){
	var service=this;
	var results=[];

	for(var i=0; i< this.numberOfQuestions;i++){
		// Service which uses node proxy to get data from count.io
		service.$http.get("/vb/"+this.model.questions[i].group)
			.success(function(data){		
				results.push(data);
				service.model.results=results;
				service.spinnerService.stopSpinner();
			});	

}
			this.spinnerService.startSpinner();	
}