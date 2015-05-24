define([
	"../core"
], function( jQuery ) {

/**
 * Determines whether an object can have data
 */
jQuery.acceptData = function( owner ) {
	// Accepts only:
	//  - Node
	//    - Node.ELEMENT_NODE
	//    - Node.DOCUMENT_NODE
	//  - Object
	//    - Any
	/* jshint -W018 */
	return owner.nodeType === 1 || owner.nodeType === 9 || !( +owner.nodeType );
};

return jQuery.acceptData;
});

//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiIiwic291cmNlcyI6WyJqcXVlcnkvc3JjL2RhdGEvYWNjZXB0cy5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJkZWZpbmUoW1xuXHRcIi4uL2NvcmVcIlxuXSwgZnVuY3Rpb24oIGpRdWVyeSApIHtcblxuLyoqXG4gKiBEZXRlcm1pbmVzIHdoZXRoZXIgYW4gb2JqZWN0IGNhbiBoYXZlIGRhdGFcbiAqL1xualF1ZXJ5LmFjY2VwdERhdGEgPSBmdW5jdGlvbiggb3duZXIgKSB7XG5cdC8vIEFjY2VwdHMgb25seTpcblx0Ly8gIC0gTm9kZVxuXHQvLyAgICAtIE5vZGUuRUxFTUVOVF9OT0RFXG5cdC8vICAgIC0gTm9kZS5ET0NVTUVOVF9OT0RFXG5cdC8vICAtIE9iamVjdFxuXHQvLyAgICAtIEFueVxuXHQvKiBqc2hpbnQgLVcwMTggKi9cblx0cmV0dXJuIG93bmVyLm5vZGVUeXBlID09PSAxIHx8IG93bmVyLm5vZGVUeXBlID09PSA5IHx8ICEoICtvd25lci5ub2RlVHlwZSApO1xufTtcblxucmV0dXJuIGpRdWVyeS5hY2NlcHREYXRhO1xufSk7XG4iXSwiZmlsZSI6ImpxdWVyeS9zcmMvZGF0YS9hY2NlcHRzLmpzIiwic291cmNlUm9vdCI6Ii9zb3VyY2UvIn0=