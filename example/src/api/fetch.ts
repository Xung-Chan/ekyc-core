import axios, { AxiosError } from 'axios';
import Config from 'react-native-config';
import ReactNativeBlobUtil from 'react-native-blob-util';
import { ApiError, type RequestOptions } from './api-type';
export const API_CONFIG = {
  BASE_URL: Config.BASE_URL || 'https://jsonplaceholder.typicode.com',
  TIMEOUT: 30000,
  HEADERS: {
    'deviceid': 'V2361A',
    'oauthsessionid': Config.OAUTH_SESSION_ID || '',
    'x-feature-scope': 'onboarding-oauth',
    'workspaceid': '',
    'devicetoken': '',
    'Authorization': `Bearer ${Config.ACCESS_TOKEN}`,
  },
} as const;

type ApiErrorResponse = {
  message?: string;
  error?: string;
};

export const apiClient = axios.create({
  baseURL: API_CONFIG.BASE_URL,
  timeout: API_CONFIG.TIMEOUT,
  headers: API_CONFIG.HEADERS,
});

export function generateCurlCommand(config: any): string {
  const method = (config.method || 'GET').toUpperCase();
  const url = config.baseURL
    ? `${config.baseURL.replace(/\/$/, '')}/${(config.url || '').replace(/^\//, '')}`
    : config.url || '';

  const curlParts = [`curl -X ${method} "${url}"`];

  // Extract headers
  const headers = config.headers
    ? typeof config.headers.toJSON === 'function'
      ? config.headers.toJSON()
      : config.headers
    : {};

  Object.entries(headers).forEach(([key, value]) => {
    if (value === undefined || value === null) return;
    const lowerKey = key.toLowerCase();
    if (
      ['common', 'delete', 'get', 'head', 'post', 'put', 'patch'].includes(
        lowerKey
      )
    ) {
      return;
    }
    curlParts.push(`-H "${key}: ${value}"`);
  });

  // Data/Body
  if (config.data) {
    if (
      config.data instanceof FormData ||
      (config.data &&
        typeof config.data === 'object' &&
        '_parts' in config.data)
    ) {
      const parts = (config.data as any)._parts || [];
      parts.forEach(([key, value]: [string, any]) => {
        if (value && typeof value === 'object' && value.uri) {
          // File object in RN FormData
          const displayUri = value.uri.startsWith('data:')
            ? `${value.uri.substring(0, 50)}...[truncated base64]...`
            : value.uri;
          curlParts.push(
            `-F "${key}=@${displayUri};type=${value.type || ''};filename=${value.name || ''}"`
          );
        } else {
          // Regular field
          const strValue =
            typeof value === 'object' ? JSON.stringify(value) : String(value);
          curlParts.push(`-F "${key}=${strValue}"`);
        }
      });
    } else {
      // JSON or text data
      const dataStr =
        typeof config.data === 'string'
          ? config.data
          : JSON.stringify(config.data);
      curlParts.push(`-d '${dataStr}'`);
    }
  }

  return curlParts.join(' \\\n  ');
}

export function generateCurlForRNBU(
  method: string,
  url: string,
  headers: any,
  fields: any[]
): string {
  const curlParts = [`curl -X ${method.toUpperCase()} "${url}"`];

  // Headers
  Object.entries(headers).forEach(([key, value]) => {
    if (value === undefined || value === null) return;
    curlParts.push(`-H "${key}: ${value}"`);
  });

  // Fields (multipart data)
  fields.forEach((field) => {
    const name = field.name;
    const dataVal = field.data;

    // Check if the data is a wrapped file path
    if (
      typeof dataVal === 'string' &&
      (dataVal.startsWith('ReactNativeBlobUtil-file://') ||
        dataVal.startsWith('RNFetchBlob-file://'))
    ) {
      // It's a file path wrapped by RNBU
      const filePath = dataVal
        .replace('ReactNativeBlobUtil-file://', '')
        .replace('RNFetchBlob-file://', '');

      const filename = field.filename || 'file.jpg';
      const type = field.type || 'image/jpeg';
      curlParts.push(
        `-F "${name}=@${filePath};type=${type};filename=${filename}"`
      );
    } else if (typeof dataVal === 'string' && dataVal.length > 500) {
      // Handle fallback/manual base64 if it's there
      const displayData = `${dataVal.substring(0, 50)}...[truncated base64]...`;
      curlParts.push(`-F "${name}=${displayData}"`);
    } else {
      // Regular field
      curlParts.push(`-F "${name}=${dataVal}"`);
    }
  });

  return curlParts.join(' \\\n  ');
}

