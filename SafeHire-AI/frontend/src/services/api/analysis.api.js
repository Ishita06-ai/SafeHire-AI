import api from "./axios";

export const analysisApi = {
  // Don't set Content-Type manually — let the browser set it automatically
  // Browser auto-sets multipart/form-data WITH the correct boundary
  // Setting it manually breaks the boundary and loses auth header
  analyzeConversation: (formData) =>
    api.post("/analysis/conversation", formData),

  getConversations:   (params) => api.get("/analysis/conversation", { params }),
  getConversation:    (id)     => api.get(`/analysis/conversation/${id}`),
  deleteConversation: (id)     => api.delete(`/analysis/conversation/${id}`),
  getStats:           ()       => api.get("/analysis/conversation/stats"),
};