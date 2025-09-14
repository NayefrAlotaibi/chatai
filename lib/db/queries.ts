import 'server-only';

import {
  and,
  asc,
  count,
  desc,
  eq,
  gt,
  gte,
  inArray,
  lt,
  type SQL,
} from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

import {
  user,
  chat,
  type User,
  document,
  type Suggestion,
  suggestion,
  message,
  vote,
  type DBMessage,
  type Chat,
  stream,
  receipt,
  receiptItem,
  type Receipt,
  type ReceiptItem,
} from './schema';
// Note: Do not import UI ArtifactKind here; DB Document.kind only allows 'text' | 'code' | 'image' | 'sheet'
import { generateUUID } from '../utils';
import { generateHashedPassword } from './utils';
import type { VisibilityType } from '@/components/visibility-selector';
import { ChatSDKError } from '../errors';
import type { LanguageModelV2Usage } from '@ai-sdk/provider';

// Optionally, if not using email/pass login, you can
// use the Drizzle adapter for Auth.js / NextAuth
// https://authjs.dev/reference/adapter/drizzle

// biome-ignore lint: Forbidden non-null assertion.
const client = postgres(process.env.POSTGRES_URL!);
const db = drizzle(client);

export async function getUser(email: string): Promise<Array<User>> {
  try {
    return await db.select().from(user).where(eq(user.email, email));
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to get user by email',
    );
  }
}

export async function createUser(email: string, password: string) {
  const hashedPassword = generateHashedPassword(password);

  try {
    return await db.insert(user).values({ email, password: hashedPassword });
  } catch (error) {
    throw new ChatSDKError('bad_request:database', 'Failed to create user');
  }
}

export async function createGuestUser() {
  const email = `guest-${Date.now()}`;
  const password = generateHashedPassword(generateUUID());

  try {
    return await db.insert(user).values({ email, password }).returning({
      id: user.id,
      email: user.email,
    });
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to create guest user',
    );
  }
}

export async function saveChat({
  id,
  userId,
  title,
  visibility,
}: {
  id: string;
  userId: string;
  title: string;
  visibility: VisibilityType;
}) {
  try {
    return await db.insert(chat).values({
      id,
      createdAt: new Date(),
      userId,
      title,
      visibility,
    });
  } catch (error) {
    throw new ChatSDKError('bad_request:database', 'Failed to save chat');
  }
}

export async function deleteChatById({ id }: { id: string }) {
  try {
    await db.delete(vote).where(eq(vote.chatId, id));
    await db.delete(message).where(eq(message.chatId, id));
    await db.delete(stream).where(eq(stream.chatId, id));

    const [chatsDeleted] = await db
      .delete(chat)
      .where(eq(chat.id, id))
      .returning();
    return chatsDeleted;
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to delete chat by id',
    );
  }
}

export async function getChatsByUserId({
  id,
  limit,
  startingAfter,
  endingBefore,
}: {
  id: string;
  limit: number;
  startingAfter: string | null;
  endingBefore: string | null;
}) {
  try {
    const extendedLimit = limit + 1;

    const query = (whereCondition?: SQL<any>) =>
      db
        .select()
        .from(chat)
        .where(
          whereCondition
            ? and(whereCondition, eq(chat.userId, id))
            : eq(chat.userId, id),
        )
        .orderBy(desc(chat.createdAt))
        .limit(extendedLimit);

    let filteredChats: Array<Chat> = [];

    if (startingAfter) {
      const [selectedChat] = await db
        .select()
        .from(chat)
        .where(eq(chat.id, startingAfter))
        .limit(1);

      if (!selectedChat) {
        throw new ChatSDKError(
          'not_found:database',
          `Chat with id ${startingAfter} not found`,
        );
      }

      filteredChats = await query(gt(chat.createdAt, selectedChat.createdAt));
    } else if (endingBefore) {
      const [selectedChat] = await db
        .select()
        .from(chat)
        .where(eq(chat.id, endingBefore))
        .limit(1);

      if (!selectedChat) {
        throw new ChatSDKError(
          'not_found:database',
          `Chat with id ${endingBefore} not found`,
        );
      }

      filteredChats = await query(lt(chat.createdAt, selectedChat.createdAt));
    } else {
      filteredChats = await query();
    }

    const hasMore = filteredChats.length > limit;

    return {
      chats: hasMore ? filteredChats.slice(0, limit) : filteredChats,
      hasMore,
    };
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to get chats by user id',
    );
  }
}

