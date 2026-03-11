import axios from 'axios'

const api = axios.create({
  baseURL: 'http://localhost:8000',
  headers: { 'Content-Type': 'application/json' },
  timeout: 120_000,  // 2-min timeout for Claude generation
})

// ── Synthetic ─────────────────────────────────────────────────
export const syntheticApi = {
  generate:       (data)    => api.post('/api/synthetic/generate', data),
  getDatasets:    ()        => api.get('/api/synthetic/datasets'),
  getDataset:     (id)      => api.get(`/api/synthetic/datasets/${id}`),
  getSamples:     (id)      => api.get(`/api/synthetic/datasets/${id}/samples`),
  deleteDataset:  (id)      => api.delete(`/api/synthetic/datasets/${id}`),
  exportDataset:  (id)      => api.get(`/api/synthetic/datasets/${id}/export`, { responseType: 'blob' }),
}

// ── Annotation ────────────────────────────────────────────────
export const annotationApi = {
  getQueue:        (datasetId) => api.get(`/api/annotation/queue${datasetId ? `/${datasetId}` : ''}`),
  submitAnnotation:(data)      => api.post('/api/annotation/submit', data),
  getIAA:          (datasetId) => api.get(`/api/annotation/iaa/${datasetId}`),
  getHistory:      (datasetId) => api.get(`/api/annotation/history/${datasetId}`),
}

// ── Evaluation ────────────────────────────────────────────────
export const evaluationApi = {
  run:        (data)      => api.post('/api/evaluation/run', data),
  getStatus:  (datasetId) => api.get(`/api/evaluation/status/${datasetId}`),
  getResults: (datasetId) => api.get(`/api/evaluation/results/${datasetId}`),
  getSummary: (datasetId) => api.get(`/api/evaluation/summary/${datasetId}`),
}

// ── Dashboard ─────────────────────────────────────────────────
export const dashboardApi = {
  getStats:         () => api.get('/api/dashboard/stats'),
  getTrends:        () => api.get('/api/dashboard/trends'),
  getRecentActivity:() => api.get('/api/dashboard/recent-activity'),
  seed:             () => api.post('/api/dashboard/seed'),
}

export default api
