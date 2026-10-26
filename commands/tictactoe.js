/**
 * tictactoe.js — Play Tic Tac Toe with another server member.
 *
 * Fixes:
 *  - Winner check was evaluated correctly but the draw check ran even when
 *    a winner existed (both ran, winner cleaned up activeGames twice).
 *    The draw branch now has an explicit return to prevent this.
 *  - `gameCollector.on("end")` ran unconditionally after a win/draw, trying
 *    to disable buttons on an already-updated message. Now guarded with a
 *    `gameOver` flag so the "end" handler only fires on timeout.
 *  - Both player draw points showed as "0" in the message but the DB
 *    stores -1. The message now reflects the actual delta.
 *  - activeGames cleanup was missing from the timeout path inside the
 *    "end" handler when a game was already finished.
 */

const { SlashCommandBuilder } = require("@discordjs/builders");
const { MessageActionRow, MessageButton } = require("discord.js");
const Profile = require("../schemas/Profile");

// Tracks in-progress games: userId → opponentId (both directions)
const activeGames = new Map();

// User IDs who cannot be challenged
const INELIGIBLE_IDS = new Set(["295289522265260032", "263238337358331904"]);

module.exports = {
  data: new SlashCommandBuilder()
    .setName("game")
    .setDescription("Play games with friends!")
    .addSubcommand((sub) =>
      sub
        .setName("tictactoe")
        .setDescription("Play Tic Tac Toe with someone.")
        .addUserOption((opt) =>
          opt.setName("opponent").setDescription("Your opponent.").setRequired(true)
        )
    ),

  async execute(interaction) {
    if (interaction.options.getSubcommand() !== "tictactoe") return;

    const player1 = interaction.user;
    const player2 = interaction.options.getUser("opponent");

    // ── Eligibility checks ────────────────────────────────────────────────
    if (INELIGIBLE_IDS.has(player2.id)) {
      return interaction.reply({ content: "You can't challenge that user.", ephemeral: true });
    }
    if (player2.bot || player1.id === player2.id) {
      return interaction.reply({ content: "❌ Invalid opponent.", ephemeral: true });
    }
    if (
      activeGames.has(player1.id) || activeGames.has(player2.id) ||
      [...activeGames.values()].includes(player1.id) ||
      [...activeGames.values()].includes(player2.id)
    ) {
      return interaction.reply({
        content: "⚠️ One of you is already in a game. Finish it first!",
        ephemeral: true,
      });
    }

    // ── Challenge phase ───────────────────────────────────────────────────
    activeGames.set(player1.id, player2.id);
    activeGames.set(player2.id, player1.id);

    const acceptRow = new MessageActionRow().addComponents(
      new MessageButton().setCustomId("accept_ttt").setLabel("Accept Challenge").setStyle("SUCCESS")
    );

    let challengeMsg;
    try {
      challengeMsg = await interaction.reply({
        content: `${player2}, you've been challenged to Tic Tac Toe by ${player1}! You have **60 seconds** to accept.`,
        components: [acceptRow],
        fetchReply: true,
      });
    } catch {
      activeGames.delete(player1.id);
      activeGames.delete(player2.id);
      return;
    }

    // Countdown updater
    let timeLeft = 60;
    const countdown = setInterval(async () => {
      timeLeft -= 10;
      if (timeLeft <= 0) { clearInterval(countdown); return; }
      try {
        await challengeMsg.edit({
          content: `${player2}, you've been challenged to Tic Tac Toe by ${player1}! You have **${timeLeft} seconds** to accept.`,
          components: [acceptRow],
        });
      } catch { clearInterval(countdown); }
    }, 10_000);

    const challengeCollector = challengeMsg.createMessageComponentCollector({
      filter: (i) => i.customId === "accept_ttt" && i.user.id === player2.id,
      time: 60_000,
      max: 1,
    });

    challengeCollector.on("end", async (collected) => {
      clearInterval(countdown);

      if (collected.size === 0) {
        activeGames.delete(player1.id);
        activeGames.delete(player2.id);
        try {
          await challengeMsg.edit({ content: "⏰ Challenge expired — game not accepted.", components: [] });
        } catch {}
        return;
      }

      // ── Game phase ──────────────────────────────────────────────────────
      const board   = Array.from({ length: 3 }, () => Array(3).fill(null));
      const symbols = { [player1.id]: "❌", [player2.id]: "⭕" };
      let current   = player1;
      let moves     = 0;
      let gameOver  = false;

      const renderBoard = () =>
        board.map((row, r) =>
          new MessageActionRow().addComponents(
            row.map((cell, c) =>
              new MessageButton()
                .setCustomId(`ttt_${r}_${c}`)
                .setLabel(cell ?? "⬜")
                .setStyle("SECONDARY")
                .setDisabled(cell !== null || gameOver)
            )
          )
        );

      const turnText = () =>
        `🎮 **Tic Tac Toe** — ${player1.username} ❌ vs ${player2.username} ⭕\nIt's **${current.username}**'s turn (${symbols[current.id]})`;

      try {
        await challengeMsg.edit({ content: turnText(), components: renderBoard() });
      } catch {
        cleanup();
        return;
      }

      const gameCollector = challengeMsg.createMessageComponentCollector({
        filter: (i) =>
          [player1.id, player2.id].includes(i.user.id) &&
          i.customId.startsWith("ttt_"),
        time: 5 * 60_000,
      });

      gameCollector.on("collect", async (i) => {
        if (i.user.id !== current.id) {
          return i.reply({ content: "⏳ It's not your turn!", ephemeral: true });
        }

        const [, r, c] = i.customId.split("_").map(Number);
        if (board[r][c]) return i.deferUpdate();

        board[r][c] = symbols[current.id];
        moves++;

        if (checkWinner(board)) {
          gameOver = true;
          gameCollector.stop("winner");

          const loser       = current.id === player1.id ? player2 : player1;
          const winDelta    = await updateStats(current, interaction.guild, "win", moves);
          const loseDelta   = await updateStats(loser,   interaction.guild, "lose");

          try {
            await i.update({
              content:
                `🎉 **${current.username}** (${symbols[current.id]}) wins after ${moves} moves!\n` +
                `<@${current.id}>: **+${winDelta}** pts | <@${loser.id}>: **${loseDelta}** pts`,
              components: renderBoard(),
            });
          } catch {}
          cleanup();
          return;
        }

        const isDraw = board.flat().every((cell) => cell !== null);
        if (isDraw) {
          gameOver = true;
          gameCollector.stop("draw");

          const d1 = await updateStats(player1, interaction.guild, "draw");
          const d2 = await updateStats(player2, interaction.guild, "draw");

          try {
            await i.update({
              content:
                `🤝 It's a draw!\n` +
                `<@${player1.id}>: **${d1}** pts | <@${player2.id}>: **${d2}** pts`,
              components: renderBoard(),
            });
          } catch {}
          cleanup();
          return;
        }

        // Switch turn
        current = current.id === player1.id ? player2 : player1;
        try {
          await i.update({ content: turnText(), components: renderBoard() });
        } catch {}
      });

      gameCollector.on("end", async (_, reason) => {
        if (reason === "winner" || reason === "draw") return; // Already handled
        // Timed out
        cleanup();
        try {
          gameOver = true;
          await challengeMsg.edit({
            content: `⏰ Game timed out — no moves made in 5 minutes.`,
            components: renderBoard(),
          });
        } catch {}
      });

      function cleanup() {
        activeGames.delete(player1.id);
        activeGames.delete(player2.id);
      }
    });
  },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function checkWinner(b) {
  for (let i = 0; i < 3; i++) {
    if (b[i][0] && b[i][0] === b[i][1] && b[i][1] === b[i][2]) return true;
    if (b[0][i] && b[0][i] === b[1][i] && b[1][i] === b[2][i]) return true;
  }
  return (
    (b[0][0] && b[0][0] === b[1][1] && b[1][1] === b[2][2]) ||
    (b[0][2] && b[0][2] === b[1][1] && b[1][1] === b[2][0])
  );
}

async function updateStats(user, guild, result, moves = 0) {
  const query   = { UserID: user.id, GuildID: guild.id };
  let profile   = await Profile.findOne(query);

  if (!profile) {
    profile = new Profile({
      Username: user.username, UserID: user.id, GuildID: guild.id,
      Points: 0, DateJoined: new Date(), Hidden: false,
      TicTacToe: { GamesPlayed: 0, GamesWon: 0, GamesLost: 0, GamesDrawn: 0, FastestWin: null },
    });
  }

  const stats = profile.TicTacToe;
  stats.GamesPlayed++;
  let delta = 0;

  if (result === "win") {
    stats.GamesWon++;
    delta = Math.max(10, 40 - moves * 5);
    profile.Points += delta;
    if (!stats.FastestWin || moves < stats.FastestWin) stats.FastestWin = moves;
  } else if (result === "lose") {
    stats.GamesLost++;
    delta = -5;
    profile.Points = Math.max(0, profile.Points + delta);
  } else if (result === "draw") {
    stats.GamesDrawn++;
    delta = -1;
    profile.Points = Math.max(0, profile.Points + delta);
  }

  await profile.save();
  return delta;
}
