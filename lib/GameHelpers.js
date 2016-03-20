var _ = require("lodash");

var gameOutputMask = function (game) {
  var gameState = game.gameInstance.getState();
  var chatMask = _.pick(game.chatInstance, ["id", "name"]);

  var newGame = _.omit(game, ["gameInstance"]);
  newGame.state = gameState;
  newGame.chatInstance = chatMask;

  return newGame;
};

module.exports.gameOutputMask = gameOutputMask;
