capsule-example
===============

An example for Capsule

Every player control a moving circle, nothing fancy.
This little demo use socket.io, connect and capsule.

To start this example just run
````bash
$ npm install
$ npm start
````
Open `http://localhost:3000` and enjoy!

Documentation is still on its way but I feel like a little explanation of the library is something I must provide.

##SERVER:
###Initialize an empty world
  A world is a special data structure which consists of:
  - A snapshot of the world
  - The latest incremental updates applied to the world in the last `x` ms
  
  Every update older than `x` will be merged into the snapshot.

###Initialize the updates sending interval
  For each connected user, an incremental update is generated (reading the last timestamp at which the user comunicated with the server)

###Wait for users to join or send input
  Each input is validated and inserted into the world

##CLIENT:
###Initialize an empty world
  A world is used on the client too.

###Initialize the inputs storing interval
  Every `x` ms the keys which are being pressed are saved in an array

###Initialize the update sending interval
  Every `x` ms all the inputs are sent to the server for validation
  All the inputs are also executed locally without waiting for the server

###Initialize the rendering interval
  At each animation frame, the client get a snapshot of the world, `x` ms in the past, interpolates the values with past and future snapshots and render the world.

----------------------------------------

Afer reading the main flow, the code should be easy to read.
The goal of the library is to provide a simple API for developers, but it's still early.

Feel free to play with the options in `public/js/client.js` and `server.js`.
Quoting from the code:
````JavaScript
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

//Hooks are function which are executed in some key points
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
````

After editing `client.js` you have to generate the `capsule.js` which will be included in the browser.
I love browserify so:
````bash
$ sudo npm install -g browserify
$ browserify public/js/client.js -o public/js/capsule.js
````

##License
MIT