export async function getChatById({ id }: { id: string }) {
  try {
    const [selectedChat] = await db.select().from(chat).where(eq(chat.id, id));
    if (!selectedChat) {
      return null;
    }

    return selectedChat;
  } catch (error) {
    throw new ChatSDKError('bad_request:database', 'Failed to get chat by id');
  }
}

export async function saveMessages({
  messages,
}: {
  messages: Array<DBMessage>;
}) {
  try {
    return await db.insert(message).values(messages);
  } catch (error) {
    throw new ChatSDKError('bad_request:database', 'Failed to save messages');
  }
}

export async function getMessagesByChatId({ id }: { id: string }) {
  try {
    return await db
      .select()
      .from(message)
      .where(eq(message.chatId, id))
      .orderBy(asc(message.createdAt));
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to get messages by chat id',
    );
  }
}

export async function voteMessage({
  chatId,
  messageId,
  type,
}: {
  chatId: string;
  messageId: string;
  type: 'up' | 'down';
}) {
  try {
    const [existingVote] = await db
      .select()
      .from(vote)
      .where(and(eq(vote.messageId, messageId)));

    if (existingVote) {
      return await db
        .update(vote)
        .set({ isUpvoted: type === 'up' })
        .where(and(eq(vote.messageId, messageId), eq(vote.chatId, chatId)));
    }
    return await db.insert(vote).values({
      chatId,
      messageId,
      isUpvoted: type === 'up',
    });
  } catch (error) {
    throw new ChatSDKError('bad_request:database', 'Failed to vote message');
  }
}

export async function getVotesByChatId({ id }: { id: string }) {
  try {
    return await db.select().from(vote).where(eq(vote.chatId, id));
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to get votes by chat id',
    );
  }
}

export async function saveDocument({
  id,
  title,
  kind,
  content,
  userId,
}: {
  id: string;
  title: string;
  // Restrict to DB-supported kinds only
  kind: 'text' | 'code' | 'image' | 'sheet';
  content: string;
  userId: string;
}) {
  try {
    return await db
      .insert(document)
      .values({
        id,
        title,
        kind,
        content,
        userId,
        createdAt: new Date(),
      })
      .returning();
  } catch (error) {
    throw new ChatSDKError('bad_request:database', 'Failed to save document');
  }
}

export async function getDocumentsById({ id }: { id: string }) {
  try {
    const documents = await db
      .select()
      .from(document)
      .where(eq(document.id, id))
      .orderBy(asc(document.createdAt));

    return documents;
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to get documents by id',
    );
  }
}

export async function getDocumentById({ id }: { id: string }) {
  try {
    const [selectedDocument] = await db
      .select()
      .from(document)
      .where(eq(document.id, id))
      .orderBy(desc(document.createdAt));

    return selectedDocument;
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to get document by id',
    );
  }
}

export async function deleteDocumentsByIdAfterTimestamp({
  id,
  timestamp,
}: {
  id: string;
  timestamp: Date;
}) {
  try {
    await db
      .delete(suggestion)
      .where(
        and(
          eq(suggestion.documentId, id),
          gt(suggestion.documentCreatedAt, timestamp),
        ),
      );

    return await db
      .delete(document)
      .where(and(eq(document.id, id), gt(document.createdAt, timestamp)))
      .returning();
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to delete documents by id after timestamp',
    );
  }
}

export async function saveSuggestions({
  suggestions,
}: {
  suggestions: Array<Suggestion>;
}) {
  try {
    return await db.insert(suggestion).values(suggestions);
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to save suggestions',
    );
  }
}

export async function getSuggestionsByDocumentId({
  documentId,
}: {
  documentId: string;
}) {
  try {
    return await db
      .select()
      .from(suggestion)
      .where(and(eq(suggestion.documentId, documentId)));
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to get suggestions by document id',
    );
  }
}

