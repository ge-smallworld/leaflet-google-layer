(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
(function (global){
var L = (typeof window !== "undefined" ? window['L'] : typeof global !== "undefined" ? global['L'] : null);
var VALID_MAP_TYPES = ['roadmap', 'satellite'];

L.TileLayer.Google = L.TileLayer.extend({
  options: {
    GoogleTileAPIKey: null, // Required
    mapType: 'roadmap',
    language: 'en-GB',
    region: 'gb',
    mapStyle: []
  },

  statics: {
    TILE_REQUEST: 'https://www.googleapis.com/tile/v1/tiles/{z}/{x}/{y}?session={sessionToken}&orientation=0&key={GoogleTileAPIKey}',
    ATTRIBUTION_URL: 'https://www.googleapis.com/tile/v1/viewport?session={sessionToken}&zoom={zoom}&north={north}&south={south}&east={east}&west={west}&key={GoogleTileAPIKey}',
    SESSION_TOKEN_URL: 'https://www.googleapis.com/tile/v1/createSession?key={GoogleTileAPIKey}'

  },

  _getSessionToken: function () {
    var _this = this;
    if (!this._exponentialBackoff) {
      this._exponentialBackoff = 1000;
    }
    if (!this._promise) {
      this._promise = new Promise(function (resolve, reject) {
        var sessionTokenUrl = L.Util.template(L.TileLayer.Google.SESSION_TOKEN_URL, {
          GoogleTileAPIKey: _this.options.GoogleTileAPIKey
        });
        var body = JSON.stringify({
          mapType: _this.options.mapType,
          language: _this.options.language,
          region: _this.options.region,
          overlay: true,
          scale: 'scaleFactor1x',
          styles: _this.options.mapStyle
        });
        var xhttp = new XMLHttpRequest();

        xhttp.open('POST', sessionTokenUrl, true);
        xhttp.setRequestHeader('Content-type', 'application/json');
        xhttp.onreadystatechange = function () {
          if (this.readyState === 4) {
            if (this.status === 200) {
              _this._exponentialBackoff = null;
              var token = JSON.parse(xhttp.responseText);
              _this._sessionToken = token.session;
              resolve(token);
            } else {
              setTimeout(function() {
                _this._promise = null;
                _this._exponentialBackoff *= 2;
                _this._getSessionToken();
              }, _this._exponentialBackoff);

              reject('Session request failed, trying again in ' + _this._exponentialBackoff/1000 + 'seconds');
            }
          }
        };
        xhttp.send(body);
      });
    }
    return this._promise;
  },

  _refreshToken: function () {
    var _this = this;
    this._getSessionToken()
      .then(function (token) {
        setTimeout(function () {
          if (_this._needToRefreshToken) {
            _this._promise = null;
            _this._refreshToken();
          }
        }, (token.expiry * 1000 - new Date().getTime() - 3600000));
      })
      .catch(function(e) {
        console.error('refreshToken', e);
      });
  },

  initialize: function (options) {
    if (!options || !options.GoogleTileAPIKey) {
      throw new Error('Must supply options.GoogleTileAPIKey');
    }
    options = L.setOptions(this, options);
    if (VALID_MAP_TYPES.indexOf(options.mapType) < 0) {
      throw new Error("'" + options.mapType + "' is an invalid mapType");
    }
    this._sessionToken = null;
    this._needToRefreshToken = false;
    this._promise = null;

    // for https://github.com/Leaflet/Leaflet/issues/137
    if (!L.Browser.android) {
      this.on('tileunload', this._onTileRemove);
    }
  },

  createTile: function (coords, done) {
    var tile = document.createElement('img');

    L.DomEvent.on(tile, 'load', L.bind(this._tileOnLoad, this, done, tile));
    L.DomEvent.on(tile, 'error', L.bind(this._tileOnError, this, done, tile));

    if (this.options.crossOrigin) {
      tile.crossOrigin = '';
    }

    /*
     Alt tag is set to empty string to keep screen readers from reading URL and for compliance reasons
     http://www.w3.org/TR/WCAG20-TECHS/H67
     */
    tile.alt = '';
    this._getSessionToken()
      .then(function(token) {
        tile.src = this.getTileUrl(coords);
        done(null, tile);
      }.bind(this))
      .catch(function(e) {
        console.error(e);
        done(e);
      });

    return tile;
  },

  // Defined by Leaflet: this is for the first attribution
  getAttribution: function () {
    return this.attribution;
  },

  getTileUrl: function (coords) {
    return L.Util.template(L.TileLayer.Google.TILE_REQUEST, {
      z: coords.z,
      x: coords.x,
      y: coords.y,
      sessionToken: this._sessionToken,
      GoogleTileAPIKey: this.options.GoogleTileAPIKey
    });
  },

  // Defined by leaflet
  // Runs every time the layer has been added to the map
  // Update the attribution control every time the map is moved
  onAdd: function (map) {
    map.on('moveend', this._updateAttribution, this);
    L.TileLayer.prototype.onAdd.call(this, map);
    this._needToRefreshToken = true;
    this._refreshToken();
    this._updateAttribution();
  },

  // Clean up events and remove attributions from attribution control
  onRemove: function (map) {
    map.off('moveend', this._updateAttribution, this);
    this._needToRefreshToken = false;
    this._promise = null;
    map.attributionControl.removeAttribution(this.attribution);
    this.attribution = null;
    L.TileLayer.prototype.onRemove.call(this, map);
  },

  /**
   * Sets a new Google Map Tiles API key. Resets the layer's tiles and requests new
   * tiles with the updated key.
   *
   * @param {String} newKey - A valid Google Maps API key
   */
  setKey: function(newKey) {
    if (newKey && this.options.GoogleTileAPIKey !== newKey) {
      this.options.GoogleTileAPIKey = newKey;
      this._getSessionToken().then(function() {
        this.redraw();
      }.bind(this));
    }
  },

  setLanguage: function(newLanguage) {
    if (newLanguage && this.options.language !== newLanguage) {
      this.options.language = newLanguage;
      this._promise = null;
      this._getSessionToken().then(function() {
        this.redraw();
        this._updateAttribution();
      }.bind(this));
    }
  },

  /**
   * Sets a new map type for the the Google tile layer. If the map type
   * is valid and different than the current map type, the layer's tiles
   * will be reset and new tiles will be requested.
   *
   * @param {String} newSet - The name of the new imagery set
   */
  setMapType: function(newSet) {
    if (!newSet || VALID_MAP_TYPES.indexOf(newSet) === -1) {
      throw new Error("'" + newSet + "' is an invalid mapType");
    }

    if (this.options.mapType !== newSet) {
      this.options.mapType = newSet;
      this._promise = null;
      this._getSessionToken().then(function() {
        this.redraw();
        this._updateAttribution();
      }.bind(this));
    }
  },

  setMapStyle: function(newStyle) {
    if (newStyle && this.options.mapStyle !== newStyle) {
      this.options.mapStyle = newStyle;
      this._promise = null;
      this._getSessionToken().then(function() {
        this.redraw();
        this._updateAttribution();
      }.bind(this));
    }
  },

  setRegion: function(newRegion) {
    if (newRegion && this.options.region !== newRegion) {
      this.options.region = newRegion;
      // this._removeAllAttributions();
      this._promise = null;
      this._getSessionToken().then(function() {
        this.redraw();
        this._updateAttribution();
      }.bind(this));
    }
  },

  /*
   * map must not be null
   */
  _getAttributionUrl: function () {
    var map = this._map;
    var zoom = map.getZoom();
    var bbox = map.getBounds().toBBoxString().split(',');
    return L.Util.template(L.TileLayer.Google.ATTRIBUTION_URL, {
      GoogleTileAPIKey: this.options.GoogleTileAPIKey,
      sessionToken: this._sessionToken,
      zoom: zoom,
      south: bbox[0],
      east: bbox[1],
      north: bbox[2],
      west: bbox[3]
    });
  },

  _makeGetRequest: function (xhttp, url) {
    xhttp.open("GET", url, true);
    xhttp.send();
  },

  /**
   * Update the attribution control of the map with the provider attributions
   * within the current map bounds
   */
  _updateAttribution: function (done) {
    var map = this._map;
    var _this = this;

    if (!map || !map.attributionControl)
      return;
    this._getSessionToken()
      .then(function() {
        var attributionUrl = _this._getAttributionUrl();
        _this._exponentialTimeout = 1000;
        var xhttp = new XMLHttpRequest();
        xhttp.onreadystatechange = function () {
          if (this.readyState === 4 && this.status === 200) {
            // Remove existing attribution
            map.attributionControl.removeAttribution(_this.attribution);
            // Read new attribution
            _this.attribution = JSON.parse(this.responseText).copyright;
            // Add new attribution
            map.attributionControl.addAttribution(_this.attribution);
            if (done && !done.target) {
              done(null, _this.attribution);
            }
          } else if (this.readyState === 4) {
            console.error('Attribution request unsuccessful, retrying in ' + _this._exponentialTimeout / 1000 + ' seconds');
            setTimeout(function () {
              _this._exponentialTimeout *= 2;
              _this._makeGetRequest(xhttp, attributionUrl);
            }, _this._exponentialTimeout);
          }
        };
        _this._makeGetRequest(xhttp, attributionUrl);
      }.bind(this))
      .catch(function(e) {
        if (done && !done.target) {
          done(e);
        }
        console.error('updateAttribution', e);
      });
  }
});

L.tileLayer.google = function (options) {
  return new L.TileLayer.Google(options);
};

module.exports = L.TileLayer.Google;

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{}]},{},[1]);
