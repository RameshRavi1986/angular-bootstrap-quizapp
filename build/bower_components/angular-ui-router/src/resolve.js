/**
 * @ngdoc object
 * @name ui.router.util.$resolve
 *
 * @requires $q
 * @requires $injector
 *
 * @description
 * Manages resolution of (acyclic) graphs of promises.
 */
$Resolve.$inject = ['$q', '$injector'];
function $Resolve(  $q,    $injector) {
  
  var VISIT_IN_PROGRESS = 1,
      VISIT_DONE = 2,
      NOTHING = {},
      NO_DEPENDENCIES = [],
      NO_LOCALS = NOTHING,
      NO_PARENT = extend($q.when(NOTHING), { $$promises: NOTHING, $$values: NOTHING });
  

  /**
   * @ngdoc function
   * @name ui.router.util.$resolve#study
   * @methodOf ui.router.util.$resolve
   *
   * @description
   * Studies a set of invocables that are likely to be used multiple times.
   * <pre>
   * $resolve.study(invocables)(locals, parent, self)
   * </pre>
   * is equivalent to
   * <pre>
   * $resolve.resolve(invocables, locals, parent, self)
   * </pre>
   * but the former is more efficient (in fact `resolve` just calls `study` 
   * internally).
   *
   * @param {object} invocables Invocable objects
   * @return {function} a function to pass in locals, parent and self
   */
  this.study = function (invocables) {
    if (!isObject(invocables)) throw new Error("'invocables' must be an object");
    var invocableKeys = objectKeys(invocables || {});
    
    // Perform a topological sort of invocables to build an ordered plan
    var plan = [], cycle = [], visited = {};
    function visit(value, key) {
      if (visited[key] === VISIT_DONE) return;
      
      cycle.push(key);
      if (visited[key] === VISIT_IN_PROGRESS) {
        cycle.splice(0, indexOf(cycle, key));
        throw new Error("Cyclic dependency: " + cycle.join(" -> "));
      }
      visited[key] = VISIT_IN_PROGRESS;
      
      if (isString(value)) {
        plan.push(key, [ function() { return $injector.get(value); }], NO_DEPENDENCIES);
      } else {
        var params = $injector.annotate(value);
        forEach(params, function (param) {
          if (param !== key && invocables.hasOwnProperty(param)) visit(invocables[param], param);
        });
        plan.push(key, value, params);
      }
      
      cycle.pop();
      visited[key] = VISIT_DONE;
    }
    forEach(invocables, visit);
    invocables = cycle = visited = null; // plan is all that's required
    
    function isResolve(value) {
      return isObject(value) && value.then && value.$$promises;
    }
    
    return function (locals, parent, self) {
      if (isResolve(locals) && self === undefined) {
        self = parent; parent = locals; locals = null;
      }
      if (!locals) locals = NO_LOCALS;
      else if (!isObject(locals)) {
        throw new Error("'locals' must be an object");
      }       
      if (!parent) parent = NO_PARENT;
      else if (!isResolve(parent)) {
        throw new Error("'parent' must be a promise returned by $resolve.resolve()");
      }
      
      // To complete the overall resolution, we have to wait for the parent
      // promise and for the promise for each invokable in our plan.
      var resolution = $q.defer(),
          result = resolution.promise,
          promises = result.$$promises = {},
          values = extend({}, locals),
          wait = 1 + plan.length/3,
          merged = false;
          
      function done() {
        // Merge parent values we haven't got yet and publish our own $$values
        if (!--wait) {
          if (!merged) merge(values, parent.$$values); 
          result.$$values = values;
          result.$$promises = result.$$promises || true; // keep for isResolve()
          delete result.$$inheritedValues;
          resolution.resolve(values);
        }
      }
      
      function fail(reason) {
        result.$$failure = reason;
        resolution.reject(reason);
      }

      // Short-circuit if parent has already failed
      if (isDefined(parent.$$failure)) {
        fail(parent.$$failure);
        return result;
      }
      
      if (parent.$$inheritedValues) {
        merge(values, omit(parent.$$inheritedValues, invocableKeys));
      }

      // Merge parent values if the parent has already resolved, or merge
      // parent promises and wait if the parent resolve is still in progress.
      extend(promises, parent.$$promises);
      if (parent.$$values) {
        merged = merge(values, omit(parent.$$values, invocableKeys));
        result.$$inheritedValues = omit(parent.$$values, invocableKeys);
        done();
      } else {
        if (parent.$$inheritedValues) {
          result.$$inheritedValues = omit(parent.$$inheritedValues, invocableKeys);
        }        
        parent.then(done, fail);
      }
      
      // Process each invocable in the plan, but ignore any where a local of the same name exists.
      for (var i=0, ii=plan.length; i<ii; i+=3) {
        if (locals.hasOwnProperty(plan[i])) done();
        else invoke(plan[i], plan[i+1], plan[i+2]);
      }
      
      function invoke(key, invocable, params) {
        // Create a deferred for this invocation. Failures will propagate to the resolution as well.
        var invocation = $q.defer(), waitParams = 0;
        function onfailure(reason) {
          invocation.reject(reason);
          fail(reason);
        }
        // Wait for any parameter that we have a promise for (either from parent or from this
        // resolve; in that case study() will have made sure it's ordered before us in the plan).
        forEach(params, function (dep) {
          if (promises.hasOwnProperty(dep) && !locals.hasOwnProperty(dep)) {
            waitParams++;
            promises[dep].then(function (result) {
              values[dep] = result;
              if (!(--waitParams)) proceed();
            }, onfailure);
          }
        });
        if (!waitParams) proceed();
        function proceed() {
          if (isDefined(result.$$failure)) return;
          try {
            invocation.resolve($injector.invoke(invocable, self, values));
            invocation.promise.then(function (result) {
              values[key] = result;
              done();
            }, onfailure);
          } catch (e) {
            onfailure(e);
          }
        }
        // Publish promise synchronously; invocations further down in the plan may depend on it.
        promises[key] = invocation.promise;
      }
      
      return result;
    };
  };
  
  /**
   * @ngdoc function
   * @name ui.router.util.$resolve#resolve
   * @methodOf ui.router.util.$resolve
   *
   * @description
   * Resolves a set of invocables. An invocable is a function to be invoked via 
   * `$injector.invoke()`, and can have an arbitrary number of dependencies. 
   * An invocable can either return a value directly,
   * or a `$q` promise. If a promise is returned it will be resolved and the 
   * resulting value will be used instead. Dependencies of invocables are resolved 
   * (in this order of precedence)
   *
   * - from the specified `locals`
   * - from another invocable that is part of this `$resolve` call
   * - from an invocable that is inherited from a `parent` call to `$resolve` 
   *   (or recursively
   * - from any ancestor `$resolve` of that parent).
   *
   * The return value of `$resolve` is a promise for an object that contains 
   * (in this order of precedence)
   *
   * - any `locals` (if specified)
   * - the resolved return values of all injectables
   * - any values inherited from a `parent` call to `$resolve` (if specified)
   *
   * The promise will resolve after the `parent` promise (if any) and all promises 
   * returned by injectables have been resolved. If any invocable 
   * (or `$injector.invoke`) throws an exception, or if a promise returned by an 
   * invocable is rejected, the `$resolve` promise is immediately rejected with the 
   * same error. A rejection of a `parent` promise (if specified) will likewise be 
   * propagated immediately. Once the `$resolve` promise has been rejected, no 
   * further invocables will be called.
   * 
   * Cyclic dependencies between invocables are not permitted and will caues `$resolve`
   * to throw an error. As a special case, an injectable can depend on a parameter 
   * with the same name as the injectable, which will be fulfilled from the `parent` 
   * injectable of the same name. This allows inherited values to be decorated. 
   * Note that in this case any other injectable in the same `$resolve` with the same
   * dependency would see the decorated value, not the inherited value.
   *
   * Note that missing dependencies -- unlike cyclic dependencies -- will cause an 
   * (asynchronous) rejection of the `$resolve` promise rather than a (synchronous) 
   * exception.
   *
   * Invocables are invoked eagerly as soon as all dependencies are available. 
   * This is true even for dependencies inherited from a `parent` call to `$resolve`.
   *
   * As a special case, an invocable can be a string, in which case it is taken to 
   * be a service name to be passed to `$injector.get()`. This is supported primarily 
   * for backwards-compatibility with the `resolve` property of `$routeProvider` 
   * routes.
   *
   * @param {object} invocables functions to invoke or 
   * `$injector` services to fetch.
   * @param {object} locals  values to make available to the injectables
   * @param {object} parent  a promise returned by another call to `$resolve`.
   * @param {object} self  the `this` for the invoked methods
   * @return {object} Promise for an object that contains the resolved return value
   * of all invocables, as well as any inherited and local values.
   */
  this.resolve = function (invocables, locals, parent, self) {
    return this.study(invocables)(locals, parent, self);
  };
}