export async function getMessageById({ id }: { id: string }) {
  try {
    return await db.select().from(message).where(eq(message.id, id));
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to get message by id',
    );
  }
}

export async function deleteMessagesByChatIdAfterTimestamp({
  chatId,
  timestamp,
}: {
  chatId: string;
  timestamp: Date;
}) {
  try {
    const messagesToDelete = await db
      .select({ id: message.id })
      .from(message)
      .where(
        and(eq(message.chatId, chatId), gte(message.createdAt, timestamp)),
      );

    const messageIds = messagesToDelete.map((message) => message.id);

    if (messageIds.length > 0) {
      await db
        .delete(vote)
        .where(
          and(eq(vote.chatId, chatId), inArray(vote.messageId, messageIds)),
        );

      return await db
        .delete(message)
        .where(
          and(eq(message.chatId, chatId), inArray(message.id, messageIds)),
        );
    }
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to delete messages by chat id after timestamp',
    );
  }
}

export async function updateChatVisiblityById({
  chatId,
  visibility,
}: {
  chatId: string;
  visibility: 'private' | 'public';
}) {
  try {
    return await db.update(chat).set({ visibility }).where(eq(chat.id, chatId));
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to update chat visibility by id',
    );
  }
}

export async function updateChatLastContextById({
  chatId,
  context,
}: {
  chatId: string;
  // Store raw LanguageModelUsage to keep it simple
  context: LanguageModelV2Usage;
}) {
  try {
    return await db
      .update(chat)
      .set({ lastContext: context })
      .where(eq(chat.id, chatId));
  } catch (error) {
    console.warn('Failed to update lastContext for chat', chatId, error);
    return;
  }
}

export async function getMessageCountByUserId({
  id,
  differenceInHours,
}: {
  id: string;
  differenceInHours: number;
}) {
  try {
    const twentyFourHoursAgo = new Date(
      Date.now() - differenceInHours * 60 * 60 * 1000,
    );

    const [stats] = await db
      .select({ count: count(message.id) })
      .from(message)
      .innerJoin(chat, eq(message.chatId, chat.id))
      .where(
        and(
          eq(chat.userId, id),
          gte(message.createdAt, twentyFourHoursAgo),
          eq(message.role, 'user'),
        ),
      )
      .execute();

    return stats?.count ?? 0;
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to get message count by user id',
    );
  }
}

export async function createStreamId({
  streamId,
  chatId,
}: {
  streamId: string;
  chatId: string;
}) {
  try {
    await db
      .insert(stream)
      .values({ id: streamId, chatId, createdAt: new Date() });
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to create stream id',
    );
  }
}

export async function getStreamIdsByChatId({ chatId }: { chatId: string }) {
  try {
    const streamIds = await db
      .select({ id: stream.id })
      .from(stream)
      .where(eq(stream.chatId, chatId))
      .orderBy(asc(stream.createdAt))
      .execute();

    return streamIds.map(({ id }) => id);
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to get stream ids by chat id',
    );
  }
}

// Receipt-related queries
export async function saveReceipt({
  userId,
  merchantName,
  merchantAddress,
  receiptDate,
  receiptTime,
  receiptNumber,
  subtotal,
  tax,
  tip,
  total,
  paymentMethod,
  currency,
  imageUrl,
  originalImageUrl,
}: {
  userId: string;
  merchantName: string;
  merchantAddress?: string;
  receiptDate: string;
  receiptTime?: string;
  receiptNumber?: string;
  subtotal?: number;
  tax?: number;
  tip?: number;
  total: number;
  paymentMethod?: string;
  currency?: string;
  imageUrl?: string;
  originalImageUrl?: string;
}) {
  try {
    const [savedReceipt] = await db
      .insert(receipt)
      .values({
        userId,
        merchantName,
        merchantAddress: merchantAddress || undefined,
        receiptDate: receiptDate, // Ensure this is in YYYY-MM-DD format
        receiptTime: receiptTime || undefined, // Handle empty strings
        receiptNumber: receiptNumber || undefined,
        subtotal: subtotal?.toString(),
        tax: tax?.toString(),
        tip: tip?.toString(),
        total: total.toString(),
        paymentMethod: paymentMethod || undefined,
        currency: currency || 'USD',
        imageUrl: imageUrl || undefined,
        originalImageUrl: originalImageUrl || undefined,
      })
      .returning();

    return savedReceipt;
  } catch (error) {
    console.error('Database error saving receipt:', error);
    throw new ChatSDKError('bad_request:database', 'Failed to save receipt');
  }
}

