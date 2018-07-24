/*
 * WAMS code to be executed in the client browser.
 *
 * Original author: Jesse Rolheiser
 * Revised by: Scott Bateman
 * Latest edition by: Michael van der Kamp
 *  |-> Date: July/August 2018
 */

'use strict';

/*
 * FIXME: This is ugly!! This code will not work on the actual client if this
 *  test code is left in!
 */
let io, WamsShared;
if (typeof require === 'function') {
  io = require('socket.io-client');
  WamsShared = require('../src/shared.js');
}

/*
 * I'm using a frozen 'globals' object with all global constants and variables 
 * defined as properties on it, to make global references explicit. I've been 
 * toying with this design pattern in my other JavaScript code and I think I 
 * quite like it.
 *
 * Currently all it's doing though is copying over the constants from the
 * WamsShared module...
 */
const globals = (function defineGlobals() {
  const rv = {};

  /*
   * I centralized some constant descriptions in the shared file, so collect 
   * them from there.
   */
  Object.entries(WamsShared.constants).forEach( ([p,v]) => {
    Object.defineProperty(rv, p, {
      value: v,
      configurable: false,
      enumerable: true,
      writable: false
    });
  });

  return Object.freeze(rv);
})();

const ClientItem = (function defineClientItem() {
  /*
   * I'm not defining a 'defaults' object here, because the data going into
   * the creation of items should always come from the server, where it has
   * already gone through an initialization against a defaults object.
   */
  const locals = Object.freeze({
    STAMPER: new WamsShared.IDStamper(),

    createImage(src) {
      if (src) {
        const img = new Image();
        img.src = src;
        return img;
      }
      return null;
    }
  });

  class ClientItem extends WamsShared.Item {
    constructor(data = {}) {
      super(data);
      if (data.hasOwnProperty('id')) locals.STAMPER.stamp(this, data.id);
      this.img = locals.createImage(this.imgsrc);
    }

    draw(context) {
      const width = this.width || this.img.width;
      const height = this.height || this.img.height;

      if (this.imgsrc) {
        context.drawImage(this.img, this.x, this.y, width, height);
      } else {
        /*
         * XXX: Yikes!!! eval()? And we want this to be a usable 
         *    API? For people to work together over networks? 
         *    Pardon my French, but how the f*** are we going to 
         *    make sure that no one is injecting malicious code 
         *    here? 
         *
         *    Where is draw defined, and how does it end up here?
         *
         *    There must be a better way...
         *
         *    + Answer: I believe there is! Check out the canvas
         *      sequencer library I'm working on!
         */
        // eval(`${this.drawCustom};`);
        // eval(`${this.drawStart};`);
      }
    }
  }

  return ClientItem;
})();

const WamsClient = (function defineWamsClient() {

  class WamsClient {
    constructor() {
      this.socket = null;
      this.viewer = null;
    }

    sendUpdate(reportSubWS = false) {
      /*
       * XXX: Do we want to connect the subviewers in this viewer somehow, so 
       *    that they are clearly linked in the report?
       */
      // if (reportSubWS) {
      //   this.subViewers.forEach( subWS => subWS.sendUpdate(true) );
      // }

      this.socket.emit(globals.MSG_UPDATE, this.viewer.report());
    }

    establishSocket() {
      this.socket = io();
      this.socket.on(globals.MSG_INIT,
        this.viewer.setup.bind(this.viewer)
      );
      this.socket.on(globals.MSG_UD_VIEW,
        this.viewer.updateViewer.bind(this.viewer)
      );
      this.socket.on(globals.MSG_RM_VIEW,
        this.viewer.removeViewer.bind(this.viewer)
      );
      this.socket.on(globals.MSG_UD_ITEMS,
        this.viewer.updateItems.bind(this.viewer)
      );
      this.socket.on('message', (message) => {
        if (message === globals.MSG_DC_VIEW) {
          document.body.innerHTML = '<H1>' +
            'Application has reached capacity.' +
            '</H1>';
        }
      });
    };
  }

  return WamsClient;
})();

const ShadowViewer = (function defineShadowViewer() {
  const locals = Object.freeze({
    DEFAULTS: Object.freeze({
      x: 0,
      y: 0,
      effectiveWidth: window.innerWidth;
      effectiveHeight: window.innerHeight;
    }),
    STAMPER: new WamsShared.IDStamper(),
  });

  class ShadowViewer extends WamsClient.Viewer {
    constructor(values = {}) {
      super(WamsShared.initialize(locals.DEFAULTS, values));
      if (values.hasOwnProperty('id')) locals.STAMPER.stamp(this, values.id);
    }

    draw(context) {
      context.beginPath();
      context.rect(v.x, v.y, v.effectiveWidth, v.effectiveHeight);
      context.stroke();
    }
  }

  return ShadowViewer;
})();

