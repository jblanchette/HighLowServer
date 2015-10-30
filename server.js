var restify = require("restify");
var server = restify.createServer();
var socketio = require("socket.io");
var io = socketio.listen(server.server);

var SocketManager = require("./lib/SocketManager");
var GameManager = require("./lib/GameManager");

io.sockets.on('connection', function (socket) {
	SocketManager.onConnect(socket);
});

server.listen(8080, function () {
	console.log("going");

	SocketManager.setup(GameManager);

	for (var i = 0; i < 5; i++) {
		GameManager.createGame();
	}
});