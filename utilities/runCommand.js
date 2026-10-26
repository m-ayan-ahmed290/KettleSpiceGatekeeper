/** Acknowledge slow commands before Discord's three-second deadline. */
async function runCommand(command, interaction, delay = 1500) {
  const originalReply = interaction.reply;
  const originalDefer = interaction.deferReply;
  let pending;
  const defer = options => {
    if (pending) return pending;
    if (interaction.replied || interaction.deferred) return Promise.resolve();
    pending = originalDefer.call(interaction, options);
    return pending;
  };
  interaction.deferReply = defer;
  interaction.reply = async payload => {
    if (pending) await pending;
    if (interaction.deferred && !interaction.replied) {
      const options = typeof payload === "string" ? { content: payload } : { ...payload };
      delete options.ephemeral;
      delete options.fetchReply;
      return interaction.editReply(options);
    }
    return originalReply.call(interaction, payload);
  };
  const privateCommands = new Set(["migration-review", "setup", "remind", "purge", "slowmode", "profile", "birthday", "block-words", "credits", "edit-ship", "manage-mod", "redeem", "roles-management", "warn", "help"]);
  const timer = setTimeout(() => {
    defer({ ephemeral: privateCommands.has(command.data.name) }).catch(error => console.warn("[Command acknowledgement]", error.message));
  }, delay);
  try { return await command.execute(interaction); }
  finally {
    clearTimeout(timer);
    if (pending) await pending.catch(() => {});
    interaction.reply = originalReply;
    interaction.deferReply = originalDefer;
  }
}
module.exports = { runCommand };
