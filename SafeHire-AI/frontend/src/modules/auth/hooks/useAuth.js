import { useMutation } from "@tanstack/react-query";
import { useDispatch } from "react-redux";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { authApi } from "../../../services/api/auth.api";
import { setCredentials, logout as logoutAction } from "../../../app/store/authSlice";

export function useLogin() {
  const dispatch = useDispatch();
  const navigate = useNavigate();

  return useMutation({
    mutationFn: ({ email, password }) => authApi.login({ email, password }),
    onSuccess: ({ data }) => {
      dispatch(setCredentials({
        user:        data.data.user,
        accessToken: data.data.accessToken,
      }));
      toast.success(`Welcome back, ${data.data.user.fullName.split(" ")[0]}!`);
      navigate("/dashboard");
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || "Login failed");
    },
  });
}

export function useRegister() {
  const dispatch = useDispatch();
  const navigate = useNavigate();

  return useMutation({
    mutationFn: (userData) => authApi.register(userData),
    onSuccess: ({ data }) => {
      dispatch(setCredentials({
        user:        data.data.user,
        accessToken: data.data.accessToken,
      }));
      toast.success("Account created! Welcome to SafeHire.");
      navigate("/dashboard");
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || "Registration failed");
    },
  });
}

export function useLogout() {
  const dispatch = useDispatch();
  const navigate = useNavigate();

  return useMutation({
    mutationFn: () => authApi.logout(),
    onSettled: () => {
      dispatch(logoutAction());
      navigate("/login");
      toast.success("Logged out successfully");
    },
  });
}