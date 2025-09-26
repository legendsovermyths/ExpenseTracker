import RNHTMLtoPDF from 'react-native-html-to-pdf';
import RNFS from 'react-native-fs';
import Share from 'react-native-share';
import { Transaction } from '../types/entity/Transaction';
import { Account } from '../types/entity/Account';
import { Category } from '../types/entity/Category';
import { 
  getTransactionsGroupedByCategories,
  getTransactionsGroupedByAccount,
  getNumberOfTransactionsBetweenDates,
  getCumulativeExpenditures,
  getTopTransaction,
  formatAmountWithCommas,
  getNumberOfDays,
  getTransactionsGroupedBySubategories,
  getNumberOfSubcategoryTransactionsBetweenDates
} from './_Utils';
import { getFormattedDateWithYear } from './Utils';

interface PdfData {
  startDate: string;
  endDate: string;
  totalExpenditure: string;
  totalTransactions: number;
  numberOfDays: number;
  avgDailySpending: string;
  budgetStatus: {
    percentage: string;
    class: string;
  };
  topTransactionAmount: string;
  categoryBreakdown: any[];
  accountBreakdown: any[];
  topTransactions: any[];
  bankStatements: any[];
  categoryAnalysis: any[];
  allTransactions: any[];
  finalPageNumber: number;
}

export class PdfGenerator {
  private transactions: Transaction[];
  private accountsById: Record<number, Account>;
  private categoriesById: Record<number, Category>;
  private monthlyBalance: number;

  constructor(
    transactions: Transaction[],
    accountsById: Record<number, Account>,
    categoriesById: Record<number, Category>,
    monthlyBalance: number
  ) {
    this.transactions = transactions;
    this.accountsById = accountsById;
    this.categoriesById = categoriesById;
    this.monthlyBalance = monthlyBalance;
  }

  public async generatePdf(startDate: Date, endDate: Date): Promise<string> {
    const data = this.prepareData(startDate, endDate);
    const html = await this.generateHtml(data);
    
    const options = {
      html,
      fileName: `expense_report_${startDate.getFullYear()}_${startDate.getMonth() + 1}`,
      directory: 'Documents',
      width: 612,
      height: 792,
      type: 'pdf',
      quality: 'high',
    };

    try {
      const pdf = await RNHTMLtoPDF.convert(options);
      return pdf.filePath || '';
    } catch (error) {
      console.error('PDF generation error:', error);
      throw new Error('Failed to generate PDF');
    }
  }

  public async generateAndSharePdf(startDate: Date, endDate: Date): Promise<void> {
    try {
      const filePath = await this.generatePdf(startDate, endDate);
      
      await Share.open({
        url: `file://${filePath}`,
        type: 'application/pdf',
        saveToFiles: true,
      });
    } catch (error) {
      console.error('PDF sharing error:', error);
      throw error;
    }
  }

