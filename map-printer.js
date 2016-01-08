'use strict';
// let phantom = require('phantomjs')
let phantom = require('phantom')
, EventEmitter = require('events')
, util = require('util')
// let phantom = require('node-phantom')
, tmp = require('tmp')
, moment = require('moment-timezone')
, ZONE = "America/Los_Angeles"
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

function setPageSize(options){
    options = options || {};
// function setPageSize(page, pageSize, pageOrientation, ph){
    // let pageSize = "A4"
    // let pageOrientation = "landscape",
    let temp
    , page = options.page
    , format = options.format
    , orientation = options.orientation
    , dpi = 300
    // , dpi = 150 //from experimenting with different combinations of viewportSize and paperSize the pixels per inch comes out to be 150
    , cmToInchFactor = 0.393701 
    , widthInInches
    , heightInInches
    // , accessnote = 'Accessed at:' + new Date().toLocaleDateString() + ' - ' + new Date().toLocaleTimeString()
    , margin = '0cm'
    // , margin = '1cm'
    , viewportWidth = options.width
    , viewportHeight = options.height
    ;

    switch(true){
        case /Letter/i.test(format):
            widthInInches = 8.5;
            heightInInches = 11;
            // // remember that these are swapped for Landscape orientation
            // viewportWidth = 1450;
            // viewportWidth = 1250;
            // viewportHeight = 1800;
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
            // viewportWidth = 1850;
            // viewportHeight = 3000;
            break;
    }

        // }

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

    page.set('viewportSize', { width:  viewportWidth, height: viewportHeight }); 

    page.clipRect = {top: 0, left: 0, width: options.width, height: options.height};  
    page.set('clipRect', {top: 0, left: 0, width: options.width, height: options.height});  

    // page.clipRect = {top: 0, left: 0, width: viewportWidth, height: viewportHeight};  
    // page.set('clipRect', {top: 0, left: 0, width: viewportWidth, height: viewportHeight});  
    
    // resolution
    // page.set('zoomFactor',  100.0/96.0); //windows
    // page.set('zoomFactor',  0.821980);
    // page.set('zoomFactor',  100.0/72.0); // osx
    // page.set('zoomFactor',  100.0/50.0); 

    page.set('zoomFactor',  96/100); 

    return { 
        width: viewportWidth
        , height: viewportHeight
    }
}

function openPage(options){    
    let orientation = options.orientation || 'Landscape'
    , filetype = options.filetype = `.${options.filetype || 'jpg'}`
    , format = options.format = `${options.format || 'Letter'}`
    ;
    // let orientation = 'Portrait';
    options.pageSize = setPageSize(options);

    options.bodyheight = options.height;
    options.bodywidth = options.width;
    var host = `http://localhost:${(process.env.PORT || 1337)}`;
    var printurl = `${host}/print/iframe`;
    options.url = options.url.replace(/http(s)?:\/\/([^\/]*)+/i, host);
    console.log('phantom opening page at:', printurl);

    let date = moment(new Date()).tz(ZONE);
    options.accessNote = 'Accessed on: ' + date.format('MM/DD/YYYY') + ' at ' + date.format('h:m A');

    options.page.open( printurl, function(status){
         if (status !== 'success') {
            console.log('Unable to access network', status);
            setTimeout(function(){
                options.page.close();
                delete options.page
                // ph.exit()
            }, 500)
            // // ph.exit(1);  // thow error if you want to
            if(options.callback && options.callback instanceof Function)
                return options.callback({error: 'phantom unable to open webpage at ' + options.url, status: status})
        } else 
            onPageOpen(options)
    });
}

function onPageOpen(options){
    options.page.evaluate( 
        evaluatePage
        // callback after page.evaluate finished
        , onPageEvaluated.bind(options)
        // pass arguments into page evaluate
        , options
    )
}

