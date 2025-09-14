import { tool, type UIMessageStreamWriter } from 'ai';
import { z } from 'zod';
import type { Session } from 'next-auth';
import type { ChatMessage } from '@/lib/types';
import { 
  getReceiptsByUserId, 
  getReceiptWithItems 
} from '@/lib/db/queries';

interface QueryReceiptsProps {
  session: Session;
  dataStream: UIMessageStreamWriter<ChatMessage>;
}

export const queryReceipts = ({ session, dataStream }: QueryReceiptsProps) =>
  tool({
    description:
      'Query and retrieve receipt data from the database. Can search receipts, analyze spending patterns, filter by date ranges, merchants, or categories.',
    inputSchema: z.object({
      queryType: z.enum(['list_recent', 'search_merchant', 'date_range', 'spending_summary', 'category_breakdown', 'specific_receipt']).describe('Type of query to perform'),
      merchantName: z.string().optional().describe('Filter by merchant name'),
      startDate: z.string().optional().describe('Start date for filtering (YYYY-MM-DD)'),
      endDate: z.string().optional().describe('End date for filtering (YYYY-MM-DD)'),
      receiptId: z.string().optional().describe('Specific receipt ID to retrieve'),
      limit: z.number().optional().describe('Number of results to return (default 10)'),
      category: z.string().optional().describe('Filter by item category'),
    }),
    execute: async ({ queryType, merchantName, startDate, endDate, receiptId, limit = 10, category }) => {
      if (!session?.user?.id) {
        return {
          error: 'User not authenticated',
        };
      }

      try {
        let results: any = {};

        switch (queryType) {
          case 'list_recent':
            const recentReceipts = await getReceiptsByUserId({
              userId: session.user.id,
              limit,
            });

            let featuredReceipt: any | undefined = undefined;
            if (recentReceipts.length > 0) {
              const mostRecent = recentReceipts[0];
              try {
                const detailed = await getReceiptWithItems({ receiptId: mostRecent.id });
                if (detailed) {
                  featuredReceipt = detailed;
                }
              } catch (e) {
                // best-effort; non-fatal
              }
            }

            results = {
              type: 'recent_receipts',
              count: recentReceipts.length,
              receipts: recentReceipts.map(receipt => ({
                id: receipt.id,
                merchantName: receipt.merchantName,
                total: receipt.total,
                date: receipt.receiptDate,
                currency: receipt.currency,
              })),
              featuredReceipt,
            };
            break;

          case 'specific_receipt':
            if (!receiptId) {
              return { error: 'Receipt ID is required for specific receipt query' };
            }
            
            const receiptWithItems = await getReceiptWithItems({ receiptId });
            if (!receiptWithItems) {
              return { error: 'Receipt not found' };
            }

            results = {
              type: 'detailed_receipt',
              receipt: receiptWithItems.receipt,
              items: receiptWithItems.items,
              itemCount: receiptWithItems.items.length,
            };
            break;

          case 'search_merchant':
            if (!merchantName) {
              return { error: 'Merchant name is required for merchant search' };
            }
            
            const allReceipts = await getReceiptsByUserId({
              userId: session.user.id,
              limit: 100, // Get more for filtering
            });
            
            const merchantReceipts = allReceipts.filter(receipt => 
              receipt.merchantName.toLowerCase().includes(merchantName.toLowerCase())
            ).slice(0, limit);

            results = {
              type: 'merchant_receipts',
              merchantName,
              count: merchantReceipts.length,
              receipts: merchantReceipts,
              totalSpent: merchantReceipts.reduce((sum, receipt) => 
                sum + parseFloat(receipt.total || '0'), 0
              ),
            };
            break;

          case 'date_range':
            const receiptsInRange = await getReceiptsByUserId({
              userId: session.user.id,
              limit: 100,
            });
            
            const filteredByDate = receiptsInRange.filter(receipt => {
              const receiptDate = new Date(receipt.receiptDate);
              const start = startDate ? new Date(startDate) : new Date('1900-01-01');
              const end = endDate ? new Date(endDate) : new Date();
              return receiptDate >= start && receiptDate <= end;
            }).slice(0, limit);

            results = {
              type: 'date_range_receipts',
              startDate,
              endDate,
              count: filteredByDate.length,
              receipts: filteredByDate,
              totalSpent: filteredByDate.reduce((sum, receipt) => 
                sum + parseFloat(receipt.total || '0'), 0
              ),
            };
            break;

          case 'spending_summary':
            const allUserReceipts = await getReceiptsByUserId({
              userId: session.user.id,
              limit: 100,
            });

            const summary = {
              totalReceipts: allUserReceipts.length,
              totalSpent: allUserReceipts.reduce((sum, receipt) => 
                sum + parseFloat(receipt.total || '0'), 0
              ),
              avgSpent: allUserReceipts.length > 0 
                ? allUserReceipts.reduce((sum, receipt) => 
                    sum + parseFloat(receipt.total || '0'), 0
                  ) / allUserReceipts.length 
                : 0,
              topMerchants: getTopMerchants(allUserReceipts),
              spendingByMonth: getSpendingByMonth(allUserReceipts),
            };

            results = {
              type: 'spending_summary',
              summary,
            };
            break;

          default:
            return { error: 'Unknown query type' };
        }

        // Generate a readable response
        const response = generateReadableResponse(results);
        
        return {
          success: true,
          queryType,
          results,
          response,
        };

      } catch (error) {
        console.error('Error querying receipts:', error);
        return {
          error: 'Failed to query receipts from database',
        };
      }
    },
  });

function getTopMerchants(receipts: any[]) {
  const merchantTotals: { [key: string]: number } = {};
  
  receipts.forEach(receipt => {
    const merchant = receipt.merchantName;
    const amount = parseFloat(receipt.total || '0');
    merchantTotals[merchant] = (merchantTotals[merchant] || 0) + amount;
  });

  return Object.entries(merchantTotals)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 5)
    .map(([merchant, total]) => ({ merchant, total }));
}

function getSpendingByMonth(receipts: any[]) {
  const monthlySpending: { [key: string]: number } = {};
  
  receipts.forEach(receipt => {
    const date = new Date(receipt.receiptDate);
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    const amount = parseFloat(receipt.total || '0');
    monthlySpending[monthKey] = (monthlySpending[monthKey] || 0) + amount;
  });

  return Object.entries(monthlySpending)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, total]) => ({ month, total }));
}

function generateReadableResponse(results: any): string {
  switch (results.type) {
    case 'recent_receipts':
      return `Found ${results.count} recent receipts. Total spending: ${
        results.receipts.reduce((sum: number, r: any) => sum + parseFloat(r.total || '0'), 0).toFixed(2)
      }`;
      
    case 'detailed_receipt':
      return `Receipt from ${results.receipt.merchantName} on ${results.receipt.receiptDate}. ` +
             `Total: ${results.receipt.total} ${results.receipt.currency}. ` +
             `${results.itemCount} items purchased.`;
             
    case 'merchant_receipts':
      return `Found ${results.count} receipts from ${results.merchantName}. ` +
             `Total spent: ${results.totalSpent.toFixed(2)}`;
             
    case 'date_range_receipts':
      return `Found ${results.count} receipts between ${results.startDate} and ${results.endDate}. ` +
             `Total spent: ${results.totalSpent.toFixed(2)}`;
             
    case 'spending_summary':
      return `You have ${results.summary.totalReceipts} receipts totaling ${results.summary.totalSpent.toFixed(2)}. ` +
             `Average per receipt: ${results.summary.avgSpent.toFixed(2)}`;
             
    default:
      return 'Query completed successfully.';
  }
}
