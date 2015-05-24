// Controller to get the model for quiz page.
var QuizCtrl=function(QuizModel,QuizQuestionsService){
	var service=this;
	this.service=QuizQuestionsService;
	this.QuizModel=QuizModel;
	this.model=QuizModel.model;
	// Method to get the questions and displays the question
	this.QuizModel.getQuestions().then(function(data){
		QuizModel.nextQuestion();
	});
	// Method to count the number of questions using QuizQuestionsService
	this.count=function(fruit,group){
		this.service.count(fruit,group);
	}
}