  private prepareData(startDate: Date, endDate: Date): PdfData {
    // Filter transactions for the date range
    const filteredTransactions = this.transactions.filter(
      (transaction) =>
        new Date(transaction.date_time) >= startDate &&
        new Date(transaction.date_time) <= endDate
    );

    // Basic calculations
    const numberOfDays = getNumberOfDays(startDate, endDate);
    const totalTransactions = getNumberOfTransactionsBetweenDates(this.transactions, startDate, endDate);
    
    // Calculate total expenditure (only expenses, not credits)
    const totalExpenditure = filteredTransactions
      .filter(t => !t.is_credit)
      .reduce((sum, t) => sum + t.amount, 0);

    const avgDailySpending = numberOfDays > 0 ? totalExpenditure / numberOfDays : 0;

    // Budget status calculation
    const budgetPercentage = this.monthlyBalance > 0 ? (totalExpenditure / this.monthlyBalance) * 100 : 0;
    const budgetStatus = {
      percentage: budgetPercentage.toFixed(1),
      class: budgetPercentage <= 100 ? 'income' : 'expense'
    };

    // Category and account breakdowns
    const categoryBreakdown = getTransactionsGroupedByCategories(
      this.transactions, 
      this.categoriesById, 
      startDate, 
      endDate
    ).map((item: any) => ({
      ...item,
      sum: formatAmountWithCommas(item.sum)
    }));

    const accountBreakdown = getTransactionsGroupedByAccount(
      this.transactions,
      this.accountsById,
      startDate,
      endDate
    ).map((item: any) => ({
      ...item,
      sum: formatAmountWithCommas(item.sum)
    }));

    // Top transactions
    const topTransactions = getTopTransaction(this.transactions, startDate, endDate)
      .map(transaction => ({
        ...transaction,
        formattedDate: getFormattedDateWithYear(transaction.date_time || new Date().toISOString(), 0),
        accountName: this.accountsById[transaction.account_id]?.name || 'Unknown',
        amount: formatAmountWithCommas(Math.abs(transaction.amount || 0))
      }));

    // Bank statements
    const bankStatements = this.prepareBankStatements(startDate, endDate);

    // Category analysis
    const categoryAnalysis = this.prepareCategoryAnalysis(startDate, endDate);

    // All transactions
    const allTransactions = this.prepareAllTransactions(filteredTransactions);

    // Calculate final page number
    const finalPageNumber = 1 + bankStatements.length + categoryAnalysis.length + 1;

    return {
      startDate: getFormattedDateWithYear(startDate, 0),
      endDate: getFormattedDateWithYear(endDate, 0),
      totalExpenditure: formatAmountWithCommas(totalExpenditure),
      totalTransactions,
      numberOfDays,
      avgDailySpending: formatAmountWithCommas(avgDailySpending),
      budgetStatus,
      topTransactionAmount: topTransactions.length > 0 ? topTransactions[0].amount : '0',
      categoryBreakdown,
      accountBreakdown,
      topTransactions,
      bankStatements,
      categoryAnalysis,
      allTransactions,
      finalPageNumber
    };
  }

  private prepareBankStatements(startDate: Date, endDate: Date): any[] {
    const bankStatements: any[] = [];
    let pageNumber = 2; // Starting from page 2

    // Group transactions by account
    const accountGroups: Record<number, Transaction[]> = {};
    
    this.transactions
      .filter(
        (transaction) =>
          new Date(transaction.date_time) >= startDate &&
          new Date(transaction.date_time) <= endDate
      )
      .forEach(transaction => {
        if (!accountGroups[transaction.account_id]) {
          accountGroups[transaction.account_id] = [];
        }
        accountGroups[transaction.account_id].push(transaction);
      });

    // Create bank statement for each account
    Object.keys(accountGroups).forEach(accountId => {
      const transactions = accountGroups[parseInt(accountId)];
      const account = this.accountsById[parseInt(accountId)];
      
      if (!account || transactions.length === 0) return;

      const totalAmount = transactions.reduce((sum, t) => sum + (t.is_credit ? t.amount : -t.amount), 0);
      
      const formattedTransactions = transactions
        .sort((a, b) => new Date(b.date_time || 0).getTime() - new Date(a.date_time || 0).getTime())
        .map(transaction => ({
          formattedDateTime: this.formatDateTime(transaction.date_time || new Date().toISOString()),
          description: transaction.description || 'No description',
          categoryName: this.categoriesById[transaction.category_id]?.name || 'Unknown',
          formattedAmount: (transaction.is_credit ? '+' : '-') + '₹' + formatAmountWithCommas(Math.abs(transaction.amount || 0)),
          amountClass: transaction.is_credit ? 'positive' : 'negative'
        }));

      bankStatements.push({
        bankName: account.name || 'Unknown Account',
        transactionCount: transactions.length,
        totalAmount: formatAmountWithCommas(Math.abs(totalAmount)),
        transactions: formattedTransactions,
        pageNumber: pageNumber++,
        startDate: getFormattedDateWithYear(startDate, 0),
        endDate: getFormattedDateWithYear(endDate, 0)
      });
    });

    return bankStatements;
  }

