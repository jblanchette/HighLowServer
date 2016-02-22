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

module.exports = {
  create: function (options) {
    return new gameMachine(options);
  }
};
