const { query } = require('../config/db');

const createTable = async () => {
  await query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username VARCHAR(50) NOT NULL,
      email VARCHAR(100) UNIQUE NOT NULL,
      password VARCHAR(255) NOT NULL,
      role VARCHAR(20) DEFAULT 'declarant',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
};

const User = {
  createTable,
  create: (username, email, password, role = 'declarant') =>
    query(
      'INSERT INTO users (username, email, password, role) VALUES ($1, $2, $3, $4) RETURNING id, username, email, role, created_at',
      [username, email, password, role]
    ),
  findByEmail: (email) =>
    query('SELECT * FROM users WHERE email = $1', [email]),
  findById: (id) =>
    query('SELECT id, username, email, role, created_at FROM users WHERE id = $1', [id]),
};

module.exports = User;
