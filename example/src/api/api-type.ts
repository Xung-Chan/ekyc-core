/**
 * Authentication API Request/Response Types
 */

import type { AxiosRequestConfig } from 'axios';

/**
 * Authentication API Request/Response Types
 */
export interface ApiError extends Error {
  error?: boolean;
  statusCode?: string;
  errorCode?: string;
  errorReason?: string;
  toastMessage?: string;
  titleMessage?: string;
  messageType?: string;
  nextAction?: string;
}

export interface ApiResponse<T> {
  data: T;
  message: string;
  status: number;
}

export interface PageData<T> {
  pageNumber: number;
  pageSize: number;
  totalRecord: number;
  totalPages: number;
  data: T[];
}
export interface MutationConfig<TData, TVariables> {
  onSuccess?: (data: TData, variables: TVariables) => void | Promise<void>;
  onError?: (error: Error, variables: TVariables) => void;
  onSettled?: (
    data: TData | undefined,
    error: Error | null,
    variables: TVariables
  ) => void;
}

export interface QueryConfig {
  enabled?: boolean;
  staleTime?: number;
  gcTime?: number;
  retry?: number | boolean;
}

export interface RequestOptions extends Omit<
  AxiosRequestConfig,
  'baseURL' | 'data' | 'url'
> {
  body?: unknown;
  skipAuth?: boolean;
  skipAuthRefresh?: boolean;
  skipAuthRedirect?: boolean;
}
