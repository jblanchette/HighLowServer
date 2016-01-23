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

	if (!_.has(options, "name")) {
		throw new Error("Socket namespace must have a defined channel name" + options);
	}

	var namespace = _.merge({
		id: _.uniqueId("SocketInstance-"),
		handlers: {},
	}, options);

	console.log("Making: ", namespace);

	var self = this;
	this.instances[namespace.id] = namespace;

	console.log("Created socket namespace: " + options.name);
	console.log("Serv instace: ", _.pluck(this.serverInstance.nsps, "name"));
	console.log("=======================================================\n");

	return {
		namespace: namespace,
		create: function () {
			namespace.instance = self.serverInstance.of("/" + namespace.name);
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

	console.log("Setting up handlers: ", namespace.handlers);

	namespace.instance.on('connection', function (socket) {
		console.log("Getting user for socket: ", socket.id);
		var user = AccountManager.getUserBySocket(socket.id);
		console.log("User: ", user);

		if (_.isFunction(namespace.onConnect)) {
			if (namespace.onConnectRequiresAuth && !user) {
				console.warn("*** WARN: *** Non-auth socket tried to use route: ", socket.id);
				return;
			}

			namespace.onConnect(socket, user);
		}

		console.log("Cliented connected to: " + namespace.name);

		_.each(namespace.handlers, function (handler, handlerKey) {
			console.log("Making handler: ", handler, handlerKey);

			var handlerFn = handler.fn;
			var isAuthorized = handler.isAuthorized || false;

			socket.on(handlerKey, function (data) {
				if (isAuthorized && !user) {
						console.log("User: ", user);
						console.warn("*** WARN: *** Non-auth socket tried to use route: ", socket.id, "handlerKey: ", handlerKey);
						return;
				}

				if (isAuthorized) {
					console.log("[" + user.username + "] namespace got msg: ", handlerKey, JSON.stringify(data));
				} else {
					console.log("namespace got msg: ", handlerKey, JSON.stringify(data));
				}

				handlerFn(socket, user, data);
			});
		});
	});
};

console.log("Making new socket mgr");

module.exports.instance = new SocketManager();
