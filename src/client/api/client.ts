interface ErrorResponse {
	error?: string;
}

export async function request<T>(url: string, options: RequestInit = {}): Promise<T> {
	const headers = new Headers(options.headers);

	if(options.body && !headers.has('Content-Type')) {
		headers.set('Content-Type', 'application/json');
	}

	const response = await fetch(url, {
		...options,
		credentials: 'include',
		headers,
	});

	const contentType = response.headers.get('content-type') ?? '';

	let data: unknown = null;

	if(contentType.includes('application/json')) {
		data = await response.json();
	}

	if(
		!response.ok) {
		const errorResponse = data as ErrorResponse | null;

		throw new Error(
			errorResponse?.error ?? 'Request failed',
		);
	}

	return data as T;
}