/**
 * AdminAnalytics.jsx — Dynamic analytics based on actual data
 */
import { useEffect, useState } from 'react';
import analyticsApi from '../api/analytics.api.js';
import { Users, Activity, CheckCircle, TrendingUp, AlertCircle, Download } from 'lucide-react';

export function AdminAnalytics() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    analyticsApi.getSystemAnalytics()
      .then((res) => setData(res?.systemAnalytics || null))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const generateReport = (type) => {
    const rows = [
      ['Report Type', type],
      ['Generated At', new Date().toISOString()],
      ['Total Students', data?.totalStudents || 0],
      ['Total Faculty', data?.totalFaculty || 0],
      ['Total Activities', data?.activitySummary?.Total || 0],
      ['Pending Activities', data?.activitySummary?.Pending || 0],
      ['Approved Activities', data?.activitySummary?.Approved || 0],
      ['Rejected Activities', data?.activitySummary?.Rejected || 0],
      ['Approval Rate', `${data?.approvalRate || 0}%`],
    ];
    downloadCsv(`${type.toLowerCase()}-report.csv`, rows);
  };

  const downloadCsv = (filename, rows) => {
    const csv = rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold" style={{color:'var(--text-primary)'}}>Analytics & Reports</h1>
        <p className="mt-2" style={{color:'var(--text-secondary)'}}>Generate institutional reports and view detailed analytics</p>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 rounded-lg text-sm" style={{ background: 'rgba(239,68,68,0.15)', color: 'var(--danger-color)', border: '1px solid var(--danger-color)' }}>
          <AlertCircle size={16} /> {error}
        </div>
      )}

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="card p-6">
          <div className="flex justify-between items-center mb-2">
            <div className="text-sm" style={{color:'var(--text-secondary)'}}>Total Students</div>
            <Users size={20} className="text-blue-500 opacity-50" />
          </div>
          {loading ? <div className="skeleton h-8 w-16" /> : <div className="text-3xl font-bold text-blue-500">{data?.totalStudents || 0}</div>}
        </div>
        <div className="card p-6">
          <div className="flex justify-between items-center mb-2">
            <div className="text-sm" style={{color:'var(--text-secondary)'}}>Total Activities</div>
            <Activity size={20} className="text-cyan-500 opacity-50" />
          </div>
          {loading ? <div className="skeleton h-8 w-16" /> : <div className="text-3xl font-bold text-cyan-500">{data?.activitySummary?.Total || 0}</div>}
        </div>
        <div className="card p-6">
          <div className="flex justify-between items-center mb-2">
            <div className="text-sm" style={{color:'var(--text-secondary)'}}>Approval Rate</div>
            <CheckCircle size={20} className="text-green-500 opacity-50" />
          </div>
          {loading ? <div className="skeleton h-8 w-16" /> : <div className="text-3xl font-bold text-green-500">{data?.approvalRate != null ? `${data.approvalRate}%` : '–'}</div>}
        </div>
        <div className="card p-6">
          <div className="flex justify-between items-center mb-2">
            <div className="text-sm" style={{color:'var(--text-secondary)'}}>Total Faculty</div>
            <TrendingUp size={20} className="text-yellow-500 opacity-50" />
          </div>
          {loading ? <div className="skeleton h-8 w-16" /> : <div className="text-3xl font-bold text-yellow-500">{data?.totalFaculty || 0}</div>}
        </div>
      </div>

      {/* Report Generation */}
      <div className="card p-6">
        <h3 className="text-lg font-semibold mb-4" style={{color:'var(--text-primary)'}}>Institutional Reports</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button 
            onClick={() => generateReport('NAAC')}
            className="btn btn-outline p-4 h-auto hover:-translate-y-1 transition-transform"
            disabled={loading}
          >
            <div className="flex justify-between items-start">
              <div className="text-left">
                <div className="font-semibold">NAAC Report</div>
                <div className="text-sm mt-1" style={{color:'var(--text-secondary)'}}>National Assessment and Accreditation Council</div>
              </div>
              <Download size={18} className="text-blue-400" />
            </div>
          </button>
          <button 
            onClick={() => generateReport('NIRF')}
            className="btn btn-outline p-4 h-auto hover:-translate-y-1 transition-transform"
            disabled={loading}
          >
            <div className="flex justify-between items-start">
              <div className="text-left">
                <div className="font-semibold">NIRF Report</div>
                <div className="text-sm mt-1" style={{color:'var(--text-secondary)'}}>National Institutional Ranking Framework</div>
              </div>
              <Download size={18} className="text-blue-400" />
            </div>
          </button>
          <button 
            onClick={() => generateReport('Student Performance Export')}
            className="btn btn-outline p-4 h-auto hover:-translate-y-1 transition-transform"
            disabled={loading}
          >
            <div className="flex justify-between items-start">
              <div className="text-left">
                <div className="font-semibold">Export Data</div>
                <div className="text-sm mt-1" style={{color:'var(--text-secondary)'}}>Download raw Excel reports</div>
              </div>
              <Download size={18} className="text-green-400" />
            </div>
          </button>
        </div>
      </div>

      {/* Activity Breakdown */}
      <div className="card p-6">
        <h3 className="text-lg font-semibold mb-4" style={{color:'var(--text-primary)'}}>Activity Status Breakdown</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 rounded-lg text-center" style={{ background: 'var(--bg-medium)' }}>
            <div className="text-2xl font-bold text-yellow-400">{data?.activitySummary?.Pending || 0}</div>
            <div className="text-sm subtle mt-1">Pending Review</div>
          </div>
          <div className="p-4 rounded-lg text-center" style={{ background: 'var(--bg-medium)' }}>
            <div className="text-2xl font-bold text-green-400">{data?.activitySummary?.Approved || 0}</div>
            <div className="text-sm subtle mt-1">Approved</div>
          </div>
          <div className="p-4 rounded-lg text-center" style={{ background: 'var(--bg-medium)' }}>
            <div className="text-2xl font-bold text-red-400">{data?.activitySummary?.Rejected || 0}</div>
            <div className="text-sm subtle mt-1">Rejected</div>
          </div>
        </div>
      </div>

    </div>
  );
}
