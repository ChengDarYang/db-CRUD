const express = require('express');
const { Pool } = require('pg');
const bodyParser = require('body-parser');
const path = require('path');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

// Database configuration
const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'transaction_db',
  password: process.env.DB_PASSWORD || 'postgres',
  port: process.env.DB_PORT || 5432,
});

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static('public'));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Routes
app.get('/', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        id,
        date,
        description,
        amount,
        SUM(amount) OVER (ORDER BY date, id) as running_balance
      FROM transactions
      ORDER BY date DESC, id DESC
    `);
    res.render('index', { transactions: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});

// Deposit configuration routes
app.get('/deposit-config', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM deposit_settings ORDER BY id DESC LIMIT 1');
    res.render('deposit-config', { settings: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});

app.post('/deposit-config', async (req, res) => {
  const { interval_days, amount, start_date } = req.body;
  try {
    await pool.query(
      'INSERT INTO deposit_settings (interval_days, amount, start_date) VALUES ($1, $2, $3)',
      [parseInt(interval_days), parseFloat(amount), start_date]
    );
    res.redirect('/deposit-config');
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});

app.post('/update-deposits', async (req, res) => {
  try {
    // Get the latest deposit settings
    const settingsResult = await pool.query('SELECT * FROM deposit_settings ORDER BY id DESC LIMIT 1');
    if (settingsResult.rows.length === 0) {
      return res.redirect('/deposit-config');
    }

    const settings = settingsResult.rows[0];
    const startDate = new Date(settings.start_date);
    const today = new Date();

    // Get existing deposit transactions
    const existingDeposits = await pool.query(
      'SELECT date FROM transactions WHERE description LIKE $1',
      ['%Auto Deposit%']
    );
    const existingDates = existingDeposits.rows.map(row => row.date.toISOString().split('T')[0]);

    // Generate new deposit transactions
    let currentDate = new Date(startDate);
    while (currentDate <= today) {
      const dateStr = currentDate.toISOString().split('T')[0];
      if (!existingDates.includes(dateStr)) {
        await pool.query(
          'INSERT INTO transactions (date, description, amount) VALUES ($1, $2, $3)',
          [dateStr, `Auto Deposit - ${settings.interval_days} day interval`, settings.amount]
        );
      }
      currentDate.setDate(currentDate.getDate() + settings.interval_days);
    }

    res.redirect('/');
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});

app.post('/transaction', async (req, res) => {
  const { date, description, amount } = req.body;
  try {
    await pool.query(
      'INSERT INTO transactions (date, description, amount) VALUES ($1, $2, $3)',
      [date, description, parseFloat(amount)]
    );
    res.redirect('/');
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});

// Update transaction
app.post('/transaction/:id/update', async (req, res) => {
  const { id } = req.params;
  const { date, description, amount } = req.body;
  try {
    await pool.query(
      'UPDATE transactions SET date = $1, description = $2, amount = $3 WHERE id = $4',
      [date, description, parseFloat(amount), id]
    );
    res.redirect('/');
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});

// Delete transaction
app.post('/transaction/:id/delete', async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query('DELETE FROM transactions WHERE id = $1', [id]);
    res.redirect('/');
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});

// Initialize database
const initDb = async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS transactions (
        id SERIAL PRIMARY KEY,
        date DATE NOT NULL,
        description TEXT NOT NULL,
        amount DECIMAL(10,2) NOT NULL
      );

      CREATE TABLE IF NOT EXISTS deposit_settings (
        id SERIAL PRIMARY KEY,
        interval_days INTEGER NOT NULL,
        amount DECIMAL(10,2) NOT NULL,
        start_date DATE NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('Database initialized successfully');
  } catch (err) {
    console.error('Error initializing database:', err);
  }
};

// Start server
initDb().then(() => {
  app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
  });
}); 