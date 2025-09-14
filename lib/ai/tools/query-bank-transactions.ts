import { tool, type UIMessageStreamWriter } from 'ai';
import { z } from 'zod';
import type { Session } from 'next-auth';
import type { ChatMessage } from '@/lib/types';
import { getBankTransactionsByUserId } from '@/lib/db/queries';

interface QueryBankTransactionsProps {
	session: Session;
	dataStream: UIMessageStreamWriter<ChatMessage>;
}

export const queryBankTransactions = ({ session, dataStream }: QueryBankTransactionsProps) =>
	tool({
		description:
			'Query and retrieve bank transactions from the Supabase table. Filter by date range, limit by number of transactions, or match text in the description.',
		inputSchema: z.object({
			queryType: z
				.enum(['date_range', 'recent', 'search_description'])
				.describe('Type of query to perform'),
			startDate: z
				.string()
				.optional()
				.describe('Start date (YYYY-MM-DD) when queryType is date_range'),
			endDate: z
				.string()
				.optional()
				.describe('End date (YYYY-MM-DD) when queryType is date_range'),
			limit: z
				.number()
				.optional()
				.describe('Max number of transactions to return (default 50, max 500)'),
			descriptionQuery: z
				.string()
				.optional()
				.describe('Case-insensitive substring to match in description when queryType is search_description'),
		}),
		execute: async ({ queryType, startDate, endDate, limit = 50, descriptionQuery }) => {
			if (!session?.user?.id) {
				return { error: 'User not authenticated' };
			}

			try {
				const safeLimit = Math.min(Math.max(1, limit), 500);

				// Fetch a superset to filter in-memory when needed
				const base = await getBankTransactionsByUserId({
					userId: session.user.id,
					limit: Math.max(200, safeLimit),
				});

				let transactions = base as any[];

				if (queryType === 'date_range') {
					const start = startDate ? new Date(startDate) : new Date('1900-01-01');
					const end = endDate ? new Date(endDate) : new Date();
					transactions = transactions.filter((t) => {
						const d = new Date(t.txn_date || t.txnDate);
						return d >= start && d <= end;
					});
				}

				if (queryType === 'search_description') {
					if (!descriptionQuery) {
						return { error: 'descriptionQuery is required for search_description' };
					}
					const q = descriptionQuery.toLowerCase();
					transactions = transactions.filter((t) => String(t.description || '').toLowerCase().includes(q));
				}

				// For recent, we just take the top N from already-ordered result
				const sliced = transactions.slice(0, safeLimit);

				const totalDebits = sliced
					.filter((t) => Number(t.amount) < 0)
					.reduce((sum, t) => sum + Math.abs(Number(t.amount || 0)), 0);
				const totalCredits = sliced
					.filter((t) => Number(t.amount) > 0)
					.reduce((sum, t) => sum + Number(t.amount || 0), 0);

				const result = {
					type: 'bank_transactions',
					queryType,
					count: sliced.length,
					startDate,
					endDate,
					descriptionQuery,
					 totals: {
						debits: Number(totalDebits.toFixed(2)),
						credits: Number(totalCredits.toFixed(2)),
					},
					transactions: sliced.map((t) => ({
						id: t.id,
						date: String(t.txn_date || t.txnDate || ''),
						description: String(t.description || ''),
						debit: t.debit != null ? Number(t.debit) : Number(t.amount) < 0 ? Math.abs(Number(t.amount)) : 0,
						credit: t.credit != null ? Number(t.credit) : Number(t.amount) > 0 ? Number(t.amount) : 0,
						amount: Number(t.amount || 0),
						balance: t.balance != null ? Number(t.balance) : undefined,
						currency: t.currency || 'USD',
						reference: t.reference || undefined,
					})),
				};

				return {
					success: true,
					results: result,
					response: generateReadableResponse(result),
				};
			} catch (error) {
				console.error('Error querying bank transactions:', error);
				return { error: 'Failed to query bank transactions' };
			}
		},
	});

function generateReadableResponse(results: any): string {
	if (results.type !== 'bank_transactions') return 'Query completed successfully.';
	const { count, totals, queryType, startDate, endDate, descriptionQuery } = results;
	if (queryType === 'date_range') {
		return `Found ${count} transactions between ${startDate || 'beginning'} and ${endDate || 'today'}. Credits: ${totals.credits.toFixed(2)}, Debits: ${totals.debits.toFixed(2)}`;
	}
	if (queryType === 'search_description') {
		return `Found ${count} transactions matching "${descriptionQuery}". Credits: ${totals.credits.toFixed(2)}, Debits: ${totals.debits.toFixed(2)}`;
	}
	return `Showing ${count} recent transactions. Credits: ${totals.credits.toFixed(2)}, Debits: ${totals.debits.toFixed(2)}`;
}
