import apiClient from './apiClient';

const reportService = {
  // ============================================
  // BATCH REPORTS (Admin/Instructor only)
  // ============================================

  // Get Report Data (Preview) → GET /reports/batch/:batchId
  getReport: async (batchId, filters = {}) => {
    try {
      const response = await apiClient.get(`/reports/batch/${batchId}`, {
        params: filters,
      });
      return response.data;
    } catch (error) {
      throw error.response?.data || { message: 'Failed to generate report' };
    }
  },

  // Export Report as CSV → GET /reports/batch/:batchId/export/csv
  exportCSVReport: async (batchId, filters = {}) => {
    try {
      const response = await apiClient.get(`/reports/batch/${batchId}/export/csv`, {
        params: filters,
        responseType: 'blob',
      });

      // Download file
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `batch_report_${batchId}_${Date.now()}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();

      return { success: true };
    } catch (error) {
      throw error.response?.data || { message: 'Failed to export CSV report' };
    }
  },

  // Export Report as PDF → GET /reports/batch/:batchId/export/pdf
  exportPDFReport: async (batchId, filters = {}) => {
    try {
      const response = await apiClient.get(`/reports/batch/${batchId}/export/pdf`, {
        params: filters,
        responseType: 'blob',
      });

      // Download file
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `batch_report_${batchId}_${Date.now()}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();

      return { success: true };
    } catch (error) {
      throw error.response?.data || { message: 'Failed to export PDF report' };
    }
  },

  // Get Batch Analytics → GET /reports/batch/:batchId/analytics
  getBatchAnalytics: async (batchId) => {
    try {
      const response = await apiClient.get(`/reports/batch/${batchId}/analytics`);
      return response.data;
    } catch (error) {
      throw error.response?.data || { message: 'Failed to fetch batch analytics' };
    }
  },

  // ============================================
  // CONTEST REPORTS
  // ============================================

  // Get Contest Report → GET /reports/contest/:contestId
  getContestReport: async (contestId) => {
    try {
      const response = await apiClient.get(`/reports/contest/${contestId}`);
      return response.data;
    } catch (error) {
      throw error.response?.data || { message: 'Failed to generate contest report' };
    }
  },

  // Export Contest Report as CSV → GET /reports/contest/:contestId/export/csv
  exportContestCSV: async (contestId) => {
    try {
      const response = await apiClient.get(`/reports/contest/${contestId}/export/csv`, {
        responseType: 'blob',
      });

      // Download file
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `contest_report_${contestId}_${Date.now()}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();

      return { success: true };
    } catch (error) {
      throw error.response?.data || { message: 'Failed to export contest report' };
    }
  },

  // ============================================
  // STUDENT REPORTS
  // ============================================

  // Get Student Detailed Report → GET /reports/student/:studentId
  getStudentDetailedReport: async (studentId) => {
    try {
      const response = await apiClient.get(`/reports/student/${studentId}`);
      return response.data;
    } catch (error) {
      throw error.response?.data || { message: 'Failed to generate student report' };
    }
  },
};

export default reportService;
