import { auth } from '@/app/(auth)/auth';
import { getReceiptsByUserId } from '@/lib/db/queries';
import { ChatSDKError } from '@/lib/errors';

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return new ChatSDKError('unauthorized:api').toResponse();
  }

  const { searchParams } = new URL(request.url);
  const limitParam = searchParams.get('limit');
  const limit = limitParam ? Math.max(1, Math.min(100, parseInt(limitParam))) : 50;

  try {
    const receipts = await getReceiptsByUserId({ userId: session.user.id, limit });
    return Response.json(receipts, { status: 200 });
  } catch (e) {
    return new ChatSDKError('bad_request:database', 'Failed to load receipts').toResponse();
  }
}


