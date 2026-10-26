const { randomInt } = require('node:crypto');
const lines = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
function ticWinner(board) { for (const [a,b,c] of lines) if (board[a] != null && board[a] === board[b] && board[b] === board[c]) return board[a]; return null; }
function createTicTacToe() { return { kind: 'tictactoe', board: Array(9).fill(null), turn: 0, moves: 0, over: false, winner: null }; }
function playTicTacToe(state, index, player) {
  if (state.over || player !== state.turn || !Number.isInteger(index) || index < 0 || index > 8 || state.board[index] != null) throw new Error('Choose an empty square on your turn.');
  state.board[index] = player; state.moves++;
  state.winner = ticWinner(state.board);
  state.over = state.winner != null || state.moves === 9;
  if (!state.over) state.turn = 1 - state.turn;
}
function botSquare(state) {
  for (const player of [1, 0]) for (let index = 0; index < 9; index++) {
    if (state.board[index] != null) continue;
    const copy = state.board.slice(); copy[index] = player;
    if (ticWinner(copy) === player) return index;
  }
  return [4,0,2,6,8,1,3,5,7].find(index => state.board[index] == null);
}
function createConnectFour() { return { kind: 'connect-four', board: Array.from({ length: 6 }, () => Array(7).fill(null)), turn: 0, moves: 0, over: false, winner: null }; }
function playConnectFour(state, column, player) {
  if (state.over || player !== state.turn || !Number.isInteger(column) || column < 0 || column > 6) throw new Error('Choose a valid column on your turn.');
  let row = 5; while (row >= 0 && state.board[row][column] != null) row--;
  if (row < 0) throw new Error('That column is full. Choose another.');
  state.board[row][column] = player; state.moves++;
  for (const [dr, dc] of [[1,0],[0,1],[1,1],[1,-1]]) {
    let count = 1;
    for (const direction of [-1,1]) {
      let r = row + dr * direction, c = column + dc * direction;
      while (r >= 0 && r < 6 && c >= 0 && c < 7 && state.board[r][c] === player) { count++; r += dr * direction; c += dc * direction; }
    }
    if (count >= 4) state.winner = player;
  }
  state.over = state.winner != null || state.moves === 42;
  if (!state.over) state.turn = 1 - state.turn;
}
function createGuess(secret = randomInt(1, 21)) { return { kind: 'guess', secret, attempts: 5, tried: [], turn: 0, over: false, winner: null, note: 'Find the number from 1 to 20 in five guesses.' }; }
function playGuess(state, guess) {
  if (state.over || !Number.isInteger(guess) || guess < 1 || guess > 20 || state.tried.includes(guess)) throw new Error('Choose a number you have not tried (1–20).');
  state.tried.push(guess); state.attempts--;
  if (guess === state.secret) { state.over = true; state.winner = 0; state.note = `Correct! The number was ${state.secret}.`; }
  else if (!state.attempts) { state.over = true; state.note = `Out of guesses. The number was ${state.secret}.`; }
  else state.note = `${guess} is too ${guess < state.secret ? 'low' : 'high'}. ${state.attempts} guesses left.`;
}
function createDungeon() { return { kind: 'dungeon', hp: 24, boss: 40, potions: 2, shield: 0, round: 1, turn: 0, moves: 0, over: false, winner: null, note: 'Take turns. Attack the boss, guard the party, or share a healing potion.' }; }
function playDungeon(state, action, player, roll = randomInt) {
  if (state.over || state.turn !== player || !['attack','guard','heal'].includes(action)) throw new Error('Choose an action on your turn.');
  if (action === 'heal' && (!state.potions || state.hp >= 24)) throw new Error(state.potions ? 'The party is already at full health.' : 'No healing potions remain.');
  if (action === 'attack') { const damage = roll(6, 11); state.boss = Math.max(0, state.boss - damage); state.note = `Attack dealt ${damage} damage.`; }
  if (action === 'guard') { state.shield += 4; state.note = 'The party gained 4 guard for the next boss attack.'; }
  if (action === 'heal') { state.hp = Math.min(24, state.hp + 10); state.potions--; state.note = 'A shared potion restored party health.'; }
  state.moves++;
  if (!state.boss) { state.over = true; state.winner = 'party'; state.note += ' The party defeated the boss!'; return; }
  if (player === 1) {
    const damage = Math.max(0, roll(5, 9) - state.shield);
    state.hp = Math.max(0, state.hp - damage); state.shield = 0; state.round++;
    state.note += ` Boss dealt ${damage} damage.`;
    if (!state.hp || state.round > 12) { state.over = true; state.note += state.hp ? ' The boss escaped after 12 rounds.' : ' The party was defeated.'; }
  }
  if (!state.over) state.turn = 1 - player;
}
function rockPaperScissors(choice, opponent = ['rock','paper','scissors'][randomInt(3)]) {
  if (!['rock','paper','scissors'].includes(choice)) throw new Error('Invalid choice');
  return { opponent, result: choice === opponent ? 'draw' : ({ rock: 'scissors', paper: 'rock', scissors: 'paper' }[choice] === opponent ? 'win' : 'lose') };
}
module.exports = { createTicTacToe, playTicTacToe, botSquare, ticWinner, createConnectFour, playConnectFour, createGuess, playGuess, createDungeon, playDungeon, rockPaperScissors };
