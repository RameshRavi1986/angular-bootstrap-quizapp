define([
	"./core"
], function( jQuery ) {

/*
 * Optional (non-Sizzle) selector module for custom builds.
 *
 * Note that this DOES NOT SUPPORT many documented jQuery
 * features in exchange for its smaller size:
 *
 * Attribute not equal selector
 * Positional selectors (:first; :eq(n); :odd; etc.)
 * Type selectors (:input; :checkbox; :button; etc.)
 * State-based selectors (:animated; :visible; :hidden; etc.)
 * :has(selector)
 * :not(complex selector)
 * custom selectors via Sizzle extensions
 * Leading combinators (e.g., $collection.find("> *"))
 * Reliable functionality on XML fragments
 * Requiring all parts of a selector to match elements under context
 *   (e.g., $div.find("div > *") now matches children of $div)
 * Matching against non-elements
 * Reliable sorting of disconnected nodes
 * querySelectorAll bug fixes (e.g., unreliable :focus on WebKit)
 *
 * If any of these are unacceptable tradeoffs, either use Sizzle or
 * customize this stub for the project's specific needs.
 */

var docElem = window.document.documentElement,
	selector_hasDuplicate,
	matches = docElem.matches ||
		docElem.webkitMatchesSelector ||
		docElem.mozMatchesSelector ||
		docElem.oMatchesSelector ||
		docElem.msMatchesSelector,
	selector_sortOrder = function( a, b ) {
		// Flag for duplicate removal
		if ( a === b ) {
			selector_hasDuplicate = true;
			return 0;
		}

		var compare = b.compareDocumentPosition && a.compareDocumentPosition && a.compareDocumentPosition( b );

		if ( compare ) {
			// Disconnected nodes
			if ( compare & 1 ) {

				// Choose the first element that is related to our document
				if ( a === document || jQuery.contains(document, a) ) {
					return -1;
				}
				if ( b === document || jQuery.contains(document, b) ) {
					return 1;
				}

				// Maintain original order
				return 0;
			}

			return compare & 4 ? -1 : 1;
		}

		// Not directly comparable, sort on existence of method
		return a.compareDocumentPosition ? -1 : 1;
	};

jQuery.extend({
	find: function( selector, context, results, seed ) {
		var elem, nodeType,
			i = 0;

		results = results || [];
		context = context || document;

		// Same basic safeguard as Sizzle
		if ( !selector || typeof selector !== "string" ) {
			return results;
		}

		// Early return if context is not an element or document
		if ( (nodeType = context.nodeType) !== 1 && nodeType !== 9 ) {
			return [];
		}

		if ( seed ) {
			while ( (elem = seed[i++]) ) {
				if ( jQuery.find.matchesSelector(elem, selector) ) {
					results.push( elem );
				}
			}
		} else {
			jQuery.merge( results, context.querySelectorAll(selector) );
		}

		return results;
	},
	unique: function( results ) {
		var elem,
			duplicates = [],
			i = 0,
			j = 0;

		selector_hasDuplicate = false;
		results.sort( selector_sortOrder );

		if ( selector_hasDuplicate ) {
			while ( (elem = results[i++]) ) {
				if ( elem === results[ i ] ) {
					j = duplicates.push( i );
				}
			}
			while ( j-- ) {
				results.splice( duplicates[ j ], 1 );
			}
		}

		return results;
	},
	text: function( elem ) {
		var node,
			ret = "",
			i = 0,
			nodeType = elem.nodeType;

		if ( !nodeType ) {
			// If no nodeType, this is expected to be an array
			while ( (node = elem[i++]) ) {
				// Do not traverse comment nodes
				ret += jQuery.text( node );
			}
		} else if ( nodeType === 1 || nodeType === 9 || nodeType === 11 ) {
			// Use textContent for elements
			return elem.textContent;
		} else if ( nodeType === 3 || nodeType === 4 ) {
			return elem.nodeValue;
		}
		// Do not include comment or processing instruction nodes

		return ret;
	},
	contains: function( a, b ) {
		var adown = a.nodeType === 9 ? a.documentElement : a,
			bup = b && b.parentNode;
		return a === bup || !!( bup && bup.nodeType === 1 && adown.contains(bup) );
	},
	isXMLDoc: function( elem ) {
		return (elem.ownerDocument || elem).documentElement.nodeName !== "HTML";
	},
	expr: {
		attrHandle: {},
		match: {
			bool: /^(?:checked|selected|async|autofocus|autoplay|controls|defer|disabled|hidden|ismap|loop|multiple|open|readonly|required|scoped)$/i,
			needsContext: /^[\x20\t\r\n\f]*[>+~]/
		}
	}
});

jQuery.extend( jQuery.find, {
	matches: function( expr, elements ) {
		return jQuery.find( expr, null, null, elements );
	},
	matchesSelector: function( elem, expr ) {
		return matches.call( elem, expr );
	},
	attr: function( elem, name ) {
		return elem.getAttribute( name );
	}
});

});

