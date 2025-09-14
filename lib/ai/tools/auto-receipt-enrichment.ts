import { tool, type UIMessageStreamWriter } from 'ai';
import type { Session } from 'next-auth';
import type { ChatMessage } from '@/lib/types';
import { runWorkflow } from '@/lib/ai/tools/run-workflow';

interface AutoReceiptEnrichmentProps {
  session: Session;
  dataStream: UIMessageStreamWriter<ChatMessage>;
  defaultImageUrl?: string;
}

export const autoReceiptEnrichment = ({ session, dataStream, defaultImageUrl }: AutoReceiptEnrichmentProps) =>
  tool({
    description:
      'Automatically run the receipt enrichment workflow using the latest attached receipt image. No input required.',
    parameters: z.object({}).passthrough().optional() as any,
    // Using parameters to allow zero-input call; AI SDK tolerates empty
    execute: async () => {
      const wf = runWorkflow({ session, dataStream, defaultImageUrl });
      return wf.execute({ name: 'receipt_enrichment', params: {} as any });
    },
  });