// Request Interceptor (Auth Token Injection placeholder & Curl Logger)
apiClient.interceptors.request.use((config) => {
  // TODO: Gắn Auth Token từ Host App / Storage nếu có
  try {
    const curl = generateCurlCommand(config);
    console.log('=== CURL REQUEST ===\n' + curl + '\n====================');
  } catch (error) {
    console.log('=== CURL GENERATION FAILED ===', error);
  }
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

export function toApiRequestError(error: unknown): ApiError {
  console.log(error);
  if (error instanceof ApiError) {
    return error;
  }

  if (axios.isAxiosError<ApiErrorResponse | string>(error)) {
    const message = getAxiosErrorMessage(error);
    const responseData = error.response?.data;
    let params: Partial<ApiError> = {};
    if (responseData && typeof responseData === 'object') {
      const dataObj = responseData as any;
      params = {
        error: dataObj.error,
        statusCode: dataObj.statusCode,
        errorCode: dataObj.errorCode,
        errorReason: dataObj.errorReason,
        toastMessage: dataObj.toastMessage,
        titleMessage: dataObj.titleMessage,
        messageType: dataObj.messageType,
        nextAction: dataObj.nextAction,
      };
    }
    return new ApiError(message, params);
  }

  if (error instanceof Error) {
    return new ApiError(error.message);
  }

  return new ApiError('Something went wrong');
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
    const url = `${API_CONFIG.BASE_URL.replace(/\/$/, '')}/${endpoint.replace(/^\//, '')}`;
    console.log('formdata', formData);
    try {
      const parts = (formData as any)._parts || [];
      const fields = parts.map(([key, value]: [string, any]) => {
        if (value && typeof value === 'object' && value.uri) {
          if (value.uri.startsWith('data:')) {
            // Base64 Data URI
            const commaIndex = value.uri.indexOf(',');
            const base64Data =
              commaIndex !== -1
                ? value.uri.substring(commaIndex + 1)
                : value.uri;
            return {
              name: key,
              filename: value.name || 'file.jpg',
              type: value.type || 'image/jpeg',
              data: base64Data,
            };
          } else {
            // Local file URI
            let path = value.uri;
            if (path.startsWith('file://')) {
              path = path.replace('file://', '');
            }
            return {
              name: key,
              filename: value.name || 'file.jpg',
              type: value.type || 'image/jpeg',
              data: ReactNativeBlobUtil.wrap(path),
            };
          }
        } else {
          // Regular field
          const strValue =
            typeof value === 'object' ? JSON.stringify(value) : String(value);
          return {
            name: key,
            data: strValue,
          };
        }
      });

      // Log curl request
      try {
        const headersObj = {
          ...API_CONFIG.HEADERS,
          'Content-Type': 'multipart/form-data',
        };
        const curl = generateCurlForRNBU('POST', url, headersObj, fields);
        console.log(
          '=== CURL REQUEST (RNBU) ===\n' + curl + '\n===================='
        );
      } catch (error) {
        console.log('=== CURL GENERATION FAILED ===', error);
      }

      const response = await ReactNativeBlobUtil.fetch(
        'POST',
        url,
        {
          ...API_CONFIG.HEADERS,
          'Content-Type': 'multipart/form-data',
        },
        fields
      );

      const status = response.info().status;
      const respText = await response.text();
      console.log(respText);
      let data: any = null;
      try {
        data = JSON.parse(respText);
      } catch {
        // no-op
      }

      if (status < 200 || status >= 300) {
        let errorMessage = respText;
        if (data && typeof data === 'object') {
          errorMessage =
            data.toastMessage || data.errorReason || data.message || respText;
        }
        throw new ApiError(
          errorMessage,
          data && typeof data === 'object' ? data : {}
        );
      }

      if (data === null) {
        throw new Error('Response is not a valid JSON: ' + respText);
      }

      return data as T;
    } catch (error) {
      console.log('=== UPLOAD TEST FAILED ===', error);
      throw toApiRequestError(error);
    }
  },
};