//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiIiwic291cmNlcyI6WyJqcXVlcnkvc3JjL3NlbGVjdG9yLW5hdGl2ZS5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJkZWZpbmUoW1xuXHRcIi4vY29yZVwiXG5dLCBmdW5jdGlvbiggalF1ZXJ5ICkge1xuXG4vKlxuICogT3B0aW9uYWwgKG5vbi1TaXp6bGUpIHNlbGVjdG9yIG1vZHVsZSBmb3IgY3VzdG9tIGJ1aWxkcy5cbiAqXG4gKiBOb3RlIHRoYXQgdGhpcyBET0VTIE5PVCBTVVBQT1JUIG1hbnkgZG9jdW1lbnRlZCBqUXVlcnlcbiAqIGZlYXR1cmVzIGluIGV4Y2hhbmdlIGZvciBpdHMgc21hbGxlciBzaXplOlxuICpcbiAqIEF0dHJpYnV0ZSBub3QgZXF1YWwgc2VsZWN0b3JcbiAqIFBvc2l0aW9uYWwgc2VsZWN0b3JzICg6Zmlyc3Q7IDplcShuKTsgOm9kZDsgZXRjLilcbiAqIFR5cGUgc2VsZWN0b3JzICg6aW5wdXQ7IDpjaGVja2JveDsgOmJ1dHRvbjsgZXRjLilcbiAqIFN0YXRlLWJhc2VkIHNlbGVjdG9ycyAoOmFuaW1hdGVkOyA6dmlzaWJsZTsgOmhpZGRlbjsgZXRjLilcbiAqIDpoYXMoc2VsZWN0b3IpXG4gKiA6bm90KGNvbXBsZXggc2VsZWN0b3IpXG4gKiBjdXN0b20gc2VsZWN0b3JzIHZpYSBTaXp6bGUgZXh0ZW5zaW9uc1xuICogTGVhZGluZyBjb21iaW5hdG9ycyAoZS5nLiwgJGNvbGxlY3Rpb24uZmluZChcIj4gKlwiKSlcbiAqIFJlbGlhYmxlIGZ1bmN0aW9uYWxpdHkgb24gWE1MIGZyYWdtZW50c1xuICogUmVxdWlyaW5nIGFsbCBwYXJ0cyBvZiBhIHNlbGVjdG9yIHRvIG1hdGNoIGVsZW1lbnRzIHVuZGVyIGNvbnRleHRcbiAqICAgKGUuZy4sICRkaXYuZmluZChcImRpdiA+ICpcIikgbm93IG1hdGNoZXMgY2hpbGRyZW4gb2YgJGRpdilcbiAqIE1hdGNoaW5nIGFnYWluc3Qgbm9uLWVsZW1lbnRzXG4gKiBSZWxpYWJsZSBzb3J0aW5nIG9mIGRpc2Nvbm5lY3RlZCBub2Rlc1xuICogcXVlcnlTZWxlY3RvckFsbCBidWcgZml4ZXMgKGUuZy4sIHVucmVsaWFibGUgOmZvY3VzIG9uIFdlYktpdClcbiAqXG4gKiBJZiBhbnkgb2YgdGhlc2UgYXJlIHVuYWNjZXB0YWJsZSB0cmFkZW9mZnMsIGVpdGhlciB1c2UgU2l6emxlIG9yXG4gKiBjdXN0b21pemUgdGhpcyBzdHViIGZvciB0aGUgcHJvamVjdCdzIHNwZWNpZmljIG5lZWRzLlxuICovXG5cbnZhciBkb2NFbGVtID0gd2luZG93LmRvY3VtZW50LmRvY3VtZW50RWxlbWVudCxcblx0c2VsZWN0b3JfaGFzRHVwbGljYXRlLFxuXHRtYXRjaGVzID0gZG9jRWxlbS5tYXRjaGVzIHx8XG5cdFx0ZG9jRWxlbS53ZWJraXRNYXRjaGVzU2VsZWN0b3IgfHxcblx0XHRkb2NFbGVtLm1vek1hdGNoZXNTZWxlY3RvciB8fFxuXHRcdGRvY0VsZW0ub01hdGNoZXNTZWxlY3RvciB8fFxuXHRcdGRvY0VsZW0ubXNNYXRjaGVzU2VsZWN0b3IsXG5cdHNlbGVjdG9yX3NvcnRPcmRlciA9IGZ1bmN0aW9uKCBhLCBiICkge1xuXHRcdC8vIEZsYWcgZm9yIGR1cGxpY2F0ZSByZW1vdmFsXG5cdFx0aWYgKCBhID09PSBiICkge1xuXHRcdFx0c2VsZWN0b3JfaGFzRHVwbGljYXRlID0gdHJ1ZTtcblx0XHRcdHJldHVybiAwO1xuXHRcdH1cblxuXHRcdHZhciBjb21wYXJlID0gYi5jb21wYXJlRG9jdW1lbnRQb3NpdGlvbiAmJiBhLmNvbXBhcmVEb2N1bWVudFBvc2l0aW9uICYmIGEuY29tcGFyZURvY3VtZW50UG9zaXRpb24oIGIgKTtcblxuXHRcdGlmICggY29tcGFyZSApIHtcblx0XHRcdC8vIERpc2Nvbm5lY3RlZCBub2Rlc1xuXHRcdFx0aWYgKCBjb21wYXJlICYgMSApIHtcblxuXHRcdFx0XHQvLyBDaG9vc2UgdGhlIGZpcnN0IGVsZW1lbnQgdGhhdCBpcyByZWxhdGVkIHRvIG91ciBkb2N1bWVudFxuXHRcdFx0XHRpZiAoIGEgPT09IGRvY3VtZW50IHx8IGpRdWVyeS5jb250YWlucyhkb2N1bWVudCwgYSkgKSB7XG5cdFx0XHRcdFx0cmV0dXJuIC0xO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGlmICggYiA9PT0gZG9jdW1lbnQgfHwgalF1ZXJ5LmNvbnRhaW5zKGRvY3VtZW50LCBiKSApIHtcblx0XHRcdFx0XHRyZXR1cm4gMTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdC8vIE1haW50YWluIG9yaWdpbmFsIG9yZGVyXG5cdFx0XHRcdHJldHVybiAwO1xuXHRcdFx0fVxuXG5cdFx0XHRyZXR1cm4gY29tcGFyZSAmIDQgPyAtMSA6IDE7XG5cdFx0fVxuXG5cdFx0Ly8gTm90IGRpcmVjdGx5IGNvbXBhcmFibGUsIHNvcnQgb24gZXhpc3RlbmNlIG9mIG1ldGhvZFxuXHRcdHJldHVybiBhLmNvbXBhcmVEb2N1bWVudFBvc2l0aW9uID8gLTEgOiAxO1xuXHR9O1xuXG5qUXVlcnkuZXh0ZW5kKHtcblx0ZmluZDogZnVuY3Rpb24oIHNlbGVjdG9yLCBjb250ZXh0LCByZXN1bHRzLCBzZWVkICkge1xuXHRcdHZhciBlbGVtLCBub2RlVHlwZSxcblx0XHRcdGkgPSAwO1xuXG5cdFx0cmVzdWx0cyA9IHJlc3VsdHMgfHwgW107XG5cdFx0Y29udGV4dCA9IGNvbnRleHQgfHwgZG9jdW1lbnQ7XG5cblx0XHQvLyBTYW1lIGJhc2ljIHNhZmVndWFyZCBhcyBTaXp6bGVcblx0XHRpZiAoICFzZWxlY3RvciB8fCB0eXBlb2Ygc2VsZWN0b3IgIT09IFwic3RyaW5nXCIgKSB7XG5cdFx0XHRyZXR1cm4gcmVzdWx0cztcblx0XHR9XG5cblx0XHQvLyBFYXJseSByZXR1cm4gaWYgY29udGV4dCBpcyBub3QgYW4gZWxlbWVudCBvciBkb2N1bWVudFxuXHRcdGlmICggKG5vZGVUeXBlID0gY29udGV4dC5ub2RlVHlwZSkgIT09IDEgJiYgbm9kZVR5cGUgIT09IDkgKSB7XG5cdFx0XHRyZXR1cm4gW107XG5cdFx0fVxuXG5cdFx0aWYgKCBzZWVkICkge1xuXHRcdFx0d2hpbGUgKCAoZWxlbSA9IHNlZWRbaSsrXSkgKSB7XG5cdFx0XHRcdGlmICggalF1ZXJ5LmZpbmQubWF0Y2hlc1NlbGVjdG9yKGVsZW0sIHNlbGVjdG9yKSApIHtcblx0XHRcdFx0XHRyZXN1bHRzLnB1c2goIGVsZW0gKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH0gZWxzZSB7XG5cdFx0XHRqUXVlcnkubWVyZ2UoIHJlc3VsdHMsIGNvbnRleHQucXVlcnlTZWxlY3RvckFsbChzZWxlY3RvcikgKTtcblx0XHR9XG5cblx0XHRyZXR1cm4gcmVzdWx0cztcblx0fSxcblx0dW5pcXVlOiBmdW5jdGlvbiggcmVzdWx0cyApIHtcblx0XHR2YXIgZWxlbSxcblx0XHRcdGR1cGxpY2F0ZXMgPSBbXSxcblx0XHRcdGkgPSAwLFxuXHRcdFx0aiA9IDA7XG5cblx0XHRzZWxlY3Rvcl9oYXNEdXBsaWNhdGUgPSBmYWxzZTtcblx0XHRyZXN1bHRzLnNvcnQoIHNlbGVjdG9yX3NvcnRPcmRlciApO1xuXG5cdFx0aWYgKCBzZWxlY3Rvcl9oYXNEdXBsaWNhdGUgKSB7XG5cdFx0XHR3aGlsZSAoIChlbGVtID0gcmVzdWx0c1tpKytdKSApIHtcblx0XHRcdFx0aWYgKCBlbGVtID09PSByZXN1bHRzWyBpIF0gKSB7XG5cdFx0XHRcdFx0aiA9IGR1cGxpY2F0ZXMucHVzaCggaSApO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0XHR3aGlsZSAoIGotLSApIHtcblx0XHRcdFx0cmVzdWx0cy5zcGxpY2UoIGR1cGxpY2F0ZXNbIGogXSwgMSApO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdHJldHVybiByZXN1bHRzO1xuXHR9LFxuXHR0ZXh0OiBmdW5jdGlvbiggZWxlbSApIHtcblx0XHR2YXIgbm9kZSxcblx0XHRcdHJldCA9IFwiXCIsXG5cdFx0XHRpID0gMCxcblx0XHRcdG5vZGVUeXBlID0gZWxlbS5ub2RlVHlwZTtcblxuXHRcdGlmICggIW5vZGVUeXBlICkge1xuXHRcdFx0Ly8gSWYgbm8gbm9kZVR5cGUsIHRoaXMgaXMgZXhwZWN0ZWQgdG8gYmUgYW4gYXJyYXlcblx0XHRcdHdoaWxlICggKG5vZGUgPSBlbGVtW2krK10pICkge1xuXHRcdFx0XHQvLyBEbyBub3QgdHJhdmVyc2UgY29tbWVudCBub2Rlc1xuXHRcdFx0XHRyZXQgKz0galF1ZXJ5LnRleHQoIG5vZGUgKTtcblx0XHRcdH1cblx0XHR9IGVsc2UgaWYgKCBub2RlVHlwZSA9PT0gMSB8fCBub2RlVHlwZSA9PT0gOSB8fCBub2RlVHlwZSA9PT0gMTEgKSB7XG5cdFx0XHQvLyBVc2UgdGV4dENvbnRlbnQgZm9yIGVsZW1lbnRzXG5cdFx0XHRyZXR1cm4gZWxlbS50ZXh0Q29udGVudDtcblx0XHR9IGVsc2UgaWYgKCBub2RlVHlwZSA9PT0gMyB8fCBub2RlVHlwZSA9PT0gNCApIHtcblx0XHRcdHJldHVybiBlbGVtLm5vZGVWYWx1ZTtcblx0XHR9XG5cdFx0Ly8gRG8gbm90IGluY2x1ZGUgY29tbWVudCBvciBwcm9jZXNzaW5nIGluc3RydWN0aW9uIG5vZGVzXG5cblx0XHRyZXR1cm4gcmV0O1xuXHR9LFxuXHRjb250YWluczogZnVuY3Rpb24oIGEsIGIgKSB7XG5cdFx0dmFyIGFkb3duID0gYS5ub2RlVHlwZSA9PT0gOSA/IGEuZG9jdW1lbnRFbGVtZW50IDogYSxcblx0XHRcdGJ1cCA9IGIgJiYgYi5wYXJlbnROb2RlO1xuXHRcdHJldHVybiBhID09PSBidXAgfHwgISEoIGJ1cCAmJiBidXAubm9kZVR5cGUgPT09IDEgJiYgYWRvd24uY29udGFpbnMoYnVwKSApO1xuXHR9LFxuXHRpc1hNTERvYzogZnVuY3Rpb24oIGVsZW0gKSB7XG5cdFx0cmV0dXJuIChlbGVtLm93bmVyRG9jdW1lbnQgfHwgZWxlbSkuZG9jdW1lbnRFbGVtZW50Lm5vZGVOYW1lICE9PSBcIkhUTUxcIjtcblx0fSxcblx0ZXhwcjoge1xuXHRcdGF0dHJIYW5kbGU6IHt9LFxuXHRcdG1hdGNoOiB7XG5cdFx0XHRib29sOiAvXig/OmNoZWNrZWR8c2VsZWN0ZWR8YXN5bmN8YXV0b2ZvY3VzfGF1dG9wbGF5fGNvbnRyb2xzfGRlZmVyfGRpc2FibGVkfGhpZGRlbnxpc21hcHxsb29wfG11bHRpcGxlfG9wZW58cmVhZG9ubHl8cmVxdWlyZWR8c2NvcGVkKSQvaSxcblx0XHRcdG5lZWRzQ29udGV4dDogL15bXFx4MjBcXHRcXHJcXG5cXGZdKls+K35dL1xuXHRcdH1cblx0fVxufSk7XG5cbmpRdWVyeS5leHRlbmQoIGpRdWVyeS5maW5kLCB7XG5cdG1hdGNoZXM6IGZ1bmN0aW9uKCBleHByLCBlbGVtZW50cyApIHtcblx0XHRyZXR1cm4galF1ZXJ5LmZpbmQoIGV4cHIsIG51bGwsIG51bGwsIGVsZW1lbnRzICk7XG5cdH0sXG5cdG1hdGNoZXNTZWxlY3RvcjogZnVuY3Rpb24oIGVsZW0sIGV4cHIgKSB7XG5cdFx0cmV0dXJuIG1hdGNoZXMuY2FsbCggZWxlbSwgZXhwciApO1xuXHR9LFxuXHRhdHRyOiBmdW5jdGlvbiggZWxlbSwgbmFtZSApIHtcblx0XHRyZXR1cm4gZWxlbS5nZXRBdHRyaWJ1dGUoIG5hbWUgKTtcblx0fVxufSk7XG5cbn0pO1xuIl0sImZpbGUiOiJqcXVlcnkvc3JjL3NlbGVjdG9yLW5hdGl2ZS5qcyIsInNvdXJjZVJvb3QiOiIvc291cmNlLyJ9