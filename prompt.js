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

const getAnalysisPrompt = (summaryTable, userContext = '') => {
    return (
        "You are a helpful financial analyst. I will provide you with a summary of monthly spending by category " +
        "along with additional context about the person's financial situation. " +
        "Please analyze this data and provide personalized insights and advice.\n\n" +
        "Monthly Spending Summary:\n" +
        "```\n" +
        summaryTable +
        "```\n" +
        (userContext ? "\nAdditional Context:\n" + userContext + "\n\n" : "\n") +
        "Please provide:\n" +
        "1. Analysis of spending patterns and trends\n" +
        "2. Categories with notably high or low spending\n" +
        "3. Personalized recommendations based on the provided context\n" +
        "4. Specific advice addressing any stated goals or questions\n" +
        "5. Potential areas for budget optimization\n\n" +
        "Please provide your analysis in clear, concise bullet points, focusing on actionable insights." +
        "Please also be certain to asnwer any specific questions in the Additional Context"
    );
}

const getFollowUpPrompt = (summaryTable, conversationHistory) => {
    return (
        "You are a helpful financial analyst having a conversation about the following financial data. " +
        "You should provide specific insights and recommendations based on the data and context provided. " +
        "Do not be overly cautious or hesitant - you are analyzing spending data and providing observations " +
        "and suggestions, not giving regulated financial advice.\n\n" +
        "Monthly Spending Summary:\n" +
        "```\n" +
        summaryTable +
        "```\n\n" +
        "Previous conversation:\n" +
        conversationHistory.map(msg => `${msg.role}: ${msg.content}`).join('\n') +
        "\n\nPlease provide a clear and direct response to the latest question, " +
        "maintaining context from the previous conversation and referencing the spending data when relevant. " +
        "Focus on practical observations and actionable suggestions based on the spending patterns shown in the data."
    );
}

module.exports = {
    getPrompt,
    formatTransaction,
    getAnalysisPrompt,
    getFollowUpPrompt
};