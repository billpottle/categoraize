const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const axios = require('axios');
const { getPrompt, getAnalysisPrompt, getFollowUpPrompt } = require('./prompt');
const { createMonthlySummary } = require('./summary');
const readline = require('readline');
const chalk = require('chalk');

// Parse command line arguments
const args = process.argv.slice(2);
const config = {
  verbose: false,
  model: 'deepseek-r1:32b',
  skipDuplicates: false,
  changeSign: false
};

// Process command line arguments
for (let i = 0; i < args.length; i++) {
  switch (args[i]) {
    case '-v':
      config.verbose = true;
      break;
    case '-m':
      if (i + 1 < args.length) {
        config.model = args[++i];
      }
      break;
    case '-d':
      config.skipDuplicates = true;
      break;
    case '-cs':
      config.changeSign = true;
      break;
    case '-h':
      console.log(`
Usage: node index.js [options]

Options:
  -v        Verbose mode
  -m MODEL  Specify which model to use (default: llama2:latest)
  -d        Do not consider transactions which are already in existing.csv
  -cs       Change the sign (+ or -) of the transactions.csv file entries
  -h        Show this help message
`);
      process.exit(0);
  }
}

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
        let amount = parseFloat(row['Amount']);
        const account = row['Account'];

        // Change sign if -cs flag is set
        if (config.changeSign) {
          amount = -amount;
        }

        if (date && transaction && !isNaN(amount) && account) {
          transactions.push({ date, transaction, amount, account });
        }
        else {
          console.log("Error Adding: ", row)
        }
      })
      .on('end', () => {
        if (config.verbose) {
          console.log('Transactions loaded:', transactions);
        }
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
        if (config.verbose) {
          console.log('Existing sheet loaded:', existingSheet);
        }
        resolve(existingSheet);
      })
      .on('error', (error) => {
        console.error('Error reading the existing sheet file:', error);
        reject(error);
      });
  });
}

async function queryModel(prompt) {
  if (config.verbose) {
    console.log(prompt)
  }
  try {
    const response = await axios.post('http://localhost:11434/api/generate', {
      model: config.model,
      stream: false,
      prompt: prompt,

    });
    if (config.verbose) {
      console.log('API Response:', response.data);
    }
    const rawResponse = response.data.response;
    const cleanedResponse = rawResponse.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
    return cleanedResponse;

  } catch (error) {
    console.error('Error calling the model API:', error.message);
    // Return null or handle the error appropriately
    return null;
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

const startConversation = async (summaryTable, initialContext = '') => {
  let conversationHistory = [];

  // Initial analysis
  console.log(chalk.cyan('\nAnalyzing spending patterns and providing personalized advice...'));
  const analysisPrompt = getAnalysisPrompt(summaryTable, initialContext);
  const initialInsights = await queryModel(analysisPrompt);
  console.log(chalk.yellow('\n=== AI Insights ==='));
  console.log(chalk.white(initialInsights));

  // Store initial conversation
  conversationHistory.push({
    role: "user",
    content: analysisPrompt
  });
  conversationHistory.push({
    role: "assistant",
    content: initialInsights
  });

  while (true) {
    console.log(chalk.gray('\nType your follow-up question (or "exit" to quit)'));
    const question = await askQuestion(chalk.green('> '));

    if (question.toLowerCase() === 'exit') {
      break;
    }

    // Add user's question to history
    conversationHistory.push({
      role: "user",
      content: question
    });

    // Get AI response with full context
    const response = await queryModel(getFollowUpPrompt(summaryTable, conversationHistory));
    console.log(chalk.white(response));

    // Add AI's response to history
    conversationHistory.push({
      role: "assistant",
      content: response
    });
  }
}

const runAnalysis = async () => {
    // Process all transactions sequentially and wait for them to complete
    for (const transaction of transactions) {
        // Check for duplicates if -d flag is set
        if (config.skipDuplicates) {
            const isDuplicate = existingSheet.some(existing => 
                existing.date === transaction.date &&
                existing.transaction === transaction.transaction &&
                existing.amount === transaction.amount
            );
            
            if (isDuplicate) {
                if (config.verbose) {
                    console.log(chalk.yellow(`Skipping duplicate transaction: ${transaction.transaction} on ${transaction.date}`));
                }
                continue;
            }
        }

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

    // Get initial context
    console.log(chalk.yellow('\n=== Additional Context ==='));
    console.log(chalk.cyan('To get more personalized financial insights, you can provide additional context about your situation.'));
    console.log(chalk.gray('Suggestions: annual income, age, savings, investments, debt, financial goals, specific questions'));
    console.log(chalk.gray('(Press Enter to skip)\n'));
    
    const initialContext = await askQuestion(chalk.green('What additional information would you like to share? '));
    
    // Start interactive conversation
    await startConversation(summaryTable, initialContext);

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