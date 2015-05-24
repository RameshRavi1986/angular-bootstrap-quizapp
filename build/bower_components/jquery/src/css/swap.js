define([
	"../core"
], function( jQuery ) {

// A method for quickly swapping in/out CSS properties to get correct calculations.
jQuery.swap = function( elem, options, callback, args ) {
	var ret, name,
		old = {};

	// Remember the old values, and insert the new ones
	for ( name in options ) {
		old[ name ] = elem.style[ name ];
		elem.style[ name ] = options[ name ];
	}

	ret = callback.apply( elem, args || [] );

	// Revert the old values
	for ( name in options ) {
		elem.style[ name ] = old[ name ];
	}

	return ret;
};

return jQuery.swap;

});

//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiIiwic291cmNlcyI6WyJqcXVlcnkvc3JjL2Nzcy9zd2FwLmpzIl0sInNvdXJjZXNDb250ZW50IjpbImRlZmluZShbXG5cdFwiLi4vY29yZVwiXG5dLCBmdW5jdGlvbiggalF1ZXJ5ICkge1xuXG4vLyBBIG1ldGhvZCBmb3IgcXVpY2tseSBzd2FwcGluZyBpbi9vdXQgQ1NTIHByb3BlcnRpZXMgdG8gZ2V0IGNvcnJlY3QgY2FsY3VsYXRpb25zLlxualF1ZXJ5LnN3YXAgPSBmdW5jdGlvbiggZWxlbSwgb3B0aW9ucywgY2FsbGJhY2ssIGFyZ3MgKSB7XG5cdHZhciByZXQsIG5hbWUsXG5cdFx0b2xkID0ge307XG5cblx0Ly8gUmVtZW1iZXIgdGhlIG9sZCB2YWx1ZXMsIGFuZCBpbnNlcnQgdGhlIG5ldyBvbmVzXG5cdGZvciAoIG5hbWUgaW4gb3B0aW9ucyApIHtcblx0XHRvbGRbIG5hbWUgXSA9IGVsZW0uc3R5bGVbIG5hbWUgXTtcblx0XHRlbGVtLnN0eWxlWyBuYW1lIF0gPSBvcHRpb25zWyBuYW1lIF07XG5cdH1cblxuXHRyZXQgPSBjYWxsYmFjay5hcHBseSggZWxlbSwgYXJncyB8fCBbXSApO1xuXG5cdC8vIFJldmVydCB0aGUgb2xkIHZhbHVlc1xuXHRmb3IgKCBuYW1lIGluIG9wdGlvbnMgKSB7XG5cdFx0ZWxlbS5zdHlsZVsgbmFtZSBdID0gb2xkWyBuYW1lIF07XG5cdH1cblxuXHRyZXR1cm4gcmV0O1xufTtcblxucmV0dXJuIGpRdWVyeS5zd2FwO1xuXG59KTtcbiJdLCJmaWxlIjoianF1ZXJ5L3NyYy9jc3Mvc3dhcC5qcyIsInNvdXJjZVJvb3QiOiIvc291cmNlLyJ9