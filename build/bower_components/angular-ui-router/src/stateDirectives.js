function parseStateRef(ref, current) {
  var preparsed = ref.match(/^\s*({[^}]*})\s*$/), parsed;
  if (preparsed) ref = current + '(' + preparsed[1] + ')';
  parsed = ref.replace(/\n/g, " ").match(/^([^(]+?)\s*(\((.*)\))?$/);
  if (!parsed || parsed.length !== 4) throw new Error("Invalid state ref '" + ref + "'");
  return { state: parsed[1], paramExpr: parsed[3] || null };
}

function stateContext(el) {
  var stateData = el.parent().inheritedData('$uiView');

  if (stateData && stateData.state && stateData.state.name) {
    return stateData.state;
  }
}

/**
 * @ngdoc directive
 * @name ui.router.state.directive:ui-sref
 *
 * @requires ui.router.state.$state
 * @requires $timeout
 *
 * @restrict A
 *
 * @description
 * A directive that binds a link (`<a>` tag) to a state. If the state has an associated 
 * URL, the directive will automatically generate & update the `href` attribute via 
 * the {@link ui.router.state.$state#methods_href $state.href()} method. Clicking 
 * the link will trigger a state transition with optional parameters. 
 *
 * Also middle-clicking, right-clicking, and ctrl-clicking on the link will be 
 * handled natively by the browser.
 *
 * You can also use relative state paths within ui-sref, just like the relative 
 * paths passed to `$state.go()`. You just need to be aware that the path is relative
 * to the state that the link lives in, in other words the state that loaded the 
 * template containing the link.
 *
 * You can specify options to pass to {@link ui.router.state.$state#go $state.go()}
 * using the `ui-sref-opts` attribute. Options are restricted to `location`, `inherit`,
 * and `reload`.
 *
 * @example
 * Here's an example of how you'd use ui-sref and how it would compile. If you have the 
 * following template:
 * <pre>
 * <a ui-sref="home">Home</a> | <a ui-sref="about">About</a> | <a ui-sref="{page: 2}">Next page</a>
 * 
 * <ul>
 *     <li ng-repeat="contact in contacts">
 *         <a ui-sref="contacts.detail({ id: contact.id })">{{ contact.name }}</a>
 *     </li>
 * </ul>
 * </pre>
 * 
 * Then the compiled html would be (assuming Html5Mode is off and current state is contacts):
 * <pre>
 * <a href="#/home" ui-sref="home">Home</a> | <a href="#/about" ui-sref="about">About</a> | <a href="#/contacts?page=2" ui-sref="{page: 2}">Next page</a>
 * 
 * <ul>
 *     <li ng-repeat="contact in contacts">
 *         <a href="#/contacts/1" ui-sref="contacts.detail({ id: contact.id })">Joe</a>
 *     </li>
 *     <li ng-repeat="contact in contacts">
 *         <a href="#/contacts/2" ui-sref="contacts.detail({ id: contact.id })">Alice</a>
 *     </li>
 *     <li ng-repeat="contact in contacts">
 *         <a href="#/contacts/3" ui-sref="contacts.detail({ id: contact.id })">Bob</a>
 *     </li>
 * </ul>
 *
 * <a ui-sref="home" ui-sref-opts="{reload: true}">Home</a>
 * </pre>
 *
 * @param {string} ui-sref 'stateName' can be any valid absolute or relative state
 * @param {Object} ui-sref-opts options to pass to {@link ui.router.state.$state#go $state.go()}
 */
$StateRefDirective.$inject = ['$state', '$timeout'];
function $StateRefDirective($state, $timeout) {
  var allowedOptions = ['location', 'inherit', 'reload', 'absolute'];

  return {
    restrict: 'A',
    require: ['?^uiSrefActive', '?^uiSrefActiveEq'],
    link: function(scope, element, attrs, uiSrefActive) {
      var ref = parseStateRef(attrs.uiSref, $state.current.name);
      var params = null, url = null, base = stateContext(element) || $state.$current;
      // SVGAElement does not use the href attribute, but rather the 'xlinkHref' attribute.
      var hrefKind = Object.prototype.toString.call(element.prop('href')) === '[object SVGAnimatedString]' ?
                 'xlink:href' : 'href';
      var newHref = null, isAnchor = element.prop("tagName").toUpperCase() === "A";
      var isForm = element[0].nodeName === "FORM";
      var attr = isForm ? "action" : hrefKind, nav = true;

      var options = { relative: base, inherit: true };
      var optionsOverride = scope.$eval(attrs.uiSrefOpts) || {};

      angular.forEach(allowedOptions, function(option) {
        if (option in optionsOverride) {
          options[option] = optionsOverride[option];
        }
      });

      var update = function(newVal) {
        if (newVal) params = angular.copy(newVal);
        if (!nav) return;

        newHref = $state.href(ref.state, params, options);

        var activeDirective = uiSrefActive[1] || uiSrefActive[0];
        if (activeDirective) {
          activeDirective.$$addStateInfo(ref.state, params);
        }
        if (newHref === null) {
          nav = false;
          return false;
        }
        attrs.$set(attr, newHref);
      };

      if (ref.paramExpr) {
        scope.$watch(ref.paramExpr, function(newVal, oldVal) {
          if (newVal !== params) update(newVal);
        }, true);
        params = angular.copy(scope.$eval(ref.paramExpr));
      }
      update();

      if (isForm) return;

      element.bind("click", function(e) {
        var button = e.which || e.button;
        if ( !(button > 1 || e.ctrlKey || e.metaKey || e.shiftKey || element.attr('target')) ) {
          // HACK: This is to allow ng-clicks to be processed before the transition is initiated:
          var transition = $timeout(function() {
            $state.go(ref.state, params, options);
          });
          e.preventDefault();

          // if the state has no URL, ignore one preventDefault from the <a> directive.
          var ignorePreventDefaultCount = isAnchor && !newHref ? 1: 0;
          e.preventDefault = function() {
            if (ignorePreventDefaultCount-- <= 0)
              $timeout.cancel(transition);
          };
        }
      });
    }
  };
}

