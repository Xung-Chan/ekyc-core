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
    // const url = `${API_CONFIG.BASE_URL}${endpoint}`;
    const url = `https://api.escuelajs.co/api/v1/files/upload`;
    return new Promise<T>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', url);

      // Gắn headers xác thực từ API_CONFIG
      Object.entries(API_CONFIG.HEADERS).forEach(([key, value]) => {
        xhr.setRequestHeader(key, value);
      });

      xhr.timeout = API_CONFIG.TIMEOUT;

      xhr.onreadystatechange = () => {
        if (xhr.readyState !== 4) return;
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            resolve(JSON.parse(xhr.responseText) as T);
          } catch {
            resolve(xhr.responseText as unknown as T);
          }
        } else {
          reject(
            new ApiRequestError(
              xhr.responseText || `HTTP ${xhr.status}`,
              xhr.status
            )
          );
        }
      };

      xhr.onerror = () => reject(new ApiRequestError('Network error', 0));
      xhr.ontimeout = () => reject(new ApiRequestError('Request timeout', 0));

      xhr.send(formData);
    });
  },
};

/**
 * Chuyển file:// URI thành data: URI (base64) để upload an toàn.
 *
 * Lý do: RN's NetworkingModule (OkHttp) gặp "Stream Closed" khi đọc
 * FileInputStream từ file:// URI. Cách fix: load file vào memory qua
 * fetch(file://...) → Blob → FileReader.readAsDataURL → data: URI.
 * Data URI được NetworkingModule xử lý trực tiếp, không qua FileInputStream.
 */
export async function uploadFileUri(uri: string): Promise<string> {
  const response = await fetch(uri);
  const blob = await response.blob();
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('FileReader: cannot read file'));
    reader.readAsDataURL(blob);
  });
}
