var restify = require("restify");
var server = restify.createServer();
var socketio = require("socket.io");
var io = socketio.listen(server.server);

var SocketManager = require("./lib/SocketManager");
var GameManager = require("./lib/GameManager");

SocketManager.setServerInstance(io);

io.sockets.on('connection', function (socket) {
	console.log("A socket connected to global; ", socket.id);
});

server.listen(8080, function () {
	console.log("Starting server on port 8080");
	SocketManager.createNamespace(GameManager.getNamespace());

	console.log("Making games...");
	for (var i = 0; i < 5; i++) {
		GameManager.createGame();
	}
});