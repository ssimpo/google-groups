/*global module */
/*jslint node: true */

'use strict';

function isObject(value) {
  return ((typeof value === 'object') && (value !== null));
}

function isProperty(obj, key) {
  if (isObject(obj)) {
    return Object.prototype.hasOwnProperty.call(obj, key);
  }
  return false;
}

module.exports = {
  toBeObject: function () {
    var pass = isObject(this.actual);

    this.message = function () {
      if (pass) {
        return 'is an object.';
      }

      return 'is not an object.';
    };

    return pass;
  },

  toHaveProperty: function (expected) {
    if ((expected === undefined) || (expected === null)) {
      expected = {};
    }

    var pass = isProperty(this.actual, expected.toString());

    this.message = function () {
      if (pass) {
        return expected + ', is a property of supplied object.';
      }

      return expected + ', is not a property of supplied object.';
    };

    return pass;
  }

};