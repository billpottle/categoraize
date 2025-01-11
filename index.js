const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const axios = require('axios');
const { getPrompt, getAnalysisPrompt } = require('./prompt');
const { createMonthlySummary } = require('./summary');
const readline = require('readline');
const chalk = require('chalk');

// Define the paths to the CSV files
const categoriesFilePath = path.join(__dirname, 'categories.csv');
const transactionsFilePath = path.join(__dirname, 'transactions.csv');

// Array to store categories
let categories = [];

// Array to store transactions
let transactions = [];

// Array to store existing categorized transactions
let existingSheet = [];

// Create readline interface for user input
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

// Promisify the question method
const askQuestion = (query) => new Promise((resolve) => rl.question(query, resolve));

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
        //console.log('Transactions loaded:', transactions);
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
        //console.log('Existing sheet loaded:', existingSheet);
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

// Function to append a new transaction with its category to existing.csv
function appendToExisting(transaction, category, callback = () => {}) {
  const existingFilePath = path.join(__dirname, 'existing.csv');
  const newLine = `\n${transaction.date},${transaction.transaction},${transaction.amount},${category},${transaction.account}`;
  
  fs.appendFile(existingFilePath, newLine, (err) => {
    if (err) {
      console.error('Error appending to existing.csv:', err);
    } else {
      console.log(chalk.gray('Successfully appended transaction to existing.csv'));
      // Also add to our in-memory array
      existingSheet.push({ ...transaction, category });
    }
    callback();
  });
}

const runAnalysis = async () => {
    // Process all transactions sequentially and wait for them to complete
    for (const transaction of transactions) {
        prompt = getPrompt(existingSheet, transaction, categories);
        category = await queryModel(prompt);
        console.log(chalk.blue(`Categorized as: ${chalk.bold(category)}`));
        // Wait for append to complete before continuing
        await new Promise((resolve, reject) => {
            appendToExisting(transaction, category, resolve);
        });
    }
    
    // Small delay to ensure file system has completed writing
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Generate and display the summary
    const summaryTable = createMonthlySummary(existingSheet);
    console.log(chalk.yellow('\n=== Monthly Spending Summary ==='));
    console.log(summaryTable);

    // Get additional context from user with a single, open-ended prompt
    console.log(chalk.yellow('\n=== Additional Context ==='));
    console.log(chalk.cyan('To get more personalized financial insights, you can provide additional context about your situation.'));
    console.log(chalk.gray('Suggestions: annual income, age, savings, investments, debt, financial goals, specific questions'));
    console.log(chalk.gray('(Press Enter to skip)\n'));
    
    const context = await askQuestion(chalk.green('What additional information would you like to share? '));
    
    // Get AI insights on the summary with additional context
    console.log(chalk.cyan('\nAnalyzing spending patterns and providing personalized advice...'));
    const analysisPrompt = getAnalysisPrompt(summaryTable, context);
    const insights = await queryModel(analysisPrompt);
    console.log(chalk.yellow('\n=== AI Insights ==='));
    console.log(chalk.white(insights));

    rl.close();
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