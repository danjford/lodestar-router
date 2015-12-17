/* LodestarJS Router - 1.0.0. 
Author: Dan J Ford 
Contributors:  
Published: Thu Dec 17 2015 11:40:37 GMT+0000 (GMT) 
Commit Hash: none */

(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory() :
  typeof define === 'function' && define.amd ? define(factory) :
  global.Router = factory();
}(this, function () { 'use strict';

  var hasConsole = typeof console !== 'undefined';
  var hasCollapsedConsole = !!console.groupCollapsed;
  var hasHistory = !!(window.history && history.pushState);
  var hasEventListener = !!window.addEventListener;

  function fullExtend(dest, objs, deep) {
    for (var i = 0, ii = objs.length; i < ii; i++) {
      var obj = objs[i];

      if (!isObject(obj)) return;

      var objKeys = Object.keys(obj);

      for (var j = 0, jj = objKeys.length; j < jj; j++) {
        var key = objKeys[j];
        var val = obj[key];

        if (isObject(val) && deep) {
          if (!isObject(dest[key])) dest[key] = Array.isArray(val) ? [] : {};
          fullExtend(dest[key], [val], true);
        } else {
          dest[key] = val;
        }
      }
    }

    return dest;
  }

  /**
   * Low extend of the object i.e. not recursive copy
   *
   * @param  {Object} dest, the object that will have properties copied to it
   * @param  {Object} val, the second object with the properties to copy
   * @return {Object} the new object with properties copied to it
   */
  function merge(dest, val) {
    return fullExtend(dest, [val], false);
  }

  /**
   * Deep extend the object i.e. recursive copy
   *
   * @param  {Object} dest, the object that will have properties copied to it
   * @param  {Object} val, the second object with the properties to copy
   * @return {Object} the new object with properties copied to it
   */
  function copy(dest, val) {
    return fullExtend(dest, [val], true);
  }

  /**
   * @param  {Object} val, the parameter to check if it is a object
   * @return {Boolean} whether or not the parameter is an object
   */
  function isObject(val) {
    return val !== null && typeof val === 'object';
  }

  var globals = {
    DEBUG: true
  };
  var defaultConfig = {
    useHistory: false,
    basePath: '',
    loggingLevel: 'LOW', // options are LOW or HIGH
    usingMap: '',
    listenerActive: false
  };
  /**
   * This initialises the config for each instance with a fresh config
   * @param  {Object} _this, this passed in from the constructore
   * @return {Void}, nothing returned
   */
  function initConfig(_this) {

    _this.routes = {};
    _this.config = merge({}, defaultConfig);
  }

  /**
   * Modifies the config for an instance
   * @param  {Object} _this, this passed in from the constructore
   * @param  {Object} changes, the changes the user wants to make to the config.
   * @return {Void}, nothing returned
   */
  function modifyConfig(_this, changes) {

    if (changes) {

      if (typeof changes.DEBUG !== 'undefined') globals = copy({}, { DEBUG: changes.DEBUG });delete changes.DEBUG;

      if (changes.loggingLevel) changes.loggingLevel = changes.loggingLevel.toUpperCase();

      _this.config = fullExtend({}, [_this.config, changes], true);
    }

    return _this.config;
  }

  var logger = {};

  logger.debug = function () {
    if (hasConsole && globals.DEBUG) console.debug.apply(console, arguments);
  };

  logger.log = function () {
    if (hasConsole && globals.DEBUG) console.log.apply(console, arguments);
  };

  logger.warn = function () {
    if (hasConsole && globals.DEBUG) console.warn.apply(console, arguments);
  };

  var routerIntro = ['LodestarJs-Router 1.0.0 in debug mode.'];
  var routerMessage = '\n\nHello, you are running the LodestarJs Router 1.0.0 in debug mode.\nThis will help you to identify any problems in your application.\n\nDEBUG mode is a global option, to disable debug mode will disable it for each\ninstance. You can disable it when declaring a new instance. For example,\nnew Router({DEBUG: false});\n\nFor documentation head to the wiki:\n  https://github.com/lodestarjs/lodestar-router/wiki\n\nIf you have found any bugs, create an issue for us:\n  https://github.com/lodestarjs/lodestar-router/issues\n\n';

  /**
   * The welcome function gives a message to the user letting the know
   * some key things about the Router.
   * @return {Void}, nothing returned
   */
  function welcome() {

    if (hasConsole && globals.DEBUG) {

      console[hasCollapsedConsole ? 'groupCollapsed' : 'log'].apply(console, routerIntro);

      console.log(routerMessage);

      if (hasCollapsedConsole) {
        console.groupEnd(routerIntro);
      }
    }
  }

  /**
   * Logs the route that has not been found.
   * @param  {String} path, the child of the parent route to watch.
   * @param  {String} originalPath, the original path
   * @return {Void}, nothing returned
   */
  function notFoundLog(path, originalPath) {
    logger.warn('Route ' + path + ' of ' + originalPath + ' not found.');
  }

  /**
   * Clears the routes cache of no longer needed active routes
   * @param  {String} key, the original to not remove active from
   * @param  {Object} pointer, the pointer to clear the cache from
   * @return {Void}, nothing returned
   */
  function clearCache(key, pointer) {

    var props = Object.getOwnPropertyNames(pointer);

    for (var i = 0, ii = props.length; i < ii; i++) {

      if (props[i] !== key) {

        pointer[props[i]].active = false;

        if (pointer[props[i]].childRoutes) {

          clearCache(false, pointer[props[i]].childRoutes);
        }
      }
    }
  }

  /**
   * Splits the dynamic part
   * @param  {String} path, the current path to match the dynamic section
   * @param  {Array} splitKey, the path split into dynamic segments
   * @return {Object}, the object to map the dynamic segments into
   */
  function dynamicSplit(path, splitKey) {

    var output = {};

    splitKey.shift();

    for (var i = 0, ii = splitKey.length; i < ii; i++) {

      output[splitKey[i].replace(/\//g, '')] = path.match(/[^\/]*/g)[i !== 0 ? i + i : i];
    }

    return output;
  }

  /**
   * The page not found function, will execute a not found function that the user sets up
   * @param  {String} path, the current path that was not found
   * @param  {String} originalPath, the parent of the current path that was not found
   * @return {Void}, nothing returned
   */
  function pageNotFound(path, originalPath) {

    if (typeof this.userNotFound !== 'undefined') this.userNotFound();

    notFoundLog(path, originalPath);
  }

  /**
   * This goes through the entire routing tree, executing the matching paths.
   *
   * It also makes use of caching as in that it will only need to execute the
   * paths that are necessary.
   *
   * @param  {String} path, the current path that we are on
   * @return {Void}, nothing returned
   */
  function resolve(path) {

    if (!path) return;

    var pointer = this.routes,
        originalPath = path,
        isFinal = false,
        keyCache = '',
        matchedParent = false;

    while (path.length) {

      var routeData = {};

      // For each child of the current pointer which is some child of routes
      for (var key in pointer) {

        var dynamicKey = false;

        keyCache = key;

        // If contains : then it has dynamic segments
        if (key.indexOf(':') > -1) {

          var splitKey = key.split(':');

          // If there are more : than expected then there are multiple dynamic segments
          if (splitKey.length > 2) {

            routeData = dynamicSplit(path, splitKey);
            dynamicKey = key.replace(/\:[^\/]*/g, '[^\\/]*');
          } else {

            routeData[key.replace(':', '')] = path.match(/[^\/]*/)[0];
            dynamicKey = /[^\/]*/;
          }
        }

        // If contains * then there is a wildcard segment
        if (key.match(/\*[a-z]+/i)) {

          routeData[key.replace(/\*[a-z]+/i, '')] = path.match(/.*/)[0].split('/');
          dynamicKey = /.*/;
        }

        matchedParent = path.match('^' + (dynamicKey || key));

        // Find out if we're on the final run
        isFinal = matchedParent && path.replace(matchedParent[0], '').replace(/^\//, '').replace(/\/$/, '').length === 0 ? true : false;

        if (path.length && matchedParent) {

          // If it's not the final run and the current route is not active, execute it
          if (!pointer[key].active && !isFinal) {

            pointer[key].routeData = routeData;
            pointer[key].active = true;
            pointer[key].controller();
          }

          // Remove current part from the path
          path = path.replace(matchedParent[0], '').replace(/^\//, '').replace(/\/$/, '');

          // Remove active from siblings and their children
          if (pointer[key]) clearCache(key, pointer);

          // If it is not final then re-assign the pointer
          if (pointer[key].childRoutes && !isFinal) {

            pointer = pointer[key].childRoutes;
          } else if (!isFinal) {

            pageNotFound.call(this, path, originalPath);
            path = '';
          }

          break;
        }
      }

      // If it's the final page, re-execute it and set to active
      if (isFinal) {

        pointer[keyCache].routeData = routeData;
        pointer[keyCache].active = true;
        pointer[keyCache].controller();
      } else if (!matchedParent) {

        pageNotFound.call(this, path, originalPath);
        path = '';
        break;
      }
    }
  }

  /**
   * Used in createRoute to map a routing object to a parent in a way
   * that the Router can understand it.
   * @param  {String} parents, the parent path
   * @param  {Object} routeObject, the object to add as a child
   * @return {Void}, nothing returned
   */
  function traverse(parents, routeObject) {

    var pointer = this.routes,
        createPointer = {};

    while (parents.length) {

      for (var key in pointer) {

        var matchedParent = parents.match('^' + key);

        if (parents.length && matchedParent) {

          parents = parents.replace(matchedParent[0], '').replace(/^\//, '').replace(/\/$/, '');

          createPointer = pointer[key];
          pointer = pointer[key].childRoutes || pointer[key];

          break;
        }
      }
    }

    if (typeof createPointer.childRoutes === 'undefined') {
      createPointer.childRoutes = {};
    }

    routeObject.path = routeObject.path.substring(routeObject.path.indexOf(']') + 1).replace(/^\//, '').replace(/\/$/, '');

    createPointer.childRoutes[routeObject.path] = {};
    createPointer.childRoutes[routeObject.path].controller = routeObject.controller;
  }

  /**
   * Returns all of the current routes in this instance of the Router.
   * @return {Object} returns the routes.
   */
  function getRoutes() {

    return copy({}, this.routes);
  }

  function formatRoute(route) {

    if (route === '') {
      route = '/';
    }

    route = route.replace(/^(\/?[\#\!\?]+)/, '').replace(/$\//, '');

    if (this.config.basePath.length) {
      route.replace(this.config.basePath, '');
    }

    return route;
  }

  /**
   * For createRoute() grab the parent specified in the []
   * @param  {String} url, the route to find a parent in
   * @return {String}, the parent URL
   */
  function getParent(url) {
    var begin = url.indexOf('[') + 1,
        end = url.indexOf(']');
    return url.substring(begin, end);
  }

  /**
   * Removes the origin from the link, for those who are using absolute links..
   * @param  {String} link, the link to have the origin removed from it.
   * @return {String}, the link with the origin removed.
   */
  function removeOrigin(link) {

    if (!window.location.origin) {
      return link.replace(window.location.protocol + '//' + window.location.hostname + (window.location.port ? ':' + window.location.port : ''), '');
    } else {
      return link.replace(window.location.origin, '');
    }
  }

  /**
   * Traverses through the parent nodes to look for an Anchor tag.
   * Used in historyMode.
   * @param  {HTMLElement} target, the element to begin traversing from.
   * @return {Boolean|HTMLElement} returns false or the found element.
   */
  function checkParents(target) {

    while (target) {

      if (target instanceof HTMLAnchorElement) {
        return target;
      }

      target = target.parentNode;
    }

    return false;
  }

  /**
   * On click, finds the anchor tag formats the link and returns it.
   * @param  {Event} e, the event passed through from the click event.
   * @return {String} returns the formatted href for this link
   */
  function historyClick(e) {

    e = window.e || e;

    var target = e.target,
        anchorLink = '';

    if (target.tagName !== 'A') target = checkParents(target);

    if (!target) return;

    anchorLink = target.getAttribute('href');

    if (anchorLink === '_blank' || anchorLink.indexOf(':') > -1 && !anchorLink.match(/(?:https?|s?ftp):/)) return;

    return formatRoute.call(this, removeOrigin(anchorLink));
  }

  /**
   * This sets up the events for 'Hashchange' and 'History' mode depending on what has been selected and what is available.
   * @return {Void}, nothing returned
   */
  function listener() {
    var _this = this;

    if (this.config.listenerActive) return;

    if (this.config.loggingLevel === 'HIGH') logger.debug('Listener is now active.');

    var windowListener = hasEventListener ? window.addEventListener : window.attachEvent,
        docListener = hasEventListener ? document.addEventListener : document.attachEvent,
        initialLink = this.config.useHistory && hasHistory ? window.location.pathname : window.location.hash;

    this.config.listenerActive = true;

    if (!this.config.useHistory || !hasHistory) {

      if (this.config.loggingLevel === 'HIGH') logger.debug('Listening for hash changes.');

      windowListener(hasEventListener ? 'hashchange' : 'onhashchange', function () {
        _this.resolve(formatRoute.call(_this, window.location.hash));
      });
    } else if (this.config.useHistory && hasHistory) {

      if (this.config.loggingLevel === 'HIGH') logger.debug('Listening for clicks or popstate.');

      docListener('click', function (e) {
        _this.resolve(historyClick.call(_this, e));
      });
      windowListener('popstate', function () {
        _this.resolve(formatRoute.call(_this, window.location.pathname));
      });
    }

    // Fire the initial page load link
    this.resolve(formatRoute.call(this, initialLink));
  }

  /**
   * The bare bones-way of creating a routing object
   * @param  {Object} routeObject, the route object as the Router expects it
   * @return {Void}, nothing returned
   */
  function map(routeObject) {

    if (this.config.usingMap === false) throw new Error('Do not use map() as well as createRoute().');

    for (var key in routeObject) {

      this.routes[key] = routeObject[key];
    }

    this.config.usingMap = true;

    listener.call(this);
  }

  /**
   * The nicer way of creating a route filled with validation, may take longer than map().
   * @param  {Object} routeObject, an object that the Router will translate into an object it can understand
   * @return {Void}, nothing returned
   */
  function createRoute(routeObject) {
    var _this = this;

    if (this.config.usingMap === true) throw new Error('Do not use createRoute() as well as map().');

    if (!routeObject) throw new Error('No route object defined.');

    if (!routeObject.path) throw new Error('Please define the route to use.');

    if (!routeObject.controller || typeof routeObject.controller !== 'function') throw new Error('Please define the function that should be executed.');

    var parentUrls = '';

    if (routeObject.path.indexOf('[') > -1) {

      parentUrls = getParent(routeObject.path);

      traverse.call(this, parentUrls, routeObject);
    } else {

      routeObject.path = formatRoute.call(this, routeObject.path);
      this.routes[routeObject.path] = {};
      this.routes[routeObject.path].controller = routeObject.controller;
    }

    if (this.config.usingMap === '') {

      setTimeout(function () {
        listener.call(_this);
      }, 0);
    }

    this.config.usingMap = false;
  }

  function Router(options) {

    initConfig(this);

    modifyConfig(this, options);

    welcome();
  }

  Router.prototype = {

    createRoute: createRoute,
    map: map,
    getRoutes: getRoutes,
    resolve: resolve,
    notFound: function notFound(callback) {
      this.userNotFound = callback;
    }

  };

  return Router;

}));