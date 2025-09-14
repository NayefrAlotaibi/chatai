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
      const ctx: WorkflowContext = {};

      if (name !== 'receipt_enrichment') {
        return { error: `Unknown workflow: ${name}` };
      }

      const emitStepStart = (step: string, info?: any) =>
        dataStream.write({ type: 'data-step-start', data: { step, info }, transient: true });
      const emitStepSuccess = (step: string, result?: any) =>
        dataStream.write({ type: 'data-step-success', data: { step, result }, transient: true });
      const emitStepError = (step: string, error: string) =>
        dataStream.write({ type: 'data-step-error', data: { step, error }, transient: true });

      // Step 1: Vision extraction
      dataStream.write({ type: 'data-title', data: 'Receipt Data', transient: true });
      dataStream.write({ type: 'data-kind', data: 'receipt', transient: true });
      dataStream.write({ type: 'data-clear', data: null, transient: true });

      emitStepStart('extract');
      try {
        const extract = processReceipt({ session, dataStream });
        const receiptResult: any = await extract.execute({
          imageDescription: params?.imageDescription || 'Receipt image',
          imageUrl: params?.imageUrl || defaultImageUrl,
        });
        if (receiptResult?.extractedData) {
          ctx.receipt = receiptResult.extractedData;
        }
        emitStepSuccess('extract', { hasData: Boolean(ctx.receipt) });
      } catch (err: any) {
        emitStepError('extract', String(err?.message || err));
        throw err;
      }

      // Step 2: Vendor search
      emitStepStart('vendor_search', { merchant: ctx.receipt?.merchantName });
      try {
        if (ctx.receipt?.merchantName) {
          const search = searchWeb({ session, dataStream });
          const vendorSearchResult: any = await search.execute({
            query: `${ctx.receipt.merchantName} official site address reviews`,
            maxResults: 5,
          });
          ctx.merchantInfo = vendorSearchResult;
        }
        emitStepSuccess('vendor_search', { found: Boolean(ctx.merchantInfo?.results?.length) });
      } catch (err: any) {
        emitStepError('vendor_search', String(err?.message || err));
      }

      // Step 3: Categorization
      emitStepStart('categorize');
      try {
        const categorize = categorizeTransaction({ session, dataStream });
        const cat = await categorize.execute({
          merchantName: ctx.receipt?.merchantName,
          merchantAddress: ctx.receipt?.merchantAddress,
          total: ctx.receipt?.total,
          currency: ctx.receipt?.currency,
          items: ctx.receipt?.items,
        });
        ctx.categorization = cat as WorkflowContext['categorization'];
        emitStepSuccess('categorize', ctx.categorization);
      } catch (err: any) {
        emitStepError('categorize', String(err?.message || err));
      }

      // Merge enrichment into receipt and re-emit for artifact consumers
      if (ctx.receipt) {
        const enriched = {
          ...ctx.receipt,
          categorization: ctx.categorization,
          vendor: ctx.merchantInfo?.results?.[0] || null,
        };

        dataStream.write({ type: 'data-receipt', data: enriched, transient: true });
      }

      // Step 4: Optional summarized artifact document (kept inside the same artifact stream)
      // If needed, we could also create a text artifact. For now, we stick to receipt artifact only.

      dataStream.write({ type: 'data-finish', data: null, transient: true });

      return {
        success: true,
        workflow: name,
        receipt: ctx.receipt,
        categorization: ctx.categorization,
        vendor: ctx.merchantInfo,
      };
    },
  });


