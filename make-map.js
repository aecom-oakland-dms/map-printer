'use strict';
let mapmaker = require('../lib/phantom-mapmaker')
, rmdir = require('../lib/rmdir')
, defaultList = require('../public/js/terminal-getter').defaultList
, events = require('events')
, mime = require('mime')
, path = require('path')
, fs = require('fs')
, tmp = require('tmp')
, gm = require('gm')
, Q = require('q')
, pdfDocument = require('pdfkit')
, exec = require('child_process').exec
;

function makeMap(terminal, options, oncomplete){
  let url = 'http://localhost:3000/responder-maps/' + terminal;
  console.log('sending %s to mapmaker', url);
  mapmaker.makeMap(url, options, oncomplete);
}

function mapcomplete(res, data){
  // console.log(data);
  if(!data)
    return res.send({error : '?'})

  
  let datacallback = data.callback;
  if(data.error)
    return res.send({error: '-?-'})

  let filepath = data.filepath
  , sendname = data.sendname
  , mimetype = mime.lookup(filepath)
  ;
  
  console.log(data.filepath);

  let cleanupattempts = 0;
  function cleanup(evt){
      cleanupattempts+=1;
      // console.log('cleaning up - checking if %s exists', filepath)
      fs.exists(filepath, function(exists){
        if(exists){
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
        // console.log('cleaned up temp file: %s - on %s', filepath, evt);
      })
  }

  try{
      setCookie(res, sendname.split(' ').shift());

      res.setHeader('Content-disposition', 'attachment; filename=' + sendname );
      res.setHeader('Content-type', mimetype);
      
      if(datacallback instanceof Function)
        // catch all possible res close events and do temp file cleanup
        res.on('finish', cleanup.bind('finish'))
         .on('close', cleanup.bind('close'))
         .on('error', cleanup.bind('error'))


      let filestream = fs.createReadStream( path.resolve(filepath) );
      return filestream
        .on('end', function(){
          res.end && res.end()
        })
        .pipe(res, {end: false})

  }catch(err){
    console.log(err);
    datacallback instanceof Function && datacallback()
  }
  
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
};

exports.getMaps = function(req, res){
   let terminal = req.params.terminal || req.query.terminal;
   let terminals = terminal ? [terminal] : Object.keys(defaultList).sort();

   let queue = new Queue();
    queue.on('change', function(){
      let next = queue.functions.shift();
      next && next() || queue.removeAllListeners('change');
    })

  queue.functions = [];
  queue.results = [];
  queue.pageorder = {};
  
   let concurrent = 0
   , done
   , accessnote = 'Accessed: ' + new Date().toLocaleDateString() + ' - ' + new Date().toLocaleTimeString()
   ;
    
   terminals.forEach(function(terminal, index){
      let func = function(){
          if(done || queue.results.length === terminals.length){
            done = true;
            queue.removeAllListeners('change');
          }

          let options = {
            accessnote : accessnote
            , pageNum : terminals.length > 1 ? index+1 : 1
            , numPages : terminals.length > 1 ? terminals.length +1 : 1 
          }

          concurrent +=1;
          console.log('concurrent renderers:', concurrent, 'now starting terminal: ', terminal)
          return makeMap(terminal, options, function(data){
            queue.results.push( data );
            queue.emit('change')
            queue.pageorder[options.pageNum] = data;
            concurrent -= 1;
            // console.log('concurrent renderers:', concurrent);
            if(queue.results.length === terminals.length || concurrent===0){
              done = true;
              let ordered = correctOrder( queue.pageorder )
              ordered.unshift( terminals.length === 1 ? terminal : 'Responder Maps' )
              return makePDF(ordered, res, mapcomplete);
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

// GraphicsMagick page sizes from http://www.graphicsmagick.org/GraphicsMagick.html#details-page
// let pageSizes = {
//   '11x17' : [792, 1224]
//   , 'Ledger' : [1224, 792]
//   , 'Legal' : [612, 1008]
//   , 'Letter' : [612, 792]
// }

function makePDF(data, res, callback){
  // let jpgs = []
  let pdfName = data.shift() + '.pdf'
  , pdf = new pdfDocument(
  {
    layout : 'landscape'
    , Title: pdfName
    , title: pdfName
    , Author: 'Port of Oakland'
    , author: 'Port of Oakland'
    , CreationDate: new Date().toLocaleString()
    , creationDate: new Date().toLocaleString()
  }
  )
  ;

  tmp.dir({prefix: 'responder-maps' }, function _tempDirCreated(err, tempdir) {
    if (err) throw err;
   
    // console.log("Dir: ", tempdir);
    let pdfpath = path.join(tempdir, pdfName)
    , promises = []
    , deletes = []
    , mergepdfs = []
    ;

    console.log('creating', pdfpath);

    let length = data.length
    , counter = 0
    ,  accessnote = 'Accessed :' + new Date().toLocaleDateString() + ' - ' + new Date().toLocaleTimeString()
    ;

    if(length > 1){
        data.forEach(function(el){
          if(el.filepath){
            let mimetype = mime.lookup(el.filepath);
            // pdfs
            if( ! ~ mimetype.indexOf('image') ){
              mergepdfs.push('"' + el.filepath + '"')
            }
            
            // handle image
          }
          if(el.callback instanceof Function)
            deletes.push(el.callback)
        })
      
    }else{
      // send the pdf and break out of the loop if this is the only pdf
          Q.fapply( function(){
            mapcomplete(res, data[0])
          }).then(function(){
              deleteDir(tempdir)
            })
      return 
    }

    mergePDFs(mergepdfs, pdfpath, function(){
        readyToSend(tempdir, pdfpath, pdfName, deletes, callback, res)
    })
    
  });
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
    // "<tr><td colspan='1' style='text-align: center;'><small>PORT OF OAKLAND  |  gis.support@portloakland.com</small></td></tr>" +
}

function readyToSend(tempdir, pdfpath, pdfName, deletes, callback, res){
  console.log('ready to send==========');
  let resdata = {
      filepath : pdfpath,
      sendname : pdfName,
      callback: function(){
        console.log('done!', 'now it`s time to delete', pdfpath);
        setTimeout(function(){
          deleteDir(tempdir)
          while(deletes.length>0){
            // console.log(deletes.length, 'still left to delete');
            deletes.shift()()
          }
        }, 5000) // wait 5 seconds then delete the files
          
      }
    }

    callback(res, resdata);
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
  pdfs.unshift('"\\\\jls-file/DATA/Shared/Wharf/Responder Maps/maritime.map.pdf"');
  // pdfs.unshift('"S:/Shared/Wharf/Responder Maps/maritime.map.pdf"');
  
  let cmd = 'gs -dNOPAUSE -sDEVICE=pdfwrite\
   -sOUTPUTFILE="' + outfilepath + '"\
   -dBATCH ' + pdfs.join(' ')
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