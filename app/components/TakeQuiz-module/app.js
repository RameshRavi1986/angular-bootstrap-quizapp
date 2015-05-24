angular.module('QuizApp.TakeQuiz',['Utilities'])
.service('QuizQuestionsService',QuizQuestionsService)
.service('QuizModel',QuizModel)
.controller('QuizCtrl',QuizCtrl);