
$ViewProvider.$inject = [];
function $ViewProvider() {

  this.$get = $get;
  /**
   * @ngdoc object
   * @name ui.router.state.$view
   *
   * @requires ui.router.util.$templateFactory
   * @requires $rootScope
   *
   * @description
   *
   */
  $get.$inject = ['$rootScope', '$templateFactory'];
  function $get(   $rootScope,   $templateFactory) {
    return {
      // $view.load('full.viewName', { template: ..., controller: ..., resolve: ..., async: false, params: ... })
      /**
       * @ngdoc function
       * @name ui.router.state.$view#load
       * @methodOf ui.router.state.$view
       *
       * @description
       *
       * @param {string} name name
       * @param {object} options option object.
       */
      load: function load(name, options) {
        var result, defaults = {
          template: null, controller: null, view: null, locals: null, notify: true, async: true, params: {}
        };
        options = extend(defaults, options);

        if (options.view) {
          result = $templateFactory.fromConfig(options.view, options.params, options.locals);
        }
        if (result && options.notify) {
        /**
         * @ngdoc event
         * @name ui.router.state.$state#$viewContentLoading
         * @eventOf ui.router.state.$view
         * @eventType broadcast on root scope
         * @description
         *
         * Fired once the view **begins loading**, *before* the DOM is rendered.
         *
         * @param {Object} event Event object.
         * @param {Object} viewConfig The view config properties (template, controller, etc).
         *
         * @example
         *
         * <pre>
         * $scope.$on('$viewContentLoading',
         * function(event, viewConfig){
         *     // Access to all the view config properties.
         *     // and one special property 'targetView'
         *     // viewConfig.targetView
         * });
         * </pre>
         */
          $rootScope.$broadcast('$viewContentLoading', options);
        }
        return result;
      }
    };
  }
}

angular.module('ui.router.state').provider('$view', $ViewProvider);

