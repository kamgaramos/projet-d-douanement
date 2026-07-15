const bcrypt = require('bcrypt');
const { Pool } = require('pg');

const pool = new Pool({
  user: 'admin_user',
  password: 'SecurePassword123!',
  host: 'localhost',
  port: 5433,
  database: 'dedouanement_platform'
});

bcrypt.hash('david123', 10, async (err, hash) => {
  if(err) {
    console.error('Error hashing:', err);
    process.exit(1);
  }
  
  try {
    const result = await pool.query('UPDATE users SET password = $1 WHERE email = $2', [hash, 'david@gmail.com']);
    console.log('✓ Password updated:', result.rowCount, 'rows affected');
    
    // Verify
    const verify = await pool.query('SELECT email, password FROM users WHERE email = $1', ['david@gmail.com']);
    console.log('✓ New hash:', verify.rows[0].password);
    
    pool.end();
  } catch(e) {
    console.error('DB Error:', e);
    process.exit(1);
  }
});
