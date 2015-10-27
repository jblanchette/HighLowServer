var GameManager = require("./GameManager");
var GameListSchema = require("../schemas/GameList");
var WSocket = require("./WSocket");

function SocketManager() {

}

SocketManager.prototype.onConnect = function (socket) {
	console.log("A socket connected");

	socket.join("GamesList");
	socket.emit(GameListSchema.gameList, GameManager.readGameList());
};

SocketManager.prototype.onDisconnect = function (socket) {

};

module.exports = new SocketManager();