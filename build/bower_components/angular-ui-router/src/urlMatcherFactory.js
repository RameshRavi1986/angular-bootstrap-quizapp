var $$UMFP; // reference to $UrlMatcherFactoryProvider

/**
 * @ngdoc object
 * @name ui.router.util.type:UrlMatcher
 *
 * @description
 * Matches URLs against patterns and extracts named parameters from the path or the search
 * part of the URL. A URL pattern consists of a path pattern, optionally followed by '?' and a list
 * of search parameters. Multiple search parameter names are separated by '&'. Search parameters
 * do not influence whether or not a URL is matched, but their values are passed through into
 * the matched parameters returned by {@link ui.router.util.type:UrlMatcher#methods_exec exec}.
 *
 * Path parameter placeholders can be specified using simple colon/catch-all syntax or curly brace
 * syntax, which optionally allows a regular expression for the parameter to be specified:
 *
 * * `':'` name - colon placeholder
 * * `'*'` name - catch-all placeholder
 * * `'{' name '}'` - curly placeholder
 * * `'{' name ':' regexp|type '}'` - curly placeholder with regexp or type name. Should the
 *   regexp itself contain curly braces, they must be in matched pairs or escaped with a backslash.
 *
 * Parameter names may contain only word characters (latin letters, digits, and underscore) and
 * must be unique within the pattern (across both path and search parameters). For colon
 * placeholders or curly placeholders without an explicit regexp, a path parameter matches any
 * number of characters other than '/'. For catch-all placeholders the path parameter matches
 * any number of characters.
 *
 * Examples:
 *
 * * `'/hello/'` - Matches only if the path is exactly '/hello/'. There is no special treatment for
 *   trailing slashes, and patterns have to match the entire path, not just a prefix.
 * * `'/user/:id'` - Matches '/user/bob' or '/user/1234!!!' or even '/user/' but not '/user' or
 *   '/user/bob/details'. The second path segment will be captured as the parameter 'id'.
 * * `'/user/{id}'` - Same as the previous example, but using curly brace syntax.
 * * `'/user/{id:[^/]*}'` - Same as the previous example.
 * * `'/user/{id:[0-9a-fA-F]{1,8}}'` - Similar to the previous example, but only matches if the id
 *   parameter consists of 1 to 8 hex digits.
 * * `'/files/{path:.*}'` - Matches any URL starting with '/files/' and captures the rest of the
 *   path into the parameter 'path'.
 * * `'/files/*path'` - ditto.
 * * `'/calendar/{start:date}'` - Matches "/calendar/2014-11-12" (because the pattern defined
 *   in the built-in  `date` Type matches `2014-11-12`) and provides a Date object in $stateParams.start
 *
 * @param {string} pattern  The pattern to compile into a matcher.
 * @param {Object} config  A configuration object hash:
 * @param {Object=} parentMatcher Used to concatenate the pattern/config onto
 *   an existing UrlMatcher
 *
 * * `caseInsensitive` - `true` if URL matching should be case insensitive, otherwise `false`, the default value (for backward compatibility) is `false`.
 * * `strict` - `false` if matching against a URL with a trailing slash should be treated as equivalent to a URL without a trailing slash, the default value is `true`.
 *
 * @property {string} prefix  A static prefix of this pattern. The matcher guarantees that any
 *   URL matching this matcher (i.e. any string for which {@link ui.router.util.type:UrlMatcher#methods_exec exec()} returns
 *   non-null) will start with this prefix.
 *
 * @property {string} source  The pattern that was passed into the constructor
 *
 * @property {string} sourcePath  The path portion of the source property
 *
 * @property {string} sourceSearch  The search portion of the source property
 *
 * @property {string} regex  The constructed regex that will be used to match against the url when
 *   it is time to determine which url will match.
 *
 * @returns {Object}  New `UrlMatcher` object
 */
function UrlMatcher(pattern, config, parentMatcher) {
  config = extend({ params: {} }, isObject(config) ? config : {});

  // Find all placeholders and create a compiled pattern, using either classic or curly syntax:
  //   '*' name
  //   ':' name
  //   '{' name '}'
  //   '{' name ':' regexp '}'
  // The regular expression is somewhat complicated due to the need to allow curly braces
  // inside the regular expression. The placeholder regexp breaks down as follows:
  //    ([:*])([\w\[\]]+)              - classic placeholder ($1 / $2) (search version has - for snake-case)
  //    \{([\w\[\]]+)(?:\:( ... ))?\}  - curly brace placeholder ($3) with optional regexp/type ... ($4) (search version has - for snake-case
  //    (?: ... | ... | ... )+         - the regexp consists of any number of atoms, an atom being either
  //    [^{}\\]+                       - anything other than curly braces or backslash
  //    \\.                            - a backslash escape
  //    \{(?:[^{}\\]+|\\.)*\}          - a matched set of curly braces containing other atoms
  var placeholder       = /([:*])([\w\[\]]+)|\{([\w\[\]]+)(?:\:((?:[^{}\\]+|\\.|\{(?:[^{}\\]+|\\.)*\})+))?\}/g,
      searchPlaceholder = /([:]?)([\w\[\]-]+)|\{([\w\[\]-]+)(?:\:((?:[^{}\\]+|\\.|\{(?:[^{}\\]+|\\.)*\})+))?\}/g,
      compiled = '^', last = 0, m,
      segments = this.segments = [],
      parentParams = parentMatcher ? parentMatcher.params : {},
      params = this.params = parentMatcher ? parentMatcher.params.$$new() : new $$UMFP.ParamSet(),
      paramNames = [];

  function addParameter(id, type, config, location) {
    paramNames.push(id);
    if (parentParams[id]) return parentParams[id];
    if (!/^\w+(-+\w+)*(?:\[\])?$/.test(id)) throw new Error("Invalid parameter name '" + id + "' in pattern '" + pattern + "'");
    if (params[id]) throw new Error("Duplicate parameter name '" + id + "' in pattern '" + pattern + "'");
    params[id] = new $$UMFP.Param(id, type, config, location);
    return params[id];
  }

  function quoteRegExp(string, pattern, squash, optional) {
    var surroundPattern = ['',''], result = string.replace(/[\\\[\]\^$*+?.()|{}]/g, "\\$&");
    if (!pattern) return result;
    switch(squash) {
      case false: surroundPattern = ['(', ')' + (optional ? "?" : "")]; break;
      case true:  surroundPattern = ['?(', ')?']; break;
      default:    surroundPattern = ['(' + squash + "|", ')?']; break;
    }
    return result + surroundPattern[0] + pattern + surroundPattern[1];
  }

  this.source = pattern;

  // Split into static segments separated by path parameter placeholders.
  // The number of segments is always 1 more than the number of parameters.
  function matchDetails(m, isSearch) {
    var id, regexp, segment, type, cfg, arrayMode;
    id          = m[2] || m[3]; // IE[78] returns '' for unmatched groups instead of null
    cfg         = config.params[id];
    segment     = pattern.substring(last, m.index);
    regexp      = isSearch ? m[4] : m[4] || (m[1] == '*' ? '.*' : null);
    type        = $$UMFP.type(regexp || "string") || inherit($$UMFP.type("string"), { pattern: new RegExp(regexp, config.caseInsensitive ? 'i' : undefined) });
    return {
      id: id, regexp: regexp, segment: segment, type: type, cfg: cfg
    };
  }

  var p, param, segment;
  while ((m = placeholder.exec(pattern))) {
    p = matchDetails(m, false);
    if (p.segment.indexOf('?') >= 0) break; // we're into the search part

    param = addParameter(p.id, p.type, p.cfg, "path");
    compiled += quoteRegExp(p.segment, param.type.pattern.source, param.squash, param.isOptional);
    segments.push(p.segment);
    last = placeholder.lastIndex;
  }
  segment = pattern.substring(last);

  // Find any search parameter names and remove them from the last segment
  var i = segment.indexOf('?');

  if (i >= 0) {
    var search = this.sourceSearch = segment.substring(i);
    segment = segment.substring(0, i);
    this.sourcePath = pattern.substring(0, last + i);

    if (search.length > 0) {
      last = 0;
      while ((m = searchPlaceholder.exec(search))) {
        p = matchDetails(m, true);
        param = addParameter(p.id, p.type, p.cfg, "search");
        last = placeholder.lastIndex;
        // check if ?&
      }
    }
  } else {
    this.sourcePath = pattern;
    this.sourceSearch = '';
  }

  compiled += quoteRegExp(segment) + (config.strict === false ? '\/?' : '') + '$';
  segments.push(segment);

  this.regexp = new RegExp(compiled, config.caseInsensitive ? 'i' : undefined);
  this.prefix = segments[0];
  this.$$paramNames = paramNames;
}

/**
 * @ngdoc function
 * @name ui.router.util.type:UrlMatcher#concat
 * @methodOf ui.router.util.type:UrlMatcher
 *
 * @description
 * Returns a new matcher for a pattern constructed by appending the path part and adding the
 * search parameters of the specified pattern to this pattern. The current pattern is not
 * modified. This can be understood as creating a pattern for URLs that are relative to (or
 * suffixes of) the current pattern.
 *
 * @example
 * The following two matchers are equivalent:
 * <pre>
 * new UrlMatcher('/user/{id}?q').concat('/details?date');
 * new UrlMatcher('/user/{id}/details?q&date');
 * </pre>
 *
 * @param {string} pattern  The pattern to append.
 * @param {Object} config  An object hash of the configuration for the matcher.
 * @returns {UrlMatcher}  A matcher for the concatenated pattern.
 */
UrlMatcher.prototype.concat = function (pattern, config) {
  // Because order of search parameters is irrelevant, we can add our own search
  // parameters to the end of the new pattern. Parse the new pattern by itself
  // and then join the bits together, but it's much easier to do this on a string level.
  var defaultConfig = {
    caseInsensitive: $$UMFP.caseInsensitive(),
    strict: $$UMFP.strictMode(),
    squash: $$UMFP.defaultSquashPolicy()
  };
  return new UrlMatcher(this.sourcePath + pattern + this.sourceSearch, extend(defaultConfig, config), this);
};

UrlMatcher.prototype.toString = function () {
  return this.source;
};

/**
 * @ngdoc function
 * @name ui.router.util.type:UrlMatcher#exec
 * @methodOf ui.router.util.type:UrlMatcher
 *
 * @description
 * Tests the specified path against this matcher, and returns an object containing the captured
 * parameter values, or null if the path does not match. The returned object contains the values
 * of any search parameters that are mentioned in the pattern, but their value may be null if
 * they are not present in `searchParams`. This means that search parameters are always treated
 * as optional.
 *
 * @example
 * <pre>
 * new UrlMatcher('/user/{id}?q&r').exec('/user/bob', {
 *   x: '1', q: 'hello'
 * });
 * // returns { id: 'bob', q: 'hello', r: null }
 * </pre>
 *
 * @param {string} path  The URL path to match, e.g. `$location.path()`.
 * @param {Object} searchParams  URL search parameters, e.g. `$location.search()`.
 * @returns {Object}  The captured parameter values.
 */
UrlMatcher.prototype.exec = function (path, searchParams) {
  var m = this.regexp.exec(path);
  if (!m) return null;
  searchParams = searchParams || {};

  var paramNames = this.parameters(), nTotal = paramNames.length,
    nPath = this.segments.length - 1,
    values = {}, i, j, cfg, paramName;

  if (nPath !== m.length - 1) throw new Error("Unbalanced capture group in route '" + this.source + "'");

  function decodePathArray(string) {
    function reverseString(str) { return str.split("").reverse().join(""); }
    function unquoteDashes(str) { return str.replace(/\\-/g, "-"); }

    var split = reverseString(string).split(/-(?!\\)/);
    var allReversed = map(split, reverseString);
    return map(allReversed, unquoteDashes).reverse();
  }

  for (i = 0; i < nPath; i++) {
    paramName = paramNames[i];
    var param = this.params[paramName];
    var paramVal = m[i+1];
    // if the param value matches a pre-replace pair, replace the value before decoding.
    for (j = 0; j < param.replace; j++) {
      if (param.replace[j].from === paramVal) paramVal = param.replace[j].to;
    }
    if (paramVal && param.array === true) paramVal = decodePathArray(paramVal);
    values[paramName] = param.value(paramVal);
  }
  for (/**/; i < nTotal; i++) {
    paramName = paramNames[i];
    values[paramName] = this.params[paramName].value(searchParams[paramName]);
  }

  return values;
};

/**
 * @ngdoc function
 * @name ui.router.util.type:UrlMatcher#parameters
 * @methodOf ui.router.util.type:UrlMatcher
 *
 * @description
 * Returns the names of all path and search parameters of this pattern in an unspecified order.
 *
 * @returns {Array.<string>}  An array of parameter names. Must be treated as read-only. If the
 *    pattern has no parameters, an empty array is returned.
 */
UrlMatcher.prototype.parameters = function (param) {
  if (!isDefined(param)) return this.$$paramNames;
  return this.params[param] || null;
};

/**
 * @ngdoc function
 * @name ui.router.util.type:UrlMatcher#validate
 * @methodOf ui.router.util.type:UrlMatcher
 *
 * @description
 * Checks an object hash of parameters to validate their correctness according to the parameter
 * types of this `UrlMatcher`.
 *
 * @param {Object} params The object hash of parameters to validate.
 * @returns {boolean} Returns `true` if `params` validates, otherwise `false`.
 */
UrlMatcher.prototype.validates = function (params) {
  return this.params.$$validates(params);
};

/**
 * @ngdoc function
 * @name ui.router.util.type:UrlMatcher#format
 * @methodOf ui.router.util.type:UrlMatcher
 *
 * @description
 * Creates a URL that matches this pattern by substituting the specified values
 * for the path and search parameters. Null values for path parameters are
 * treated as empty strings.
 *
 * @example
 * <pre>
 * new UrlMatcher('/user/{id}?q').format({ id:'bob', q:'yes' });
 * // returns '/user/bob?q=yes'
 * </pre>
 *
 * @param {Object} values  the values to substitute for the parameters in this pattern.
 * @returns {string}  the formatted URL (path and optionally search part).
 */
UrlMatcher.prototype.format = function (values) {
  values = values || {};
  var segments = this.segments, params = this.parameters(), paramset = this.params;
  if (!this.validates(values)) return null;

  var i, search = false, nPath = segments.length - 1, nTotal = params.length, result = segments[0];

  function encodeDashes(str) { // Replace dashes with encoded "\-"
    return encodeURIComponent(str).replace(/-/g, function(c) { return '%5C%' + c.charCodeAt(0).toString(16).toUpperCase(); });
  }

  for (i = 0; i < nTotal; i++) {
    var isPathParam = i < nPath;
    var name = params[i], param = paramset[name], value = param.value(values[name]);
    var isDefaultValue = param.isOptional && param.type.equals(param.value(), value);
    var squash = isDefaultValue ? param.squash : false;
    var encoded = param.type.encode(value);

    if (isPathParam) {
      var nextSegment = segments[i + 1];
      if (squash === false) {
        if (encoded != null) {
          if (isArray(encoded)) {
            result += map(encoded, encodeDashes).join("-");
          } else {
            result += encodeURIComponent(encoded);
          }
        }
        result += nextSegment;
      } else if (squash === true) {
        var capture = result.match(/\/$/) ? /\/?(.*)/ : /(.*)/;
        result += nextSegment.match(capture)[1];
      } else if (isString(squash)) {
        result += squash + nextSegment;
      }
    } else {
      if (encoded == null || (isDefaultValue && squash !== false)) continue;
      if (!isArray(encoded)) encoded = [ encoded ];
      encoded = map(encoded, encodeURIComponent).join('&' + name + '=');
      result += (search ? '&' : '?') + (name + '=' + encoded);
      search = true;
    }
  }

  return result;
};

/**
 * @ngdoc object
 * @name ui.router.util.type:Type
 *
 * @description
 * Implements an interface to define custom parameter types that can be decoded from and encoded to
 * string parameters matched in a URL. Used by {@link ui.router.util.type:UrlMatcher `UrlMatcher`}
 * objects when matching or formatting URLs, or comparing or validating parameter values.
 *
 * See {@link ui.router.util.$urlMatcherFactory#methods_type `$urlMatcherFactory#type()`} for more
 * information on registering custom types.
 *
 * @param {Object} config  A configuration object which contains the custom type definition.  The object's
 *        properties will override the default methods and/or pattern in `Type`'s public interface.
 * @example
 * <pre>
 * {
 *   decode: function(val) { return parseInt(val, 10); },
 *   encode: function(val) { return val && val.toString(); },
 *   equals: function(a, b) { return this.is(a) && a === b; },
 *   is: function(val) { return angular.isNumber(val) isFinite(val) && val % 1 === 0; },
 *   pattern: /\d+/
 * }
 * </pre>
 *
 * @property {RegExp} pattern The regular expression pattern used to match values of this type when
 *           coming from a substring of a URL.
 *
 * @returns {Object}  Returns a new `Type` object.
 */
function Type(config) {
  extend(this, config);
}

/**
 * @ngdoc function
 * @name ui.router.util.type:Type#is
 * @methodOf ui.router.util.type:Type
 *
 * @description
 * Detects whether a value is of a particular type. Accepts a native (decoded) value
 * and determines whether it matches the current `Type` object.
 *
 * @param {*} val  The value to check.
 * @param {string} key  Optional. If the type check is happening in the context of a specific
 *        {@link ui.router.util.type:UrlMatcher `UrlMatcher`} object, this is the name of the
 *        parameter in which `val` is stored. Can be used for meta-programming of `Type` objects.
 * @returns {Boolean}  Returns `true` if the value matches the type, otherwise `false`.
 */
Type.prototype.is = function(val, key) {
  return true;
};

/**
 * @ngdoc function
 * @name ui.router.util.type:Type#encode
 * @methodOf ui.router.util.type:Type
 *
 * @description
 * Encodes a custom/native type value to a string that can be embedded in a URL. Note that the
 * return value does *not* need to be URL-safe (i.e. passed through `encodeURIComponent()`), it
 * only needs to be a representation of `val` that has been coerced to a string.
 *
 * @param {*} val  The value to encode.
 * @param {string} key  The name of the parameter in which `val` is stored. Can be used for
 *        meta-programming of `Type` objects.
 * @returns {string}  Returns a string representation of `val` that can be encoded in a URL.
 */
Type.prototype.encode = function(val, key) {
  return val;
};

/**
 * @ngdoc function
 * @name ui.router.util.type:Type#decode
 * @methodOf ui.router.util.type:Type
 *
 * @description
 * Converts a parameter value (from URL string or transition param) to a custom/native value.
 *
 * @param {string} val  The URL parameter value to decode.
 * @param {string} key  The name of the parameter in which `val` is stored. Can be used for
 *        meta-programming of `Type` objects.
 * @returns {*}  Returns a custom representation of the URL parameter value.
 */
Type.prototype.decode = function(val, key) {
  return val;
};

/**
 * @ngdoc function
 * @name ui.router.util.type:Type#equals
 * @methodOf ui.router.util.type:Type
 *
 * @description
 * Determines whether two decoded values are equivalent.
 *
 * @param {*} a  A value to compare against.
 * @param {*} b  A value to compare against.
 * @returns {Boolean}  Returns `true` if the values are equivalent/equal, otherwise `false`.
 */
Type.prototype.equals = function(a, b) {
  return a == b;
};

Type.prototype.$subPattern = function() {
  var sub = this.pattern.toString();
  return sub.substr(1, sub.length - 2);
};

Type.prototype.pattern = /.*/;

Type.prototype.toString = function() { return "{Type:" + this.name + "}"; };

/** Given an encoded string, or a decoded object, returns a decoded object */
Type.prototype.$normalize = function(val) {
  return this.is(val) ? val : this.decode(val);
};

/*
 * Wraps an existing custom Type as an array of Type, depending on 'mode'.
 * e.g.:
 * - urlmatcher pattern "/path?{queryParam[]:int}"
 * - url: "/path?queryParam=1&queryParam=2
 * - $stateParams.queryParam will be [1, 2]
 * if `mode` is "auto", then
 * - url: "/path?queryParam=1 will create $stateParams.queryParam: 1
 * - url: "/path?queryParam=1&queryParam=2 will create $stateParams.queryParam: [1, 2]
 */
Type.prototype.$asArray = function(mode, isSearch) {
  if (!mode) return this;
  if (mode === "auto" && !isSearch) throw new Error("'auto' array mode is for query parameters only");

  function ArrayType(type, mode) {
    function bindTo(type, callbackName) {
      return function() {
        return type[callbackName].apply(type, arguments);
      };
    }

    // Wrap non-array value as array
    function arrayWrap(val) { return isArray(val) ? val : (isDefined(val) ? [ val ] : []); }
    // Unwrap array value for "auto" mode. Return undefined for empty array.
    function arrayUnwrap(val) {
      switch(val.length) {
        case 0: return undefined;
        case 1: return mode === "auto" ? val[0] : val;
        default: return val;
      }
    }
    function falsey(val) { return !val; }

    // Wraps type (.is/.encode/.decode) functions to operate on each value of an array
    function arrayHandler(callback, allTruthyMode) {
      return function handleArray(val) {
        val = arrayWrap(val);
        var result = map(val, callback);
        if (allTruthyMode === true)
          return filter(result, falsey).length === 0;
        return arrayUnwrap(result);
      };
    }

    // Wraps type (.equals) functions to operate on each value of an array
    function arrayEqualsHandler(callback) {
      return function handleArray(val1, val2) {
        var left = arrayWrap(val1), right = arrayWrap(val2);
        if (left.length !== right.length) return false;
        for (var i = 0; i < left.length; i++) {
          if (!callback(left[i], right[i])) return false;
        }
        return true;
      };
    }

    this.encode = arrayHandler(bindTo(type, 'encode'));
    this.decode = arrayHandler(bindTo(type, 'decode'));
    this.is     = arrayHandler(bindTo(type, 'is'), true);
    this.equals = arrayEqualsHandler(bindTo(type, 'equals'));
    this.pattern = type.pattern;
    this.$normalize = arrayHandler(bindTo(type, '$normalize'));
    this.name = type.name;
    this.$arrayMode = mode;
  }

  return new ArrayType(this, mode);
};



