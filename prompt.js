const getPrompt = (existingSheet, transaction, categories) => {
    return (
        "You are a helpful AI which categorizes financial transactions. You will respond " +
        "with one category only. Do not offer explanation or anything else in the response. The category must be in the following list: " +
        categories.join(", ") + ". " +
        "You will give the one category that you think is most likely that the transaction belongs to. " +
        "Only in the case where there is no category even close, you will respond with 'Other' as the response. " +
        "The transaction that you need to categorize is: " +
        transaction + ". " +
        "You can refer to previously categorized transactions as a guide. The previous transactions and " +
        "their correct categories are: " + 
        existingSheet.map(row => `${row.transaction}: ${row.category}`).join(", ")
    );
}