import { tool, type UIMessageStreamWriter, streamObject } from 'ai';
import { z } from 'zod';
import type { Session } from 'next-auth';
import { myProvider } from '@/lib/ai/providers';
import type { ChatMessage } from '@/lib/types';

interface CategorizeTransactionProps {
  session: Session;
  dataStream: UIMessageStreamWriter<ChatMessage>;
}

export const categorizeTransaction = ({ session, dataStream }: CategorizeTransactionProps) =>
  tool({
    description:
      'Categorize a financial transaction using merchant and line-item details. Returns a high-level category and confidence.',
    inputSchema: z.object({
      merchantName: z.string().optional(),
      merchantAddress: z.string().optional(),
      total: z.number().optional(),
      currency: z.string().optional(),
      items: z
        .array(
          z.object({
            name: z.string().optional(),
            quantity: z.number().optional(),
            totalPrice: z.number().optional(),
            category: z.string().optional(),
          }),
        )
        .optional(),
    }),
    execute: async ({ merchantName, merchantAddress, total, currency, items }) => {
      const { fullStream } = streamObject({
        model: myProvider.languageModel('artifact-model'),
        system:
          'You are a transaction categorization service. Map each transaction to a single top-level category (e.g., "Groceries", "Restaurants", "Transportation", "Utilities", "Shopping", "Entertainment", "Healthcare", "Travel", "Services", "Other"). Provide a confidence 0-1 and a short rationale.',
        prompt: `Merchant: ${merchantName || 'Unknown'}\nAddress: ${merchantAddress || ''}\nTotal: ${total ?? ''} ${currency || ''}\nItems: ${JSON.stringify(items || [])}`,
        schema: z.object({
          category: z.string(),
          confidence: z.number().min(0).max(1),
          rationale: z.string(),
        }),
      });

      let result: { category: string; confidence: number; rationale: string } | null = null;
      for await (const delta of fullStream) {
        if (delta.type === 'object') {
          result = delta.object as typeof result extends infer T ? T : any;
        }
      }

      if (!result) {
        return { category: 'Other', confidence: 0.3, rationale: 'Fallback categorization' };
      }

      return result;
    },
  });


