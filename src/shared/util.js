/*
 * Defines a set of general utilities for use across the project.
 *
 * Author: Michael van der Kamp
 * Date: July / August 2018
 */

'use strict';

/*
 * Defines the given property on the given object with the given value, and sets
 * the property to unconfigurable, unwritable, but enumerable.
 */
function defineOwnImmutableEnumerableProperty(obj, prop, val) {
  Object.defineProperty(obj, prop, {
    value: val,
    configurable: false,
    enumerable: true,
    writable: false
  });
}

/*
 * Find the last value in an Array for which the supplied callback function
 *  returns true. Operates on each index in the Array, starting at 'fromIndex'
 *  and going backwards to the start of the Array or until the desired value 
 *  is found.
 *
 * Returns the value that passed the callback, if found or null.
 *
 * Callback function should be of similar form to the Array.findIndex()
 *  standard library function.
 */
function findLast(array, callback, fromIndex = array.length - 1, thisArg) {
  while (fromIndex >= 0 &&
    !callback.call(thisArg, array[fromIndex], fromIndex, array)) {
    --fromIndex;
  }
  return fromIndex >= 0 ? array[fromIndex] : null;
}

/*
 * Returns a new object, with all the own properties of 'defaults' having
 *  values from 'data', if found, otherwise with values from 'defaults'.
 */
function getInitialValues(defaults = {}, data = {}) {
  const rv = {};
  Object.keys(defaults).forEach( k => {
    rv[k] = data.hasOwnProperty(k) ? data[k] : defaults[k];
  });
  return rv;
}

/*
 * This method will set an already-existing property on an object to be 
 *  immutable. In other words, it will configure it as such:
 *
 *    configurable: false
 *    writable: false
 *
 * It will have no effect on non-configurable properties, and will turn an 
 *  accessor descriptor  a data descriptor. (I.e. if the property is 
 *  defined with getters and setters, they will be lost).  
 *
 * It will have no effect on properties that do not exist directly on the
 *  Object (properties further up the prototype chain are not affected).
 *
 * It will affect both enumerable and non-enumerable properties.
 *
 * This method is intended for use when the only reason for a call to
 *  Object.defineProperty() was to make the property immutable.
 *
 * Returns the modified object.
 */
function makeOwnPropertyImmutable(obj, prop) {
  const desc = Object.getOwnPropertyDescriptor(obj, prop);
  if (desc && desc.configurable) {
    Object.defineProperty(obj, prop, {
      configurable: false,
      writable: false
    });
  }
  return obj;
}

/*
 * Plain, simple NOP definition. If there's a faster NOP, redefine it here.
 */
const NOP = () => {};

/*
 * Removes the given item from the given array, according to its Id.
 */
function removeById(array, item) {
  const idx = array.findIndex( o => o.id === item.id );
  if (idx >= 0) {
    array.splice(idx, 1);
    return true;
  }
  return false;
}

/*
 * Removes the given item of the given class (enforced by throwing an
 * exception if not an instance) from the given array.
 */
function safeRemoveById(array, item, class_fn) {
  if (!(item instanceof class_fn)) throw `Invalid ${class_fn} received.`;
  return removeById(array, item);
}

module.exports = {
  defineOwnImmutableEnumerableProperty,
  findLast,
  getInitialValues,
  makeOwnPropertyImmutable,
  NOP,
  removeById,
  safeRemoveById,
};
