const mongoose = require('mongoose');

async function connectDatabase() {
  const mongoUrl = process.env.MONGO_URL || process.env.MONGODB_URI;

  if (!mongoUrl) {
    throw new Error('Falta MONGO_URL o MONGODB_URI en las variables de entorno.');
  }

  mongoose.set('strictQuery', true);
  await mongoose.connect(mongoUrl, {
    serverSelectionTimeoutMS: 15000
  });

  console.log('✅ Base de datos conectada.');
}

module.exports = { connectDatabase };
