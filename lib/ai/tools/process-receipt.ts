import { generateUUID } from '@/lib/utils';
import { tool, type UIMessageStreamWriter } from 'ai';
import { z } from 'zod';
import type { Session } from 'next-auth';
import { myProvider } from '@/lib/ai/providers';
import { streamObject, streamText } from 'ai';
import type { ChatMessage } from '@/lib/types';
import { saveReceipt, saveReceiptItems } from '@/lib/db/queries';

interface ProcessReceiptProps {
  session: Session;
  dataStream: UIMessageStreamWriter<ChatMessage>;
  imageUrl?: string;
}

// Define the receipt data schema
const receiptItemSchema = z.object({
  name: z.string().describe('Item name/description'),
  quantity: z.number().describe('Quantity purchased'),
  unitPrice: z.number().describe('Price per unit'),
  totalPrice: z.number().describe('Total price for this item'),
  category: z.string().describe('Item category (food, clothing, electronics, etc.)'),
});

const receiptSchema = z.object({
  merchantName: z.string().describe('Store/merchant name'),
  merchantAddress: z.string().describe('Store address'),
  receiptDate: z.string().describe('Date of purchase (YYYY-MM-DD format)'),
  receiptTime: z.string().describe('Time of purchase (HH:MM format)'),
  receiptNumber: z.string().describe('Receipt/transaction number'),
  items: z.array(receiptItemSchema).describe('List of purchased items'),
  subtotal: z.number().describe('Subtotal amount'),
  tax: z.number().describe('Tax amount'),
  tip: z.number().optional().describe('Tip amount if any'),
  total: z.number().describe('Total amount paid'),
  paymentMethod: z.string().describe('Payment method (cash, card, etc.)'),
  currency: z.string().describe('Currency code (USD, EUR, etc.)'),
});

export const processReceipt = ({ session, dataStream, imageUrl }: ProcessReceiptProps) =>
  tool({
    description:
      'Process and extract structured data from receipt images. This tool analyzes receipt images and creates a spreadsheet with itemized data.',
    inputSchema: z.object({
      imageDescription: z
        .string()
        .describe('Description of what is visible in the receipt image'),
      imageUrl: z.string().url().optional().describe('Public URL of the uploaded receipt image'),
    }),
    execute: async ({ imageDescription, imageUrl: imageUrlFromInput }) => {
      const id = generateUUID();

      // Indicate we're starting receipt processing
      dataStream.write({
        type: 'data-kind',
        data: 'receipt',
        transient: true,
      });

      dataStream.write({
        type: 'data-id',
        data: id,
        transient: true,
      });

      dataStream.write({
        type: 'data-title',
        data: 'Receipt Data',
        transient: true,
      });

      dataStream.write({
        type: 'data-clear',
        data: null,
        transient: true,
      });

      let extractedData: any = null;

      try {
        // If an image URL is available, first run a quick OCR-style transcription via vision
        let ocrText: string | null = null;
        const resolvedImageUrl = imageUrlFromInput || imageUrl;

        if (resolvedImageUrl) {
          try {
            const vision = streamText({
              model: myProvider.languageModel('chat-model'),
              messages: [
                {
                  role: 'user',
                  content: [
                    { type: 'text', text: 'Transcribe all readable text from this receipt image. Keep lines and numbers verbatim.' } as any,
                    { type: 'image', image: resolvedImageUrl } as any,
                  ],
                },
              ],
            });

            let transcript = '';
            for await (const delta of vision.fullStream) {
              if (delta.type === 'text-delta') transcript += delta.textDelta;
            }
            ocrText = transcript.trim() || null;
          } catch (err) {
            // Ignore OCR failure and fall back to provided description
            ocrText = null;
          }
        }

        // Extract structured data from receipt using OCR text (or description)
        const { fullStream } = streamObject({
          model: myProvider.languageModel('chat-model'),
          system: `You are a receipt data extraction expert. Extract structured information from receipt images with high accuracy. 
          
          Guidelines:
          - Extract all visible items with their prices
          - Calculate totals accurately
          - Identify merchant information
          - Parse dates and times correctly
          - Categorize items appropriately
          - Handle different receipt formats
          - Use standard currency formatting`,
          prompt: ocrText
            ? `Please extract all data from this receipt OCR transcript:\n\n${ocrText}`
            : `Please extract all data from this receipt description: ${imageDescription}`,
          schema: receiptSchema,
        });

        for await (const delta of fullStream) {
          if (delta.type === 'object') {
            extractedData = delta.object;
            // Attach image URL if available from input/closure
            const img = imageUrlFromInput || imageUrl;
            if (img && !extractedData.imageUrl) {
              extractedData.imageUrl = img;
            }
            // Stream structured receipt data for the receipt artifact
            dataStream.write({
              type: 'data-receipt',
              data: extractedData,
              transient: true,
            });
          }
        }

        // Save to Supabase if we have a session
        if (session?.user?.id && extractedData) {
          await saveReceiptToSupabase(extractedData, session.user.id);
        }

        dataStream.write({
          type: 'data-finish',
          data: null,
          transient: true,
        });

        return {
          id,
          title: 'Receipt Data',
          kind: 'receipt',
          content: 'Receipt has been processed and data extracted successfully.',
          extractedData,
        };
      } catch (error) {
        console.error('Error processing receipt:', error);
        return {
          error: 'Failed to process receipt. Please try again.',
        };
      }
    },
  });

