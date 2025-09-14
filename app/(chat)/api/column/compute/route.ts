import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/app/(auth)/auth';
import { myProvider } from '@/lib/ai/providers';

const BodySchema = z.object({
  model: z.string().default('chat-model'),
  prompt: z.string(),
  rows: z.array(z.record(z.any())),
  targetKey: z.string(),
  files: z
    .array(
      z.object({
        name: z.string(),
        url: z.string().url(),
        type: z.string().optional(),
      }),
    )
    .optional(),
});

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: z.infer<typeof BodySchema>;
  try {
    body = BodySchema.parse(await req.json());
  } catch (e) {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }

  const { model, prompt, rows, targetKey, files } = body;

  const modelInstance = myProvider.languageModel(model);

  const results: Array<string> = [];
  for (const row of rows) {
    const userPrompt = prompt
      .replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key) => String(row[key] ?? ''))
      .slice(0, 4000);

    const parts: any[] = [{ type: 'text', text: userPrompt }];
    for (const f of files || []) {
      parts.push({ type: 'file', url: f.url, mediaType: f.type ?? 'application/octet-stream' });
    }

    try {
      const { text } = await modelInstance.doGenerate({
        inputFormat: 'messages',
        messages: [
          { role: 'system', content: 'Return only the final value for the target cell. No explanations.' },
          { role: 'user', content: parts },
        ],
      } as any);
      results.push(String(text ?? ''));
    } catch {
      results.push('');
    }
  }

  const updatedRows = rows.map((row, idx) => ({ ...row, [targetKey]: results[idx] ?? '' }));
  return NextResponse.json({ rows: updatedRows });
}


