var _ = require("lodash");
var AccountManager = require("./AccountManager");
var SocketManager = require("./SocketManager");
var ChatSchema = require("../schemas/Chat");

function ChatManager() {
  var self = this;
  this.rooms = {};
  this.defaultCreated = false;
  this.namespaceName = null;
}

ChatManager.prototype.createRoom = function (options) {
  var roomId = _.uniqueId("ChatRoom-");
  var room = {
    id: roomId,
    name: options.roomName || roomId,
    members: [],
    maxMembers: options.maxMembers || 250,
    isGlobal: _.get(options, "isGlobal") || false
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

ChatManager.prototype.leaveAllRooms = function (socket, member) {
  console.log("Removing member from all rooms: ", member);
  var ioInstance = SocketManager.instance.getServerInstance();
  var memberId = member.id;
  var self = this;
  
  _.each(this.rooms, function (room) {
    _.remove(room.members, function (removeMember) {
      return removeMember.id === memberId;
    });

    socket.leave(room.id);
    socket.emit(ChatSchema.leftRoom, room);
    ioInstance.of(self.namespaceName).emit(ChatSchema.userLeft, {
      room: room,
      focus: {
        id: member.id,
        nickname: member.nickname
      }
    });
  });

  console.log("Done leaving all rooms");
};
  
ChatManager.prototype.joinRoom = function (joinRoom, member) {
  var room = _.find(this.rooms, { id: joinRoom });

  if (!room) {
    console.log("Couldn't find room to join: ", joinRoom);
    console.log("Rooms: ", this.rooms);
    return null;
  } else {
    var memberId = member.id;
    var alreadyExists = _.any(room.members, function (member) {
      return member.id === memberId;
    });

    if (alreadyExists) {
      console.warn("*** There is a member with this id already in the room.", member, room);

      return null;
    }

    console.log("Adding member to room: ", room.id, member);
    room.members.push(_.pick(member, ["id", "username", "nickname"]));
    return room;
  }
};

ChatManager.prototype.leaveRoom = function (leaveRoom, member) {

  console.log("================= LEAVE ROOM =====================");
  var room = _.find(this.rooms, { id: leaveRoom });

  if (!room) {
    console.log("Couldn't find room to join: ", leaveRoom);
    console.log("Rooms: ", this.rooms);
    return false;
  } else {
    var memberId = member.id;    
    var removedMember = _.remove(room.members, function (removeMember) {
      return removeMember.id === memberId;
    });

    if (!removedMember) {
      console.warn("No member to remove with this ID: ", memberId, room);
    } else {
      console.log("Removed member from room: ", memberId, room);
    }  

    return room;
  }
};

ChatManager.prototype.joinGlobalRoom = function (member) {
  var globalCheck = _.some(this.rooms, function (room) {
    return room.isGlobal && _.some(room.members, { id: member.id });
  });

  if (globalCheck) {
    return;
  }
  
  var globalChatRoom = this.getGlobalRoom();
  console.log("Got a global room: ", globalChatRoom);
  return this.joinRoom(globalChatRoom.id, member);
};

ChatManager.prototype.setupNamespace = function () {
  var self = this;
  var options = {
    name: "chat",
    onDisconnect: function (socket) {
      var user = AccountManager.getUserBySocket(socket.id);
      if (user) {
        console.log("Leaving all chat rooms for user: ", user);
        self.leaveAllRooms(socket, user);
      }
    }
  };

  self.namespaceName = options.name;
  var namespace = SocketManager.instance.createNamespace(options);
  var ioInstance = SocketManager.instance.getServerInstance();

  namespace.addHandler({
    key: ChatSchema.joinRoom,
    isAuthorized: true,
    fn: function (socket, user, data) {
      console.log("*** RUNNING JOIN ROOM");
      var room = self.joinRoom(user, data);

      if (room) {
        socket.join(result.roomId);

        // todo: get member info from auth  / user service
        socket.to(result.roomId).emit(ChatSchema.memberJoined, {
          room: room,
          focus: user
        });
      }
    }
  });

  namespace.addHandler({
    key: ChatSchema.leaveRoom,
    isAuthorized: true,
    fn: function (socket, user, data) {
      
      self.leaveRoom(user, data);
      socket.to(room.id).emit(ChatSchema.memberLeft, user.id);
      return true;
    }
  });

  namespace.addHandler({
    key: ChatSchema.roomMessage,
    isAuthorized: true,
    fn: function (socket, user, data) {
      var memberId = user.id;
      var room = _.find(self.rooms, { id: data.id });

      if (!room) {
        console.log("Couldnt find room with ID: " + data.id);
        console.log("Data: ", data);
        console.log("Rooms: ", self.rooms);
        return;
      }

      var memberOfRoom = _.any(room.members, function (member) {
        return member.id === memberId;
      });

      if (room && memberOfRoom) {
        // todo: auth, sanitization, formatting, ect
        console.log("Sending message to room id:", room.id, "Socket: ", socket.id, "msg: ", data.message);

        var message = {
          authorId: user.id,
          author: user.nickname,
          message: data.message
        };

        // tell everybody in the room, including sender
        ioInstance.of(options.name).to("GlobalChat").emit(ChatSchema.roomMessage, message);
      } else {
        console.log("Not a member of room, tried to send message: ", room);
        console.log("Looked for: ", memberId);
      }
    }
  });

  namespace.addHandler({
    key: ChatSchema.joinGlobalRoom,
    isAuthorized: true,
    fn: function (socket, user, data) {
      var joinedRoom = self.joinGlobalRoom(user);

      console.log("==========================================");
      console.log("Running joinGlobalRoom: ", user, joinedRoom);
      if (joinedRoom) {
        console.log("Joining socket room: " + joinedRoom.id, "Socket: ", socket.id);
        socket.join(joinedRoom.id);

        // tell the sender they joined this room
        socket.emit(ChatSchema.joinGlobalRoom, joinedRoom);
        // tell everyone else they joined
        socket.to(joinedRoom.id).emit(ChatSchema.userJoined, {
          room: joinedRoom,
          focus: user
        });
      } else {
        console.log("Didn't join a global room, already was in one?");
      }
    }
  });

  return namespace;
};


module.exports = new ChatManager();
