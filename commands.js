import { PermissionsBitField, SlashCommandBuilder } from 'discord.js';
import { useMainPlayer, useQueue, useTimeline } from 'discord-player';

function getCurrentTrack(queue) {
  return queue?.currentTrack || queue?.current || null;
}

function getUpcomingTracks(queue, amount = 10) {
  if (!queue?.tracks) return [];

  if (Array.isArray(queue.tracks)) {
    return queue.tracks.slice(0, amount);
  }

  if (typeof queue.tracks.slice === 'function') {
    return queue.tracks.slice(0, amount);
  }

  if (typeof queue.tracks.toArray === 'function') {
    return queue.tracks.toArray().slice(0, amount);
  }

  return [];
}

function trackName(track) {
  if (!track) return 'Cancion desconocida';
  const title = track.title || track.name || 'Cancion desconocida';
  const author = track.author ? ` - ${track.author}` : '';
  return `${title}${author}`;
}

async function requireVoiceChannel(interaction) {
  const voiceChannel = interaction.member?.voice?.channel;

  if (!voiceChannel) {
    await interaction.reply({
      content: '❌ Debes estar en un canal de voz para usar este comando.',
      ephemeral: true
    });
    return null;
  }

  const botMember = interaction.guild.members.me;

  if (botMember.voice.channel && botMember.voice.channel.id !== voiceChannel.id) {
    await interaction.reply({
      content: '❌ Ya estoy reproduciendo musica en otro canal de voz.',
      ephemeral: true
    });
    return null;
  }

  const permissions = voiceChannel.permissionsFor(botMember);

  if (!permissions?.has(PermissionsBitField.Flags.Connect)) {
    await interaction.reply({
      content: '❌ Necesito permiso para entrar a tu canal de voz.',
      ephemeral: true
    });
    return null;
  }

  if (!permissions?.has(PermissionsBitField.Flags.Speak)) {
    await interaction.reply({
      content: '❌ Necesito permiso para hablar en tu canal de voz.',
      ephemeral: true
    });
    return null;
  }

  return voiceChannel;
}

export const commands = [
  {
    data: new SlashCommandBuilder()
      .setName('play')
      .setDescription('Reproduce musica desde un link o busqueda.')
      .addStringOption((option) =>
        option
          .setName('cancion')
          .setDescription('Pega un link o escribe el nombre de la cancion.')
          .setRequired(true)
      ),

    async execute(interaction) {
      const voiceChannel = await requireVoiceChannel(interaction);
      if (!voiceChannel) return;

      const query = interaction.options.getString('cancion', true);
      const player = useMainPlayer();

      await interaction.deferReply();

      try {
        const result = await player.play(voiceChannel, query, {
          requestedBy: interaction.user,
          nodeOptions: {
            metadata: {
              channel: interaction.channel
            },
            leaveOnEnd: true,
            leaveOnStop: true,
            leaveOnEmpty: true,
            leaveOnEndCooldown: 15000,
            leaveOnStopCooldown: 5000,
            leaveOnEmptyCooldown: 300000,
            skipOnNoStream: true
          }
        });

        await interaction.editReply(`✅ Agregado a la cola: **${trackName(result.track)}**`);
      } catch (error) {
        console.error(error);
        await interaction.editReply('❌ No pude reproducir esa cancion o link. Prueba con otro link o nombre.');
      }
    }
  },
  {
    data: new SlashCommandBuilder()
      .setName('skip')
      .setDescription('Salta la cancion actual.'),

    async execute(interaction) {
      const queue = useQueue();

      if (!queue || !queue.isPlaying()) {
        return interaction.reply('❌ No hay musica reproduciendose.');
      }

      queue.node.skip();
      return interaction.reply('⏭️ Cancion saltada.');
    }
  },
  {
    data: new SlashCommandBuilder()
      .setName('pause')
      .setDescription('Pausa la musica actual.'),

    async execute(interaction) {
      const timeline = useTimeline();

      if (!timeline) {
        return interaction.reply('❌ No hay una sesion de musica activa.');
      }

      if (timeline.paused) {
        return interaction.reply('ℹ️ La musica ya esta pausada. Usa /resume para continuar.');
      }

      timeline.pause();
      return interaction.reply('⏸️ Musica pausada.');
    }
  },
  {
    data: new SlashCommandBuilder()
      .setName('resume')
      .setDescription('Reanuda la musica pausada.'),

    async execute(interaction) {
      const timeline = useTimeline();

      if (!timeline) {
        return interaction.reply('❌ No hay una sesion de musica activa.');
      }

      if (!timeline.paused) {
        return interaction.reply('ℹ️ La musica no esta pausada.');
      }

      timeline.resume();
      return interaction.reply('▶️ Musica reanudada.');
    }
  },
  {
    data: new SlashCommandBuilder()
      .setName('stop')
      .setDescription('Detiene la musica y limpia la cola.'),

    async execute(interaction) {
      const queue = useQueue();

      if (!queue) {
        return interaction.reply('❌ No hay musica activa.');
      }

      queue.delete();
      return interaction.reply('⏹️ Musica detenida y cola limpiada.');
    }
  },
  {
    data: new SlashCommandBuilder()
      .setName('queue')
      .setDescription('Muestra la cola de canciones.'),

    async execute(interaction) {
      const queue = useQueue();

      if (!queue) {
        return interaction.reply('❌ No hay una cola activa.');
      }

      const currentTrack = getCurrentTrack(queue);
      const upcomingTracks = getUpcomingTracks(queue, 10);

      const list = upcomingTracks.length
        ? upcomingTracks.map((track, index) => `${index + 1}. ${trackName(track)}`).join('\n')
        : 'No hay mas canciones en la cola.';

      return interaction.reply(`🎶 **Reproduciendo ahora:** ${trackName(currentTrack)}\n\n📜 **Cola:**\n${list}`);
    }
  },
  {
    data: new SlashCommandBuilder()
      .setName('nowplaying')
      .setDescription('Muestra la cancion actual.'),

    async execute(interaction) {
      const queue = useQueue();

      if (!queue) {
        return interaction.reply('❌ No hay una sesion de musica activa.');
      }

      const currentTrack = getCurrentTrack(queue);

      if (!currentTrack) {
        return interaction.reply('❌ No hay ninguna cancion reproduciendose.');
      }

      return interaction.reply(`🎧 Reproduciendo ahora: **${trackName(currentTrack)}**`);
    }
  }
];
