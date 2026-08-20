import axios, { AxiosError } from 'axios';
import type { ApiError, RequestOptions } from './api-type';
export const API_CONFIG = {
  BASE_URL: 'https://dev-sso.f88.co/cobra-sso-myf-service',
  // BASE_URL: 'https://jsonplaceholder.typicode.com',
  TIMEOUT: 30000,
  HEADERS: {
    // 'Content-Type': 'application/json',
    'deviceid': 'V2361A',
    'oauthsessionid': '95de0b13-f10c-4657-a7a2-e4200313b350',
    'x-feature-scope': 'onboarding-oauth',
    'workspaceid': '',
    'devicetoken': '',
    'Authorization': 'Bearer a1e8eee8-b03e-4ed1-8a3c-d0b2b87eef2b',
  },
} as const;

type ApiErrorResponse = {
  message?: string;
  error?: string;
};

export class ApiRequestError extends Error implements ApiError {
  status: number;
  data?: unknown;

  constructor(message: string, status: number, data?: unknown) {
    super(message);
    this.name = 'ApiRequestError';
    this.status = status;
    this.data = data;
  }
}

export const apiClient = axios.create({
  baseURL: API_CONFIG.BASE_URL,
  timeout: API_CONFIG.TIMEOUT,
  headers: API_CONFIG.HEADERS,
});

// Request Interceptor (Auth Token Injection placeholder)
apiClient.interceptors.request.use((config) => {
  // TODO: Gắn Auth Token từ Host App / Storage nếu có
  return config;
});

function getAxiosErrorMessage(
  error: AxiosError<ApiErrorResponse | string>
): string {
  const responseData = error.response?.data;

  if (typeof responseData === 'string') {
    return responseData;
  }

  if (responseData?.message) {
    return responseData.message;
  }

  if (responseData?.error) {
    return responseData.error;
  }

  if (error.code === 'ECONNABORTED') {
    return 'Request timeout';
  }

  if (error.message === 'Network Error') {
    return 'Network error';
  }

  return error.message || 'Something went wrong';
}

export function toApiRequestError(error: unknown): ApiRequestError {
  console.log(error);
  if (axios.isAxiosError<ApiErrorResponse | string>(error)) {
    return new ApiRequestError(
      getAxiosErrorMessage(error),
      error.response?.status ?? 0,
      error.response?.data
    );
  }

  if (error instanceof Error) {
    return new ApiRequestError(error.message, 0);
  }

  return new ApiRequestError('Something went wrong', 0, error);
}

// Response Interceptor (Auto transform Axios error to ApiRequestError)
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    return Promise.reject(toApiRequestError(error));
  }
);

export async function apiRequest<T>(
  endpoint: string,
  options: RequestOptions = {}
): Promise<T> {
  const { body, ...requestOptions } = options;
  const response = await apiClient.request<T>({
    ...requestOptions,
    url: endpoint,
    data: body,
  });

  return response.data;
}

export const api = {
  get: <T>(endpoint: string, options?: RequestOptions) =>
    apiRequest<T>(endpoint, { ...options, method: 'GET' }),

  post: <T, B = unknown>(
    endpoint: string,
    body?: B,
    options?: RequestOptions
  ) => apiRequest<T>(endpoint, { ...options, method: 'POST', body }),

  put: <T, B = unknown>(endpoint: string, body?: B, options?: RequestOptions) =>
    apiRequest<T>(endpoint, { ...options, method: 'PUT', body }),

  patch: <T, B = unknown>(
    endpoint: string,
    body?: B,
    options?: RequestOptions
  ) => apiRequest<T>(endpoint, { ...options, method: 'PATCH', body }),

  delete: <T>(endpoint: string, options?: RequestOptions) =>
    apiRequest<T>(endpoint, { ...options, method: 'DELETE' }),

  upload: async <T>(endpoint: string, formData: FormData): Promise<T> => {
    const url = `${API_CONFIG.BASE_URL}${endpoint}`;
    const headers: Record<string, string> = {
      ...API_CONFIG.HEADERS,
      'Content-Type': 'multipart/form-data',
    };

    console.log('================ [API UPLOAD DEBUG] ================');
    console.log(`[API Upload] Target URL: ${url}`);
    console.log(`[API Upload] Headers:`, JSON.stringify(headers, null, 2));

    // Log FormData details (React Native internal _parts format)
    // @ts-ignore
    const parts = formData._parts || [];
    console.log('[API Upload] FormData Parts:');
    parts.forEach(([key, value]: any) => {
      if (value && typeof value === 'object') {
        console.log(
          `  - ${key}: [File] uri: "${value.uri}", name: "${value.name}", type: "${value.type}"`
        );
      } else {
        console.log(`  - ${key}: [Text] "${value}"`);
      }
    });

    try {
      const response = await axios.post(url, formData, {
        headers: headers,
        timeout: 30000,
      });
      // const response = await fetch(url, {
      //     method: 'POST',
      //     body: formData,
      //     headers,
      // });
      return response.data;
    } catch (error: any) {
      console.error('[API Upload ERROR] Detailed Fetch Error:');
      console.error('  - Name:', error?.name);
      console.error('  - Message:', error?.message);
      console.error('  - Stack:', error?.stack);
      console.error(
        '  - Full Error Object:',
        JSON.stringify(error, Object.getOwnPropertyNames(error))
      );
      throw error;
    }
  },
};
