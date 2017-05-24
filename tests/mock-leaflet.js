'use strict';
let leafletGoogleLayer;

const mockL = {};

mockL.TileLayer = {};
// This function gives you access to the implementation details, plus the statics
mockL.TileLayer.extend = function (args) {
  Object.assign(args, args.statics);
  return args;
};

mockL.tileLayer = {};

mockL.setOptions = function (instance, options) {
  Object.assign(instance.options, options);
  return instance.options;
};

mockL.Util = {};
// Do the template replacement
mockL.Util.template = function (arg1, arg2) {
  for (let key in arg2) {
    arg1 = arg1.replace(`{${key}}`, arg2[key]);
  }
  return arg1;
};

mockL.Browser = {};
mockL.Browser.android = true;

mockL.DomEvent = {};
mockL.DomEvent.on = function () {};

mockL.bind = function () {};
module.exports = mockL;