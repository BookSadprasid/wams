/*
 * Test suite for src/server.js
 *
 * Author: Michael van der Kamp
 * Date: July/August 2018
 */

'use strict';

const wams = require('../src/server.js');
const WorkSpace = wams.WorkSpace;
const Connection = wams.Connection;
const ServerItem = wams.ServerItem;
const ServerViewSpace = wams.ServerViewSpace;
const RequestHandler = wams.RequestHandler;
const ListenerFactory = wams.ListenerFactory;

expect.extend({
  toHaveImmutableProperty(received, argument) {
    const descs = Object.getOwnPropertyDescriptor(received, argument);
    const pass = Boolean(descs && !(descs.configurable || descs.writable));
    const not = pass ? 'not ' : ''
    return {
      message: () =>
        `expected ${received} ${not}to have immutable property '${argument}'`,
      pass: pass,
    };
  },
});

describe('ServerItem', () => {
  const DEFAULTS = Object.freeze({
    x: 0,
    y: 0,
    width: 128,
    height: 128,
    type: 'view/background',
    imgsrc: '',
    drawCustom: '',
    drawStart: '',
  });

  describe('constructor(settings)', () => {
    test('Uses defaults if no arguments provided', () => {
      let item;
      expect(() => item = new ServerItem()).not.toThrow();
      Object.entries(DEFAULTS).forEach( ([p,v]) => {
        expect(item[p]).toEqual(v);
      });
    });

    test('Creates correct type of item', () => {
      expect(new ServerItem()).toBeInstanceOf(ServerItem);
    });

    test('Uses user-defined values, if provided', () => {
      let item;
      expect(() => {
        item = new ServerItem({
          y: 75,
          type: 'joker',
        });
      }).not.toThrow();
      expect(item.x).toBe(DEFAULTS.x);
      expect(item.y).toBe(75);
      expect(item.width).toBe(DEFAULTS.width);
      expect(item.height).toBe(DEFAULTS.height);
      expect(item.type).toBe('joker');
      expect(item.imgsrc).toBe('');
    });

    test('Stamps the item with an immutable ID', () => {
      const item = new ServerItem();
      expect(item).toHaveImmutableProperty('id');
      expect(item.id).toBeGreaterThanOrEqual(0);
    });
  });

  describe('containsPoint(x,y)', () => {
    const item = new ServerItem({
      x: 50,
      y: 50,
      width: 100,
      height: 100,
    });

    test('Accepts points completely inside square', () => {
      expect(item.containsPoint(75,75)).toBe(true);
      expect(item.containsPoint(51,51)).toBe(true);
      expect(item.containsPoint(149,149)).toBe(true);
    });

    test('Rejects points completely outside the square', () => {
      expect(item.containsPoint(0,0)).toBe(false);
      expect(item.containsPoint(200,0)).toBe(false);
      expect(item.containsPoint(0,200)).toBe(false);
      expect(item.containsPoint(200,200)).toBe(false);
    });

    test('Accepts points on the border of the square', () => {
      expect(item.containsPoint(50,50)).toBe(true);
      expect(item.containsPoint(150,50)).toBe(true);
      expect(item.containsPoint(50,150)).toBe(true);
      expect(item.containsPoint(150,150)).toBe(true);
    });

    test('Rejects points just outside the border of the square', () => {
      expect(item.containsPoint(49,49)).toBe(false);
      expect(item.containsPoint(49,151)).toBe(false);
      expect(item.containsPoint(151,49)).toBe(false);
      expect(item.containsPoint(151,151)).toBe(false);
    });
    
    test('Rejects when only one coordinate is valid', () => {
      expect(item.containsPoint(25,75)).toBe(false);
      expect(item.containsPoint(75,25)).toBe(false);
    });

    test('Rejects when one coordinate is barely outside the square', () => {
      expect(item.containsPoint(49,50)).toBe(false);
      expect(item.containsPoint(50,49)).toBe(false);
      expect(item.containsPoint(150,151)).toBe(false);
      expect(item.containsPoint(151,150)).toBe(false);
    });
  });

  describe('moveTo(x, y)', () => {
    const item = new ServerItem({
      x: 0,
      y: 0,
    });

    test('Has no effect if parameters left out', () => {
      expect(item.x).toBe(0);
      expect(item.y).toBe(0);
      expect(() => item.moveTo()).not.toThrow();
      expect(item.x).toBe(0);
      expect(item.y).toBe(0);
    });

    test('Moves the item to the given coordinates.', () => {
      expect(() => item.moveTo(1000,9999)).not.toThrow();
      expect(item.x).toBe(1000);
      expect(item.y).toBe(9999);
    });

    test('Works with negative values', () => {
      expect(() => item.moveTo(-50, -1000)).not.toThrow();
      expect(item.x).toBe(-50);
      expect(item.y).toBe(-1000);
    });

    test('Does not affect other values', () => {
      expect(() => item.moveTo(DEFAULTS.x, DEFAULTS.y)).not.toThrow();
      Object.entries(DEFAULTS).forEach( ([p,v]) => {
        expect(item[p]).toEqual(v);
      });
    });
  });

  describe('moveBy(dx, dy)', () => {
    const item = new ServerItem();

    test('Has no effect if parameters left out', () => {
      expect(item.x).toBe(0);
      expect(item.y).toBe(0);
      expect(() => item.moveBy()).not.toThrow();
      expect(item.x).toBe(0);
      expect(item.y).toBe(0);
    });

    test('Moves the item by the given amount', () => {
      expect(() => item.moveBy(10,20)).not.toThrow();
      expect(item.x).toBe(10);
      expect(item.y).toBe(20);
      expect(() => item.moveBy(13,27)).not.toThrow();
      expect(item.x).toBe(23);
      expect(item.y).toBe(47);
    });

    test('Works with negative values', () => {
      expect(() => item.moveBy(-5,-8)).not.toThrow();
      expect(item.x).toBe(18);
      expect(item.y).toBe(39);
      expect(() => item.moveBy(-25,-48)).not.toThrow();
      expect(item.x).toBe(-7);
      expect(item.y).toBe(-9);
    });

    test('Has no effect on other values', () => {
      expect(() => item.moveBy(7,9)).not.toThrow();
      Object.entries(DEFAULTS).forEach( ([p,v]) => {
        expect(item[p]).toEqual(v);
      });
    });
  });
});

