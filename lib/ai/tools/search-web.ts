import { tool, type UIMessageStreamWriter } from 'ai';
import { z } from 'zod';
import type { Session } from 'next-auth';
import type { ChatMessage } from '@/lib/types';

interface SearchWebProps {
	session: Session;
	dataStream: UIMessageStreamWriter<ChatMessage>;
}

export const searchWeb = ({ session, dataStream }: SearchWebProps) =>
	tool({
		description:
			"Search the web for up-to-date information. Returns concise results with sources.",
		inputSchema: z.object({
			query: z.string().min(2).describe('Search query'),
			maxResults: z.number().optional().describe('Max number of results (default 5)'),
		}),
		execute: async ({ query, maxResults = 5 }) => {
			if (!session?.user?.id) {
				return { error: 'User not authenticated' };
			}

			const apiKey = process.env.TAVILY_API_KEY;
			if (!apiKey) {
				return { error: 'Missing TAVILY_API_KEY' };
			}

			try {
				const res = await fetch('https://api.tavily.com/search', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						api_key: apiKey,
						query,
						max_results: Math.min(Math.max(1, maxResults), 10),
						include_answer: true,
						search_depth: 'advanced',
					}),
				});
				if (!res.ok) {
					return { error: 'Search provider error' };
				}
				const data = await res.json();

				const results = Array.isArray(data.results) ? data.results : data?.results ?? [];
				const answer = typeof data?.answer === 'string' ? data.answer : undefined;
				const items = results.slice(0, maxResults).map((r: any) => ({
					title: r.title || r.url,
					snippet: r.content || r.snippet || '',
					url: r.url,
					score: r.score,
				}));

				return {
					success: true,
					query,
					answer,
					results: items,
					response: answer || summarize(items),
				};
			} catch (error) {
				console.error('Error searching web:', error);
				return { error: 'Failed to search the web' };
			}
		},
	});

function summarize(items: Array<{ title: string; url: string; snippet: string }>): string {
	if (!items.length) return 'No results found.';
	const top = items[0];
	return `Top result: ${top.title}. More: ${items.slice(1).map((i) => i.title).join('; ')}`;
}
