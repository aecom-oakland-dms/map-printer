'use strict';
// let phantom = require('phantomjs')
let phantom = require('phantom')
, EventEmitter = require('events')
, util = require('util')
// let phantom = require('node-phantom')
, tmp = require('tmp')
, url
, outfile
; 


function Queue() {
  // Initialize necessary properties from `EventEmitter` in this instance
  EventEmitter.call(this);
}

// Inherit functions from `EventEmitter`'s prototype
util.inherits(Queue, EventEmitter);
Queue.prototype.list = [];

// cleanup the temporary files even when an uncaught exception occurs.
// tmp.setGracefulCleanup();

function setPageSize(page, pageSize, pageOrientation, ph){
    // let pageSize = "A4"
    // let pageOrientation = "landscape",
    let temp
    , dpi = 300
    // , dpi = 150 //from experimenting with different combinations of viewportSize and paperSize the pixels per inch comes out to be 150
    , cmToInchFactor = 0.393701 
    , widthInInches
    , heightInInches
    , accessnote = 'Accessed at:' + new Date().toLocaleDateString() + ' - ' + new Date().toLocaleTimeString()
    , margin = '1cm'
    , viewportWidth
    , viewportHeight
    , viewportSize
    ;

    switch(pageSize){
        case 'Letter':
            widthInInches = 8.5;
            heightInInches = 11;
            // // remember that these are swapped for Landscape orientation
            // viewportWidth = 1450;
            viewportWidth = 1250;
            viewportHeight = 1800;
            break;
        case 'Legal':
            widthInInches = 8.5;
            heightInInches = 14;
            break;
        case 'A3':
            widthInInches = 11.69
            heightInInches = 16.54;
            break;
        case 'A4':
            widthInInches = 8.27;
            heightInInches = 11.69;
            break;
        case 'A5':
            widthInInches = 5.83;
            heightInInches = 8.27;
            break;
        case 'Tabloid':
        default:
            widthInInches = 11;
            heightInInches = 17;
            // viewportWidth = 2250;
            // viewportWidth = 2500;
            // viewportHeight = 3600;
            viewportWidth = 1850;
            viewportHeight = 3000;
            break;
    }

    //reduce by the margin (assuming 1cm margin on each side)
    widthInInches-= 2*cmToInchFactor;
    heightInInches-= 2*cmToInchFactor;

    //interchange if width is equal to height
    if(pageOrientation === 'Landscape'){
        temp = widthInInches;
        widthInInches = heightInInches;
        heightInInches = temp;

        temp = viewportWidth;
        viewportWidth = viewportHeight
        viewportHeight = temp
    }

    // calculate corresponding viewport dimension in pixels
    if(filetype !== '.pdf'){
        viewportWidth = dpi*widthInInches;
        viewportHeight = dpi*heightInInches;
    }

    // possible paper sizes for GS from - http://www.a4papersize.org/a4-paper-size-in-pixels.php
    page.set('paperSize', { 
        format: pageSize
        , orientation: pageOrientation
        , margin: margin
        , border: margin
        , header: {
            height: '0.0cm'
        }
        , footer: {
            height: '0.0cm'
        }
    }); 

    page.set('viewportSize', { width:  viewportWidth, height: viewportHeight }, function(){
        // callback
    } ); 
    
    // resolution things -- don't seem to be important or have effect
    // page.set('zoomFactor',  100.0/96.0); //windows
    // page.set('zoomFactor',  0.821980);
    // page.set('zoomFactor',  100.0/72.0); // osx

    return { 
        orientation: pageOrientation.toLowerCase()
        , sizeFormat: pageSize
        , filetype : filetype
        , pageSize : {
            width: viewportWidth
            , height: viewportHeight
        }
    }
}


