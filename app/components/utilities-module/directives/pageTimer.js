// Timer bar directive which is used to generate timer along with bar.
function pageTimer($interval, $filter,$location){

return{
	restrict:'A',
	scope:{
		totaltime:'=totaltime'
	},
	templateUrl:"templates/timer.html",
	link:function($scope, element,attributes){
		 $scope.pageTime=$scope.totaltime*60*1000;
		 $scope.width=200;
		 var promise;
		 var seconds=$scope.totaltime*60;
		 var loadBarTime=$scope.width/seconds;
		 $scope.startTimer=function(){

			 if($scope.pageTime > 0){
				
				$scope.pageTime=$scope.pageTime-1000;
				$scope.width=$scope.width-loadBarTime;
				
			
			  }
			  else{
					$interval.cancel(promise);
					$location.path("/Quiztimeout");
			  }

		 }
				promise=$interval($scope.startTimer, 1000);

	}
}

}