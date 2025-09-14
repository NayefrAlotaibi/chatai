import { z } from 'zod';
import type { getWeather } from './ai/tools/get-weather';
import type { createDocument } from './ai/tools/create-document';
import type { updateDocument } from './ai/tools/update-document';
import type { requestSuggestions } from './ai/tools/request-suggestions';
import type { processReceipt } from './ai/tools/process-receipt';
import type { queryReceipts } from './ai/tools/query-receipts';
import type { InferUITool, LanguageModelUsage, UIMessage } from 'ai';
import type { runWorkflow } from './ai/tools/run-workflow';
import type { categorizeTransaction } from './ai/tools/categorize-transaction';

import type { ArtifactKind } from '@/components/artifact';
import type { Suggestion } from './db/schema';

export type DataPart = { type: 'append-message'; message: string };

export const messageMetadataSchema = z.object({
  createdAt: z.string(),
});

export type MessageMetadata = z.infer<typeof messageMetadataSchema>;

type weatherTool = InferUITool<typeof getWeather>;
type createDocumentTool = InferUITool<ReturnType<typeof createDocument>>;
type updateDocumentTool = InferUITool<ReturnType<typeof updateDocument>>;
type requestSuggestionsTool = InferUITool<
  ReturnType<typeof requestSuggestions>
>;
type processReceiptTool = InferUITool<ReturnType<typeof processReceipt>>;
type queryReceiptsTool = InferUITool<ReturnType<typeof queryReceipts>>;

export type ChatTools = {
  getWeather: weatherTool;
  createDocument: createDocumentTool;
  updateDocument: updateDocumentTool;
  requestSuggestions: requestSuggestionsTool;
  processReceipt: processReceiptTool;
  queryReceipts: queryReceiptsTool;
  runWorkflow: InferUITool<ReturnType<typeof runWorkflow>>;
  categorizeTransaction: InferUITool<ReturnType<typeof categorizeTransaction>>;
};

export type CustomUIDataTypes = {
  textDelta: string;
  imageDelta: string;
  sheetDelta: string;
  codeDelta: string;
  suggestion: Suggestion;
  appendMessage: string;
  id: string;
  title: string;
  kind: ArtifactKind;
  receipt: any;
  'step-start': { step: string; info?: any };
  'step-success': { step: string; result?: any };
  'step-error': { step: string; error: string };
  clear: null;
  finish: null;
  usage: LanguageModelUsage;
};

export type ChatMessage = UIMessage<
  MessageMetadata,
  CustomUIDataTypes,
  ChatTools
>;

export interface Attachment {
  name: string;
  url: string;
  contentType: string;
}
