// Load spinner plugin which uses spinner service to start and stop the timer

function loadSpinner(spinnerService){

return{
	restrict:'A',
	scope:{
		
	},
	template:'<div class="{{spinnerConfig.class}}"></div>',
	link:function($scope, element,attributes){
		$scope.spinnerConfig=spinnerService.spinnerConfig;

	}
}

}