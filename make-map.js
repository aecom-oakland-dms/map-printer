'use strict';
let mapmaker = require('./map-printer')
, rmdir = require('node-rmdir')
, events = require('events')
, mime = require('mime')
, path = require('path')
, fs = require('fs')
, tmp = require('tmp')
// , gm = require('gm')
, Q = require('q')
, pdfDocument = require('pdfkit')
, exec = require('child_process').exec
, cachetimeout = 1000 * 60 * 15 // 15 minutes
// cache items for `cachetimeout` so they don't need to be regenerated again within 30 seconds
, cachedfiles = {}
;

function makeMap(url, options, oncomplete){
  // let url = 'http://localhost:3000/responder-maps/' + view;
  // console.log('sending %s to mapmaker', url);
  // cachedfiles[url] = {}
  mapmaker.makeMap(url, options, oncomplete);
}

function mapcomplete(res, data){
  // console.log('mapcomplete:', data);
  // console.log('mapcomplete', 'this', this, 'data', data);
  if(!data)
    return res.send({error : '?'})

  let datacallback = data instanceof Array ? (evt)=>{
      console.log(evt, 'trying to run datacallbacks for multiple items');
      data.forEach(item=>{
        console.log('about to run datacallback for', item.filepath);
        item.datacallback && item.datacallback();
        item.callback && item.callback();
      });
    }
    : data.callback
  ;

  if(data.error)
    return res.send({error: '-?-'})

  // console.log('this is:', this);
  // console.log('data is:', data);

  // if(data.initOptions){
  console.log('storing cached item for:', this.view)
  let savedItem;
  if(!cachedfiles[this.view]){
    let storeItem = {};
    if(data instanceof Array){
      data.forEach( item=> storeItem[item.type] = {filepath: item.filepath, type:item.type, name: item.sendname, deletetimer: item.deletetimer} )
    }else
      storeItem = {filepath: data.filepath, type:item.type, name: data.sendname, deletetimer: data.deletetimer}
    
    savedItem = cachedfiles[this.view] = storeItem;
  }

  // let sendItem =  data instanceof Array ? 
  //   data.filter(item=>item.type==this.filetype)[0]
  //   : data
  // ;

  let sendItem =  savedItem[this.filetype] || savedItem;

  // console.log('sendItem is:');
  // console.dir(sendItem);

  let filepath = sendItem.filepath
  , sendname = sendItem.name
  ;

  // console.log('sendItem:', sendItem);
  // console.log('filepath:', filepath);

  let cleanupattempts = 0;

  function cleanup(evt){
      cleanupattempts+=1;
      console.log('cleaning up - checking if %s exists', filepath)  
      fs.exists(filepath, exists=>{
        if(exists){
          // remove from the memory cache
          delete cachedfiles[this.view]
          
          try{
              datacallback()
          }
          catch(err){
            console.err(err);
            if(cleanupattempts>15)
                return console.warn('too many attempts to cleanup %s.  Moving on...', filepath)
            return cleanup(evt);
          }
        }
      })
  }

  try{
    if(datacallback instanceof Function)
      // catch all possible res close events and do temp file cleanup
      res.on('finish', evt=>
          setTimeout(t=>{
            cleanup.call('finish');
          }, cachetimeout)
        )
       .on('close', evt=>
          setTimeout(t=>{
            cleanup.call('close');
          }, cachetimeout)
        )
       .on('error', evt=>
          setTimeout(t=>{
            cleanup.call('error');
          }, cachetimeout)
        )
      return streamFile(filepath, sendname, res)

  }catch(err){
    console.log('error in mapcomplete:', err);
    setTimeout(t=>{
      datacallback instanceof Function && datacallback()
    }, cachetimeout)
  }
  
}

