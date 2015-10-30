var _ = require("lodash");
var GameManager = require("./GameManager");
var GameListSchema = require("../schemas/GameList");
var WSocket = require("./WSocket");

function SocketManager() {
	this.imports = {};
}

SocketManager.prototype.setup = function (mod, force) {
	var imports = mod.SocketHandlers;
	var self = this;

	console.log("Importing: ", imports);

	/*	Example imports obj:
	 *	{
	 *		"JOIN_GAME": function (data) { socket.something... }
	 *  }
	 */
	_.each(imports, function (importFn, importKey) {
		if (!force && _.has(self, importKey)) {
			return;
		}

		self.imports[importKey] = importFn;
	});
};

SocketManager.prototype.onConnect = function (socket) {
	console.log("A socket connected");
	socket.on("disconnect", this.onDisconnect.bind());
	this.setupSocketHandlers(socket);
};

SocketManager.prototype.setupSocketHandlers = function (socket) {
	// these should just be the basic handshake / auth stuff
	// the game instances should handle adding their handlers
	// when the socket is ready for them
	var self = this;

	_.each(self.imports, function (importFn, importKey) {
		console.log("Socket fn: ", importKey);
		socket.on(importKey, function (data) { importFn(socket, data); });
	});
};

SocketManager.prototype.onDisconnect = function (socket) {
	console.log("Socket disconnected: ", socket);
};

module.exports = new SocketManager();