const ClientViewer = (function defineClientViewer() {
  const locals = Object.freeze({
    DEFAULTS: Object.freeze({
      x: 0,
      y: 0,
      width: window.innerWidth,
      height: window.innerHeight,
      effectiveWidth: window.innerWidth,
      effectiveHeight: window.innerHeight,
      rotation: globals.ROTATE_0,
      scale: 1,
    }),
    FRAMERATE: 1000 / 60,
    HAMMER_EVENTS: [
      'tap',
      'dragstart',
      'drag',
      'dragend',
      'transformstart',
      'transform',
      'transformend',
    ],
    STAMPER: new WamsShared.IDStamper(),

    attachWindowListeners(viewer) {
      window.addEventListener(
        'DOMMouseScroll', 
        viewer.mouseScroll.bind(viewer), 
        false
      );
      window.addEventListener(
        'mousewheel', 
        viewer.mouseScroll.bind(viewer), 
        false
      );
      window.addEventListener(
        'resize', 
        viewer.resize.bind(viewer), 
        false
      );
    },

    establishHammer(viewer) {
      viewer.hammer = new Hammer(viewer.canvas);
      viewer.hammer.get('pan').set({ direction: Hammer.DIRECTION_ALL });
      viewer.hammer.get('pinch').set({ enable: true });
      locals.HAMMER_EVENTS.forEach( e => {
        viewer.hammer.on(e, (event) => event.preventDefault() );
        viewer.hammer.on(e, viewer[e].bind(viewer));
      });
    },

    establish(viewer) {
      this.establishHammer(viewer);
      this.establishSocket(viewer);
      this.attachWindowListeners(viewer);
    },
  });

  class ClientViewer extends WamsShared.Viewer {
    constructor(data) {
      super(WamsShared.initialize(locals.DEFAULTS, data));
      this.canvas = document.querySelector('#main');
      this.context = this.canvas.getContext('2d');
      this.items = [];
      // this.subViewers = [];
      this.startScale = null;
      this.transforming = false;
      this.mouse = {x: 0, y: 0};
      this.otherViewers = [];
      this.hammer = null;
      this.animator = null;

      // Initialize data.
      this.resize();
      locals.establish(this);
    }

    addItem(item) {
      this.items.push(new ClientItem(item));
    }

    addViewer(info) {
      this.otherViewers.push(new ShadowViewer(info));
    }

    drag(event) {
      if (this.transforming) { return; }

      const lastMouse = this.mouse;
      this.mouse = this.getMouseCoordinates(event);

      this.socket.emit(globals.MSG_DRAG, 
        this, 
        this.mouse.x,
        this.mouse.y,
        (lastMouse.x - this.mouse.x), 
        (lastMouse.y - this.mouse.y)
      );
    }

    dragend(event) {
      /*
       * NOP for now, here for consistency though.
       */
    }

    dragstart(event) {
      this.mouse = this.getMouseCoordinates(event);
    }

    /*
     * XXX: Okay, I'll need to dig into the canvas API if I'm going to 
     *    understand this.
     */
    draw() {
      this.context.clearRect(0, 0, window.innerWidth, window.innerHeight);
      this.context.save();
      this.context.scale(this.scale, this.scale);
      this.context.translate(-this.x, -this.y);
      this.context.rotate(this.rotation);

      this.locate();

      this.items.forEach( o => o.draw(this.context) );
      this.otherViewers.forEach( v => v.draw(this.context) );
      this.context.restore();

      this.showStatus();
    }

    getMouseCoordinates(event) {
      const base = {
        x: event.center.x / this.scale + this.x,
        y: event.center.y / this.scale + this.y,
      };

      const center = {
        x: (this.effectiveWidth / 2) + this.x,
        y: (this.effectiveHeight / 2) + this.y,
      };

      const coords = { x: -1, y: -1, };

      /*
       * XXX: Still need to figure out the "why" of this math. Once I've 
       *    done that, I will write up a comment explaining it.
       *
       *    Also, I think I'll refactor this into functional style.
       */
      switch (this.rotation) {
        case(globals.ROTATE_0): 
          coords.x = base.x;
          coords.y = base.y;
          break;
        case(globals.ROTATE_90): 
          coords.x = (2 * this.x) + this.effectiveWidth - base.x;
          coords.y = (2 * this.y) + this.effectiveHeight - base.y;
          break;
        case(globals.ROTATE_180):
          coords.x = center.x - center.y + base.y;
          coords.y = center.y + center.x - base.x;
          break;
        case(globals.ROTATE_270): 
          coords.x = center.x + center.y - base.y;
          coords.y = center.y - center.x + base.x;
          break;
      }

      return coords;
    }

    locate() {
      switch(this.rotation) {
        case(globals.ROTATE_0): 
          break;
        case(globals.ROTATE_90): 
          this.context.translate(
            (-this.effectiveWidth - (this.x * 2)), 
            (-this.effectiveHeight - (this.y * 2))
          ); 
          break;
        case(globals.ROTATE_180): 
          this.context.translate(
            -this.effectiveWidth, 
            -(this.x * 2)
          ); 
          break;
        case(globals.ROTATE_270): 
          this.context.translate(
            -(this.y * 2), 
            -this.effectiveWidth
          ); 
          break;
      }
    }

    mouseScroll(event) {
      /*
       * XXX: Let's have a close look at this. With no comments, I'm not 
       *    sure why a Math.max(Math.min()) structure is necessary. We 
       *    might be able to simplify this.
       */
      const delta = Math.max(
        -1, 
        Math.min(
          1, 
          (event.wheelDelta || -event.detail)
        )
      );
      const newScale = this.scale + delta * 0.09;
      this.socket.emit(globals.MSG_SCALE, this, newScale);
    }

    removeViewer(id) {
      const index = this.otherViewers.findIndex( v => v.id === id );
      if (index >= 0) {
        this.otherViewers.splice(index,1);
      }
    }

    resize() {
      this.width = window.innerWidth;
      this.height = window.innerHeight;
      this.canvas.width = this.width; 
      this.canvas.height = this.height;
      this.effectiveWidth = this.width / this.scale;
      this.effectiveHeight = this.height / this.scale;
      // this.sendUpdate();
    }

    run() {
      window.clearInterval(this.animator);
      this.animator = window.setInterval(
        this.draw.bind(this), locals.FRAMERATE
      );
    }

    setup(data) {
      locals.STAMPER.stamp(this, data.id);
      data.viewers.forEach( v => this.addViewer(v) );
      data.items.forEach( o => this.addItem(o) );
      this.canvas.style.backgroundColor = data.color;

      this.socket.emit(globals.MSG_LAYOUT, this.report());
    }

    showStatus() {
      this.context.font = '18px Georgia';
      this.context.fillText(
        `ClientViewer Coordinates: ${this.x.toFixed(2)}, ` + 
        `${this.y.toFixed(2)}`, 
        10, 40
      );
      this.context.fillText(
        `Bottom Right Corner: ` +
        `${(this.x + this.width).toFixed(2)}, ` + 
        `${(this.y + this.height).toFixed(2)}`,
        10, 60
      );
      this.context.fillText(
        `Number of Other Viewers: ${this.otherViewers.length}`, 
        10, 80
      );
      this.context.fillText(
        `Viewer Scale: ${this.scale.toFixed(2)}`, 
        10, 100
      );
      this.context.fillText(
        `ClientViewer Rotation: ${this.rotation}`, 
        10, 120
      );
    }

    tap(event) {
      this.mouse = this.getMouseCoordinates(event);
      this.socket.emit(
        globals.MSG_CLICK, 
        this.mouse.x,
        this.mouse.y
      );
    }

    transform(event) {
      this.socket.emit(
        globals.MSG_SCALE, 
        this, 
        event.scale * this.startScale
      );
    }

    transformend(event) {
      this.transforming = false;
      this.startScale = null;
    }

    transformstart(event) {
      this.transforming = true;
      this.startScale = this.scale;
    }

    /*
     * XXX: Update? If we're just pushing every item 
     *    from one array into the other (after it has been emptied), 
     *    maybe we should just copy the array over?
     *
     *    I think maybe what happened is the author wanted to actually 
     *    update the array, but ran into problems so ended up just 
     *    resetting. I think a proper update would probably be more 
     *    efficient than this mechanism of trashing, copying, and 
     *    regenerating.
     */
    updateItems(items) {
      this.items.splice(0, this.items.length);
      items.forEach( o => this.addItem(o) );
    }

    /*
     * XXX: This is side-effecting!! We should have an 'addViewer' event, not
     *    just an wams-update-viewer event, unless there's some very good reason 
     *    not to do so.
     */
    updateViewer(vsInfo) {
      if (vsInfo.id === this.id) {
        this.assign(vsInfo);
      } else {
        const viewer = this.otherViewers.find( v => v.id === vsInfo.id );
        if (viewer) viewer.assign(vsInfo);
        else this.addViewer(vsInfo);
      }
    }
  }

  return ClientViewer;
})();

// Entry point!
// window.addEventListener(
//   'load', 
//   function run() {
//     new ClientViewer().run();
//   },
//   {
//     capture: false,
//     once: true,
//     passive: true,
//   }
// );

if (typeof exports !== 'undefined') {
  exports.ClientViewer = ClientViewer;
  exports.ClientItem = ClientItem;
}

