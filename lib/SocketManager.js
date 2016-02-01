var _ = require("lodash");
var GameListManager = require("./GameListManager");
var AccountManager = require("./AccountManager");
var SocketSchema = require("../schemas/Socket");

function SocketManager() {
	this.instances = {};
	this.disconnectHandlers = {
		handlers: [],
		lastHandlers: []
	};

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

SocketManager.prototype.getDisconnectHandlers = function () {
	// return the ordered array of handlers: normal then last
	return this.disconnectHandlers.handlers.concat(this.disconnectHandlers.lastHandlers);
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

	if (_.isFunction(options.onDisconnect)) {
		if (options.disconnectLast) {
			console.log("Added a 'last run' disconnect handler");
			self.disconnectHandlers.lastHandlers.push(options.onDisconnect);
		} else {
			console.log("Added a normal disconnect handler");
			self.disconnectHandlers.handlers.push(options.onDisconnect);
		}
	}

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
	namespace.instance.on('connection', function (socket) {		
		console.log("Cliented connected to: " + namespace.name, ": ", socket.id);

		if (_.isFunction(namespace.onConnect)) {
			var user = AccountManager.getUserBySocket(socket.id);
			console.log("User: ", user);
			
			if (namespace.onConnectRequiresAuth && !user) {
				console.warn("*** WARN: *** Non-auth socket tried to run onConnect: ", socket.id);

				console.log("Usermap: ", AccountManager.getUserMap());
				socket.emit(SocketSchema.unauthorized, { message: "Unautorized, unable to perform: onConnect" });
				return;
			}

			namespace.onConnect(socket, user);
		}

		_.each(namespace.handlers, function (handler, handlerKey) {
			var handlerFn = handler.fn;
			var isAuthorized = handler.isAuthorized || false;

			socket.on(handlerKey, function (data) {
				console.log("** Running handler: ", handlerKey);
				
				var user;
				if (isAuthorized) {
					  user = AccountManager.getUserBySocket(socket.id);

					  if (!user) {
							console.log("User: ", user);
							console.warn("*** WARN: *** Non-auth socket tried to use route: ", socket.id, "handlerKey: ", handlerKey);
							console.log("Usermap: ", AccountManager.getUserMap());
							console.log("Sending socket unauth: ", SocketSchema);

							socket.emit(SocketSchema.unauthorized, { message: "Unautorized, unable to perform: " + handlerKey });
							return;
						}
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
