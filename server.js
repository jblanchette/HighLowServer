var restify = require("restify");
var server = restify.createServer();
var socketio = require("socket.io");
var io = socketio.listen(server.server);

var SocketManager = require("./lib/SocketManager");

io.sockets.on('connection', function (socket) {
	SocketManager.onConnect(socket);
});

server.listen(8080, function () {
	console.log("going");
});