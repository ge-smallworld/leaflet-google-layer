'use strict';

const mock = require('mock-require');
const assert = require('chai').assert;
const sinon = require('sinon');
/*
 * This variable will contain all of the functions we want to test
 */
let leafletGoogleLayer;
/*
 * Minimal configuration to be able to test the implementation without having to load Leaflet
 */
const mockL = {};
mockL.TileLayer = {};
mockL.TileLayer.extend = function (args) {
  leafletGoogleLayer = args;
  return leafletGoogleLayer.statics;
};
mockL.tileLayer = {};
mockL.setOptions = function (instance, options) {
  Object.assign(instance.options, options);
  return instance.options;
};
mockL.Util = {};
mockL.Util.template = function (args) {
  return 'mockUrl';
};
mockL.Browser = {};
mockL.Browser.android = true;

// Mock the leaflet library. From now on, whenever the code requires leaflet, the mockLeaflet will be used instead
mock('leaflet', mockL);

require('../index');

describe('Google Layer', function () {
  it('should return a valid session token', function (done) {

    var xhr, requests;
    var server = sinon.fakeServer.create();
    global.XMLHttpRequest = sinon.useFakeXMLHttpRequest();
    mockL.Util.template = function (arg1, arg2) {
      console.log(arg2);
      return 'https://www.googleapis.com/tile/v1/createSession?key={GoogleTileAPIKey}';
    };

    leafletGoogleLayer.initialize({
      'GoogleTileAPIKey': 'Enrique'
    });

    server.respondWith('POST', 'https://www.googleapis.com/tile/v1/createSession?key={GoogleTileAPIKey}',
      [200, {'Content-Type': 'application/json'}, '{"session":"valid-token"}']);

    leafletGoogleLayer.getSessionToken(function () {},
      token => {
        assert.equal(token, 'valid-token');
        done();
      });
    server.respond();
  });

  it('should initialize the API Key', function () {
    leafletGoogleLayer.initialize({
      'GoogleTileAPIKey': 'Enrique'
    });

  });

});