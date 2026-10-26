const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const game = require('../utilities/gameEngines');
const { reserveSession } = require('../utilities/gameSessions');
const { render } = require('../commands/tictactoe');
test('Tic Tac Toe recognizes a win and rejects occupied, invalid and out-of-turn moves', () => {
  const state = game.createTicTacToe();
  game.playTicTacToe(state, 0, 0);
  assert.throws(() => game.playTicTacToe(state, 0, 1));
  assert.throws(() => game.playTicTacToe(state, 20, 1));
  assert.throws(() => game.playTicTacToe(state, 2, 0));
  for (const index of [3,1,4,2]) game.playTicTacToe(state, index, state.turn);
  assert.equal(state.winner, 0); assert.equal(state.over, true);
});
test('solo Tic Tac Toe bot always chooses legal moves and blocks immediate threats', () => {
  const state = game.createTicTacToe(); state.board = [0,0,null,null,1,null,null,null,null]; state.turn = 1; state.moves = 3;
  assert.equal(game.botSquare(state), 2);
  for (let n = 0; n < 100; n++) {
    const board = game.createTicTacToe();
    while (!board.over) {
      const empty = board.board.flatMap((value, index) => value == null ? [index] : []);
      game.playTicTacToe(board, empty[n % empty.length], 0);
      if (!board.over) game.playTicTacToe(board, game.botSquare(board), 1);
    }
    assert.ok(board.moves <= 9);
  }
});
test('Connect Four detects horizontal, vertical and diagonal wins', () => {
  for (const moves of [[0,0,1,1,2,2,3], [0,1,0,1,0,1,0]]) {
    const state = game.createConnectFour();
    for (const column of moves) game.playConnectFour(state, column, state.turn);
    assert.equal(state.winner, 0); assert.equal(state.over, true);
  }
  const state = game.createConnectFour();
  state.board[5][0] = state.board[4][1] = state.board[3][2] = 0;
  state.board[5][3] = state.board[4][3] = state.board[3][3] = 1;
  game.playConnectFour(state, 3, 0); assert.equal(state.winner, 0);
});
test('Connect Four enforces full columns and gravity', () => {
  const state = game.createConnectFour();
  for (let n = 0; n < 6; n++) game.playConnectFour(state, 0, state.turn);
  assert.throws(() => game.playConnectFour(state, 0, state.turn), /full/);
  game.playConnectFour(state, 1, state.turn); assert.notEqual(state.board[5][1], null);
});
test('number guessing allows a fifth-guess win and rejects repeated guesses', () => {
  const state = game.createGuess(10);
  game.playGuess(state, 1); assert.match(state.note, /too low/);
  assert.throws(() => game.playGuess(state, 1)); assert.equal(state.attempts, 4);
  for (const guess of [20,11,9,10]) game.playGuess(state, guess);
  assert.equal(state.winner, 0); assert.equal(state.over, true);
  const lost = game.createGuess(20); for (const n of [1,2,3,4,5]) game.playGuess(lost, n);
  assert.equal(lost.over, true); assert.equal(lost.winner, null); assert.match(lost.note, /20/);
});
test('rock paper scissors correctly evaluates all nine move combinations', () => {
  let wins = 0, losses = 0, draws = 0;
  for (const a of ['rock','paper','scissors']) for (const b of ['rock','paper','scissors']) {
    const result = game.rockPaperScissors(a, b).result;
    if (result === 'win') wins++; else if (result === 'lose') losses++; else draws++;
  }
  assert.deepEqual([wins,losses,draws], [3,3,3]);
});
test('co-op dungeon shares health, guard and potions and requires alternating turns', () => {
  const state = game.createDungeon(), roll = min => min;
  assert.throws(() => game.playDungeon(state, 'attack', 1));
  assert.throws(() => game.playDungeon(state, 'heal', 0), /full/);
  game.playDungeon(state, 'guard', 0, roll);
  game.playDungeon(state, 'attack', 1, roll);
  assert.equal(state.hp, 23); assert.equal(state.shield, 0);
  game.playDungeon(state, 'heal', 0, roll); assert.equal(state.hp, 24); assert.equal(state.potions, 1);
  while (!state.over) game.playDungeon(state, 'attack', state.turn, roll);
  assert.equal(state.winner, 'party');
});
test('co-op dungeon cannot stall forever by guarding', () => {
  const state = game.createDungeon();
  while (!state.over) game.playDungeon(state, 'guard', state.turn, min => min);
  assert.equal(state.round, 13); assert.equal(state.winner, null);
});
test('all game boards serialize valid Discord components without exposing the guess secret', () => {
  const users = [{ id: 'one', username: 'Alice' }, { id: 'two', username: 'Bob' }];
  for (const state of [game.createTicTacToe(), game.createConnectFour(), game.createGuess(11), game.createDungeon()]) {
    const payload = render(state, users, false);
    const json = { embeds: payload.embeds.map(e => e.toJSON()), components: payload.components.map(c => c.toJSON()) };
    assert.ok(json.components.length <= 5);
    if (state.kind === 'guess') assert.doesNotMatch(json.embeds[0].description, /11/);
  }
});
test('sessions are isolated per server, bounded globally and released idempotently', () => {
  const first = reserveSession('one', [{ id: 'player' }]); assert.ok(first);
  assert.equal(reserveSession('one', [{ id: 'player' }]), null);
  const other = reserveSession('two', [{ id: 'player' }]); assert.ok(other);
  const rest = Array.from({ length: 18 }, (_, n) => reserveSession('one', [{ id: `user${n}` }]));
  assert.equal(reserveSession('third', [{ id: 'overflow' }]), null);
  first(); first(); other(); rest.forEach(release => release());
  const next = reserveSession('one', [{ id: 'player' }]); assert.ok(next); next();
});
after(() => require('../utilities/client').destroy());
