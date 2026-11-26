import axios, { type AxiosRequestConfig, type AxiosResponse } from 'axios';
import { useAuthStore } from '../store/authStore';
import type { ApiEnvelope } from '../types/domain';

const API_BASE = import.meta.env.VITE_API_URL ?? '/api';

export class ApiClientError extends Error {
  public readonly code: string;
  public readonly status: number;
  public readonly details?: unknown;

  constructor(code: string, message: string, status: number, details?: unknown) {
    super(message);
    this.name = 'ApiClientError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export const axiosInstance = axios.create({
  baseURL: API_BASE,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
});

axiosInstance.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

axiosInstance.interceptors.response.use(
  (response: AxiosResponse<ApiEnvelope<unknown>>) => {
    const payload = response.data;
    if (payload && typeof payload === 'object' && 'success' in payload) {
      if (!payload.success) {
        throw new ApiClientError(
          payload.error?.code ?? 'REQUEST_FAILED',
          payload.error?.message ?? 'Operation failed',
          response.status,
          payload.error?.details
        );
      }
    }
    return response;
  },
  (error) => {
    if (error.response?.status === 401) {
      const token = useAuthStore.getState().token;
      if (token) {
        useAuthStore.getState().logout();
      }
    }
    const errorData = error.response?.data as ApiEnvelope<unknown> | undefined;
    const code = errorData?.error?.code ?? error.code ?? 'REQUEST_FAILED';
    let message = errorData?.error?.message ?? error.message ?? 'An unexpected error occurred';
    const status = error.response?.status ?? 500;
    const details = errorData?.data ?? errorData?.error?.details;

    // Surface field validation error if available
    if (details && typeof details === 'object') {
      const d = details as Record<string, unknown>;
      if (d.fieldErrors && typeof d.fieldErrors === 'object') {
        const first = Object.entries(d.fieldErrors as Record<string, string[]>)[0];
        if (first && Array.isArray(first[1]) && first[1].length > 0) {
          message = `${first[0]}: ${first[1][0]}`;
        }
      } else if (Array.isArray(d) && d.length > 0 && (d[0] as { message?: string }).message) {
        const first = d[0] as { field?: string; message?: string };
        message = `${first.field ? `${first.field}: ` : ''}${first.message}`;
      }
    }

    return Promise.reject(new ApiClientError(code, message, status, details));
  }
);

export const api = {
  async get<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    const res = await axiosInstance.get<ApiEnvelope<T>>(url, config);
    return res.data.data as T;
  },
  async post<T>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> {
    const res = await axiosInstance.post<ApiEnvelope<T>>(url, data, config);
    return res.data.data as T;
  },
  async put<T>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> {
    const res = await axiosInstance.put<ApiEnvelope<T>>(url, data, config);
    return res.data.data as T;
  },
  async patch<T>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> {
    const res = await axiosInstance.patch<ApiEnvelope<T>>(url, data, config);
    return res.data.data as T;
  },
  async delete<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    const res = await axiosInstance.delete<ApiEnvelope<T>>(url, config);
    return res.data.data as T;
  },
};

/**
 * Backward compatibility wrapper matching fetch signature
 */
export async function apiRequest<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const method = (options.method?.toUpperCase() ?? 'GET') as
    | 'GET'
    | 'POST'
    | 'PUT'
    | 'PATCH'
    | 'DELETE';
  const headers = options.headers as Record<string, string> | undefined;
  const data = options.body ? JSON.parse(options.body as string) : undefined;

  const res = await axiosInstance.request<ApiEnvelope<T>>({
    url: path,
    method,
    headers,
    data,
  });

  return res.data.data as T;
}