/// this function cannot access anything outside of itself
/// or the options object passed in
/// it is run in the "browser" context, not the node context
function evaluatePage(options){ 
    // 'use strict';
    /* run javascript on webpage */
    options = options || {};

    var size = options.pageSize || {}
    , filetype = options.filetype || ''
    , width = options.bodywidth || size.width || 800
    , height = options.bodyheight || size.height || 900
    ;

    document.body.style.overflow = 'hidden';

    // // retina - doesn't work like this
    // document.body.style.webkitTransform = "scale(2)";
    // document.body.style.webkitTransformOrigin = "0% 0%";
    // /* fix the body width that overflows out of the viewport */
    // document.body.style.width = "50%"

    var rect = document.body.getClientRects()[0];

    var iframe = document.getElementsByTagName('iframe')[0];
    iframe.onload = runPhantom;
    // height needs to be a little less, so we don't get 2 page pdf
    iframe.height = height ;
    iframe.width = width;
    iframe.src = options.url;

    function runPhantom(){
        console.log('iframe loaded, now running phantom mods:', arguments)
        var cw = iframe.contentWindow
        , $ = cw.$
        , app = cw.app
        // , usecanvas = /canvas/i.test(options.url)
        ;

        cw.window.phantom = true;
        console.log('running javascript on iframe page via phantom', 'window.phantom?', cw.window.phantom);
        
        // add phantom class to styles in phantom-mods.css are applied
        $('html, body')
            .addClass('phantom')
            // .addClass(usecanvas ? 'map-use-canvas' : '')
            // .addClass(options.orientation || '')
        ;

        console.log('setting iframe.src to:', options.url);
         
        // remove all href's because they aren't necessary and they render sometimes in the PDF output
        $('a').attr('href', null);
         
        var printmessage = 'PAGE READY FOR PRINTING'
        , timer
        ;

        function triggerPrint(msg){
            clearTimeout(timer);
            $(cw.window).trigger('print:start');
            console.log('+++++', msg, '+++++')
            console.log(printmessage);
        }
        
        var triggersetup;
        function setupPrintTrigger(msg){
            if(triggersetup) return
            triggersetup = true;

            console.log('setupPrintTrigger with message:', msg);
            // send it after 30 seconds if not sent on layerconfigs:loaded
            timer = setTimeout(triggerPrint.bind(null, 'triggering print from timeout'), 30 * 1000);

            // or when the map is finished loading layerconfigs
            if(cw.window.layerconfigs_loading){
                var configs = JSON.stringify(cw.window.layerconfigs_loading);
                console.log('need to wait for layerconfigs', configs );
                $(cw.window).on('layerconfigs:loaded', function(){
                    console.log('triggering print from layerconfigs:loaded');
                    triggerPrint('waited for ' + configs);
                })
            }else
            triggerPrint("didn't wait for any layerconfigs");
        }

        function triggerWhenReady(msg){
            if(msg)
                console.log('triggerWhenReady', msg)
            // console.log('app', app);
            // console.log('app.map', app.map);
            // console.log('app.map.boundsFitter', app.map.boundsFitter);
            // console.log('app.map.hash', app.map.hash);
            
            if(app.map.boundsFitter){
                if(!app.map.hash){
                    var timer;
                    function tryagain(evt){
                        clearTimeout(timer);
                        app.map.off('hash:set', tryagain);
                        triggerWhenReady(evt && evt.message || 'from hash:set timeout')
                    }
                    timer =  setTimeout(tryagain, 5000);
                    return app.map.once('hash:set', tryagain, {message: 'from hash:set'});
                }
                console.log('app.map.hash.initialSetup', app.map.hash.initialSetup);

                if(!app.map.hash.initialSetup){
                    // wait 5 seconds and setupPrintTrigger if not already done
                    var timeout;
                    function trigger(msg){
                        clearTimeout(timeout);
                        app.map.off('bounds:fit', trigger);
                        setupPrintTrigger( typeof msg == 'string' ?  msg : 'from bounds:fit event trigger' )
                    }
                    timeout = setTimeout(function(){
                        app.onhashset && app.onhashset();
                        triggerWhenReady('try again after forcing onhashset');
                        // trigger('from bounds:fit timeout')
                    }, 5000);
                    app.map.once('bounds:fit', trigger);
                }else
                    setupPrintTrigger('app.map.hash.initialSetup is truthy')
            }else{
                setupPrintTrigger('map._config_elements_not_loaded')
            }
        }

        function scaleIframe(){
            var rect = document.body.getClientRects()[0]
            , heightscale = rect.height / height
            , widthscale = rect.width / width
            , scale = heightscale < 1 
                ? heightscale < widthscale
                 ? heightscale : widthscale
                    : widthscale < 1
                     ? widthscale
                      : undefined;

            console.log('scale difference is:', scale);
            console.log('heightscale is:', heightscale);
            console.log('widthscale is:', widthscale);
            console.log('body rect.height is:', rect.height)
            console.log('body rect.width is:', rect.width)

            if(scale){
                // var translateX = -rect.width * scale / 2 + 'px'
                // , translateY = -rect.height * scale / 2 + 'px'
                // ;

                var property = 'scale(' + scale + ')'
                // , property = 'scale(' + scale + ') translate(' + translateX + ',' + translateY + ')'
                ;
                // iframe.style.zoom = scale;
                // iframe.style.marginTop = translateY;
                // iframe.style.marginLeft = translateX;

                iframe.style.transform = property;
                iframe.style.transformOrigin = '0 0';
                iframe.style.webkitTransform = property;
                iframe.style.webkitTransformOrigin = '0 0';
                console.log('iframe.style.[transform & webkitTransform] set to:', property);
                console.log('iframe.style.transform is:', iframe.style.transform);
                console.log('iframe.style.webkitTransform is:', iframe.style.webkitTransform);
            }
        }

        triggerWhenReady();
        scaleIframe();

        // var accessNote = cw.document.title + ' - accessed on: ' + new Date().toLocaleDateString() + ' at ' + new Date().toLocaleTimeString();
        // var accessNote = 'Accessed on: ' + new Date().toLocaleDateString() + ' at ' + new Date().toLocaleTimeString();
        if(options.accessNote)
            $('#title').append('<p class="access-note">'+options.accessNote+'</p>');
        
        // var footerlabel = document.getElementById('footerlabel');
        // if(footerlabel){
        //     var label = cw.document.title + ' - accessed on: ' + new Date().toLocaleDateString() + ' at ' + new Date().toLocaleTimeString();
        //     console.log('setting footerlabel innerHTML to:', label);
        //     footerlabel.innerHTML = label;
        // }
        
        console.log('DONE RUNNING JAVASCRIPT ON PHANTOMJS PAGE');
    }

    return {
        title: 'Perris Dam'
        // title: iframe.contentWindow.document.title || 'Perris Dam'
    }
}

