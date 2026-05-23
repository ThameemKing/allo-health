export const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

export async function apiCall<T>(
  path: string,
  options?: RequestInit
): Promise<{ data?: T; error?: string; status: number }> {
  try {
    const response = await fetch(`${API_BASE}${path}`, {
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
      ...options,
    });

    const data = await response.json();

    return {
      data: response.ok ? data : undefined,
      error: !response.ok ? data.error : undefined,
      status: response.status,
    };
  } catch (error) {
    return {
      error: 'Network error',
      status: 0,
    };
  }
}
