/**
 * app/store/authSlice.js — Auth state in Redux
 *
 * WHY REDUX FOR AUTH (not React Query):
 * Auth state (who is logged in, their token) is GLOBAL CLIENT STATE.
 * It's needed by: the router (redirect if not logged in),
 * the Axios interceptor (attach token), every page (show user name).
 * React Query is for SERVER state. Redux is for GLOBAL CLIENT state.
 *
 * WHAT LIVES HERE:
 * - accessToken (in memory — NOT localStorage, XSS safe)
 * - user object
 * - isAuthenticated flag
 */

import { createSlice } from "@reduxjs/toolkit";

const initialState = {
  user:            null,
  accessToken:     null,
  isAuthenticated: false,
  isLoading:       true,  // true on app start — checking if session exists
};

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    // Called after successful login or register
    setCredentials: (state, action) => {
      state.user            = action.payload.user;
      state.accessToken     = action.payload.accessToken;
      state.isAuthenticated = true;
      state.isLoading       = false;
    },

    // Called after token refresh — only update the token
    setTokens: (state, action) => {
      state.accessToken = action.payload.accessToken;
    },

    // Update user profile data without touching token
    setUser: (state, action) => {
      state.user = action.payload;
    },

    // Called on logout or session expiry
    logout: (state) => {
      state.user            = null;
      state.accessToken     = null;
      state.isAuthenticated = false;
      state.isLoading       = false;
    },

    // Called when app loads — finished checking session
    setLoading: (state, action) => {
      state.isLoading = action.payload;
    },
  },
});

export const { setCredentials, setTokens, setUser, logout, setLoading } = authSlice.actions;

// Selectors — components use these instead of state.auth.something directly
export const selectUser            = (state) => state.auth.user;
export const selectIsAuthenticated = (state) => state.auth.isAuthenticated;
export const selectIsLoading       = (state) => state.auth.isLoading;
export const selectAccessToken     = (state) => state.auth.accessToken;

export default authSlice.reducer;