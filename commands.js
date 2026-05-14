import { SlashCommandBuilder } from 'discord.js';

export const slashCommands = [
  new SlashCommandBuilder()
    .setName('help')
    .setDescription('Muestra todos los comandos de JUANPLAY DEVJUANCHO.'),

  new SlashCommandBuilder()
    .setName('juanplay')
    .setDescription('Reproduce musica por nombre o link. Personalizado DEVJUANCHO.')
    .addStringOption(option =>
      option
        .setName('busqueda')
        .setDescription('Nombre, link de YouTube, Spotify, SoundCloud, Apple, Deezer o audio directo')
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName('play')
    .setDescription('Reproduce una cancion o la agrega a la cola.')
    .addStringOption(option =>
      option
        .setName('busqueda')
        .setDescription('Nombre o enlace de musica')
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName('buscar')
    .setDescription('Busca canciones por nombre y muestra resultados.')
    .addStringOption(option =>
      option
        .setName('busqueda')
        .setDescription('Nombre de la cancion')
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
    .setName('volume')
    .setDescription('Cambia el volumen de JUANPLAY.')
    .addIntegerOption(option =>
      option
        .setName('nivel')
        .setDescription('Volumen de 1 a 150')
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(150)
    ),

  new SlashCommandBuilder()
    .setName('plataformas')
    .setDescription('Muestra las plataformas soportadas.'),

  new SlashCommandBuilder()
    .setName('diagnostico')
    .setDescription('Revisa el estado del bot y variables importantes.'),

  new SlashCommandBuilder()
    .setName('creditos')
    .setDescription('Muestra los creditos DEVJUANCHO.'),

  new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Prueba si el bot esta vivo.')
];

export const slashCommandData = slashCommands.map(command => command.toJSON());
