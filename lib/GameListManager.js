var _ = require("lodash");
var AcccountManager = require("./AccountManager");
var SocketManager = require("./SocketManager");
var GameListSchema = require("../schemas/GameList");
var GameMachineFactory = require("./gameMachine/gameMachine");

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

	namespace.addHandler({
		key: GameListSchema.gameList,
		isAuthorized: true,
		fn: function (socket, user, data) {
			console.log("Running game list handler");
			socket.emit(GameListSchema.gameList, self.readGameList());
		}
	});

	namespace.addHandler({
		key: GameListSchema.joinGame,
		isAuthorized: true,
		fn: function (socket, user, data) {
			var gameId = data.gameId;
			var game = self.joinGame(gameId, user);

	    // #TODO handle when the game got closed / returned false somehow

			socket.join(game.id);

			console.log("Joined a game, emitting back: ", game);
			socket.emit(GameListSchema.joinGame, game);
			ioInstance.of(options.name).emit(GameListSchema.userJoined, game);
		}
	});

	namespace.addHandler({
		key: GameListSchema.leftGame,
		isAuthorized: true,
		fn: function (socket, user, data) {
			var gameId = data.gameId;
			var game = self.leaveGame(gameId, user);


			// #TODO handle when the game got closed / returned false somehow

			// tell everyone we left
			socket.to(game.id).emit(GameListSchema.userLeft, game);
			socket.leave(game.id);

			console.log("Left a game, emitting back: ", game);
			socket.emit(GameListSchema.leftGame, game);
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

GameListManager.prototype.readGameList = function () {
	return _.values(this.list);
};

GameListManager.prototype.startGame = function (gameId) {
	var game = this.findGame(gameId);

	if (game) {
		if (game.members.length < game.minPlayerCount) {
			throw new Error("StartGame: minimum player amount not reached");
		}

		return GameListSchema.startGame;
	}
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

GameListManager.prototype.createGame = function (options) {
	var game, id;
	options = options || {};

	id = _.uniqueId("HighLowGame-");
	game = {
		id: id,
		hostId: null,
		members: [],
		readyList: [],
		maxPlayerCount: options.maxPlayerCount || 4,
		minPlayerCount: options.minPlayerCount || 2,
		gameName: options.gameName || id
	};

	game.gameInstace = gameMachine.create(game);

	if (options.gameName && _.isString(options.gameName)) {
		game.gameName = options.gameName;
	} else {
		game.gameName = game.id;
	}

	this.list[game.id] = game;
	return game;
};

module.exports = new GameListManager();
