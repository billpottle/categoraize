const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const axios = require('axios');
const { getPrompt } = require('./prompt');

// Define the paths to the CSV files
const categoriesFilePath = path.join(__dirname, 'categories.csv');
const transactionsFilePath = path.join(__dirname, 'transactions.csv');

// Array to store categories
let categories = [];

// Array to store transactions
let transactions = [];

// Array to store existing categorized transactions
let existingSheet = [];

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

// Function to load existing categorized transactions
function loadExistingSheet() {
  return new Promise((resolve, reject) => {
    const existingFilePath = path.join(__dirname, 'existing.csv');
    
    fs.createReadStream(existingFilePath)
      .pipe(csv())
      .on('data', (row) => {
        const firstColumnKey = Object.keys(row)[0]; // Dynamically determine the first column
        const date = row[firstColumnKey];
        
        // Find column names case-insensitively
        const transactionKey = Object.keys(row).find(key => key.toLowerCase() === 'transaction');
        const amountKey = Object.keys(row).find(key => key.toLowerCase() === 'amount');
        const categoryKey = Object.keys(row).find(key => key.toLowerCase() === 'category');
        const accountKey = Object.keys(row).find(key => key.toLowerCase() === 'account');

        const transaction = row[transactionKey];
        const amount = parseFloat(row[amountKey]);
        const category = row[categoryKey];
        const account = row[accountKey];

        if (transaction) {
          existingSheet.push({ date, transaction, amount, category, account });
        } else {
          console.log("Error Adding to Existing Sheet: ", row);
        }
      })
      .on('end', () => {
        console.log('Existing sheet loaded:', existingSheet);
        resolve(existingSheet);
      })
      .on('error', (error) => {
        console.error('Error reading the existing sheet file:', error);
        reject(error);
      });
  });
}

async function queryModel(prompt) {
  try {
    const response = await axios.post('http://localhost:11434/api/generate', {
      model: 'llama3.2:latest',
      stream: false,
      prompt: prompt,

    });
    //console.log('API Response:', response.data);
    return response.data.response;

  } catch (error) {
    console.error('Error calling the model API:', error.message);
  }
}


const runAnalysis = async () => {
  transactions.forEach(async (transaction) => {
    prompt = getPrompt([], transaction, categories)
    category = await queryModel(prompt);
    console.log(category)
  })
}

console.log('Loading data from files')
// Load categories, transactions, and existing sheet
Promise.all([loadCategories(), loadTransactions(), loadExistingSheet()])
  .then(() => {
    console.log('Data successfully loaded and ready for processing.');
    runAnalysis()
  })
  .catch((error) => {
    console.error('Failed to load data:', error);
  });

module.exports = {
  loadCategories,
  loadTransactions,
  loadExistingSheet,
  getCategories: () => categories,
  getTransactions: () => transactions,
  getExistingSheet: () => existingSheet,
};