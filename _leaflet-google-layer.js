(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
  (function (global){
    var L = (typeof window !== "undefined" ? window['L'] : typeof global !== "undefined" ? global['L'] : null)


    /**
     * Converts Leaflet BBoxString to Bing BBox
     * @param {String} bboxString 'southwest_lng,southwest_lat,northeast_lng,northeast_lat'
     * @return {Array} [south_lat, west_lng, north_lat, east_lng]
     */
    function toBingBBox (bboxString) {
      var bbox = bboxString.split(',');
      return [bbox[1], bbox[0], bbox[3], bbox[2]]
    }

    var VALID_MAP_TYPES = ['roadmap', 'satellite'];

    L.TileLayer.Google = L.TileLayer.extend({
      options: {
        GoogleTileAPIKey: null, // Required
        mapType: 'roadmap',
        language: 'en-GB',
        region: 'gb'
      },

      statics: {
        TILE_REQUEST: 'https://www.googleapis.com/tile/v1/tiles/{z}/{x}/{y}?session={sessionToken}&orientation=0&key={GoogleTileAPIKey}',
        ATTRIBUTION_URL: 'https://www.googleapis.com/tile/v1/viewport?session={sessionToken}&zoom={zoom}&north={north}&south={south}&east={east}&west={west}&key={GoogleTileAPIKey}',
        SESSION_TOKEN_URL: 'https://www.googleapis.com/tile/v1/createSession?key={GoogleTileAPIKey}'

      },

      _refreshToken: function () {
        var xhttp = new XMLHttpRequest();
        var sessionTokenUrl = L.Util.template(L.TileLayer.Google.SESSION_TOKEN_URL, {
          GoogleTileAPIKey: this.options.GoogleTileAPIKey
        });
        // Synchronous!
        xhttp.open("POST", sessionTokenUrl, false);
        xhttp.setRequestHeader("Content-type", "application/json");
        xhttp.send(JSON.stringify({
          "mapType": this.options.mapType,
          "language": this.options.language,
          "region": this.options.region,
//          "layerTypes": [ "layerRoadmap", "layerStreetview" ],
          "overlay":  true,
          "scale": "scaleFactor1x"
        }));

        this._sessionToken = JSON.parse(xhttp.responseText).session;
      },

      initialize: function (options) {
        if (!options || !options.GoogleTileAPIKey) {
          throw new Error('Must supply options.GoogleTileAPIKey')
        }
        options = L.setOptions(this, options);
        if (VALID_MAP_TYPES.indexOf(options.mapType) < 0) {
          throw new Error("'" + options.mapType + "' is an invalid mapType")
        }

        this._refreshToken();

        // for https://github.com/Leaflet/Leaflet/issues/137
        if (!L.Browser.android) {
          this.on('tileunload', this._onTileRemove)
        }
      },

      // Defined by Leaflet
      createTile: function (coords, done) {
        var tile = document.createElement('img');

        L.DomEvent.on(tile, 'load', L.bind(this._tileOnLoad, this, done, tile));
        L.DomEvent.on(tile, 'error', L.bind(this._tileOnError, this, done, tile));

        if (this.options.crossOrigin) {
          tile.crossOrigin = ''
        }

        /*
         Alt tag is set to empty string to keep screen readers from reading URL and for compliance reasons
         http://www.w3.org/TR/WCAG20-TECHS/H67
         */
        tile.alt = '';
        tile.src = this.getTileUrl(coords);

        return tile
      },

      // Defined by Leaflet: this is for the first attribution
      getAttribution: function () {
        console.log('getAttribution');
        return this.attribution;
      },

      // Defined by Leaflet
      getTileUrl: function (coords) {
        return L.Util.template(L.TileLayer.Google.TILE_REQUEST, {
          z: coords.z,
          x: coords.x,
          y: coords.y,
          sessionToken: this._sessionToken,
          GoogleTileAPIKey: this.options.GoogleTileAPIKey
        })
      },

      // Defined by leaflet
      // Runs every time the layer has been added to the map
      // Update the attribution control every time the map is moved
      onAdd: function (map) {
        map.on('moveend', this._updateAttribution, this);
        L.TileLayer.prototype.onAdd.call(this, map);
        this._updateAttribution()
      },

      // Clean up events and remove attributions from attribution control
      onRemove: function (map) {
        map.off('moveend', this._updateAttribution, this);
        // TODO Remove attributions for this map
        map.attributionControl.removeAttribution(this.attribution);
        L.TileLayer.prototype.onRemove.call(this, map)
      },


      /**
       * Update the attribution control of the map with the provider attributions
       * within the current map bounds
       */
      _updateAttribution: function () {
        var map = this._map;
        if (!map || !map.attributionControl) return;
        var zoom = map.getZoom();
        var bbox = toBingBBox(map.getBounds().toBBoxString());

        var attributionUrl = L.Util.template(L.TileLayer.Google.ATTRIBUTION_URL, {
          GoogleTileAPIKey: this.options.GoogleTileAPIKey,
          sessionToken: this._sessionToken,
          zoom: zoom,
          east: bbox[0],
          south: bbox[1],
          west: bbox[2],
          north: bbox[3]
        });

        var _this = this;
        var xhttp = new XMLHttpRequest();
        xhttp.onreadystatechange = function() {
          if (this.readyState === 4 && this.status === 200) {
            map.attributionControl.removeAttribution(_this.attribution);
            _this.attribution = JSON.parse(this.responseText).copyright;
            map.attributionControl.addAttribution(_this.attribution);
          }
        };
        xhttp.open("GET", attributionUrl, true);
        xhttp.send();
      }

    });

    L.tileLayer.google = function (options) {
      return new L.TileLayer.Google(options)
    };

    module.exports = L.TileLayer.Google

  }).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"bbox-intersect":2,"fetch-jsonp":3}],2:[function(require,module,exports){
  module.exports = function(bbox1, bbox2){
    if(!(
        bbox1[0] > bbox2[2] ||
        bbox1[2] < bbox2[0] ||
        bbox1[3] < bbox2[1] ||
        bbox1[1] > bbox2[3]
      )){
      return true;
    } else {
      return false;
    }
  }
},{}],3:[function(require,module,exports){
  (function (global, factory) {
    if (typeof define === 'function' && define.amd) {
      define(['exports', 'module'], factory);
    } else if (typeof exports !== 'undefined' && typeof module !== 'undefined') {
      factory(exports, module);
    } else {
      var mod = {
        exports: {}
      };
      factory(mod.exports, mod);
      global.fetchJsonp = mod.exports;
    }
  })(this, function (exports, module) {
    'use strict';

    var defaultOptions = {
      timeout: 5000,
      jsonpCallback: 'callback',
      jsonpCallbackFunction: null
    };

    function generateCallbackFunction() {
      return 'jsonp_' + Date.now() + '_' + Math.ceil(Math.random() * 100000);
    }

    // Known issue: Will throw 'Uncaught ReferenceError: callback_*** is not defined' error if request timeout
    function clearFunction(functionName) {
      // IE8 throws an exception when you try to delete a property on window
      // http://stackoverflow.com/a/1824228/751089
      try {
        delete window[functionName];
      } catch (e) {
        window[functionName] = undefined;
      }
    }

    function removeScript(scriptId) {
      var script = document.getElementById(scriptId);
      document.getElementsByTagName('head')[0].removeChild(script);
    }

    var fetchJsonp = function fetchJsonp(url) {
      var options = arguments[1] === undefined ? {} : arguments[1];

      var timeout = options.timeout != null ? options.timeout : defaultOptions.timeout;
      var jsonpCallback = options.jsonpCallback != null ? options.jsonpCallback : defaultOptions.jsonpCallback;

      var timeoutId = undefined;

      return new Promise(function (resolve, reject) {
        var callbackFunction = options.jsonpCallbackFunction || generateCallbackFunction();

        window[callbackFunction] = function (response) {
          resolve({
            ok: true,
            // keep consistent with fetch API
            json: function json() {
              return Promise.resolve(response);
            }
          });

          if (timeoutId) clearTimeout(timeoutId);

          removeScript(jsonpCallback + '_' + callbackFunction);

          clearFunction(callbackFunction);
        };

        // Check if the user set their own params, and if not add a ? to start a list of params
        url += url.indexOf('?') === -1 ? '?' : '&';

        var jsonpScript = document.createElement('script');
        jsonpScript.setAttribute('src', url + jsonpCallback + '=' + callbackFunction);
        jsonpScript.id = jsonpCallback + '_' + callbackFunction;
        document.getElementsByTagName('head')[0].appendChild(jsonpScript);

        timeoutId = setTimeout(function () {
          reject(new Error('JSONP request to ' + url + ' timed out'));

          clearFunction(callbackFunction);
          removeScript(jsonpCallback + '_' + callbackFunction);
        }, timeout);
      });
    };

    // export as global function
    /*
     let local;
     if (typeof global !== 'undefined') {
     local = global;
     } else if (typeof self !== 'undefined') {
     local = self;
     } else {
     try {
     local = Function('return this')();
     } catch (e) {
     throw new Error('polyfill failed because global object is unavailable in this environment');
     }
     }

     local.fetchJsonp = fetchJsonp;
     */

    module.exports = fetchJsonp;
  });
},{}]},{},[1]);