angular.module('ui.router.util').service('$resolve', $Resolve);


//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiIiwic291cmNlcyI6WyJhbmd1bGFyLXVpLXJvdXRlci9zcmMvcmVzb2x2ZS5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBuZ2RvYyBvYmplY3RcbiAqIEBuYW1lIHVpLnJvdXRlci51dGlsLiRyZXNvbHZlXG4gKlxuICogQHJlcXVpcmVzICRxXG4gKiBAcmVxdWlyZXMgJGluamVjdG9yXG4gKlxuICogQGRlc2NyaXB0aW9uXG4gKiBNYW5hZ2VzIHJlc29sdXRpb24gb2YgKGFjeWNsaWMpIGdyYXBocyBvZiBwcm9taXNlcy5cbiAqL1xuJFJlc29sdmUuJGluamVjdCA9IFsnJHEnLCAnJGluamVjdG9yJ107XG5mdW5jdGlvbiAkUmVzb2x2ZSggICRxLCAgICAkaW5qZWN0b3IpIHtcbiAgXG4gIHZhciBWSVNJVF9JTl9QUk9HUkVTUyA9IDEsXG4gICAgICBWSVNJVF9ET05FID0gMixcbiAgICAgIE5PVEhJTkcgPSB7fSxcbiAgICAgIE5PX0RFUEVOREVOQ0lFUyA9IFtdLFxuICAgICAgTk9fTE9DQUxTID0gTk9USElORyxcbiAgICAgIE5PX1BBUkVOVCA9IGV4dGVuZCgkcS53aGVuKE5PVEhJTkcpLCB7ICQkcHJvbWlzZXM6IE5PVEhJTkcsICQkdmFsdWVzOiBOT1RISU5HIH0pO1xuICBcblxuICAvKipcbiAgICogQG5nZG9jIGZ1bmN0aW9uXG4gICAqIEBuYW1lIHVpLnJvdXRlci51dGlsLiRyZXNvbHZlI3N0dWR5XG4gICAqIEBtZXRob2RPZiB1aS5yb3V0ZXIudXRpbC4kcmVzb2x2ZVxuICAgKlxuICAgKiBAZGVzY3JpcHRpb25cbiAgICogU3R1ZGllcyBhIHNldCBvZiBpbnZvY2FibGVzIHRoYXQgYXJlIGxpa2VseSB0byBiZSB1c2VkIG11bHRpcGxlIHRpbWVzLlxuICAgKiA8cHJlPlxuICAgKiAkcmVzb2x2ZS5zdHVkeShpbnZvY2FibGVzKShsb2NhbHMsIHBhcmVudCwgc2VsZilcbiAgICogPC9wcmU+XG4gICAqIGlzIGVxdWl2YWxlbnQgdG9cbiAgICogPHByZT5cbiAgICogJHJlc29sdmUucmVzb2x2ZShpbnZvY2FibGVzLCBsb2NhbHMsIHBhcmVudCwgc2VsZilcbiAgICogPC9wcmU+XG4gICAqIGJ1dCB0aGUgZm9ybWVyIGlzIG1vcmUgZWZmaWNpZW50IChpbiBmYWN0IGByZXNvbHZlYCBqdXN0IGNhbGxzIGBzdHVkeWAgXG4gICAqIGludGVybmFsbHkpLlxuICAgKlxuICAgKiBAcGFyYW0ge29iamVjdH0gaW52b2NhYmxlcyBJbnZvY2FibGUgb2JqZWN0c1xuICAgKiBAcmV0dXJuIHtmdW5jdGlvbn0gYSBmdW5jdGlvbiB0byBwYXNzIGluIGxvY2FscywgcGFyZW50IGFuZCBzZWxmXG4gICAqL1xuICB0aGlzLnN0dWR5ID0gZnVuY3Rpb24gKGludm9jYWJsZXMpIHtcbiAgICBpZiAoIWlzT2JqZWN0KGludm9jYWJsZXMpKSB0aHJvdyBuZXcgRXJyb3IoXCInaW52b2NhYmxlcycgbXVzdCBiZSBhbiBvYmplY3RcIik7XG4gICAgdmFyIGludm9jYWJsZUtleXMgPSBvYmplY3RLZXlzKGludm9jYWJsZXMgfHwge30pO1xuICAgIFxuICAgIC8vIFBlcmZvcm0gYSB0b3BvbG9naWNhbCBzb3J0IG9mIGludm9jYWJsZXMgdG8gYnVpbGQgYW4gb3JkZXJlZCBwbGFuXG4gICAgdmFyIHBsYW4gPSBbXSwgY3ljbGUgPSBbXSwgdmlzaXRlZCA9IHt9O1xuICAgIGZ1bmN0aW9uIHZpc2l0KHZhbHVlLCBrZXkpIHtcbiAgICAgIGlmICh2aXNpdGVkW2tleV0gPT09IFZJU0lUX0RPTkUpIHJldHVybjtcbiAgICAgIFxuICAgICAgY3ljbGUucHVzaChrZXkpO1xuICAgICAgaWYgKHZpc2l0ZWRba2V5XSA9PT0gVklTSVRfSU5fUFJPR1JFU1MpIHtcbiAgICAgICAgY3ljbGUuc3BsaWNlKDAsIGluZGV4T2YoY3ljbGUsIGtleSkpO1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJDeWNsaWMgZGVwZW5kZW5jeTogXCIgKyBjeWNsZS5qb2luKFwiIC0+IFwiKSk7XG4gICAgICB9XG4gICAgICB2aXNpdGVkW2tleV0gPSBWSVNJVF9JTl9QUk9HUkVTUztcbiAgICAgIFxuICAgICAgaWYgKGlzU3RyaW5nKHZhbHVlKSkge1xuICAgICAgICBwbGFuLnB1c2goa2V5LCBbIGZ1bmN0aW9uKCkgeyByZXR1cm4gJGluamVjdG9yLmdldCh2YWx1ZSk7IH1dLCBOT19ERVBFTkRFTkNJRVMpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdmFyIHBhcmFtcyA9ICRpbmplY3Rvci5hbm5vdGF0ZSh2YWx1ZSk7XG4gICAgICAgIGZvckVhY2gocGFyYW1zLCBmdW5jdGlvbiAocGFyYW0pIHtcbiAgICAgICAgICBpZiAocGFyYW0gIT09IGtleSAmJiBpbnZvY2FibGVzLmhhc093blByb3BlcnR5KHBhcmFtKSkgdmlzaXQoaW52b2NhYmxlc1twYXJhbV0sIHBhcmFtKTtcbiAgICAgICAgfSk7XG4gICAgICAgIHBsYW4ucHVzaChrZXksIHZhbHVlLCBwYXJhbXMpO1xuICAgICAgfVxuICAgICAgXG4gICAgICBjeWNsZS5wb3AoKTtcbiAgICAgIHZpc2l0ZWRba2V5XSA9IFZJU0lUX0RPTkU7XG4gICAgfVxuICAgIGZvckVhY2goaW52b2NhYmxlcywgdmlzaXQpO1xuICAgIGludm9jYWJsZXMgPSBjeWNsZSA9IHZpc2l0ZWQgPSBudWxsOyAvLyBwbGFuIGlzIGFsbCB0aGF0J3MgcmVxdWlyZWRcbiAgICBcbiAgICBmdW5jdGlvbiBpc1Jlc29sdmUodmFsdWUpIHtcbiAgICAgIHJldHVybiBpc09iamVjdCh2YWx1ZSkgJiYgdmFsdWUudGhlbiAmJiB2YWx1ZS4kJHByb21pc2VzO1xuICAgIH1cbiAgICBcbiAgICByZXR1cm4gZnVuY3Rpb24gKGxvY2FscywgcGFyZW50LCBzZWxmKSB7XG4gICAgICBpZiAoaXNSZXNvbHZlKGxvY2FscykgJiYgc2VsZiA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIHNlbGYgPSBwYXJlbnQ7IHBhcmVudCA9IGxvY2FsczsgbG9jYWxzID0gbnVsbDtcbiAgICAgIH1cbiAgICAgIGlmICghbG9jYWxzKSBsb2NhbHMgPSBOT19MT0NBTFM7XG4gICAgICBlbHNlIGlmICghaXNPYmplY3QobG9jYWxzKSkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCInbG9jYWxzJyBtdXN0IGJlIGFuIG9iamVjdFwiKTtcbiAgICAgIH0gICAgICAgXG4gICAgICBpZiAoIXBhcmVudCkgcGFyZW50ID0gTk9fUEFSRU5UO1xuICAgICAgZWxzZSBpZiAoIWlzUmVzb2x2ZShwYXJlbnQpKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihcIidwYXJlbnQnIG11c3QgYmUgYSBwcm9taXNlIHJldHVybmVkIGJ5ICRyZXNvbHZlLnJlc29sdmUoKVwiKTtcbiAgICAgIH1cbiAgICAgIFxuICAgICAgLy8gVG8gY29tcGxldGUgdGhlIG92ZXJhbGwgcmVzb2x1dGlvbiwgd2UgaGF2ZSB0byB3YWl0IGZvciB0aGUgcGFyZW50XG4gICAgICAvLyBwcm9taXNlIGFuZCBmb3IgdGhlIHByb21pc2UgZm9yIGVhY2ggaW52b2thYmxlIGluIG91ciBwbGFuLlxuICAgICAgdmFyIHJlc29sdXRpb24gPSAkcS5kZWZlcigpLFxuICAgICAgICAgIHJlc3VsdCA9IHJlc29sdXRpb24ucHJvbWlzZSxcbiAgICAgICAgICBwcm9taXNlcyA9IHJlc3VsdC4kJHByb21pc2VzID0ge30sXG4gICAgICAgICAgdmFsdWVzID0gZXh0ZW5kKHt9LCBsb2NhbHMpLFxuICAgICAgICAgIHdhaXQgPSAxICsgcGxhbi5sZW5ndGgvMyxcbiAgICAgICAgICBtZXJnZWQgPSBmYWxzZTtcbiAgICAgICAgICBcbiAgICAgIGZ1bmN0aW9uIGRvbmUoKSB7XG4gICAgICAgIC8vIE1lcmdlIHBhcmVudCB2YWx1ZXMgd2UgaGF2ZW4ndCBnb3QgeWV0IGFuZCBwdWJsaXNoIG91ciBvd24gJCR2YWx1ZXNcbiAgICAgICAgaWYgKCEtLXdhaXQpIHtcbiAgICAgICAgICBpZiAoIW1lcmdlZCkgbWVyZ2UodmFsdWVzLCBwYXJlbnQuJCR2YWx1ZXMpOyBcbiAgICAgICAgICByZXN1bHQuJCR2YWx1ZXMgPSB2YWx1ZXM7XG4gICAgICAgICAgcmVzdWx0LiQkcHJvbWlzZXMgPSByZXN1bHQuJCRwcm9taXNlcyB8fCB0cnVlOyAvLyBrZWVwIGZvciBpc1Jlc29sdmUoKVxuICAgICAgICAgIGRlbGV0ZSByZXN1bHQuJCRpbmhlcml0ZWRWYWx1ZXM7XG4gICAgICAgICAgcmVzb2x1dGlvbi5yZXNvbHZlKHZhbHVlcyk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIFxuICAgICAgZnVuY3Rpb24gZmFpbChyZWFzb24pIHtcbiAgICAgICAgcmVzdWx0LiQkZmFpbHVyZSA9IHJlYXNvbjtcbiAgICAgICAgcmVzb2x1dGlvbi5yZWplY3QocmVhc29uKTtcbiAgICAgIH1cblxuICAgICAgLy8gU2hvcnQtY2lyY3VpdCBpZiBwYXJlbnQgaGFzIGFscmVhZHkgZmFpbGVkXG4gICAgICBpZiAoaXNEZWZpbmVkKHBhcmVudC4kJGZhaWx1cmUpKSB7XG4gICAgICAgIGZhaWwocGFyZW50LiQkZmFpbHVyZSk7XG4gICAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgICB9XG4gICAgICBcbiAgICAgIGlmIChwYXJlbnQuJCRpbmhlcml0ZWRWYWx1ZXMpIHtcbiAgICAgICAgbWVyZ2UodmFsdWVzLCBvbWl0KHBhcmVudC4kJGluaGVyaXRlZFZhbHVlcywgaW52b2NhYmxlS2V5cykpO1xuICAgICAgfVxuXG4gICAgICAvLyBNZXJnZSBwYXJlbnQgdmFsdWVzIGlmIHRoZSBwYXJlbnQgaGFzIGFscmVhZHkgcmVzb2x2ZWQsIG9yIG1lcmdlXG4gICAgICAvLyBwYXJlbnQgcHJvbWlzZXMgYW5kIHdhaXQgaWYgdGhlIHBhcmVudCByZXNvbHZlIGlzIHN0aWxsIGluIHByb2dyZXNzLlxuICAgICAgZXh0ZW5kKHByb21pc2VzLCBwYXJlbnQuJCRwcm9taXNlcyk7XG4gICAgICBpZiAocGFyZW50LiQkdmFsdWVzKSB7XG4gICAgICAgIG1lcmdlZCA9IG1lcmdlKHZhbHVlcywgb21pdChwYXJlbnQuJCR2YWx1ZXMsIGludm9jYWJsZUtleXMpKTtcbiAgICAgICAgcmVzdWx0LiQkaW5oZXJpdGVkVmFsdWVzID0gb21pdChwYXJlbnQuJCR2YWx1ZXMsIGludm9jYWJsZUtleXMpO1xuICAgICAgICBkb25lKCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBpZiAocGFyZW50LiQkaW5oZXJpdGVkVmFsdWVzKSB7XG4gICAgICAgICAgcmVzdWx0LiQkaW5oZXJpdGVkVmFsdWVzID0gb21pdChwYXJlbnQuJCRpbmhlcml0ZWRWYWx1ZXMsIGludm9jYWJsZUtleXMpO1xuICAgICAgICB9ICAgICAgICBcbiAgICAgICAgcGFyZW50LnRoZW4oZG9uZSwgZmFpbCk7XG4gICAgICB9XG4gICAgICBcbiAgICAgIC8vIFByb2Nlc3MgZWFjaCBpbnZvY2FibGUgaW4gdGhlIHBsYW4sIGJ1dCBpZ25vcmUgYW55IHdoZXJlIGEgbG9jYWwgb2YgdGhlIHNhbWUgbmFtZSBleGlzdHMuXG4gICAgICBmb3IgKHZhciBpPTAsIGlpPXBsYW4ubGVuZ3RoOyBpPGlpOyBpKz0zKSB7XG4gICAgICAgIGlmIChsb2NhbHMuaGFzT3duUHJvcGVydHkocGxhbltpXSkpIGRvbmUoKTtcbiAgICAgICAgZWxzZSBpbnZva2UocGxhbltpXSwgcGxhbltpKzFdLCBwbGFuW2krMl0pO1xuICAgICAgfVxuICAgICAgXG4gICAgICBmdW5jdGlvbiBpbnZva2Uoa2V5LCBpbnZvY2FibGUsIHBhcmFtcykge1xuICAgICAgICAvLyBDcmVhdGUgYSBkZWZlcnJlZCBmb3IgdGhpcyBpbnZvY2F0aW9uLiBGYWlsdXJlcyB3aWxsIHByb3BhZ2F0ZSB0byB0aGUgcmVzb2x1dGlvbiBhcyB3ZWxsLlxuICAgICAgICB2YXIgaW52b2NhdGlvbiA9ICRxLmRlZmVyKCksIHdhaXRQYXJhbXMgPSAwO1xuICAgICAgICBmdW5jdGlvbiBvbmZhaWx1cmUocmVhc29uKSB7XG4gICAgICAgICAgaW52b2NhdGlvbi5yZWplY3QocmVhc29uKTtcbiAgICAgICAgICBmYWlsKHJlYXNvbik7XG4gICAgICAgIH1cbiAgICAgICAgLy8gV2FpdCBmb3IgYW55IHBhcmFtZXRlciB0aGF0IHdlIGhhdmUgYSBwcm9taXNlIGZvciAoZWl0aGVyIGZyb20gcGFyZW50IG9yIGZyb20gdGhpc1xuICAgICAgICAvLyByZXNvbHZlOyBpbiB0aGF0IGNhc2Ugc3R1ZHkoKSB3aWxsIGhhdmUgbWFkZSBzdXJlIGl0J3Mgb3JkZXJlZCBiZWZvcmUgdXMgaW4gdGhlIHBsYW4pLlxuICAgICAgICBmb3JFYWNoKHBhcmFtcywgZnVuY3Rpb24gKGRlcCkge1xuICAgICAgICAgIGlmIChwcm9taXNlcy5oYXNPd25Qcm9wZXJ0eShkZXApICYmICFsb2NhbHMuaGFzT3duUHJvcGVydHkoZGVwKSkge1xuICAgICAgICAgICAgd2FpdFBhcmFtcysrO1xuICAgICAgICAgICAgcHJvbWlzZXNbZGVwXS50aGVuKGZ1bmN0aW9uIChyZXN1bHQpIHtcbiAgICAgICAgICAgICAgdmFsdWVzW2RlcF0gPSByZXN1bHQ7XG4gICAgICAgICAgICAgIGlmICghKC0td2FpdFBhcmFtcykpIHByb2NlZWQoKTtcbiAgICAgICAgICAgIH0sIG9uZmFpbHVyZSk7XG4gICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICAgICAgaWYgKCF3YWl0UGFyYW1zKSBwcm9jZWVkKCk7XG4gICAgICAgIGZ1bmN0aW9uIHByb2NlZWQoKSB7XG4gICAgICAgICAgaWYgKGlzRGVmaW5lZChyZXN1bHQuJCRmYWlsdXJlKSkgcmV0dXJuO1xuICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICBpbnZvY2F0aW9uLnJlc29sdmUoJGluamVjdG9yLmludm9rZShpbnZvY2FibGUsIHNlbGYsIHZhbHVlcykpO1xuICAgICAgICAgICAgaW52b2NhdGlvbi5wcm9taXNlLnRoZW4oZnVuY3Rpb24gKHJlc3VsdCkge1xuICAgICAgICAgICAgICB2YWx1ZXNba2V5XSA9IHJlc3VsdDtcbiAgICAgICAgICAgICAgZG9uZSgpO1xuICAgICAgICAgICAgfSwgb25mYWlsdXJlKTtcbiAgICAgICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgICAgICBvbmZhaWx1cmUoZSk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIC8vIFB1Ymxpc2ggcHJvbWlzZSBzeW5jaHJvbm91c2x5OyBpbnZvY2F0aW9ucyBmdXJ0aGVyIGRvd24gaW4gdGhlIHBsYW4gbWF5IGRlcGVuZCBvbiBpdC5cbiAgICAgICAgcHJvbWlzZXNba2V5XSA9IGludm9jYXRpb24ucHJvbWlzZTtcbiAgICAgIH1cbiAgICAgIFxuICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICB9O1xuICB9O1xuICBcbiAgLyoqXG4gICAqIEBuZ2RvYyBmdW5jdGlvblxuICAgKiBAbmFtZSB1aS5yb3V0ZXIudXRpbC4kcmVzb2x2ZSNyZXNvbHZlXG4gICAqIEBtZXRob2RPZiB1aS5yb3V0ZXIudXRpbC4kcmVzb2x2ZVxuICAgKlxuICAgKiBAZGVzY3JpcHRpb25cbiAgICogUmVzb2x2ZXMgYSBzZXQgb2YgaW52b2NhYmxlcy4gQW4gaW52b2NhYmxlIGlzIGEgZnVuY3Rpb24gdG8gYmUgaW52b2tlZCB2aWEgXG4gICAqIGAkaW5qZWN0b3IuaW52b2tlKClgLCBhbmQgY2FuIGhhdmUgYW4gYXJiaXRyYXJ5IG51bWJlciBvZiBkZXBlbmRlbmNpZXMuIFxuICAgKiBBbiBpbnZvY2FibGUgY2FuIGVpdGhlciByZXR1cm4gYSB2YWx1ZSBkaXJlY3RseSxcbiAgICogb3IgYSBgJHFgIHByb21pc2UuIElmIGEgcHJvbWlzZSBpcyByZXR1cm5lZCBpdCB3aWxsIGJlIHJlc29sdmVkIGFuZCB0aGUgXG4gICAqIHJlc3VsdGluZyB2YWx1ZSB3aWxsIGJlIHVzZWQgaW5zdGVhZC4gRGVwZW5kZW5jaWVzIG9mIGludm9jYWJsZXMgYXJlIHJlc29sdmVkIFxuICAgKiAoaW4gdGhpcyBvcmRlciBvZiBwcmVjZWRlbmNlKVxuICAgKlxuICAgKiAtIGZyb20gdGhlIHNwZWNpZmllZCBgbG9jYWxzYFxuICAgKiAtIGZyb20gYW5vdGhlciBpbnZvY2FibGUgdGhhdCBpcyBwYXJ0IG9mIHRoaXMgYCRyZXNvbHZlYCBjYWxsXG4gICAqIC0gZnJvbSBhbiBpbnZvY2FibGUgdGhhdCBpcyBpbmhlcml0ZWQgZnJvbSBhIGBwYXJlbnRgIGNhbGwgdG8gYCRyZXNvbHZlYCBcbiAgICogICAob3IgcmVjdXJzaXZlbHlcbiAgICogLSBmcm9tIGFueSBhbmNlc3RvciBgJHJlc29sdmVgIG9mIHRoYXQgcGFyZW50KS5cbiAgICpcbiAgICogVGhlIHJldHVybiB2YWx1ZSBvZiBgJHJlc29sdmVgIGlzIGEgcHJvbWlzZSBmb3IgYW4gb2JqZWN0IHRoYXQgY29udGFpbnMgXG4gICAqIChpbiB0aGlzIG9yZGVyIG9mIHByZWNlZGVuY2UpXG4gICAqXG4gICAqIC0gYW55IGBsb2NhbHNgIChpZiBzcGVjaWZpZWQpXG4gICAqIC0gdGhlIHJlc29sdmVkIHJldHVybiB2YWx1ZXMgb2YgYWxsIGluamVjdGFibGVzXG4gICAqIC0gYW55IHZhbHVlcyBpbmhlcml0ZWQgZnJvbSBhIGBwYXJlbnRgIGNhbGwgdG8gYCRyZXNvbHZlYCAoaWYgc3BlY2lmaWVkKVxuICAgKlxuICAgKiBUaGUgcHJvbWlzZSB3aWxsIHJlc29sdmUgYWZ0ZXIgdGhlIGBwYXJlbnRgIHByb21pc2UgKGlmIGFueSkgYW5kIGFsbCBwcm9taXNlcyBcbiAgICogcmV0dXJuZWQgYnkgaW5qZWN0YWJsZXMgaGF2ZSBiZWVuIHJlc29sdmVkLiBJZiBhbnkgaW52b2NhYmxlIFxuICAgKiAob3IgYCRpbmplY3Rvci5pbnZva2VgKSB0aHJvd3MgYW4gZXhjZXB0aW9uLCBvciBpZiBhIHByb21pc2UgcmV0dXJuZWQgYnkgYW4gXG4gICAqIGludm9jYWJsZSBpcyByZWplY3RlZCwgdGhlIGAkcmVzb2x2ZWAgcHJvbWlzZSBpcyBpbW1lZGlhdGVseSByZWplY3RlZCB3aXRoIHRoZSBcbiAgICogc2FtZSBlcnJvci4gQSByZWplY3Rpb24gb2YgYSBgcGFyZW50YCBwcm9taXNlIChpZiBzcGVjaWZpZWQpIHdpbGwgbGlrZXdpc2UgYmUgXG4gICAqIHByb3BhZ2F0ZWQgaW1tZWRpYXRlbHkuIE9uY2UgdGhlIGAkcmVzb2x2ZWAgcHJvbWlzZSBoYXMgYmVlbiByZWplY3RlZCwgbm8gXG4gICAqIGZ1cnRoZXIgaW52b2NhYmxlcyB3aWxsIGJlIGNhbGxlZC5cbiAgICogXG4gICAqIEN5Y2xpYyBkZXBlbmRlbmNpZXMgYmV0d2VlbiBpbnZvY2FibGVzIGFyZSBub3QgcGVybWl0dGVkIGFuZCB3aWxsIGNhdWVzIGAkcmVzb2x2ZWBcbiAgICogdG8gdGhyb3cgYW4gZXJyb3IuIEFzIGEgc3BlY2lhbCBjYXNlLCBhbiBpbmplY3RhYmxlIGNhbiBkZXBlbmQgb24gYSBwYXJhbWV0ZXIgXG4gICAqIHdpdGggdGhlIHNhbWUgbmFtZSBhcyB0aGUgaW5qZWN0YWJsZSwgd2hpY2ggd2lsbCBiZSBmdWxmaWxsZWQgZnJvbSB0aGUgYHBhcmVudGAgXG4gICAqIGluamVjdGFibGUgb2YgdGhlIHNhbWUgbmFtZS4gVGhpcyBhbGxvd3MgaW5oZXJpdGVkIHZhbHVlcyB0byBiZSBkZWNvcmF0ZWQuIFxuICAgKiBOb3RlIHRoYXQgaW4gdGhpcyBjYXNlIGFueSBvdGhlciBpbmplY3RhYmxlIGluIHRoZSBzYW1lIGAkcmVzb2x2ZWAgd2l0aCB0aGUgc2FtZVxuICAgKiBkZXBlbmRlbmN5IHdvdWxkIHNlZSB0aGUgZGVjb3JhdGVkIHZhbHVlLCBub3QgdGhlIGluaGVyaXRlZCB2YWx1ZS5cbiAgICpcbiAgICogTm90ZSB0aGF0IG1pc3NpbmcgZGVwZW5kZW5jaWVzIC0tIHVubGlrZSBjeWNsaWMgZGVwZW5kZW5jaWVzIC0tIHdpbGwgY2F1c2UgYW4gXG4gICAqIChhc3luY2hyb25vdXMpIHJlamVjdGlvbiBvZiB0aGUgYCRyZXNvbHZlYCBwcm9taXNlIHJhdGhlciB0aGFuIGEgKHN5bmNocm9ub3VzKSBcbiAgICogZXhjZXB0aW9uLlxuICAgKlxuICAgKiBJbnZvY2FibGVzIGFyZSBpbnZva2VkIGVhZ2VybHkgYXMgc29vbiBhcyBhbGwgZGVwZW5kZW5jaWVzIGFyZSBhdmFpbGFibGUuIFxuICAgKiBUaGlzIGlzIHRydWUgZXZlbiBmb3IgZGVwZW5kZW5jaWVzIGluaGVyaXRlZCBmcm9tIGEgYHBhcmVudGAgY2FsbCB0byBgJHJlc29sdmVgLlxuICAgKlxuICAgKiBBcyBhIHNwZWNpYWwgY2FzZSwgYW4gaW52b2NhYmxlIGNhbiBiZSBhIHN0cmluZywgaW4gd2hpY2ggY2FzZSBpdCBpcyB0YWtlbiB0byBcbiAgICogYmUgYSBzZXJ2aWNlIG5hbWUgdG8gYmUgcGFzc2VkIHRvIGAkaW5qZWN0b3IuZ2V0KClgLiBUaGlzIGlzIHN1cHBvcnRlZCBwcmltYXJpbHkgXG4gICAqIGZvciBiYWNrd2FyZHMtY29tcGF0aWJpbGl0eSB3aXRoIHRoZSBgcmVzb2x2ZWAgcHJvcGVydHkgb2YgYCRyb3V0ZVByb3ZpZGVyYCBcbiAgICogcm91dGVzLlxuICAgKlxuICAgKiBAcGFyYW0ge29iamVjdH0gaW52b2NhYmxlcyBmdW5jdGlvbnMgdG8gaW52b2tlIG9yIFxuICAgKiBgJGluamVjdG9yYCBzZXJ2aWNlcyB0byBmZXRjaC5cbiAgICogQHBhcmFtIHtvYmplY3R9IGxvY2FscyAgdmFsdWVzIHRvIG1ha2UgYXZhaWxhYmxlIHRvIHRoZSBpbmplY3RhYmxlc1xuICAgKiBAcGFyYW0ge29iamVjdH0gcGFyZW50ICBhIHByb21pc2UgcmV0dXJuZWQgYnkgYW5vdGhlciBjYWxsIHRvIGAkcmVzb2x2ZWAuXG4gICAqIEBwYXJhbSB7b2JqZWN0fSBzZWxmICB0aGUgYHRoaXNgIGZvciB0aGUgaW52b2tlZCBtZXRob2RzXG4gICAqIEByZXR1cm4ge29iamVjdH0gUHJvbWlzZSBmb3IgYW4gb2JqZWN0IHRoYXQgY29udGFpbnMgdGhlIHJlc29sdmVkIHJldHVybiB2YWx1ZVxuICAgKiBvZiBhbGwgaW52b2NhYmxlcywgYXMgd2VsbCBhcyBhbnkgaW5oZXJpdGVkIGFuZCBsb2NhbCB2YWx1ZXMuXG4gICAqL1xuICB0aGlzLnJlc29sdmUgPSBmdW5jdGlvbiAoaW52b2NhYmxlcywgbG9jYWxzLCBwYXJlbnQsIHNlbGYpIHtcbiAgICByZXR1cm4gdGhpcy5zdHVkeShpbnZvY2FibGVzKShsb2NhbHMsIHBhcmVudCwgc2VsZik7XG4gIH07XG59XG5cbmFuZ3VsYXIubW9kdWxlKCd1aS5yb3V0ZXIudXRpbCcpLnNlcnZpY2UoJyRyZXNvbHZlJywgJFJlc29sdmUpO1xuXG4iXSwiZmlsZSI6ImFuZ3VsYXItdWktcm91dGVyL3NyYy9yZXNvbHZlLmpzIiwic291cmNlUm9vdCI6Ii9zb3VyY2UvIn0=