//Canvas
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
