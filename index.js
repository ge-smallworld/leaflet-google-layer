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

  getSessionToken: function (error, callback) {
    var xhttp = new XMLHttpRequest();

    var sessionTokenUrl = L.Util.template(L.TileLayer.Google.SESSION_TOKEN_URL, {
      GoogleTileAPIKey: this.options.GoogleTileAPIKey
    });

    xhttp.open('POST', sessionTokenUrl, true);
    xhttp.setRequestHeader('Content-type', 'application/json');
    xhttp.onreadystatechange = function() {
      if (this.readyState === 4 && this.status === 200) {
        this._sessionToken = JSON.parse(xhttp.responseText).session;
        callback(this._sessionToken);
      } else {
        error();
      }
    };

    xhttp.send(JSON.stringify({
      mapType: this.options.mapType,
      language: this.options.language,
      region: this.options.region,
      overlay:  true,
      scale: 'scaleFactor1x'
    }));

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
      throw new Error('Must supply options.GoogleTileAPIKey');
    }
    options = L.setOptions(this, options);
    if (VALID_MAP_TYPES.indexOf(options.mapType) < 0) {
      throw new Error("'" + options.mapType + "' is an invalid mapType");
    }
    // for https://github.com/Leaflet/Leaflet/issues/137
    if (!L.Browser.android) {
      this.on('tileunload', this._onTileRemove);
    }
  },

  // Defined by Leaflet
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
    tile.src = this.getTileUrl(coords);

    return tile;
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
    });
  },

  // Defined by leaflet
  // Runs every time the layer has been added to the map
  // Update the attribution control every time the map is moved
  onAdd: function (map) {
    map.on('moveend', this._updateAttribution, this);
    L.TileLayer.prototype.onAdd.call(this, map);
    this._updateAttribution();
  },

  // Clean up events and remove attributions from attribution control
  onRemove: function (map) {
    map.off('moveend', this._updateAttribution, this);
    // TODO Remove attributions for this map
    map.attributionControl.removeAttribution(this.attribution);
    L.TileLayer.prototype.onRemove.call(this, map);
  },


  /**
   * Update the attribution control of the map with the provider attributions
   * within the current map bounds
   */
  _updateAttribution: function () {
    var map = this._map;
    if (!map || !map.attributionControl)
      return;
    var zoom = map.getZoom();
    var bbox = map.getBounds().toBBoxString().split(',');
    var attributionUrl = L.Util.template(L.TileLayer.Google.ATTRIBUTION_URL, {
      GoogleTileAPIKey: this.options.GoogleTileAPIKey,
      sessionToken: this._sessionToken,
      zoom: zoom,
      south: bbox[0],
      east: bbox[1],
      north: bbox[2],
      west: bbox[3]
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

})

L.tileLayer.google = function (options) {
  return new L.TileLayer.Google(options);
}

module.exports = L.TileLayer.Google;
