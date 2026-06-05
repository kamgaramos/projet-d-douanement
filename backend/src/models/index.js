const User = require('./User');
const Declaration = require('./Declaration');
const Marchandise = require('./Marchandise');

const initModels = async () => {
  await User.createTable();
  await Declaration.createTable();
  await Marchandise.createTable();
  console.log('✓ Tables initialisées (users, declarations, marchandises)');
};

module.exports = { initModels, User, Declaration, Marchandise };
