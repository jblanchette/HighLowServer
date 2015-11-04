var _ = require("lodash");
var SocketManager = require("./SocketManager");
var ChatSchema = require("../schemas/Chat");

function ChatManager() {
  var self = this;
  this.rooms = {};
}

ChatManager.prototype.createRoom = function (options) {
  var roomId = _.uniqueId("ChatRoom-");

  var room = {
    id: roomId,
    name: options.roomName || roomId,
    members: [],
    maxMembers: options.maxMembers || 250
  };

  this.rooms[roomId] = room;

  return room;
};

ChatManager.prototype.removeRoom = function (roomId) {
  return _.remove(this.rooms, function (room) {
    return room.id === roomId;
  });
};

ChatManager.prototype.joinRoom = function (roomId, newMember) {
  var room = _.find(this.rooms, { id: roomId });

  if (!room) {
    return false;
  } else {
    var memberId = newMember.id;
    var alreadyExists = _.any(room.members, function (member) {
      return member.id === memberId;
    });

    if (alreadyExists) {
      return false;
    }

    room.members.push(newMember);

    return room;
  }
};

ChatManager.prototype.getNamespace = function () {
  var self = this;
  var options = {
    channelName: "chat",
    handlers: {}
  };

  var handlers = options.handlers;
  handlers[ChatListSchema.joinRoom] = function (socket, data) {
    var result = self.joinRoom(data.roomId, data.member);

    if (result) {
      socket.join(result.roomId);

      // todo: get member info from auth  / user service
      socket.to(result.roomId).emit(ChatListSchema.memberJoined, data.member);
    }
  };

  handlers[ChatListSchema.leaveRoom] = function (socket, data) {
    var room = _.find(this.rooms, { id: data.roomId });

    if (!room) {
      return false;
    } else {
      var memberId = data.memberId;

      _.remove(room.members, function (member) {
        return member.id === memberId;
      });

      socket.to(room.id).emit(ChatListSchema.memberLeft, data.member);

      return true;
    }
  };

  handlers[ChatListSchema.roomMessage] = function (socket, data) {
    var memberId = data.memberId;
    var room = _.find(this.rooms, { id: data.roomId });
    var memberOfRoom = _.any(room.members, function (member) {
      return member.id === memberId;
    });

    if (room && memberOfRoom) {
      // todo: auth, sanitization, formatting, ect
      socket.to(room.id).emit(ChatListSchema.roomMessage, data.message);
    }
  };

  return options;
};
