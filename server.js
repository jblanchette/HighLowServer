var _ = require("lodash");
var restify = require("restify");
var server = restify.createServer();
var socketio = require("socket.io");
var io = socketio.listen(server.server);

var SocketManager = require("./lib/SocketManager").instance;
var GameListManager = require("./lib/GameListManager");
var GameManager = require("./lib/GameManager");
var ChatManager = require("./lib/ChatManager");
var AccountManager = require("./lib/AccountManager");

SocketManager.setServerInstance(io);

io.sockets.on("connection", function (socket) {
	console.log("A socket connected to global; ", socket.id);

	socket.on("disconnect", function () {
		console.log("A socket disconnected", socket.id);
    var disconnectHandlers = SocketManager.getDisconnectHandlers();

    console.log("Running disc handlers: ", disconnectHandlers.length);
    _.each(disconnectHandlers, function (handler) {
      handler(socket);
    });
	});
});

server.listen(8080, function () {
  console.log("Starting server on port 8080");
  console.log("=======================================================\n");
  
  var accountNsp = AccountManager.setupNamespace();
  var gameListNsp = GameListManager.setupNamespace();
  var gameNsp = GameManager.setupNamespace();
  var chatNsp = ChatManager.setupNamespace();

  accountNsp.create();
  gameListNsp.create();
  gameNsp.create();
  chatNsp.create();

  console.log("Making games...");
  for (var i = 0; i < 5; i++) {
	  GameListManager.createGame();
  }

  ChatManager.createGlobalRoom();
});
