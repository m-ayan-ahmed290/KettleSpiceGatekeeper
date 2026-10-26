const Stats = require('../schemas/gameStats');
const Profile = require('../schemas/Profile');
async function recordGame(guildId, user, game, result, moves = 0) {
  const delta = result === 'win' ? 10 : result === 'draw' ? 2 : 0;
  const query = { GuildID: guildId, UserID: user.id, Game: game };
  try {
    await Stats.updateOne(query, { $setOnInsert: query, $set: { Username: user.username },
      $inc: { Played: 1, [result === 'win' ? 'Won' : result === 'draw' ? 'Drawn' : 'Lost']: 1, Points: delta } }, { upsert: true });
    if (game === 'tictactoe') {
      const points = result === 'win' ? Math.max(10, 40 - moves * 5) : result === 'draw' ? -1 : -5;
      const field = result === 'win' ? 'GamesWon' : result === 'draw' ? 'GamesDrawn' : 'GamesLost';
      const set = { Username: { $literal: user.username }, UserID: { $literal: user.id }, GuildID: { $literal: guildId },
        Points: { $max: [0, { $add: [{ $ifNull: ['$Points', 0] }, points] }] },
        DateJoined: { $ifNull: ['$DateJoined', new Date()] }, Hidden: { $ifNull: ['$Hidden', false] },
        'TicTacToe.GamesPlayed': { $add: [{ $ifNull: ['$TicTacToe.GamesPlayed', 0] }, 1] },
        [`TicTacToe.${field}`]: { $add: [{ $ifNull: [`$TicTacToe.${field}`, 0] }, 1] },
      };
      if (result === 'win') set['TicTacToe.FastestWin'] = { $cond: [{ $or: [{ $eq: [{ $ifNull: ['$TicTacToe.FastestWin', null] }, null] }, { $gt: ['$TicTacToe.FastestWin', moves] }] }, moves, '$TicTacToe.FastestWin'] };
      await Profile.updateOne({ GuildID: guildId, UserID: user.id }, [{ $set: set }], { upsert: true });
    }
    return true;
  } catch (error) { console.warn('[Game stats]', error.message); return false; }
}
module.exports = { recordGame };
