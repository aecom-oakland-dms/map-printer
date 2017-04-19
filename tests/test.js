'use strict';
// const path = require(path);
// let mapmaker = require(path.join(__dirname, 'make-map'))
let mapmaker = require('../make-map'))
, timermsg = 'test map-printer'
, req = {
  param: function(key){return this.params[key]},
  params: {
    // { 
      all: function(){ return this.params },
      height: '708',
      width: '1071',
      format: 'tabloid',
      orientation: 'landscape',
      filetype: 'pdf',
      // height: '778',
      // width: '752',
      // format: 'letter',
      // orientation: 'portrait',
      // filetype: 'jpg',
      view: `http://localhost:${process.env.port || 1337}/canvas/#20/33.84603/-117.18756/streets/0/0/?layers=Instrumentation%20Locations%2CCDSM%20Cells%2CUser%20Drawings&layerconfigs=Instrumentation%20Locations%24labels%400%2CCDSM%20Cells%24labels%401%2CUser%20Drawings%24labels%400&corners=-117.188278734684,33.845632809998236,-117.18684643507005,33.84641917916848`
      // view: `http://localhost:${process.env.port || 1337}/#20/33.84603/-117.18756/streets/0/0/?layers=Instrumentation%20Locations%2CCDSM%20Cells%2CUser%20Drawings&layerconfigs=Instrumentation%20Locations%24labels%400%2CCDSM%20Cells%24labels%401%2CUser%20Drawings%24labels%400&corners=-117.188278734684,33.845632809998236,-117.18684643507005,33.84641917916848`
      // view: `http://localhost:${process.env.port || 1337}/#21/33.84528/-117.18852/streets/0/0/?layers=Instrumentation%20Locations%2C%2CCDSM%20Columns%2C%2CCDSM%20Elements%2C%2CCDSM%20Cells%2C&layerconfigs=Instrumentation%20Locations%24hiddenlayers%40piezometer-foundation%3Ainclinometer%24opacity%400.95%24labels%401%2CCDSM%20Columns%24hiddenlayers%40transverse%20-%20primary%3Atransverse%20-%20primary%20%7C%20yes%3Atransverse%20-%20secondary%20%7C%20yes%3Alongitudinal%24labels%400%2CCDSM%20Elements%24hiddenlayers%40cored%24labels%401%2CCDSM%20Cells%24labels%400` 
      // view: `http://localhost:${process.env.port || 1337}/#21/33.84528/-117.18852/streets/0/0/?layers=Instrumentation%20Locations%2C%2CCDSM%20Columns%2C%2CCDSM%20Elements%2C%2CCDSM%20Cells%2C&layerconfigs=Instrumentation%20Locations%24hiddenlayers%40piezometer-foundation%3Ainclinometer%24opacity%400.95%24labels%401%2CCDSM%20Columns%24hiddenlayers%40transverse%20-%20primary%3Atransverse%20-%20primary%20%7C%20yes%3Atransverse%20-%20secondary%20%7C%20yes%3Alongitudinal%24labels%400%2CCDSM%20Elements%24hiddenlayers%40cored%24labels%401%2CCDSM%20Cells%24labels%400` 
    // }
    // 
    // view: "http://localhost:1337/#20/33.84248/-117.18501/streets/0/0/?layers=Instrumentation%20Locations%2C%2CCDSM%20Columns%2C%2CCross%20Sections%2C%2CCDSM%20Cells%2C"
    // all layers on
    // view: 'http://localhost:1337/#21/33.84697/-117.19006/streets/0/0/?layers=Instrumentation%20Locations%2C%2CCDSM%20Columns%2C%2CCDSM%20Elements%2C%2CCDSM%20Cells%2C'
    // only cdsm cells
    // view: 'http://localhost:1337/#21/33.84697/-117.19006/streets/0/0/?layers=Instrumentation%20Locations%2C%2CCDSM%20Cells%2C'
    // view: 'http://localhost:1337/#22/33.84707/-117.19009/streets/0/0/?layers=Instrumentation%20Locations%2C%2CCDSM%20Columns%2C%2CCDSM%20Elements%2C%2CCDSM%20Cells%2C'
    // view: 'http://localhost:1337/#22/33.84714/-117.19008/streets/0/0/'
    // view: 'http://localhost:1337/#21/33.84472/-117.18690/streets/0/0/'
    // view: 'http://localhost:1337/#21/33.84659/-117.18961/streets/0/0/'
    // view: 'http://www.dwr-perris.com'
  }
}
, res = {
  // 'node-test': true,
  emit: function(){console.log('res.emit'); return this}, //, arguments); return this},
  send: function(){console.log('res.send:', arguments); return this},
  cookie: function(){console.log('res.cookie:', arguments); return this},
  on: function(){console.log('res.on:', arguments); return this},
  once: function(){console.log('res.once:', arguments); return this},
  write: function(){ return this }, //console.log('res.write:', [].slice.call(arguments).map(arg=>typeof arg)); return this},
  // write: function(){ console.log('res.write:', [].slice.call(arguments).map(arg=>typeof arg)); return this},
  end: function(){console.log('res.end:', arguments); console.timeEnd(timermsg); process.exit(); return this},
  setHeader: function(){console.log('res.setHeader:', arguments); return this},
  removeListener: function(){console.log('res.removeListener:', arguments); return this}
}
;

console.time(timermsg);
mapmaker.getMaps(req, res);