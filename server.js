var connect = require('connect');
var app = connect()
    .use(connect.static('public'))
    .listen(3000);
    
var io = require('socket.io').listen(app);

var Capsule = require('capsule');

new Capsule(io, {
  debug: true,
  artificialLag: 0,
  hooks: {
    userConnect: function(socket){
      var snapshot = this.world.getPath(['players']);
      if (!snapshot.players){
          snapshot.players = [];
      }
      var id = snapshot.players.push({
          position: [0,0]
      })-1;
      this.world.put(snapshot, + new Date);
      
      socket.emit('Welcome');
      return {id: id};
    },
    userDisconnect: function(socket){
      var that = this;
      socket.get('user', function(err, user){
        if (err){
          return;
        }
        var snapshot = that.world.getPath(['players', user.id]);
        
        snapshot.players[user.id] = false;
        that.world.put(snapshot, + new Date);
        
      });
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