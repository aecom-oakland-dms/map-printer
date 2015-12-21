'use strict';
let mapmaker = require(process.cwd()+ '/' + 'make-map')
, req = {
  params: {
    view: "http://localhost:1337/#20/33.84248/-117.18501/streets/0/0/?layers=Instrumentation%20Locations%2C%2CCDSM%20Columns%2C%2CCross%20Sections%2C%2CCDSM%20Cells%2C"
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
  send: function(){console.log('res.send:', arguments); return this},
  cookie: function(){console.log('res.cookie:', arguments); return this},
  on: function(){console.log('res.on:', arguments); return this},
  once: function(){console.log('res.once:', arguments); return this},
  write: function(){ return this }, //console.log('res.write:', [].slice.call(arguments).map(arg=>typeof arg)); return this},
  // write: function(){ console.log('res.write:', [].slice.call(arguments).map(arg=>typeof arg)); return this},
  end: function(){console.log('res.end:', arguments); process.exit(); return this},
  setHeader: function(){console.log('res.setHeader:', arguments); return this},
  removeListener: function(){console.log('res.removeListener:', arguments); return this}
}
;

mapmaker.getMaps(req, res)