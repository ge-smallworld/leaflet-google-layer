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
    global.XMLHttpRequest = sinon.useFakeXMLHttpRequest();
  });

  afterEach(function() {
    server.restore();
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
    server.respond();
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
    server.respond();

  });
});