const { query } = require('../config/db');

const ALLOWED_ROLES = ['declarant', 'douanier', 'transitaire'];

const createTable = async () => {
  await query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username VARCHAR(50) NOT NULL,
      email VARCHAR(100) UNIQUE NOT NULL,
      password VARCHAR(255) NOT NULL,
      role VARCHAR(20) DEFAULT 'declarant',
      statut_validation VARCHAR(20) DEFAULT 'APPROVED',
      num_agrement VARCHAR(50),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
};

const User = {
  createTable,
  create: (username, email, password, role = 'declarant', statut_validation = 'APPROVED', num_agrement = null) =>
    query(
      'INSERT INTO users (username, email, password, role, statut_validation, num_agrement) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, username, email, role, statut_validation, num_agrement, created_at',
      [username, email, password, role, statut_validation, num_agrement]
    ),
  validateRole: (role) => ALLOWED_ROLES.includes(role),
  findByEmail: (email) =>
    query('SELECT * FROM users WHERE email = $1', [email]),
  findById: (id) =>
    query('SELECT id, username, email, role, created_at FROM users WHERE id = $1', [id]),

  findByRole: (role) => {
    return query(
      'SELECT id, username, email, role, created_at FROM users WHERE role = $1 ORDER BY created_at DESC',
      [role]
    );
  }
};

module.exports = User;