// let filetype = '.pdf';
// let filetype = '.png';
let filetype = '.jpg';
function openPageAtUrl(page, ph, url, options, callback){
    console.log('opening page at:', url);
    let orientation = 'Landscape';
    // let orientation = 'Portrait';

    // let pageinfo = setPageSize(page, 'Tabloid', orientation, ph);
    let pageinfo = setPageSize(page, 'Letter', orientation, ph);

    pageinfo.pageOptions = options;
    
    // node-phantom callback returns err and status args
    // page.open( url, function(err, status){
         // if(err){
            // throw new Error(err)
            // setTimeout(function(){ph.exit()}, 0)
         // }
    // phantom callback returns only status arg
    page.open( url, function(status){
         if (status !== 'success') {
            console.log('Unable to access network', status);
            setTimeout(function(){ph.exit()}, 0)
            // ph.exit(1);  // thow error if you want to
            if(callback && callback instanceof Function)
                return callback({error: ['phantom unable to open webpage at', url].join(' '), status: status})
        } else 
            onPageOpen(page, ph, pageinfo, url, callback)
    });
}

function onPageOpen(page, ph, pageinfo, url, callback){
    page.evaluate( 
        function(pageinfo){ 
            'use strict';
            window.phantom = true;

            console.log('running javascript on page via phantom', 'window.phantom?', window.phantom);

            // add phantom class to styles in phantom-mods.css are applied
            $('html')
                .addClass('phantom')
                .addClass(pageinfo.orientation || '')
            ;
            
            pageinfo = pageinfo || {};
            // console.log(pageinfo, arguments);
            /* run javascript on webpage */
            var size = pageinfo.pageSize || {}
            , filetype = pageinfo.filetype || ''
            , pageOptions = pageinfo.pageOptions || {}
            ;
            
            // add the pageinfo
            // $('footer').append(
            //     "<table width='100%'>" + 
            //       "<tr><td class='pull-left'><small> " + (pageOptions.accessnote || '') + "</small></td>" +
            //       "<td>&nbsp;</td> <td>&nbsp;</td>" +
            //       "<td colspan='2' style='text-align: right;'><small>" + pageOptions.pageNum + " / " + pageOptions.numPages + "</small></td></tr>" +
            //       "</table>"
            // );


            // [$(window), $('html'), $('body')].forEach(function(whb){
            //         whb.height(777)
            //         .width(947)
            // })
            // adjustments for pdf output
            // if(filetype==='.pdf'){
            //     [$(window), $('html'), $('body')].forEach(function(whb){
            //         if(size.width){   
            //             whb.width(size.width)
            //                 .css('width', size.width)
            //                 // .css('width', size.width*4)
            //         }
            //         else{
            //             whb.width(900)
            //         }

            //         if(size.height)
            //             whb.height(size.height)
            //                 .css('height', size.height)
            //                 // .css('height', size.height+100)
            //         else
            //             whb.height( 800 )
            //     })
            // }
             
            // remove all href's because they aren't necessary and they render sometimes in the PDF output
            $('a').attr('href', null);

            // $('.leaflet-control-zoom').hide();
            
            // // does this slow it down and allow eveything to load?
            // function wait(cb){
            //     return new Promise(function(resolve, reject){
            //         console.time('waiter');
            //         [].map.call( $('body').html(), function(x, index) { var a = new Object(); a[index] =  x.charCodeAt(0); return a})
            //             .sort()
            //             .slice(0)
            //             .sort()
            //         console.timeEnd('waiter')
            //         if(cb instanceof Function){
            //             var next = cb();
            //             if(next.then)
            //                 next.then(function(){ resolve(true) })
            //             else
            //                 resolve(true)
            //         }else
            //             resolve(true);
            //     })
            // }

            $('.markerLabel')
                // .removeClass('trans')
                .css('font-size', '+=15px');

            // hide legend items for layer's that aren't visible
            // $('.layer-toggle:not(:checked)').closest('.legendGroup').hide()
            // $('.legendGroup[class*=" disabled-"]').hide()

            // var mapcontainer = $(app.map.getContainer());
            console.log('DONE RUNNING JAVASCRIPT ON PHANTOMJS PAGE');
            return {
                title: document.title
                // , footer: $('footer').html()
                // , center: app.map.getCenter()
                // , zoom: app.map.getZoom()
                // , size: size
                // , map: {
                //     width: mapcontainer.width()
                //     , height: mapcontainer.height()
                // }
                // 
                // , svgImage: $('svg.legendImage').first()//[0].outerHTML
                // , filetype: filetype
                // ,  mapinfo: {
                //     width: $('#map').width()
                //     , height:  $('#map').height()
                //     , css : {
                //         width : $('#map').css('width')
                //         , height : $('#map').css('height')
                //     }
                // } 
                // ,  htmlinfo: {
                //     width: $('html').width()
                //     , height:  $('html').height()
                //     , css : {
                //         width : $('html').css('width')
                //         , height : $('html').css('height')
                //     }
                // }
                // ,  bodyinfo: {
                //     width: $('body').width()
                //     , height:  $('body').height()
                //     , css : {
                //         width : $('body').css('width')
                //         , height : $('body').css('height')
                //     }
                // }
                // ,  footerinfo: {
                //     width: $('footer').width()
                //     , height:  $('footer').height()
                //     // , html : $('footer').html()
                //     , css : {
                //         width : $('footer').css('width')
                //         , height : $('footer').css('height')
                //     }
                // }
            }
        }
        // callback after page.evaluate finished
        // , function onEvaluated(err, args){
            // console.log('onEvaluated', err, args);
            // if(err){
            //     throw new Error(err)
            // }
        , function onEvaluated(args){
            // console.log('onEvaluated args:', arguments);
            args = args || { title: 'test-title'};
            
            let title = args.title
            // , footer = args.footer
            , name = createFileName(title,url)
            ;
            
            console.log('Creating', name);
            // console.log('Creating', title, args.filetype);
            
            // console.log('MAPINFO', args.mapinfo);
            // console.log('HTMLINFO', args.htmlinfo);
            // console.log('BODYINFO', args.bodyinfo);
            // console.log('WINDOWINFO', args.windowinfo);
            // console.log('FOOTERINFO', args.footerinfo);
            // console.log('resourceQueue', pageinfo.pageOptions.resourceQueue);
            pageinfo.pageOptions.resourceQueue.then(
                function(){
                    console.log('resourceQueue is empty');
                    createPDF(page, ph, name, callback);
                }    
            )
        } 
        // pass arguments into page evaluate
        , pageinfo
    )
}

