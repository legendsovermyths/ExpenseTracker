import { supabase } from './Supabase';
import { PdfGenerator } from './PdfGenerator';
import { getLastMonthRange } from './_Utils';
import { Transaction } from '../types/entity/Transaction';
import { Account } from '../types/entity/Account';
import { Category } from '../types/entity/Category';

/**
 * Send monthly report email with PDF attachment
 * This function is extracted to avoid circular imports with the scheduler
 */
export const sendMonthlyReportEmail = async (
  transactions: Transaction[],
  accountsById: Record<number, Account>,
  categoriesById: Record<number, Category>,
  monthlyBalance: number,
  userEmail: string
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
      body: {
        to: userEmail,
        pdfBase64,
      },
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
