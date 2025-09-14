import { auth } from '@/app/(auth)/auth';
import { ChatSDKError } from '@/lib/errors';
import { saveReceipt, saveReceiptItems } from '@/lib/db/queries';

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return new ChatSDKError('unauthorized:api').toResponse();
  }

  try {
    const body = await request.json();
    const rows = body?.rows as Array<any>;
    if (!Array.isArray(rows) || rows.length === 0) {
      return new ChatSDKError('bad_request:api', 'No rows provided').toResponse();
    }

    for (const r of rows) {
      // Normalize date
      const date = r.receiptDate
        ? new Date(r.receiptDate).toISOString().split('T')[0]
        : new Date().toISOString().split('T')[0];

      const saved = await saveReceipt({
        userId: session.user.id,
        merchantName: String(r.merchantName || 'Unknown Merchant'),
        merchantAddress: undefined,
        receiptDate: date,
        receiptTime: undefined,
        receiptNumber: r.receiptNumber || undefined,
        subtotal: r.subtotal ? Number(r.subtotal) : undefined,
        tax: r.tax ? Number(r.tax) : undefined,
        tip: r.tip ? Number(r.tip) : undefined,
        total: r.total ? Number(r.total) : 0,
        paymentMethod: undefined,
        currency: r.currency || 'USD',
        imageUrl: undefined,
      });

      // Optionally, we could save a single item aggregating the amount
      await saveReceiptItems({
        receiptId: saved.id,
        items: [
          {
            name: r.merchantName || 'Transaction',
            quantity: 1,
            unitPrice: r.total ? Number(r.total) : 0,
            totalPrice: r.total ? Number(r.total) : 0,
            category: undefined,
          },
        ],
      });
    }

    return Response.json({ success: true }, { status: 200 });
  } catch (e) {
    return new ChatSDKError('bad_request:api', 'Failed to import').toResponse();
  }
}


