const mongoose = require('mongoose');

const embedConfigSchema = new mongoose.Schema(
  {
    enabled: { type: Boolean, default: false },
    channelId: { type: String, default: null },
    title: { type: String, default: null },
    description: { type: String, default: null },
    color: { type: String, default: '#ff77dd' },
    image: { type: String, default: null },
    thumbnail: { type: String, default: null },
    footer: { type: String, default: null }
  },
  { _id: false }
);

const guildConfigSchema = new mongoose.Schema(
  {
    guildId: { type: String, required: true, unique: true, index: true },
    welcome: { type: embedConfigSchema, default: () => ({}) },
    farewell: { type: embedConfigSchema, default: () => ({}) }
  },
  { timestamps: true }
);

module.exports = mongoose.model('GuildConfig', guildConfigSchema);