function createPDF(page, ph, outfile, callback){
    // hacky stupid way to wait for it to load
    setTimeout(function(){
        console.log('creating temp file with prefix:', outfile, 'postfix:', filetype);
        tmp.file({ prefix: outfile, postfix: filetype, keep: true }, function _tempFileCreated(err, filepath, fd, cleanupCallback) {
          if (err) return console.error(err)//throw err;
          
          page.render(filepath, {quality: '100'} );
          setTimeout(function(){
              console.log('rendered:', outfile)
              if(callback && callback instanceof Function){
                  // If we don't need the file anymore we could manually call the cleanupCallback. -- NEED TO DO SO WHEN {keep: true} is passed in options 
                  // -- Otherwise that is not necessary if we didn't pass the keep option because the library will clean after itself. 
                  return callback({ success: true, filepath: filepath, callback: cleanupCallback, sendname: outfile + filetype })
              }else
                  cleanupCallback();
              
              ph.exit();
          }, 3000)
        });
    }, 3000)
}

function createFileName(title, url){
  let name = title || url.split('/').pop();
  name = name.replace(/\\|\/|\./ig, '-');
  return name
}

function onPhantomError(msg, trace) {
  var msgStack = ['PHANTOM ERROR: ' + msg];
  if (trace && trace.length) {
    msgStack.push('TRACE:');
    trace.forEach(function(t) {
      msgStack.push(' -> ' + (t.file || t.sourceURL) + ': ' + t.line + (t.function ? ' (in function ' + t.function +')' : ''));
    });
  }
  console.error(msgStack.join('\n'));
  phantom.exit(1);
}

