'use strict';

var nodeStatic = require('node-static');
var https = require('https');
var fs = require('fs');
const SerialPort = require('serialport')
const port = new SerialPort('/dev/ttyUSB0', { baudRate:9600, autoOpen: false });
//var speedratio = 0; //64 - (64*0.3);;
//var motor1last = 0;
//var motor2last = 0;

var fileServer = new(nodeStatic.Server)();

var options = {
  key: fs.readFileSync('keys/client-key.pem'),
  cert: fs.readFileSync('keys/client-cert.pem')
};

var app = https.createServer(options, function (req, res) {
  fileServer.serve(req, res);
}).listen(8080);

port.open(function (err) {
    if (err) {
      return console.log('Error opening serial port: ', err.message);
    }
});
  

var io = require('socket.io').listen(app);
io.sockets.on('connection', function (socket){
    function log(){
		var array = [">>> "];
		array.push.apply(array, arguments);
		socket.emit('log', array);
		console.log(array);
    }
    
    function setMotion(speed, steer) {
        if (speed == 0 && steer !=0) {
            if(steer > 15) steer = 15;
            if(steer < -15) steer = -15;
            spdTgtL = -steer;
            spdTgtR = steer;
        } else {
            steer = steer * 2;
            if(steer > 63) steer = 63;
            if(steer < -64) steer = -64;
            var spdTgtL = speed * ((64 - steer) / 64.0);
            var spdTgtR = speed * ((-64 - steer) / -64.0);
            
            if (speed > 0 && spdTgtL > speed)
                spdTgtL = speed;
            if (speed > 0 && spdTgtR > speed)
                spdTgtR = speed;
            if (speed < 0 && spdTgtL < speed)
                spdTgtL = speed;
            if (speed < 0 && spdTgtR < speed)
                spdTgtR = speed;
        }
        setMotors(spdTgtL, spdTgtR);
    }

    function setMotors(motor1, motor2) { //values are -64 to +63
        motor1 = mapval(motor1, -64, 63, 127, 0);
        motor2 = mapval(motor2, -64, 63, 127, 0);
        port.write(new Buffer([128, 6, motor1, (128+6+motor1)&127]));
        port.write(new Buffer([128, 7, motor2, (128+7+motor2)&127]));
        console.log("Motor1:" + motor1 + "   Motor2:"+ motor2);
    }
    function mapval(x, in_min, in_max, out_min, out_max)
    {
        return (x - in_min) * (out_max - out_min) / (in_max - in_min) + out_min;
    }

	socket.on('message', function (message) {
		log('Got message: ', message);
		socket.broadcast.emit('message', message); // should be room only
	});
	
	socket.on('robot', function (data) {
		console.log(data);
		socket.broadcast.emit('robot', data);
        socket.emit('robot', data);
        if (data['cmd'] == "drv") {
            setMotion(data['sp'], data['dr']);
        }
	});

	socket.on('create or join', function (room) {
		var clientsInRoom = io.sockets.adapter.rooms[room];
		var numClients = clientsInRoom ? Object.keys(clientsInRoom.sockets).length : 0;
		log('Room ' + room + ' has ' + numClients + ' client(s)');
		log('Request to create or join room', room);

		if (numClients == 0){
			socket.join(room);
			socket.emit('created', room, socket.id);
		} else if (numClients == 1) {
			io.sockets.in(room).emit('join', room);
			socket.join(room);
			socket.emit('joined', room, socket.id);
		} else { // max two clients
			socket.emit('full', room);
		}
		socket.emit('emit(): client ' + socket.id + ' joined room ' + room);
		socket.broadcast.emit('broadcast(): client ' + socket.id + ' joined room ' + room);

	});

	socket.on('ipaddr', function() {
		var ifaces = os.networkInterfaces();
		for (var dev in ifaces) {
		  ifaces[dev].forEach(function(details) {
			if (details.family === 'IPv4' && details.address !== '127.0.0.1') {
			  socket.emit('ipaddr', details.address);
			}
		  });
		}
	  });
	
	  socket.on('bye', function(){
		console.log('received bye');
	  });
	
});

