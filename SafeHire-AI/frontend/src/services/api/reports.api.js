import api from "./axios";

export const reportsApi = {
  submitReport:  (data)   => api.post("/reports", data),
  searchThreats: (params) => api.get("/reports/threats", { params }),
  upvoteThreat:  (id)     => api.post(`/reports/threats/${id}/upvote`),
  getMyReports:  (params) => api.get("/reports/my", { params }),
};