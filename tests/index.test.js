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

describe('Google Layer', function () {
  let server;
  let leafletGoogleLayer;

  beforeEach(function() {
    leafletGoogleLayer = require('../index');
    server = sinon.fakeServer.create();
    global.XMLHttpRequest = sinon.useFakeXMLHttpRequest();
  });

  afterEach(function() {
    server.restore();
  });

  it('should return a valid session token', function (done) {
    server.respondWith('POST', 'https://www.googleapis.com/tile/v1/createSession?key=TestKey',
      [200, {'Content-Type': 'application/json'}, '{"session":"valid-token"}']);

    leafletGoogleLayer.initialize({
      'GoogleTileAPIKey': 'TestKey'
    });
    leafletGoogleLayer._getSessionToken(function () {},
      token => {
        assert.equal(token, 'valid-token');
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

  it('should have no token available after initialize', function () {
    server.respondWith('POST', 'https://www.googleapis.com/tile/v1/createSession?key=12345',
      [200, {'Content-Type': 'application/json'}, '{"session":"token1"}']);

    leafletGoogleLayer.initialize({
      'GoogleTileAPIKey': '12345'
    });
    assert.equal(leafletGoogleLayer._sessionToken, null);

  });

});