function convertReceiptToCSV(data: any): string {
  if (!data) return '';
  
  const header = [
    'Item Name',
    'Quantity',
    'Unit Price',
    'Total Price',
    'Category'
  ];
  
  const rows = [header];
  
  // Add items
  if (data.items) {
    data.items.forEach((item: any) => {
      rows.push([
        item.name || '',
        item.quantity?.toString() || '1',
        item.unitPrice?.toString() || '0',
        item.totalPrice?.toString() || '0',
        item.category || 'Other'
      ]);
    });
  }
  
  // Add summary rows
  rows.push(['', '', '', '', '']);
  rows.push(['Subtotal', '', '', data.subtotal?.toString() || '0', '']);
  rows.push(['Tax', '', '', data.tax?.toString() || '0', '']);
  if (data.tip) {
    rows.push(['Tip', '', '', data.tip.toString(), '']);
  }
  rows.push(['Total', '', '', data.total?.toString() || '0', '']);
  
  // Add receipt info
  rows.push(['', '', '', '', '']);
  rows.push(['Receipt Info', '', '', '', '']);
  rows.push(['Merchant', data.merchantName || '', '', '', '']);
  rows.push(['Date', data.receiptDate || '', '', '', '']);
  rows.push(['Time', data.receiptTime || '', '', '', '']);
  rows.push(['Receipt #', data.receiptNumber || '', '', '', '']);
  rows.push(['Payment', data.paymentMethod || '', '', '', '']);
  
  return rows.map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
}

function normalizeDate(input: unknown): string {
  const today = new Date().toISOString().slice(0, 10);
  if (typeof input !== 'string') return today;
  const raw = input.trim();
  if (!raw || raw === '0000-00-00') return today;
  // Accept YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  // Accept MM/DD/YYYY
  const mdy = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (mdy) {
    const m = String(Math.min(Math.max(parseInt(mdy[1]!, 10), 1), 12)).padStart(2, '0');
    const d = String(Math.min(Math.max(parseInt(mdy[2]!, 10), 1), 31)).padStart(2, '0');
    const y = mdy[3]!;
    return `${y}-${m}-${d}`;
  }
  // Fallback: today
  return today;
}

function normalizeTime(input: unknown): string | undefined {
  if (typeof input !== 'string') return undefined;
  const raw = input.trim();
  if (!raw) return undefined;
  // Accept HH:MM(:SS)? 24h
  const hm = raw.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (hm) {
    const h = String(Math.min(Math.max(parseInt(hm[1]!, 10), 0), 23)).padStart(2, '0');
    const m = String(Math.min(Math.max(parseInt(hm[2]!, 10), 0), 59)).padStart(2, '0');
    return `${h}:${m}`;
  }
  return undefined;
}

async function saveReceiptToSupabase(data: any, userId: string) {
  try {
    console.log('Attempting to save receipt data:', data);
    console.log('User ID:', userId);
    
    // Ensure date is in proper format
    const receiptDate = normalizeDate(data.receiptDate);
    
    // Save receipt metadata
    const savedReceipt = await saveReceipt({
      userId,
      merchantName: data.merchantName || 'Unknown Merchant',
      merchantAddress: data.merchantAddress || undefined,
      receiptDate,
      receiptTime: normalizeTime(data.receiptTime),
      receiptNumber: data.receiptNumber || undefined,
      subtotal: data.subtotal,
      tax: data.tax,
      tip: data.tip,
      total: data.total || 0,
      paymentMethod: data.paymentMethod || undefined,
      currency: data.currency || 'USD',
      imageUrl: data.imageUrl || undefined,
    });

    // Save receipt items
    if (data.items && Array.isArray(data.items) && data.items.length > 0) {
      await saveReceiptItems({
        receiptId: savedReceipt.id,
        items: data.items.map((item: any) => ({
          name: item.name || 'Unknown Item',
          quantity: item.quantity || 1,
          unitPrice: item.unitPrice,
          totalPrice: item.totalPrice || 0,
          category: item.category,
        })),
      });
    }

    console.log('Receipt saved successfully:', savedReceipt.id);
    return savedReceipt;
  } catch (error) {
    console.error('Error saving receipt to database:', error);
    throw error;
  }
}