/**
 * @ngdoc object
 * @name ui.router.util.$urlMatcherFactory
 *
 * @description
 * Factory for {@link ui.router.util.type:UrlMatcher `UrlMatcher`} instances. The factory
 * is also available to providers under the name `$urlMatcherFactoryProvider`.
 */
function $UrlMatcherFactory() {
  $$UMFP = this;

  var isCaseInsensitive = false, isStrictMode = true, defaultSquashPolicy = false;

  function valToString(val) { return val != null ? val.toString().replace(/\//g, "%2F") : val; }
  function valFromString(val) { return val != null ? val.toString().replace(/%2F/g, "/") : val; }

  var $types = {}, enqueue = true, typeQueue = [], injector, defaultTypes = {
    string: {
      encode: valToString,
      decode: valFromString,
      // TODO: in 1.0, make string .is() return false if value is undefined/null by default.
      // In 0.2.x, string params are optional by default for backwards compat
      is: function(val) { return val == null || !isDefined(val) || typeof val === "string"; },
      pattern: /[^/]*/
    },
    int: {
      encode: valToString,
      decode: function(val) { return parseInt(val, 10); },
      is: function(val) { return isDefined(val) && this.decode(val.toString()) === val; },
      pattern: /\d+/
    },
    bool: {
      encode: function(val) { return val ? 1 : 0; },
      decode: function(val) { return parseInt(val, 10) !== 0; },
      is: function(val) { return val === true || val === false; },
      pattern: /0|1/
    },
    date: {
      encode: function (val) {
        if (!this.is(val))
          return undefined;
        return [ val.getFullYear(),
          ('0' + (val.getMonth() + 1)).slice(-2),
          ('0' + val.getDate()).slice(-2)
        ].join("-");
      },
      decode: function (val) {
        if (this.is(val)) return val;
        var match = this.capture.exec(val);
        return match ? new Date(match[1], match[2] - 1, match[3]) : undefined;
      },
      is: function(val) { return val instanceof Date && !isNaN(val.valueOf()); },
      equals: function (a, b) { return this.is(a) && this.is(b) && a.toISOString() === b.toISOString(); },
      pattern: /[0-9]{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[1-2][0-9]|3[0-1])/,
      capture: /([0-9]{4})-(0[1-9]|1[0-2])-(0[1-9]|[1-2][0-9]|3[0-1])/
    },
    json: {
      encode: angular.toJson,
      decode: angular.fromJson,
      is: angular.isObject,
      equals: angular.equals,
      pattern: /[^/]*/
    },
    any: { // does not encode/decode
      encode: angular.identity,
      decode: angular.identity,
      equals: angular.equals,
      pattern: /.*/
    }
  };

  function getDefaultConfig() {
    return {
      strict: isStrictMode,
      caseInsensitive: isCaseInsensitive
    };
  }

  function isInjectable(value) {
    return (isFunction(value) || (isArray(value) && isFunction(value[value.length - 1])));
  }

  /**
   * [Internal] Get the default value of a parameter, which may be an injectable function.
   */
  $UrlMatcherFactory.$$getDefaultValue = function(config) {
    if (!isInjectable(config.value)) return config.value;
    if (!injector) throw new Error("Injectable functions cannot be called at configuration time");
    return injector.invoke(config.value);
  };

  /**
   * @ngdoc function
   * @name ui.router.util.$urlMatcherFactory#caseInsensitive
   * @methodOf ui.router.util.$urlMatcherFactory
   *
   * @description
   * Defines whether URL matching should be case sensitive (the default behavior), or not.
   *
   * @param {boolean} value `false` to match URL in a case sensitive manner; otherwise `true`;
   * @returns {boolean} the current value of caseInsensitive
   */
  this.caseInsensitive = function(value) {
    if (isDefined(value))
      isCaseInsensitive = value;
    return isCaseInsensitive;
  };

  /**
   * @ngdoc function
   * @name ui.router.util.$urlMatcherFactory#strictMode
   * @methodOf ui.router.util.$urlMatcherFactory
   *
   * @description
   * Defines whether URLs should match trailing slashes, or not (the default behavior).
   *
   * @param {boolean=} value `false` to match trailing slashes in URLs, otherwise `true`.
   * @returns {boolean} the current value of strictMode
   */
  this.strictMode = function(value) {
    if (isDefined(value))
      isStrictMode = value;
    return isStrictMode;
  };

  /**
   * @ngdoc function
   * @name ui.router.util.$urlMatcherFactory#defaultSquashPolicy
   * @methodOf ui.router.util.$urlMatcherFactory
   *
   * @description
   * Sets the default behavior when generating or matching URLs with default parameter values.
   *
   * @param {string} value A string that defines the default parameter URL squashing behavior.
   *    `nosquash`: When generating an href with a default parameter value, do not squash the parameter value from the URL
   *    `slash`: When generating an href with a default parameter value, squash (remove) the parameter value, and, if the
   *             parameter is surrounded by slashes, squash (remove) one slash from the URL
   *    any other string, e.g. "~": When generating an href with a default parameter value, squash (remove)
   *             the parameter value from the URL and replace it with this string.
   */
  this.defaultSquashPolicy = function(value) {
    if (!isDefined(value)) return defaultSquashPolicy;
    if (value !== true && value !== false && !isString(value))
      throw new Error("Invalid squash policy: " + value + ". Valid policies: false, true, arbitrary-string");
    defaultSquashPolicy = value;
    return value;
  };

  /**
   * @ngdoc function
   * @name ui.router.util.$urlMatcherFactory#compile
   * @methodOf ui.router.util.$urlMatcherFactory
   *
   * @description
   * Creates a {@link ui.router.util.type:UrlMatcher `UrlMatcher`} for the specified pattern.
   *
   * @param {string} pattern  The URL pattern.
   * @param {Object} config  The config object hash.
   * @returns {UrlMatcher}  The UrlMatcher.
   */
  this.compile = function (pattern, config) {
    return new UrlMatcher(pattern, extend(getDefaultConfig(), config));
  };

  /**
   * @ngdoc function
   * @name ui.router.util.$urlMatcherFactory#isMatcher
   * @methodOf ui.router.util.$urlMatcherFactory
   *
   * @description
   * Returns true if the specified object is a `UrlMatcher`, or false otherwise.
   *
   * @param {Object} object  The object to perform the type check against.
   * @returns {Boolean}  Returns `true` if the object matches the `UrlMatcher` interface, by
   *          implementing all the same methods.
   */
  this.isMatcher = function (o) {
    if (!isObject(o)) return false;
    var result = true;

    forEach(UrlMatcher.prototype, function(val, name) {
      if (isFunction(val)) {
        result = result && (isDefined(o[name]) && isFunction(o[name]));
      }
    });
    return result;
  };

  /**
   * @ngdoc function
   * @name ui.router.util.$urlMatcherFactory#type
   * @methodOf ui.router.util.$urlMatcherFactory
   *
   * @description
   * Registers a custom {@link ui.router.util.type:Type `Type`} object that can be used to
   * generate URLs with typed parameters.
   *
   * @param {string} name  The type name.
   * @param {Object|Function} definition   The type definition. See
   *        {@link ui.router.util.type:Type `Type`} for information on the values accepted.
   * @param {Object|Function} definitionFn (optional) A function that is injected before the app
   *        runtime starts.  The result of this function is merged into the existing `definition`.
   *        See {@link ui.router.util.type:Type `Type`} for information on the values accepted.
   *
   * @returns {Object}  Returns `$urlMatcherFactoryProvider`.
   *
   * @example
   * This is a simple example of a custom type that encodes and decodes items from an
   * array, using the array index as the URL-encoded value:
   *
   * <pre>
   * var list = ['John', 'Paul', 'George', 'Ringo'];
   *
   * $urlMatcherFactoryProvider.type('listItem', {
   *   encode: function(item) {
   *     // Represent the list item in the URL using its corresponding index
   *     return list.indexOf(item);
   *   },
   *   decode: function(item) {
   *     // Look up the list item by index
   *     return list[parseInt(item, 10)];
   *   },
   *   is: function(item) {
   *     // Ensure the item is valid by checking to see that it appears
   *     // in the list
   *     return list.indexOf(item) > -1;
   *   }
   * });
   *
   * $stateProvider.state('list', {
   *   url: "/list/{item:listItem}",
   *   controller: function($scope, $stateParams) {
   *     console.log($stateParams.item);
   *   }
   * });
   *
   * // ...
   *
   * // Changes URL to '/list/3', logs "Ringo" to the console
   * $state.go('list', { item: "Ringo" });
   * </pre>
   *
   * This is a more complex example of a type that relies on dependency injection to
   * interact with services, and uses the parameter name from the URL to infer how to
   * handle encoding and decoding parameter values:
   *
   * <pre>
   * // Defines a custom type that gets a value from a service,
   * // where each service gets different types of values from
   * // a backend API:
   * $urlMatcherFactoryProvider.type('dbObject', {}, function(Users, Posts) {
   *
   *   // Matches up services to URL parameter names
   *   var services = {
   *     user: Users,
   *     post: Posts
   *   };
   *
   *   return {
   *     encode: function(object) {
   *       // Represent the object in the URL using its unique ID
   *       return object.id;
   *     },
   *     decode: function(value, key) {
   *       // Look up the object by ID, using the parameter
   *       // name (key) to call the correct service
   *       return services[key].findById(value);
   *     },
   *     is: function(object, key) {
   *       // Check that object is a valid dbObject
   *       return angular.isObject(object) && object.id && services[key];
   *     }
   *     equals: function(a, b) {
   *       // Check the equality of decoded objects by comparing
   *       // their unique IDs
   *       return a.id === b.id;
   *     }
   *   };
   * });
   *
   * // In a config() block, you can then attach URLs with
   * // type-annotated parameters:
   * $stateProvider.state('users', {
   *   url: "/users",
   *   // ...
   * }).state('users.item', {
   *   url: "/{user:dbObject}",
   *   controller: function($scope, $stateParams) {
   *     // $stateParams.user will now be an object returned from
   *     // the Users service
   *   },
   *   // ...
   * });
   * </pre>
   */
  this.type = function (name, definition, definitionFn) {
    if (!isDefined(definition)) return $types[name];
    if ($types.hasOwnProperty(name)) throw new Error("A type named '" + name + "' has already been defined.");

    $types[name] = new Type(extend({ name: name }, definition));
    if (definitionFn) {
      typeQueue.push({ name: name, def: definitionFn });
      if (!enqueue) flushTypeQueue();
    }
    return this;
  };

  // `flushTypeQueue()` waits until `$urlMatcherFactory` is injected before invoking the queued `definitionFn`s
  function flushTypeQueue() {
    while(typeQueue.length) {
      var type = typeQueue.shift();
      if (type.pattern) throw new Error("You cannot override a type's .pattern at runtime.");
      angular.extend($types[type.name], injector.invoke(type.def));
    }
  }

  // Register default types. Store them in the prototype of $types.
  forEach(defaultTypes, function(type, name) { $types[name] = new Type(extend({name: name}, type)); });
  $types = inherit($types, {});

  /* No need to document $get, since it returns this */
  this.$get = ['$injector', function ($injector) {
    injector = $injector;
    enqueue = false;
    flushTypeQueue();

    forEach(defaultTypes, function(type, name) {
      if (!$types[name]) $types[name] = new Type(type);
    });
    return this;
  }];

  this.Param = function Param(id, type, config, location) {
    var self = this;
    config = unwrapShorthand(config);
    type = getType(config, type, location);
    var arrayMode = getArrayMode();
    type = arrayMode ? type.$asArray(arrayMode, location === "search") : type;
    if (type.name === "string" && !arrayMode && location === "path" && config.value === undefined)
      config.value = ""; // for 0.2.x; in 0.3.0+ do not automatically default to ""
    var isOptional = config.value !== undefined;
    var squash = getSquashPolicy(config, isOptional);
    var replace = getReplace(config, arrayMode, isOptional, squash);

    function unwrapShorthand(config) {
      var keys = isObject(config) ? objectKeys(config) : [];
      var isShorthand = indexOf(keys, "value") === -1 && indexOf(keys, "type") === -1 &&
                        indexOf(keys, "squash") === -1 && indexOf(keys, "array") === -1;
      if (isShorthand) config = { value: config };
      config.$$fn = isInjectable(config.value) ? config.value : function () { return config.value; };
      return config;
    }

    function getType(config, urlType, location) {
      if (config.type && urlType) throw new Error("Param '"+id+"' has two type configurations.");
      if (urlType) return urlType;
      if (!config.type) return (location === "config" ? $types.any : $types.string);
      return config.type instanceof Type ? config.type : new Type(config.type);
    }

    // array config: param name (param[]) overrides default settings.  explicit config overrides param name.
    function getArrayMode() {
      var arrayDefaults = { array: (location === "search" ? "auto" : false) };
      var arrayParamNomenclature = id.match(/\[\]$/) ? { array: true } : {};
      return extend(arrayDefaults, arrayParamNomenclature, config).array;
    }

    /**
     * returns false, true, or the squash value to indicate the "default parameter url squash policy".
     */
    function getSquashPolicy(config, isOptional) {
      var squash = config.squash;
      if (!isOptional || squash === false) return false;
      if (!isDefined(squash) || squash == null) return defaultSquashPolicy;
      if (squash === true || isString(squash)) return squash;
      throw new Error("Invalid squash policy: '" + squash + "'. Valid policies: false, true, or arbitrary string");
    }

    function getReplace(config, arrayMode, isOptional, squash) {
      var replace, configuredKeys, defaultPolicy = [
        { from: "",   to: (isOptional || arrayMode ? undefined : "") },
        { from: null, to: (isOptional || arrayMode ? undefined : "") }
      ];
      replace = isArray(config.replace) ? config.replace : [];
      if (isString(squash))
        replace.push({ from: squash, to: undefined });
      configuredKeys = map(replace, function(item) { return item.from; } );
      return filter(defaultPolicy, function(item) { return indexOf(configuredKeys, item.from) === -1; }).concat(replace);
    }

    /**
     * [Internal] Get the default value of a parameter, which may be an injectable function.
     */
    function $$getDefaultValue() {
      if (!injector) throw new Error("Injectable functions cannot be called at configuration time");
      var defaultValue = injector.invoke(config.$$fn);
      if (defaultValue !== null && defaultValue !== undefined && !self.type.is(defaultValue))
        throw new Error("Default value (" + defaultValue + ") for parameter '" + self.id + "' is not an instance of Type (" + self.type.name + ")");
      return defaultValue;
    }

    /**
     * [Internal] Gets the decoded representation of a value if the value is defined, otherwise, returns the
     * default value, which may be the result of an injectable function.
     */
    function $value(value) {
      function hasReplaceVal(val) { return function(obj) { return obj.from === val; }; }
      function $replace(value) {
        var replacement = map(filter(self.replace, hasReplaceVal(value)), function(obj) { return obj.to; });
        return replacement.length ? replacement[0] : value;
      }
      value = $replace(value);
      return !isDefined(value) ? $$getDefaultValue() : self.type.$normalize(value);
    }

    function toString() { return "{Param:" + id + " " + type + " squash: '" + squash + "' optional: " + isOptional + "}"; }

    extend(this, {
      id: id,
      type: type,
      location: location,
      array: arrayMode,
      squash: squash,
      replace: replace,
      isOptional: isOptional,
      value: $value,
      dynamic: undefined,
      config: config,
      toString: toString
    });
  };

  function ParamSet(params) {
    extend(this, params || {});
  }

  ParamSet.prototype = {
    $$new: function() {
      return inherit(this, extend(new ParamSet(), { $$parent: this}));
    },
    $$keys: function () {
      var keys = [], chain = [], parent = this,
        ignore = objectKeys(ParamSet.prototype);
      while (parent) { chain.push(parent); parent = parent.$$parent; }
      chain.reverse();
      forEach(chain, function(paramset) {
        forEach(objectKeys(paramset), function(key) {
            if (indexOf(keys, key) === -1 && indexOf(ignore, key) === -1) keys.push(key);
        });
      });
      return keys;
    },
    $$values: function(paramValues) {
      var values = {}, self = this;
      forEach(self.$$keys(), function(key) {
        values[key] = self[key].value(paramValues && paramValues[key]);
      });
      return values;
    },
    $$equals: function(paramValues1, paramValues2) {
      var equal = true, self = this;
      forEach(self.$$keys(), function(key) {
        var left = paramValues1 && paramValues1[key], right = paramValues2 && paramValues2[key];
        if (!self[key].type.equals(left, right)) equal = false;
      });
      return equal;
    },
    $$validates: function $$validate(paramValues) {
      var keys = this.$$keys(), i, param, rawVal, normalized, encoded;
      for (i = 0; i < keys.length; i++) {
        param = this[keys[i]];
        rawVal = paramValues[keys[i]];
        if ((rawVal === undefined || rawVal === null) && param.isOptional)
          break; // There was no parameter value, but the param is optional
        normalized = param.type.$normalize(rawVal);
        if (!param.type.is(normalized))
          return false; // The value was not of the correct Type, and could not be decoded to the correct Type
        encoded = param.type.encode(normalized);
        if (angular.isString(encoded) && !param.type.pattern.exec(encoded))
          return false; // The value was of the correct type, but when encoded, did not match the Type's regexp
      }
      return true;
    },
    $$parent: undefined
  };

  this.ParamSet = ParamSet;
}

// Register as a provider so it's available to other providers
angular.module('ui.router.util').provider('$urlMatcherFactory', $UrlMatcherFactory);
angular.module('ui.router.util').run(['$urlMatcherFactory', function($urlMatcherFactory) { }]);

//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiIiwic291cmNlcyI6WyJhbmd1bGFyLXVpLXJvdXRlci9zcmMvdXJsTWF0Y2hlckZhY3RvcnkuanMiXSwic291cmNlc0NvbnRlbnQiOlsidmFyICQkVU1GUDsgLy8gcmVmZXJlbmNlIHRvICRVcmxNYXRjaGVyRmFjdG9yeVByb3ZpZGVyXG5cbi8qKlxuICogQG5nZG9jIG9iamVjdFxuICogQG5hbWUgdWkucm91dGVyLnV0aWwudHlwZTpVcmxNYXRjaGVyXG4gKlxuICogQGRlc2NyaXB0aW9uXG4gKiBNYXRjaGVzIFVSTHMgYWdhaW5zdCBwYXR0ZXJucyBhbmQgZXh0cmFjdHMgbmFtZWQgcGFyYW1ldGVycyBmcm9tIHRoZSBwYXRoIG9yIHRoZSBzZWFyY2hcbiAqIHBhcnQgb2YgdGhlIFVSTC4gQSBVUkwgcGF0dGVybiBjb25zaXN0cyBvZiBhIHBhdGggcGF0dGVybiwgb3B0aW9uYWxseSBmb2xsb3dlZCBieSAnPycgYW5kIGEgbGlzdFxuICogb2Ygc2VhcmNoIHBhcmFtZXRlcnMuIE11bHRpcGxlIHNlYXJjaCBwYXJhbWV0ZXIgbmFtZXMgYXJlIHNlcGFyYXRlZCBieSAnJicuIFNlYXJjaCBwYXJhbWV0ZXJzXG4gKiBkbyBub3QgaW5mbHVlbmNlIHdoZXRoZXIgb3Igbm90IGEgVVJMIGlzIG1hdGNoZWQsIGJ1dCB0aGVpciB2YWx1ZXMgYXJlIHBhc3NlZCB0aHJvdWdoIGludG9cbiAqIHRoZSBtYXRjaGVkIHBhcmFtZXRlcnMgcmV0dXJuZWQgYnkge0BsaW5rIHVpLnJvdXRlci51dGlsLnR5cGU6VXJsTWF0Y2hlciNtZXRob2RzX2V4ZWMgZXhlY30uXG4gKlxuICogUGF0aCBwYXJhbWV0ZXIgcGxhY2Vob2xkZXJzIGNhbiBiZSBzcGVjaWZpZWQgdXNpbmcgc2ltcGxlIGNvbG9uL2NhdGNoLWFsbCBzeW50YXggb3IgY3VybHkgYnJhY2VcbiAqIHN5bnRheCwgd2hpY2ggb3B0aW9uYWxseSBhbGxvd3MgYSByZWd1bGFyIGV4cHJlc3Npb24gZm9yIHRoZSBwYXJhbWV0ZXIgdG8gYmUgc3BlY2lmaWVkOlxuICpcbiAqICogYCc6J2AgbmFtZSAtIGNvbG9uIHBsYWNlaG9sZGVyXG4gKiAqIGAnKidgIG5hbWUgLSBjYXRjaC1hbGwgcGxhY2Vob2xkZXJcbiAqICogYCd7JyBuYW1lICd9J2AgLSBjdXJseSBwbGFjZWhvbGRlclxuICogKiBgJ3snIG5hbWUgJzonIHJlZ2V4cHx0eXBlICd9J2AgLSBjdXJseSBwbGFjZWhvbGRlciB3aXRoIHJlZ2V4cCBvciB0eXBlIG5hbWUuIFNob3VsZCB0aGVcbiAqICAgcmVnZXhwIGl0c2VsZiBjb250YWluIGN1cmx5IGJyYWNlcywgdGhleSBtdXN0IGJlIGluIG1hdGNoZWQgcGFpcnMgb3IgZXNjYXBlZCB3aXRoIGEgYmFja3NsYXNoLlxuICpcbiAqIFBhcmFtZXRlciBuYW1lcyBtYXkgY29udGFpbiBvbmx5IHdvcmQgY2hhcmFjdGVycyAobGF0aW4gbGV0dGVycywgZGlnaXRzLCBhbmQgdW5kZXJzY29yZSkgYW5kXG4gKiBtdXN0IGJlIHVuaXF1ZSB3aXRoaW4gdGhlIHBhdHRlcm4gKGFjcm9zcyBib3RoIHBhdGggYW5kIHNlYXJjaCBwYXJhbWV0ZXJzKS4gRm9yIGNvbG9uXG4gKiBwbGFjZWhvbGRlcnMgb3IgY3VybHkgcGxhY2Vob2xkZXJzIHdpdGhvdXQgYW4gZXhwbGljaXQgcmVnZXhwLCBhIHBhdGggcGFyYW1ldGVyIG1hdGNoZXMgYW55XG4gKiBudW1iZXIgb2YgY2hhcmFjdGVycyBvdGhlciB0aGFuICcvJy4gRm9yIGNhdGNoLWFsbCBwbGFjZWhvbGRlcnMgdGhlIHBhdGggcGFyYW1ldGVyIG1hdGNoZXNcbiAqIGFueSBudW1iZXIgb2YgY2hhcmFjdGVycy5cbiAqXG4gKiBFeGFtcGxlczpcbiAqXG4gKiAqIGAnL2hlbGxvLydgIC0gTWF0Y2hlcyBvbmx5IGlmIHRoZSBwYXRoIGlzIGV4YWN0bHkgJy9oZWxsby8nLiBUaGVyZSBpcyBubyBzcGVjaWFsIHRyZWF0bWVudCBmb3JcbiAqICAgdHJhaWxpbmcgc2xhc2hlcywgYW5kIHBhdHRlcm5zIGhhdmUgdG8gbWF0Y2ggdGhlIGVudGlyZSBwYXRoLCBub3QganVzdCBhIHByZWZpeC5cbiAqICogYCcvdXNlci86aWQnYCAtIE1hdGNoZXMgJy91c2VyL2JvYicgb3IgJy91c2VyLzEyMzQhISEnIG9yIGV2ZW4gJy91c2VyLycgYnV0IG5vdCAnL3VzZXInIG9yXG4gKiAgICcvdXNlci9ib2IvZGV0YWlscycuIFRoZSBzZWNvbmQgcGF0aCBzZWdtZW50IHdpbGwgYmUgY2FwdHVyZWQgYXMgdGhlIHBhcmFtZXRlciAnaWQnLlxuICogKiBgJy91c2VyL3tpZH0nYCAtIFNhbWUgYXMgdGhlIHByZXZpb3VzIGV4YW1wbGUsIGJ1dCB1c2luZyBjdXJseSBicmFjZSBzeW50YXguXG4gKiAqIGAnL3VzZXIve2lkOlteL10qfSdgIC0gU2FtZSBhcyB0aGUgcHJldmlvdXMgZXhhbXBsZS5cbiAqICogYCcvdXNlci97aWQ6WzAtOWEtZkEtRl17MSw4fX0nYCAtIFNpbWlsYXIgdG8gdGhlIHByZXZpb3VzIGV4YW1wbGUsIGJ1dCBvbmx5IG1hdGNoZXMgaWYgdGhlIGlkXG4gKiAgIHBhcmFtZXRlciBjb25zaXN0cyBvZiAxIHRvIDggaGV4IGRpZ2l0cy5cbiAqICogYCcvZmlsZXMve3BhdGg6Lip9J2AgLSBNYXRjaGVzIGFueSBVUkwgc3RhcnRpbmcgd2l0aCAnL2ZpbGVzLycgYW5kIGNhcHR1cmVzIHRoZSByZXN0IG9mIHRoZVxuICogICBwYXRoIGludG8gdGhlIHBhcmFtZXRlciAncGF0aCcuXG4gKiAqIGAnL2ZpbGVzLypwYXRoJ2AgLSBkaXR0by5cbiAqICogYCcvY2FsZW5kYXIve3N0YXJ0OmRhdGV9J2AgLSBNYXRjaGVzIFwiL2NhbGVuZGFyLzIwMTQtMTEtMTJcIiAoYmVjYXVzZSB0aGUgcGF0dGVybiBkZWZpbmVkXG4gKiAgIGluIHRoZSBidWlsdC1pbiAgYGRhdGVgIFR5cGUgbWF0Y2hlcyBgMjAxNC0xMS0xMmApIGFuZCBwcm92aWRlcyBhIERhdGUgb2JqZWN0IGluICRzdGF0ZVBhcmFtcy5zdGFydFxuICpcbiAqIEBwYXJhbSB7c3RyaW5nfSBwYXR0ZXJuICBUaGUgcGF0dGVybiB0byBjb21waWxlIGludG8gYSBtYXRjaGVyLlxuICogQHBhcmFtIHtPYmplY3R9IGNvbmZpZyAgQSBjb25maWd1cmF0aW9uIG9iamVjdCBoYXNoOlxuICogQHBhcmFtIHtPYmplY3Q9fSBwYXJlbnRNYXRjaGVyIFVzZWQgdG8gY29uY2F0ZW5hdGUgdGhlIHBhdHRlcm4vY29uZmlnIG9udG9cbiAqICAgYW4gZXhpc3RpbmcgVXJsTWF0Y2hlclxuICpcbiAqICogYGNhc2VJbnNlbnNpdGl2ZWAgLSBgdHJ1ZWAgaWYgVVJMIG1hdGNoaW5nIHNob3VsZCBiZSBjYXNlIGluc2Vuc2l0aXZlLCBvdGhlcndpc2UgYGZhbHNlYCwgdGhlIGRlZmF1bHQgdmFsdWUgKGZvciBiYWNrd2FyZCBjb21wYXRpYmlsaXR5KSBpcyBgZmFsc2VgLlxuICogKiBgc3RyaWN0YCAtIGBmYWxzZWAgaWYgbWF0Y2hpbmcgYWdhaW5zdCBhIFVSTCB3aXRoIGEgdHJhaWxpbmcgc2xhc2ggc2hvdWxkIGJlIHRyZWF0ZWQgYXMgZXF1aXZhbGVudCB0byBhIFVSTCB3aXRob3V0IGEgdHJhaWxpbmcgc2xhc2gsIHRoZSBkZWZhdWx0IHZhbHVlIGlzIGB0cnVlYC5cbiAqXG4gKiBAcHJvcGVydHkge3N0cmluZ30gcHJlZml4ICBBIHN0YXRpYyBwcmVmaXggb2YgdGhpcyBwYXR0ZXJuLiBUaGUgbWF0Y2hlciBndWFyYW50ZWVzIHRoYXQgYW55XG4gKiAgIFVSTCBtYXRjaGluZyB0aGlzIG1hdGNoZXIgKGkuZS4gYW55IHN0cmluZyBmb3Igd2hpY2gge0BsaW5rIHVpLnJvdXRlci51dGlsLnR5cGU6VXJsTWF0Y2hlciNtZXRob2RzX2V4ZWMgZXhlYygpfSByZXR1cm5zXG4gKiAgIG5vbi1udWxsKSB3aWxsIHN0YXJ0IHdpdGggdGhpcyBwcmVmaXguXG4gKlxuICogQHByb3BlcnR5IHtzdHJpbmd9IHNvdXJjZSAgVGhlIHBhdHRlcm4gdGhhdCB3YXMgcGFzc2VkIGludG8gdGhlIGNvbnN0cnVjdG9yXG4gKlxuICogQHByb3BlcnR5IHtzdHJpbmd9IHNvdXJjZVBhdGggIFRoZSBwYXRoIHBvcnRpb24gb2YgdGhlIHNvdXJjZSBwcm9wZXJ0eVxuICpcbiAqIEBwcm9wZXJ0eSB7c3RyaW5nfSBzb3VyY2VTZWFyY2ggIFRoZSBzZWFyY2ggcG9ydGlvbiBvZiB0aGUgc291cmNlIHByb3BlcnR5XG4gKlxuICogQHByb3BlcnR5IHtzdHJpbmd9IHJlZ2V4ICBUaGUgY29uc3RydWN0ZWQgcmVnZXggdGhhdCB3aWxsIGJlIHVzZWQgdG8gbWF0Y2ggYWdhaW5zdCB0aGUgdXJsIHdoZW5cbiAqICAgaXQgaXMgdGltZSB0byBkZXRlcm1pbmUgd2hpY2ggdXJsIHdpbGwgbWF0Y2guXG4gKlxuICogQHJldHVybnMge09iamVjdH0gIE5ldyBgVXJsTWF0Y2hlcmAgb2JqZWN0XG4gKi9cbmZ1bmN0aW9uIFVybE1hdGNoZXIocGF0dGVybiwgY29uZmlnLCBwYXJlbnRNYXRjaGVyKSB7XG4gIGNvbmZpZyA9IGV4dGVuZCh7IHBhcmFtczoge30gfSwgaXNPYmplY3QoY29uZmlnKSA/IGNvbmZpZyA6IHt9KTtcblxuICAvLyBGaW5kIGFsbCBwbGFjZWhvbGRlcnMgYW5kIGNyZWF0ZSBhIGNvbXBpbGVkIHBhdHRlcm4sIHVzaW5nIGVpdGhlciBjbGFzc2ljIG9yIGN1cmx5IHN5bnRheDpcbiAgLy8gICAnKicgbmFtZVxuICAvLyAgICc6JyBuYW1lXG4gIC8vICAgJ3snIG5hbWUgJ30nXG4gIC8vICAgJ3snIG5hbWUgJzonIHJlZ2V4cCAnfSdcbiAgLy8gVGhlIHJlZ3VsYXIgZXhwcmVzc2lvbiBpcyBzb21ld2hhdCBjb21wbGljYXRlZCBkdWUgdG8gdGhlIG5lZWQgdG8gYWxsb3cgY3VybHkgYnJhY2VzXG4gIC8vIGluc2lkZSB0aGUgcmVndWxhciBleHByZXNzaW9uLiBUaGUgcGxhY2Vob2xkZXIgcmVnZXhwIGJyZWFrcyBkb3duIGFzIGZvbGxvd3M6XG4gIC8vICAgIChbOipdKShbXFx3XFxbXFxdXSspICAgICAgICAgICAgICAtIGNsYXNzaWMgcGxhY2Vob2xkZXIgKCQxIC8gJDIpIChzZWFyY2ggdmVyc2lvbiBoYXMgLSBmb3Igc25ha2UtY2FzZSlcbiAgLy8gICAgXFx7KFtcXHdcXFtcXF1dKykoPzpcXDooIC4uLiApKT9cXH0gIC0gY3VybHkgYnJhY2UgcGxhY2Vob2xkZXIgKCQzKSB3aXRoIG9wdGlvbmFsIHJlZ2V4cC90eXBlIC4uLiAoJDQpIChzZWFyY2ggdmVyc2lvbiBoYXMgLSBmb3Igc25ha2UtY2FzZVxuICAvLyAgICAoPzogLi4uIHwgLi4uIHwgLi4uICkrICAgICAgICAgLSB0aGUgcmVnZXhwIGNvbnNpc3RzIG9mIGFueSBudW1iZXIgb2YgYXRvbXMsIGFuIGF0b20gYmVpbmcgZWl0aGVyXG4gIC8vICAgIFtee31cXFxcXSsgICAgICAgICAgICAgICAgICAgICAgIC0gYW55dGhpbmcgb3RoZXIgdGhhbiBjdXJseSBicmFjZXMgb3IgYmFja3NsYXNoXG4gIC8vICAgIFxcXFwuICAgICAgICAgICAgICAgICAgICAgICAgICAgIC0gYSBiYWNrc2xhc2ggZXNjYXBlXG4gIC8vICAgIFxceyg/Oltee31cXFxcXSt8XFxcXC4pKlxcfSAgICAgICAgICAtIGEgbWF0Y2hlZCBzZXQgb2YgY3VybHkgYnJhY2VzIGNvbnRhaW5pbmcgb3RoZXIgYXRvbXNcbiAgdmFyIHBsYWNlaG9sZGVyICAgICAgID0gLyhbOipdKShbXFx3XFxbXFxdXSspfFxceyhbXFx3XFxbXFxdXSspKD86XFw6KCg/Oltee31cXFxcXSt8XFxcXC58XFx7KD86W157fVxcXFxdK3xcXFxcLikqXFx9KSspKT9cXH0vZyxcbiAgICAgIHNlYXJjaFBsYWNlaG9sZGVyID0gLyhbOl0/KShbXFx3XFxbXFxdLV0rKXxcXHsoW1xcd1xcW1xcXS1dKykoPzpcXDooKD86W157fVxcXFxdK3xcXFxcLnxcXHsoPzpbXnt9XFxcXF0rfFxcXFwuKSpcXH0pKykpP1xcfS9nLFxuICAgICAgY29tcGlsZWQgPSAnXicsIGxhc3QgPSAwLCBtLFxuICAgICAgc2VnbWVudHMgPSB0aGlzLnNlZ21lbnRzID0gW10sXG4gICAgICBwYXJlbnRQYXJhbXMgPSBwYXJlbnRNYXRjaGVyID8gcGFyZW50TWF0Y2hlci5wYXJhbXMgOiB7fSxcbiAgICAgIHBhcmFtcyA9IHRoaXMucGFyYW1zID0gcGFyZW50TWF0Y2hlciA/IHBhcmVudE1hdGNoZXIucGFyYW1zLiQkbmV3KCkgOiBuZXcgJCRVTUZQLlBhcmFtU2V0KCksXG4gICAgICBwYXJhbU5hbWVzID0gW107XG5cbiAgZnVuY3Rpb24gYWRkUGFyYW1ldGVyKGlkLCB0eXBlLCBjb25maWcsIGxvY2F0aW9uKSB7XG4gICAgcGFyYW1OYW1lcy5wdXNoKGlkKTtcbiAgICBpZiAocGFyZW50UGFyYW1zW2lkXSkgcmV0dXJuIHBhcmVudFBhcmFtc1tpZF07XG4gICAgaWYgKCEvXlxcdysoLStcXHcrKSooPzpcXFtcXF0pPyQvLnRlc3QoaWQpKSB0aHJvdyBuZXcgRXJyb3IoXCJJbnZhbGlkIHBhcmFtZXRlciBuYW1lICdcIiArIGlkICsgXCInIGluIHBhdHRlcm4gJ1wiICsgcGF0dGVybiArIFwiJ1wiKTtcbiAgICBpZiAocGFyYW1zW2lkXSkgdGhyb3cgbmV3IEVycm9yKFwiRHVwbGljYXRlIHBhcmFtZXRlciBuYW1lICdcIiArIGlkICsgXCInIGluIHBhdHRlcm4gJ1wiICsgcGF0dGVybiArIFwiJ1wiKTtcbiAgICBwYXJhbXNbaWRdID0gbmV3ICQkVU1GUC5QYXJhbShpZCwgdHlwZSwgY29uZmlnLCBsb2NhdGlvbik7XG4gICAgcmV0dXJuIHBhcmFtc1tpZF07XG4gIH1cblxuICBmdW5jdGlvbiBxdW90ZVJlZ0V4cChzdHJpbmcsIHBhdHRlcm4sIHNxdWFzaCwgb3B0aW9uYWwpIHtcbiAgICB2YXIgc3Vycm91bmRQYXR0ZXJuID0gWycnLCcnXSwgcmVzdWx0ID0gc3RyaW5nLnJlcGxhY2UoL1tcXFxcXFxbXFxdXFxeJCorPy4oKXx7fV0vZywgXCJcXFxcJCZcIik7XG4gICAgaWYgKCFwYXR0ZXJuKSByZXR1cm4gcmVzdWx0O1xuICAgIHN3aXRjaChzcXVhc2gpIHtcbiAgICAgIGNhc2UgZmFsc2U6IHN1cnJvdW5kUGF0dGVybiA9IFsnKCcsICcpJyArIChvcHRpb25hbCA/IFwiP1wiIDogXCJcIildOyBicmVhaztcbiAgICAgIGNhc2UgdHJ1ZTogIHN1cnJvdW5kUGF0dGVybiA9IFsnPygnLCAnKT8nXTsgYnJlYWs7XG4gICAgICBkZWZhdWx0OiAgICBzdXJyb3VuZFBhdHRlcm4gPSBbJygnICsgc3F1YXNoICsgXCJ8XCIsICcpPyddOyBicmVhaztcbiAgICB9XG4gICAgcmV0dXJuIHJlc3VsdCArIHN1cnJvdW5kUGF0dGVyblswXSArIHBhdHRlcm4gKyBzdXJyb3VuZFBhdHRlcm5bMV07XG4gIH1cblxuICB0aGlzLnNvdXJjZSA9IHBhdHRlcm47XG5cbiAgLy8gU3BsaXQgaW50byBzdGF0aWMgc2VnbWVudHMgc2VwYXJhdGVkIGJ5IHBhdGggcGFyYW1ldGVyIHBsYWNlaG9sZGVycy5cbiAgLy8gVGhlIG51bWJlciBvZiBzZWdtZW50cyBpcyBhbHdheXMgMSBtb3JlIHRoYW4gdGhlIG51bWJlciBvZiBwYXJhbWV0ZXJzLlxuICBmdW5jdGlvbiBtYXRjaERldGFpbHMobSwgaXNTZWFyY2gpIHtcbiAgICB2YXIgaWQsIHJlZ2V4cCwgc2VnbWVudCwgdHlwZSwgY2ZnLCBhcnJheU1vZGU7XG4gICAgaWQgICAgICAgICAgPSBtWzJdIHx8IG1bM107IC8vIElFWzc4XSByZXR1cm5zICcnIGZvciB1bm1hdGNoZWQgZ3JvdXBzIGluc3RlYWQgb2YgbnVsbFxuICAgIGNmZyAgICAgICAgID0gY29uZmlnLnBhcmFtc1tpZF07XG4gICAgc2VnbWVudCAgICAgPSBwYXR0ZXJuLnN1YnN0cmluZyhsYXN0LCBtLmluZGV4KTtcbiAgICByZWdleHAgICAgICA9IGlzU2VhcmNoID8gbVs0XSA6IG1bNF0gfHwgKG1bMV0gPT0gJyonID8gJy4qJyA6IG51bGwpO1xuICAgIHR5cGUgICAgICAgID0gJCRVTUZQLnR5cGUocmVnZXhwIHx8IFwic3RyaW5nXCIpIHx8IGluaGVyaXQoJCRVTUZQLnR5cGUoXCJzdHJpbmdcIiksIHsgcGF0dGVybjogbmV3IFJlZ0V4cChyZWdleHAsIGNvbmZpZy5jYXNlSW5zZW5zaXRpdmUgPyAnaScgOiB1bmRlZmluZWQpIH0pO1xuICAgIHJldHVybiB7XG4gICAgICBpZDogaWQsIHJlZ2V4cDogcmVnZXhwLCBzZWdtZW50OiBzZWdtZW50LCB0eXBlOiB0eXBlLCBjZmc6IGNmZ1xuICAgIH07XG4gIH1cblxuICB2YXIgcCwgcGFyYW0sIHNlZ21lbnQ7XG4gIHdoaWxlICgobSA9IHBsYWNlaG9sZGVyLmV4ZWMocGF0dGVybikpKSB7XG4gICAgcCA9IG1hdGNoRGV0YWlscyhtLCBmYWxzZSk7XG4gICAgaWYgKHAuc2VnbWVudC5pbmRleE9mKCc/JykgPj0gMCkgYnJlYWs7IC8vIHdlJ3JlIGludG8gdGhlIHNlYXJjaCBwYXJ0XG5cbiAgICBwYXJhbSA9IGFkZFBhcmFtZXRlcihwLmlkLCBwLnR5cGUsIHAuY2ZnLCBcInBhdGhcIik7XG4gICAgY29tcGlsZWQgKz0gcXVvdGVSZWdFeHAocC5zZWdtZW50LCBwYXJhbS50eXBlLnBhdHRlcm4uc291cmNlLCBwYXJhbS5zcXVhc2gsIHBhcmFtLmlzT3B0aW9uYWwpO1xuICAgIHNlZ21lbnRzLnB1c2gocC5zZWdtZW50KTtcbiAgICBsYXN0ID0gcGxhY2Vob2xkZXIubGFzdEluZGV4O1xuICB9XG4gIHNlZ21lbnQgPSBwYXR0ZXJuLnN1YnN0cmluZyhsYXN0KTtcblxuICAvLyBGaW5kIGFueSBzZWFyY2ggcGFyYW1ldGVyIG5hbWVzIGFuZCByZW1vdmUgdGhlbSBmcm9tIHRoZSBsYXN0IHNlZ21lbnRcbiAgdmFyIGkgPSBzZWdtZW50LmluZGV4T2YoJz8nKTtcblxuICBpZiAoaSA+PSAwKSB7XG4gICAgdmFyIHNlYXJjaCA9IHRoaXMuc291cmNlU2VhcmNoID0gc2VnbWVudC5zdWJzdHJpbmcoaSk7XG4gICAgc2VnbWVudCA9IHNlZ21lbnQuc3Vic3RyaW5nKDAsIGkpO1xuICAgIHRoaXMuc291cmNlUGF0aCA9IHBhdHRlcm4uc3Vic3RyaW5nKDAsIGxhc3QgKyBpKTtcblxuICAgIGlmIChzZWFyY2gubGVuZ3RoID4gMCkge1xuICAgICAgbGFzdCA9IDA7XG4gICAgICB3aGlsZSAoKG0gPSBzZWFyY2hQbGFjZWhvbGRlci5leGVjKHNlYXJjaCkpKSB7XG4gICAgICAgIHAgPSBtYXRjaERldGFpbHMobSwgdHJ1ZSk7XG4gICAgICAgIHBhcmFtID0gYWRkUGFyYW1ldGVyKHAuaWQsIHAudHlwZSwgcC5jZmcsIFwic2VhcmNoXCIpO1xuICAgICAgICBsYXN0ID0gcGxhY2Vob2xkZXIubGFzdEluZGV4O1xuICAgICAgICAvLyBjaGVjayBpZiA/JlxuICAgICAgfVxuICAgIH1cbiAgfSBlbHNlIHtcbiAgICB0aGlzLnNvdXJjZVBhdGggPSBwYXR0ZXJuO1xuICAgIHRoaXMuc291cmNlU2VhcmNoID0gJyc7XG4gIH1cblxuICBjb21waWxlZCArPSBxdW90ZVJlZ0V4cChzZWdtZW50KSArIChjb25maWcuc3RyaWN0ID09PSBmYWxzZSA/ICdcXC8/JyA6ICcnKSArICckJztcbiAgc2VnbWVudHMucHVzaChzZWdtZW50KTtcblxuICB0aGlzLnJlZ2V4cCA9IG5ldyBSZWdFeHAoY29tcGlsZWQsIGNvbmZpZy5jYXNlSW5zZW5zaXRpdmUgPyAnaScgOiB1bmRlZmluZWQpO1xuICB0aGlzLnByZWZpeCA9IHNlZ21lbnRzWzBdO1xuICB0aGlzLiQkcGFyYW1OYW1lcyA9IHBhcmFtTmFtZXM7XG59XG5cbi8qKlxuICogQG5nZG9jIGZ1bmN0aW9uXG4gKiBAbmFtZSB1aS5yb3V0ZXIudXRpbC50eXBlOlVybE1hdGNoZXIjY29uY2F0XG4gKiBAbWV0aG9kT2YgdWkucm91dGVyLnV0aWwudHlwZTpVcmxNYXRjaGVyXG4gKlxuICogQGRlc2NyaXB0aW9uXG4gKiBSZXR1cm5zIGEgbmV3IG1hdGNoZXIgZm9yIGEgcGF0dGVybiBjb25zdHJ1Y3RlZCBieSBhcHBlbmRpbmcgdGhlIHBhdGggcGFydCBhbmQgYWRkaW5nIHRoZVxuICogc2VhcmNoIHBhcmFtZXRlcnMgb2YgdGhlIHNwZWNpZmllZCBwYXR0ZXJuIHRvIHRoaXMgcGF0dGVybi4gVGhlIGN1cnJlbnQgcGF0dGVybiBpcyBub3RcbiAqIG1vZGlmaWVkLiBUaGlzIGNhbiBiZSB1bmRlcnN0b29kIGFzIGNyZWF0aW5nIGEgcGF0dGVybiBmb3IgVVJMcyB0aGF0IGFyZSByZWxhdGl2ZSB0byAob3JcbiAqIHN1ZmZpeGVzIG9mKSB0aGUgY3VycmVudCBwYXR0ZXJuLlxuICpcbiAqIEBleGFtcGxlXG4gKiBUaGUgZm9sbG93aW5nIHR3byBtYXRjaGVycyBhcmUgZXF1aXZhbGVudDpcbiAqIDxwcmU+XG4gKiBuZXcgVXJsTWF0Y2hlcignL3VzZXIve2lkfT9xJykuY29uY2F0KCcvZGV0YWlscz9kYXRlJyk7XG4gKiBuZXcgVXJsTWF0Y2hlcignL3VzZXIve2lkfS9kZXRhaWxzP3EmZGF0ZScpO1xuICogPC9wcmU+XG4gKlxuICogQHBhcmFtIHtzdHJpbmd9IHBhdHRlcm4gIFRoZSBwYXR0ZXJuIHRvIGFwcGVuZC5cbiAqIEBwYXJhbSB7T2JqZWN0fSBjb25maWcgIEFuIG9iamVjdCBoYXNoIG9mIHRoZSBjb25maWd1cmF0aW9uIGZvciB0aGUgbWF0Y2hlci5cbiAqIEByZXR1cm5zIHtVcmxNYXRjaGVyfSAgQSBtYXRjaGVyIGZvciB0aGUgY29uY2F0ZW5hdGVkIHBhdHRlcm4uXG4gKi9cblVybE1hdGNoZXIucHJvdG90eXBlLmNvbmNhdCA9IGZ1bmN0aW9uIChwYXR0ZXJuLCBjb25maWcpIHtcbiAgLy8gQmVjYXVzZSBvcmRlciBvZiBzZWFyY2ggcGFyYW1ldGVycyBpcyBpcnJlbGV2YW50LCB3ZSBjYW4gYWRkIG91ciBvd24gc2VhcmNoXG4gIC8vIHBhcmFtZXRlcnMgdG8gdGhlIGVuZCBvZiB0aGUgbmV3IHBhdHRlcm4uIFBhcnNlIHRoZSBuZXcgcGF0dGVybiBieSBpdHNlbGZcbiAgLy8gYW5kIHRoZW4gam9pbiB0aGUgYml0cyB0b2dldGhlciwgYnV0IGl0J3MgbXVjaCBlYXNpZXIgdG8gZG8gdGhpcyBvbiBhIHN0cmluZyBsZXZlbC5cbiAgdmFyIGRlZmF1bHRDb25maWcgPSB7XG4gICAgY2FzZUluc2Vuc2l0aXZlOiAkJFVNRlAuY2FzZUluc2Vuc2l0aXZlKCksXG4gICAgc3RyaWN0OiAkJFVNRlAuc3RyaWN0TW9kZSgpLFxuICAgIHNxdWFzaDogJCRVTUZQLmRlZmF1bHRTcXVhc2hQb2xpY3koKVxuICB9O1xuICByZXR1cm4gbmV3IFVybE1hdGNoZXIodGhpcy5zb3VyY2VQYXRoICsgcGF0dGVybiArIHRoaXMuc291cmNlU2VhcmNoLCBleHRlbmQoZGVmYXVsdENvbmZpZywgY29uZmlnKSwgdGhpcyk7XG59O1xuXG5VcmxNYXRjaGVyLnByb3RvdHlwZS50b1N0cmluZyA9IGZ1bmN0aW9uICgpIHtcbiAgcmV0dXJuIHRoaXMuc291cmNlO1xufTtcblxuLyoqXG4gKiBAbmdkb2MgZnVuY3Rpb25cbiAqIEBuYW1lIHVpLnJvdXRlci51dGlsLnR5cGU6VXJsTWF0Y2hlciNleGVjXG4gKiBAbWV0aG9kT2YgdWkucm91dGVyLnV0aWwudHlwZTpVcmxNYXRjaGVyXG4gKlxuICogQGRlc2NyaXB0aW9uXG4gKiBUZXN0cyB0aGUgc3BlY2lmaWVkIHBhdGggYWdhaW5zdCB0aGlzIG1hdGNoZXIsIGFuZCByZXR1cm5zIGFuIG9iamVjdCBjb250YWluaW5nIHRoZSBjYXB0dXJlZFxuICogcGFyYW1ldGVyIHZhbHVlcywgb3IgbnVsbCBpZiB0aGUgcGF0aCBkb2VzIG5vdCBtYXRjaC4gVGhlIHJldHVybmVkIG9iamVjdCBjb250YWlucyB0aGUgdmFsdWVzXG4gKiBvZiBhbnkgc2VhcmNoIHBhcmFtZXRlcnMgdGhhdCBhcmUgbWVudGlvbmVkIGluIHRoZSBwYXR0ZXJuLCBidXQgdGhlaXIgdmFsdWUgbWF5IGJlIG51bGwgaWZcbiAqIHRoZXkgYXJlIG5vdCBwcmVzZW50IGluIGBzZWFyY2hQYXJhbXNgLiBUaGlzIG1lYW5zIHRoYXQgc2VhcmNoIHBhcmFtZXRlcnMgYXJlIGFsd2F5cyB0cmVhdGVkXG4gKiBhcyBvcHRpb25hbC5cbiAqXG4gKiBAZXhhbXBsZVxuICogPHByZT5cbiAqIG5ldyBVcmxNYXRjaGVyKCcvdXNlci97aWR9P3EmcicpLmV4ZWMoJy91c2VyL2JvYicsIHtcbiAqICAgeDogJzEnLCBxOiAnaGVsbG8nXG4gKiB9KTtcbiAqIC8vIHJldHVybnMgeyBpZDogJ2JvYicsIHE6ICdoZWxsbycsIHI6IG51bGwgfVxuICogPC9wcmU+XG4gKlxuICogQHBhcmFtIHtzdHJpbmd9IHBhdGggIFRoZSBVUkwgcGF0aCB0byBtYXRjaCwgZS5nLiBgJGxvY2F0aW9uLnBhdGgoKWAuXG4gKiBAcGFyYW0ge09iamVjdH0gc2VhcmNoUGFyYW1zICBVUkwgc2VhcmNoIHBhcmFtZXRlcnMsIGUuZy4gYCRsb2NhdGlvbi5zZWFyY2goKWAuXG4gKiBAcmV0dXJucyB7T2JqZWN0fSAgVGhlIGNhcHR1cmVkIHBhcmFtZXRlciB2YWx1ZXMuXG4gKi9cblVybE1hdGNoZXIucHJvdG90eXBlLmV4ZWMgPSBmdW5jdGlvbiAocGF0aCwgc2VhcmNoUGFyYW1zKSB7XG4gIHZhciBtID0gdGhpcy5yZWdleHAuZXhlYyhwYXRoKTtcbiAgaWYgKCFtKSByZXR1cm4gbnVsbDtcbiAgc2VhcmNoUGFyYW1zID0gc2VhcmNoUGFyYW1zIHx8IHt9O1xuXG4gIHZhciBwYXJhbU5hbWVzID0gdGhpcy5wYXJhbWV0ZXJzKCksIG5Ub3RhbCA9IHBhcmFtTmFtZXMubGVuZ3RoLFxuICAgIG5QYXRoID0gdGhpcy5zZWdtZW50cy5sZW5ndGggLSAxLFxuICAgIHZhbHVlcyA9IHt9LCBpLCBqLCBjZmcsIHBhcmFtTmFtZTtcblxuICBpZiAoblBhdGggIT09IG0ubGVuZ3RoIC0gMSkgdGhyb3cgbmV3IEVycm9yKFwiVW5iYWxhbmNlZCBjYXB0dXJlIGdyb3VwIGluIHJvdXRlICdcIiArIHRoaXMuc291cmNlICsgXCInXCIpO1xuXG4gIGZ1bmN0aW9uIGRlY29kZVBhdGhBcnJheShzdHJpbmcpIHtcbiAgICBmdW5jdGlvbiByZXZlcnNlU3RyaW5nKHN0cikgeyByZXR1cm4gc3RyLnNwbGl0KFwiXCIpLnJldmVyc2UoKS5qb2luKFwiXCIpOyB9XG4gICAgZnVuY3Rpb24gdW5xdW90ZURhc2hlcyhzdHIpIHsgcmV0dXJuIHN0ci5yZXBsYWNlKC9cXFxcLS9nLCBcIi1cIik7IH1cblxuICAgIHZhciBzcGxpdCA9IHJldmVyc2VTdHJpbmcoc3RyaW5nKS5zcGxpdCgvLSg/IVxcXFwpLyk7XG4gICAgdmFyIGFsbFJldmVyc2VkID0gbWFwKHNwbGl0LCByZXZlcnNlU3RyaW5nKTtcbiAgICByZXR1cm4gbWFwKGFsbFJldmVyc2VkLCB1bnF1b3RlRGFzaGVzKS5yZXZlcnNlKCk7XG4gIH1cblxuICBmb3IgKGkgPSAwOyBpIDwgblBhdGg7IGkrKykge1xuICAgIHBhcmFtTmFtZSA9IHBhcmFtTmFtZXNbaV07XG4gICAgdmFyIHBhcmFtID0gdGhpcy5wYXJhbXNbcGFyYW1OYW1lXTtcbiAgICB2YXIgcGFyYW1WYWwgPSBtW2krMV07XG4gICAgLy8gaWYgdGhlIHBhcmFtIHZhbHVlIG1hdGNoZXMgYSBwcmUtcmVwbGFjZSBwYWlyLCByZXBsYWNlIHRoZSB2YWx1ZSBiZWZvcmUgZGVjb2RpbmcuXG4gICAgZm9yIChqID0gMDsgaiA8IHBhcmFtLnJlcGxhY2U7IGorKykge1xuICAgICAgaWYgKHBhcmFtLnJlcGxhY2Vbal0uZnJvbSA9PT0gcGFyYW1WYWwpIHBhcmFtVmFsID0gcGFyYW0ucmVwbGFjZVtqXS50bztcbiAgICB9XG4gICAgaWYgKHBhcmFtVmFsICYmIHBhcmFtLmFycmF5ID09PSB0cnVlKSBwYXJhbVZhbCA9IGRlY29kZVBhdGhBcnJheShwYXJhbVZhbCk7XG4gICAgdmFsdWVzW3BhcmFtTmFtZV0gPSBwYXJhbS52YWx1ZShwYXJhbVZhbCk7XG4gIH1cbiAgZm9yICgvKiovOyBpIDwgblRvdGFsOyBpKyspIHtcbiAgICBwYXJhbU5hbWUgPSBwYXJhbU5hbWVzW2ldO1xuICAgIHZhbHVlc1twYXJhbU5hbWVdID0gdGhpcy5wYXJhbXNbcGFyYW1OYW1lXS52YWx1ZShzZWFyY2hQYXJhbXNbcGFyYW1OYW1lXSk7XG4gIH1cblxuICByZXR1cm4gdmFsdWVzO1xufTtcblxuLyoqXG4gKiBAbmdkb2MgZnVuY3Rpb25cbiAqIEBuYW1lIHVpLnJvdXRlci51dGlsLnR5cGU6VXJsTWF0Y2hlciNwYXJhbWV0ZXJzXG4gKiBAbWV0aG9kT2YgdWkucm91dGVyLnV0aWwudHlwZTpVcmxNYXRjaGVyXG4gKlxuICogQGRlc2NyaXB0aW9uXG4gKiBSZXR1cm5zIHRoZSBuYW1lcyBvZiBhbGwgcGF0aCBhbmQgc2VhcmNoIHBhcmFtZXRlcnMgb2YgdGhpcyBwYXR0ZXJuIGluIGFuIHVuc3BlY2lmaWVkIG9yZGVyLlxuICpcbiAqIEByZXR1cm5zIHtBcnJheS48c3RyaW5nPn0gIEFuIGFycmF5IG9mIHBhcmFtZXRlciBuYW1lcy4gTXVzdCBiZSB0cmVhdGVkIGFzIHJlYWQtb25seS4gSWYgdGhlXG4gKiAgICBwYXR0ZXJuIGhhcyBubyBwYXJhbWV0ZXJzLCBhbiBlbXB0eSBhcnJheSBpcyByZXR1cm5lZC5cbiAqL1xuVXJsTWF0Y2hlci5wcm90b3R5cGUucGFyYW1ldGVycyA9IGZ1bmN0aW9uIChwYXJhbSkge1xuICBpZiAoIWlzRGVmaW5lZChwYXJhbSkpIHJldHVybiB0aGlzLiQkcGFyYW1OYW1lcztcbiAgcmV0dXJuIHRoaXMucGFyYW1zW3BhcmFtXSB8fCBudWxsO1xufTtcblxuLyoqXG4gKiBAbmdkb2MgZnVuY3Rpb25cbiAqIEBuYW1lIHVpLnJvdXRlci51dGlsLnR5cGU6VXJsTWF0Y2hlciN2YWxpZGF0ZVxuICogQG1ldGhvZE9mIHVpLnJvdXRlci51dGlsLnR5cGU6VXJsTWF0Y2hlclxuICpcbiAqIEBkZXNjcmlwdGlvblxuICogQ2hlY2tzIGFuIG9iamVjdCBoYXNoIG9mIHBhcmFtZXRlcnMgdG8gdmFsaWRhdGUgdGhlaXIgY29ycmVjdG5lc3MgYWNjb3JkaW5nIHRvIHRoZSBwYXJhbWV0ZXJcbiAqIHR5cGVzIG9mIHRoaXMgYFVybE1hdGNoZXJgLlxuICpcbiAqIEBwYXJhbSB7T2JqZWN0fSBwYXJhbXMgVGhlIG9iamVjdCBoYXNoIG9mIHBhcmFtZXRlcnMgdG8gdmFsaWRhdGUuXG4gKiBAcmV0dXJucyB7Ym9vbGVhbn0gUmV0dXJucyBgdHJ1ZWAgaWYgYHBhcmFtc2AgdmFsaWRhdGVzLCBvdGhlcndpc2UgYGZhbHNlYC5cbiAqL1xuVXJsTWF0Y2hlci5wcm90b3R5cGUudmFsaWRhdGVzID0gZnVuY3Rpb24gKHBhcmFtcykge1xuICByZXR1cm4gdGhpcy5wYXJhbXMuJCR2YWxpZGF0ZXMocGFyYW1zKTtcbn07XG5cbi8qKlxuICogQG5nZG9jIGZ1bmN0aW9uXG4gKiBAbmFtZSB1aS5yb3V0ZXIudXRpbC50eXBlOlVybE1hdGNoZXIjZm9ybWF0XG4gKiBAbWV0aG9kT2YgdWkucm91dGVyLnV0aWwudHlwZTpVcmxNYXRjaGVyXG4gKlxuICogQGRlc2NyaXB0aW9uXG4gKiBDcmVhdGVzIGEgVVJMIHRoYXQgbWF0Y2hlcyB0aGlzIHBhdHRlcm4gYnkgc3Vic3RpdHV0aW5nIHRoZSBzcGVjaWZpZWQgdmFsdWVzXG4gKiBmb3IgdGhlIHBhdGggYW5kIHNlYXJjaCBwYXJhbWV0ZXJzLiBOdWxsIHZhbHVlcyBmb3IgcGF0aCBwYXJhbWV0ZXJzIGFyZVxuICogdHJlYXRlZCBhcyBlbXB0eSBzdHJpbmdzLlxuICpcbiAqIEBleGFtcGxlXG4gKiA8cHJlPlxuICogbmV3IFVybE1hdGNoZXIoJy91c2VyL3tpZH0/cScpLmZvcm1hdCh7IGlkOidib2InLCBxOid5ZXMnIH0pO1xuICogLy8gcmV0dXJucyAnL3VzZXIvYm9iP3E9eWVzJ1xuICogPC9wcmU+XG4gKlxuICogQHBhcmFtIHtPYmplY3R9IHZhbHVlcyAgdGhlIHZhbHVlcyB0byBzdWJzdGl0dXRlIGZvciB0aGUgcGFyYW1ldGVycyBpbiB0aGlzIHBhdHRlcm4uXG4gKiBAcmV0dXJucyB7c3RyaW5nfSAgdGhlIGZvcm1hdHRlZCBVUkwgKHBhdGggYW5kIG9wdGlvbmFsbHkgc2VhcmNoIHBhcnQpLlxuICovXG5VcmxNYXRjaGVyLnByb3RvdHlwZS5mb3JtYXQgPSBmdW5jdGlvbiAodmFsdWVzKSB7XG4gIHZhbHVlcyA9IHZhbHVlcyB8fCB7fTtcbiAgdmFyIHNlZ21lbnRzID0gdGhpcy5zZWdtZW50cywgcGFyYW1zID0gdGhpcy5wYXJhbWV0ZXJzKCksIHBhcmFtc2V0ID0gdGhpcy5wYXJhbXM7XG4gIGlmICghdGhpcy52YWxpZGF0ZXModmFsdWVzKSkgcmV0dXJuIG51bGw7XG5cbiAgdmFyIGksIHNlYXJjaCA9IGZhbHNlLCBuUGF0aCA9IHNlZ21lbnRzLmxlbmd0aCAtIDEsIG5Ub3RhbCA9IHBhcmFtcy5sZW5ndGgsIHJlc3VsdCA9IHNlZ21lbnRzWzBdO1xuXG4gIGZ1bmN0aW9uIGVuY29kZURhc2hlcyhzdHIpIHsgLy8gUmVwbGFjZSBkYXNoZXMgd2l0aCBlbmNvZGVkIFwiXFwtXCJcbiAgICByZXR1cm4gZW5jb2RlVVJJQ29tcG9uZW50KHN0cikucmVwbGFjZSgvLS9nLCBmdW5jdGlvbihjKSB7IHJldHVybiAnJTVDJScgKyBjLmNoYXJDb2RlQXQoMCkudG9TdHJpbmcoMTYpLnRvVXBwZXJDYXNlKCk7IH0pO1xuICB9XG5cbiAgZm9yIChpID0gMDsgaSA8IG5Ub3RhbDsgaSsrKSB7XG4gICAgdmFyIGlzUGF0aFBhcmFtID0gaSA8IG5QYXRoO1xuICAgIHZhciBuYW1lID0gcGFyYW1zW2ldLCBwYXJhbSA9IHBhcmFtc2V0W25hbWVdLCB2YWx1ZSA9IHBhcmFtLnZhbHVlKHZhbHVlc1tuYW1lXSk7XG4gICAgdmFyIGlzRGVmYXVsdFZhbHVlID0gcGFyYW0uaXNPcHRpb25hbCAmJiBwYXJhbS50eXBlLmVxdWFscyhwYXJhbS52YWx1ZSgpLCB2YWx1ZSk7XG4gICAgdmFyIHNxdWFzaCA9IGlzRGVmYXVsdFZhbHVlID8gcGFyYW0uc3F1YXNoIDogZmFsc2U7XG4gICAgdmFyIGVuY29kZWQgPSBwYXJhbS50eXBlLmVuY29kZSh2YWx1ZSk7XG5cbiAgICBpZiAoaXNQYXRoUGFyYW0pIHtcbiAgICAgIHZhciBuZXh0U2VnbWVudCA9IHNlZ21lbnRzW2kgKyAxXTtcbiAgICAgIGlmIChzcXVhc2ggPT09IGZhbHNlKSB7XG4gICAgICAgIGlmIChlbmNvZGVkICE9IG51bGwpIHtcbiAgICAgICAgICBpZiAoaXNBcnJheShlbmNvZGVkKSkge1xuICAgICAgICAgICAgcmVzdWx0ICs9IG1hcChlbmNvZGVkLCBlbmNvZGVEYXNoZXMpLmpvaW4oXCItXCIpO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICByZXN1bHQgKz0gZW5jb2RlVVJJQ29tcG9uZW50KGVuY29kZWQpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICByZXN1bHQgKz0gbmV4dFNlZ21lbnQ7XG4gICAgICB9IGVsc2UgaWYgKHNxdWFzaCA9PT0gdHJ1ZSkge1xuICAgICAgICB2YXIgY2FwdHVyZSA9IHJlc3VsdC5tYXRjaCgvXFwvJC8pID8gL1xcLz8oLiopLyA6IC8oLiopLztcbiAgICAgICAgcmVzdWx0ICs9IG5leHRTZWdtZW50Lm1hdGNoKGNhcHR1cmUpWzFdO1xuICAgICAgfSBlbHNlIGlmIChpc1N0cmluZyhzcXVhc2gpKSB7XG4gICAgICAgIHJlc3VsdCArPSBzcXVhc2ggKyBuZXh0U2VnbWVudDtcbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgaWYgKGVuY29kZWQgPT0gbnVsbCB8fCAoaXNEZWZhdWx0VmFsdWUgJiYgc3F1YXNoICE9PSBmYWxzZSkpIGNvbnRpbnVlO1xuICAgICAgaWYgKCFpc0FycmF5KGVuY29kZWQpKSBlbmNvZGVkID0gWyBlbmNvZGVkIF07XG4gICAgICBlbmNvZGVkID0gbWFwKGVuY29kZWQsIGVuY29kZVVSSUNvbXBvbmVudCkuam9pbignJicgKyBuYW1lICsgJz0nKTtcbiAgICAgIHJlc3VsdCArPSAoc2VhcmNoID8gJyYnIDogJz8nKSArIChuYW1lICsgJz0nICsgZW5jb2RlZCk7XG4gICAgICBzZWFyY2ggPSB0cnVlO1xuICAgIH1cbiAgfVxuXG4gIHJldHVybiByZXN1bHQ7XG59O1xuXG4vKipcbiAqIEBuZ2RvYyBvYmplY3RcbiAqIEBuYW1lIHVpLnJvdXRlci51dGlsLnR5cGU6VHlwZVxuICpcbiAqIEBkZXNjcmlwdGlvblxuICogSW1wbGVtZW50cyBhbiBpbnRlcmZhY2UgdG8gZGVmaW5lIGN1c3RvbSBwYXJhbWV0ZXIgdHlwZXMgdGhhdCBjYW4gYmUgZGVjb2RlZCBmcm9tIGFuZCBlbmNvZGVkIHRvXG4gKiBzdHJpbmcgcGFyYW1ldGVycyBtYXRjaGVkIGluIGEgVVJMLiBVc2VkIGJ5IHtAbGluayB1aS5yb3V0ZXIudXRpbC50eXBlOlVybE1hdGNoZXIgYFVybE1hdGNoZXJgfVxuICogb2JqZWN0cyB3aGVuIG1hdGNoaW5nIG9yIGZvcm1hdHRpbmcgVVJMcywgb3IgY29tcGFyaW5nIG9yIHZhbGlkYXRpbmcgcGFyYW1ldGVyIHZhbHVlcy5cbiAqXG4gKiBTZWUge0BsaW5rIHVpLnJvdXRlci51dGlsLiR1cmxNYXRjaGVyRmFjdG9yeSNtZXRob2RzX3R5cGUgYCR1cmxNYXRjaGVyRmFjdG9yeSN0eXBlKClgfSBmb3IgbW9yZVxuICogaW5mb3JtYXRpb24gb24gcmVnaXN0ZXJpbmcgY3VzdG9tIHR5cGVzLlxuICpcbiAqIEBwYXJhbSB7T2JqZWN0fSBjb25maWcgIEEgY29uZmlndXJhdGlvbiBvYmplY3Qgd2hpY2ggY29udGFpbnMgdGhlIGN1c3RvbSB0eXBlIGRlZmluaXRpb24uICBUaGUgb2JqZWN0J3NcbiAqICAgICAgICBwcm9wZXJ0aWVzIHdpbGwgb3ZlcnJpZGUgdGhlIGRlZmF1bHQgbWV0aG9kcyBhbmQvb3IgcGF0dGVybiBpbiBgVHlwZWAncyBwdWJsaWMgaW50ZXJmYWNlLlxuICogQGV4YW1wbGVcbiAqIDxwcmU+XG4gKiB7XG4gKiAgIGRlY29kZTogZnVuY3Rpb24odmFsKSB7IHJldHVybiBwYXJzZUludCh2YWwsIDEwKTsgfSxcbiAqICAgZW5jb2RlOiBmdW5jdGlvbih2YWwpIHsgcmV0dXJuIHZhbCAmJiB2YWwudG9TdHJpbmcoKTsgfSxcbiAqICAgZXF1YWxzOiBmdW5jdGlvbihhLCBiKSB7IHJldHVybiB0aGlzLmlzKGEpICYmIGEgPT09IGI7IH0sXG4gKiAgIGlzOiBmdW5jdGlvbih2YWwpIHsgcmV0dXJuIGFuZ3VsYXIuaXNOdW1iZXIodmFsKSBpc0Zpbml0ZSh2YWwpICYmIHZhbCAlIDEgPT09IDA7IH0sXG4gKiAgIHBhdHRlcm46IC9cXGQrL1xuICogfVxuICogPC9wcmU+XG4gKlxuICogQHByb3BlcnR5IHtSZWdFeHB9IHBhdHRlcm4gVGhlIHJlZ3VsYXIgZXhwcmVzc2lvbiBwYXR0ZXJuIHVzZWQgdG8gbWF0Y2ggdmFsdWVzIG9mIHRoaXMgdHlwZSB3aGVuXG4gKiAgICAgICAgICAgY29taW5nIGZyb20gYSBzdWJzdHJpbmcgb2YgYSBVUkwuXG4gKlxuICogQHJldHVybnMge09iamVjdH0gIFJldHVybnMgYSBuZXcgYFR5cGVgIG9iamVjdC5cbiAqL1xuZnVuY3Rpb24gVHlwZShjb25maWcpIHtcbiAgZXh0ZW5kKHRoaXMsIGNvbmZpZyk7XG59XG5cbi8qKlxuICogQG5nZG9jIGZ1bmN0aW9uXG4gKiBAbmFtZSB1aS5yb3V0ZXIudXRpbC50eXBlOlR5cGUjaXNcbiAqIEBtZXRob2RPZiB1aS5yb3V0ZXIudXRpbC50eXBlOlR5cGVcbiAqXG4gKiBAZGVzY3JpcHRpb25cbiAqIERldGVjdHMgd2hldGhlciBhIHZhbHVlIGlzIG9mIGEgcGFydGljdWxhciB0eXBlLiBBY2NlcHRzIGEgbmF0aXZlIChkZWNvZGVkKSB2YWx1ZVxuICogYW5kIGRldGVybWluZXMgd2hldGhlciBpdCBtYXRjaGVzIHRoZSBjdXJyZW50IGBUeXBlYCBvYmplY3QuXG4gKlxuICogQHBhcmFtIHsqfSB2YWwgIFRoZSB2YWx1ZSB0byBjaGVjay5cbiAqIEBwYXJhbSB7c3RyaW5nfSBrZXkgIE9wdGlvbmFsLiBJZiB0aGUgdHlwZSBjaGVjayBpcyBoYXBwZW5pbmcgaW4gdGhlIGNvbnRleHQgb2YgYSBzcGVjaWZpY1xuICogICAgICAgIHtAbGluayB1aS5yb3V0ZXIudXRpbC50eXBlOlVybE1hdGNoZXIgYFVybE1hdGNoZXJgfSBvYmplY3QsIHRoaXMgaXMgdGhlIG5hbWUgb2YgdGhlXG4gKiAgICAgICAgcGFyYW1ldGVyIGluIHdoaWNoIGB2YWxgIGlzIHN0b3JlZC4gQ2FuIGJlIHVzZWQgZm9yIG1ldGEtcHJvZ3JhbW1pbmcgb2YgYFR5cGVgIG9iamVjdHMuXG4gKiBAcmV0dXJucyB7Qm9vbGVhbn0gIFJldHVybnMgYHRydWVgIGlmIHRoZSB2YWx1ZSBtYXRjaGVzIHRoZSB0eXBlLCBvdGhlcndpc2UgYGZhbHNlYC5cbiAqL1xuVHlwZS5wcm90b3R5cGUuaXMgPSBmdW5jdGlvbih2YWwsIGtleSkge1xuICByZXR1cm4gdHJ1ZTtcbn07XG5cbi8qKlxuICogQG5nZG9jIGZ1bmN0aW9uXG4gKiBAbmFtZSB1aS5yb3V0ZXIudXRpbC50eXBlOlR5cGUjZW5jb2RlXG4gKiBAbWV0aG9kT2YgdWkucm91dGVyLnV0aWwudHlwZTpUeXBlXG4gKlxuICogQGRlc2NyaXB0aW9uXG4gKiBFbmNvZGVzIGEgY3VzdG9tL25hdGl2ZSB0eXBlIHZhbHVlIHRvIGEgc3RyaW5nIHRoYXQgY2FuIGJlIGVtYmVkZGVkIGluIGEgVVJMLiBOb3RlIHRoYXQgdGhlXG4gKiByZXR1cm4gdmFsdWUgZG9lcyAqbm90KiBuZWVkIHRvIGJlIFVSTC1zYWZlIChpLmUuIHBhc3NlZCB0aHJvdWdoIGBlbmNvZGVVUklDb21wb25lbnQoKWApLCBpdFxuICogb25seSBuZWVkcyB0byBiZSBhIHJlcHJlc2VudGF0aW9uIG9mIGB2YWxgIHRoYXQgaGFzIGJlZW4gY29lcmNlZCB0byBhIHN0cmluZy5cbiAqXG4gKiBAcGFyYW0geyp9IHZhbCAgVGhlIHZhbHVlIHRvIGVuY29kZS5cbiAqIEBwYXJhbSB7c3RyaW5nfSBrZXkgIFRoZSBuYW1lIG9mIHRoZSBwYXJhbWV0ZXIgaW4gd2hpY2ggYHZhbGAgaXMgc3RvcmVkLiBDYW4gYmUgdXNlZCBmb3JcbiAqICAgICAgICBtZXRhLXByb2dyYW1taW5nIG9mIGBUeXBlYCBvYmplY3RzLlxuICogQHJldHVybnMge3N0cmluZ30gIFJldHVybnMgYSBzdHJpbmcgcmVwcmVzZW50YXRpb24gb2YgYHZhbGAgdGhhdCBjYW4gYmUgZW5jb2RlZCBpbiBhIFVSTC5cbiAqL1xuVHlwZS5wcm90b3R5cGUuZW5jb2RlID0gZnVuY3Rpb24odmFsLCBrZXkpIHtcbiAgcmV0dXJuIHZhbDtcbn07XG5cbi8qKlxuICogQG5nZG9jIGZ1bmN0aW9uXG4gKiBAbmFtZSB1aS5yb3V0ZXIudXRpbC50eXBlOlR5cGUjZGVjb2RlXG4gKiBAbWV0aG9kT2YgdWkucm91dGVyLnV0aWwudHlwZTpUeXBlXG4gKlxuICogQGRlc2NyaXB0aW9uXG4gKiBDb252ZXJ0cyBhIHBhcmFtZXRlciB2YWx1ZSAoZnJvbSBVUkwgc3RyaW5nIG9yIHRyYW5zaXRpb24gcGFyYW0pIHRvIGEgY3VzdG9tL25hdGl2ZSB2YWx1ZS5cbiAqXG4gKiBAcGFyYW0ge3N0cmluZ30gdmFsICBUaGUgVVJMIHBhcmFtZXRlciB2YWx1ZSB0byBkZWNvZGUuXG4gKiBAcGFyYW0ge3N0cmluZ30ga2V5ICBUaGUgbmFtZSBvZiB0aGUgcGFyYW1ldGVyIGluIHdoaWNoIGB2YWxgIGlzIHN0b3JlZC4gQ2FuIGJlIHVzZWQgZm9yXG4gKiAgICAgICAgbWV0YS1wcm9ncmFtbWluZyBvZiBgVHlwZWAgb2JqZWN0cy5cbiAqIEByZXR1cm5zIHsqfSAgUmV0dXJucyBhIGN1c3RvbSByZXByZXNlbnRhdGlvbiBvZiB0aGUgVVJMIHBhcmFtZXRlciB2YWx1ZS5cbiAqL1xuVHlwZS5wcm90b3R5cGUuZGVjb2RlID0gZnVuY3Rpb24odmFsLCBrZXkpIHtcbiAgcmV0dXJuIHZhbDtcbn07XG5cbi8qKlxuICogQG5nZG9jIGZ1bmN0aW9uXG4gKiBAbmFtZSB1aS5yb3V0ZXIudXRpbC50eXBlOlR5cGUjZXF1YWxzXG4gKiBAbWV0aG9kT2YgdWkucm91dGVyLnV0aWwudHlwZTpUeXBlXG4gKlxuICogQGRlc2NyaXB0aW9uXG4gKiBEZXRlcm1pbmVzIHdoZXRoZXIgdHdvIGRlY29kZWQgdmFsdWVzIGFyZSBlcXVpdmFsZW50LlxuICpcbiAqIEBwYXJhbSB7Kn0gYSAgQSB2YWx1ZSB0byBjb21wYXJlIGFnYWluc3QuXG4gKiBAcGFyYW0geyp9IGIgIEEgdmFsdWUgdG8gY29tcGFyZSBhZ2FpbnN0LlxuICogQHJldHVybnMge0Jvb2xlYW59ICBSZXR1cm5zIGB0cnVlYCBpZiB0aGUgdmFsdWVzIGFyZSBlcXVpdmFsZW50L2VxdWFsLCBvdGhlcndpc2UgYGZhbHNlYC5cbiAqL1xuVHlwZS5wcm90b3R5cGUuZXF1YWxzID0gZnVuY3Rpb24oYSwgYikge1xuICByZXR1cm4gYSA9PSBiO1xufTtcblxuVHlwZS5wcm90b3R5cGUuJHN1YlBhdHRlcm4gPSBmdW5jdGlvbigpIHtcbiAgdmFyIHN1YiA9IHRoaXMucGF0dGVybi50b1N0cmluZygpO1xuICByZXR1cm4gc3ViLnN1YnN0cigxLCBzdWIubGVuZ3RoIC0gMik7XG59O1xuXG5UeXBlLnByb3RvdHlwZS5wYXR0ZXJuID0gLy4qLztcblxuVHlwZS5wcm90b3R5cGUudG9TdHJpbmcgPSBmdW5jdGlvbigpIHsgcmV0dXJuIFwie1R5cGU6XCIgKyB0aGlzLm5hbWUgKyBcIn1cIjsgfTtcblxuLyoqIEdpdmVuIGFuIGVuY29kZWQgc3RyaW5nLCBvciBhIGRlY29kZWQgb2JqZWN0LCByZXR1cm5zIGEgZGVjb2RlZCBvYmplY3QgKi9cblR5cGUucHJvdG90eXBlLiRub3JtYWxpemUgPSBmdW5jdGlvbih2YWwpIHtcbiAgcmV0dXJuIHRoaXMuaXModmFsKSA/IHZhbCA6IHRoaXMuZGVjb2RlKHZhbCk7XG59O1xuXG4vKlxuICogV3JhcHMgYW4gZXhpc3RpbmcgY3VzdG9tIFR5cGUgYXMgYW4gYXJyYXkgb2YgVHlwZSwgZGVwZW5kaW5nIG9uICdtb2RlJy5cbiAqIGUuZy46XG4gKiAtIHVybG1hdGNoZXIgcGF0dGVybiBcIi9wYXRoP3txdWVyeVBhcmFtW106aW50fVwiXG4gKiAtIHVybDogXCIvcGF0aD9xdWVyeVBhcmFtPTEmcXVlcnlQYXJhbT0yXG4gKiAtICRzdGF0ZVBhcmFtcy5xdWVyeVBhcmFtIHdpbGwgYmUgWzEsIDJdXG4gKiBpZiBgbW9kZWAgaXMgXCJhdXRvXCIsIHRoZW5cbiAqIC0gdXJsOiBcIi9wYXRoP3F1ZXJ5UGFyYW09MSB3aWxsIGNyZWF0ZSAkc3RhdGVQYXJhbXMucXVlcnlQYXJhbTogMVxuICogLSB1cmw6IFwiL3BhdGg/cXVlcnlQYXJhbT0xJnF1ZXJ5UGFyYW09MiB3aWxsIGNyZWF0ZSAkc3RhdGVQYXJhbXMucXVlcnlQYXJhbTogWzEsIDJdXG4gKi9cblR5cGUucHJvdG90eXBlLiRhc0FycmF5ID0gZnVuY3Rpb24obW9kZSwgaXNTZWFyY2gpIHtcbiAgaWYgKCFtb2RlKSByZXR1cm4gdGhpcztcbiAgaWYgKG1vZGUgPT09IFwiYXV0b1wiICYmICFpc1NlYXJjaCkgdGhyb3cgbmV3IEVycm9yKFwiJ2F1dG8nIGFycmF5IG1vZGUgaXMgZm9yIHF1ZXJ5IHBhcmFtZXRlcnMgb25seVwiKTtcblxuICBmdW5jdGlvbiBBcnJheVR5cGUodHlwZSwgbW9kZSkge1xuICAgIGZ1bmN0aW9uIGJpbmRUbyh0eXBlLCBjYWxsYmFja05hbWUpIHtcbiAgICAgIHJldHVybiBmdW5jdGlvbigpIHtcbiAgICAgICAgcmV0dXJuIHR5cGVbY2FsbGJhY2tOYW1lXS5hcHBseSh0eXBlLCBhcmd1bWVudHMpO1xuICAgICAgfTtcbiAgICB9XG5cbiAgICAvLyBXcmFwIG5vbi1hcnJheSB2YWx1ZSBhcyBhcnJheVxuICAgIGZ1bmN0aW9uIGFycmF5V3JhcCh2YWwpIHsgcmV0dXJuIGlzQXJyYXkodmFsKSA/IHZhbCA6IChpc0RlZmluZWQodmFsKSA/IFsgdmFsIF0gOiBbXSk7IH1cbiAgICAvLyBVbndyYXAgYXJyYXkgdmFsdWUgZm9yIFwiYXV0b1wiIG1vZGUuIFJldHVybiB1bmRlZmluZWQgZm9yIGVtcHR5IGFycmF5LlxuICAgIGZ1bmN0aW9uIGFycmF5VW53cmFwKHZhbCkge1xuICAgICAgc3dpdGNoKHZhbC5sZW5ndGgpIHtcbiAgICAgICAgY2FzZSAwOiByZXR1cm4gdW5kZWZpbmVkO1xuICAgICAgICBjYXNlIDE6IHJldHVybiBtb2RlID09PSBcImF1dG9cIiA/IHZhbFswXSA6IHZhbDtcbiAgICAgICAgZGVmYXVsdDogcmV0dXJuIHZhbDtcbiAgICAgIH1cbiAgICB9XG4gICAgZnVuY3Rpb24gZmFsc2V5KHZhbCkgeyByZXR1cm4gIXZhbDsgfVxuXG4gICAgLy8gV3JhcHMgdHlwZSAoLmlzLy5lbmNvZGUvLmRlY29kZSkgZnVuY3Rpb25zIHRvIG9wZXJhdGUgb24gZWFjaCB2YWx1ZSBvZiBhbiBhcnJheVxuICAgIGZ1bmN0aW9uIGFycmF5SGFuZGxlcihjYWxsYmFjaywgYWxsVHJ1dGh5TW9kZSkge1xuICAgICAgcmV0dXJuIGZ1bmN0aW9uIGhhbmRsZUFycmF5KHZhbCkge1xuICAgICAgICB2YWwgPSBhcnJheVdyYXAodmFsKTtcbiAgICAgICAgdmFyIHJlc3VsdCA9IG1hcCh2YWwsIGNhbGxiYWNrKTtcbiAgICAgICAgaWYgKGFsbFRydXRoeU1vZGUgPT09IHRydWUpXG4gICAgICAgICAgcmV0dXJuIGZpbHRlcihyZXN1bHQsIGZhbHNleSkubGVuZ3RoID09PSAwO1xuICAgICAgICByZXR1cm4gYXJyYXlVbndyYXAocmVzdWx0KTtcbiAgICAgIH07XG4gICAgfVxuXG4gICAgLy8gV3JhcHMgdHlwZSAoLmVxdWFscykgZnVuY3Rpb25zIHRvIG9wZXJhdGUgb24gZWFjaCB2YWx1ZSBvZiBhbiBhcnJheVxuICAgIGZ1bmN0aW9uIGFycmF5RXF1YWxzSGFuZGxlcihjYWxsYmFjaykge1xuICAgICAgcmV0dXJuIGZ1bmN0aW9uIGhhbmRsZUFycmF5KHZhbDEsIHZhbDIpIHtcbiAgICAgICAgdmFyIGxlZnQgPSBhcnJheVdyYXAodmFsMSksIHJpZ2h0ID0gYXJyYXlXcmFwKHZhbDIpO1xuICAgICAgICBpZiAobGVmdC5sZW5ndGggIT09IHJpZ2h0Lmxlbmd0aCkgcmV0dXJuIGZhbHNlO1xuICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IGxlZnQubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICBpZiAoIWNhbGxiYWNrKGxlZnRbaV0sIHJpZ2h0W2ldKSkgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgfTtcbiAgICB9XG5cbiAgICB0aGlzLmVuY29kZSA9IGFycmF5SGFuZGxlcihiaW5kVG8odHlwZSwgJ2VuY29kZScpKTtcbiAgICB0aGlzLmRlY29kZSA9IGFycmF5SGFuZGxlcihiaW5kVG8odHlwZSwgJ2RlY29kZScpKTtcbiAgICB0aGlzLmlzICAgICA9IGFycmF5SGFuZGxlcihiaW5kVG8odHlwZSwgJ2lzJyksIHRydWUpO1xuICAgIHRoaXMuZXF1YWxzID0gYXJyYXlFcXVhbHNIYW5kbGVyKGJpbmRUbyh0eXBlLCAnZXF1YWxzJykpO1xuICAgIHRoaXMucGF0dGVybiA9IHR5cGUucGF0dGVybjtcbiAgICB0aGlzLiRub3JtYWxpemUgPSBhcnJheUhhbmRsZXIoYmluZFRvKHR5cGUsICckbm9ybWFsaXplJykpO1xuICAgIHRoaXMubmFtZSA9IHR5cGUubmFtZTtcbiAgICB0aGlzLiRhcnJheU1vZGUgPSBtb2RlO1xuICB9XG5cbiAgcmV0dXJuIG5ldyBBcnJheVR5cGUodGhpcywgbW9kZSk7XG59O1xuXG5cblxuLyoqXG4gKiBAbmdkb2Mgb2JqZWN0XG4gKiBAbmFtZSB1aS5yb3V0ZXIudXRpbC4kdXJsTWF0Y2hlckZhY3RvcnlcbiAqXG4gKiBAZGVzY3JpcHRpb25cbiAqIEZhY3RvcnkgZm9yIHtAbGluayB1aS5yb3V0ZXIudXRpbC50eXBlOlVybE1hdGNoZXIgYFVybE1hdGNoZXJgfSBpbnN0YW5jZXMuIFRoZSBmYWN0b3J5XG4gKiBpcyBhbHNvIGF2YWlsYWJsZSB0byBwcm92aWRlcnMgdW5kZXIgdGhlIG5hbWUgYCR1cmxNYXRjaGVyRmFjdG9yeVByb3ZpZGVyYC5cbiAqL1xuZnVuY3Rpb24gJFVybE1hdGNoZXJGYWN0b3J5KCkge1xuICAkJFVNRlAgPSB0aGlzO1xuXG4gIHZhciBpc0Nhc2VJbnNlbnNpdGl2ZSA9IGZhbHNlLCBpc1N0cmljdE1vZGUgPSB0cnVlLCBkZWZhdWx0U3F1YXNoUG9saWN5ID0gZmFsc2U7XG5cbiAgZnVuY3Rpb24gdmFsVG9TdHJpbmcodmFsKSB7IHJldHVybiB2YWwgIT0gbnVsbCA/IHZhbC50b1N0cmluZygpLnJlcGxhY2UoL1xcLy9nLCBcIiUyRlwiKSA6IHZhbDsgfVxuICBmdW5jdGlvbiB2YWxGcm9tU3RyaW5nKHZhbCkgeyByZXR1cm4gdmFsICE9IG51bGwgPyB2YWwudG9TdHJpbmcoKS5yZXBsYWNlKC8lMkYvZywgXCIvXCIpIDogdmFsOyB9XG5cbiAgdmFyICR0eXBlcyA9IHt9LCBlbnF1ZXVlID0gdHJ1ZSwgdHlwZVF1ZXVlID0gW10sIGluamVjdG9yLCBkZWZhdWx0VHlwZXMgPSB7XG4gICAgc3RyaW5nOiB7XG4gICAgICBlbmNvZGU6IHZhbFRvU3RyaW5nLFxuICAgICAgZGVjb2RlOiB2YWxGcm9tU3RyaW5nLFxuICAgICAgLy8gVE9ETzogaW4gMS4wLCBtYWtlIHN0cmluZyAuaXMoKSByZXR1cm4gZmFsc2UgaWYgdmFsdWUgaXMgdW5kZWZpbmVkL251bGwgYnkgZGVmYXVsdC5cbiAgICAgIC8vIEluIDAuMi54LCBzdHJpbmcgcGFyYW1zIGFyZSBvcHRpb25hbCBieSBkZWZhdWx0IGZvciBiYWNrd2FyZHMgY29tcGF0XG4gICAgICBpczogZnVuY3Rpb24odmFsKSB7IHJldHVybiB2YWwgPT0gbnVsbCB8fCAhaXNEZWZpbmVkKHZhbCkgfHwgdHlwZW9mIHZhbCA9PT0gXCJzdHJpbmdcIjsgfSxcbiAgICAgIHBhdHRlcm46IC9bXi9dKi9cbiAgICB9LFxuICAgIGludDoge1xuICAgICAgZW5jb2RlOiB2YWxUb1N0cmluZyxcbiAgICAgIGRlY29kZTogZnVuY3Rpb24odmFsKSB7IHJldHVybiBwYXJzZUludCh2YWwsIDEwKTsgfSxcbiAgICAgIGlzOiBmdW5jdGlvbih2YWwpIHsgcmV0dXJuIGlzRGVmaW5lZCh2YWwpICYmIHRoaXMuZGVjb2RlKHZhbC50b1N0cmluZygpKSA9PT0gdmFsOyB9LFxuICAgICAgcGF0dGVybjogL1xcZCsvXG4gICAgfSxcbiAgICBib29sOiB7XG4gICAgICBlbmNvZGU6IGZ1bmN0aW9uKHZhbCkgeyByZXR1cm4gdmFsID8gMSA6IDA7IH0sXG4gICAgICBkZWNvZGU6IGZ1bmN0aW9uKHZhbCkgeyByZXR1cm4gcGFyc2VJbnQodmFsLCAxMCkgIT09IDA7IH0sXG4gICAgICBpczogZnVuY3Rpb24odmFsKSB7IHJldHVybiB2YWwgPT09IHRydWUgfHwgdmFsID09PSBmYWxzZTsgfSxcbiAgICAgIHBhdHRlcm46IC8wfDEvXG4gICAgfSxcbiAgICBkYXRlOiB7XG4gICAgICBlbmNvZGU6IGZ1bmN0aW9uICh2YWwpIHtcbiAgICAgICAgaWYgKCF0aGlzLmlzKHZhbCkpXG4gICAgICAgICAgcmV0dXJuIHVuZGVmaW5lZDtcbiAgICAgICAgcmV0dXJuIFsgdmFsLmdldEZ1bGxZZWFyKCksXG4gICAgICAgICAgKCcwJyArICh2YWwuZ2V0TW9udGgoKSArIDEpKS5zbGljZSgtMiksXG4gICAgICAgICAgKCcwJyArIHZhbC5nZXREYXRlKCkpLnNsaWNlKC0yKVxuICAgICAgICBdLmpvaW4oXCItXCIpO1xuICAgICAgfSxcbiAgICAgIGRlY29kZTogZnVuY3Rpb24gKHZhbCkge1xuICAgICAgICBpZiAodGhpcy5pcyh2YWwpKSByZXR1cm4gdmFsO1xuICAgICAgICB2YXIgbWF0Y2ggPSB0aGlzLmNhcHR1cmUuZXhlYyh2YWwpO1xuICAgICAgICByZXR1cm4gbWF0Y2ggPyBuZXcgRGF0ZShtYXRjaFsxXSwgbWF0Y2hbMl0gLSAxLCBtYXRjaFszXSkgOiB1bmRlZmluZWQ7XG4gICAgICB9LFxuICAgICAgaXM6IGZ1bmN0aW9uKHZhbCkgeyByZXR1cm4gdmFsIGluc3RhbmNlb2YgRGF0ZSAmJiAhaXNOYU4odmFsLnZhbHVlT2YoKSk7IH0sXG4gICAgICBlcXVhbHM6IGZ1bmN0aW9uIChhLCBiKSB7IHJldHVybiB0aGlzLmlzKGEpICYmIHRoaXMuaXMoYikgJiYgYS50b0lTT1N0cmluZygpID09PSBiLnRvSVNPU3RyaW5nKCk7IH0sXG4gICAgICBwYXR0ZXJuOiAvWzAtOV17NH0tKD86MFsxLTldfDFbMC0yXSktKD86MFsxLTldfFsxLTJdWzAtOV18M1swLTFdKS8sXG4gICAgICBjYXB0dXJlOiAvKFswLTldezR9KS0oMFsxLTldfDFbMC0yXSktKDBbMS05XXxbMS0yXVswLTldfDNbMC0xXSkvXG4gICAgfSxcbiAgICBqc29uOiB7XG4gICAgICBlbmNvZGU6IGFuZ3VsYXIudG9Kc29uLFxuICAgICAgZGVjb2RlOiBhbmd1bGFyLmZyb21Kc29uLFxuICAgICAgaXM6IGFuZ3VsYXIuaXNPYmplY3QsXG4gICAgICBlcXVhbHM6IGFuZ3VsYXIuZXF1YWxzLFxuICAgICAgcGF0dGVybjogL1teL10qL1xuICAgIH0sXG4gICAgYW55OiB7IC8vIGRvZXMgbm90IGVuY29kZS9kZWNvZGVcbiAgICAgIGVuY29kZTogYW5ndWxhci5pZGVudGl0eSxcbiAgICAgIGRlY29kZTogYW5ndWxhci5pZGVudGl0eSxcbiAgICAgIGVxdWFsczogYW5ndWxhci5lcXVhbHMsXG4gICAgICBwYXR0ZXJuOiAvLiovXG4gICAgfVxuICB9O1xuXG4gIGZ1bmN0aW9uIGdldERlZmF1bHRDb25maWcoKSB7XG4gICAgcmV0dXJuIHtcbiAgICAgIHN0cmljdDogaXNTdHJpY3RNb2RlLFxuICAgICAgY2FzZUluc2Vuc2l0aXZlOiBpc0Nhc2VJbnNlbnNpdGl2ZVxuICAgIH07XG4gIH1cblxuICBmdW5jdGlvbiBpc0luamVjdGFibGUodmFsdWUpIHtcbiAgICByZXR1cm4gKGlzRnVuY3Rpb24odmFsdWUpIHx8IChpc0FycmF5KHZhbHVlKSAmJiBpc0Z1bmN0aW9uKHZhbHVlW3ZhbHVlLmxlbmd0aCAtIDFdKSkpO1xuICB9XG5cbiAgLyoqXG4gICAqIFtJbnRlcm5hbF0gR2V0IHRoZSBkZWZhdWx0IHZhbHVlIG9mIGEgcGFyYW1ldGVyLCB3aGljaCBtYXkgYmUgYW4gaW5qZWN0YWJsZSBmdW5jdGlvbi5cbiAgICovXG4gICRVcmxNYXRjaGVyRmFjdG9yeS4kJGdldERlZmF1bHRWYWx1ZSA9IGZ1bmN0aW9uKGNvbmZpZykge1xuICAgIGlmICghaXNJbmplY3RhYmxlKGNvbmZpZy52YWx1ZSkpIHJldHVybiBjb25maWcudmFsdWU7XG4gICAgaWYgKCFpbmplY3RvcikgdGhyb3cgbmV3IEVycm9yKFwiSW5qZWN0YWJsZSBmdW5jdGlvbnMgY2Fubm90IGJlIGNhbGxlZCBhdCBjb25maWd1cmF0aW9uIHRpbWVcIik7XG4gICAgcmV0dXJuIGluamVjdG9yLmludm9rZShjb25maWcudmFsdWUpO1xuICB9O1xuXG4gIC8qKlxuICAgKiBAbmdkb2MgZnVuY3Rpb25cbiAgICogQG5hbWUgdWkucm91dGVyLnV0aWwuJHVybE1hdGNoZXJGYWN0b3J5I2Nhc2VJbnNlbnNpdGl2ZVxuICAgKiBAbWV0aG9kT2YgdWkucm91dGVyLnV0aWwuJHVybE1hdGNoZXJGYWN0b3J5XG4gICAqXG4gICAqIEBkZXNjcmlwdGlvblxuICAgKiBEZWZpbmVzIHdoZXRoZXIgVVJMIG1hdGNoaW5nIHNob3VsZCBiZSBjYXNlIHNlbnNpdGl2ZSAodGhlIGRlZmF1bHQgYmVoYXZpb3IpLCBvciBub3QuXG4gICAqXG4gICAqIEBwYXJhbSB7Ym9vbGVhbn0gdmFsdWUgYGZhbHNlYCB0byBtYXRjaCBVUkwgaW4gYSBjYXNlIHNlbnNpdGl2ZSBtYW5uZXI7IG90aGVyd2lzZSBgdHJ1ZWA7XG4gICAqIEByZXR1cm5zIHtib29sZWFufSB0aGUgY3VycmVudCB2YWx1ZSBvZiBjYXNlSW5zZW5zaXRpdmVcbiAgICovXG4gIHRoaXMuY2FzZUluc2Vuc2l0aXZlID0gZnVuY3Rpb24odmFsdWUpIHtcbiAgICBpZiAoaXNEZWZpbmVkKHZhbHVlKSlcbiAgICAgIGlzQ2FzZUluc2Vuc2l0aXZlID0gdmFsdWU7XG4gICAgcmV0dXJuIGlzQ2FzZUluc2Vuc2l0aXZlO1xuICB9O1xuXG4gIC8qKlxuICAgKiBAbmdkb2MgZnVuY3Rpb25cbiAgICogQG5hbWUgdWkucm91dGVyLnV0aWwuJHVybE1hdGNoZXJGYWN0b3J5I3N0cmljdE1vZGVcbiAgICogQG1ldGhvZE9mIHVpLnJvdXRlci51dGlsLiR1cmxNYXRjaGVyRmFjdG9yeVxuICAgKlxuICAgKiBAZGVzY3JpcHRpb25cbiAgICogRGVmaW5lcyB3aGV0aGVyIFVSTHMgc2hvdWxkIG1hdGNoIHRyYWlsaW5nIHNsYXNoZXMsIG9yIG5vdCAodGhlIGRlZmF1bHQgYmVoYXZpb3IpLlxuICAgKlxuICAgKiBAcGFyYW0ge2Jvb2xlYW49fSB2YWx1ZSBgZmFsc2VgIHRvIG1hdGNoIHRyYWlsaW5nIHNsYXNoZXMgaW4gVVJMcywgb3RoZXJ3aXNlIGB0cnVlYC5cbiAgICogQHJldHVybnMge2Jvb2xlYW59IHRoZSBjdXJyZW50IHZhbHVlIG9mIHN0cmljdE1vZGVcbiAgICovXG4gIHRoaXMuc3RyaWN0TW9kZSA9IGZ1bmN0aW9uKHZhbHVlKSB7XG4gICAgaWYgKGlzRGVmaW5lZCh2YWx1ZSkpXG4gICAgICBpc1N0cmljdE1vZGUgPSB2YWx1ZTtcbiAgICByZXR1cm4gaXNTdHJpY3RNb2RlO1xuICB9O1xuXG4gIC8qKlxuICAgKiBAbmdkb2MgZnVuY3Rpb25cbiAgICogQG5hbWUgdWkucm91dGVyLnV0aWwuJHVybE1hdGNoZXJGYWN0b3J5I2RlZmF1bHRTcXVhc2hQb2xpY3lcbiAgICogQG1ldGhvZE9mIHVpLnJvdXRlci51dGlsLiR1cmxNYXRjaGVyRmFjdG9yeVxuICAgKlxuICAgKiBAZGVzY3JpcHRpb25cbiAgICogU2V0cyB0aGUgZGVmYXVsdCBiZWhhdmlvciB3aGVuIGdlbmVyYXRpbmcgb3IgbWF0Y2hpbmcgVVJMcyB3aXRoIGRlZmF1bHQgcGFyYW1ldGVyIHZhbHVlcy5cbiAgICpcbiAgICogQHBhcmFtIHtzdHJpbmd9IHZhbHVlIEEgc3RyaW5nIHRoYXQgZGVmaW5lcyB0aGUgZGVmYXVsdCBwYXJhbWV0ZXIgVVJMIHNxdWFzaGluZyBiZWhhdmlvci5cbiAgICogICAgYG5vc3F1YXNoYDogV2hlbiBnZW5lcmF0aW5nIGFuIGhyZWYgd2l0aCBhIGRlZmF1bHQgcGFyYW1ldGVyIHZhbHVlLCBkbyBub3Qgc3F1YXNoIHRoZSBwYXJhbWV0ZXIgdmFsdWUgZnJvbSB0aGUgVVJMXG4gICAqICAgIGBzbGFzaGA6IFdoZW4gZ2VuZXJhdGluZyBhbiBocmVmIHdpdGggYSBkZWZhdWx0IHBhcmFtZXRlciB2YWx1ZSwgc3F1YXNoIChyZW1vdmUpIHRoZSBwYXJhbWV0ZXIgdmFsdWUsIGFuZCwgaWYgdGhlXG4gICAqICAgICAgICAgICAgIHBhcmFtZXRlciBpcyBzdXJyb3VuZGVkIGJ5IHNsYXNoZXMsIHNxdWFzaCAocmVtb3ZlKSBvbmUgc2xhc2ggZnJvbSB0aGUgVVJMXG4gICAqICAgIGFueSBvdGhlciBzdHJpbmcsIGUuZy4gXCJ+XCI6IFdoZW4gZ2VuZXJhdGluZyBhbiBocmVmIHdpdGggYSBkZWZhdWx0IHBhcmFtZXRlciB2YWx1ZSwgc3F1YXNoIChyZW1vdmUpXG4gICAqICAgICAgICAgICAgIHRoZSBwYXJhbWV0ZXIgdmFsdWUgZnJvbSB0aGUgVVJMIGFuZCByZXBsYWNlIGl0IHdpdGggdGhpcyBzdHJpbmcuXG4gICAqL1xuICB0aGlzLmRlZmF1bHRTcXVhc2hQb2xpY3kgPSBmdW5jdGlvbih2YWx1ZSkge1xuICAgIGlmICghaXNEZWZpbmVkKHZhbHVlKSkgcmV0dXJuIGRlZmF1bHRTcXVhc2hQb2xpY3k7XG4gICAgaWYgKHZhbHVlICE9PSB0cnVlICYmIHZhbHVlICE9PSBmYWxzZSAmJiAhaXNTdHJpbmcodmFsdWUpKVxuICAgICAgdGhyb3cgbmV3IEVycm9yKFwiSW52YWxpZCBzcXVhc2ggcG9saWN5OiBcIiArIHZhbHVlICsgXCIuIFZhbGlkIHBvbGljaWVzOiBmYWxzZSwgdHJ1ZSwgYXJiaXRyYXJ5LXN0cmluZ1wiKTtcbiAgICBkZWZhdWx0U3F1YXNoUG9saWN5ID0gdmFsdWU7XG4gICAgcmV0dXJuIHZhbHVlO1xuICB9O1xuXG4gIC8qKlxuICAgKiBAbmdkb2MgZnVuY3Rpb25cbiAgICogQG5hbWUgdWkucm91dGVyLnV0aWwuJHVybE1hdGNoZXJGYWN0b3J5I2NvbXBpbGVcbiAgICogQG1ldGhvZE9mIHVpLnJvdXRlci51dGlsLiR1cmxNYXRjaGVyRmFjdG9yeVxuICAgKlxuICAgKiBAZGVzY3JpcHRpb25cbiAgICogQ3JlYXRlcyBhIHtAbGluayB1aS5yb3V0ZXIudXRpbC50eXBlOlVybE1hdGNoZXIgYFVybE1hdGNoZXJgfSBmb3IgdGhlIHNwZWNpZmllZCBwYXR0ZXJuLlxuICAgKlxuICAgKiBAcGFyYW0ge3N0cmluZ30gcGF0dGVybiAgVGhlIFVSTCBwYXR0ZXJuLlxuICAgKiBAcGFyYW0ge09iamVjdH0gY29uZmlnICBUaGUgY29uZmlnIG9iamVjdCBoYXNoLlxuICAgKiBAcmV0dXJucyB7VXJsTWF0Y2hlcn0gIFRoZSBVcmxNYXRjaGVyLlxuICAgKi9cbiAgdGhpcy5jb21waWxlID0gZnVuY3Rpb24gKHBhdHRlcm4sIGNvbmZpZykge1xuICAgIHJldHVybiBuZXcgVXJsTWF0Y2hlcihwYXR0ZXJuLCBleHRlbmQoZ2V0RGVmYXVsdENvbmZpZygpLCBjb25maWcpKTtcbiAgfTtcblxuICAvKipcbiAgICogQG5nZG9jIGZ1bmN0aW9uXG4gICAqIEBuYW1lIHVpLnJvdXRlci51dGlsLiR1cmxNYXRjaGVyRmFjdG9yeSNpc01hdGNoZXJcbiAgICogQG1ldGhvZE9mIHVpLnJvdXRlci51dGlsLiR1cmxNYXRjaGVyRmFjdG9yeVxuICAgKlxuICAgKiBAZGVzY3JpcHRpb25cbiAgICogUmV0dXJucyB0cnVlIGlmIHRoZSBzcGVjaWZpZWQgb2JqZWN0IGlzIGEgYFVybE1hdGNoZXJgLCBvciBmYWxzZSBvdGhlcndpc2UuXG4gICAqXG4gICAqIEBwYXJhbSB7T2JqZWN0fSBvYmplY3QgIFRoZSBvYmplY3QgdG8gcGVyZm9ybSB0aGUgdHlwZSBjaGVjayBhZ2FpbnN0LlxuICAgKiBAcmV0dXJucyB7Qm9vbGVhbn0gIFJldHVybnMgYHRydWVgIGlmIHRoZSBvYmplY3QgbWF0Y2hlcyB0aGUgYFVybE1hdGNoZXJgIGludGVyZmFjZSwgYnlcbiAgICogICAgICAgICAgaW1wbGVtZW50aW5nIGFsbCB0aGUgc2FtZSBtZXRob2RzLlxuICAgKi9cbiAgdGhpcy5pc01hdGNoZXIgPSBmdW5jdGlvbiAobykge1xuICAgIGlmICghaXNPYmplY3QobykpIHJldHVybiBmYWxzZTtcbiAgICB2YXIgcmVzdWx0ID0gdHJ1ZTtcblxuICAgIGZvckVhY2goVXJsTWF0Y2hlci5wcm90b3R5cGUsIGZ1bmN0aW9uKHZhbCwgbmFtZSkge1xuICAgICAgaWYgKGlzRnVuY3Rpb24odmFsKSkge1xuICAgICAgICByZXN1bHQgPSByZXN1bHQgJiYgKGlzRGVmaW5lZChvW25hbWVdKSAmJiBpc0Z1bmN0aW9uKG9bbmFtZV0pKTtcbiAgICAgIH1cbiAgICB9KTtcbiAgICByZXR1cm4gcmVzdWx0O1xuICB9O1xuXG4gIC8qKlxuICAgKiBAbmdkb2MgZnVuY3Rpb25cbiAgICogQG5hbWUgdWkucm91dGVyLnV0aWwuJHVybE1hdGNoZXJGYWN0b3J5I3R5cGVcbiAgICogQG1ldGhvZE9mIHVpLnJvdXRlci51dGlsLiR1cmxNYXRjaGVyRmFjdG9yeVxuICAgKlxuICAgKiBAZGVzY3JpcHRpb25cbiAgICogUmVnaXN0ZXJzIGEgY3VzdG9tIHtAbGluayB1aS5yb3V0ZXIudXRpbC50eXBlOlR5cGUgYFR5cGVgfSBvYmplY3QgdGhhdCBjYW4gYmUgdXNlZCB0b1xuICAgKiBnZW5lcmF0ZSBVUkxzIHdpdGggdHlwZWQgcGFyYW1ldGVycy5cbiAgICpcbiAgICogQHBhcmFtIHtzdHJpbmd9IG5hbWUgIFRoZSB0eXBlIG5hbWUuXG4gICAqIEBwYXJhbSB7T2JqZWN0fEZ1bmN0aW9ufSBkZWZpbml0aW9uICAgVGhlIHR5cGUgZGVmaW5pdGlvbi4gU2VlXG4gICAqICAgICAgICB7QGxpbmsgdWkucm91dGVyLnV0aWwudHlwZTpUeXBlIGBUeXBlYH0gZm9yIGluZm9ybWF0aW9uIG9uIHRoZSB2YWx1ZXMgYWNjZXB0ZWQuXG4gICAqIEBwYXJhbSB7T2JqZWN0fEZ1bmN0aW9ufSBkZWZpbml0aW9uRm4gKG9wdGlvbmFsKSBBIGZ1bmN0aW9uIHRoYXQgaXMgaW5qZWN0ZWQgYmVmb3JlIHRoZSBhcHBcbiAgICogICAgICAgIHJ1bnRpbWUgc3RhcnRzLiAgVGhlIHJlc3VsdCBvZiB0aGlzIGZ1bmN0aW9uIGlzIG1lcmdlZCBpbnRvIHRoZSBleGlzdGluZyBgZGVmaW5pdGlvbmAuXG4gICAqICAgICAgICBTZWUge0BsaW5rIHVpLnJvdXRlci51dGlsLnR5cGU6VHlwZSBgVHlwZWB9IGZvciBpbmZvcm1hdGlvbiBvbiB0aGUgdmFsdWVzIGFjY2VwdGVkLlxuICAgKlxuICAgKiBAcmV0dXJucyB7T2JqZWN0fSAgUmV0dXJucyBgJHVybE1hdGNoZXJGYWN0b3J5UHJvdmlkZXJgLlxuICAgKlxuICAgKiBAZXhhbXBsZVxuICAgKiBUaGlzIGlzIGEgc2ltcGxlIGV4YW1wbGUgb2YgYSBjdXN0b20gdHlwZSB0aGF0IGVuY29kZXMgYW5kIGRlY29kZXMgaXRlbXMgZnJvbSBhblxuICAgKiBhcnJheSwgdXNpbmcgdGhlIGFycmF5IGluZGV4IGFzIHRoZSBVUkwtZW5jb2RlZCB2YWx1ZTpcbiAgICpcbiAgICogPHByZT5cbiAgICogdmFyIGxpc3QgPSBbJ0pvaG4nLCAnUGF1bCcsICdHZW9yZ2UnLCAnUmluZ28nXTtcbiAgICpcbiAgICogJHVybE1hdGNoZXJGYWN0b3J5UHJvdmlkZXIudHlwZSgnbGlzdEl0ZW0nLCB7XG4gICAqICAgZW5jb2RlOiBmdW5jdGlvbihpdGVtKSB7XG4gICAqICAgICAvLyBSZXByZXNlbnQgdGhlIGxpc3QgaXRlbSBpbiB0aGUgVVJMIHVzaW5nIGl0cyBjb3JyZXNwb25kaW5nIGluZGV4XG4gICAqICAgICByZXR1cm4gbGlzdC5pbmRleE9mKGl0ZW0pO1xuICAgKiAgIH0sXG4gICAqICAgZGVjb2RlOiBmdW5jdGlvbihpdGVtKSB7XG4gICAqICAgICAvLyBMb29rIHVwIHRoZSBsaXN0IGl0ZW0gYnkgaW5kZXhcbiAgICogICAgIHJldHVybiBsaXN0W3BhcnNlSW50KGl0ZW0sIDEwKV07XG4gICAqICAgfSxcbiAgICogICBpczogZnVuY3Rpb24oaXRlbSkge1xuICAgKiAgICAgLy8gRW5zdXJlIHRoZSBpdGVtIGlzIHZhbGlkIGJ5IGNoZWNraW5nIHRvIHNlZSB0aGF0IGl0IGFwcGVhcnNcbiAgICogICAgIC8vIGluIHRoZSBsaXN0XG4gICAqICAgICByZXR1cm4gbGlzdC5pbmRleE9mKGl0ZW0pID4gLTE7XG4gICAqICAgfVxuICAgKiB9KTtcbiAgICpcbiAgICogJHN0YXRlUHJvdmlkZXIuc3RhdGUoJ2xpc3QnLCB7XG4gICAqICAgdXJsOiBcIi9saXN0L3tpdGVtOmxpc3RJdGVtfVwiLFxuICAgKiAgIGNvbnRyb2xsZXI6IGZ1bmN0aW9uKCRzY29wZSwgJHN0YXRlUGFyYW1zKSB7XG4gICAqICAgICBjb25zb2xlLmxvZygkc3RhdGVQYXJhbXMuaXRlbSk7XG4gICAqICAgfVxuICAgKiB9KTtcbiAgICpcbiAgICogLy8gLi4uXG4gICAqXG4gICAqIC8vIENoYW5nZXMgVVJMIHRvICcvbGlzdC8zJywgbG9ncyBcIlJpbmdvXCIgdG8gdGhlIGNvbnNvbGVcbiAgICogJHN0YXRlLmdvKCdsaXN0JywgeyBpdGVtOiBcIlJpbmdvXCIgfSk7XG4gICAqIDwvcHJlPlxuICAgKlxuICAgKiBUaGlzIGlzIGEgbW9yZSBjb21wbGV4IGV4YW1wbGUgb2YgYSB0eXBlIHRoYXQgcmVsaWVzIG9uIGRlcGVuZGVuY3kgaW5qZWN0aW9uIHRvXG4gICAqIGludGVyYWN0IHdpdGggc2VydmljZXMsIGFuZCB1c2VzIHRoZSBwYXJhbWV0ZXIgbmFtZSBmcm9tIHRoZSBVUkwgdG8gaW5mZXIgaG93IHRvXG4gICAqIGhhbmRsZSBlbmNvZGluZyBhbmQgZGVjb2RpbmcgcGFyYW1ldGVyIHZhbHVlczpcbiAgICpcbiAgICogPHByZT5cbiAgICogLy8gRGVmaW5lcyBhIGN1c3RvbSB0eXBlIHRoYXQgZ2V0cyBhIHZhbHVlIGZyb20gYSBzZXJ2aWNlLFxuICAgKiAvLyB3aGVyZSBlYWNoIHNlcnZpY2UgZ2V0cyBkaWZmZXJlbnQgdHlwZXMgb2YgdmFsdWVzIGZyb21cbiAgICogLy8gYSBiYWNrZW5kIEFQSTpcbiAgICogJHVybE1hdGNoZXJGYWN0b3J5UHJvdmlkZXIudHlwZSgnZGJPYmplY3QnLCB7fSwgZnVuY3Rpb24oVXNlcnMsIFBvc3RzKSB7XG4gICAqXG4gICAqICAgLy8gTWF0Y2hlcyB1cCBzZXJ2aWNlcyB0byBVUkwgcGFyYW1ldGVyIG5hbWVzXG4gICAqICAgdmFyIHNlcnZpY2VzID0ge1xuICAgKiAgICAgdXNlcjogVXNlcnMsXG4gICAqICAgICBwb3N0OiBQb3N0c1xuICAgKiAgIH07XG4gICAqXG4gICAqICAgcmV0dXJuIHtcbiAgICogICAgIGVuY29kZTogZnVuY3Rpb24ob2JqZWN0KSB7XG4gICAqICAgICAgIC8vIFJlcHJlc2VudCB0aGUgb2JqZWN0IGluIHRoZSBVUkwgdXNpbmcgaXRzIHVuaXF1ZSBJRFxuICAgKiAgICAgICByZXR1cm4gb2JqZWN0LmlkO1xuICAgKiAgICAgfSxcbiAgICogICAgIGRlY29kZTogZnVuY3Rpb24odmFsdWUsIGtleSkge1xuICAgKiAgICAgICAvLyBMb29rIHVwIHRoZSBvYmplY3QgYnkgSUQsIHVzaW5nIHRoZSBwYXJhbWV0ZXJcbiAgICogICAgICAgLy8gbmFtZSAoa2V5KSB0byBjYWxsIHRoZSBjb3JyZWN0IHNlcnZpY2VcbiAgICogICAgICAgcmV0dXJuIHNlcnZpY2VzW2tleV0uZmluZEJ5SWQodmFsdWUpO1xuICAgKiAgICAgfSxcbiAgICogICAgIGlzOiBmdW5jdGlvbihvYmplY3QsIGtleSkge1xuICAgKiAgICAgICAvLyBDaGVjayB0aGF0IG9iamVjdCBpcyBhIHZhbGlkIGRiT2JqZWN0XG4gICAqICAgICAgIHJldHVybiBhbmd1bGFyLmlzT2JqZWN0KG9iamVjdCkgJiYgb2JqZWN0LmlkICYmIHNlcnZpY2VzW2tleV07XG4gICAqICAgICB9XG4gICAqICAgICBlcXVhbHM6IGZ1bmN0aW9uKGEsIGIpIHtcbiAgICogICAgICAgLy8gQ2hlY2sgdGhlIGVxdWFsaXR5IG9mIGRlY29kZWQgb2JqZWN0cyBieSBjb21wYXJpbmdcbiAgICogICAgICAgLy8gdGhlaXIgdW5pcXVlIElEc1xuICAgKiAgICAgICByZXR1cm4gYS5pZCA9PT0gYi5pZDtcbiAgICogICAgIH1cbiAgICogICB9O1xuICAgKiB9KTtcbiAgICpcbiAgICogLy8gSW4gYSBjb25maWcoKSBibG9jaywgeW91IGNhbiB0aGVuIGF0dGFjaCBVUkxzIHdpdGhcbiAgICogLy8gdHlwZS1hbm5vdGF0ZWQgcGFyYW1ldGVyczpcbiAgICogJHN0YXRlUHJvdmlkZXIuc3RhdGUoJ3VzZXJzJywge1xuICAgKiAgIHVybDogXCIvdXNlcnNcIixcbiAgICogICAvLyAuLi5cbiAgICogfSkuc3RhdGUoJ3VzZXJzLml0ZW0nLCB7XG4gICAqICAgdXJsOiBcIi97dXNlcjpkYk9iamVjdH1cIixcbiAgICogICBjb250cm9sbGVyOiBmdW5jdGlvbigkc2NvcGUsICRzdGF0ZVBhcmFtcykge1xuICAgKiAgICAgLy8gJHN0YXRlUGFyYW1zLnVzZXIgd2lsbCBub3cgYmUgYW4gb2JqZWN0IHJldHVybmVkIGZyb21cbiAgICogICAgIC8vIHRoZSBVc2VycyBzZXJ2aWNlXG4gICAqICAgfSxcbiAgICogICAvLyAuLi5cbiAgICogfSk7XG4gICAqIDwvcHJlPlxuICAgKi9cbiAgdGhpcy50eXBlID0gZnVuY3Rpb24gKG5hbWUsIGRlZmluaXRpb24sIGRlZmluaXRpb25Gbikge1xuICAgIGlmICghaXNEZWZpbmVkKGRlZmluaXRpb24pKSByZXR1cm4gJHR5cGVzW25hbWVdO1xuICAgIGlmICgkdHlwZXMuaGFzT3duUHJvcGVydHkobmFtZSkpIHRocm93IG5ldyBFcnJvcihcIkEgdHlwZSBuYW1lZCAnXCIgKyBuYW1lICsgXCInIGhhcyBhbHJlYWR5IGJlZW4gZGVmaW5lZC5cIik7XG5cbiAgICAkdHlwZXNbbmFtZV0gPSBuZXcgVHlwZShleHRlbmQoeyBuYW1lOiBuYW1lIH0sIGRlZmluaXRpb24pKTtcbiAgICBpZiAoZGVmaW5pdGlvbkZuKSB7XG4gICAgICB0eXBlUXVldWUucHVzaCh7IG5hbWU6IG5hbWUsIGRlZjogZGVmaW5pdGlvbkZuIH0pO1xuICAgICAgaWYgKCFlbnF1ZXVlKSBmbHVzaFR5cGVRdWV1ZSgpO1xuICAgIH1cbiAgICByZXR1cm4gdGhpcztcbiAgfTtcblxuICAvLyBgZmx1c2hUeXBlUXVldWUoKWAgd2FpdHMgdW50aWwgYCR1cmxNYXRjaGVyRmFjdG9yeWAgaXMgaW5qZWN0ZWQgYmVmb3JlIGludm9raW5nIHRoZSBxdWV1ZWQgYGRlZmluaXRpb25GbmBzXG4gIGZ1bmN0aW9uIGZsdXNoVHlwZVF1ZXVlKCkge1xuICAgIHdoaWxlKHR5cGVRdWV1ZS5sZW5ndGgpIHtcbiAgICAgIHZhciB0eXBlID0gdHlwZVF1ZXVlLnNoaWZ0KCk7XG4gICAgICBpZiAodHlwZS5wYXR0ZXJuKSB0aHJvdyBuZXcgRXJyb3IoXCJZb3UgY2Fubm90IG92ZXJyaWRlIGEgdHlwZSdzIC5wYXR0ZXJuIGF0IHJ1bnRpbWUuXCIpO1xuICAgICAgYW5ndWxhci5leHRlbmQoJHR5cGVzW3R5cGUubmFtZV0sIGluamVjdG9yLmludm9rZSh0eXBlLmRlZikpO1xuICAgIH1cbiAgfVxuXG4gIC8vIFJlZ2lzdGVyIGRlZmF1bHQgdHlwZXMuIFN0b3JlIHRoZW0gaW4gdGhlIHByb3RvdHlwZSBvZiAkdHlwZXMuXG4gIGZvckVhY2goZGVmYXVsdFR5cGVzLCBmdW5jdGlvbih0eXBlLCBuYW1lKSB7ICR0eXBlc1tuYW1lXSA9IG5ldyBUeXBlKGV4dGVuZCh7bmFtZTogbmFtZX0sIHR5cGUpKTsgfSk7XG4gICR0eXBlcyA9IGluaGVyaXQoJHR5cGVzLCB7fSk7XG5cbiAgLyogTm8gbmVlZCB0byBkb2N1bWVudCAkZ2V0LCBzaW5jZSBpdCByZXR1cm5zIHRoaXMgKi9cbiAgdGhpcy4kZ2V0ID0gWyckaW5qZWN0b3InLCBmdW5jdGlvbiAoJGluamVjdG9yKSB7XG4gICAgaW5qZWN0b3IgPSAkaW5qZWN0b3I7XG4gICAgZW5xdWV1ZSA9IGZhbHNlO1xuICAgIGZsdXNoVHlwZVF1ZXVlKCk7XG5cbiAgICBmb3JFYWNoKGRlZmF1bHRUeXBlcywgZnVuY3Rpb24odHlwZSwgbmFtZSkge1xuICAgICAgaWYgKCEkdHlwZXNbbmFtZV0pICR0eXBlc1tuYW1lXSA9IG5ldyBUeXBlKHR5cGUpO1xuICAgIH0pO1xuICAgIHJldHVybiB0aGlzO1xuICB9XTtcblxuICB0aGlzLlBhcmFtID0gZnVuY3Rpb24gUGFyYW0oaWQsIHR5cGUsIGNvbmZpZywgbG9jYXRpb24pIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgY29uZmlnID0gdW53cmFwU2hvcnRoYW5kKGNvbmZpZyk7XG4gICAgdHlwZSA9IGdldFR5cGUoY29uZmlnLCB0eXBlLCBsb2NhdGlvbik7XG4gICAgdmFyIGFycmF5TW9kZSA9IGdldEFycmF5TW9kZSgpO1xuICAgIHR5cGUgPSBhcnJheU1vZGUgPyB0eXBlLiRhc0FycmF5KGFycmF5TW9kZSwgbG9jYXRpb24gPT09IFwic2VhcmNoXCIpIDogdHlwZTtcbiAgICBpZiAodHlwZS5uYW1lID09PSBcInN0cmluZ1wiICYmICFhcnJheU1vZGUgJiYgbG9jYXRpb24gPT09IFwicGF0aFwiICYmIGNvbmZpZy52YWx1ZSA9PT0gdW5kZWZpbmVkKVxuICAgICAgY29uZmlnLnZhbHVlID0gXCJcIjsgLy8gZm9yIDAuMi54OyBpbiAwLjMuMCsgZG8gbm90IGF1dG9tYXRpY2FsbHkgZGVmYXVsdCB0byBcIlwiXG4gICAgdmFyIGlzT3B0aW9uYWwgPSBjb25maWcudmFsdWUgIT09IHVuZGVmaW5lZDtcbiAgICB2YXIgc3F1YXNoID0gZ2V0U3F1YXNoUG9saWN5KGNvbmZpZywgaXNPcHRpb25hbCk7XG4gICAgdmFyIHJlcGxhY2UgPSBnZXRSZXBsYWNlKGNvbmZpZywgYXJyYXlNb2RlLCBpc09wdGlvbmFsLCBzcXVhc2gpO1xuXG4gICAgZnVuY3Rpb24gdW53cmFwU2hvcnRoYW5kKGNvbmZpZykge1xuICAgICAgdmFyIGtleXMgPSBpc09iamVjdChjb25maWcpID8gb2JqZWN0S2V5cyhjb25maWcpIDogW107XG4gICAgICB2YXIgaXNTaG9ydGhhbmQgPSBpbmRleE9mKGtleXMsIFwidmFsdWVcIikgPT09IC0xICYmIGluZGV4T2Yoa2V5cywgXCJ0eXBlXCIpID09PSAtMSAmJlxuICAgICAgICAgICAgICAgICAgICAgICAgaW5kZXhPZihrZXlzLCBcInNxdWFzaFwiKSA9PT0gLTEgJiYgaW5kZXhPZihrZXlzLCBcImFycmF5XCIpID09PSAtMTtcbiAgICAgIGlmIChpc1Nob3J0aGFuZCkgY29uZmlnID0geyB2YWx1ZTogY29uZmlnIH07XG4gICAgICBjb25maWcuJCRmbiA9IGlzSW5qZWN0YWJsZShjb25maWcudmFsdWUpID8gY29uZmlnLnZhbHVlIDogZnVuY3Rpb24gKCkgeyByZXR1cm4gY29uZmlnLnZhbHVlOyB9O1xuICAgICAgcmV0dXJuIGNvbmZpZztcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBnZXRUeXBlKGNvbmZpZywgdXJsVHlwZSwgbG9jYXRpb24pIHtcbiAgICAgIGlmIChjb25maWcudHlwZSAmJiB1cmxUeXBlKSB0aHJvdyBuZXcgRXJyb3IoXCJQYXJhbSAnXCIraWQrXCInIGhhcyB0d28gdHlwZSBjb25maWd1cmF0aW9ucy5cIik7XG4gICAgICBpZiAodXJsVHlwZSkgcmV0dXJuIHVybFR5cGU7XG4gICAgICBpZiAoIWNvbmZpZy50eXBlKSByZXR1cm4gKGxvY2F0aW9uID09PSBcImNvbmZpZ1wiID8gJHR5cGVzLmFueSA6ICR0eXBlcy5zdHJpbmcpO1xuICAgICAgcmV0dXJuIGNvbmZpZy50eXBlIGluc3RhbmNlb2YgVHlwZSA/IGNvbmZpZy50eXBlIDogbmV3IFR5cGUoY29uZmlnLnR5cGUpO1xuICAgIH1cblxuICAgIC8vIGFycmF5IGNvbmZpZzogcGFyYW0gbmFtZSAocGFyYW1bXSkgb3ZlcnJpZGVzIGRlZmF1bHQgc2V0dGluZ3MuICBleHBsaWNpdCBjb25maWcgb3ZlcnJpZGVzIHBhcmFtIG5hbWUuXG4gICAgZnVuY3Rpb24gZ2V0QXJyYXlNb2RlKCkge1xuICAgICAgdmFyIGFycmF5RGVmYXVsdHMgPSB7IGFycmF5OiAobG9jYXRpb24gPT09IFwic2VhcmNoXCIgPyBcImF1dG9cIiA6IGZhbHNlKSB9O1xuICAgICAgdmFyIGFycmF5UGFyYW1Ob21lbmNsYXR1cmUgPSBpZC5tYXRjaCgvXFxbXFxdJC8pID8geyBhcnJheTogdHJ1ZSB9IDoge307XG4gICAgICByZXR1cm4gZXh0ZW5kKGFycmF5RGVmYXVsdHMsIGFycmF5UGFyYW1Ob21lbmNsYXR1cmUsIGNvbmZpZykuYXJyYXk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogcmV0dXJucyBmYWxzZSwgdHJ1ZSwgb3IgdGhlIHNxdWFzaCB2YWx1ZSB0byBpbmRpY2F0ZSB0aGUgXCJkZWZhdWx0IHBhcmFtZXRlciB1cmwgc3F1YXNoIHBvbGljeVwiLlxuICAgICAqL1xuICAgIGZ1bmN0aW9uIGdldFNxdWFzaFBvbGljeShjb25maWcsIGlzT3B0aW9uYWwpIHtcbiAgICAgIHZhciBzcXVhc2ggPSBjb25maWcuc3F1YXNoO1xuICAgICAgaWYgKCFpc09wdGlvbmFsIHx8IHNxdWFzaCA9PT0gZmFsc2UpIHJldHVybiBmYWxzZTtcbiAgICAgIGlmICghaXNEZWZpbmVkKHNxdWFzaCkgfHwgc3F1YXNoID09IG51bGwpIHJldHVybiBkZWZhdWx0U3F1YXNoUG9saWN5O1xuICAgICAgaWYgKHNxdWFzaCA9PT0gdHJ1ZSB8fCBpc1N0cmluZyhzcXVhc2gpKSByZXR1cm4gc3F1YXNoO1xuICAgICAgdGhyb3cgbmV3IEVycm9yKFwiSW52YWxpZCBzcXVhc2ggcG9saWN5OiAnXCIgKyBzcXVhc2ggKyBcIicuIFZhbGlkIHBvbGljaWVzOiBmYWxzZSwgdHJ1ZSwgb3IgYXJiaXRyYXJ5IHN0cmluZ1wiKTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBnZXRSZXBsYWNlKGNvbmZpZywgYXJyYXlNb2RlLCBpc09wdGlvbmFsLCBzcXVhc2gpIHtcbiAgICAgIHZhciByZXBsYWNlLCBjb25maWd1cmVkS2V5cywgZGVmYXVsdFBvbGljeSA9IFtcbiAgICAgICAgeyBmcm9tOiBcIlwiLCAgIHRvOiAoaXNPcHRpb25hbCB8fCBhcnJheU1vZGUgPyB1bmRlZmluZWQgOiBcIlwiKSB9LFxuICAgICAgICB7IGZyb206IG51bGwsIHRvOiAoaXNPcHRpb25hbCB8fCBhcnJheU1vZGUgPyB1bmRlZmluZWQgOiBcIlwiKSB9XG4gICAgICBdO1xuICAgICAgcmVwbGFjZSA9IGlzQXJyYXkoY29uZmlnLnJlcGxhY2UpID8gY29uZmlnLnJlcGxhY2UgOiBbXTtcbiAgICAgIGlmIChpc1N0cmluZyhzcXVhc2gpKVxuICAgICAgICByZXBsYWNlLnB1c2goeyBmcm9tOiBzcXVhc2gsIHRvOiB1bmRlZmluZWQgfSk7XG4gICAgICBjb25maWd1cmVkS2V5cyA9IG1hcChyZXBsYWNlLCBmdW5jdGlvbihpdGVtKSB7IHJldHVybiBpdGVtLmZyb207IH0gKTtcbiAgICAgIHJldHVybiBmaWx0ZXIoZGVmYXVsdFBvbGljeSwgZnVuY3Rpb24oaXRlbSkgeyByZXR1cm4gaW5kZXhPZihjb25maWd1cmVkS2V5cywgaXRlbS5mcm9tKSA9PT0gLTE7IH0pLmNvbmNhdChyZXBsYWNlKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBbSW50ZXJuYWxdIEdldCB0aGUgZGVmYXVsdCB2YWx1ZSBvZiBhIHBhcmFtZXRlciwgd2hpY2ggbWF5IGJlIGFuIGluamVjdGFibGUgZnVuY3Rpb24uXG4gICAgICovXG4gICAgZnVuY3Rpb24gJCRnZXREZWZhdWx0VmFsdWUoKSB7XG4gICAgICBpZiAoIWluamVjdG9yKSB0aHJvdyBuZXcgRXJyb3IoXCJJbmplY3RhYmxlIGZ1bmN0aW9ucyBjYW5ub3QgYmUgY2FsbGVkIGF0IGNvbmZpZ3VyYXRpb24gdGltZVwiKTtcbiAgICAgIHZhciBkZWZhdWx0VmFsdWUgPSBpbmplY3Rvci5pbnZva2UoY29uZmlnLiQkZm4pO1xuICAgICAgaWYgKGRlZmF1bHRWYWx1ZSAhPT0gbnVsbCAmJiBkZWZhdWx0VmFsdWUgIT09IHVuZGVmaW5lZCAmJiAhc2VsZi50eXBlLmlzKGRlZmF1bHRWYWx1ZSkpXG4gICAgICAgIHRocm93IG5ldyBFcnJvcihcIkRlZmF1bHQgdmFsdWUgKFwiICsgZGVmYXVsdFZhbHVlICsgXCIpIGZvciBwYXJhbWV0ZXIgJ1wiICsgc2VsZi5pZCArIFwiJyBpcyBub3QgYW4gaW5zdGFuY2Ugb2YgVHlwZSAoXCIgKyBzZWxmLnR5cGUubmFtZSArIFwiKVwiKTtcbiAgICAgIHJldHVybiBkZWZhdWx0VmFsdWU7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogW0ludGVybmFsXSBHZXRzIHRoZSBkZWNvZGVkIHJlcHJlc2VudGF0aW9uIG9mIGEgdmFsdWUgaWYgdGhlIHZhbHVlIGlzIGRlZmluZWQsIG90aGVyd2lzZSwgcmV0dXJucyB0aGVcbiAgICAgKiBkZWZhdWx0IHZhbHVlLCB3aGljaCBtYXkgYmUgdGhlIHJlc3VsdCBvZiBhbiBpbmplY3RhYmxlIGZ1bmN0aW9uLlxuICAgICAqL1xuICAgIGZ1bmN0aW9uICR2YWx1ZSh2YWx1ZSkge1xuICAgICAgZnVuY3Rpb24gaGFzUmVwbGFjZVZhbCh2YWwpIHsgcmV0dXJuIGZ1bmN0aW9uKG9iaikgeyByZXR1cm4gb2JqLmZyb20gPT09IHZhbDsgfTsgfVxuICAgICAgZnVuY3Rpb24gJHJlcGxhY2UodmFsdWUpIHtcbiAgICAgICAgdmFyIHJlcGxhY2VtZW50ID0gbWFwKGZpbHRlcihzZWxmLnJlcGxhY2UsIGhhc1JlcGxhY2VWYWwodmFsdWUpKSwgZnVuY3Rpb24ob2JqKSB7IHJldHVybiBvYmoudG87IH0pO1xuICAgICAgICByZXR1cm4gcmVwbGFjZW1lbnQubGVuZ3RoID8gcmVwbGFjZW1lbnRbMF0gOiB2YWx1ZTtcbiAgICAgIH1cbiAgICAgIHZhbHVlID0gJHJlcGxhY2UodmFsdWUpO1xuICAgICAgcmV0dXJuICFpc0RlZmluZWQodmFsdWUpID8gJCRnZXREZWZhdWx0VmFsdWUoKSA6IHNlbGYudHlwZS4kbm9ybWFsaXplKHZhbHVlKTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiB0b1N0cmluZygpIHsgcmV0dXJuIFwie1BhcmFtOlwiICsgaWQgKyBcIiBcIiArIHR5cGUgKyBcIiBzcXVhc2g6ICdcIiArIHNxdWFzaCArIFwiJyBvcHRpb25hbDogXCIgKyBpc09wdGlvbmFsICsgXCJ9XCI7IH1cblxuICAgIGV4dGVuZCh0aGlzLCB7XG4gICAgICBpZDogaWQsXG4gICAgICB0eXBlOiB0eXBlLFxuICAgICAgbG9jYXRpb246IGxvY2F0aW9uLFxuICAgICAgYXJyYXk6IGFycmF5TW9kZSxcbiAgICAgIHNxdWFzaDogc3F1YXNoLFxuICAgICAgcmVwbGFjZTogcmVwbGFjZSxcbiAgICAgIGlzT3B0aW9uYWw6IGlzT3B0aW9uYWwsXG4gICAgICB2YWx1ZTogJHZhbHVlLFxuICAgICAgZHluYW1pYzogdW5kZWZpbmVkLFxuICAgICAgY29uZmlnOiBjb25maWcsXG4gICAgICB0b1N0cmluZzogdG9TdHJpbmdcbiAgICB9KTtcbiAgfTtcblxuICBmdW5jdGlvbiBQYXJhbVNldChwYXJhbXMpIHtcbiAgICBleHRlbmQodGhpcywgcGFyYW1zIHx8IHt9KTtcbiAgfVxuXG4gIFBhcmFtU2V0LnByb3RvdHlwZSA9IHtcbiAgICAkJG5ldzogZnVuY3Rpb24oKSB7XG4gICAgICByZXR1cm4gaW5oZXJpdCh0aGlzLCBleHRlbmQobmV3IFBhcmFtU2V0KCksIHsgJCRwYXJlbnQ6IHRoaXN9KSk7XG4gICAgfSxcbiAgICAkJGtleXM6IGZ1bmN0aW9uICgpIHtcbiAgICAgIHZhciBrZXlzID0gW10sIGNoYWluID0gW10sIHBhcmVudCA9IHRoaXMsXG4gICAgICAgIGlnbm9yZSA9IG9iamVjdEtleXMoUGFyYW1TZXQucHJvdG90eXBlKTtcbiAgICAgIHdoaWxlIChwYXJlbnQpIHsgY2hhaW4ucHVzaChwYXJlbnQpOyBwYXJlbnQgPSBwYXJlbnQuJCRwYXJlbnQ7IH1cbiAgICAgIGNoYWluLnJldmVyc2UoKTtcbiAgICAgIGZvckVhY2goY2hhaW4sIGZ1bmN0aW9uKHBhcmFtc2V0KSB7XG4gICAgICAgIGZvckVhY2gob2JqZWN0S2V5cyhwYXJhbXNldCksIGZ1bmN0aW9uKGtleSkge1xuICAgICAgICAgICAgaWYgKGluZGV4T2Yoa2V5cywga2V5KSA9PT0gLTEgJiYgaW5kZXhPZihpZ25vcmUsIGtleSkgPT09IC0xKSBrZXlzLnB1c2goa2V5KTtcbiAgICAgICAgfSk7XG4gICAgICB9KTtcbiAgICAgIHJldHVybiBrZXlzO1xuICAgIH0sXG4gICAgJCR2YWx1ZXM6IGZ1bmN0aW9uKHBhcmFtVmFsdWVzKSB7XG4gICAgICB2YXIgdmFsdWVzID0ge30sIHNlbGYgPSB0aGlzO1xuICAgICAgZm9yRWFjaChzZWxmLiQka2V5cygpLCBmdW5jdGlvbihrZXkpIHtcbiAgICAgICAgdmFsdWVzW2tleV0gPSBzZWxmW2tleV0udmFsdWUocGFyYW1WYWx1ZXMgJiYgcGFyYW1WYWx1ZXNba2V5XSk7XG4gICAgICB9KTtcbiAgICAgIHJldHVybiB2YWx1ZXM7XG4gICAgfSxcbiAgICAkJGVxdWFsczogZnVuY3Rpb24ocGFyYW1WYWx1ZXMxLCBwYXJhbVZhbHVlczIpIHtcbiAgICAgIHZhciBlcXVhbCA9IHRydWUsIHNlbGYgPSB0aGlzO1xuICAgICAgZm9yRWFjaChzZWxmLiQka2V5cygpLCBmdW5jdGlvbihrZXkpIHtcbiAgICAgICAgdmFyIGxlZnQgPSBwYXJhbVZhbHVlczEgJiYgcGFyYW1WYWx1ZXMxW2tleV0sIHJpZ2h0ID0gcGFyYW1WYWx1ZXMyICYmIHBhcmFtVmFsdWVzMltrZXldO1xuICAgICAgICBpZiAoIXNlbGZba2V5XS50eXBlLmVxdWFscyhsZWZ0LCByaWdodCkpIGVxdWFsID0gZmFsc2U7XG4gICAgICB9KTtcbiAgICAgIHJldHVybiBlcXVhbDtcbiAgICB9LFxuICAgICQkdmFsaWRhdGVzOiBmdW5jdGlvbiAkJHZhbGlkYXRlKHBhcmFtVmFsdWVzKSB7XG4gICAgICB2YXIga2V5cyA9IHRoaXMuJCRrZXlzKCksIGksIHBhcmFtLCByYXdWYWwsIG5vcm1hbGl6ZWQsIGVuY29kZWQ7XG4gICAgICBmb3IgKGkgPSAwOyBpIDwga2V5cy5sZW5ndGg7IGkrKykge1xuICAgICAgICBwYXJhbSA9IHRoaXNba2V5c1tpXV07XG4gICAgICAgIHJhd1ZhbCA9IHBhcmFtVmFsdWVzW2tleXNbaV1dO1xuICAgICAgICBpZiAoKHJhd1ZhbCA9PT0gdW5kZWZpbmVkIHx8IHJhd1ZhbCA9PT0gbnVsbCkgJiYgcGFyYW0uaXNPcHRpb25hbClcbiAgICAgICAgICBicmVhazsgLy8gVGhlcmUgd2FzIG5vIHBhcmFtZXRlciB2YWx1ZSwgYnV0IHRoZSBwYXJhbSBpcyBvcHRpb25hbFxuICAgICAgICBub3JtYWxpemVkID0gcGFyYW0udHlwZS4kbm9ybWFsaXplKHJhd1ZhbCk7XG4gICAgICAgIGlmICghcGFyYW0udHlwZS5pcyhub3JtYWxpemVkKSlcbiAgICAgICAgICByZXR1cm4gZmFsc2U7IC8vIFRoZSB2YWx1ZSB3YXMgbm90IG9mIHRoZSBjb3JyZWN0IFR5cGUsIGFuZCBjb3VsZCBub3QgYmUgZGVjb2RlZCB0byB0aGUgY29ycmVjdCBUeXBlXG4gICAgICAgIGVuY29kZWQgPSBwYXJhbS50eXBlLmVuY29kZShub3JtYWxpemVkKTtcbiAgICAgICAgaWYgKGFuZ3VsYXIuaXNTdHJpbmcoZW5jb2RlZCkgJiYgIXBhcmFtLnR5cGUucGF0dGVybi5leGVjKGVuY29kZWQpKVxuICAgICAgICAgIHJldHVybiBmYWxzZTsgLy8gVGhlIHZhbHVlIHdhcyBvZiB0aGUgY29ycmVjdCB0eXBlLCBidXQgd2hlbiBlbmNvZGVkLCBkaWQgbm90IG1hdGNoIHRoZSBUeXBlJ3MgcmVnZXhwXG4gICAgICB9XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9LFxuICAgICQkcGFyZW50OiB1bmRlZmluZWRcbiAgfTtcblxuICB0aGlzLlBhcmFtU2V0ID0gUGFyYW1TZXQ7XG59XG5cbi8vIFJlZ2lzdGVyIGFzIGEgcHJvdmlkZXIgc28gaXQncyBhdmFpbGFibGUgdG8gb3RoZXIgcHJvdmlkZXJzXG5hbmd1bGFyLm1vZHVsZSgndWkucm91dGVyLnV0aWwnKS5wcm92aWRlcignJHVybE1hdGNoZXJGYWN0b3J5JywgJFVybE1hdGNoZXJGYWN0b3J5KTtcbmFuZ3VsYXIubW9kdWxlKCd1aS5yb3V0ZXIudXRpbCcpLnJ1bihbJyR1cmxNYXRjaGVyRmFjdG9yeScsIGZ1bmN0aW9uKCR1cmxNYXRjaGVyRmFjdG9yeSkgeyB9XSk7XG4iXSwiZmlsZSI6ImFuZ3VsYXItdWktcm91dGVyL3NyYy91cmxNYXRjaGVyRmFjdG9yeS5qcyIsInNvdXJjZVJvb3QiOiIvc291cmNlLyJ9