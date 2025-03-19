# Transaction Balance App

A web application for entering transactions and displaying running balances using Express.js and PostgreSQL.

## Features

- Add new transactions with date, description, and amount
- View all transactions in a table format
- See running balance for each transaction
- Modern and responsive UI using Bootstrap
- Real-time balance calculation

## Prerequisites

- Node.js (v14 or higher)
- PostgreSQL (v12 or higher)
- npm (Node Package Manager)

## Setup

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a PostgreSQL database:
   ```sql
   CREATE DATABASE transaction_db;
   ```

4. Configure the database connection:
   - Copy the `.env.example` file to `.env`
   - Update the database credentials in `.env` if needed

5. Start the application:
   ```bash
   npm run dev
   ```

The application will be available at `http://localhost:3000`

## Usage

1. Enter a new transaction:
   - Fill in the date
   - Add a description
   - Enter the amount (positive for deposits, negative for withdrawals)
   - Click "Add Transaction"

2. View transactions:
   - All transactions are displayed in the table below the form
   - The running balance is automatically calculated
   - Positive amounts are shown in green, negative in red

## Development

- The application uses Express.js for the backend
- PostgreSQL for the database
- EJS for templating
- Bootstrap for styling

## License

MIT 