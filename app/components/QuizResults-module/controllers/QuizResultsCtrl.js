/** Controller for showing the quiz results comparison page
	It uses QuizResultsModel to get the data.
**/
var QuizResultsCtrl=function(QuizResultsModel){
	this.model=QuizResultsModel.model;
	QuizResultsModel.getResults();
}