var _ = require("lodash");

function cardDeck(options) {
  this.cardCount = options.cardCount;
  this.isShuffled = options.isShuffled;
  this.cards = createCardList();

  if (this.isShuffled) {
    this.shuffleDeck();
  }
}

cardDeck.prototype.shuffleDeck = function () {
  this.cards = _.shuffle(this.cards);
};

cardDeck.prototype.reset = function () { 

};

var cardSymbols = {
  "A": {
    "name": "Ace",
    "value": 14
  },
  "K": {
    "name": "King",
    "value": 13
  },
  "Q": {
    "name": "Queen",
    "value": 12
  },
  "J": {
    "name": "Jack",
    "value": 11
  }
};

var createCardList = function () {
  var cardList = [
    2,3,4,5,6,7,8,9,10,"J","Q","K","A"
  ];

  var suitList = {
    "Diamonds": "red",
    "Hearts": "red",
    "Spades": "black",
    "Clubs": "black"
  };

  var cards = _.transform(cardList, function (acc, card) {
    var cardName, cardValue;

    if (_.isString(card)) {
      var symbol = cardSymbols[card];
      cardName = symbol.name;
      cardValue = symbol.value;
    } else {
      cardName = card;
      cardValue = card;
    }

    _.each(suitList, function (suitColor, suitName) {
      acc.push({
        name: cardName,
        value: cardValue,
        suitName: suitName,
        suitColor: suitColor,
        holder: null,
        inPlay: false,
        winner: null
      });
    });

    return acc;
  }, []);
};
