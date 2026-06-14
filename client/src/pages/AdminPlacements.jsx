/**
 * AdminPlacements.jsx — Dynamic placement management
 */
import { useState, useEffect } from 'react';
import placementsApi from '../api/placements.api.js';
import { AlertCircle, Search, Plus, Building2, Briefcase, IndianRupee, Users, Clock } from 'lucide-react';

export function AdminPlacements() {
  const [placements, setPlacements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('All');
  const [showAddModal, setShowAddModal] = useState(false);

  useEffect(() => {
    fetchPlacements();
  }, []);

  const fetchPlacements = async () => {
    setLoading(true);
    try {
      const res = await placementsApi.getAll();
      setPlacements(res.placements || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const filteredPlacements = placements.filter(placement => {
    const term = searchTerm.toLowerCase();
    const matchSearch = (placement.company?.toLowerCase() || '').includes(term) || 
                        (placement.role?.toLowerCase() || '').includes(term);
    
    // Derived status based on deadline
    const isClosed = new Date(placement.deadline) < new Date();
    const status = isClosed ? 'Closed' : 'Active';
    const matchStatus = filterStatus === 'All' || status === filterStatus;

    return matchSearch && matchStatus;
  });

  const totalPositions = placements.length; // Approximate, as we don't store "number of positions" per placement yet
  const activePostings = placements.filter(p => new Date(p.deadline) >= new Date()).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold" style={{color:'var(--text-primary)'}}>Placements & Jobs</h1>
          <p className="mt-2" style={{color:'var(--text-secondary)'}}>Manage placement opportunities and job postings</p>
        </div>
        <button 
          onClick={() => setShowAddModal(true)}
          className="btn btn-primary flex items-center gap-2"
        >
          <Plus size={16} /> Add New Opportunity
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 rounded-lg text-sm" style={{ background: 'rgba(239,68,68,0.15)', color: 'var(--danger-color)', border: '1px solid var(--danger-color)' }}>
          <AlertCircle size={16} /> {error}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="card p-4">
          <div className="flex items-center justify-between">
            <div className="text-2xl font-bold" style={{color:'var(--primary-blue)'}}>{totalPositions}</div>
            <Briefcase size={20} className="text-blue-500 opacity-50" />
          </div>
          <div className="text-sm mt-1" style={{color:'var(--text-secondary)'}}>Total Postings</div>
        </div>
        <div className="card p-4">
          <div className="flex items-center justify-between">
            <div className="text-2xl font-bold text-green-400">–</div>
            <Users size={20} className="text-green-400 opacity-50" />
          </div>
          <div className="text-sm mt-1" style={{color:'var(--text-secondary)'}}>Total Applications</div>
        </div>
        <div className="card p-4">
          <div className="flex items-center justify-between">
            <div className="text-2xl font-bold text-blue-400">{activePostings}</div>
            <Building2 size={20} className="text-blue-400 opacity-50" />
          </div>
          <div className="text-sm mt-1" style={{color:'var(--text-secondary)'}}>Active Postings</div>
        </div>
        <div className="card p-4">
          <div className="flex items-center justify-between">
            <div className="text-2xl font-bold text-yellow-400">–</div>
            <IndianRupee size={20} className="text-yellow-400 opacity-50" />
          </div>
          <div className="text-sm mt-1" style={{color:'var(--text-secondary)'}}>Avg Package</div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search companies or roles..."
            className="input-dark pl-9 py-2 w-full"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <select
          className="input-dark px-3 py-2"
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
        >
          <option value="All">All Status</option>
          <option value="Active">Active</option>
          <option value="Closed">Closed</option>
        </select>
      </div>

      {/* Placements Table */}
      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b" style={{borderColor:'var(--border-color)', background: 'var(--bg-medium)'}}>
                <th className="text-left py-4 px-6 font-semibold" style={{color:'var(--text-secondary)'}}>Company</th>
                <th className="text-left py-4 px-6 font-semibold" style={{color:'var(--text-secondary)'}}>Role</th>
                <th className="text-left py-4 px-6 font-semibold" style={{color:'var(--text-secondary)'}}>Package/Stipend</th>
                <th className="text-left py-4 px-6 font-semibold" style={{color:'var(--text-secondary)'}}>Deadline</th>
                <th className="text-left py-4 px-6 font-semibold" style={{color:'var(--text-secondary)'}}>Applicants</th>
                <th className="text-left py-4 px-6 font-semibold" style={{color:'var(--text-secondary)'}}>Status</th>
                <th className="text-right py-4 px-6 font-semibold" style={{color:'var(--text-secondary)'}}>Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y" style={{ divideColor: 'var(--border-color)' }}>
              {loading ? (
                [1,2,3].map(i => (
                  <tr key={i}>
                    <td className="py-4 px-6"><div className="skeleton h-5 w-32" /></td>
                    <td className="py-4 px-6"><div className="skeleton h-5 w-24" /></td>
                    <td className="py-4 px-6"><div className="skeleton h-5 w-20" /></td>
                    <td className="py-4 px-6"><div className="skeleton h-5 w-24" /></td>
                    <td className="py-4 px-6"><div className="skeleton h-5 w-10" /></td>
                    <td className="py-4 px-6"><div className="skeleton h-6 w-16 rounded-full" /></td>
                    <td className="py-4 px-6"><div className="skeleton h-8 w-20 float-right" /></td>
                  </tr>
                ))
              ) : filteredPlacements.length === 0 ? (
                <tr>
                  <td colSpan="7" className="py-8 text-center text-sm subtle">No placements found.</td>
                </tr>
              ) : (
                filteredPlacements.map((placement) => {
                  const isClosed = new Date(placement.deadline) < new Date();
                  const status = isClosed ? 'Closed' : 'Active';
                  return (
                    <tr key={placement._id} className="hover:bg-white/5 transition-colors">
                      <td className="py-4 px-6 font-medium" style={{color:'var(--text-primary)'}}>{placement.company}</td>
                      <td className="py-4 px-6">
                        <div style={{color:'var(--text-primary)'}}>{placement.role}</div>
                        <div className="text-xs subtle mt-1">{placement.jobType}</div>
                      </td>
                      <td className="py-4 px-6">
                        <div style={{color:'var(--text-primary)'}}>{placement.package || placement.stipend || 'Not specified'}</div>
                      </td>
                      <td className="py-4 px-6 subtle flex items-center gap-1.5 mt-1">
                        <Clock size={14} /> {new Date(placement.deadline).toLocaleDateString()}
                      </td>
                      <td className="py-4 px-6">
                        <span className="font-medium">{placement.appliedStudents?.length || 0}</span>
                      </td>
                      <td className="py-4 px-6">
                        <span className={`badge ${status === 'Active' ? 'badge-green' : 'badge-red'}`}> 
                          {status}
                        </span>
                      </td>
                      <td className="py-4 px-6 text-right">
                        <div className="flex gap-2 justify-end">
                          <button className="btn btn-outline px-3 py-1 text-xs">Edit</button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
