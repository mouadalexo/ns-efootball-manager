const { PermissionFlagsBits } = require('discord.js');

function isManager(member) {
  return (
    member.permissions.has(PermissionFlagsBits.ManageGuild) ||
    member.permissions.has(PermissionFlagsBits.Administrator) ||
    member.roles.cache.some(r =>
      r.name.toLowerCase().includes('manager') ||
      r.name.toLowerCase().includes('admin') ||
      r.name.toLowerCase().includes('tournament')
    )
  );
}

function requireManager(interaction) {
  if (!isManager(interaction.member)) {
    return false;
  }
  return true;
}

module.exports = { isManager, requireManager };
