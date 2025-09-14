import { auth } from '@/app/(auth)/auth';
import { ChatSDKError } from '@/lib/errors';
import { getBankTransactionsByUserId } from '@/lib/db/queries';

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return new ChatSDKError('unauthorized:api').toResponse();
  }

  try {
    const txns = await getBankTransactionsByUserId({ userId: session.user.id, limit: 2000 });

    let totalCredits = 0;
    let totalDebits = 0;
    let netAmount = 0;
    let latestBalance: number | null = null;
    let currency = 'USD';

    for (const t of txns) {
      const c = Number(t.credit || 0);
      const d = Number(t.debit || 0);
      const a = Number(t.amount || c - d || 0);
      totalCredits += c;
      totalDebits += d;
      netAmount += a;
      if (t.balance !== null && t.balance !== undefined) {
        latestBalance = Number(t.balance);
      }
      if (t.currency) currency = t.currency;
    }

    return Response.json(
      {
        totalCredits,
        totalDebits,
        netAmount,
        transactionsCount: txns.length,
        latestBalance,
        currency,
      },
      { status: 200 },
    );
  } catch (e) {
    return new ChatSDKError('bad_request:api', 'Failed to get bank overview').toResponse();
  }
}


