const {
  EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle,
  StringSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle,
} = require('discord.js');
const { db } = require('../utils/database');
const { COLORS } = require('../utils/embeds');

function buildTeamListEmbed() {
  const teams = db.get('teams').sort((a, b) => {
    if (a.category !== b.category) return a.category.localeCompare(b.category);
    return a.name.localeCompare(b.name);
  });
  const players = db.get('players');

  const categories = { international: [], morocco: [], saudi: [], custom: [] };
  for (const t of teams) {
    const playerCount = players.filter(p => p.team_id === t.id).length;
    const cat = categories[t.category] || categories.custom;
    const playerLine = playerCount > 0 ? ` *(${playerCount}p)*` : '';
    cat.push(`${t.emoji} **${t.name}** \`${t.short_name}\`${playerLine}`);
  }

  const embed = new EmbedBuilder()
    .setColor(COLORS.primary)
    .setTitle('🏟️  NS eFootball — Team Database')
    .setDescription('All registered teams and their players.')
    .setTimestamp();

  if (categories.international.length) {
    // Split into chunks of 20 per field (Discord field limit)
    const chunks = chunkArray(categories.international, 20);
    chunks.forEach((chunk, i) => {
      embed.addFields({ name: i === 0 ? '🌍 International Clubs' : '🌍 International (cont.)', value: chunk.join('\n'), inline: false });
    });
  }
  if (categories.morocco.length) {
    embed.addFields({ name: '🇲🇦 Moroccan Clubs', value: categories.morocco.join('\n'), inline: false });
  }
  if (categories.saudi.length) {
    embed.addFields({ name: '🇸🇦 Saudi Clubs', value: categories.saudi.join('\n'), inline: false });
  }
  if (categories.custom.length) {
    embed.addFields({ name: '⚙️ Custom Teams', value: categories.custom.join('\n'), inline: false });
  }

  embed.setFooter({ text: `${teams.length} teams registered` });
  return embed;
}

function chunkArray(arr, size) {
  const chunks = [];
  for (let i = 0; i < arr.length; i += size) chunks.push(arr.slice(i, i + size));
  return chunks;
}

function buildTeamManageButtons() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('team_add_predefined').setLabel('Add from List').setStyle(ButtonStyle.Primary).setEmoji('📋'),
    new ButtonBuilder().setCustomId('team_add_custom').setLabel('Add Custom Team').setStyle(ButtonStyle.Secondary).setEmoji('➕'),
    new ButtonBuilder().setCustomId('team_add_player').setLabel('Add Player').setStyle(ButtonStyle.Success).setEmoji('👤'),
    new ButtonBuilder().setCustomId('team_remove').setLabel('Remove Team').setStyle(ButtonStyle.Danger).setEmoji('🗑️'),
  );
}

function buildTeamSelectMenu(placeholder = 'Select a team...', customId = 'team_select') {
  const teams = db.get('teams').sort((a, b) => a.name.localeCompare(b.name)).slice(0, 25);
  if (!teams.length) return null;
  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(customId)
      .setPlaceholder(placeholder)
      .addOptions(teams.map(t => ({
        label: t.name,
        value: String(t.id),
        emoji: t.emoji?.slice(0, 2) || '⚽',
        description: `${t.short_name} | ${t.category}`,
      })))
  );
}

function buildAddPlayerModal(teamId) {
  return new ModalBuilder()
    .setCustomId(`player_add_modal_${teamId}`)
    .setTitle('Add Player to Team')
    .addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('player_discord_id')
          .setLabel('Discord User ID or @mention')
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('e.g. 123456789012345678')
          .setRequired(true)
      )
    );
}

function buildCustomTeamModal() {
  return new ModalBuilder()
    .setCustomId('custom_team_modal')
    .setTitle('Add Custom Team')
    .addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder().setCustomId('team_name').setLabel('Team Name').setStyle(TextInputStyle.Short).setRequired(true)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder().setCustomId('team_short').setLabel('Short Name (3-4 letters)').setStyle(TextInputStyle.Short).setMaxLength(4).setRequired(true)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder().setCustomId('team_emoji').setLabel('Emoji (optional)').setStyle(TextInputStyle.Short).setRequired(false).setPlaceholder('⚽')
      ),
    );
}

module.exports = { buildTeamListEmbed, buildTeamManageButtons, buildTeamSelectMenu, buildAddPlayerModal, buildCustomTeamModal };
