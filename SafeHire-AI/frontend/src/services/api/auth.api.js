import api from "./axios";

export const authApi = {
  register:       (data)          => api.post("/auth/register", data),
  login:          (data)          => api.post("/auth/login", data),
  logout:         ()              => api.post("/auth/logout"),
  refresh:        ()              => api.post("/auth/refresh"),
  getMe:          ()              => api.get("/auth/me"),
  forgotPassword: (email)         => api.post("/auth/forgot-password", { email }),
  resetPassword:  (token, password) => api.patch(`/auth/reset-password/${token}`, { password }),
};