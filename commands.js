import { SlashCommandBuilder } from 'discord.js';

export const slashCommands = [
  new SlashCommandBuilder()
    .setName('help')
    .setDescription('Muestra todos los comandos de JUANPLAY.'),

  new SlashCommandBuilder()
    .setName('juanplay')
    .setDescription('Reproduce musica por nombre o enlace de YouTube.')
    .addStringOption(option =>
      option
        .setName('busqueda')
        .setDescription('Nombre de la cancion o URL de YouTube')
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName('play')
    .setDescription('Reproduce una cancion o la agrega a la cola.')
    .addStringOption(option =>
      option
        .setName('busqueda')
        .setDescription('Nombre de la cancion o URL de YouTube')
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName('skip')
    .setDescription('Salta la cancion actual.'),

  new SlashCommandBuilder()
    .setName('stop')
    .setDescription('Detiene la musica, limpia la cola y saca al bot del canal.'),

  new SlashCommandBuilder()
    .setName('pause')
    .setDescription('Pausa la cancion actual.'),

  new SlashCommandBuilder()
    .setName('resume')
    .setDescription('Continua la cancion pausada.'),

  new SlashCommandBuilder()
    .setName('queue')
    .setDescription('Muestra la cola de canciones.'),

  new SlashCommandBuilder()
    .setName('nowplaying')
    .setDescription('Muestra la cancion que esta sonando ahora.'),

  new SlashCommandBuilder()
    .setName('leave')
    .setDescription('Saca a JUANPLAY del canal de voz.'),

  new SlashCommandBuilder()
    .setName('testvoz')
    .setDescription('Prueba si JUANPLAY puede conectarse a tu canal de voz.'),

  new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Prueba si el bot esta vivo.')
];

export const slashCommandData = slashCommands.map(command => command.toJSON());