describe('ServerViewSpace', () => {
  const DEFAULTS = {
    x: 0,
    y: 0,
    width: 1600,
    height: 900,
    type: 'view/background',
    effectiveWidth: 1600,
    effectiveHeight: 900,
    scale: 1,
    rotation: 0,
  };

  describe('constructor(bounds, values)', () => {
    test('Throws exception if bounds not provided.', () => {
      expect(() => new ServerViewSpace()).toThrow();
    });

    test('Throws exception if invalid bounds provided.', () => {
      expect(() => new ServerViewSpace({})).toThrow();
      expect(() => new ServerViewSpace({x:1500})).toThrow();
      expect(() => new ServerViewSpace({y:1500})).toThrow();
      expect(() => new ServerViewSpace({x:0, y:0})).toThrow();
      expect(() => new ServerViewSpace({x:100, y:99})).toThrow();
      expect(() => new ServerViewSpace({x:-1, y:100})).toThrow();
      expect(() => new ServerViewSpace({x:100, y:100})).not.toThrow();
    });

    test('Creates correct item type if bounds provided.', () => {
      expect(
        new ServerViewSpace({x:100, y:100})
      ).toBeInstanceOf(ServerViewSpace);
    });

    test('Uses provided bounds', () => {
      let vs;
      expect(() => vs = new ServerViewSpace({x:1150, y:799})).not.toThrow();
      expect(vs.bounds).toBeDefined();
      expect(vs.bounds.x).toBe(1150);
      expect(vs.bounds.y).toBe(799);
    });

    test('Uses default values if none provided', () => {
      let vs;
      expect(() => vs = new ServerViewSpace({x:150, y:150})).not.toThrow();
      Object.entries(DEFAULTS).forEach( ([p,v]) => {
        expect(vs[p]).toEqual(v);
      });
    });

    test('Uses user-defined values, if provided', () => {
      let vs;
      expect(() => {
        vs = new ServerViewSpace({x:150, y:150}, {type:'joker'});
      }).not.toThrow();
      expect(vs.type).toBe('joker');
      Object.entries(DEFAULTS).forEach( ([p,v]) => {
        if (p !== 'type') expect(vs[p]).toEqual(v);
      });
    });

    test('Ignores inaplicable values', () => {
      const vs = new ServerViewSpace({x:150, y:150}, {alpha:3});
      expect(vs.hasOwnProperty('alpha')).toBe(false);
      expect(vs.alpha).toBeUndefined();
    });

    test('Appropriately sets effective width and height', () => {
      const vs = new ServerViewSpace({x:100, y:100}, {
        width: 200,
        height: 100,
        scale: 2,
      });
      expect(vs.effectiveWidth).toBe(100);
      expect(vs.effectiveHeight).toBe(50);
    });

    test('Stamps an immutable ID onto the item', () => {
      const vs = new ServerViewSpace({x:150, y:150});
      expect(vs).toHaveImmutableProperty('id');
      expect(vs.id).toBeGreaterThanOrEqual(0);
    });
  });

  describe('getters', () => {
    const vs = new ServerViewSpace({x:100,y:100}, {
      x: 0,
      y: 0,
      width: 50,
      height: 50,
      scale: 1,
    });

    test('Can get bottom', () => {
      expect(vs.y + vs.effectiveHeight).toBe(50);
      expect(vs.bottom).toBe(50);
    });
    
    test('Can get left', () => {
      expect(vs.x).toBe(0);
      expect(vs.left).toBe(0);
      vs.x = 22;
      expect(vs.left).toBe(22);
      vs.x = 0;
      expect(vs.left).toBe(0);
    });

    test('Can get right', () => {
      expect(vs.x + vs.effectiveWidth).toBe(50);
      expect(vs.right).toBe(50);
    });

    test('Can get top', () => {
      expect(vs.y).toBe(0);
      expect(vs.top).toBe(0);
      vs.y = 42;
      expect(vs.top).toBe(42);
      vs.y = 0;
      expect(vs.top).toBe(0);
    });

    test('Can get center.x', () => {
      let center;
      expect(() => center = vs.center).not.toThrow();
      expect(center.x).toBeDefined();
      expect(center.x).toBe(25);
    });

    test('Can get center.y', () => {
      let center;
      expect(() => center = vs.center).not.toThrow();
      expect(center.y).toBeDefined();
      expect(center.y).toBe(25);
    });

    test('center dynamically updates with viewspace changes', () => {
      const center = vs.center;
      expect(center.x).toBe(25);
      expect(center.y).toBe(25);
      vs.moveBy(10,10);
      expect(center.x).toBe(35);
      expect(center.y).toBe(35);
      vs.moveBy(-5,2.2);
      expect(center.x).toBe(30);
      expect(center.y).toBe(37.2);
      vs.moveBy(0,-7.2);
      expect(center.x).toBe(30);
      expect(center.y).toBe(30);
    });
  });

  describe('canBeScaledTo(width, height)', () => {
    const vs = new ServerViewSpace({x:100,y:100}, {
      x: 0,
      y: 0,
    });

    test('Accepts midrange widths and heights', () => {
      expect(vs.canBeScaledTo(75,50)).toBe(true);
      expect(vs.canBeScaledTo(25,90)).toBe(true);
    });

    test('Accepts scale that uses full space', () => {
      expect(vs.canBeScaledTo(100,100)).toBe(true);
    });

    test('Accepts widths and heights greater than 0', () => {
      expect(vs.canBeScaledTo(1,1)).toBe(true);
      expect(vs.canBeScaledTo(0.1,0.1)).toBe(true);
    });

    test('Rejects if width or height is 0', () => {
      expect(vs.canBeScaledTo(0,0)).toBe(false);
      expect(vs.canBeScaledTo(50,0)).toBe(false);
      expect(vs.canBeScaledTo(0,50)).toBe(false);
    });

    test('Rejects if width or height exceeds bounds', () => {
      expect(vs.canBeScaledTo(999,999)).toBe(false);
      expect(vs.canBeScaledTo(50,999)).toBe(false);
      expect(vs.canBeScaledTo(999,50)).toBe(false);
      expect(vs.canBeScaledTo(100,101)).toBe(false);
      expect(vs.canBeScaledTo(101,100)).toBe(false);
      expect(vs.canBeScaledTo(100,100.1)).toBe(false);
      expect(vs.canBeScaledTo(100.1,100)).toBe(false);
    });

    test('Works with x and y not equal to 0', () => {
      vs.x = 50;
      vs.y = 50;
      expect(vs.canBeScaledTo(50,50)).toBe(true);
      expect(vs.canBeScaledTo(51,50)).toBe(false);
      expect(vs.canBeScaledTo(50,51)).toBe(false);
    });
  });

  describe('rescale(scale)', () => {
    const vs = new ServerViewSpace({x:100,y:100}, {
      x: 0,
      y: 0,
      width: 50,
      height: 50,
      scale: 1,
    });

    test('Works with an acceptable scale', () => {
      expect(vs.rescale(2)).toBe(true);
      expect(vs.scale).toBe(2);
      expect(vs.effectiveWidth).toBe(25);
      expect(vs.effectiveHeight).toBe(25);
      expect(vs.rescale(0.5)).toBe(true);
      expect(vs.scale).toBe(0.5);
      expect(vs.effectiveWidth).toBe(100);
      expect(vs.effectiveHeight).toBe(100);
    });

    test('Has no effect if arguments omitted', () => {
      expect(() => vs.rescale()).not.toThrow();
      expect(vs.scale).toBe(0.5);
      expect(vs.effectiveWidth).toBe(100);
      expect(vs.effectiveHeight).toBe(100);
    });

    test('Does not work with an unnacceptable scale', () => {
      expect(vs.rescale(Number.POSITIVE_INFINITY)).toBe(false);
      expect(vs.effectiveWidth).toBe(100);
      expect(vs.effectiveHeight).toBe(100);
      expect(vs.rescale(0.49)).toBe(false);
      expect(vs.effectiveWidth).toBe(100);
      expect(vs.effectiveWidth).toBe(100);
      expect(vs.rescale(-1)).toBe(false);
      expect(vs.effectiveHeight).toBe(100);
      expect(vs.effectiveHeight).toBe(100);
      expect(vs.rescale(0)).toBe(false);
      expect(vs.effectiveHeight).toBe(100);
      expect(vs.effectiveHeight).toBe(100);
    });
  });

  describe('canMoveTo[X|Y](x|y)', () => {
    const vs = new ServerViewSpace({x:100,y:100}, {
      x: 0,
      y: 0,
      width: 50,
      height: 50,
      scale: 1,
    });

    test('Accepts inputs in centre of acceptable range', () => {
      expect(vs.canMoveToX(25)).toBe(true);
      expect(vs.canMoveToY(25)).toBe(true);
    });

    test('Rejects inputs well outside acceptable range', () => {
      expect(vs.canMoveToX(999)).toBe(false);
      expect(vs.canMoveToY(999)).toBe(false);
    });

    test('Accepts inputs on border of acceptable range', () => {
      expect(vs.canMoveToX(50)).toBe(true);
      expect(vs.canMoveToY(50)).toBe(true);
      vs.x = 50;
      vs.y = 50;
      expect(vs.canMoveToX(0)).toBe(true);
      expect(vs.canMoveToY(0)).toBe(true);
      vs.x = 0;
      vs.y = 0;
    });

    test('Rejects inputs barely outside acceptable range', () => {
      expect(vs.canMoveToX(51)).toBe(false);
      expect(vs.canMoveToY(51)).toBe(false);
      expect(vs.canMoveToX(-1)).toBe(false);
      expect(vs.canMoveToY(-1)).toBe(false);
    });

    test('Works on a rescaled viewspace', () => {
      vs.rescale(2);
      expect(vs.canMoveToX(75)).toBe(true);
      expect(vs.canMoveToY(75)).toBe(true);
      expect(vs.canMoveToX(76)).toBe(false);
      expect(vs.canMoveToY(76)).toBe(false);
      vs.rescale(0.67);
      expect(vs.canMoveToX(25)).toBe(true);
      expect(vs.canMoveToY(25)).toBe(true);
      expect(vs.canMoveToX(26)).toBe(false);
      expect(vs.canMoveToY(26)).toBe(false);
    });
  });

  describe('moveTo(x,y)', () => {
    const vs = new ServerViewSpace({x:100,y:100}, {
      x: 0,
      y: 0,
      width: 50,
      height: 50,
      scale: 1,
    });

    test('Has no effect if arguments omitted', () => {
      expect(() => vs.moveTo()).not.toThrow();
      expect(vs.x).toBe(0);
      expect(vs.y).toBe(0);
    });

    test('Works with acceptable destinations', () => {
      expect(() => vs.moveTo(1,1)).not.toThrow();
      expect(vs.x).toBe(1);
      expect(vs.y).toBe(1);
      expect(() => vs.moveTo(25.23, 47.8)).not.toThrow();
      expect(vs.x).toBe(25.23);
      expect(vs.y).toBe(47.8);
      expect(() => vs.moveTo(50,50)).not.toThrow();
      expect(vs.x).toBe(50);
      expect(vs.y).toBe(50);
      expect(() => vs.moveTo(0,0)).not.toThrow();
      expect(vs.x).toBe(0);
      expect(vs.y).toBe(0);
    });

    test('Has no effect with unacceptable destinations', () => {
      expect(() => vs.moveTo(-1,-1)).not.toThrow();
      expect(vs.x).toBe(0);
      expect(vs.y).toBe(0);
      expect(() => vs.moveTo(999,999)).not.toThrow();
      expect(vs.x).toBe(0);
      expect(vs.y).toBe(0);
      expect(() => vs.moveTo(51,51)).not.toThrow();
      expect(vs.x).toBe(0);
      expect(vs.y).toBe(0);
    });

    test('Can handle X and Y destinations independently', () => {
      expect(() => vs.moveTo(25,75)).not.toThrow();
      expect(vs.x).toBe(25);
      expect(vs.y).toBe(0);
      expect(() => vs.moveTo(-25,25)).not.toThrow();
      expect(vs.x).toBe(25);
      expect(vs.y).toBe(25);
    });
  });

  describe('moveBy(dx,dy)', () => {
    const vs = new ServerViewSpace({x:100,y:100}, {
      x: 0,
      y: 0,
      width: 50,
      height: 50,
      scale: 1,
    });

    test('Has no effect if arguments omitted', () => {
      expect(() => vs.moveBy()).not.toThrow();
      expect(vs.x).toBe(0);
      expect(vs.y).toBe(0);
    });

    test('Works with valid input', () => {
      expect(() => vs.moveBy(5,5)).not.toThrow();
      expect(vs.x).toBe(5);
      expect(vs.y).toBe(5);
      expect(() => vs.moveBy(45,45)).not.toThrow();
      expect(vs.x).toBe(50);
      expect(vs.y).toBe(50);
      expect(() => vs.moveBy(-1,-1)).not.toThrow();
      expect(vs.x).toBe(49);
      expect(vs.y).toBe(49);
      expect(() => vs.moveBy(-49,-49)).not.toThrow();
      expect(vs.x).toBe(0);
      expect(vs.y).toBe(0);
    });
    
    test('Does not work with invalid input', () => {
      expect(() => vs.moveBy(-1,-1)).not.toThrow();
      expect(vs.x).toBe(0);
      expect(vs.y).toBe(0);
      expect(() => vs.moveBy(51,51)).not.toThrow();
      expect(vs.x).toBe(0);
      expect(vs.y).toBe(0);
      expect(() => vs.moveBy(Number.POSITIVE_INFINITY, -1)).not.toThrow();
      expect(vs.x).toBe(0);
      expect(vs.y).toBe(0);
    });

    test('Handles X and Y movement independently', () => {
      expect(() => vs.moveBy(15,-1)).not.toThrow();
      expect(vs.x).toBe(15);
      expect(vs.y).toBe(0);
      expect(() => vs.moveBy(36,15)).not.toThrow();
      expect(vs.x).toBe(15);
      expect(vs.y).toBe(15);
    });
  });
});

