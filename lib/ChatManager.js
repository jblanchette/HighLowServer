var _ = require("lodash");
var SocketManager = require("./SocketManager");
var ChatSchema = require("../schemas/Chat");

function ChatManager() {
  var self = this;
  this.rooms = {};
}

ChatManager.prototype.createRoom = function (options) {

};

ChatManager.prototype.removeRoom = function (roomId) {

};

ChatManager.prototype.joinRoom = function (roomId, member) {

};

ChatManager.prototype.getNamespace = function () {
  var self = this;
  var options = {
    channelName: "chat",
    handlers: {}
  };

  var handlers = options.handlers;
  handlers[GameListSchema.joinRoom] = function (socket, data) {
    
  };

  handlers[GameListSchema.leaveRoom] = function (socket, data) {

  };

  handlers[GameListSchema.roomMessage] = function (socket, data) {

  };

  return options;
};
