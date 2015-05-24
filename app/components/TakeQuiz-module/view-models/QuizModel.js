// Model to displays the model for quiz questions
var QuizModel=function($http,$q,$location){
	this.model={};
	this.questionsList="";
	this.$http=$http;
	this.$q=$q;
	this.counter=0;
	this.url="/data/questions-data.js";
	this.numberOfQuestions=0;
	this.$location=$location;
};

// Method which gets the questions from backend json
QuizModel.prototype.getQuestions=function(){
	var deferred=this.$q.defer();
	var service=this;
	this.$http.get(this.url)
		.success(function(data){
			deferred.resolve(service.transformResponse(data));
	});
	return deferred.promise;
}
// The email id is set from quizregistermodel
QuizModel.prototype.setUser=function(email){
	this.model.emailId=email;
};
// Method which transforms the response
QuizModel.prototype.transformResponse=function(data){
	this.model.questions=data.Questions;
	this.numberOfQuestions=data.Questions.length;
};

// Get the next question
QuizModel.prototype.nextQuestion=function(){
	if(this.numberOfQuestions > this.counter){
		this.model.question=this.model.questions[this.counter++];
		this.model.question.qNumber=this.counter;
	}
	else{
		this.$location.path("/results");
	}
};