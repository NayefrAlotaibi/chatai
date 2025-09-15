import { tool, type UIMessageStreamWriter } from 'ai';
import { z } from 'zod';
import type { Session } from 'next-auth';
import type { ChatMessage } from '@/lib/types';
import { processReceipt } from '@/lib/ai/tools/process-receipt';
import { searchWeb } from '@/lib/ai/tools/search-web';
import { createDocument } from '@/lib/ai/tools/create-document';
import { requestSuggestions } from '@/lib/ai/tools/request-suggestions';
import { categorizeTransaction } from '@/lib/ai/tools/categorize-transaction';

interface RunWorkflowProps {
  session: Session;
  dataStream: UIMessageStreamWriter<ChatMessage>;
  defaultImageUrl?: string;
}

type WorkflowContext = {
  receipt?: any;
  merchantInfo?: any;
  categorization?: { category: string; confidence: number; rationale: string };
  documentId?: string;
  title?: string;
};

export const runWorkflow = ({ session, dataStream, defaultImageUrl }: RunWorkflowProps) =>
  tool({
    description:
      'Execute a predefined multi-step workflow. Supported: "receipt_enrichment" to process image receipt, vendor search, categorize, and show artifact.',
    inputSchema: z.object({
      name: z.enum(['receipt_enrichment']).default('receipt_enrichment'),
      params: z
        .object({
          imageDescription: z.string().optional().describe('Description of the receipt image'),
          imageUrl: z.string().url().optional(),
        })
        .optional()
        .describe('Workflow parameters'),
    }),
    execute: async ({ name = 'receipt_enrichment', params }) => {
      // TODO: Fix tool calling - temporarily disabled for deployment
      return { error: 'Workflow execution temporarily disabled' };
    },
  });


