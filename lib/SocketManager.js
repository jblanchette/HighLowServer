var _ = require("lodash");
var GameManager = require("./GameManager");
var GameListSchema = require("../schemas/GameList");

function SocketManager() {
	this.instances = {};
	this.serverInstance = null;
}

SocketManager.prototype.setServerInstance = function (serverInstance) {
	this.serverInstance = serverInstance;
};

SocketManager.prototype.getServerInstance = function () {
	return this.serverInstance;
};

SocketManager.prototype.removeNamespace = function (channelId) {
	delete this.instances[channelId];
};



SocketManager.prototype.createNamespace = function (options) {
	if (!this.serverInstance) {
		throw new Error("Socket.IO instance not set in SocketManager");
	}

	if (!_.has(options, "channelName")) {
		throw new Error("Socket namespace must have a defined channel name" + options);
	}

	var namespace = {
		id: _.uniqueId("SocketInstance-"),
		instance: this.serverInstance.of("/" + options.channelName)
	};

	this.setupSocketHandlers(namespace.instance, options);
	this.instances[namespace.id] = namespace;

	console.log("Created socket namespace: " + options.channelName);
	console.log("Serv instace: ", _.pluck(this.serverInstance.nsps, "name"));
	console.log("=======================================================\n");
	return namespace;
};

SocketManager.prototype.setupSocketHandlers = function (namespace, options) {
	var self = this;

	namespace.on("disconnect", function () {
		console.log("A socket disconnected from " + options.channelName, arguments);
	});

	namespace.on('connection', function (socket) {
		console.log("A client connected to " + options.channelName);

		console.log("Checking for onConnect func");
		if (_.isFunction(options.onConnect)) {
			console.log("Setting on connect handler for " + options.channelName);
			options.onConnect(socket);
		} else {
			console.log("nothin found");
		}

		_.each(options.handlers, function (handlerFn, handlerKey) {
			console.log("Setting message handler: ", handlerKey);
			
			socket.on(handlerKey, function (data) { 
				console.log("namespace got msg: ", handlerKey, JSON.stringify(data)); 
				handlerFn(namespace, data); 
			});
		});
	});

	
};

module.exports = new SocketManager();
