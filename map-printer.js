'use strict';
// let phantom = require('phantomjs')
let phantom = require('phantom')
, EventEmitter = require('events')
, util = require('util')
// let phantom = require('node-phantom')
, tmp = require('tmp')
, url
, outfile
, phantomPH
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

function setPageSize(page, options){
    options = options || {};
// function setPageSize(page, pageSize, pageOrientation, ph){
    // let pageSize = "A4"
    // let pageOrientation = "landscape",
    let temp
    , format = options.format
    , orientation = options.orientation
    // , dpi = 300
    , dpi = 150 //from experimenting with different combinations of viewportSize and paperSize the pixels per inch comes out to be 150
    , cmToInchFactor = 0.393701 
    , widthInInches
    , heightInInches
    , accessnote = 'Accessed at:' + new Date().toLocaleDateString() + ' - ' + new Date().toLocaleTimeString()
    , margin = '1cm'
    , viewportWidth
    , viewportHeight
    , viewportSize
    ;

    switch(true){
        case /Letter/i.test(format):
            widthInInches = 8.5;
            heightInInches = 11;
            // // remember that these are swapped for Landscape orientation
            // viewportWidth = 1450;
            viewportWidth = 1250;
            viewportHeight = 1800;
            break;
        case /Legal/i.test(format):
            widthInInches = 8.5;
            heightInInches = 14;
            break;
        case /A3/i.test(format):
            widthInInches = 11.69
            heightInInches = 16.54;
            break;
        case /A4/i.test(format):
            widthInInches = 8.27;
            heightInInches = 11.69;
            break;
        case /A5/i.test(format):
            widthInInches = 5.83;
            heightInInches = 8.27;
            break;
        case /Tabloid/i.test(format):
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

    // if(options.addMargin){
        //reduce by the margin (assuming 1cm margin on each side)
        widthInInches-= 2*cmToInchFactor;
        heightInInches-= 2*cmToInchFactor;
    // }

    //interchange if width is equal to height
    console.log('options.orientation', options.orientation)
    if(/landscape/i.test(orientation)){
        temp = widthInInches;
        widthInInches = heightInInches;
        heightInInches = temp;

        temp = viewportWidth;
        viewportWidth = viewportHeight
        viewportHeight = temp
    }

    // calculate corresponding viewport dimension in pixels
    console.log('options.filetype', options.filetype)
    if(options.filetype !== '.pdf'){
        viewportWidth = dpi*widthInInches;
        viewportHeight = dpi*heightInInches;
    }

    // possible paper sizes for GS from - http://www.a4papersize.org/a4-paper-size-in-pixels.php
    page.set('paperSize', { 
        format: format
        , orientation: orientation
        , margin: margin
        , border: margin
        , header: {
            height: '0.0cm'
        }
        , footer: {
            height: '0.0cm'
        }
    }); 

    console.log('viewportWidth', viewportWidth, 'viewportHeight', viewportHeight);

    page.set('viewportSize', { width:  viewportWidth, height: viewportHeight }, function(){
        // callback
    } ); 

    page.clipRect = {top: 0, left: 0, width: viewportWidth, height: viewportHeight};  
    page.set('clipRect', {top: 0, left: 0, width: viewportWidth, height: viewportHeight});  
    
    // resolution things -- don't seem to be important or have effect
    // page.set('zoomFactor',  100.0/96.0); //windows
    // page.set('zoomFactor',  0.821980);
    page.set('zoomFactor',  100.0/72.0); // osx

    return { 
        width: viewportWidth
        , height: viewportHeight
    }
}


// let filetype = '.pdf';
// let filetype = '.png';
// let filetype = '.jpg';
function openPageAtUrl(page, url, options, callback){
    console.log('opening page at:', url);
    
    let orientation = options.orientation || 'Landscape'
    , filetype = options.filetype = `.${options.filetype || 'jpg'}`
    , format = options.format = `${options.format || 'Letter'}`
    ;
    // let orientation = 'Portrait';
    options.pageSize = setPageSize(page, options);

    options.bodyheight = options.height;
    options.bodywidth = options.width;

    // console.log('page options')
    // console.dir(options)
    
    // node-phantom callback returns err and status args
    // phantom callback returns only status arg
    page.open( url, function(status){
         if (status !== 'success') {
            console.log('Unable to access network', status);
            // setTimeout(function(){ph.exit()}, 0)
            // // ph.exit(1);  // thow error if you want to
            if(callback && callback instanceof Function)
                return callback({error: ['phantom unable to open webpage at', url].join(' '), status: status})
        } else 
            onPageOpen(page, options, url, callback)
    });
}

function onPageOpen(page, options, url, callback){
// function onPageOpen(page, ph, pageinfo, url, callback){
    page.evaluate( 
        function(options){ 
            'use strict';
            /* run javascript on webpage */
            window.phantom = true;
            options = options || {};

            console.log('running javascript on page via phantom', 'window.phantom?', window.phantom);

            // add phantom class to styles in phantom-mods.css are applied
            $('html')
                .addClass('phantom')
                // .addClass(options.orientation || '')
            ;
            
            var size = options.pageSize || {}
            , filetype = options.filetype || ''
            ;
            
            // add the pageinfo
            // $('footer').append(
            //     "<table width='100%'>" + 
            //       "<tr><td class='pull-left'><small> " + (pageOptions.accessnote || '') + "</small></td>" +
            //       "<td>&nbsp;</td> <td>&nbsp;</td>" +
            //       "<td colspan='2' style='text-align: right;'><small>" + pageOptions.pageNum + " / " + pageOptions.numPages + "</small></td></tr>" +
            //       "</table>"
            // );

            // adjustments for pdf output
            // if(filetype==='.pdf'){
            var width = options.bodywidth || size.width || 800
            , height = options.bodyheight || size.height || 900
            ;
            
            console.log('size:', JSON.stringify(size));
            console.log('height:', height);
            console.log('width:', width);

            [window, 'html, body'].forEach(function(name){
                var whb = $(name).css({
                    overflow: 'hidden'
                    , width: width
                    , 'max-width' : width
                    , 'height': height
                    , 'max-height': height
                })

                console.log('whb:', name, JSON.stringify({size: {height: whb.height(), width: whb.width()}}) )
            });
            // }
             
            // remove all href's because they aren't necessary and they render sometimes in the PDF output
            $('a').attr('href', null);

            $('.markerLabel').removeClass('trans')
            //     .css('font-size', '+=15px');

            // hide legend items for layer's that aren't visible
            // $('.legendGroup .layer-toggle:not(:checked)').parent().hide()
            // $('.layer-toggle:not(:checked)').closest('.legendGroup').hide()
            // $('.legendGroup[class*=" disabled-"]').hide()
             
            var printmessage = 'PAGE READY FOR PRINTING';
            // send it after 30 seconds
            var timer = setTimeout(function(){
                $(app).trigger('print');
                console.log(printmessage)
            }, 30 * 1000);

            // or when the map is finished loading layerconfigs
            app.map.on('layerconfigs:loaded', function(){
                // hide/remove non-active layers from the print output
                $(app).trigger('print');
                clearTimeout(timer);
                console.log(printmessage)
            });

            console.log('DONE RUNNING JAVASCRIPT ON PHANTOMJS PAGE');
            return {
                title: document.title
            }
        }
        // callback after page.evaluate finished
        , function onEvaluated(args){
            // console.log('onEvaluated args:', arguments);
            args = args || { title: 'test-title'};
            
            let title = args.title
            , name = createFileName(title,url)
            ;
            
            console.log('Creating', name);
            options.resourceQueue.then(
                function(){
                    createPDF(page, {filetype: options.filetype, outfile:name }, callback);
                }    
            )
        } 
        // pass arguments into page evaluate
        , options
    )
}

function createPDF(page, options, callback){
    // hacky stupid way to wait for it to load
    setTimeout(function(){
        console.log('creating temp file with prefix:', options.outfile, 'postfix:', options.filetype);
        tmp.file({ prefix: options.outfile, postfix: options.filetype, keep: true }, function _tempFileCreated(err, filepath, fd, cleanupCallback) {
          if (err) return console.error(err)//throw err;
          
          page.render(filepath, {quality: options.quality || '100'} );
          setTimeout(function(){
              console.log('rendered:', options.outfile)
              if(callback && callback instanceof Function){
                  // If we don't need the file anymore we could manually call the cleanupCallback. -- NEED TO DO SO WHEN {keep: true} is passed in options 
                  // -- Otherwise that is not necessary if we didn't pass the keep option because the library will clean after itself. 
                  return callback({ success: true, filepath: filepath, callback: cleanupCallback, sendname: options.outfile + options.filetype, initOptions: options })
              }else
                  cleanupCallback();
              
              // close the page after 3 seconds
              setTimeout(t=>page.close(), 3000);

              // ph.exit();
          }, 500)
        });
    }, 1500)
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

function loadPhantom(cb){
    phantom.create( ph =>{
        phantomPH = ph;
        if(cb instanceof Function)
            cb()
    }
    , {
        // for Windows -->
        dnodeOpts: {
          weak: false
        }
    })
    // ;);
    return phantom
}

function makeMap(url, options, callback){
    console.log('url passed to map-printer.makeMap:', url);
    // try{
      
    if(!phantomPH)
        return loadPhantom( ()=>makeMap.apply(null, arguments) )
      // phantom.create(function (ph) {

    phantomPH.createPage(function (page) {
        let requests = new Queue()
        , timelimit = 5000
        , resourceQueue = new Promise((resolve, reject)=>{
            let timer;

            function checkqueue(){
                process.stdout.write(`${requests.list.length} requests remaining in phantomjs page. \r`)
                timer && clearTimeout(timer);
                timer = setTimeout(()=>{
                    if(!requests.resolved){
                        if(requests.printmessageReceived){
                        // if(requests.list.length==0 && requests.printmessageReceived){
                            console.log('requests done and printmessage received');
                            requests.removeAllListeners('close')
                            requests.resolve = resolve( true );
                        }
                    }
                }, 1000);
            };

            requests
                .on('open', url=>{
                    requests.list.push(url);
                })
                .on('close', (url, force)=>{
                    requests.list.splice(requests.list.indexOf(url), 1);
                    if(requests.list.length<3)
                        process.stdout.write(`requests remaining: ${requests.list.join(' , ')} \r`)
                    checkqueue();
                })
        });

        options.resourceQueue = resourceQueue;

        /* the page actions */
        page.onError = function (msg, trace) {
            console.error('\n', 'page.onError:', msg, '\n');
            trace && trace.forEach(function(item) {
                console.log('  ', item.file, ':', item.line);
            });
        };

        page.set('onResourceRequested', function (req) {
            requests.emit('open', req.url)
        });

        page.set('onResourceReceived', function (res) {
            if (res.stage == 'end') {
                requests.emit('close', res.url)
            }
        });

        page.set('onConsoleMessage', function (msg) {
            if(msg == 'PAGE READY FOR PRINTING'){
                requests.printmessageReceived = true;
                requests.emit('close', msg);
            }

            console.log('webpage console message:', msg, arguments);
        });

        openPageAtUrl(page, url, options, callback)
    });
}


module.exports.makeMap = makeMap;