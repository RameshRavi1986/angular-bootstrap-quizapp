/**
	Model for displaying the data 
	It uses QuizModel to get the email id on Quiz questions 
	page
**/
var QuizAppRegisterModel=function($location,QuizModel){
	this.emailId;
	this.errorMessage="";
	this.QuizModel=QuizModel;
	this.$location=$location;

};
// This method navigates to to start the quiz if the email id is entered.
QuizAppRegisterModel.prototype.navigate=function(){
		if(this.emailId!==undefined && this.emailId!==""){
			// This method sets the user details to quiz question id
			this.QuizModel.setUser(this.emailId);
			this.$location.path("/quizhome");
		}
		else{
			this.errorMessage="Please enter correct email id";
		}	
};