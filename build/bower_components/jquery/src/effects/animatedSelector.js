define([
	"../core",
	"../selector",
	"../effects"
], function( jQuery ) {

jQuery.expr.filters.animated = function( elem ) {
	return jQuery.grep(jQuery.timers, function( fn ) {
		return elem === fn.elem;
	}).length;
};

});

//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiIiwic291cmNlcyI6WyJqcXVlcnkvc3JjL2VmZmVjdHMvYW5pbWF0ZWRTZWxlY3Rvci5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJkZWZpbmUoW1xuXHRcIi4uL2NvcmVcIixcblx0XCIuLi9zZWxlY3RvclwiLFxuXHRcIi4uL2VmZmVjdHNcIlxuXSwgZnVuY3Rpb24oIGpRdWVyeSApIHtcblxualF1ZXJ5LmV4cHIuZmlsdGVycy5hbmltYXRlZCA9IGZ1bmN0aW9uKCBlbGVtICkge1xuXHRyZXR1cm4galF1ZXJ5LmdyZXAoalF1ZXJ5LnRpbWVycywgZnVuY3Rpb24oIGZuICkge1xuXHRcdHJldHVybiBlbGVtID09PSBmbi5lbGVtO1xuXHR9KS5sZW5ndGg7XG59O1xuXG59KTtcbiJdLCJmaWxlIjoianF1ZXJ5L3NyYy9lZmZlY3RzL2FuaW1hdGVkU2VsZWN0b3IuanMiLCJzb3VyY2VSb290IjoiL3NvdXJjZS8ifQ==