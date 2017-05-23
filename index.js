var L = require('leaflet');

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

  _getSessionToken: function () {
    var _this = this;
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
          scale: 'scaleFactor1x'
        });
        var xhttp = new XMLHttpRequest();

        xhttp.open('POST', sessionTokenUrl, true);
        xhttp.setRequestHeader('Content-type', 'application/json');
        xhttp.onreadystatechange = function () {
          if (this.readyState === 4) {
            if (this.status === 200) {
              var token = JSON.parse(xhttp.responseText);
              _this._sessionToken = token.session;
              resolve(token.sesion, token.expiry);
            } else {
              console.log('rejecting', xhttp.responseText);
              reject();
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
    this._getSessionToken().
    then(function (session, expiry) {
      setTimeout(function() {
        if (_this._needToRefreshToken) {
          this._promise = null;
          _this._refreshToken();
        }
      }, (expiry - new Date().getTime() - 3600)*1000);
    }).catch(function(e) {
      console.log('refreshToken', e); // "oh, no!"
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

    // for https://github.com/Leaflet/Leaflet/issues/137
    if (!L.Browser.android) {
      this.on('tileunload', this._onTileRemove);
    }
  },

  // Defined by Leaflet
  createTile: function (coords, done) {
    var tile = document.createElement('img');

    // TODO, do we need to implement these two?
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
    var _this = this;
    this._getSessionToken().then(function (session) {
      tile.src = _this.getTileUrl(coords);
    }).catch(function(e) {
      console.log('createTile', e); // "oh, no!"
    });

    return tile;
  },

  // Defined by Leaflet: this is for the first attribution
  getAttribution: function () {
    console.log('getAttribution');
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
    // TODO Remove attributions for this map
    this._needToRefreshToken = false;
    this._promise = null;
    map.attributionControl.removeAttribution(this.attribution);
    L.TileLayer.prototype.onRemove.call(this, map);
  },


  /**
   * Update the attribution control of the map with the provider attributions
   * within the current map bounds
   */
  _updateAttribution: function () {
    var _this = this;
    var map = this._map;
    if (!map || !map.attributionControl)
      return;
    var zoom = map.getZoom();
    var bbox = map.getBounds().toBBoxString().split(',');
    this._getSessionToken().then(function (session) {
      var attributionUrl = L.Util.template(L.TileLayer.Google.ATTRIBUTION_URL, {
        GoogleTileAPIKey: _this.options.GoogleTileAPIKey,
        sessionToken: _this._sessionToken,
        zoom: zoom,
        south: bbox[0],
        east: bbox[1],
        north: bbox[2],
        west: bbox[3]
      });

      var xhttp = new XMLHttpRequest();
      xhttp.onreadystatechange = function () {
        if (this.readyState === 4 && this.status === 200) {
          map.attributionControl.removeAttribution(_this.attribution);
          _this.attribution = JSON.parse(this.responseText).copyright;
          map.attributionControl.addAttribution(_this.attribution);
        }
      };
      xhttp.open("GET", attributionUrl, true);
      xhttp.send();
    }).catch(function(e) {
      console.log('updateAttribution', e); // "oh, no!"
    });
  }
})

L.tileLayer.google = function (options) {
  return new L.TileLayer.Google(options);
}

module.exports = L.TileLayer.Google;
