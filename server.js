var restify = require("restify");
var server = restify.createServer();
var socketio = require("socket.io");
var io = socketio.listen(server.server);

var SocketManager = require("./lib/SocketManager");
var GameManager = require("./lib/GameManager");
var ChatManager = require("./lib/ChatManager");
var AccountManager = require("./lib/AccountManager");

SocketManager.setServerInstance(io);

io.sockets.on("connection", function (socket) {
	console.log("A socket connected to global; ", socket.id);

	socket.on("disconnect", function () {
		console.log("A socket disconnected", socket.id);
		AccountManager.clearSocketId(socket.id);
	});
});

server.listen(8080, function () {
  console.log("Starting server on port 8080");
  console.log("=======================================================\n");
  SocketManager.createNamespace(AccountManager.getNamespace());
  SocketManager.createNamespace(GameManager.getNamespace());
  SocketManager.createNamespace(ChatManager.getNamespace());

  console.log("Making games...");
  for (var i = 0; i < 5; i++) {
	GameManager.createGame();
  }

  ChatManager.createGlobalRoom();
});
