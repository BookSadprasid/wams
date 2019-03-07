/*
 * Contains the abstract Pinch class.
 */

'use strict';

const Gesture = require('../core/Gesture.js');

const DEFAULT_MIN_INPUTS = 2;

/**
 * Data returned when a Pinch is recognized.
 *
 * @typedef {Object} PinchData
 * @mixes module:gestures.ReturnTypes.BaseData
 *
 * @property {number} distance - The average distance from an active input to
 *    the centroid.
 * @property {number} change - The change in distance since last emit.
 * @property {module:gestures.Point2D} midpoint - The centroid of the currently
 * active points.
 *
 * @memberof module:gestures.ReturnTypes
 */

/**
 * A Pinch is defined as two or more inputs moving either together or apart.
 *
 * @extends module:gestures.Gesture
 * @see module:gestures.ReturnTypes.PinchData
 * @memberof module:gestures
 */
class Pinch extends Gesture {
  /**
   * Constructor function for the Pinch class.
   *
   * @param {Object} [options]
   * @param {number} [options.minInputs=2] The minimum number of inputs that
   *    must be active for a Pinch to be recognized.
   */
  constructor(options = {}) {
    super('pinch');

    /**
     * The minimum number of inputs that must be active for a Pinch to be
     * recognized.
     *
     * @type {number}
     */
    this.minInputs = options.minInputs || DEFAULT_MIN_INPUTS;

    /**
     * The previous distance.
     *
     * @type {number}
     */
    this.previous = 0;
  }

  /**
   * Initializes the gesture progress and stores it in the first input for
   * reference events.
   *
   * @param {module:gestures.State} state - current input state.
   */
  refresh(state) {
    if (state.active.length >= this.minInputs) {
      const distance = state.centroid.averageDistanceTo(state.activePoints);
      this.previous = distance;
    }
  }

  /**
   * Event hook for the start of a Pinch.
   *
   * @param {module:gestures.State} state - current input state.
   */
  start(state) {
    this.refresh(state);
  }

  /**
   * Event hook for the move of a Pinch.
   *
   * @param {module:gestures.State} state - current input state.
   * @return {?module:gestures.ReturnTypes.PinchData} <tt>null</tt> if not
   * recognized.
   */
  move(state) {
    if (state.active.length < this.minInputs) return null;

    const midpoint = state.centroid;
    const distance = midpoint.averageDistanceTo(state.activePoints);
    const change = distance / this.previous;
    this.previous = distance;

    return { distance, midpoint, change };
  }

  /**
   * Event hook for the end of a Pinch.
   *
   * @param {module:gestures.State} input status object
   */
  end(state) {
    this.refresh(state);
  }

  /**
   * Event hook for the cancel of a Pinch.
   *
   * @param {module:gestures.State} input status object
   */
  cancel(state) {
    this.refresh(state);
  }
}

module.exports = Pinch;
