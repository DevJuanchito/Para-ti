function formatDate(date) {
  if (!date) return 'Desconocido';
  return new Intl.DateTimeFormat('es-ES', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(date);
}

function replacePlaceholders(text, member) {
  if (!text) return text;

  const user = member.user;
  const guild = member.guild;
  const values = {
    '{user}': `<@${user.id}>`,
    '{user.mention}': `<@${user.id}>`,
    '{user.id}': user.id,
    '{user.username}': user.username,
    '{user.tag}': user.tag || user.username,
    '{server}': guild.name,
    '{server.id}': guild.id,
    '{memberCount}': String(guild.memberCount ?? '???'),
    '{createdAt}': formatDate(user.createdAt),
    '{joinedAt}': formatDate(member.joinedAt)
  };

  return Object.entries(values).reduce(
    (result, [key, value]) => result.split(key).join(value),
    text
  );
}

module.exports = { replacePlaceholders };
