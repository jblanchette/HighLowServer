var _ = require("lodash");
var SocketManager = require("./SocketManager");
var AccountSchema = require("../schemas/Accounts");

function AccountManager() {
	this.userMap = {};
}

AccountManager.prototype.setupNamespace = function () {
	var self = this;
	var namespace = SocketManager.createNamespace("accounts");

  namespace.addHandler({
    key: AccountSchema.login,
    isAuthorized: false,
		fn: function (socket, user, data) {
			console.log("Logging user in", data);
			// only send this to the user who authorized
			// TODO: write authorization layer
			// TODO: this should be promisified
			// TODO: don't always overwrite this without any check
			var loginData = self.login(data.username, data.password, data.nickname);
			self.userMap[socket.id] = loginData;

			socket.send(AccountSchema.authorize, loginData);
		}
	});

	return namespace;
};

AccountManager.prototype.clearSocketId = function (socketId) {
	if (_.has(this.userMap, socketId)) {
		delete this.userMape[socketId];
	}
};\

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

AccountManager.prototype.login = function (username, password, tempData) {
	// TODO remove tempData in favor of getting the real data
	return {
		id: _.uniqueId(),
		username: username,
		password: password,
		nickname: tempData.nickname
	};
};

AccountManager.prototype.logout = function (username) {

};

module.exports = new AccountManager();