function makeMap(url, options, callback){
    console.log('url passed to map-printer.makeMap:', url);
    try{
      phantom.onError = onPhantomError;

      phantom.create(function (ph) {
      // phantom.create(function (err, ph) {
        // if(err)
            // console.error('there was en error:', err)
        // else
        // console.log('successfully created phantom page...');
        // ph.createPage(function (err, page) {
        ph.createPage(function (page) {
            let requests = new Queue()
            , timelimit = 5000
            , resourceQueue = new Promise((resolve, reject)=>{
                let timer;

                function checkqueue(){
                    process.stdout.write(`${requests.list.length} requests remaining in phantomjs page. \r`)
                    timer && clearTimeout(timer);
                    timer = setTimeout(()=>{
                        if(!requests.resolved){
                            if(requests.list.length==0){
                                console.log('requests done');
                                requests.removeAllListeners('close')
                                requests.resolve = resolve( true );
                            }
                        }
                    },3000);
                };

                requests
                    .on('open', url=>{
                        requests.list.push(url);
                        // console.log('phantomjs page opened request at:', url)
                        // set a time limit for requests of 3 seconds
                        // let timer = setTimeout(function(){requests.emit('close', url, true) }, timelimit);
                        // requests.once('close', urlclosed=>{
                        //     if(urlclosed==url){
                        //         console.log('urlclosed', urlclosed, 'matches url?', urlclosed===url)
                        //         clearTimeout(timer);
                        //     }
                        // })
                    })
                    .on('close', (url, force)=>{
                        // if(force)
                        //     console.log(`FORCE: ${force} - forcibly removing url from queue because it took more than ${timelimit/1000} seconds to load: ${url}`)
                        requests.list.splice(requests.list.indexOf(url), 1);
                        if(requests.list.length<3)
                            process.stdout.write(`requests remaining: ${requests.list.join(' , ')} \r`)
                        checkqueue();
                    })
            });

            options.resourceQueue = resourceQueue;

            /* the page actions */
            page.onError = function (msg, trace) {
                console.error(msg);
                trace && trace.forEach(function(item) {
                    console.log('  ', item.file, ':', item.line);
                });
            };

            page.set('onResourceRequested', function (req) {
                requests.emit('open', req.url)
                // console.log("Resource requested..", arguments)
            });

            page.set('onResourceReceived', function (res) {
                if (res.stage == 'end') {
                    requests.emit('close', res.url)
                    // console.log("Resource received!")
                }
                // console.log('onResourseReceived', arguments);
            });

            page.set('onConsoleMessage', function (msg) { 
                // extension to make sure circular references
                // don't throw error
                // `phantom stdout: TypeError: JSON.stringify cannot serialize cyclic structures`
                (function() {
                  var originalStringify = JSON.stringify;
                  JSON.stringify = function(obj) {
                    var seen = [];
                    var result = originalStringify(obj, function(key, val) {
                      // if (val instanceof HTMLElement) { return val.outerHTML }
                      if (typeof val == "object") {
                        if (seen.indexOf(val) >= 0) { return "[Circular]"; }
                        seen.push(val);
                      }
                      return val;
                    });
                    return result;
                  };
                })();
                console.log('webpage console message:', msg, arguments);
            });

            // page.onConsoleMessage = function(msg, lineNum, sourceId) {
            //   console.log('CONSOLE: ' + msg + ' (from line #' + lineNum + ' in "' + sourceId + '")');
            // };
            // 

            openPageAtUrl(page, ph, url, options, callback)
        });
      }, {
        // for Windows -->
        dnodeOpts: {
          weak: false
        }
      });
    }catch(err){
        console.log('phantom error with', url, 'error:', err);
        if(callback && callback instanceof Function)
            callback({ error: ['phantom error with', url, 'error'].join(' ') })
    }
}

// if(process && process.argv && process.argv.length > 1)
//  makeMap(url)

module.exports.makeMap = makeMap;

/*
run from cmd with 
phantomjs --web-security=true phantom-map.js http://54.241.159.188/dwr-lep/index.html c:\temp\shot.jpg
*/