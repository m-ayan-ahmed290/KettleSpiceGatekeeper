const { ActionRowBuilder, ButtonBuilder, StringSelectMenuBuilder, EmbedBuilder } = require('discord.js');
const titles = { tictactoe: 'Tic Tac Toe', 'connect-four': 'Connect Four', guess: 'Number Guess', dungeon: 'Co-op Dungeon' };
const button = (id, label, disabled = false, style = 2) => new ButtonBuilder().setCustomId(`game:${id}`).setLabel(label).setStyle(style).setDisabled(disabled);
function render(state, players, soloBot, sessionId) {
  let board = '', components = [];
  if (state.kind === 'tictactoe') {
    for (let row = 0; row < 3; row++) components.push(new ActionRowBuilder().addComponents(Array.from({ length: 3 }, (_, col) => {
      const index = row * 3 + col;
      return button(String(index), state.board[index] == null ? '⬜' : state.board[index] === 0 ? '❌' : '⭕', state.over || state.board[index] != null);
    })));
  } else if (state.kind === 'connect-four') {
    board = state.board.map(row => row.map(cell => cell == null ? '⚪' : cell === 0 ? '🔴' : '🟡').join('')).join('\n') + '\n1️⃣2️⃣3️⃣4️⃣5️⃣6️⃣7️⃣';
    const buttons = Array.from({ length: 7 }, (_, col) => button(String(col), String(col + 1), state.over || state.board[0][col] != null));
    components = [new ActionRowBuilder().addComponents(buttons.slice(0, 4)), new ActionRowBuilder().addComponents(buttons.slice(4))];
  } else if (state.kind === 'guess') {
    components = [new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId('game:guess').setPlaceholder('Choose a number from 1 to 20').setDisabled(state.over)
      .addOptions(Array.from({ length: 20 }, (_, n) => ({ label: String(n + 1), value: String(n + 1) }))))];
    board = state.note;
  } else {
    board = `Party HP: **${state.hp}/24** · Boss HP: **${state.boss}/40**\nPotions: **${state.potions}** · Guard: **${state.shield}** · Round: **${Math.min(12, state.round)}/12**\n${state.note}`;
    components = [new ActionRowBuilder().addComponents(button('attack', 'Attack', state.over, 4), button('guard', 'Guard', state.over, 1), button('heal', 'Heal', state.over || !state.potions || state.hp === 24, 3))];
  }
  if (sessionId) {
    for (const row of components) for (const component of row.components)
      component.setCustomId(`game:${sessionId}:${component.data.custom_id.slice(5)}`);
    if (!state.over) components.push(new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`game:${sessionId}:cancel`).setLabel('End game').setStyle(2)));
  }
  const names = players.map(user => user.username).concat(soloBot ? ['Bot'] : []);
  let status;
  if (state.over) status = state.kind === 'dungeon' ? state.winner === 'party' ? '🎉 Team victory!' : 'The adventure is over.'
    : state.kind === 'guess' ? state.winner === 0 ? '🎉 You found it!' : 'Game over.' : state.winner == null ? '🤝 Draw!' : `🎉 ${names[state.winner]} wins!`;
  else status = `${names[state.turn]}'s turn`;
  const embed = new EmbedBuilder().setTitle(titles[state.kind]).setColor(0x5865f2).setDescription([names.join(' + '), board, status].filter(Boolean).join('\n\n'));
  return { content: '', embeds: [embed], components };
}
module.exports = { render, titles };
