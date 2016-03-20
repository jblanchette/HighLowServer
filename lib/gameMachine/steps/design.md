# Example exchange from pregame -> post
> Assumes 4 people are already connected to a gameList instance

## Start 

CLIENT - All clients ready, host hits "Start Game"

CLIENT - Sends "START_GAME"

SERVER - Tells game machine to 'execute' "start" step

SERVER - Result from "start" step sent to clients in "GAME_STEP" emit
containing a "start" step ref

CLIENT - Get notice that game has started, connect to #game server, update local ref

CLIENT - On connect, send server a "GAME_LOADED" message

SERVER - After all clients in a game have issued "GAME_LOADED", emit a "GAME_READY" event to clients of game

CLIENT - Once game is ready, client who's game turn it is starts by issuing a "GAME_STEP" command containing a "bet" step with card information

SERVER - Recieves a "GAME_STEP" command, runs "bet", tells client new "GAME_STEP" message with "bet" step ref.

CLIENT - Game instance host issues last "bet" step

SERVER - All bets for a game have been issued, execute the server game
step "roundStart"

CLIENT - Client who's turn it is recieves "roundStart" command, and issues a client command to play their first valid card.  Sends a "GAME_STEP" command
with step key "playCard"

SERVER - Recives a "playCard" step, executes the step in the game machine, emits a new "GAME_STEP" to clients with step key "cardPlayed"

CLIENT - Last player to play a single card for the round issues their "playCard" step to the server

SERVER - Recives the last "playCard" step, which notices its the last
player card, and executes its own step key "roundResults" with the
round winner.

## LOOP UNTILL LAST ROUND OF CARDS

CLIENT - Sends last "playCard" step for the last card round

SERVER - after executing its final "roundResults" step, it notices
and executes the "roundFinished" step, sends results to clients with a
"GAME_STEP" command with step key "roundFinished"

CLIENT - Display round points, update score references

## If there are more rounds to play...

CLIENT - Player whos turn it is to start next round is prompted to play a card

## If that was the last round...

SERVER - Notice after a "roundFinished" step that we've got a match winner,
execute the "GAME_STEP" command with step key "matchResults"

CLIENT - Show match score sheet.  End game, display rematch / quit options
