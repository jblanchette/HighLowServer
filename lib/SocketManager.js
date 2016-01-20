var _ = require("lodash");
var GameManager = require("./GameManager");
var AccountManager = require("./AccountManager");
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
		name: options.channelName,
		onConnect: options.onConnect,
		handlers: {}
	};

	var self = this;
	this.instances[namespace.id] = namespace;

	console.log("Created socket namespace: " + options.channelName);
	console.log("Serv instace: ", _.pluck(this.serverInstance.nsps, "name"));
	console.log("=======================================================\n");

	return {
		namespace: namespace,
		connect: function () {
			namespace.instance = self.serverInstance.of("/" + namespace.channelName);
			self.setupSocketHandlers(namespace);

			return namespace;
		},
		addHandler: function (handler) {
			if (!handler || !handler.key) {
				console.error("**ERROR** Passed a socket handler without a key");
				return;
			}

			namespace.handlers[handler.key] = handler;
		}
	};
};

SocketManager.prototype.setupSocketHandlers = function (namespace) {
	var self = this;
	namespace.on('connection', function (socket) {
		var user = AccountManager.getUserBySocket(socket.id);
		if (_.isFunction(namespace.onConnect)) {
			if (namespace.onConnectRequiresAuth && !user) {
				console.warn("*** WARN: *** Non-auth socket tried to use route: ", socket.id, "Handler Key: ", handlerKey);
				return;
			}

			namespace.onConnect(socket, user);
		}

		_.each(namespace.handlers, function (handler, handlerKey) {
			var handlerFn = handler.fn;
			var isAuthorized = handler.isAuthorized || false;

			socket.on(handlerKey, function (data) {
				if (isAuthorized && !user) {
						console.warn("*** WARN: *** Non-auth socket tried to use route: ", socket.id, "Handler Key: ", handlerKey);
						return;
					}
				}

				console.log("[" + user.username + "] namespace got msg: ", handlerKey, JSON.stringify(data));
				handlerFn(namespace, user, data);
			});
		});
	});
};

module.exports = new SocketManager();
