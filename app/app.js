// Intializing Quiz app
var QuizApp=angular.module('QuizApp', ['ui.router','QuizApp.Register','QuizApp.TakeQuiz','QuizApp.results']);
// Ui router for routing to different stages
QuizApp.config(function($stateProvider, $urlRouterProvider) {
    
    $urlRouterProvider.otherwise('/home');
    
    $stateProvider
        .state('home', {
            url: '/home',
            templateUrl: 'templates/home.html'
        })
        .state('quizhome', {
				url: '/quizhome',
				templateUrl:'templates/quizhome.html'
        })
		.state('results', {
				url: '/results',
				templateUrl:'templates/results.html'
        })
		.state('Quiztimeout', {
				url: '/Quiztimeout',
				templateUrl:'templates/Quiztimeout.html'
        })
		
        
});

