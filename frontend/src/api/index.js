import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  timeout: 30000
});

// Add auth token to admin requests
api.interceptors.request.use(config => {
  const token = localStorage.getItem('adminToken');
  if (token && config.url?.startsWith('/admin')) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Redirect to login on 401
api.interceptors.response.use(
  res => res,
  err => {
    if (err.response?.status === 401 && window.location.pathname.startsWith('/admin') && window.location.pathname !== '/admin/login') {
      localStorage.removeItem('adminToken');
      window.location.href = '/admin/login';
    }
    return Promise.reject(err);
  }
);

// Submission APIs
export const createSubmission = (data) => api.post('/submissions/step1', data);
export const updateStep2 = (id, formData) => api.patch(`/submissions/${id}/step2`, formData, {
  headers: { 'Content-Type': 'multipart/form-data' }
});
export const updateStep3 = (id, data) => api.patch(`/submissions/${id}/step3`, data);
export const updateStep4 = (id, formData) => api.patch(`/submissions/${id}/step4`, formData, {
  headers: { 'Content-Type': 'multipart/form-data' }
});
export const getSubmission = (id) => api.get(`/submissions/${id}`);

// Admin APIs
export const adminLogin = (credentials) => api.post('/auth/login', credentials);
export const getAdminSubmissions = (params) => api.get('/admin/submissions', { params });
export const getAdminSubmission = (id) => api.get(`/admin/submissions/${id}`);
export const updateSubmissionStatus = (id, status) => api.patch(`/admin/submissions/${id}/status`, { status });
export const exportSubmissions = (params) => api.get('/admin/export', {
  params,
  responseType: 'blob'
});

export default api;
