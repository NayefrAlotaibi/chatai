import { ChatSDKError } from '@/lib/errors';

export async function GET(request: Request) {
	const { searchParams } = new URL(request.url);
	const q = searchParams.get('q');
	const max = Number(searchParams.get('max') || '5');

	if (!q) {
		return new ChatSDKError('bad_request:api', 'Missing q').toResponse();
	}

	const apiKey = process.env.TAVILY_API_KEY;
	if (!apiKey) {
		return new ChatSDKError('bad_request:api', 'Missing TAVILY_API_KEY').toResponse();
	}

	try {
		const res = await fetch('https://api.tavily.com/search', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'Authorization': `Bearer ${apiKey}`,
			},
			body: JSON.stringify({
				query: q,
				max_results: Math.min(Math.max(1, max), 10),
				include_answer: true,
				search_depth: 'advanced',
			}),
		});

		if (!res.ok) {
			return new ChatSDKError('bad_request:api', 'Search failed').toResponse();
		}

		const data = await res.json();
		return Response.json(data, { status: 200 });
	} catch (e: any) {
		return new ChatSDKError('bad_request:api', e?.message || 'Search failed').toResponse();
	}
}
