var _ = require("lodash");
var SocketManager = require("./SocketManager");
var AccountSchema = require("../schemas/Accounts");

function AccountManager() {
	this.userMap = {};
}

AccountManager.prototype.setupNamespace = function () {
	var self = this;
	var options = {
		name: "login",
		disconnectLast: true,
		onDisconnect: function (socket) {
			self.clearSocketId(socket.id);
		}
	};

	var namespace = SocketManager.instance.createNamespace(options);

  namespace.addHandler({
    key: AccountSchema.login,
    isAuthorized: false,
		fn: function (socket, user, data) {
			console.log("Logging user in", data);
			// only send this to the user who authorized
			// TODO: write authorization layer
			// TODO: this should be promisified
			// TODO: don't always overwrite this without any check
			var loginData = self.login(socket.id, data.username, data.password);
			socket.emit(AccountSchema.authorize, loginData);
		}
	});

	return namespace;
};

AccountManager.prototype.clearSocketId = function (socketId) {
	if (_.has(this.userMap, socketId)) {
		delete this.userMap[socketId];
	}
};

// TODO: make this more secure, token based?
AccountManager.prototype.isSocketAuthorized = function (socketId) {
  return socketId && _.has(this.userMap, socketId);
};

AccountManager.prototype.getUserBySocket = function (socketId) {
	return this.userMap[socketId] || null;
};

AccountManager.prototype.getUserById = function (userId) {
	return _.find(this.userMap, { id: userId });
};

AccountManager.prototype.getUserMap = function () {
	return this.userMap;
};

AccountManager.prototype.login = function (socketId, username, password) {
	var user = {
		id: parseInt(_.uniqueId()),
		username: username,
		password: password,
		nickname: "User-" + username
	};

	this.userMap[socketId] = user;

	console.log("Logged in: ", socketId, user);
	return user;
};

AccountManager.prototype.logout = function (username) {

};

module.exports = new AccountManager();
