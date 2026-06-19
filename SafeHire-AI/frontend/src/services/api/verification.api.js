import api from "./axios";

export const verificationApi = {
  verifyCompany: (text) => api.post("/verification", { text }),

  getVerifications: (params) => api.get("/verification", { params }),
  getVerification: (id) => api.get(`/verification/${id}`),
  deleteVerification: (id) => api.delete(`/verification/${id}`),
};