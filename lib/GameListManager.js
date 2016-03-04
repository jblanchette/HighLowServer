var _ = require("lodash");

var AcccountManager = require("./AccountManager");
var SocketManager = require("./SocketManager");
var GameManager = require("./GameManager");

var GameListSchema = require("../schemas/GameList");
var AccountSchema = require("../schemas/Accounts");

var GameMachineFactory = require("./gameMachine/gameMachine");
var gameOutputMask = require("./GameHelpers").gameOutputMask;

function GameListManager() {
	var self = this;
	this.list = {};
	this.namespaceName = null;
}

GameListManager.prototype.setupNamespace = function () {
	var self = this;
	var options = {
		name: "gameList",
		onDisconnect: function (socket) {
			var user = AcccountManager.getUserBySocket(socket.id);

			if (user) {
				console.log("Leaving all games for user: ", user);

				self.leaveAllGames(socket, user);
			}
		}
	};

	self.namespaceName = options.name;
	var namespace = SocketManager.instance.createNamespace(options);
	var ioInstance = SocketManager.instance.getServerInstance();

	//
	// GAME LIST
	namespace.addHandler({
		key: GameListSchema.gameList,
		isAuthorized: true,
		fn: function (socket, user, data) {
			console.log("Running game list handler");
			socket.emit(GameListSchema.gameList, self.readGameList());
		}
	});

	//
	// JOIN GAME
	namespace.addHandler({
		key: GameListSchema.joinGame,
		isAuthorized: true,
		fn: function (socket, user, data) {
			var gameId = data.gameId;
			var game = self.joinGame(gameId, user);

	    // #TODO handle when the game got closed / returned false somehow

			socket.join(game.id);

			
			var gameMask = gameOutputMask(game);
			console.log("Joined a game, emitting back: ", gameMask);

			socket.emit(GameListSchema.joinGame, gameMask);
			ioInstance.of(options.name).emit(GameListSchema.userJoined, gameMask);
		}
	});

	//
	// LEFT GAME
	namespace.addHandler({
		key: GameListSchema.leftGame,
		isAuthorized: true,
		fn: function (socket, user, data) {
			var gameId = data.gameId;
			var game = self.leaveGame(gameId, user);


			// #TODO handle when the game got closed / returned false somehow

			// tell everyone we left
			var gameMask = gameOutputMask(game);

			socket.to(gameMask.id).emit(GameListSchema.userLeft, gameMask);
			socket.leave(gameMask.id);

			console.log("Left a game, emitting back: ", gameMask);
			socket.emit(GameListSchema.leftGame, gameMask);
		}
	});

	//
	// START GAME
	namespace.addHandler({
		key: GameListSchema.startGame,
		isAuthorized: true,
		fn: function (socket, user, data) {
			var gameId = data.gameId;
			var game = self.findGame(gameId);

			if (!game || game.hostId !== user.id) {
        socket.emit(AccountSchema.notAuthorized, {
          action: "startGame",
          message: "Cannot start game."
        });

        return;
      }

      // todo: more checks to see if we can actually start the game
      //       need to check game state ? maybe?

      if (game.gameInstance.getState() !== 0) {
      	console.log("*** Tried to start a game not in the startable state.");

      	socket.emit(AccountSchema.notAuthorized, {
          action: "startGame",
          message: "Cannot start game."
        });

      	return;
      }

			if (game.members.length < game.minPlayerCount) {
				console.log("StartGame: minimum player amount not reached");
				
				socket.emit(GameListSchema.roomMsg, {
					author: "Server",
          message: "Minimum player count not reached."
        });
				return;
			}

			var notReadyCheck = _.some(game.members, function (member) {
				return !member.ready && member.id !== game.hostId;
			});

			if (notReadyCheck) {
				console.log("Tried to start a game when not all ready");

				socket.emit(GameListSchema.roomMsg, {
					author: "Server",
					message: "Not all members ready to start."
				});

				return;
			}

			game.gameInstance.incrementGameState();
	      
	    // hand over the game to the GameManager
	    GameManager.createGame(game);
	    self.removeGame(game.id);

      var gameMask = gameOutputMask(game);

      socket.to(gameMask.id).emit(GameListSchema.gameStarted, gameMask);
      socket.emit(GameListSchema.gameStarted, gameMask);
		}
	});

	//
	// READY
  namespace.addHandler({
    key: GameListSchema.userReady,
    isAuthorized: true,
    fn: function (socket, user, data) {
      console.log("*** here in user ready");
      var gameId = data.gameId;
      var game = self.getGameForMember(gameId, user.id);

      if (!game) {

        console.log("didnt find game", data);
        socket.emit(AccountSchema.notAuthorized, { 
          action: "userReady", 
          message: "Cannot ready in a game you are not a member of."
        });

        return;
      }

      console.log("Setting member to ready", game.members);
      var gameMember = _.find(game.members, { id: user.id });
      gameMember.ready = true;

      var gameMask = gameOutputMask(game);
      console.log("Set ready list: ", gameMask);
      socket.to(gameMask.id).emit(GameListSchema.gameInfo, gameMask);
    }
  });

  //
	// BUSY
  namespace.addHandler({
    key: GameListSchema.userBusy,
    isAuthorized: true,
    fn: function (socket, user, data) {
      var gameId = data.gameId;
      var game = self.getGameForMember(gameId, user.id);

      if (!game) {
        socket.emit(AccountSchema.notAuthorized, { 
          action: "userBusy", 
          message: "Cannot busy in a game you are not a member of."
        });

        return;
      }

      console.log("Game members: ", game.members);
      var gameMember = _.find(game.members, { id: user.id });
      gameMember.ready = false;

      var gameMask = gameOutputMask(game);
      socket.to(gameMask.id).emit(GameListSchema.gameInfo, gameMask);
    }
  });

	return namespace;
};

GameListManager.prototype.leaveAllGames = function (socket, member) {
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
			socket.emit(GameListSchema.leftGame, game);
			ioInstance.of(self.namespaceName).emit(GameListSchema.userLeft, game);
		}
	});
};

GameListManager.prototype.findGame = function (gameId) {
	return _.find(this.list, { id: gameId });
};

// Quick check to make sure a member exists in a game
GameListManager.prototype.getGameForMember = function (gameId, memberId) {
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

GameListManager.prototype.readGameList = function () {
	return _.values(this.list);
};

GameListManager.prototype.joinGame = function (gameId, member) {
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

		// add a ready flag
		member.ready = false;
		game.members.push(member);
		return game;
	} else {
		return false;
	}
};

GameListManager.prototype.leaveGame = function (gameId, memberId) {
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


// **************************************************
// warning: this function does not signal to clients 
//          that we removed this game.
// **************************************************
GameListManager.prototype.removeGame = function (gameId) {
	if (_.has(this.list, gameId)) {
		delete this.list[gameId];
	}
};

GameListManager.prototype.createGame = function (options) {
	var game, id;
	options = options || {};

	id = _.uniqueId("HighLowGame-");
	game = {
		id: id,
		hostId: null,
		members: [],
		maxPlayerCount: options.maxPlayerCount || 4,
		minPlayerCount: options.minPlayerCount || 2,
		gameName: options.gameName || id
	};

	game.gameInstance = GameMachineFactory.create(game);

	if (options.gameName && _.isString(options.gameName)) {
		game.gameName = options.gameName;
	} else {
		game.gameName = game.id;
	}

	this.list[game.id] = game;
	return game;
};

module.exports = new GameListManager();
