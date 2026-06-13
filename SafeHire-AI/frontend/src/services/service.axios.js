/**
 * services/api/axios.js — Centralized Axios instance
 *
 * WHY ONE AXIOS INSTANCE:
 * Instead of import axios from "axios" everywhere and repeating
 * baseURL + headers + token logic — one configured instance does it all.
 *
 * KEY FEATURES:
 * 1. Auto-attach Authorization header on every request
 * 2. Auto-refresh token when 401 received
 * 3. Consistent error shape from every API call
 */

import axios from "axios";
import { API_BASE_URL } from "../constants";
import { store } from "../app/store";
import { setTokens, logout } from "../app/store/authSlice";

const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true, // Send cookies (refresh token) with every request
  headers: { "Content-Type": "application/json" },
});

// ─── Request interceptor ──────────────────────────────────────────────────────
// Runs before EVERY request — attaches the access token from Redux store
api.interceptors.request.use((config) => {
  const token = store.getState().auth.accessToken;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ─── Response interceptor ─────────────────────────────────────────────────────
// Runs after EVERY response.
// If we get 401 (token expired) → silently refresh → retry original request
let isRefreshing = false;
let failedQueue = [];

// Queue requests that come in while refresh is in progress
const processQueue = (error, token = null) => {
  failedQueue.forEach((prom) => {
    if (error) prom.reject(error);
    else prom.resolve(token);
  });
  failedQueue = [];
};

api.interceptors.response.use(
  (response) => response, // Success — pass through

  async (error) => {
    const originalRequest = error.config;
  // Don't trigger refresh logic for the refresh endpoint itself
  if (originalRequest?.url?.includes("/auth/refresh")) {
    return Promise.reject(error);
  }

    // 401 = access token expired — try to refresh
    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        // Another refresh is already in progress — queue this request
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then((token) => {
          originalRequest.headers.Authorization = `Bearer ${token}`;
          return api(originalRequest);
        });
      }

      originalRequest._retry = true; // Prevent infinite retry loop
      isRefreshing = true;

      try {
        // Call refresh endpoint — refresh token comes from httpOnly cookie automatically
        const { data } = await axios.post(
          `${API_BASE_URL}/auth/refresh`,
          {},
          { withCredentials: true }
        );

        const newToken = data.data.accessToken;
        store.dispatch(setTokens({ accessToken: newToken }));
        processQueue(null, newToken);

        // Retry the original failed request with new token
        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        return api(originalRequest);

      } catch (refreshError) {
        // Refresh failed — session expired, force logout
        processQueue(refreshError, null);
        store.dispatch(logout());
        window.location.href = "/login";
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

export default api;