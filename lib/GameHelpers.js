var _ = require("lodash");

var gameOutputMask = function (game) {
  var gameState = game.gameInstance.getState();
  var newGame = _.omit(game, "gameInstance");
  newGame.state = gameState;

  return newGame;
};

module.exports.gameOutputMask = gameOutputMask;