function onPageEvaluated(args){
    // console.log('onEvaluated args:', arguments);
    args = args || { title: 'test-title'};
    
    let title = args.title
    , name = createFileName(title, this.url);
    ;
    
    this.resourceQueue.then(()=>{
        console.log('Creating', name);
        createRenders(this.page, {filetype: this.filetype, outfile:name }, this.callback);
    })
} 

function createRenders(page, options, callback){
    let promises = ['.pdf', '.jpg', '.png'].map(type=>{
        return new Promise((resolve, reject)=>{
            console.log('creating temp file with prefix:', options.outfile, 'postfix:', options.type);
            
            tmp.file({ prefix: options.outfile, postfix: type, keep: true }, function(err, filepath, fd, cleanupCallback) {
                if (err) return console.error('error creating temp file:', err)//throw err;

                page.render(filepath, {quality: options.quality || '100'} );

                console.log('rendered:', options.outfile)
                if(callback instanceof Function){
                  // If we don't need the file anymore we could manually call the cleanupCallback. -- NEED TO DO SO WHEN {keep: true} is passed in options 
                  // -- Otherwise that is not necessary if we didn't pass the keep option because the library will clean after itself. 
                  let resolveObject = { success: true, filepath: filepath, type: type, callback: cleanupCallback, sendname: options.outfile + type, initOptions: options };
                  return resolve(resolveObject)
                  // return callback(resolveObject)
                }

                cleanupCallback();
                resolve(undefined)
            });
        })
    })

    Promise.all(promises).then(results=>{
        // console.log('results:');
        // console.dir(results);
        if(callback instanceof Function)
            callback(results);
        
        setTimeout(t=>page.close(), 3000);
        // close the page after 3 seconds
    })
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
    options.url = url;
    options.callback = callback;
      
    if(!phantomPH)
        return loadPhantom( ()=>makeMap.apply(null, arguments) )
      // phantom.create(function (ph) {

    phantomPH.createPage(function (page) {
        options.page = page;

        let requests = new Queue()
        , timelimit = 5000
        , resourceQueue = new Promise((resolve, reject)=>{
            let timer;

            function checkqueue(){
                process.stdout.write(`${requests.list.length} requests remaining in phantomjs page. \r`)
                timer && clearTimeout(timer);
                timer = setTimeout(()=>{
                    if(!requests.resolved){
                        // if(requests.printmessageReceived){
                        if(requests.list.length==0 && requests.printmessageReceived){
                            // console.log('\nrequests remaining', requests.list.join('\n\t * '), '\n')
                            console.log('printmessage received');
                            // console.log('requests done and printmessage received');
                            requests.removeAllListeners('close')
                            requests.resolved = resolve( true );
                        }
                    }
                }, 1000);
            };

            requests
                .on('open', url=>{
                    if(/map\.js|layer-configs/i.test(url))
                        console.log(url, '\n');
                    requests.list.push(url);
                })
                .on('close', (url, force)=>{
                    if(requests.list.indexOf(url)!==-1)
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

        page.set('onResourceError', function (resourceError) {
            console.log('resourceError for:', JSON.stringify(resourceError) )
            requests.emit('close', resourceError.url);
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
                if(requests.list.length>0)
                    console.log('\n** requests remaining at time when page ready from printing:', requests.list.join('\t * '), '\n')
            }

            console.log('webpage console message:', msg);
        });

        openPage(options)
    });
}


module.exports.makeMap = makeMap;