  private prepareCategoryAnalysis(startDate: Date, endDate: Date): any[] {
    const categoryAnalysis: any[] = [];
    const categories = getTransactionsGroupedByCategories(
      this.transactions,
      this.categoriesById,
      startDate,
      endDate
    );

    let pageNumber = 2 + Object.keys(this.accountsById).length; // After summary and bank statements

    categories.forEach((categoryData: any) => {
      const categoryTransactions = this.transactions.filter(
        transaction =>
          transaction.category_id === categoryData.category.id &&
          new Date(transaction.date_time) >= startDate &&
          new Date(transaction.date_time) <= endDate &&
          !transaction.is_credit
      );

      // Get subcategories
      const subcategories = getTransactionsGroupedBySubategories(
        this.transactions,
        this.categoriesById,
        startDate,
        endDate,
        categoryData.category
      ).map((sub: any) => ({
        ...sub,
        sum: formatAmountWithCommas(sub.sum)
      }));

      const formattedTransactions = categoryTransactions
        .sort((a, b) => new Date(b.date_time || 0).getTime() - new Date(a.date_time || 0).getTime())
        .map(transaction => ({
          formattedDate: getFormattedDateWithYear(transaction.date_time || new Date().toISOString(), 0),
          description: transaction.description || 'No description',
          accountName: this.accountsById[transaction.account_id]?.name || 'Unknown',
          subcategoryName: transaction.subcategory_id 
            ? this.categoriesById[transaction.subcategory_id]?.name || 'Unknown'
            : 'None',
          amount: formatAmountWithCommas(Math.abs(transaction.amount || 0))
        }));

      const averageAmount = categoryTransactions.length > 0 
        ? categoryData.sum / categoryTransactions.length 
        : 0;

      categoryAnalysis.push({
        categoryName: categoryData.label || 'Unknown Category',
        totalAmount: formatAmountWithCommas(categoryData.sum || 0),
        transactionCount: categoryTransactions.length,
        percentage: (categoryData.value || 0).toFixed(1),
        averageAmount: formatAmountWithCommas(averageAmount),
        hasSubcategories: subcategories.length > 0,
        subcategories,
        transactions: formattedTransactions,
        numberOfDays: getNumberOfDays(startDate, endDate),
        pageNumber: pageNumber++,
        startDate: getFormattedDateWithYear(startDate, 0),
        endDate: getFormattedDateWithYear(endDate, 0)
      });
    });

    return categoryAnalysis;
  }

  private prepareAllTransactions(transactions: Transaction[]): any[] {
    return transactions
      .sort((a, b) => new Date(b.date_time || 0).getTime() - new Date(a.date_time || 0).getTime())
      .map(transaction => ({
        formattedDateTime: this.formatDateTime(transaction.date_time || new Date().toISOString()),
        description: transaction.description || 'No description',
        categoryName: this.categoriesById[transaction.category_id]?.name || 'Unknown',
        accountName: this.accountsById[transaction.account_id]?.name || 'Unknown',
        formattedAmount: (transaction.is_credit ? '+' : '-') + '₹' + formatAmountWithCommas(Math.abs(transaction.amount || 0)),
        amountClass: transaction.is_credit ? 'positive' : 'negative'
      }));
  }

  private formatDateTime(dateTime: string): string {
    if (!dateTime) {
      dateTime = new Date().toISOString();
    }
    const date = new Date(dateTime);
    return `${getFormattedDateWithYear(dateTime, 0)} ${date.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: true 
    })}`;
  }

  private async generateHtml(data: PdfData): Promise<string> {
    return this.generateHtmlDirectly(data);
  }

