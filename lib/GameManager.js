var _ = require("lodash");
var SocketManager = require("./SocketManager");
var GameListSchema = require("../schemas/GameList");

function GameManager() {
	var self = this;
	this.list = {};
}

GameManager.prototype.setupNamespace = function () {
	var self = this;
	var namespace = SocketManager.instance.createNamespace({
		name: "gameList"
	});

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

			console.log("Joined a game, emitting back: ", game);
			socket.emit(GameListSchema.joinGame, game);
		}
	});

	return namespace;
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

		return GameListSchema.startGame;
	}
};

GameManager.prototype.joinGame = function (gameId, member) {
	var game = this.findGame(gameId);
	var memberInGame = game && _.find(game.members, { id: member.id });

	if (game && !memberInGame) {
		if (game && (game.members.length + 1) > game.maxPlayerCount) {
			throw new Error("JoinGame: reached max player count");
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

		return true;
	} else {
		return false;
	}
};

// todo: change options (name, player counter, ect)

// todo: perms, owners, kicking, ect

// todo: picking teams?

GameManager.prototype.createGame = function (options) {
	var game, id;
	options = options || {};

	id = _.uniqueId("HighLowGame-");
	game = {
		id: id,
		members: [],
		maxPlayerCount: options.maxPlayerCount || 4,
		minPlayerCount: options.minPlayerCount || 2,
		gameName: options.gameName || id
	};

	if (options.gameName && _.isString(options.gameName)) {
		game.gameName = options.gameName;
	} else {
		game.gameName = game.id;
	}

	this.list[game.id] = game;
	return game;
};

module.exports = new GameManager();
