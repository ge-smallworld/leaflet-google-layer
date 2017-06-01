'use strict';

const mock = require('mock-require');
const assert = require('chai').assert;
const sinon = require('sinon');
/*
 * Minimal configuration to be able to test the implementation without having to load Leaflet
 */
let mockL = require('./mock-leaflet');
// Mock the leaflet library. From now on, whenever the code requires leaflet, the mockLeaflet will be used instead
mock('leaflet', mockL);
const leafletGoogleLayer = require('../index');

describe('Google Layer', function () {
  let server;

  beforeEach(function() {
    server = sinon.fakeServer.create();
    server.respondImmediately = true;
    global.XMLHttpRequest = sinon.useFakeXMLHttpRequest();
    sinon.spy(leafletGoogleLayer, '_getSessionToken');
  });

  afterEach(function() {
    server.restore();
    leafletGoogleLayer._getSessionToken.restore();
  });

  it('should return a valid session token', function (done) {
    server.respondWith('POST', 'https://www.googleapis.com/tile/v1/createSession?key=TestKey',
      [200, {'Content-Type': 'application/json'}, '{"session":"valid-token","expiry":"10"}']);

    leafletGoogleLayer.initialize({
      'GoogleTileAPIKey': 'TestKey'
    });

    leafletGoogleLayer._getSessionToken().then(function(token) {
      assert.equal(token.session, 'valid-token');
      assert.equal(token.expiry, '10');
      assert.equal(leafletGoogleLayer._sessionToken, 'valid-token');
      done();
    });
  });

  it('should initialize the API Key', function () {
    leafletGoogleLayer.initialize({
      'GoogleTileAPIKey': '12345'
    });

    assert.equal(leafletGoogleLayer.options.GoogleTileAPIKey, '12345')
  });

  it('should have no token after initialize', function () {
    server.respondWith('POST', 'https://www.googleapis.com/tile/v1/createSession?key=12345',
      [200, {'Content-Type': 'application/json'}, '{"session":"token1"}']);

    leafletGoogleLayer.initialize({
      'GoogleTileAPIKey': '12345'
    });
    assert.equal(leafletGoogleLayer._sessionToken, null);

  });

  it('should create a tile with the correct src', function (done) {
    global.document = {
      createElement: function (elementType) {
        return {
          src: null,
          alt: null,
          type: 'img'
        }
      }
    };
    server.respondWith('POST', 'https://www.googleapis.com/tile/v1/createSession?key=111',
      [200, {'Content-Type': 'application/json'}, '{"session":"ST","expiry":"10"}']);

    leafletGoogleLayer.initialize({
      'GoogleTileAPIKey': '111'
    });
    leafletGoogleLayer.createTile({x:1, y:2, z:3}, function(error, tile) {
      const expectedSrc = 'https://www.googleapis.com/tile/v1/tiles/3/1/2?session=ST&orientation=0&key=111';
      assert.equal(tile.src, expectedSrc);
      assert.equal(tile.type, 'img');
      assert.equal(tile.alt, '');
      done();
    });
  });

  it('should update the attribution', function (done) {
    server.respondWith('POST', 'https://www.googleapis.com/tile/v1/createSession?key=1234',
      [200, {'Content-Type': 'application/json'}, '{"session":"session","expiry":"1000"}']);

    server.respondWith('GET', 'https://www.googleapis.com/tile/v1/viewport?session=session&zoom=1&north=2&south=3&east=4&west=5&key=1234',
      [200, {'Content-Type': 'application/json'}, '{"copyright":"this is a test"}']);

    leafletGoogleLayer.initialize({
      'GoogleTileAPIKey': '1234'
    });

    const attributions = {};
    let mockMap = function() {
      return {
        getZoom: function() {
          return 1;
        },
        getBounds: function() {
          return {
            toBBoxString: function() {
              return '3,4,2,5';
            }
          }
        },
        attributionControl: {
          addAttribution: function(attr) {
            if (!attributions[attr]) {
              attributions[attr] = true;
            }
          },
          removeAttribution: function(attr) {
            if (attributions[attr]) {
              attributions[attr] = false;
            }
          }
        }
      };
    };
    leafletGoogleLayer._map = mockMap();

    leafletGoogleLayer._updateAttribution(function(error, attribution) {
      assert.equal(attribution, 'this is a test');
      assert.equal(leafletGoogleLayer.getAttribution(), 'this is a test');
      done();
    });
  });

  it('should get a new session token when setting a new map type', function() {
    leafletGoogleLayer.initialize({
      'GoogleTileAPIKey': '1234'
    });

    server.respondWith('POST', 'https://www.googleapis.com/tile/v1/createSession?key=1234',
      [200, {'Content-Type': 'application/json'}, '{"session":"session","expiry":"1000"}']);

    leafletGoogleLayer.setMapType('satellite');
    assert.isTrue(leafletGoogleLayer._getSessionToken.called);
  });

  it('should throw an error wen attempting to set an invalid map type', function() {
    leafletGoogleLayer.initialize({
      'GoogleTileAPIKey': '1234'
    });

    assert.throws(function() {
      leafletGoogleLayer.setMapType('invalidMapType');
    }, "'invalidMapType' is an invalid mapType");
  });

  it('should get a new session token when setting a new language', function() {
    leafletGoogleLayer.initialize({
      'GoogleTileAPIKey': '1234'
    });

    server.respondWith('POST', 'https://www.googleapis.com/tile/v1/createSession?key=1234',
      [200, {'Content-Type': 'application/json'}, '{"session":"session","expiry":"1000"}']);

    leafletGoogleLayer.setLanguage('fr');
    assert.isTrue(leafletGoogleLayer._getSessionToken.called);
  });

  it('should get a new session token when setting a new region', function() {
    leafletGoogleLayer.initialize({
      'GoogleTileAPIKey': '1234'
    });

    server.respondWith('POST', 'https://www.googleapis.com/tile/v1/createSession?key=1234',
      [200, {'Content-Type': 'application/json'}, '{"session":"session","expiry":"1000"}']);

    leafletGoogleLayer.setRegion('fr');
    assert.isTrue(leafletGoogleLayer._getSessionToken.called);
  });

  it('should get a new session token when setting a new key', function() {
    leafletGoogleLayer.initialize({
      'GoogleTileAPIKey': '1234'
    });

    server.respondWith('POST', 'https://www.googleapis.com/tile/v1/createSession?key=XXXXXXXXXXXXXXXXXXXXXXXXXXX',
      [200, {'Content-Type': 'application/json'}, '{"session":"session","expiry":"1000"}']);

    leafletGoogleLayer.setKey('XXXXXXXXXXXXXXXXXXXXXXXXXXX');
    assert.isTrue(leafletGoogleLayer._getSessionToken.called);
  });

  it('should retry to get a session token with exponential backoff', function(done) {
    this.timeout(10000);

    leafletGoogleLayer.initialize({
      'GoogleTileAPIKey': '1234'
    });

    server.respondWith('POST', 'https://www.googleapis.com/tile/v1/createSession?key=1234', [404, {}, '']);

    leafletGoogleLayer._getSessionToken();

    assert.isTrue(leafletGoogleLayer._getSessionToken.calledOnce);
    assert.equal(leafletGoogleLayer._exponentialBackoff, 1000);

    setTimeout(function() {
      assert.isTrue(leafletGoogleLayer._getSessionToken.calledTwice);
      assert.equal(leafletGoogleLayer._exponentialBackoff, 2000);
    }, 2000);

    setTimeout(function() {
      assert.isTrue(leafletGoogleLayer._getSessionToken.calledThrice);
      assert.equal(leafletGoogleLayer._exponentialBackoff, 4000);
      done();
    }, 4000);
  });

  it('should retry to get the attribution with exponential backoff', function (done) {
    this.timeout(10000);
    sinon.spy(leafletGoogleLayer, '_makeGetRequest');
    server.respondWith('POST', 'https://www.googleapis.com/tile/v1/createSession?key=1234',
      [200, {'Content-Type': 'application/json'}, '{"session":"session","expiry":"1000"}']);

    server.respondWith('GET', 'https://www.googleapis.com/tile/v1/viewport?session=session&zoom=1&north=2&south=3&east=4&west=5&key=1234',
      [404, {}, '']);

    leafletGoogleLayer.initialize({
      'GoogleTileAPIKey': '1234'
    });

    const attributions = {};
    let mockMap = function() {
      return {
        getZoom: function() {
          return 1;
        },
        getBounds: function() {
          return {
            toBBoxString: function() {
              return '3,4,2,5';
            }
          }
        },
        attributionControl: {
          addAttribution: function(attr) {
            if (!attributions[attr]) {
              attributions[attr] = true;
            }
          },
          removeAttribution: function(attr) {
            if (attributions[attr]) {
              attributions[attr] = false;
            }
          }
        }
      };
    };
    leafletGoogleLayer._map = mockMap();

    leafletGoogleLayer._updateAttribution();

    setTimeout(function() {
      assert.isTrue(leafletGoogleLayer._makeGetRequest.calledOnce);
      assert.equal(leafletGoogleLayer._exponentialTimeout, 1000);
    }, 1000);

    setTimeout(function() {
      assert.isTrue(leafletGoogleLayer._makeGetRequest.calledTwice);
      assert.equal(leafletGoogleLayer._exponentialTimeout, 2000);
    }, 2000);

    setTimeout(function() {
      assert.isTrue(leafletGoogleLayer._makeGetRequest.calledThrice);
      assert.equal(leafletGoogleLayer._exponentialTimeout, 4000);
      leafletGoogleLayer._makeGetRequest.restore();
      done();
    }, 4000);
  });
});