function streamFile(filepath, sendname, res){
  let mimetype = mime.lookup(filepath);
  console.log('streaming:', path.resolve(filepath), 'as:', sendname, 'with mimetype:', mimetype);
  
  setCookie(res, sendname.split(' ').shift());
  res.setHeader('Content-disposition', 'attachment; filename=' + sendname );
  res.setHeader('Content-type', mimetype);

  // can remove below since it's now handled in the noCache middleware in sails.config.http.middleware
  // prevent caching in the browser
  // res.setHeader('Expires', '-1');
  // res.setHeader('Pragma', 'no-cache');
  // res.setHeader('Cache-Control', 'Cache-Control', 'private, no-cache, no-store, must-revalidate');

  let filestream = fs.createReadStream( path.resolve(filepath) );
  try{
    filestream
      .on('end', function(){
        res.end && res.end()
      })
      .pipe(res, {end: false})
  }catch(err){
    console.error(err, 'with filestream')
  }
  return filestream
}

function setCookie(res, cookiename){
  let randomNumber=Math.random().toString();
    randomNumber=randomNumber.substring(2,randomNumber.length);
    res.cookie(cookiename,randomNumber, { maxAge: 900000, httpOnly: false });
}

function Queue(){
   events.EventEmitter.call(this);
} 

Queue.prototype = {
  __proto__ : events.EventEmitter.prototype
  , results : []
  , functions : []
  , pageorder: {}
};

module.exports.getMaps = function(req, res, opts){
  let query = req.query || {};
  let view = req.params ? req.params.view || query.view : 'www.google.com';
  let views = view ? [view] : undefined
  , viewname = views.join('---')
  , allparams = req.params && req.params.all() || req.query || {}
  , cacheID = Object.keys(allparams).map(key=>key!=='filetype' ? key + '=' + allparams[key] : '').join(' ')
  , filetype = allparams.filetype || '.jpg'
  ;

  opts = opts  || {};

  let cached = cachedfiles[cacheID];
  if(cached){
    // console.log('sending cached item for view:', view, cachedfiles[view]);
    
    // console.log('cached is:');
    // console.dir(cached);
    
    let cachedItem = cached[filetype] || cached['.' + filetype];
    // console.log('cachedItem is')
    // console.dir(cachedItem);

    // if(/pdf/i.test(allparams.filetype)){
    //   if(!cached.pdfpath)
    //     return sendAsPDF.call({ view: cacheID }, cached, res, mapcomplete)
    //   else
    //     // return streamFile(cached.filepath, cached.filepath, res);
    //     return streamFile(cached.pdfpath, cached.pdfname, res);
    // }
    
    if( cachedItem && fs.existsSync(cachedItem.filepath) ){
      console.log('sending cached item for view', 'for filetype:', filetype);
      return streamFile(cachedItem.filepath, cachedItem.name, res)
    }

    // return streamFile(cached.filepath, cached.name, res);
  }

  let queue = new Queue();
  queue.on('change', function(){
    let next = queue.functions.shift();
    next && next() || queue.removeAllListeners('change');
  })
  
   let concurrent = 0
   , done
   , accessnote = 'Accessed: ' + new Date().toLocaleDateString() + ' - ' + new Date().toLocaleTimeString()
   ;
    
   views.forEach(function(view, index){
      let func = function(){
          if(done || queue.results.length === views.length){
            done = true;
            queue.removeAllListeners('change');
          }

          let options = {
            accessnote : accessnote
            , pageNum : views.length > 1 ? index+1 : 1
            , numPages : views.length > 1 ? views.length +1 : 1 
            , height: req.param('height') || query.height
            , width: req.param('width') || query.width
            , format: req.param('format') || query.format
            , filetype: req.param('filetype') || query.filetype
            , orientation: req.param('orientation') || query.orientation
            , quality: req.param('quality') || query.quality
            , combined: req.param('combined')
          }

          // make a copy just in case it gets mutated
          let copy =JSON.parse(JSON.stringify(opts))

          for(let key in copy)
            options[key] = copy[key]

          concurrent +=1;
          console.log('concurrent renderers:', concurrent, 'now starting view: ', view)

          return makeMap(view, options, function(data){

            queue.results.push( data );
            queue.emit('change')
            queue.pageorder[options.pageNum] = data;
            concurrent -= 1;
            // console.log('concurrent renderers:', concurrent);
            if(queue.results.length === views.length || concurrent===0){
              done = true;
              let ordered = correctOrder( queue.pageorder )
              ordered.unshift( view )
              // ordered.unshift( views.length === 1 ? view : 'Responder Maps' )
              return makePDF.call({ view: cacheID, filetype: options.filetype, combine:options.combined },ordered, res, mapcomplete);
            }
          });
      }

      if(concurrent < 10 && !done){
         func();
      }else{
          queue.functions.push(func)
      }
   })

}

