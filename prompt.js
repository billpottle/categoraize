const formatTransaction = (transaction) => {
    return `${transaction.transaction} for $${(transaction.amount)} on ${transaction.date} from ${transaction.account}`;
}

const getPrompt = (existingSheet, transaction, categories) => {
    const formattedTransaction = formatTransaction(transaction);
    
    return (
        "You are a helpful AI which categorizes financial transactions. You will respond " +
        "with one category only. Do not offer explanation or anything else in the response. The category must be in the following list: " +
        categories.join(", ") + ". " +
        "You will give the one category that you think is most likely that the transaction belongs to. " +
        "Only in the case where there is no category even close, you will respond with 'Other' as the response. " +
        "The transaction that you need to categorize is: " +
        formattedTransaction + ". " +
        (existingSheet.length > 0 ? 
            "You can refer to previously categorized transactions as a guide. The previous transactions and " +
            "their correct categories are: " + 
            existingSheet.map(row => `${formatTransaction(row)}: ${row.category}`).join(", ")
            : "")
    );
}

module.exports = {
    getPrompt,
    formatTransaction
};