# Games

All games run through `/game`. They use buttons or menus with no image generation, audio processing or game API dependency.

| Command | Mode | Rules |
| --- | --- | --- |
| `/game tictactoe` | Solo | Play as X against a bot that takes wins, blocks threats and chooses useful squares. |
| `/game tictactoe opponent:@Friend` | Versus | Standard three-in-a-row. X goes first. |
| `/game guess` | Solo | Find an integer from 1 to 20 in five guesses; each wrong guess gives a higher/lower hint. A repeated guess does not consume an attempt. |
| `/game rps choice:rock` | Solo | One round of rock-paper-scissors against a random bot move. Paper and scissors are also available. |
| `/game connect-four opponent:@Friend` | Versus | Drop tokens into seven columns; four matching tokens in any direction wins. Full columns cannot be selected. |
| `/game dungeon partner:@Friend` | Co-op | Two players share health and two potions while taking turns against one boss. |
| `/game stats user:@Friend` | Statistics | Per-game statistics for this server. Omit the user to see your own. |

Challenges require acceptance within 60 seconds and can be declined. Only the selected players can act, turns are enforced, and moves are serialized to prevent double-click races. A player has at most one active interactive game per server. There are at most 20 interactive games across the bot; games end after 90 seconds without a move or five minutes total. Timeouts free slots without awarding game results.

## Dungeon strategy

The party starts with 24 HP, the boss with 40 HP, and there are two shared healing potions.

- **Attack:** deal 6–10 damage.
- **Guard:** add four shared guard for the next boss attack.
- **Heal:** consume a potion to recover up to ten shared HP; no healing at full HP.

After both players have moved, the boss deals 5–8 damage reduced by guard; guard then resets. Defeat the boss before the party loses all HP or the boss escapes after 12 rounds. Both players get the same result. Cooperation matters because potions, guard and health are shared.

## Scores and existing profiles

Arcade statistics award ten points per win, two per draw and none for a loss. Each game has separate Played/Won/Lost/Drawn/Points records under the current guild and user. They do not change moderator credits.

Tic Tac Toe also preserves the original profile scoring: wins add `max(10, 40 - moves * 5)`, losses subtract five, and draws subtract one, with a floor of zero. FastestWin remains the move count. Solo Tic Tac Toe contributes to these profile statistics too. Existing profile history is retained in the same collection; historical games are not retroactively reconstructed into the new arcade tables. Use `/profile view` for that older history.

Games work even if score persistence temporarily fails, and say when stats could not be saved. Live games/challenges are held in bounded memory and end when the process restarts; completed database statistics survive restarts.