//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiIiwic291cmNlcyI6WyJhbmd1bGFyLXVpLXJvdXRlci9zcmMvdmlldy5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJcbiRWaWV3UHJvdmlkZXIuJGluamVjdCA9IFtdO1xuZnVuY3Rpb24gJFZpZXdQcm92aWRlcigpIHtcblxuICB0aGlzLiRnZXQgPSAkZ2V0O1xuICAvKipcbiAgICogQG5nZG9jIG9iamVjdFxuICAgKiBAbmFtZSB1aS5yb3V0ZXIuc3RhdGUuJHZpZXdcbiAgICpcbiAgICogQHJlcXVpcmVzIHVpLnJvdXRlci51dGlsLiR0ZW1wbGF0ZUZhY3RvcnlcbiAgICogQHJlcXVpcmVzICRyb290U2NvcGVcbiAgICpcbiAgICogQGRlc2NyaXB0aW9uXG4gICAqXG4gICAqL1xuICAkZ2V0LiRpbmplY3QgPSBbJyRyb290U2NvcGUnLCAnJHRlbXBsYXRlRmFjdG9yeSddO1xuICBmdW5jdGlvbiAkZ2V0KCAgICRyb290U2NvcGUsICAgJHRlbXBsYXRlRmFjdG9yeSkge1xuICAgIHJldHVybiB7XG4gICAgICAvLyAkdmlldy5sb2FkKCdmdWxsLnZpZXdOYW1lJywgeyB0ZW1wbGF0ZTogLi4uLCBjb250cm9sbGVyOiAuLi4sIHJlc29sdmU6IC4uLiwgYXN5bmM6IGZhbHNlLCBwYXJhbXM6IC4uLiB9KVxuICAgICAgLyoqXG4gICAgICAgKiBAbmdkb2MgZnVuY3Rpb25cbiAgICAgICAqIEBuYW1lIHVpLnJvdXRlci5zdGF0ZS4kdmlldyNsb2FkXG4gICAgICAgKiBAbWV0aG9kT2YgdWkucm91dGVyLnN0YXRlLiR2aWV3XG4gICAgICAgKlxuICAgICAgICogQGRlc2NyaXB0aW9uXG4gICAgICAgKlxuICAgICAgICogQHBhcmFtIHtzdHJpbmd9IG5hbWUgbmFtZVxuICAgICAgICogQHBhcmFtIHtvYmplY3R9IG9wdGlvbnMgb3B0aW9uIG9iamVjdC5cbiAgICAgICAqL1xuICAgICAgbG9hZDogZnVuY3Rpb24gbG9hZChuYW1lLCBvcHRpb25zKSB7XG4gICAgICAgIHZhciByZXN1bHQsIGRlZmF1bHRzID0ge1xuICAgICAgICAgIHRlbXBsYXRlOiBudWxsLCBjb250cm9sbGVyOiBudWxsLCB2aWV3OiBudWxsLCBsb2NhbHM6IG51bGwsIG5vdGlmeTogdHJ1ZSwgYXN5bmM6IHRydWUsIHBhcmFtczoge31cbiAgICAgICAgfTtcbiAgICAgICAgb3B0aW9ucyA9IGV4dGVuZChkZWZhdWx0cywgb3B0aW9ucyk7XG5cbiAgICAgICAgaWYgKG9wdGlvbnMudmlldykge1xuICAgICAgICAgIHJlc3VsdCA9ICR0ZW1wbGF0ZUZhY3RvcnkuZnJvbUNvbmZpZyhvcHRpb25zLnZpZXcsIG9wdGlvbnMucGFyYW1zLCBvcHRpb25zLmxvY2Fscyk7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHJlc3VsdCAmJiBvcHRpb25zLm5vdGlmeSkge1xuICAgICAgICAvKipcbiAgICAgICAgICogQG5nZG9jIGV2ZW50XG4gICAgICAgICAqIEBuYW1lIHVpLnJvdXRlci5zdGF0ZS4kc3RhdGUjJHZpZXdDb250ZW50TG9hZGluZ1xuICAgICAgICAgKiBAZXZlbnRPZiB1aS5yb3V0ZXIuc3RhdGUuJHZpZXdcbiAgICAgICAgICogQGV2ZW50VHlwZSBicm9hZGNhc3Qgb24gcm9vdCBzY29wZVxuICAgICAgICAgKiBAZGVzY3JpcHRpb25cbiAgICAgICAgICpcbiAgICAgICAgICogRmlyZWQgb25jZSB0aGUgdmlldyAqKmJlZ2lucyBsb2FkaW5nKiosICpiZWZvcmUqIHRoZSBET00gaXMgcmVuZGVyZWQuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7T2JqZWN0fSBldmVudCBFdmVudCBvYmplY3QuXG4gICAgICAgICAqIEBwYXJhbSB7T2JqZWN0fSB2aWV3Q29uZmlnIFRoZSB2aWV3IGNvbmZpZyBwcm9wZXJ0aWVzICh0ZW1wbGF0ZSwgY29udHJvbGxlciwgZXRjKS5cbiAgICAgICAgICpcbiAgICAgICAgICogQGV4YW1wbGVcbiAgICAgICAgICpcbiAgICAgICAgICogPHByZT5cbiAgICAgICAgICogJHNjb3BlLiRvbignJHZpZXdDb250ZW50TG9hZGluZycsXG4gICAgICAgICAqIGZ1bmN0aW9uKGV2ZW50LCB2aWV3Q29uZmlnKXtcbiAgICAgICAgICogICAgIC8vIEFjY2VzcyB0byBhbGwgdGhlIHZpZXcgY29uZmlnIHByb3BlcnRpZXMuXG4gICAgICAgICAqICAgICAvLyBhbmQgb25lIHNwZWNpYWwgcHJvcGVydHkgJ3RhcmdldFZpZXcnXG4gICAgICAgICAqICAgICAvLyB2aWV3Q29uZmlnLnRhcmdldFZpZXdcbiAgICAgICAgICogfSk7XG4gICAgICAgICAqIDwvcHJlPlxuICAgICAgICAgKi9cbiAgICAgICAgICAkcm9vdFNjb3BlLiRicm9hZGNhc3QoJyR2aWV3Q29udGVudExvYWRpbmcnLCBvcHRpb25zKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gcmVzdWx0O1xuICAgICAgfVxuICAgIH07XG4gIH1cbn1cblxuYW5ndWxhci5tb2R1bGUoJ3VpLnJvdXRlci5zdGF0ZScpLnByb3ZpZGVyKCckdmlldycsICRWaWV3UHJvdmlkZXIpO1xuIl0sImZpbGUiOiJhbmd1bGFyLXVpLXJvdXRlci9zcmMvdmlldy5qcyIsInNvdXJjZVJvb3QiOiIvc291cmNlLyJ9