describe('ListenerFactory Object', () => {
  const ws = new WorkSpace();
  test('Throws exception if used with "new" operator', () => {
    expect(() => new ListenerFactory()).toThrow();
  });

  describe('.build(type, listener, workspace)', () => {
    test('Throws exception if no arguments provided', () => {
      expect(() => ListenerFactory.build()).toThrow();
    });

    test('Throws exception if invalid event type supplied', () => {
      expect(() => ListenerFactory.build('resize')).toThrow();
    });

    describe.each([['click'],['drag'],['layout'],['scale']])('%s', (s) => {
      test('Will throw if listener is invalid', () => {
        expect(
          () => fn = ListenerFactory.build(s, 5, ws)
        ).toThrow();
      });

      test('Will throw if workspace is invalid', () => {
        expect(
          () => fn = ListenerFactory.build(s, jest.fn(), 'a')
        ).toThrow();
      });

      test('Returns a function', () => {
        expect(
          ListenerFactory.build(s, jest.fn(), ws)
        ).toBeInstanceOf(Function);
      });

      test(`Calls the listener`, () => {
        const handler = jest.fn();
        const listener = ListenerFactory.build(s, handler, ws);
        const vs = ws.spawnView();
        expect(() => listener(vs,1,2,3,4)).not.toThrow();
        expect(handler).toHaveBeenCalledTimes(1);
      });
    });
  });
});

