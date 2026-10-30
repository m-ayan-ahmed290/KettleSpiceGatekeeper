const { SlashCommandBuilder } = require("discord.js");
const { ActionRowBuilder, ButtonBuilder } = require("discord.js");
const Profile = require("../schemas/Profile.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("profile")
    .setDescription("Manage your user profile")
    .addSubcommand((sub) =>
      sub
        .setName("view")
        .setDescription("View a user's profile")
        .addUserOption((opt) =>
          opt.setName("user").setDescription("User to view")
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("edit")
        .setDescription("Edit your profile settings")
        .addBooleanOption((opt) =>
          opt
            .setName("hidden")
            .setDescription("Hide your profile from others")
            .setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub.setName("delete").setDescription("Delete your profile")
    ),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const user = interaction.options.getUser("user") || interaction.user;
    const isSelf = user.id === interaction.user.id;
    const baseQuery = { UserID: user.id, GuildID: interaction.guild.id };

    // Helper to build the profile embed
    function buildProfileEmbed(profile, user) {
      const gamesPlayed = profile.TicTacToe?.GamesPlayed || 0;
      const gamesWon = profile.TicTacToe?.GamesWon || 0;
      const gamesLost = profile.TicTacToe?.GamesLost || 0;
      const gamesDrawn = profile.TicTacToe?.GamesDrawn || 0;
      const fastestWin = profile.TicTacToe?.FastestWin ?? "N/A";
      const winRate =
        gamesPlayed > 0
          ? ((gamesWon / gamesPlayed) * 100).toFixed(2) + "%"
          : "N/A";

      return {
        title: `${user.username}'s Profile`,
        color: 0x3498db,
        thumbnail: { url: user.displayAvatarURL({}) },
        fields: [
          { name: "Points", value: `${profile.Points}`, inline: true },
          {
            name: "Date Joined",
            value: `${profile.DateJoined.toDateString()}`,
            inline: true,
          },
          {
            name: "Tic Tac Toe Stats",
            value: `Played: ${gamesPlayed}\nWon: ${gamesWon}\nLost: ${gamesLost}\nDrawn: ${gamesDrawn}\nWin Rate: ${winRate}\nFastest Win: ${fastestWin} moves`,
          },
        ],
        footer: {
          text: `Requested by ${interaction.user.username}`,
          icon_url: interaction.user.displayAvatarURL({}),
        },
        timestamp: new Date().toISOString(),
      };
    }

    if (sub === "view") {
      const profile = await Profile.findOne(baseQuery);
      if (!profile) {
        return interaction.reply({
          content: `${
            isSelf ? "You don't" : `${user.username} doesn't`
          } have a profile.`,
          ephemeral: true,
        });
      }
      if (!isSelf && profile.Hidden) {
        return interaction.reply({
          content: `This user's profile is hidden.`,
          ephemeral: true,
        });
      }

      const embed = buildProfileEmbed(profile, user);

      return interaction.reply({ embeds: [embed], ephemeral: profile.Hidden });
    }

    if (sub === "edit") {
      const hidden = interaction.options.getBoolean("hidden");
      let profile = await Profile.findOne(baseQuery);
      if (!profile) {
        // Create new profile if not found
        profile = new Profile({
          Username: user.username,
          UserID: user.id,
          GuildID: interaction.guild.id,
          Points: 0,
          DateJoined: new Date(),
          Hidden: hidden,
          TicTacToe: {
            GamesPlayed: 0,
            GamesWon: 0,
            GamesLost: 0,
            GamesDrawn: 0,
            FastestWin: null,
          },
        });
      } else {
        profile.Hidden = hidden;
      }
      await profile.save();
      return interaction.reply({
        content: `Profile visibility updated to ${
          hidden ? "hidden" : "visible"
        }.`,
        ephemeral: true,
      });
    }

    if (sub === "delete") {
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("confirm_delete_profile")
          .setLabel("Confirm Delete")
          .setStyle(4)
      );

      await interaction.reply({
        content:
          "Are you sure you want to delete your profile? This cannot be undone.",
        components: [row],
        ephemeral: true,
      });

      const msg = await interaction.fetchReply();
      const filter = (i) =>
        i.customId === "confirm_delete_profile";

      const collector = msg.createMessageComponentCollector({
        filter,
        time: 30_000,
      });

      let deleting = false;
      collector.on("collect", async (i) => {
        try {
          if (i.user.id !== interaction.user.id) return await i.reply({ content: "Only the profile owner can confirm deletion.", ephemeral: true });
          if (deleting) return await i.deferUpdate();
          deleting = true;
          await i.deferUpdate();
          collector.stop("confirmed");
          await Profile.findOneAndDelete(baseQuery);
          await i.editReply({ content: "Your profile has been deleted.", components: [] });
        } catch (error) {
          console.error("[Profile] Delete failed:", error);
          await i.editReply({ content: "Could not delete your profile. Try again later.", components: [] }).catch(() => {});
        }
      });

      collector.on("end", (_, reason) => {
        if (reason !== "confirmed") {
          interaction.editReply({
            content: "Profile deletion cancelled.",
            components: [],
          }).catch(() => {});
        }
      });
    }
  },
};