export async function saveReceiptItems({
  receiptId,
  items,
}: {
  receiptId: string;
  items: Array<{
    name: string;
    quantity?: number;
    unitPrice?: number;
    totalPrice: number;
    category?: string;
    description?: string;
  }>;
}) {
  try {
    const savedItems = await db
      .insert(receiptItem)
      .values(
        items.map((item) => ({
          receiptId,
          name: item.name,
          quantity: item.quantity || 1,
          unitPrice: item.unitPrice?.toString(),
          totalPrice: item.totalPrice.toString(),
          category: item.category,
          description: item.description,
        })),
      )
      .returning();

    return savedItems;
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to save receipt items',
    );
  }
}

export async function getReceiptsByUserId({
  userId,
  limit = 50,
  offset = 0,
}: {
  userId: string;
  limit?: number;
  offset?: number;
}) {
  try {
    const receipts = await db
      .select()
      .from(receipt)
      .where(eq(receipt.userId, userId))
      .orderBy(desc(receipt.receiptDate), desc(receipt.createdAt))
      .limit(limit)
      .offset(offset);

    return receipts;
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to get receipts by user id',
    );
  }
}

export async function getReceiptWithItems({ receiptId }: { receiptId: string }) {
  try {
    const [receiptData] = await db
      .select()
      .from(receipt)
      .where(eq(receipt.id, receiptId));

    if (!receiptData) {
      return null;
    }

    const items = await db
      .select()
      .from(receiptItem)
      .where(eq(receiptItem.receiptId, receiptId))
      .orderBy(asc(receiptItem.createdAt));

    return {
      receipt: receiptData,
      items,
    };
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to get receipt with items',
    );
  }
}

export async function deleteReceipt({ receiptId }: { receiptId: string }) {
  try {
    // Items will be automatically deleted due to CASCADE
    const [deletedReceipt] = await db
      .delete(receipt)
      .where(eq(receipt.id, receiptId))
      .returning();

    return deletedReceipt;
  } catch (error) {
    throw new ChatSDKError('bad_request:database', 'Failed to delete receipt');
  }
}

// BankTransaction (raw SQL helpers — table managed in Supabase)
export async function saveBankTransaction({
  userId,
  txnDate,
  description,
  debit,
  credit,
  amount,
  balance,
  currency,
  reference,
}: {
  userId: string;
  txnDate: string; // YYYY-MM-DD
  description: string;
  debit?: number;
  credit?: number;
  amount: number;
  balance?: number;
  currency?: string;
  reference?: string;
}) {
  try {
    // Use raw SQL since BankTransaction is not in our Drizzle schema
    const query = `insert into public."BankTransaction" (
      user_id, txn_date, description, debit, credit, amount, balance, currency, reference
    ) values (
      $1, $2::date, $3, $4::numeric, $5::numeric, $6::numeric, $7::numeric, $8, $9
    ) returning *`;

    const res = await (client as any).unsafe(query, [
        userId,
        txnDate,
        description,
        debit ?? null,
        credit ?? null,
        amount,
        balance ?? null,
        currency ?? 'USD',
        reference ?? null,
      ]);

    // postgres.unsafe returns array of rows
    // biome-ignore lint: any type
    return (res as any)[0];
  } catch (error) {
    throw new ChatSDKError('bad_request:database', 'Failed to save bank transaction');
  }
}

export async function getBankTransactionsByUserId({
  userId,
  limit = 200,
}: {
  userId: string;
  limit?: number;
}) {
  try {
    const query = `select * from public."BankTransaction" where user_id = $1 order by txn_date desc, created_at desc limit $2`;
    const res = await (client as any).unsafe(query, [userId, limit]);
    // biome-ignore lint: any
    return res as any[];
  } catch (error) {
    throw new ChatSDKError('bad_request:database', 'Failed to get bank transactions');
  }
}
