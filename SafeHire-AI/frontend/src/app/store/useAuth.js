/**
 * modules/auth/hooks/useAuth.js — Auth mutations + session restore
 *
 * PATTERN: React Query mutations for API calls + Redux for storing the result
 * - useMutation()  handles loading/error state for login, register, logout
 * - useDispatch()  writes the result into Redux (accessToken, user)
 * - useSelector()  reads auth state in components
 * - useRestoreSession() runs once on app load — silently refreshes token
 *   if a valid refreshToken cookie exists (keeps user logged in on page reload)
 */

import { useMutation, useQuery } from "@tanstack/react-query";
import { useDispatch } from "react-redux";
import { useNavigate } from "react-router-dom";
import { setCredentials, setTokens, logout as logoutAction, setLoading } from "../../../app/store/authSlice";
import api from "../../../services/api/axios";

// ─── Login ────────────────────────────────────────────────────────────────────
// POST /api/v1/auth/login
// On success: stores user + accessToken in Redux, redirects to dashboard
export const useLogin = () => {
  const dispatch  = useDispatch();
  const navigate  = useNavigate();

  return useMutation({
    mutationFn: ({ email, password }) =>
      api.post("/auth/login", { email, password }),

    onSuccess: ({ data }) => {
      // data.data because ApiResponse wraps: { success, statusCode, message, data }
      dispatch(setCredentials({
        user:        data.data.user,
        accessToken: data.data.accessToken,
      }));
      navigate("/dashboard");
    },

    // No onError needed here — error is available as mutation.error in the component
    // LoginPage reads errors.email / errors.password from RHF, not from this mutation
  });
};

// ─── Register ─────────────────────────────────────────────────────────────────
// POST /api/v1/auth/register
export const useRegister = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();

  return useMutation({
    mutationFn: ({ fullName, email, password, college, phone }) =>
      api.post("/auth/register", { fullName, email, password, college, phone }),

    onSuccess: ({ data }) => {
      dispatch(setCredentials({
        user:        data.data.user,
        accessToken: data.data.accessToken,
      }));
      navigate("/dashboard");
    },
  });
};

// ─── Logout ───────────────────────────────────────────────────────────────────
// POST /api/v1/auth/logout
// Clears refresh token from DB server-side, clears Redux state client-side
export const useLogout = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();

  return useMutation({
    mutationFn: () => api.post("/auth/logout"),

    onSuccess: () => {
      dispatch(logoutAction());
      navigate("/login");
    },

    onError: () => {
      // Even if the server call fails — clear client state anyway
      // User should always be able to log out locally
      dispatch(logoutAction());
      navigate("/login");
    },
  });
};

// ─── Restore Session ──────────────────────────────────────────────────────────
// Runs ONCE when the app loads (in App.jsx or a top-level component).
// If the user has a valid refreshToken cookie from a previous session,
// this silently calls /auth/refresh → gets a new accessToken → logs them back in.
// If no cookie or expired → fails silently → user sees the login page.
//
// HOW TO USE:
//   In App.jsx:
//   const { isLoading } = useRestoreSession();
//   if (isLoading) return <SplashScreen />;
export const useRestoreSession = () => {
  const dispatch = useDispatch();

  // useQuery with no queryFn retry on failure — this is a one-shot check
  const { isLoading } = useQuery({
    queryKey: ["auth", "session"],

    queryFn: async () => {
      const { data } = await api.post("/auth/refresh");
      return data;
    },

    // On success — we have a new accessToken but not a full user object yet
    // Call /auth/me to get the user, then store everything
    onSuccess: async (data) => {
      const newAccessToken = data.data.accessToken;

      // Temporarily store the token so the /me request can attach it
      dispatch(setTokens({ accessToken: newAccessToken }));

      // Fetch the full user profile
      const meRes = await api.get("/auth/me");
      dispatch(setCredentials({
        user:        meRes.data.data,
        accessToken: newAccessToken,
      }));
    },

    onError: () => {
      // No valid session — clear loading state so app renders the login page
      dispatch(setLoading(false));
    },

    // Never re-run this automatically — it's a one-time session check
    retry:              false,
    refetchOnMount:     false,
    refetchOnFocus:     false,
    refetchOnReconnect: false,

    // 5 min stale time — more than enough for a one-shot check
    staleTime: 5 * 60 * 1000,
  });

  return { isLoading };
};

// ─── Forgot Password ──────────────────────────────────────────────────────────
// POST /api/v1/auth/forgot-password
export const useForgotPassword = () => {
  return useMutation({
    mutationFn: ({ email }) =>
      api.post("/auth/forgot-password", { email }),
  });
};

// ─── Reset Password ───────────────────────────────────────────────────────────
// PATCH /api/v1/auth/reset-password/:token
export const useResetPassword = () => {
  const navigate = useNavigate();

  return useMutation({
    mutationFn: ({ token, password }) =>
      api.patch(`/auth/reset-password/${token}`, { password }),

    onSuccess: () => {
      navigate("/login");
    },
  });
};