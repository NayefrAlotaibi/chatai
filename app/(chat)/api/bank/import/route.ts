import { auth } from '@/app/(auth)/auth';
import { ChatSDKError } from '@/lib/errors';
import { saveBankTransaction } from '@/lib/db/queries';

type Row = {
	receiptDate: string;
	merchantName: string;
	subtotal?: number;
	tax?: number;
	tip?: number;
	total: number;
	currency?: string;
	receiptNumber?: string;
	balance?: number;
};

export async function POST(request: Request) {
	const session = await auth();
	if (!session?.user?.id) {
		return new ChatSDKError('unauthorized:api').toResponse();
	}

	try {
		const body = await request.json();
		const rows = body?.rows as Array<Row>;
		if (!Array.isArray(rows) || rows.length === 0) {
			return new ChatSDKError('bad_request:api', 'No rows provided').toResponse();
		}

		for (const r of rows) {
			if (!r.receiptDate || !r.merchantName || typeof r.total !== 'number') {
				return new ChatSDKError(
					'bad_request:api',
					'Missing required fields: date, description, amount',
				).toResponse();
			}

			const date = new Date(r.receiptDate);
			const isoDate = isNaN(date.getTime())
				? new Date().toISOString().split('T')[0]
				: date.toISOString().split('T')[0];

			await saveBankTransaction({
				userId: session.user.id,
				txnDate: isoDate,
				description: String(r.merchantName || 'Transaction'),
				debit: r.total < 0 ? Math.abs(r.total) : undefined,
				credit: r.total > 0 ? r.total : undefined,
				amount: r.total,
				balance: r.balance,
				currency: r.currency || 'USD',
				reference: r.receiptNumber,
			});
		}

		return Response.json({ success: true }, { status: 200 });
	} catch (e: any) {
		return new ChatSDKError('bad_request:api', e?.message || 'Failed to import').toResponse();
	}
}