function correctOrder(ordermap){
    return Object.keys(ordermap).sort().map(function(index){
        return ordermap[index]
    })
}

function sendAsPDF(options, res, callback){
  let pdfpath = options.filepath.replace(/(\.png|\.jpg)$/i, '.pdf')
  , parts = pdfpath.split(/\/\\/g)
  , pdfname = parts.pop()
  , tempdir = parts.join('/')
  , deletes = []
  ;
  console.log(pdfpath, options.filepath, pdfname, tempdir)
  convertJPG(options.filepath, pdfname, done=>{
      // set name and path in the cache
      options.pdfpath = pdfpath;
      options.pdfname = options.name.replace(/(\.png|\.jpg)$/i, '.pdf');;

      deletes.push(()=>fs.unlink(options.filepath, cb=>console.log('deleted', options.filepath)) ) ;
      setTimeout(t=>{
        readyToSend.call(this, tempdir, pdfpath, options.pdfname, deletes, callback, res)
      }, 500)
  })
}

// GraphicsMagick page sizes from http://www.graphicsmagick.org/GraphicsMagick.html#details-page
// let pageSizes = {
//   '11x17' : [792, 1224]
//   , 'Ledger' : [1224, 792]
//   , 'Legal' : [612, 1008]
//   , 'Letter' : [612, 792]
// }

function makePDF(data, res, callback){
  // let jpgs = []
  // console.log('makePDF', 'this', this);
  let pdfName = data.shift() + '.pdf'
  , author = '{AUTHOR}'
  , date = new Date().toLocaleString()
  , pdf = new pdfDocument({
    layout : 'landscape'
    , Title: pdfName
    , title: pdfName
    , Author: author
    , author: author
    , CreationDate: date
    , creationDate: date
  })
  ;

  // console.log('data:', data);

  // if(!data instanceof Array){
  //   // pdfName = data.sendname || ('Print Output' + new Date().toLocaleDateString())
  //   data = [data]
  // }

  if(data.length > 1 && this.combine){
    tmp.dir({prefix: 'map-print' }, (err, tempdir)=>{
      if (err) throw err;
     
      // console.log("Dir: ", tempdir);
      let pdfname = (data[0].sendname || pdfName).replace(/(\.png|\.jpg)$/i, '.pdf') 
      , pdfpath = path.join(tempdir, pdfname)
      , promises = []
      , deletes = []
      , mergepdfs = []
      // , convertimages = []
      ;

      console.log('creating', pdfpath);

      let  accessnote = 'Accessed :' + new Date().toLocaleDateString() + ' - ' 
      + new Date().toLocaleTimeString()
      ;

      // if(length > 1){
      data.forEach(el=>{
        if(el.filepath){
          let mimetype = mime.lookup(el.filepath);
          // pdfs
          if( ! ~ mimetype.indexOf('image') ){
            mergepdfs.push('"' + el.filepath + '"')
          }
          // else{
          //   convertimages.push(el.filepath)
          // }
        }
        if(el.callback instanceof Function)
          deletes.push(el.callback)
      })

      // if(convertimages.length>0){
      //   convertimages.forEach((image, index)=>{
      //     let name = convertimages.length > 1 ? index+pdfname : pdfname
      //     , filepath = path.join(tempdir, name)
      //     ;
      //     convertJPG(image, filepath, function(){
      //         mergepdfs.push(filepath);
      //         deletes.push(filepath);
      //         // readyToSend.call(this, tempdir, pdfpath, pdfName, deletes, callback, res)
      //     })
      //   })
      // }

      if(mergepdfs.length>0){
        mergePDFs(mergepdfs, pdfpath, ()=>{
            readyToSend.call(this, tempdir, pdfpath, pdfname, deletes, callback, res)
        })
      }else{
        // setTimeout(t=>{
          readyToSend.call(this, tempdir, pdfpath, pdfname, deletes, callback, res)
        // }, 500)
      }

    })
  }
  else{
    // send the pdf and break out of the loop if this is the only pdf
    Q.fapply( ()=>{
      // console.log('callback is:')
      // console.dir(callback);
      callback.call(this, res, data[0])
      // mapcomplete.call(this, res, data[0])
    }).then(function(){
        deleteDir(tempdir)
      })
    return 
  }
}

