require('dotenv').config();
const { registerCommands } = require('./lib/registerCommands');

registerCommands().catch(error => {
  console.error('❌ Error registrando comandos:', error);
  process.exit(1);
});