/**
 * @ngdoc directive
 * @name ui.router.state.directive:ui-sref-active
 *
 * @requires ui.router.state.$state
 * @requires ui.router.state.$stateParams
 * @requires $interpolate
 *
 * @restrict A
 *
 * @description
 * A directive working alongside ui-sref to add classes to an element when the
 * related ui-sref directive's state is active, and removing them when it is inactive.
 * The primary use-case is to simplify the special appearance of navigation menus
 * relying on `ui-sref`, by having the "active" state's menu button appear different,
 * distinguishing it from the inactive menu items.
 *
 * ui-sref-active can live on the same element as ui-sref or on a parent element. The first
 * ui-sref-active found at the same level or above the ui-sref will be used.
 *
 * Will activate when the ui-sref's target state or any child state is active. If you
 * need to activate only when the ui-sref target state is active and *not* any of
 * it's children, then you will use
 * {@link ui.router.state.directive:ui-sref-active-eq ui-sref-active-eq}
 *
 * @example
 * Given the following template:
 * <pre>
 * <ul>
 *   <li ui-sref-active="active" class="item">
 *     <a href ui-sref="app.user({user: 'bilbobaggins'})">@bilbobaggins</a>
 *   </li>
 * </ul>
 * </pre>
 *
 *
 * When the app state is "app.user" (or any children states), and contains the state parameter "user" with value "bilbobaggins",
 * the resulting HTML will appear as (note the 'active' class):
 * <pre>
 * <ul>
 *   <li ui-sref-active="active" class="item active">
 *     <a ui-sref="app.user({user: 'bilbobaggins'})" href="/users/bilbobaggins">@bilbobaggins</a>
 *   </li>
 * </ul>
 * </pre>
 *
 * The class name is interpolated **once** during the directives link time (any further changes to the
 * interpolated value are ignored).
 *
 * Multiple classes may be specified in a space-separated format:
 * <pre>
 * <ul>
 *   <li ui-sref-active='class1 class2 class3'>
 *     <a ui-sref="app.user">link</a>
 *   </li>
 * </ul>
 * </pre>
 */

/**
 * @ngdoc directive
 * @name ui.router.state.directive:ui-sref-active-eq
 *
 * @requires ui.router.state.$state
 * @requires ui.router.state.$stateParams
 * @requires $interpolate
 *
 * @restrict A
 *
 * @description
 * The same as {@link ui.router.state.directive:ui-sref-active ui-sref-active} but will only activate
 * when the exact target state used in the `ui-sref` is active; no child states.
 *
 */
$StateRefActiveDirective.$inject = ['$state', '$stateParams', '$interpolate'];
function $StateRefActiveDirective($state, $stateParams, $interpolate) {
  return  {
    restrict: "A",
    controller: ['$scope', '$element', '$attrs', function ($scope, $element, $attrs) {
      var states = [], activeClass;

      // There probably isn't much point in $observing this
      // uiSrefActive and uiSrefActiveEq share the same directive object with some
      // slight difference in logic routing
      activeClass = $interpolate($attrs.uiSrefActiveEq || $attrs.uiSrefActive || '', false)($scope);

      // Allow uiSref to communicate with uiSrefActive[Equals]
      this.$$addStateInfo = function (newState, newParams) {
        var state = $state.get(newState, stateContext($element));

        states.push({
          state: state || { name: newState },
          params: newParams
        });

        update();
      };

      $scope.$on('$stateChangeSuccess', update);

      // Update route state
      function update() {
        if (anyMatch()) {
          $element.addClass(activeClass);
        } else {
          $element.removeClass(activeClass);
        }
      }

      function anyMatch() {
        for (var i = 0; i < states.length; i++) {
          if (isMatch(states[i].state, states[i].params)) {
            return true;
          }
        }
        return false;
      }

      function isMatch(state, params) {
        if (typeof $attrs.uiSrefActiveEq !== 'undefined') {
          return $state.is(state.name, params);
        } else {
          return $state.includes(state.name, params);
        }
      }
    }]
  };
}

angular.module('ui.router.state')
  .directive('uiSref', $StateRefDirective)
  .directive('uiSrefActive', $StateRefActiveDirective)
  .directive('uiSrefActiveEq', $StateRefActiveDirective);

