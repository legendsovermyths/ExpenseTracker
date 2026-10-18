import { supabase } from './Supabase';
import { PdfGenerator } from './PdfGenerator';
import { getLastMonthRange } from './Utils';
import { Transaction } from '../types/entity/Transaction';
import { Account } from '../types/entity/Account';
import { Category } from '../types/entity/Category';

/**
 * Emails last month's report PDF to the signed-in user. The `send-mail`
 * function always sends to the account's own verified email.
 * Extracted to avoid circular imports with the scheduler.
 */
export const sendMonthlyReportEmail = async (
  transactions: Transaction[],
  accountsById: Record<number, Account>,
  categoriesById: Record<number, Category>,
  monthlyBalance: number,
): Promise<any> => {
  try {
    const { start, end } = getLastMonthRange();
    const pdfGenerator = new PdfGenerator(
      transactions,
      accountsById,
      categoriesById,
      monthlyBalance
    );
    const pdfBase64 = await pdfGenerator.generatePdfBase64(start, end);

    const { data, error } = await supabase.functions.invoke('send-mail', {
      body: { pdfBase64 },
    });

    if (error) {
      console.error('Error sending mail:', error);
      throw error;
    }

    console.log('Mail sent successfully:', data);
    return data;
  } catch (err) {
    console.error('sendMonthlyReportEmail failed:', err);
    throw err;
  }
};
