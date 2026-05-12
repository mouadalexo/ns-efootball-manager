const { EmbedBuilder } = require('discord.js');

const COLORS = {
  primary: 0x2B2D31,
  success: 0x57F287,
  error: 0xED4245,
  warning: 0xFEE75C,
  info: 0x5865F2,
  gold: 0xF1C40F,
  purple: 0x9B59B6,
};

function successEmbed(title, description) {
  return new EmbedBuilder()
    .setColor(COLORS.success)
    .setTitle(`✅  ${title}`)
    .setDescription(description)
    .setTimestamp();
}

function errorEmbed(title, description) {
  return new EmbedBuilder()
    .setColor(COLORS.error)
    .setTitle(`❌  ${title}`)
    .setDescription(description)
    .setTimestamp();
}

function infoEmbed(title, description) {
  return new EmbedBuilder()
    .setColor(COLORS.info)
    .setTitle(title)
    .setDescription(description)
    .setTimestamp();
}

function primaryEmbed(title, description) {
  return new EmbedBuilder()
    .setColor(COLORS.primary)
    .setTitle(title)
    .setDescription(description || '')
    .setTimestamp();
}

function warningEmbed(title, description) {
  return new EmbedBuilder()
    .setColor(COLORS.warning)
    .setTitle(`⚠️  ${title}`)
    .setDescription(description)
    .setTimestamp();
}

module.exports = { successEmbed, errorEmbed, infoEmbed, primaryEmbed, warningEmbed, COLORS };
