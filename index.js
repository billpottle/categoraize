const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const axios = require('axios');

// Define the paths to the CSV files
const categoriesFilePath = path.join(__dirname, 'categories.csv');
const transactionsFilePath = path.join(__dirname, 'transactions.csv');

// Array to store categories
let categories = [];

// Array to store transactions
let transactions = [];

// Function to load categories from the categories CSV
function loadCategories() {
  return new Promise((resolve, reject) => {
    const tempCategories = [];
    fs.createReadStream(categoriesFilePath)
      .pipe(csv())
      .on('data', (row) => {
        const category = row[Object.keys(row)[0]];
        if (category) {
          tempCategories.push(category);
        }
      })
      .on('end', () => {
        categories = tempCategories;
        console.log('Categories loaded:', categories);
        resolve(categories);
      })
      .on('error', (error) => {
        console.error('Error reading the categories file:', error);
        reject(error);
      });
  });
}

// Function to load transactions from the transactions CSV
function loadTransactions() {
  return new Promise((resolve, reject) => {
    fs.createReadStream(transactionsFilePath)
      .pipe(csv())
      .on('data', (row) => {
        const firstColumnKey = Object.keys(row)[0]; // Dynamically determine the first column
        const date = row[firstColumnKey];
        const transaction = row['Transaction'];
        const amount = parseFloat(row['Amount']);
        const account = row['Account'];

        if (date && transaction && !isNaN(amount) && account) {
          transactions.push({ date, transaction, amount, account });
        }
        else {
            console.log("Error Adding: ", row)
        }
      })
      .on('end', () => {
        console.log('Transactions loaded:', transactions);
        resolve(transactions);
      })
      .on('error', (error) => {
        console.error('Error reading the transactions file:', error);
        reject(error);
      });
  });
}


async function queryModel() {
  try {
    const response = await axios.post('http://localhost:11434/api/generate', {
        model: 'llama3.2:latest',
        stream: false,
        prompt: "Why is the sky blue?",
    
      });

    console.log('API Response:', response.data);
  } catch (error) {
    console.error('Error calling the model API:', error.message);
  }
}

queryModel();

// Load categories and transactions
Promise.all([loadCategories(), loadTransactions()])
  .then(() => {
    console.log('Data successfully loaded and ready for processing.');
  })
  .catch((error) => {
    console.error('Failed to load data:', error);
  });

module.exports = {
  loadCategories,
  loadTransactions,
  getCategories: () => categories,
  getTransactions: () => transactions,
};