function addPageFooter(pdf, pageNum, numPages, accessnote) {

  pdf.moveTo(500)
  pdf.text(accessnote, {align : 'left'} )
  pdf.moveTo(500, 200)
  // pdf.moveDown()
  pdf.text(pageNum + " / " + numPages, {align : 'right'} )
  // return "<img src='" + footerImageUrl + "' alt='Surly Labs' />" +
  // return "<table width='100%'>" + 
  //   "<tr><td><small> " + accessnote + "</small></td>" +
  //   "<td>&nbsp;</td> <td>&nbsp;</td>" +
  //   "<td colspan='2' style='text-align: right;'><small>" + pageNum + " / " + numPages + "</small></td></tr>" +
  //   "</table>";
    // "<tr><td colspan='1' style='text-align: center;'><small>ORGANIZATION  |  contact@organization.com</small></td></tr>" +
}

function readyToSend(tempdir, pdfpath, pdfName, deletes, callback, res){
  console.log('ready to send==========');

  let resdata = {
      filepath : pdfpath,
      sendname : pdfName,
      callback: function(){
        console.log('done!', 'now it`s time to delete', pdfpath);
        resdata.deletetimer = setTimeout(function(){
          deleteDir(tempdir);
          while(deletes.length>0){
            // console.log(deletes.length, 'still left to delete');
            let func = deletes.shift()
            if(func instanceof Function)
              func()
          }
        }, cachetimeout) // wait time specified in cachetimeout
          
      }
    }

    return callback.call(this, res, resdata);
}

function deleteDir(dir){
  rmdir.async(dir, function(err){
    if(err)
      return err// console.error('error', err, 'when trying to delete', dir)
    // return console.log(dir, 'deleted!')
    return
  })
}

function mergePDFs(pdfs, outfilepath, callback){
  // add other pdfs to the mapbook - eg. cover sheet, etc
  // pdfs.unshift('"/user/coversheet.pdf"');
  
  let cmd = 'gs -dNOPAUSE -sDEVICE=pdfwrite'
  + ' -sOUTPUTFILE="' + outfilepath + '"'
  + ' -dBATCH ' + pdfs.join(' ')
  ;
  console.log(cmd, pdfs.join(' '));

  let child = exec(cmd, function(error, stdout, stderr){
    console.log('stdout: ' + stdout);
    console.log('stderr: ' + stderr);
    if(error) {
      console.log('exec error: ' + error);
      return callback(error)
    }
    return callback()
  })

}

function convertJPG(image, outfilepath, callback){
  // add other pdfs to the mapbook - eg. cover sheet, etc
  // pdfs.unshift('"/user/coversheet.pdf"');
  
  let cmd = `img2pdf -s letter -o "${outfilepath}" "${image}"`
 
  console.log(cmd, image);

  let child = exec(cmd, function(error, stdout, stderr){
    console.log('stdout: ' + stdout);
    console.log('stderr: ' + stderr);
    if(error) {
      console.log('exec error: ' + error);
      return callback(error)
    }
    return callback()
  })

}