  private generateHtmlDirectly(data: PdfData): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Expenditure Summary Report</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.4;
            color: #2c3e50;
            background: #fff;
        }
        
        .page {
            min-height: 100vh;
            padding: 20px;
            page-break-after: always;
        }
        
        .page:last-child { page-break-after: auto; }
        
        .header {
            text-align: center;
            margin-bottom: 30px;
            border-bottom: 2px solid #3498db;
            padding-bottom: 15px;
        }
        
        .title {
            font-size: 24px;
            font-weight: 700;
            color: #2c3e50;
            margin-bottom: 6px;
        }
        
        .subtitle {
            font-size: 14px;
            color: #7f8c8d;
            margin-bottom: 4px;
        }
        
        .date-range {
            font-size: 12px;
            color: #34495e;
            font-weight: 500;
        }
        
        .section {
            margin-bottom: 25px;
        }
        
        .section-title {
            font-size: 18px;
            font-weight: 600;
            color: #2c3e50;
            margin-bottom: 12px;
            padding-bottom: 6px;
            border-bottom: 1px solid #ecf0f1;
        }
        
        .stats-grid {
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
            margin-bottom: 15px;
        }
        
        .stat-card {
            background: #f8f9fa;
            padding: 12px;
            border-radius: 6px;
            border-left: 3px solid #3498db;
            flex: 1;
            min-width: 160px;
            max-width: 250px;
        }
        
        .stat-label {
            font-size: 10px;
            color: #7f8c8d;
            text-transform: uppercase;
            font-weight: 600;
            margin-bottom: 4px;
        }
        
        .stat-value {
            font-size: 18px;
            font-weight: 700;
            color: #2c3e50;
        }
        
        .stat-value.expense { color: #e74c3c; }
        .stat-value.income { color: #27ae60; }
        
        .table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 15px;
        }
        
        .table th,
        .table td {
            padding: 6px 4px;
            text-align: left;
            border-bottom: 1px solid #ecf0f1;
            font-size: 11px;
        }
        
        .table th {
            background: #f8f9fa;
            font-weight: 600;
            color: #2c3e50;
        }
        
        .amount { font-weight: 600; }
        .amount.negative { color: #e74c3c; }
        .amount.positive { color: #27ae60; }
        
        .category-breakdown {
            display: flex;
            flex-wrap: wrap;
            gap: 6px;
            margin-bottom: 15px;
        }
        
        .category-item {
            background: #f8f9fa;
            padding: 10px;
            border-radius: 6px;
            border: 1px solid #ecf0f1;
            flex: 1;
            min-width: 150px;
            max-width: 200px;
        }
        
        .category-name {
            font-weight: 600;
            color: #2c3e50;
            margin-bottom: 4px;
            font-size: 12px;
        }
        
        .category-amount {
            font-size: 14px;
            font-weight: 700;
            color: #e74c3c;
            margin-bottom: 2px;
        }
        
        .category-percentage {
            font-size: 10px;
            color: #7f8c8d;
        }
        
        .bank-statement-header {
            background: #34495e;
            color: white;
            padding: 15px;
            border-radius: 6px 6px 0 0;
            margin-bottom: 0;
        }
        
        .bank-name {
            font-size: 16px;
            font-weight: 600;
            margin-bottom: 4px;
        }
        
        .bank-total {
            font-size: 12px;
            opacity: 0.9;
        }
        
        .summary-text {
            background: #e8f5e8;
            padding: 12px;
            border-radius: 6px;
            font-size: 12px;
            color: #2c3e50;
            border-left: 3px solid #27ae60;
        }
        
        .page-number {
            position: fixed;
            bottom: 15px;
            right: 20px;
            font-size: 10px;
            color: #7f8c8d;
        }
    </style>
</head>
<body>
    <!-- PAGE 1: SUMMARY -->
    <div class="page">
        <div class="header">
            <div class="title">Expenditure Summary Report</div>
            <div class="subtitle">Financial Analysis</div>
            <div class="date-range">${data.startDate} - ${data.endDate}</div>
        </div>
        
        <div class="section">
            <div class="section-title">Overview</div>
            <div class="stats-grid">
                <div class="stat-card">
                    <div class="stat-label">Total Expenditure</div>
                    <div class="stat-value expense">₹${data.totalExpenditure}</div>
                </div>
                <div class="stat-card">
                    <div class="stat-label">Total Transactions</div>
                    <div class="stat-value">${data.totalTransactions}</div>
                </div>
                <div class="stat-card">
                    <div class="stat-label">Number of Days</div>
                    <div class="stat-value">${data.numberOfDays}</div>
                </div>
                <div class="stat-card">
                    <div class="stat-label">Average Daily Spending</div>
                    <div class="stat-value expense">₹${data.avgDailySpending}</div>
                </div>
                <div class="stat-card">
                    <div class="stat-label">Budget Status</div>
                    <div class="stat-value ${data.budgetStatus?.class || 'expense'}">${data.budgetStatus?.percentage || '0'}%</div>
                </div>
                <div class="stat-card">
                    <div class="stat-label">Top Transaction</div>
                    <div class="stat-value expense">₹${data.topTransactionAmount}</div>
                </div>
            </div>
        </div>
        
        <div class="section">
            <div class="section-title">Category Breakdown</div>
            <div class="category-breakdown">
                ${(data.categoryBreakdown || []).map(item => `
                <div class="category-item">
                    <div class="category-name">${item.label || ''}</div>
                    <div class="category-amount">₹${item.sum || '0'}</div>
                    <div class="category-percentage">${item.value || '0'}% of total</div>
                </div>
                `).join('')}
            </div>
        </div>
        
        <div class="section">
            <div class="section-title">Account Breakdown</div>
            <div class="category-breakdown">
                ${(data.accountBreakdown || []).map(item => `
                <div class="category-item">
                    <div class="category-name">${item.label || ''}</div>
                    <div class="category-amount">₹${item.sum || '0'}</div>
                    <div class="category-percentage">${item.value || '0'}% of total</div>
                </div>
                `).join('')}
            </div>
        </div>
        
        <div class="section">
            <div class="section-title">Top Transactions</div>
            <table class="table">
                <thead>
                    <tr>
                        <th>Description</th>
                        <th>Date</th>
                        <th>Account</th>
                        <th>Amount</th>
                    </tr>
                </thead>
                <tbody>
                    ${(data.topTransactions || []).map(transaction => `
                    <tr>
                        <td>${transaction.description || ''}</td>
                        <td>${transaction.formattedDate || ''}</td>
                        <td>${transaction.accountName || ''}</td>
                        <td class="amount negative">₹${transaction.amount || '0'}</td>
                    </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
        
        <div class="page-number">Page 1</div>
    </div>
    
    ${(data.bankStatements || []).map(bank => `
    <div class="page">
        <div class="header">
            <div class="title">Account Statement</div>
            <div class="subtitle">${bank.bankName || ''}</div>
            <div class="date-range">${bank.startDate || ''} - ${bank.endDate || ''}</div>
        </div>
        
        <div class="section">
            <div class="bank-statement-header">
                <div class="bank-name">${bank.bankName || ''}</div>
                <div class="bank-total">Total Transactions: ${bank.transactionCount || 0} | Total Amount: ₹${bank.totalAmount || '0'}</div>
            </div>
            
            <table class="table">
                <thead>
                    <tr>
                        <th>Date & Time</th>
                        <th>Description</th>
                        <th>Category</th>
                        <th>Amount</th>
                    </tr>
                </thead>
                <tbody>
                    ${(bank.transactions || []).map(transaction => `
                    <tr>
                        <td>${transaction.formattedDateTime || ''}</td>
                        <td>${transaction.description || ''}</td>
                        <td>${transaction.categoryName || ''}</td>
                        <td class="amount ${transaction.amountClass || 'negative'}">${transaction.formattedAmount || ''}</td>
                    </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
        
        <div class="page-number">Page ${bank.pageNumber || 2}</div>
    </div>
    `).join('')}
    
    ${(data.categoryAnalysis || []).map(category => `
    <div class="page">
        <div class="header">
            <div class="title">Category Analysis</div>
            <div class="subtitle">${category.categoryName || ''}</div>
            <div class="date-range">${category.startDate || ''} - ${category.endDate || ''}</div>
        </div>
        
        <div class="section">
            <div class="stats-grid">
                <div class="stat-card">
                    <div class="stat-label">Total Spent</div>
                    <div class="stat-value expense">₹${category.totalAmount || '0'}</div>
                </div>
                <div class="stat-card">
                    <div class="stat-label">Transactions</div>
                    <div class="stat-value">${category.transactionCount || 0}</div>
                </div>
                <div class="stat-card">
                    <div class="stat-label">Percentage of Total</div>
                    <div class="stat-value">${category.percentage || '0'}%</div>
                </div>
                <div class="stat-card">
                    <div class="stat-label">Average Amount</div>
                    <div class="stat-value expense">₹${category.averageAmount || '0'}</div>
                </div>
            </div>
        </div>
        
        ${category.hasSubcategories ? `
        <div class="section">
            <div class="section-title">Subcategory Breakdown</div>
            <div class="category-breakdown">
                ${(category.subcategories || []).map(sub => `
                <div class="category-item">
                    <div class="category-name">${sub.label || ''}</div>
                    <div class="category-amount">₹${sub.sum || '0'}</div>
                    <div class="category-percentage">${sub.value || '0'}% of category</div>
                </div>
                `).join('')}
            </div>
        </div>
        ` : ''}
        
        <div class="section">
            <div class="section-title">Transactions</div>
            <table class="table">
                <thead>
                    <tr>
                        <th>Date</th>
                        <th>Description</th>
                        <th>Account</th>
                        <th>Subcategory</th>
                        <th>Amount</th>
                    </tr>
                </thead>
                <tbody>
                    ${(category.transactions || []).map(transaction => `
                    <tr>
                        <td>${transaction.formattedDate || ''}</td>
                        <td>${transaction.description || ''}</td>
                        <td>${transaction.accountName || ''}</td>
                        <td>${transaction.subcategoryName || ''}</td>
                        <td class="amount negative">₹${transaction.amount || '0'}</td>
                    </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
        
        <div class="summary-text">
            You spent <strong>₹${category.totalAmount || '0'}</strong> in ${category.categoryName || ''} over ${category.transactionCount || 0} transactions in ${category.numberOfDays || 0} days.
        </div>
        
        <div class="page-number">Page ${category.pageNumber || 3}</div>
    </div>
    `).join('')}
    
    <div class="page">
        <div class="header">
            <div class="title">All Transactions</div>
            <div class="subtitle">Complete Transaction History</div>
            <div class="date-range">${data.startDate} - ${data.endDate}</div>
        </div>
        
        <div class="section">
            <table class="table">
                <thead>
                    <tr>
                        <th>Date & Time</th>
                        <th>Description</th>
                        <th>Category</th>
                        <th>Account</th>
                        <th>Amount</th>
                    </tr>
                </thead>
                <tbody>
                    ${(data.allTransactions || []).map(transaction => `
                    <tr>
                        <td>${transaction.formattedDateTime || ''}</td>
                        <td>${transaction.description || ''}</td>
                        <td>${transaction.categoryName || ''}</td>
                        <td>${transaction.accountName || ''}</td>
                        <td class="amount ${transaction.amountClass || 'negative'}">${transaction.formattedAmount || ''}</td>
                    </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
        
        <div class="page-number">Page ${data.finalPageNumber || 1}</div>
    </div>
</body>
</html>`;
  }

}

export default PdfGenerator;
