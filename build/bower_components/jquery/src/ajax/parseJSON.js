define([
	"../core"
], function( jQuery ) {

// Support: Android 2.3
// Workaround failure to string-cast null input
jQuery.parseJSON = function( data ) {
	return JSON.parse( data + "" );
};

return jQuery.parseJSON;

});

//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiIiwic291cmNlcyI6WyJqcXVlcnkvc3JjL2FqYXgvcGFyc2VKU09OLmpzIl0sInNvdXJjZXNDb250ZW50IjpbImRlZmluZShbXG5cdFwiLi4vY29yZVwiXG5dLCBmdW5jdGlvbiggalF1ZXJ5ICkge1xuXG4vLyBTdXBwb3J0OiBBbmRyb2lkIDIuM1xuLy8gV29ya2Fyb3VuZCBmYWlsdXJlIHRvIHN0cmluZy1jYXN0IG51bGwgaW5wdXRcbmpRdWVyeS5wYXJzZUpTT04gPSBmdW5jdGlvbiggZGF0YSApIHtcblx0cmV0dXJuIEpTT04ucGFyc2UoIGRhdGEgKyBcIlwiICk7XG59O1xuXG5yZXR1cm4galF1ZXJ5LnBhcnNlSlNPTjtcblxufSk7XG4iXSwiZmlsZSI6ImpxdWVyeS9zcmMvYWpheC9wYXJzZUpTT04uanMiLCJzb3VyY2VSb290IjoiL3NvdXJjZS8ifQ==