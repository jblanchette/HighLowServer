var _ = require("lodash");
var CardDeck = require("./cardDeck");

var gameStates = {
  "init": 0,
  "pregame": 1,
  "ingame": 2,
  "postgame": 3
};

function gameMachine (options) {
  this.state = gameStates.init;
  this.deck = CardDeck.create({
    cardCount: 52,
    isShuffled: true
  });
}

gameMachine.prototype.incrementGameState = function (state) {
  
  var maxState = _.max(_.values(gameStates));

  if ((this.state + 1) > maxState) {
    console.error("Tried to increment game state too far: ", this);

    return;
  }

  console.log("Incrementing game?", this);
  this.state += 1;
};

gameMachine.prototype.getState = function () {
  return this.state;
};

gameMachine.prototype.gameStep = function (type, data) {

};

module.exports = {
  create: function (options) {
    return new gameMachine(options);
  }
};
