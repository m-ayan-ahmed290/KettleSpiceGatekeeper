/** Acknowledge slow commands before Discord's three-second deadline. */
async function runCommand(command, interaction, delay = 1500, responseNoticeMs = 30_000) {
  const originalReply = interaction.reply;
  const originalDefer = interaction.deferReply;
  const originalEdit = interaction.editReply;
  const originalFollowUp = interaction.followUp;
  let pending;
  let initialReplyStarted = false;
  const defer = options => {
    if (pending) return pending;
    if (interaction.replied || interaction.deferred) return Promise.resolve();
    pending = originalDefer.call(interaction, options);
    return pending;
  };
  interaction.deferReply = defer;
  // Edits/follow-ups must wait for an acknowledgement already in flight.
  // In particular an error follow-up must replace an unfinished thinking reply.
  interaction.editReply = async payload => {
    if (pending) await pending;
    return originalEdit.call(interaction, payload);
  };
  interaction.followUp = async payload => {
    if (pending) await pending;
    if (interaction.deferred && !interaction.replied) {
      const options = typeof payload === 'string' ? { content: payload } : { ...payload };
      delete options.ephemeral;
      delete options.fetchReply;
      return originalEdit.call(interaction, options);
    }
    return originalFollowUp.call(interaction, payload);
  };
  interaction.reply = async payload => {
    if (pending) await pending;
    if (interaction.deferred) {
      const options = typeof payload === "string" ? { content: payload } : { ...payload };
      delete options.ephemeral;
      delete options.fetchReply;
      return interaction.editReply(options);
    }
    // Discord sets replied=true only AFTER its REST callback returns. Do not
    // race a slow initial reply against the automatic defer timer in that gap.
    initialReplyStarted = true;
    clearTimeout(timer);
    return originalReply.call(interaction, payload);
  };
  const privateCommands = new Set(["migration-review", "setup", "remind", "purge", "slowmode", "profile", "birthday", "block-words", "credits", "edit-ship", "manage-mod", "redeem", "roles-management", "warn", "help"]);
  const timer = setTimeout(() => {
    if (initialReplyStarted) return;
    defer({ ephemeral: privateCommands.has(command.data.name) }).catch(error => console.warn("[Command acknowledgement]", error.message));
  }, delay);
  // Clear the Discord spinner even if an upstream service stalls. The operation
  // retains its concurrency slot and can still deliver its eventual result.
  const watchdog = setTimeout(() => {
    (async () => {
      if (pending) await pending;
      if (interaction.deferred && !interaction.replied)
        await interaction.editReply({ content: 'This command is taking longer than expected. It may still complete; check its result before repeating an action.' });
    })().catch(error => console.warn('[Command response watchdog]', error.message));
  }, responseNoticeMs);
  try {
    const result = await command.execute(interaction);
    if (interaction.deferred && !interaction.replied)
      await interaction.editReply({ content: 'The command finished without a result. Please check the options and try again.' });
    return result;
  }
  finally {
    clearTimeout(timer);
    clearTimeout(watchdog);
    if (pending) await pending.catch(() => {});
    interaction.reply = originalReply;
    interaction.deferReply = originalDefer;
    interaction.editReply = originalEdit;
    interaction.followUp = originalFollowUp;
  }
}
module.exports = { runCommand };
