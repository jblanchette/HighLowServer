var _ = require("lodash");

var AcccountManager = require("./AccountManager");
var SocketManager = require("./SocketManager");
var gameOutputMask = require("./GameHelpers").gameOutputMask;

var GameSchema = require("../schemas/Game");
var AccountSchema = require("../schemas/Accounts");

function GameManager() {
  this.list = {};
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

      var gameMask = gameOutputMask(game);
      console.log("Joined a game, emitting back: ", gameMask);
      socket.emit(GameSchema.joinGame, gameMask);
      ioInstance.of(options.name).emit(GameSchema.userJoined, gameMask);
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
      var gameMask = gameOutputMask(game);
      socket.to(gameMask.id).emit(GameSchema.userLeft, gameMask);
      socket.leave(gameMask.id);

      console.log("Left a game, emitting back: ", gameMask);
      socket.emit(GameSchema.leftGame, gameMask);
    }
  });

  namespace.addHandler({
    key: GameSchema.kickMember,
    isAuthorized: true,
    fn: function (socket, user, data) {
      var gameId = data.gameId;
      var game = self.getGameForMember(gameId, user.id);

      if (!game ||
          data.kickMemberId === user.id ||
          game.hostId !== user.id ||
          !_.some(game.members, { id: data.kickMemberId })) {
        socket.emit(AccountSchema.notAuthorized, { 
          action: "kickMember", 
          message: "Cannot kick"
        });

        return;
      }

      game.members = _.filter(game.members, { id: data.kickMemberId });

      var gameMask = gameOutputMask(game);
      socket.to(gameMask.id).emit(GameSchema.gameInfo, gameMask);
    }
  });

  namespace.addHandler({
    key: GameSchema.gameStep,
    isAuthorized: true,
    fn: function (socket, user, data) {
      var gameId = data.gameId;
      var game = self.getGameForMember(gameId, user.id);

      if (!game) {
        socket.emit(AccountSchema.notAuthorized, { 
          action: "gameStep", 
          message: "Invalid game"
        });
      }

      var stepResult = game.gameInstance.executeStep(data);

      if (stepResult.error) {
        socket.emit(AccountSchema.notAuthorized, { 
          action: "gameStep", 
          message: stepResult.error
        });
      } else {
        var gameMask = gameOutputMask(game);
        socket.to(gameMask.id).emit(GameSchema.gameStep, {
          step: stepResult,
          game: gameMask
        });
      }
    }
  });

  // todo closeGame

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

// Quick check to make sure a member exists in a game
GameManager.prototype.getGameForMember = function (gameId, memberId) {
  var game = this.findGame(gameId);
  if (!game) {

    console.log("** No game for member: ", this.list);
    return;
  }

  if(_.find(game.members, { id: memberId })) {
    return game;
  }

  return null;
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
  console.log("*** adding a game mgr game: ", game);

  this.list[game.id] = game;
  return game;
};

module.exports = new GameManager();
