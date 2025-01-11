const Table = require('cli-table3');

function createMonthlySummary(existingSheet) {
    // Get unique categories
    const categories = [...new Set(existingSheet.map(t => t.category))].sort();
    
    // Create month labels (current year)
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 
                       'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const currentYear = new Date().getFullYear().toString().slice(-2);
    const monthLabels = monthNames.map(month => `${month}-${currentYear}`);
    
    // Initialize the table with months and total column
    const table = new Table({
        head: ['Category', ...monthLabels, 'Total'],
        style: {
            head: ['cyan'],
            border: ['gray']
        }
    });
    
    // Calculate totals for each category by month
    categories.forEach(category => {
        const monthlySums = Array(12).fill(0);
        
        // Calculate each month's sum
        existingSheet
            .filter(t => t.category === category)
            .forEach(t => {
                const month = new Date(t.date).getMonth();
                monthlySums[month] += t.amount;
            });
        
        // Calculate row total
        const rowTotal = monthlySums.reduce((acc, curr) => acc + curr, 0);
        
        // Format all numbers as currency
        const formattedSums = monthlySums.map(sum => 
            sum ? `$${sum.toFixed(2)}` : '$0.00'
        );
        
        table.push([
            category, 
            ...formattedSums, 
            `$${rowTotal.toFixed(2)}`
        ]);
    });
    
    return table.toString();
}

module.exports = {
    createMonthlySummary
}; 