//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiIiwic291cmNlcyI6WyJhbmd1bGFyLXVpLXJvdXRlci9zcmMvc3RhdGVEaXJlY3RpdmVzLmpzIl0sInNvdXJjZXNDb250ZW50IjpbImZ1bmN0aW9uIHBhcnNlU3RhdGVSZWYocmVmLCBjdXJyZW50KSB7XG4gIHZhciBwcmVwYXJzZWQgPSByZWYubWF0Y2goL15cXHMqKHtbXn1dKn0pXFxzKiQvKSwgcGFyc2VkO1xuICBpZiAocHJlcGFyc2VkKSByZWYgPSBjdXJyZW50ICsgJygnICsgcHJlcGFyc2VkWzFdICsgJyknO1xuICBwYXJzZWQgPSByZWYucmVwbGFjZSgvXFxuL2csIFwiIFwiKS5tYXRjaCgvXihbXihdKz8pXFxzKihcXCgoLiopXFwpKT8kLyk7XG4gIGlmICghcGFyc2VkIHx8IHBhcnNlZC5sZW5ndGggIT09IDQpIHRocm93IG5ldyBFcnJvcihcIkludmFsaWQgc3RhdGUgcmVmICdcIiArIHJlZiArIFwiJ1wiKTtcbiAgcmV0dXJuIHsgc3RhdGU6IHBhcnNlZFsxXSwgcGFyYW1FeHByOiBwYXJzZWRbM10gfHwgbnVsbCB9O1xufVxuXG5mdW5jdGlvbiBzdGF0ZUNvbnRleHQoZWwpIHtcbiAgdmFyIHN0YXRlRGF0YSA9IGVsLnBhcmVudCgpLmluaGVyaXRlZERhdGEoJyR1aVZpZXcnKTtcblxuICBpZiAoc3RhdGVEYXRhICYmIHN0YXRlRGF0YS5zdGF0ZSAmJiBzdGF0ZURhdGEuc3RhdGUubmFtZSkge1xuICAgIHJldHVybiBzdGF0ZURhdGEuc3RhdGU7XG4gIH1cbn1cblxuLyoqXG4gKiBAbmdkb2MgZGlyZWN0aXZlXG4gKiBAbmFtZSB1aS5yb3V0ZXIuc3RhdGUuZGlyZWN0aXZlOnVpLXNyZWZcbiAqXG4gKiBAcmVxdWlyZXMgdWkucm91dGVyLnN0YXRlLiRzdGF0ZVxuICogQHJlcXVpcmVzICR0aW1lb3V0XG4gKlxuICogQHJlc3RyaWN0IEFcbiAqXG4gKiBAZGVzY3JpcHRpb25cbiAqIEEgZGlyZWN0aXZlIHRoYXQgYmluZHMgYSBsaW5rIChgPGE+YCB0YWcpIHRvIGEgc3RhdGUuIElmIHRoZSBzdGF0ZSBoYXMgYW4gYXNzb2NpYXRlZCBcbiAqIFVSTCwgdGhlIGRpcmVjdGl2ZSB3aWxsIGF1dG9tYXRpY2FsbHkgZ2VuZXJhdGUgJiB1cGRhdGUgdGhlIGBocmVmYCBhdHRyaWJ1dGUgdmlhIFxuICogdGhlIHtAbGluayB1aS5yb3V0ZXIuc3RhdGUuJHN0YXRlI21ldGhvZHNfaHJlZiAkc3RhdGUuaHJlZigpfSBtZXRob2QuIENsaWNraW5nIFxuICogdGhlIGxpbmsgd2lsbCB0cmlnZ2VyIGEgc3RhdGUgdHJhbnNpdGlvbiB3aXRoIG9wdGlvbmFsIHBhcmFtZXRlcnMuIFxuICpcbiAqIEFsc28gbWlkZGxlLWNsaWNraW5nLCByaWdodC1jbGlja2luZywgYW5kIGN0cmwtY2xpY2tpbmcgb24gdGhlIGxpbmsgd2lsbCBiZSBcbiAqIGhhbmRsZWQgbmF0aXZlbHkgYnkgdGhlIGJyb3dzZXIuXG4gKlxuICogWW91IGNhbiBhbHNvIHVzZSByZWxhdGl2ZSBzdGF0ZSBwYXRocyB3aXRoaW4gdWktc3JlZiwganVzdCBsaWtlIHRoZSByZWxhdGl2ZSBcbiAqIHBhdGhzIHBhc3NlZCB0byBgJHN0YXRlLmdvKClgLiBZb3UganVzdCBuZWVkIHRvIGJlIGF3YXJlIHRoYXQgdGhlIHBhdGggaXMgcmVsYXRpdmVcbiAqIHRvIHRoZSBzdGF0ZSB0aGF0IHRoZSBsaW5rIGxpdmVzIGluLCBpbiBvdGhlciB3b3JkcyB0aGUgc3RhdGUgdGhhdCBsb2FkZWQgdGhlIFxuICogdGVtcGxhdGUgY29udGFpbmluZyB0aGUgbGluay5cbiAqXG4gKiBZb3UgY2FuIHNwZWNpZnkgb3B0aW9ucyB0byBwYXNzIHRvIHtAbGluayB1aS5yb3V0ZXIuc3RhdGUuJHN0YXRlI2dvICRzdGF0ZS5nbygpfVxuICogdXNpbmcgdGhlIGB1aS1zcmVmLW9wdHNgIGF0dHJpYnV0ZS4gT3B0aW9ucyBhcmUgcmVzdHJpY3RlZCB0byBgbG9jYXRpb25gLCBgaW5oZXJpdGAsXG4gKiBhbmQgYHJlbG9hZGAuXG4gKlxuICogQGV4YW1wbGVcbiAqIEhlcmUncyBhbiBleGFtcGxlIG9mIGhvdyB5b3UnZCB1c2UgdWktc3JlZiBhbmQgaG93IGl0IHdvdWxkIGNvbXBpbGUuIElmIHlvdSBoYXZlIHRoZSBcbiAqIGZvbGxvd2luZyB0ZW1wbGF0ZTpcbiAqIDxwcmU+XG4gKiA8YSB1aS1zcmVmPVwiaG9tZVwiPkhvbWU8L2E+IHwgPGEgdWktc3JlZj1cImFib3V0XCI+QWJvdXQ8L2E+IHwgPGEgdWktc3JlZj1cIntwYWdlOiAyfVwiPk5leHQgcGFnZTwvYT5cbiAqIFxuICogPHVsPlxuICogICAgIDxsaSBuZy1yZXBlYXQ9XCJjb250YWN0IGluIGNvbnRhY3RzXCI+XG4gKiAgICAgICAgIDxhIHVpLXNyZWY9XCJjb250YWN0cy5kZXRhaWwoeyBpZDogY29udGFjdC5pZCB9KVwiPnt7IGNvbnRhY3QubmFtZSB9fTwvYT5cbiAqICAgICA8L2xpPlxuICogPC91bD5cbiAqIDwvcHJlPlxuICogXG4gKiBUaGVuIHRoZSBjb21waWxlZCBodG1sIHdvdWxkIGJlIChhc3N1bWluZyBIdG1sNU1vZGUgaXMgb2ZmIGFuZCBjdXJyZW50IHN0YXRlIGlzIGNvbnRhY3RzKTpcbiAqIDxwcmU+XG4gKiA8YSBocmVmPVwiIy9ob21lXCIgdWktc3JlZj1cImhvbWVcIj5Ib21lPC9hPiB8IDxhIGhyZWY9XCIjL2Fib3V0XCIgdWktc3JlZj1cImFib3V0XCI+QWJvdXQ8L2E+IHwgPGEgaHJlZj1cIiMvY29udGFjdHM/cGFnZT0yXCIgdWktc3JlZj1cIntwYWdlOiAyfVwiPk5leHQgcGFnZTwvYT5cbiAqIFxuICogPHVsPlxuICogICAgIDxsaSBuZy1yZXBlYXQ9XCJjb250YWN0IGluIGNvbnRhY3RzXCI+XG4gKiAgICAgICAgIDxhIGhyZWY9XCIjL2NvbnRhY3RzLzFcIiB1aS1zcmVmPVwiY29udGFjdHMuZGV0YWlsKHsgaWQ6IGNvbnRhY3QuaWQgfSlcIj5Kb2U8L2E+XG4gKiAgICAgPC9saT5cbiAqICAgICA8bGkgbmctcmVwZWF0PVwiY29udGFjdCBpbiBjb250YWN0c1wiPlxuICogICAgICAgICA8YSBocmVmPVwiIy9jb250YWN0cy8yXCIgdWktc3JlZj1cImNvbnRhY3RzLmRldGFpbCh7IGlkOiBjb250YWN0LmlkIH0pXCI+QWxpY2U8L2E+XG4gKiAgICAgPC9saT5cbiAqICAgICA8bGkgbmctcmVwZWF0PVwiY29udGFjdCBpbiBjb250YWN0c1wiPlxuICogICAgICAgICA8YSBocmVmPVwiIy9jb250YWN0cy8zXCIgdWktc3JlZj1cImNvbnRhY3RzLmRldGFpbCh7IGlkOiBjb250YWN0LmlkIH0pXCI+Qm9iPC9hPlxuICogICAgIDwvbGk+XG4gKiA8L3VsPlxuICpcbiAqIDxhIHVpLXNyZWY9XCJob21lXCIgdWktc3JlZi1vcHRzPVwie3JlbG9hZDogdHJ1ZX1cIj5Ib21lPC9hPlxuICogPC9wcmU+XG4gKlxuICogQHBhcmFtIHtzdHJpbmd9IHVpLXNyZWYgJ3N0YXRlTmFtZScgY2FuIGJlIGFueSB2YWxpZCBhYnNvbHV0ZSBvciByZWxhdGl2ZSBzdGF0ZVxuICogQHBhcmFtIHtPYmplY3R9IHVpLXNyZWYtb3B0cyBvcHRpb25zIHRvIHBhc3MgdG8ge0BsaW5rIHVpLnJvdXRlci5zdGF0ZS4kc3RhdGUjZ28gJHN0YXRlLmdvKCl9XG4gKi9cbiRTdGF0ZVJlZkRpcmVjdGl2ZS4kaW5qZWN0ID0gWyckc3RhdGUnLCAnJHRpbWVvdXQnXTtcbmZ1bmN0aW9uICRTdGF0ZVJlZkRpcmVjdGl2ZSgkc3RhdGUsICR0aW1lb3V0KSB7XG4gIHZhciBhbGxvd2VkT3B0aW9ucyA9IFsnbG9jYXRpb24nLCAnaW5oZXJpdCcsICdyZWxvYWQnLCAnYWJzb2x1dGUnXTtcblxuICByZXR1cm4ge1xuICAgIHJlc3RyaWN0OiAnQScsXG4gICAgcmVxdWlyZTogWyc/XnVpU3JlZkFjdGl2ZScsICc/XnVpU3JlZkFjdGl2ZUVxJ10sXG4gICAgbGluazogZnVuY3Rpb24oc2NvcGUsIGVsZW1lbnQsIGF0dHJzLCB1aVNyZWZBY3RpdmUpIHtcbiAgICAgIHZhciByZWYgPSBwYXJzZVN0YXRlUmVmKGF0dHJzLnVpU3JlZiwgJHN0YXRlLmN1cnJlbnQubmFtZSk7XG4gICAgICB2YXIgcGFyYW1zID0gbnVsbCwgdXJsID0gbnVsbCwgYmFzZSA9IHN0YXRlQ29udGV4dChlbGVtZW50KSB8fCAkc3RhdGUuJGN1cnJlbnQ7XG4gICAgICAvLyBTVkdBRWxlbWVudCBkb2VzIG5vdCB1c2UgdGhlIGhyZWYgYXR0cmlidXRlLCBidXQgcmF0aGVyIHRoZSAneGxpbmtIcmVmJyBhdHRyaWJ1dGUuXG4gICAgICB2YXIgaHJlZktpbmQgPSBPYmplY3QucHJvdG90eXBlLnRvU3RyaW5nLmNhbGwoZWxlbWVudC5wcm9wKCdocmVmJykpID09PSAnW29iamVjdCBTVkdBbmltYXRlZFN0cmluZ10nID9cbiAgICAgICAgICAgICAgICAgJ3hsaW5rOmhyZWYnIDogJ2hyZWYnO1xuICAgICAgdmFyIG5ld0hyZWYgPSBudWxsLCBpc0FuY2hvciA9IGVsZW1lbnQucHJvcChcInRhZ05hbWVcIikudG9VcHBlckNhc2UoKSA9PT0gXCJBXCI7XG4gICAgICB2YXIgaXNGb3JtID0gZWxlbWVudFswXS5ub2RlTmFtZSA9PT0gXCJGT1JNXCI7XG4gICAgICB2YXIgYXR0ciA9IGlzRm9ybSA/IFwiYWN0aW9uXCIgOiBocmVmS2luZCwgbmF2ID0gdHJ1ZTtcblxuICAgICAgdmFyIG9wdGlvbnMgPSB7IHJlbGF0aXZlOiBiYXNlLCBpbmhlcml0OiB0cnVlIH07XG4gICAgICB2YXIgb3B0aW9uc092ZXJyaWRlID0gc2NvcGUuJGV2YWwoYXR0cnMudWlTcmVmT3B0cykgfHwge307XG5cbiAgICAgIGFuZ3VsYXIuZm9yRWFjaChhbGxvd2VkT3B0aW9ucywgZnVuY3Rpb24ob3B0aW9uKSB7XG4gICAgICAgIGlmIChvcHRpb24gaW4gb3B0aW9uc092ZXJyaWRlKSB7XG4gICAgICAgICAgb3B0aW9uc1tvcHRpb25dID0gb3B0aW9uc092ZXJyaWRlW29wdGlvbl07XG4gICAgICAgIH1cbiAgICAgIH0pO1xuXG4gICAgICB2YXIgdXBkYXRlID0gZnVuY3Rpb24obmV3VmFsKSB7XG4gICAgICAgIGlmIChuZXdWYWwpIHBhcmFtcyA9IGFuZ3VsYXIuY29weShuZXdWYWwpO1xuICAgICAgICBpZiAoIW5hdikgcmV0dXJuO1xuXG4gICAgICAgIG5ld0hyZWYgPSAkc3RhdGUuaHJlZihyZWYuc3RhdGUsIHBhcmFtcywgb3B0aW9ucyk7XG5cbiAgICAgICAgdmFyIGFjdGl2ZURpcmVjdGl2ZSA9IHVpU3JlZkFjdGl2ZVsxXSB8fCB1aVNyZWZBY3RpdmVbMF07XG4gICAgICAgIGlmIChhY3RpdmVEaXJlY3RpdmUpIHtcbiAgICAgICAgICBhY3RpdmVEaXJlY3RpdmUuJCRhZGRTdGF0ZUluZm8ocmVmLnN0YXRlLCBwYXJhbXMpO1xuICAgICAgICB9XG4gICAgICAgIGlmIChuZXdIcmVmID09PSBudWxsKSB7XG4gICAgICAgICAgbmF2ID0gZmFsc2U7XG4gICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9XG4gICAgICAgIGF0dHJzLiRzZXQoYXR0ciwgbmV3SHJlZik7XG4gICAgICB9O1xuXG4gICAgICBpZiAocmVmLnBhcmFtRXhwcikge1xuICAgICAgICBzY29wZS4kd2F0Y2gocmVmLnBhcmFtRXhwciwgZnVuY3Rpb24obmV3VmFsLCBvbGRWYWwpIHtcbiAgICAgICAgICBpZiAobmV3VmFsICE9PSBwYXJhbXMpIHVwZGF0ZShuZXdWYWwpO1xuICAgICAgICB9LCB0cnVlKTtcbiAgICAgICAgcGFyYW1zID0gYW5ndWxhci5jb3B5KHNjb3BlLiRldmFsKHJlZi5wYXJhbUV4cHIpKTtcbiAgICAgIH1cbiAgICAgIHVwZGF0ZSgpO1xuXG4gICAgICBpZiAoaXNGb3JtKSByZXR1cm47XG5cbiAgICAgIGVsZW1lbnQuYmluZChcImNsaWNrXCIsIGZ1bmN0aW9uKGUpIHtcbiAgICAgICAgdmFyIGJ1dHRvbiA9IGUud2hpY2ggfHwgZS5idXR0b247XG4gICAgICAgIGlmICggIShidXR0b24gPiAxIHx8IGUuY3RybEtleSB8fCBlLm1ldGFLZXkgfHwgZS5zaGlmdEtleSB8fCBlbGVtZW50LmF0dHIoJ3RhcmdldCcpKSApIHtcbiAgICAgICAgICAvLyBIQUNLOiBUaGlzIGlzIHRvIGFsbG93IG5nLWNsaWNrcyB0byBiZSBwcm9jZXNzZWQgYmVmb3JlIHRoZSB0cmFuc2l0aW9uIGlzIGluaXRpYXRlZDpcbiAgICAgICAgICB2YXIgdHJhbnNpdGlvbiA9ICR0aW1lb3V0KGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgJHN0YXRlLmdvKHJlZi5zdGF0ZSwgcGFyYW1zLCBvcHRpb25zKTtcbiAgICAgICAgICB9KTtcbiAgICAgICAgICBlLnByZXZlbnREZWZhdWx0KCk7XG5cbiAgICAgICAgICAvLyBpZiB0aGUgc3RhdGUgaGFzIG5vIFVSTCwgaWdub3JlIG9uZSBwcmV2ZW50RGVmYXVsdCBmcm9tIHRoZSA8YT4gZGlyZWN0aXZlLlxuICAgICAgICAgIHZhciBpZ25vcmVQcmV2ZW50RGVmYXVsdENvdW50ID0gaXNBbmNob3IgJiYgIW5ld0hyZWYgPyAxOiAwO1xuICAgICAgICAgIGUucHJldmVudERlZmF1bHQgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgICAgIGlmIChpZ25vcmVQcmV2ZW50RGVmYXVsdENvdW50LS0gPD0gMClcbiAgICAgICAgICAgICAgJHRpbWVvdXQuY2FuY2VsKHRyYW5zaXRpb24pO1xuICAgICAgICAgIH07XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgIH1cbiAgfTtcbn1cblxuLyoqXG4gKiBAbmdkb2MgZGlyZWN0aXZlXG4gKiBAbmFtZSB1aS5yb3V0ZXIuc3RhdGUuZGlyZWN0aXZlOnVpLXNyZWYtYWN0aXZlXG4gKlxuICogQHJlcXVpcmVzIHVpLnJvdXRlci5zdGF0ZS4kc3RhdGVcbiAqIEByZXF1aXJlcyB1aS5yb3V0ZXIuc3RhdGUuJHN0YXRlUGFyYW1zXG4gKiBAcmVxdWlyZXMgJGludGVycG9sYXRlXG4gKlxuICogQHJlc3RyaWN0IEFcbiAqXG4gKiBAZGVzY3JpcHRpb25cbiAqIEEgZGlyZWN0aXZlIHdvcmtpbmcgYWxvbmdzaWRlIHVpLXNyZWYgdG8gYWRkIGNsYXNzZXMgdG8gYW4gZWxlbWVudCB3aGVuIHRoZVxuICogcmVsYXRlZCB1aS1zcmVmIGRpcmVjdGl2ZSdzIHN0YXRlIGlzIGFjdGl2ZSwgYW5kIHJlbW92aW5nIHRoZW0gd2hlbiBpdCBpcyBpbmFjdGl2ZS5cbiAqIFRoZSBwcmltYXJ5IHVzZS1jYXNlIGlzIHRvIHNpbXBsaWZ5IHRoZSBzcGVjaWFsIGFwcGVhcmFuY2Ugb2YgbmF2aWdhdGlvbiBtZW51c1xuICogcmVseWluZyBvbiBgdWktc3JlZmAsIGJ5IGhhdmluZyB0aGUgXCJhY3RpdmVcIiBzdGF0ZSdzIG1lbnUgYnV0dG9uIGFwcGVhciBkaWZmZXJlbnQsXG4gKiBkaXN0aW5ndWlzaGluZyBpdCBmcm9tIHRoZSBpbmFjdGl2ZSBtZW51IGl0ZW1zLlxuICpcbiAqIHVpLXNyZWYtYWN0aXZlIGNhbiBsaXZlIG9uIHRoZSBzYW1lIGVsZW1lbnQgYXMgdWktc3JlZiBvciBvbiBhIHBhcmVudCBlbGVtZW50LiBUaGUgZmlyc3RcbiAqIHVpLXNyZWYtYWN0aXZlIGZvdW5kIGF0IHRoZSBzYW1lIGxldmVsIG9yIGFib3ZlIHRoZSB1aS1zcmVmIHdpbGwgYmUgdXNlZC5cbiAqXG4gKiBXaWxsIGFjdGl2YXRlIHdoZW4gdGhlIHVpLXNyZWYncyB0YXJnZXQgc3RhdGUgb3IgYW55IGNoaWxkIHN0YXRlIGlzIGFjdGl2ZS4gSWYgeW91XG4gKiBuZWVkIHRvIGFjdGl2YXRlIG9ubHkgd2hlbiB0aGUgdWktc3JlZiB0YXJnZXQgc3RhdGUgaXMgYWN0aXZlIGFuZCAqbm90KiBhbnkgb2ZcbiAqIGl0J3MgY2hpbGRyZW4sIHRoZW4geW91IHdpbGwgdXNlXG4gKiB7QGxpbmsgdWkucm91dGVyLnN0YXRlLmRpcmVjdGl2ZTp1aS1zcmVmLWFjdGl2ZS1lcSB1aS1zcmVmLWFjdGl2ZS1lcX1cbiAqXG4gKiBAZXhhbXBsZVxuICogR2l2ZW4gdGhlIGZvbGxvd2luZyB0ZW1wbGF0ZTpcbiAqIDxwcmU+XG4gKiA8dWw+XG4gKiAgIDxsaSB1aS1zcmVmLWFjdGl2ZT1cImFjdGl2ZVwiIGNsYXNzPVwiaXRlbVwiPlxuICogICAgIDxhIGhyZWYgdWktc3JlZj1cImFwcC51c2VyKHt1c2VyOiAnYmlsYm9iYWdnaW5zJ30pXCI+QGJpbGJvYmFnZ2luczwvYT5cbiAqICAgPC9saT5cbiAqIDwvdWw+XG4gKiA8L3ByZT5cbiAqXG4gKlxuICogV2hlbiB0aGUgYXBwIHN0YXRlIGlzIFwiYXBwLnVzZXJcIiAob3IgYW55IGNoaWxkcmVuIHN0YXRlcyksIGFuZCBjb250YWlucyB0aGUgc3RhdGUgcGFyYW1ldGVyIFwidXNlclwiIHdpdGggdmFsdWUgXCJiaWxib2JhZ2dpbnNcIixcbiAqIHRoZSByZXN1bHRpbmcgSFRNTCB3aWxsIGFwcGVhciBhcyAobm90ZSB0aGUgJ2FjdGl2ZScgY2xhc3MpOlxuICogPHByZT5cbiAqIDx1bD5cbiAqICAgPGxpIHVpLXNyZWYtYWN0aXZlPVwiYWN0aXZlXCIgY2xhc3M9XCJpdGVtIGFjdGl2ZVwiPlxuICogICAgIDxhIHVpLXNyZWY9XCJhcHAudXNlcih7dXNlcjogJ2JpbGJvYmFnZ2lucyd9KVwiIGhyZWY9XCIvdXNlcnMvYmlsYm9iYWdnaW5zXCI+QGJpbGJvYmFnZ2luczwvYT5cbiAqICAgPC9saT5cbiAqIDwvdWw+XG4gKiA8L3ByZT5cbiAqXG4gKiBUaGUgY2xhc3MgbmFtZSBpcyBpbnRlcnBvbGF0ZWQgKipvbmNlKiogZHVyaW5nIHRoZSBkaXJlY3RpdmVzIGxpbmsgdGltZSAoYW55IGZ1cnRoZXIgY2hhbmdlcyB0byB0aGVcbiAqIGludGVycG9sYXRlZCB2YWx1ZSBhcmUgaWdub3JlZCkuXG4gKlxuICogTXVsdGlwbGUgY2xhc3NlcyBtYXkgYmUgc3BlY2lmaWVkIGluIGEgc3BhY2Utc2VwYXJhdGVkIGZvcm1hdDpcbiAqIDxwcmU+XG4gKiA8dWw+XG4gKiAgIDxsaSB1aS1zcmVmLWFjdGl2ZT0nY2xhc3MxIGNsYXNzMiBjbGFzczMnPlxuICogICAgIDxhIHVpLXNyZWY9XCJhcHAudXNlclwiPmxpbms8L2E+XG4gKiAgIDwvbGk+XG4gKiA8L3VsPlxuICogPC9wcmU+XG4gKi9cblxuLyoqXG4gKiBAbmdkb2MgZGlyZWN0aXZlXG4gKiBAbmFtZSB1aS5yb3V0ZXIuc3RhdGUuZGlyZWN0aXZlOnVpLXNyZWYtYWN0aXZlLWVxXG4gKlxuICogQHJlcXVpcmVzIHVpLnJvdXRlci5zdGF0ZS4kc3RhdGVcbiAqIEByZXF1aXJlcyB1aS5yb3V0ZXIuc3RhdGUuJHN0YXRlUGFyYW1zXG4gKiBAcmVxdWlyZXMgJGludGVycG9sYXRlXG4gKlxuICogQHJlc3RyaWN0IEFcbiAqXG4gKiBAZGVzY3JpcHRpb25cbiAqIFRoZSBzYW1lIGFzIHtAbGluayB1aS5yb3V0ZXIuc3RhdGUuZGlyZWN0aXZlOnVpLXNyZWYtYWN0aXZlIHVpLXNyZWYtYWN0aXZlfSBidXQgd2lsbCBvbmx5IGFjdGl2YXRlXG4gKiB3aGVuIHRoZSBleGFjdCB0YXJnZXQgc3RhdGUgdXNlZCBpbiB0aGUgYHVpLXNyZWZgIGlzIGFjdGl2ZTsgbm8gY2hpbGQgc3RhdGVzLlxuICpcbiAqL1xuJFN0YXRlUmVmQWN0aXZlRGlyZWN0aXZlLiRpbmplY3QgPSBbJyRzdGF0ZScsICckc3RhdGVQYXJhbXMnLCAnJGludGVycG9sYXRlJ107XG5mdW5jdGlvbiAkU3RhdGVSZWZBY3RpdmVEaXJlY3RpdmUoJHN0YXRlLCAkc3RhdGVQYXJhbXMsICRpbnRlcnBvbGF0ZSkge1xuICByZXR1cm4gIHtcbiAgICByZXN0cmljdDogXCJBXCIsXG4gICAgY29udHJvbGxlcjogWyckc2NvcGUnLCAnJGVsZW1lbnQnLCAnJGF0dHJzJywgZnVuY3Rpb24gKCRzY29wZSwgJGVsZW1lbnQsICRhdHRycykge1xuICAgICAgdmFyIHN0YXRlcyA9IFtdLCBhY3RpdmVDbGFzcztcblxuICAgICAgLy8gVGhlcmUgcHJvYmFibHkgaXNuJ3QgbXVjaCBwb2ludCBpbiAkb2JzZXJ2aW5nIHRoaXNcbiAgICAgIC8vIHVpU3JlZkFjdGl2ZSBhbmQgdWlTcmVmQWN0aXZlRXEgc2hhcmUgdGhlIHNhbWUgZGlyZWN0aXZlIG9iamVjdCB3aXRoIHNvbWVcbiAgICAgIC8vIHNsaWdodCBkaWZmZXJlbmNlIGluIGxvZ2ljIHJvdXRpbmdcbiAgICAgIGFjdGl2ZUNsYXNzID0gJGludGVycG9sYXRlKCRhdHRycy51aVNyZWZBY3RpdmVFcSB8fCAkYXR0cnMudWlTcmVmQWN0aXZlIHx8ICcnLCBmYWxzZSkoJHNjb3BlKTtcblxuICAgICAgLy8gQWxsb3cgdWlTcmVmIHRvIGNvbW11bmljYXRlIHdpdGggdWlTcmVmQWN0aXZlW0VxdWFsc11cbiAgICAgIHRoaXMuJCRhZGRTdGF0ZUluZm8gPSBmdW5jdGlvbiAobmV3U3RhdGUsIG5ld1BhcmFtcykge1xuICAgICAgICB2YXIgc3RhdGUgPSAkc3RhdGUuZ2V0KG5ld1N0YXRlLCBzdGF0ZUNvbnRleHQoJGVsZW1lbnQpKTtcblxuICAgICAgICBzdGF0ZXMucHVzaCh7XG4gICAgICAgICAgc3RhdGU6IHN0YXRlIHx8IHsgbmFtZTogbmV3U3RhdGUgfSxcbiAgICAgICAgICBwYXJhbXM6IG5ld1BhcmFtc1xuICAgICAgICB9KTtcblxuICAgICAgICB1cGRhdGUoKTtcbiAgICAgIH07XG5cbiAgICAgICRzY29wZS4kb24oJyRzdGF0ZUNoYW5nZVN1Y2Nlc3MnLCB1cGRhdGUpO1xuXG4gICAgICAvLyBVcGRhdGUgcm91dGUgc3RhdGVcbiAgICAgIGZ1bmN0aW9uIHVwZGF0ZSgpIHtcbiAgICAgICAgaWYgKGFueU1hdGNoKCkpIHtcbiAgICAgICAgICAkZWxlbWVudC5hZGRDbGFzcyhhY3RpdmVDbGFzcyk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgJGVsZW1lbnQucmVtb3ZlQ2xhc3MoYWN0aXZlQ2xhc3MpO1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIGZ1bmN0aW9uIGFueU1hdGNoKCkge1xuICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IHN0YXRlcy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgIGlmIChpc01hdGNoKHN0YXRlc1tpXS5zdGF0ZSwgc3RhdGVzW2ldLnBhcmFtcykpIHtcbiAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICB9XG5cbiAgICAgIGZ1bmN0aW9uIGlzTWF0Y2goc3RhdGUsIHBhcmFtcykge1xuICAgICAgICBpZiAodHlwZW9mICRhdHRycy51aVNyZWZBY3RpdmVFcSAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgICAgICByZXR1cm4gJHN0YXRlLmlzKHN0YXRlLm5hbWUsIHBhcmFtcyk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgcmV0dXJuICRzdGF0ZS5pbmNsdWRlcyhzdGF0ZS5uYW1lLCBwYXJhbXMpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfV1cbiAgfTtcbn1cblxuYW5ndWxhci5tb2R1bGUoJ3VpLnJvdXRlci5zdGF0ZScpXG4gIC5kaXJlY3RpdmUoJ3VpU3JlZicsICRTdGF0ZVJlZkRpcmVjdGl2ZSlcbiAgLmRpcmVjdGl2ZSgndWlTcmVmQWN0aXZlJywgJFN0YXRlUmVmQWN0aXZlRGlyZWN0aXZlKVxuICAuZGlyZWN0aXZlKCd1aVNyZWZBY3RpdmVFcScsICRTdGF0ZVJlZkFjdGl2ZURpcmVjdGl2ZSk7XG4iXSwiZmlsZSI6ImFuZ3VsYXItdWktcm91dGVyL3NyYy9zdGF0ZURpcmVjdGl2ZXMuanMiLCJzb3VyY2VSb290IjoiL3NvdXJjZS8ifQ==