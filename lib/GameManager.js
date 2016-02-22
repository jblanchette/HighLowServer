var _ = require("lodash");
var AcccountManager = require("./AccountManager");
var SocketManager = require("./SocketManager");
var GameSchema = require("../schemas/Game");
var AccountSchema = require("../schemas/Accounts");

function GameManager() {
  this.games = {};
}

GameManager.prototype.setupNamespace = function () {
  var self = this;
  var options = {
    name: "game", 
    onDisconnect: function (socket) {
      var user = AcccountManager.getUserBySocket(socket.id);

      if (user) {
        // todo: do some kind of 'left game' logic, but allow reconn?
        
        //self.leaveAllGames(socket, user);
      }
    }
  };

  self.namespaceName = options.name;
  var namespace = SocketManager.instance.createNamespace(options);
  var ioInstance = SocketManager.instance.getServerInstance();

  namespace.addHandler({
    key: GameSchema.joinGame,
    isAuthorized: true,
    fn: function (socket, user, data) {
      var gameId = data.gameId;
      var game = self.joinGame(gameId, user);

      // #TODO handle when the game got closed / returned false somehow

      socket.join(game.id);

      console.log("Joined a game, emitting back: ", game);
      socket.emit(GameSchema.joinGame, game);
      ioInstance.of(options.name).emit(GameSchema.userJoined, game);
    }
  });

  namespace.addHandler({
    key: GameSchema.leftGame,
    isAuthorized: true,
    fn: function (socket, user, data) {
      var gameId = data.gameId;
      var game = self.leaveGame(gameId, user);


      // #TODO handle when the game got closed / returned false somehow

      // tell everyone we left
      socket.to(game.id).emit(GameSchema.userLeft, game);
      socket.leave(game.id);

      console.log("Left a game, emitting back: ", game);
      socket.emit(GameSchema.leftGame, game);
    }
  });

  namespace.addHandler({
    key: GameSchema.startGame,
    isAuthorized: true,
    fn: function (socket, user, data) {
      var gameId = data.gameId;
      var game = self.getGameForMember(gameId, user.id);

      if (!game) {
        socket.emit(AccountSchema.notAuthorized, { 
          action: "startGame", 
          message: "Cannot start a game you are not a member and host of."
        });

        return;
      }

      if (game.hostId !== user.id) {
        socket.emit(AccountSchema.notAuthorized, {
          action: "startGame",
          message: "Cannot start a game if you are not the host"
        });

        return;
      }


      // tell everyone the game is starting
      socket.to(game.id).emit(GameSchema.gameStarted, game);

      console.log("Left a game, emitting back: ", game);
      socket.emit(GameSchema.leftGame, game);
    }
  });

  namespace.addHandler({
    key: GameSchema.userReady,
    isAuthorized: true,
    fn: function (socket, user, data) {

    }
  }

  return namespace;
};

GameManager.prototype.leaveAllGames = function (socket, member) {
  var memberId = member.id;
  var ioInstance = SocketManager.instance.getServerInstance();
  var self = this;

  _.each(this.list, function (game) {
    var removedGame = _.remove(game.members, function (removeMember) {
      return removeMember.id === memberId;
    });

    if (game.hostId === memberId) {
      game.hostId = null;
    }

    if (removedGame.length) {
      socket.leave(game.id);
      socket.emit(GameSchema.leftGame, game);
      ioInstance.of(self.namespaceName).emit(GameSchema.userLeft, game);
    }
  });
};

GameManager.prototype.findGame = function (gameId) {
  return _.find(this.list, { id: gameId });
};

GameManager.prototype.readGameList = function () {
  return _.values(this.list);
};

GameManager.prototype.startGame = function (gameId) {
  var game = this.findGame(gameId);

  if (game) {
    if (game.members.length < game.minPlayerCount) {
      throw new Error("StartGame: minimum player amount not reached");
    }

    return GameSchema.startGame;
  }
};


// Quick check to make sure a member exists in a game
GameManager.prototype.getGameForMember = function (gameId, memberId) {
  var game = this.findGame(gameId);

  return _.find(game.members, function (gameMember) {
    return gameMember.id === memberId;
  });
};

GameManager.prototype.joinGame = function (gameId, member) {
  var game = this.findGame(gameId);
  var memberInGame = game && _.find(game.members, { id: member.id });

  if (game && !memberInGame) {
    if (game && (game.members.length + 1) > game.maxPlayerCount) {
      console.warn("*** Tried to join a game with max players.");
      return false;
    }

    if (!game.hostId && game.members.length === 0) {
      console.log("Member is claming the host slot:", member.id);
      game.hostId = member.id;
    }

    game.members.push(member);
    return game;
  } else {
    return false;
  }
};

GameManager.prototype.leaveGame = function (gameId, memberId) {
  var game = _.find(this.list, { id: gameId });

  if (game) {
    _.remove(game.members, function (member) {
      return member.id === memberId;
    });

    if (game.hostId == member.id || game.members.length === 0) {
      console.log("Removing game's host because they left: ", game.hostId);
      game.hostId = null;
    }

    return true;
  } else {
    return false;
  }
};

// todo: change options (name, player counter, ect)

// todo: perms, owners, kicking, ect

// todo: picking teams?

GameManager.prototype.createGame = function (game) {
  // TODO: do some error checking and stuff
  this.games[game.id] = game;
  return game;
};

module.exports = new GameManager();