describe('WorkSpace', () => {
  const DEFAULTS = Object.freeze({
    bounds: {
      x: 10000,
      y: 10000,
    },
    clientLimit: 10,
    color: '#aaaaaa',
  });

  describe('constructor(port, settings)', () => {
    test('constructs correct type of object', () => {
      expect(new WorkSpace()).toBeInstanceOf(WorkSpace);
    });

    test('Stamps an immutable ID', () => {
      const ws = new WorkSpace();
      expect(ws).toHaveImmutableProperty('id');
    });

    test('Uses default settings if none provided', () => {
      expect(new WorkSpace().settings).toEqual(DEFAULTS);
    });

    test('Uses user-defined settings, if provided', () => {
      const custom = {
        color: 'rgb(155,72, 84)',
        clientLimit: 4,
        bounds: {
          x: 1080,
          y: 1920,
        },
      };
      expect(new WorkSpace(custom).settings).toEqual(custom);

      const ws = new WorkSpace({color: 'a'});
      expect(ws.settings).not.toEqual(DEFAULTS);
      expect(ws.settings.bounds).toEqual(DEFAULTS.bounds);
      expect(ws.settings.color).toEqual('a');
    });
  });

  describe('getters and setters', () => {
    const ws = new WorkSpace({bounds: {x:7,y:8}});

    test('can get width', () => {
      expect(ws.width).toBe(7);
    });

    test('can get height', () => {
      expect(ws.height).toBe(8);
    });

    test('can set width', () => {
      ws.width = 42;
      expect(ws.width).toBe(42);
    });

    test('can set height', () => {
      ws.height = 43;
      expect(ws.height).toBe(43);
    });
  });

  // Use one workspace for the rest of the tests.
  describe('spawnItem(values)', () => {
    const ws = new WorkSpace();
    const DEFAULTS = Object.freeze({
      x: 0,
      y: 0,
      width: 128,
      height: 128,
      type: 'view/background',
      imgsrc: '',
      drawCustom: '',
      drawStart: '',
    });

    test('Returns a ServerItem', () => {
      expect(ws.spawnItem()).toBeInstanceOf(ServerItem);
    });

    test('Uses default Item values if none provided', () => {
      expect(ws.spawnItem()).toMatchObject(DEFAULTS);
    });

    test('Uses user-defined Item values, if provided', () => {
      const i = ws.spawnItem({x:70,y:40});
      expect(i.x).toBe(70);
      expect(i.y).toBe(40);
      expect(i.width).toBe(DEFAULTS.width);
      expect(i.height).toBe(DEFAULTS.height);
    });

    test('Keeps track of the item', () => {
      const i = ws.spawnItem({x:155,y:155});
      expect(ws.items).toContain(i);
    });
  });

  describe('reportItems()', () => {
    let ws;
    const expectedProperties = [
      'x',
      'y',
      'width',
      'height',
      'type',
      'imgsrc',
      'drawCustom',
      'drawStart',
      'id',
    ];

    beforeAll(() => {
      ws = new WorkSpace();
      ws.spawnItem();
      ws.spawnItem({x:20,y:40});
      ws.spawnItem({x:220,y:240,width:50,height:50});
    });

    test('Returns an array', () => {
      expect(ws.reportItems()).toBeInstanceOf(Array);
    });

    test('Does not return the actual items, but simple Objects', () => {
      const r = ws.reportItems();
      r.forEach( i => {
        expect(i).not.toBeInstanceOf(ServerItem);
        expect(i).toBeInstanceOf(Object);
      });
    });

    test('Objects returned contain only the expected data', () => {
      const r = ws.reportItems();
      r.forEach( i => {
        expect(Object.getOwnPropertyNames(i)).toEqual(expectedProperties);
      });
    });

    test('Returns data for each item that exists in the workspace', () => {
      expect(ws.reportItems().length).toBe(ws.items.length);
    });
  });

  describe('findItemByCoordinates(x,y)', () => {
    let ws;
    beforeAll(() => {
      ws = new WorkSpace();
      ws.spawnItem({x:0,y:0,width:100,height:100});
      ws.spawnItem({x:20,y:40,width:100,height:100});
      ws.spawnItem({x:220,y:240,width:50,height:50});
    });

    test('Finds an item at the given coordinates, if one exists', () => {
      let i = ws.findItemByCoordinates(0,0);
      expect(i).toBeDefined();
      expect(i).toBeInstanceOf(ServerItem);
      expect(i).toBe(ws.items[0]);

      i = ws.findItemByCoordinates(110,110);
      expect(i).toBeDefined();
      expect(i).toBeInstanceOf(ServerItem);
      expect(i).toBe(ws.items[1]);

      i = ws.findItemByCoordinates(250,250);
      expect(i).toBeDefined();
      expect(i).toBeInstanceOf(ServerItem);
      expect(i).toBe(ws.items[2]);
    });

    test('Finds the first item at the given coordinates', () => {
      const i = ws.findItemByCoordinates(25,45);
      expect(i).toBeDefined();
      expect(i).toBeInstanceOf(ServerItem);
      expect(i).toBe(ws.items[0]);
    });

    test('Returns undefined if no item at given coordinates', () => {
      expect(ws.findItemByCoordinates(150,150)).toBeUndefined();
    });
  });

  describe('removeItem(item)', () => {
    let ws;
    let item;
    beforeAll(() => {
      ws = new WorkSpace();
      ws.spawnItem({x:0,y:0,width:100,height:100});
      ws.spawnItem({x:20,y:40,width:100,height:100});
      ws.spawnItem({x:220,y:240,width:50,height:50});
      item = ws.findItemByCoordinates(101,101);
    });

    test('Removes an item if it is found', () => {
      expect(ws.removeItem(item)).toBe(true);
      expect(ws.items).not.toContain(item);
    });
  
    test('Does not remove anything if item not found', () => {
      const is = Array.from(ws.items);
      expect(ws.removeItem(item)).toBe(false);
      expect(ws.items).toMatchObject(is);
    });

    test('Throws exception if no item provided', () => {
      expect(() => ws.removeItem()).toThrow();
    });

    test('Throws exception if provided item is not a ServerItem', () => {
      expect(() => ws.removeItem({id:0})).toThrow();
      expect(() => ws.removeItem(ws.reportItems()[0])).toThrow();
    });
  });

  describe('spawnView(values)', () => {
    let DEFAULTS;
    let ws;
    beforeAll(() => {
      ws = new WorkSpace();
      DEFAULTS = {
        x: 0,
        y: 0,
        width: 1600,
        height: 900,
        type: 'view/background',
        effectiveWidth: 1600,
        effectiveHeight: 900,
        scale: 1,
        rotation: 0,
      };
    });

    test('Returns a ServerViewSpace', () => {
      expect(ws.spawnView()).toBeInstanceOf(ServerViewSpace);
    });

    test('Uses default ViewSpace values if none provided', () => {
      expect(ws.spawnView()).toMatchObject(DEFAULTS);
    });

    test('Uses user-defined ViewSpace values, if provided', () => {
      const vs = ws.spawnView({
        x: 42,
        y: 71,
        scale: 3.5,
      });
      expect(vs.x).toBe(42);
      expect(vs.y).toBe(71);
      expect(vs.scale).toBe(3.5);
      expect(vs.width).toBe(DEFAULTS.width);
      expect(vs.height).toBe(DEFAULTS.height);
    });

    test('Keeps track of ViewSpace', () => {
      const vs = ws.spawnView({
        x:7,
        y:9,
        width: 42,
        height: 870,
      });
      expect(ws.views).toContain(vs);
    });
  });


});

