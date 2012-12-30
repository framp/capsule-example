(function(){var require = function (file, cwd) {
    var resolved = require.resolve(file, cwd || '/');
    var mod = require.modules[resolved];
    if (!mod) throw new Error(
        'Failed to resolve module ' + file + ', tried ' + resolved
    );
    var cached = require.cache[resolved];
    var res = cached? cached.exports : mod();
    return res;
};

require.paths = [];
require.modules = {};
require.cache = {};
require.extensions = [".js",".coffee",".json"];

require._core = {
    'assert': true,
    'events': true,
    'fs': true,
    'path': true,
    'vm': true
};

require.resolve = (function () {
    return function (x, cwd) {
        if (!cwd) cwd = '/';
        
        if (require._core[x]) return x;
        var path = require.modules.path();
        cwd = path.resolve('/', cwd);
        var y = cwd || '/';
        
        if (x.match(/^(?:\.\.?\/|\/)/)) {
            var m = loadAsFileSync(path.resolve(y, x))
                || loadAsDirectorySync(path.resolve(y, x));
            if (m) return m;
        }
        
        var n = loadNodeModulesSync(x, y);
        if (n) return n;
        
        throw new Error("Cannot find module '" + x + "'");
        
        function loadAsFileSync (x) {
            x = path.normalize(x);
            if (require.modules[x]) {
                return x;
            }
            
            for (var i = 0; i < require.extensions.length; i++) {
                var ext = require.extensions[i];
                if (require.modules[x + ext]) return x + ext;
            }
        }
        
        function loadAsDirectorySync (x) {
            x = x.replace(/\/+$/, '');
            var pkgfile = path.normalize(x + '/package.json');
            if (require.modules[pkgfile]) {
                var pkg = require.modules[pkgfile]();
                var b = pkg.browserify;
                if (typeof b === 'object' && b.main) {
                    var m = loadAsFileSync(path.resolve(x, b.main));
                    if (m) return m;
                }
                else if (typeof b === 'string') {
                    var m = loadAsFileSync(path.resolve(x, b));
                    if (m) return m;
                }
                else if (pkg.main) {
                    var m = loadAsFileSync(path.resolve(x, pkg.main));
                    if (m) return m;
                }
            }
            
            return loadAsFileSync(x + '/index');
        }
        
        function loadNodeModulesSync (x, start) {
            var dirs = nodeModulesPathsSync(start);
            for (var i = 0; i < dirs.length; i++) {
                var dir = dirs[i];
                var m = loadAsFileSync(dir + '/' + x);
                if (m) return m;
                var n = loadAsDirectorySync(dir + '/' + x);
                if (n) return n;
            }
            
            var m = loadAsFileSync(x);
            if (m) return m;
        }
        
        function nodeModulesPathsSync (start) {
            var parts;
            if (start === '/') parts = [ '' ];
            else parts = path.normalize(start).split('/');
            
            var dirs = [];
            for (var i = parts.length - 1; i >= 0; i--) {
                if (parts[i] === 'node_modules') continue;
                var dir = parts.slice(0, i + 1).join('/') + '/node_modules';
                dirs.push(dir);
            }
            
            return dirs;
        }
    };
})();

require.alias = function (from, to) {
    var path = require.modules.path();
    var res = null;
    try {
        res = require.resolve(from + '/package.json', '/');
    }
    catch (err) {
        res = require.resolve(from, '/');
    }
    var basedir = path.dirname(res);
    
    var keys = (Object.keys || function (obj) {
        var res = [];
        for (var key in obj) res.push(key);
        return res;
    })(require.modules);
    
    for (var i = 0; i < keys.length; i++) {
        var key = keys[i];
        if (key.slice(0, basedir.length + 1) === basedir + '/') {
            var f = key.slice(basedir.length);
            require.modules[to + f] = require.modules[basedir + f];
        }
        else if (key === basedir) {
            require.modules[to] = require.modules[basedir];
        }
    }
};

(function () {
    var process = {};
    var global = typeof window !== 'undefined' ? window : {};
    var definedProcess = false;
    
    require.define = function (filename, fn) {
        if (!definedProcess && require.modules.__browserify_process) {
            process = require.modules.__browserify_process();
            definedProcess = true;
        }
        
        var dirname = require._core[filename]
            ? ''
            : require.modules.path().dirname(filename)
        ;
        
        var require_ = function (file) {
            var requiredModule = require(file, dirname);
            var cached = require.cache[require.resolve(file, dirname)];

            if (cached && cached.parent === null) {
                cached.parent = module_;
            }

            return requiredModule;
        };
        require_.resolve = function (name) {
            return require.resolve(name, dirname);
        };
        require_.modules = require.modules;
        require_.define = require.define;
        require_.cache = require.cache;
        var module_ = {
            id : filename,
            filename: filename,
            exports : {},
            loaded : false,
            parent: null
        };
        
        require.modules[filename] = function () {
            require.cache[filename] = module_;
            fn.call(
                module_.exports,
                require_,
                module_,
                module_.exports,
                dirname,
                filename,
                process,
                global
            );
            module_.loaded = true;
            return module_.exports;
        };
    };
})();


require.define("path",function(require,module,exports,__dirname,__filename,process,global){function filter (xs, fn) {
    var res = [];
    for (var i = 0; i < xs.length; i++) {
        if (fn(xs[i], i, xs)) res.push(xs[i]);
    }
    return res;
}

// resolves . and .. elements in a path array with directory names there
// must be no slashes, empty elements, or device names (c:\) in the array
// (so also no leading and trailing slashes - it does not distinguish
// relative and absolute paths)
function normalizeArray(parts, allowAboveRoot) {
  // if the path tries to go above the root, `up` ends up > 0
  var up = 0;
  for (var i = parts.length; i >= 0; i--) {
    var last = parts[i];
    if (last == '.') {
      parts.splice(i, 1);
    } else if (last === '..') {
      parts.splice(i, 1);
      up++;
    } else if (up) {
      parts.splice(i, 1);
      up--;
    }
  }

  // if the path is allowed to go above the root, restore leading ..s
  if (allowAboveRoot) {
    for (; up--; up) {
      parts.unshift('..');
    }
  }

  return parts;
}

// Regex to split a filename into [*, dir, basename, ext]
// posix version
var splitPathRe = /^(.+\/(?!$)|\/)?((?:.+?)?(\.[^.]*)?)$/;

// path.resolve([from ...], to)
// posix version
exports.resolve = function() {
var resolvedPath = '',
    resolvedAbsolute = false;

for (var i = arguments.length; i >= -1 && !resolvedAbsolute; i--) {
  var path = (i >= 0)
      ? arguments[i]
      : process.cwd();

  // Skip empty and invalid entries
  if (typeof path !== 'string' || !path) {
    continue;
  }

  resolvedPath = path + '/' + resolvedPath;
  resolvedAbsolute = path.charAt(0) === '/';
}

// At this point the path should be resolved to a full absolute path, but
// handle relative paths to be safe (might happen when process.cwd() fails)

// Normalize the path
resolvedPath = normalizeArray(filter(resolvedPath.split('/'), function(p) {
    return !!p;
  }), !resolvedAbsolute).join('/');

  return ((resolvedAbsolute ? '/' : '') + resolvedPath) || '.';
};

// path.normalize(path)
// posix version
exports.normalize = function(path) {
var isAbsolute = path.charAt(0) === '/',
    trailingSlash = path.slice(-1) === '/';

// Normalize the path
path = normalizeArray(filter(path.split('/'), function(p) {
    return !!p;
  }), !isAbsolute).join('/');

  if (!path && !isAbsolute) {
    path = '.';
  }
  if (path && trailingSlash) {
    path += '/';
  }
  
  return (isAbsolute ? '/' : '') + path;
};


// posix version
exports.join = function() {
  var paths = Array.prototype.slice.call(arguments, 0);
  return exports.normalize(filter(paths, function(p, index) {
    return p && typeof p === 'string';
  }).join('/'));
};


exports.dirname = function(path) {
  var dir = splitPathRe.exec(path)[1] || '';
  var isWindows = false;
  if (!dir) {
    // No dirname
    return '.';
  } else if (dir.length === 1 ||
      (isWindows && dir.length <= 3 && dir.charAt(1) === ':')) {
    // It is just a slash or a drive letter with a slash
    return dir;
  } else {
    // It is a full dirname, strip trailing slash
    return dir.substring(0, dir.length - 1);
  }
};


exports.basename = function(path, ext) {
  var f = splitPathRe.exec(path)[2] || '';
  // TODO: make this comparison case-insensitive on windows?
  if (ext && f.substr(-1 * ext.length) === ext) {
    f = f.substr(0, f.length - ext.length);
  }
  return f;
};


exports.extname = function(path) {
  return splitPathRe.exec(path)[3] || '';
};

});

require.define("__browserify_process",function(require,module,exports,__dirname,__filename,process,global){var process = module.exports = {};

process.nextTick = (function () {
    var canSetImmediate = typeof window !== 'undefined'
        && window.setImmediate;
    var canPost = typeof window !== 'undefined'
        && window.postMessage && window.addEventListener
    ;

    if (canSetImmediate) {
        return function (f) { return window.setImmediate(f) };
    }

    if (canPost) {
        var queue = [];
        window.addEventListener('message', function (ev) {
            if (ev.source === window && ev.data === 'browserify-tick') {
                ev.stopPropagation();
                if (queue.length > 0) {
                    var fn = queue.shift();
                    fn();
                }
            }
        }, true);

        return function nextTick(fn) {
            queue.push(fn);
            window.postMessage('browserify-tick', '*');
        };
    }

    return function nextTick(fn) {
        setTimeout(fn, 0);
    };
})();

process.title = 'browser';
process.browser = true;
process.env = {};
process.argv = [];

process.binding = function (name) {
    if (name === 'evals') return (require)('vm')
    else throw new Error('No such module. (Possibly not yet loaded)')
};

(function () {
    var cwd = '/';
    var path;
    process.cwd = function () { return cwd };
    process.chdir = function (dir) {
        if (!path) path = require('path');
        cwd = path.resolve(dir, cwd);
    };
})();

});

require.define("/node_modules/capsule/package.json",function(require,module,exports,__dirname,__filename,process,global){module.exports = {}
});

require.define("/node_modules/capsule/index.js",function(require,module,exports,__dirname,__filename,process,global){module.exports = require('./lib/Capsule.js'); 

});

require.define("/node_modules/capsule/lib/Capsule.js",function(require,module,exports,__dirname,__filename,process,global){module.exports = (function() {
  /* Capsule
  * A framework to help you create a multiplayer game using socket.io
  * 
  * It features:
  * - A powerful hooks system to customize your game
  * - Shared code between server and client
  * - Entity interpolation
  * - Client prediction
  * - Server Validation 
  * - A bunch of other neat things
  * 
  * Sources of inspiration:
  * https://developer.valvesoftware.com/wiki/Source_Multiplayer_Networking
  * http://gafferongames.com/networking-for-game-programmers/what-every-programmer-needs-to-know-about-game-networking/
  * 
  */
  
  var World = require('./World.js');
  
  var _ = function(io, options) {
    if (typeof process !== 'undefined') {
      this.server = process.title === 'node';
    }else{ 
      this.server = typeof module !== 'undefined';
    }
    this.io = io; //socket.io
    
    //Time between receiving data and using it
    this.artificialLag = options.artificialLag || 0; 
    //Time between sending updates
    this.updateInterval = options.updateInterval || 30; 
    //Time between saving user inserted data
    this.inputInterval = options.inputInterval || 30; 
    //Time before an update got merged inside the world
    this.worldLifetime = options.worldLifetime || 2000;
    //Users will get now-userDelay data when interpolating values
    this.userDelay = options.userDelay || 200; 
    //Print debug information 
    this.debug = options.debug || 0; 
    //Hooks are function which got executed in some key points
    
    this.hooks = options.hooks || {
      //Every inputInterval keys is snapshotted and saved, 
      //Every updateInterval those snapshots are executed locally and sent
      //to the server for validation
      keysSetup: function(keys) {}, //Let you edit the keys object
      //A snapshot from now-userDelay is created at each animation frame
      viewRender: function(snapshot) {}, //Let you render a snapshot
      inputsProcess: function() {}, //Let you process inputs
      userConnect: function(socket) {}, //Let you add an user 
      userDisconnect: function(socket) {} //Let you remove an user
    };

    if (this.server) {
      this.serverSetup();
    }else{
      this.clientSetup();
    }
  };

  /* clientSetup
  * Initialize reading input and storing them
  * Initialize sending input interval
  * Initialize rendering
  */
  _.prototype.clientSetup = function () {
    var that = this;
    this.world = new World({}, + new Date, this.worldLifetime);
    this.lastUpdateLag = 0;
    
    //Retrieving basic information about the client from the server
    this.io.on('user', function(user) {
      that.user = user;
    });
    
    //Start listening for updates
    this.io.on('update', function(world) {
      var update = function() {
        var updates = world[0];
        for (var timestamp in updates) {
          if (that.debug) {
            console.log('UPD', JSON.stringify(updates[timestamp]), timestamp);
          }
          that.world.put(updates[timestamp], timestamp);
        }
        that.lastUpdateLag = + new Date - world[1];
      };
      if (that.artificialLag && that.debug) {
        setTimeout(update, that.artificialLag);
      }else{
        update();
      }
    });    
    
    var inputs = {};
    var keys = {};
    
    //Setup keys you need and key listeners
    this.hooks.keysSetup.apply(this, [keys]);
    
    //Read input and store the user command
    var readingInputInterval = setInterval(function () {
      var inputUpdate = false;
      for (var code in keys) {
        if (keys[code]) {
          inputUpdate = true;
        }
      }
      if (!inputUpdate) {
        return;
      }
      
      var serverTime =  + new Date - that.lastUpdateLag;
      inputs[serverTime] = keys;
    }, this.inputInterval);

    //Send a packet of all the user commands and execute them locally
    var sendingInputInterval = setInterval(function () {
      var inputUpdate = false;
      for (var timestamp in inputs) {
        if (inputs[timestamp]) {
          inputUpdate = true;
        }
      }
      if (!inputUpdate) {
        return;
      }
      
      that.hooks.inputsProcess.apply(that, [that.user.id, inputs]);
      that.io.emit('input', inputs);
      
      inputs = {};
    }, this.updateInterval);
    
    var requestAnimationFrame = (function() {
      return  window.requestAnimationFrame       ||
              window.webkitRequestAnimationFrame ||
              window.mozRequestAnimationFrame    ||
              window.oRequestAnimationFrame      ||
              window.msRequestAnimationFrame     ||
              function(callback) {
                window.setTimeout(callback, 1000 / 60);
              };
    })();
    
    //Render the view
    function renderLoop() { 
      var snapshot = that.world.interpolate(+ new Date - that.userDelay);
      that.world.snapshot = snapshot;
      //Render snapshot
      that.hooks.viewRender.apply(that, [snapshot]);
      requestAnimationFrame(renderLoop);
    }
    requestAnimationFrame(renderLoop);
  };
  
  /* serverSetup
  * Initialize listening for users
  * Initialize sending delta updates to users, given their last update
  */
  _.prototype.serverSetup = function () {
    var that = this;
    
    this.world = new World({}, + new Date, this.worldLifetime);
    
    this.io.sockets.on('connection', function(socket) {
      var user = that.hooks.userConnect.apply(that, [socket]);
      socket.set('user', user);
      socket.emit('user', user);
      
      socket.on('input', function (inputs) {
        var input = function() {
          socket.get('user', function(err, user) {
            if (err) {
              return;
            }
            that.hooks.inputsProcess.apply(that, [user.id, inputs]);
          });
        };
        if (that.artificialLag && that.debug) {
          setTimeout(input, that.artificialLag);
        }else{
          input();
        }
      });
      
      socket.on('disconnect', function () {
        that.hooks.userDisconnect.apply(that, [socket]);
      });
    });
    
    var sendingUpdateInterval = setInterval(function() {
      that.world.snapshot = that.world.get();
      if (that.debug && that.debug>=2) {
        var latest = JSON.stringify(that.world.snapshot, null, '\t');
        if (that.latest !== latest) {
          console.log(+ new Date);
          console.log(latest);
          that.latest = latest;
        }
      }
      that.io.sockets.clients().forEach(function(socket) {
        socket.get('timestamp', function(err, timestamp) {
          var now = + new Date;
          var update = that.world.delta(timestamp, now);
          var latest = 0;
          for (var timestamp in update) {
            if (timestamp>latest) {
              latest = timestamp;
            }
          }
          if (latest) {
            if (that.debug) {
              console.log("UPD", update, timestamp, now, 
                          JSON.stringify(that.world.snapshot), 
                          JSON.stringify(that.world.edits));
            }
            socket.emit('update', [update, now]);
            socket.set('timestamp', latest);
          }
        });
      });
    }, this.updateInterval);
  };
  
  return _;
})();
});

require.define("/node_modules/capsule/lib/World.js",function(require,module,exports,__dirname,__filename,process,global){module.exports = (function() {
  /* World
  * Data type used to store a world
  * starting/timestamp + deltas in the last lifetime ms
  */
  
  var utility = require('./utility.js');
  
  var _ = function(starting, timestamp, lifetime) {
    this.starting = this.snapshot = starting || {};
    this.timestamp = timestamp || + new Date;
    this.lifetime = lifetime || 2000;
    this.deltas = {};
  };
  
  /* put
  * Put data at edits[timestamp]
  */
  _.prototype.put = function(data, timestamp) {
    if (!this.deltas[timestamp]) {
      this.deltas[timestamp] = data;
    }else{
      utility.merge(this.deltas[timestamp], data);
    }
  };
  
  /* get
  * Merge starting with edits[0...timestamp]
  */
  _.prototype.get = function(timestamp) {
    if (!timestamp) {
      timestamp = + new Date;
    }
    
    return this.delta(0, timestamp, function(result, i, value, isStarting) {
      if (!isStarting) {
        utility.merge(result, value);
      }else{
        var starting = utility.clone(value);
        utility.merge(starting, result);
        return starting;
      }
    });
  };
  
  /* getPath
  * Get a selected value from a selected timestamp or the current snapshot
  */
  _.prototype.getPath = function(path, timestamp) {
    if (!timestamp) {
      return utility.select(this.snapshot, path);
    }else{
      return utility.select(this.get(timestamp), path);
    }
  }
  
  
  /* delta
  * Returns edits[start...stop] or execute an action on each edits
    * If skipStartingCheck is not defined delta will try to merge the deltas 
    * with starting if start is older than starting timestamp
  */
  _.prototype.delta = function(start, stop, action, skipStartingCheck) {
    if (!action) {
      action = function(result, key, value, isStarting) {
        result[key] = value;
      };
    }
    var result = {};
    var now = + new Date;
    
    //Making sure to access the object in the right order
    var keys = [];
    for(var key in this.deltas) {
      keys.push(key);
    }
    keys.sort();
    while(keys.length){
      var key = keys.shift();
      if (key>start && key<=stop) {
        action(result, key, this.deltas[key]);
      }
      if (now-key>this.lifetime) {
        utility.merge(this.starting, this.deltas[key]);
        delete this.deltas[key];
        this.timestamp = key;
      }
    }
    if (!skipStartingCheck && start<this.timestamp) {
      var starting = action(result, this.timestamp, this.starting, true);
      if (starting) {
        return starting;
      }
    }
    return result;
  };
  
  /* interpolate
  * merge starting with edits[0...timestamp] and interpolate
  */
  _.prototype.interpolate = function(timestamp) {
    //Clone starting
    var result = utility.clone(this.starting);
    var startingTimestamp = this.timestamp;
    
    //Generate an array with timestamps
    var timestamps = utility.clone(result);
    utility.each(timestamps, function(object, key) {
      object[key] = startingTimestamp;
    });
    
    var deltas = this.delta(0, + new Date, function(result, key, value) {
      if (key<=timestamp) {
        //Update the timestamps array with edits
        var localTimestamps = utility.clone(value);
        var localTimestamp = key; 
        utility.each(localTimestamps, function(object, key) {
          object[key] = timestamp;
        });
        utility.merge(timestamps, localTimestamps);
        utility.merge(result, value);
      }else{
        var deltas = utility.clone(value);
        utility.each(deltas, function(object, key, path) {
          var newValue = object[key];
          var oldValue = utility.select(result, path, true);
          var newTimestamp = key;
          var oldTimestamp = utility.select(timestamps, path, true);
                  
          var areDefined = typeof oldValue !== 'undefined' ||
                           typeof oldTimestamp !== 'undefined';
          var areNotNumeric = (!utility.isNumeric(oldValue) &&
                              !utility.is('String', oldValue)) || 
                              (!utility.isNumeric(oldValue) &&
                              !utility.is('String', oldValue));
          var areValuesEqual = newValue === oldValue;
          
          if (areDefined || areNotNumeric || areValuesEqual) {
              return;
          }
          
          var totalDelta = newValue-oldValue;
          var totalTime = newTimestamp-oldTimestamp;
          var elapsedTime = newTimestamp-timestamp;
    
          object[key] = oldValue + totalDelta*elapsedTime/totalTime;
        });
        utility.merge(result, deltas);
      }
    }, true);
    
    utility.merge(result, deltas);
    return result;
  };
  
  return _;
})();
});

require.define("/node_modules/capsule/lib/utility.js",function(require,module,exports,__dirname,__filename,process,global){
var utility = {};

/* clone
* Clone an object and return a references-free clone
*/
utility.clone = function(object) {
  if (!object) {
    return;
  }
  var result;
  if (utility.is('Object', object)) {
    result = {};
  }else if (utility.is('Array', object)) {
    result = [];
  }else{
    return object;
  }
  
  for(var key in object) {
    if (!object.hasOwnProperty(key)) {
      continue;
    }
    var isObjectOrArray = object[key] &&
                          (utility.is('Object', object[key]) || 
                          utility.is('Array', object[key]));
    
    if (isObjectOrArray) {
        result[key] = utility.clone(object[key]);
    }else{
        result[key] = object[key];
    }
  }
  return result;
};

/* merge
* Merge object2 in object1
*/
utility.merge = function(object1, object2) {
  for (var key in object2) {
    if (!object2.hasOwnProperty(key)) {
      continue;
    }
    var isObjectOrArray = object2[key] && 
                          (utility.is('Object', object2[key]) ||
                          utility.is('Array', object2[key]));
    if (object1[key] && isObjectOrArray) {
      if (utility.is('Object', object2[key])) {
        if (!utility.is('Object', object1[key])) {
            object1[key] = {};
        }
      }
      if (utility.is('Array', object2[key])) {
        if (!utility.is('Array', object1[key])) {
            object1[key] = [];
        }
      }
      utility.merge(object1[key], object2[key]);
    }else{
      if (object2[key]!==null) { //This fixes arrays merging
          object1[key] = object2[key];
      }
    }
  }
};

/* each
* Cycle recursively over each item which is not an object or an array
  * Execute an action(object, key, path)
*/
utility.each = function(object, action, path) {
  for (var key in object) {
    var newPath = path ? path.slice() : [];
    newPath.push(key);
    if (!object.hasOwnProperty(key)) {
      continue;
    }
    var isObjectOrArray = object[key] &&
                          (utility.is('Object', object[key]) ||
                          utility.is('Array', object[key]));
    if (object[key] && isObjectOrArray) {
      utility.each(object[key], action, newPath);
    }else{
      action(object, key, newPath);
    }
  }
};

/* select
* Select a given path in an object 
* Returns the value or a slice of the object containing that path
*/
utility.select = function(object, path, returnValue) {
  var current = path.shift();
  if (!current)
    return object; 
  
  var result;
  if (utility.is('Object', object)) {
    result = {};
  }
  if (utility.is('Array', object)) {
    result = [];
  }
  if(typeof object[current] !== 'undefined' && path.length>0) {
    result[current] = utility.select(object[current], path, returnValue);
  }else{
    result[current] = object[current];
  }
  if (returnValue) {
    return result[current];
  }else{
    return result;
  }
};

/* is
 * Check an object type
 */

utility.is = function(type, object){
  return Object.prototype.toString.call(object) == '[object ' + type + ']';
}

/* isNumeric
* Returns true if it's a number
*/
utility.isNumeric = function(value) {
  return !isNaN(parseFloat(value)) && isFinite(value);
}

module.exports = utility;

});

require.define("/public/js/client.js",function(require,module,exports,__dirname,__filename,process,global){//Canvas
var canvas = $('#canvas')[0];

var context = canvas.getContext('2d');

var Capsule = require('capsule');
new Capsule(io.connect(), {
  debug: true,
  artificialLag: 0,
  hooks: {
    keysSetup: function(keys){
      //Arrows setup
      for (var i=37; i<=40; i++){
        keys[i] = false;
      }
      
      //Event handling
      $(document).keydown(function (e) {
        if (e.keyCode in keys) {
          keys[e.keyCode] = true;
          return false;
        }
        if (this.debug){
          $('#keys').text(JSON.stringify(keys, null, '\t'));
        }
      });
      $(document).keyup(function (e) {
        if (e.keyCode in keys) {
          keys[e.keyCode] = false;
          return false;
        }
        if (this.debug){
          $('#keys').text(JSON.stringify(keys, null, '\t'));
        }
      });

    },
    viewRender: function(snapshot){
      if (this.debug){
          $('#snapshot').text(JSON.stringify(snapshot, null, '\t'));
      }
      if (!snapshot.players){
          return;
      }
      //Render view
      context.clearRect (0, 0, canvas.width, canvas.height);
      for (var id in snapshot.players){
        if (snapshot.players[id]===false){
          continue;
        }
        context.fillStyle = '#fff';
        context.beginPath();
        var x = snapshot.players[id].position[0]*20+10;
        var y = snapshot.players[id].position[1]*20+10;
        context.arc(x, y, 10, 0, 2 * Math.PI, false);
        context.fill();
        context.textBaseline = 'middle';
        context.textAlign = 'center';
        context.fillStyle = '#000';
        context.fillText(id, x, y);
      }
    },
    inputsProcess: function(id, inputs){
      var snapshot = this.world.getPath(['players', id]);
      for (var timestamp in inputs){
        if (this.debug){
            console.log("INP", id, timestamp, inputs[timestamp], 
                        JSON.stringify(snapshot.players));
        }
        snapshot.players[id]['position'][0] += inputs[timestamp][39]/10;
        snapshot.players[id]['position'][0] -= inputs[timestamp][37]/10;
        snapshot.players[id]['position'][1] += inputs[timestamp][40]/10;
        snapshot.players[id]['position'][1] -= inputs[timestamp][38]/10;
        
        this.world.put(snapshot, timestamp);
      }
    }
  }
}); 

});
require("/public/js/client.js");
})();
