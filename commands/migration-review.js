const { SlashCommandBuilder, PermissionsBitField } = require('discord.js');
const mongoose = require('mongoose');
const Review = require('../schemas/importReview');
const { sourceIdentityQuery, mappings } = require('../utilities/legacyMigration');
module.exports = {
  data: new SlashCommandBuilder().setName('migration-review').setDescription('Review legacy duplicates preserved during the upgrade (read only).')
    .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator)
    .addIntegerOption(o => o.setName('page').setDescription('Page of import warnings.').setMinValue(1).setMaxValue(10000))
    .addUserOption(o => o.setName('user').setDescription('Only show records for this user.')),
  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const query = { GuildID: interaction.guild.id };
    const user = interaction.options.getUser('user');
    if (user) query['Identity.UserID'] = user.id;
    const page = interaction.options.getInteger('page') || 1;
    const reviews = await Review.find(query).sort({ Source: 1, IdentityKey: 1 }).skip((page - 1) * 3).limit(3).lean();
    if (!reviews.length) return interaction.editReply('No legacy import warnings on this page.');
    const sections = [];
    for (const review of reviews) {
      if (!mappings.some(([source]) => source === review.Source)) continue;
      const source = mongoose.connection.collection(review.Source);
      let cursor;
      if (review.Kind === 'duplicate') cursor = source.find(sourceIdentityQuery(review.Identity), { maxTimeMS: 10_000 });
      else {
        const { ObjectId } = mongoose.Types;
        if (!ObjectId.isValid(review.FirstRecordId)) continue;
        cursor = source.find({ _id: new ObjectId(review.FirstRecordId) }, { maxTimeMS: 10_000 });
      }
      const candidates = await cursor.sort({ $natural: 1 }).limit(5).project({ _id: 1, Credits: 1, Blocked: 1, ShipStr: 1, Date: 1 }).toArray();
      sections.push(`**${review.Source}** · ${review.Kind} · ${review.RecordCount} original record(s)\nIdentity: ${Object.entries(review.Identity).filter(([key]) => key !== 'GuildID').map(([key, value]) => `${key}=${value}`).join(', ') || '(missing identifier)'}\nFirst source record: ${review.FirstRecordId}\n` +
        candidates.map(row => `• ${row._id}${row.Credits != null ? `: credits=${row.Credits}, blocked=${Boolean(row.Blocked)}` : row.ShipStr != null ? `: strength=${row.ShipStr}` : ''}`).join('\n'));
    }
    return interaction.editReply({ content: (`**Legacy import review — page ${page}**\nOriginal records were retained. The import used the first legacy record; balances were not added together and already imported guild records were not overwritten.\n\n${sections.join('\n\n')}\n\nCompare your backup before correcting an active balance with /manage-mod credits. This command does not change records.`).slice(0, 1950), allowedMentions: { parse: [] } });
  },
};
