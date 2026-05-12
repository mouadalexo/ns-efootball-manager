const { ChannelType } = require('discord.js');
const { db } = require('./database');

// Hardcoded channel IDs provided by server owner
const CHANNEL_MAP = {
  NSEL: {
    teamList:      '1462982588661628938',
    results:       '1463162274192556072',
    matchSchedule: '1462982363267993672',
    category:      '1462982041703547023',
  },
  MCL: {
    category:      '1463153310943936532',
    // Channels resolved by name inside MCL category
    teamListName:      'team',
    resultsName:       'result',
    matchScheduleName: 'match',
  },
};

/**
 * Returns the Discord channel for a given template and type.
 * type: 'teamList' | 'results' | 'matchSchedule'
 */
async function getTargetChannel(guild, template, type) {
  const tmpl = template.toUpperCase();

  // First check DB config (set by /setup)
  const dbKey = `${tmpl}_${type}`;
  const storedId = db.getConfig(dbKey);
  if (storedId) {
    const ch = guild.channels.cache.get(storedId);
    if (ch) return ch;
  }

  const cfg = CHANNEL_MAP[tmpl];
  if (!cfg) return null;

  // NSEL: use hardcoded IDs
  if (tmpl === 'NSEL' && cfg[type]) {
    return guild.channels.cache.get(cfg[type]) || null;
  }

  // MCL (and others): search by keyword in category
  const nameKeywords = {
    teamList:      ['team', 'list', 'squad'],
    results:       ['result', 'score', 'résultat'],
    matchSchedule: ['match', 'schedule', 'fixture', 'calendrier'],
  };

  const keywords = nameKeywords[type] || [];
  const categoryId = cfg.category;

  if (!categoryId) return null;

  await guild.channels.fetch().catch(() => {});

  return guild.channels.cache.find(c =>
    c.parentId === categoryId &&
    c.type === ChannelType.GuildText &&
    keywords.some(kw => c.name.toLowerCase().includes(kw))
  ) || null;
}

module.exports = { getTargetChannel, CHANNEL_MAP };
