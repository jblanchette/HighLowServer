var _ = require("lodash");
var SocketManager = require("./SocketManager");
var ChatSchema = require("../schemas/Chat");

function ChatManager() {
  var self = this;
  this.rooms = {};
  this.defaultCreated = false;
}

ChatManager.prototype.createRoom = function (options) {
  var roomId = _.uniqueId("ChatRoom-");
  var room = {
    id: roomId,
    name: options.roomName || roomId,
    members: [],
    maxMembers: options.maxMembers || 250,
    isGlobal: false
  };

  this.rooms[roomId] = room;
  return room;
};

ChatManager.prototype.createGlobalRoom = function (isOverflow) {
  if (this.defaultCreated && !isOverflow) {
    console.error("Tried to create a non-overflow global room.");
    return;
  }

  var roomId = isOverflow ? _.uniqueId("GlobalChat-") : "GlobalChat";
  var room = {
    id: roomId,
    name: "Global Chat",
    members: [],
    maxMembers: 500,
    isGlobal: true
  };

  console.log("Creating global chat room: " + roomId);
  this.defaultCreated = true;
  this.rooms[roomId] = room;
  return room;
};

ChatManager.prototype.getGlobalRoom = function () {
  var self = this;
  var room = _.find(this.rooms, function (room) {
    return room.isGlobal && room.members.length < room.maxMembers;
  });

  if (!room) {
    console.log("Making a new global room due to overflow.");
    room = self.createGlobalRoom(true);
  }

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
    console.log("Couldn't find room to join: ", roomId);
    console.log("Rooms: ", this.rooms);
    return false;
  } else {
    var memberId = newMember.id;
    var alreadyExists = _.any(room.members, function (member) {
      return member.id === memberId;
    });

    if (alreadyExists) {
      console.log("Theres already a member of id name in the room.", room);
      return false;
    }

    console.log("Adding member to room: ", room.id, newMember);
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

  // user connected to chat server
  options.onConnect = function (socket) {
    console.log("Running chat on connect");
    // tell the connecting user which global chat to connect to
    var globalChatRoom = self.getGlobalRoom();
    console.log("Got a global room: ", globalChatRoom);
    self.joinRoom(globalChatRoom.id, { id: socket.id, nickname: "Some guy" });

    socket.join(globalChatRoom.id);
    socket.emit("JOIN_GLOBAL", globalChatRoom);

    var ioInstance = SocketManager.getServerInstance();
    ioInstance.to(globalChatRoom.id).emit("JOIN_GLOBAL", socket.id);
  };

  var handlers = options.handlers;
  handlers[ChatSchema.joinRoom] = function (socket, data) {
    var result = self.joinRoom(data.roomId, data.member);

    if (result) {
      socket.join(result.roomId);

      // todo: get member info from auth  / user service
      socket.to(result.roomId).emit(ChatSchema.memberJoined, data.member);
    }
  };

  handlers[ChatSchema.leaveRoom] = function (socket, data) {
    var room = _.find(self.rooms, { id: data.roomId });

    if (!room) {
      return false;
    } else {
      var memberId = data.memberId;

      _.remove(room.members, function (member) {
        return member.id === memberId;
      });

      socket.to(room.id).emit(ChatSchema.memberLeft, data.member);

      return true;
    }
  };

  handlers[ChatSchema.roomMessage] = function (socket, data) {
    var memberId = data.memberId;
    var room = _.find(self.rooms, { id: data.roomId });

    if (!room) {
      console.log("Couldnt find room with ID: " + data.roomId);
      console.log("Data: ", data);
      console.log("Rooms: ", self.rooms);
      return;
    }

    var memberOfRoom = _.any(room.members, function (member) {
      return member.id === memberId;
    });

    if (room && memberOfRoom) {
      // todo: auth, sanitization, formatting, ect
      console.log("Sending message to room id: ", room.id, "msg: ", data.message);
      socket.to(room.id).emit(ChatSchema.roomMessage, data.message);
    } else {
      console.log("Not a member of room, tried to send message: ", room);
      console.log("Looked for: ", memberId);
    }
  };

  return options;
};


module.exports = new ChatManager();
