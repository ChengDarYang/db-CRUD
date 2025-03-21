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
    const client = await pool.connect();
    await client.query('BEGIN');

    // Get deposit settings
    const settingsResult = await client.query('SELECT * FROM deposit_settings ORDER BY id DESC LIMIT 1');
    if (settingsResult.rows.length > 0) {
      const settings = settingsResult.rows[0];

      // Get the most recent auto deposit
      const lastDepositResult = await client.query(
        'SELECT date FROM transactions WHERE description = $1 ORDER BY date DESC LIMIT 1',
        ['Auto Deposit']
      );

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // If no deposits exist, start from configured start date
      if (lastDepositResult.rows.length === 0) {
        let startDate = new Date(settings.start_date);
        let currentDate = new Date(startDate);
        
        while (currentDate <= today) {
          const existingDepositResult = await client.query(
            'SELECT id FROM transactions WHERE date = $1 AND description = $2',
            [currentDate.toISOString().split('T')[0], 'Auto Deposit']
          );

          if (existingDepositResult.rows.length === 0) {
            await client.query(
              'INSERT INTO transactions (date, description, amount) VALUES ($1, $2, $3)',
              [currentDate.toISOString().split('T')[0], 'Auto Deposit', settings.amount]
            );
          }
          currentDate.setDate(currentDate.getDate() + settings.interval_days);
        }
      } else {
        // Check if we're past the interval period
        const lastDepositDate = new Date(lastDepositResult.rows[0].date);
        const daysSinceLastDeposit = Math.floor((today - lastDepositDate) / (1000 * 60 * 60 * 24));
        
        if (daysSinceLastDeposit >= settings.interval_days - 1) {
          // Start from the day after the last auto deposit
          let startDate = new Date(lastDepositDate);
          startDate.setDate(startDate.getDate() + 1);
          let currentDate = new Date(startDate);

          while (currentDate <= today) {
            const existingDepositResult = await client.query(
              'SELECT id FROM transactions WHERE date = $1 AND description = $2',
              [currentDate.toISOString().split('T')[0], 'Auto Deposit']
            );

            if (existingDepositResult.rows.length === 0) {
              await client.query(
                'INSERT INTO transactions (date, description, amount) VALUES ($1, $2, $3)',
                [currentDate.toISOString().split('T')[0], 'Auto Deposit', settings.amount]
              );
            }
            currentDate.setDate(currentDate.getDate() + settings.interval_days);
          }
        }
      }
    }

    // Get all transactions with running balance
    const result = await client.query(`
      SELECT 
        id,
        date,
        description,
        amount,
        SUM(amount) OVER (ORDER BY date, id) as running_balance
      FROM transactions
      ORDER BY date DESC, id DESC
    `);

    await client.query('COMMIT');
    client.release();

    res.render('index', { transactions: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});

// Deposit configuration routes
app.get('/deposit-config', async (req, res) => {
  try {
    const settingsResult = await pool.query('SELECT * FROM deposit_settings ORDER BY id DESC LIMIT 1');
    const depositSettings = settingsResult.rows[0];

    // Get the most recent auto deposit
    const lastDepositResult = await pool.query(
      'SELECT date FROM transactions WHERE description = $1 ORDER BY date DESC LIMIT 1',
      ['Auto Deposit']
    );
    const lastDeposit = lastDepositResult.rows[0];

    res.render('deposit-config', { 
      depositSettings,
      lastDeposit
    });
  } catch (error) {
    console.error('Error fetching deposit settings:', error);
    res.status(500).send('Error fetching deposit settings: ' + error.message);
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
    const client = await pool.connect();
    await client.query('BEGIN');

    // Get deposit settings
    const settingsResult = await client.query('SELECT * FROM deposit_settings ORDER BY id DESC LIMIT 1');
    if (settingsResult.rows.length === 0) {
      throw new Error('No deposit settings found');
    }
    const settings = settingsResult.rows[0];

    // Get the most recent auto deposit
    const lastDepositResult = await client.query(
      'SELECT date FROM transactions WHERE description = $1 ORDER BY date DESC LIMIT 1',
      ['Auto Deposit']
    );

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // If no deposits exist, start from configured start date
    if (lastDepositResult.rows.length === 0) {
      let startDate = new Date(settings.start_date);
      let currentDate = new Date(startDate);
      
      while (currentDate <= today) {
        const existingDepositResult = await client.query(
          'SELECT id FROM transactions WHERE date = $1 AND description = $2',
          [currentDate.toISOString().split('T')[0], 'Auto Deposit']
        );

        if (existingDepositResult.rows.length === 0) {
          await client.query(
            'INSERT INTO transactions (date, description, amount) VALUES ($1, $2, $3)',
            [currentDate.toISOString().split('T')[0], 'Auto Deposit', settings.amount]
          );
        }
        currentDate.setDate(currentDate.getDate() + settings.interval_days);
      }
    } else {
      // Check if we're past the interval period
      const lastDepositDate = new Date(lastDepositResult.rows[0].date);
      const daysSinceLastDeposit = Math.floor((today - lastDepositDate) / (1000 * 60 * 60 * 24));
      
      if (daysSinceLastDeposit >= settings.interval_days - 1) {
        // Start from the day after the last auto deposit
        let startDate = new Date(lastDepositDate);
        startDate.setDate(startDate.getDate() + 1);
        let currentDate = new Date(startDate);

        while (currentDate <= today) {
          const existingDepositResult = await client.query(
            'SELECT id FROM transactions WHERE date = $1 AND description = $2',
            [currentDate.toISOString().split('T')[0], 'Auto Deposit']
          );

          if (existingDepositResult.rows.length === 0) {
            await client.query(
              'INSERT INTO transactions (date, description, amount) VALUES ($1, $2, $3)',
              [currentDate.toISOString().split('T')[0], 'Auto Deposit', settings.amount]
            );
          }
          currentDate.setDate(currentDate.getDate() + settings.interval_days);
        }
      }
    }

    await client.query('COMMIT');
    client.release();

    res.redirect('/deposit-config');
  } catch (error) {
    console.error('Error updating deposits:', error);
    res.status(500).send('Error updating deposits: ' + error.message);
  }
});

app.post('/transaction', async (req, res) => {
  const { date, description, amount, type } = req.body;
  try {
    // Convert amount to number and make it negative if it's an expense
    const numericAmount = parseFloat(amount);
    const finalAmount = type === 'expense' ? -numericAmount : numericAmount;

    await pool.query(
      'INSERT INTO transactions (date, description, amount) VALUES ($1, $2, $3)',
      [date, description, finalAmount]
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