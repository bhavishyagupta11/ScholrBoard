/**
 * AdminAdvisors.jsx — Complete Admin Advisor Management dashboard
 * Allows assigning, reassigning, and bulk-mapping students to faculty advisors.
 */
import { useState, useEffect } from 'react';
import usersApi from '../api/users.api.js';
import { 
  Users, 
  Search, 
  AlertCircle, 
  CheckCircle2, 
  UserCheck, 
  Filter, 
  UserMinus, 
  CheckSquare, 
  Square,
  BookOpen
} from 'lucide-react';

export function AdminAdvisors() {
  const [students, setStudents] = useState([]);
  const [faculty, setFaculty] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  // Filter & Search states
  const [activeTab, setActiveTab] = useState('students'); // 'students' | 'faculty'
  const [searchTerm, setSearchTerm] = useState('');
  const [filterDept, setFilterDept] = useState('All');

  // Interactive assignment states
  const [selectedStudents, setSelectedStudents] = useState([]);
  const [bulkAdvisorId, setBulkAdvisorId] = useState('');
  
  // Bulk Dept Assignment states
  const [bulkDept, setBulkDept] = useState('');
  const [bulkDeptAdvisorId, setBulkDeptAdvisorId] = useState('');

  // Fetch data on mount
  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [studentRes, facultyRes] = await Promise.all([
        usersApi.getUsers({ role: 'student', limit: 1000 }),
        usersApi.getUsers({ role: 'faculty', limit: 1000 })
      ]);
      setStudents(studentRes.users || []);
      setFaculty(facultyRes.users || []);
    } catch (err) {
      setError(err.message || 'Failed to fetch user lists.');
    } finally {
      setLoading(false);
    }
  };

  const showSuccess = (msg) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 4000);
  };

  // Actions
  const handleAssignAdvisor = async (studentIds, advisorId) => {
    try {
      setError(null);
      const res = await usersApi.assignAdvisor(studentIds, advisorId || null);
      if (res.success) {
        showSuccess(res.message || 'Successfully updated advisor assignment');
        fetchData();
        setSelectedStudents([]);
      } else {
        setError(res.message || 'Failed to assign advisor.');
      }
    } catch (err) {
      setError(err.message || 'Failed to assign advisor.');
    }
  };

  const handleBulkDeptAssign = async () => {
    if (!bulkDept || !bulkDeptAdvisorId) {
      setError('Please select both a department and a faculty advisor.');
      return;
    }

    // Get all unassigned students in the selected department
    const targetStudents = students.filter(s => 
      s.department?.toLowerCase() === bulkDept.toLowerCase() && 
      !s.advisorId
    );

    if (targetStudents.length === 0) {
      setError(`No unassigned students found in department "${bulkDept}".`);
      return;
    }

    const studentIds = targetStudents.map(s => s._id);
    await handleAssignAdvisor(studentIds, bulkDeptAdvisorId);
    setBulkDept('');
    setBulkDeptAdvisorId('');
  };

  const toggleStudentSelect = (studentId) => {
    if (selectedStudents.includes(studentId)) {
      setSelectedStudents(selectedStudents.filter(id => id !== studentId));
    } else {
      setSelectedStudents([...selectedStudents, studentId]);
    }
  };

  const toggleSelectAll = (visibleStudents) => {
    const visibleIds = visibleStudents.map(s => s._id);
    const allSelected = visibleIds.every(id => selectedStudents.includes(id));
    
    if (allSelected) {
      setSelectedStudents(selectedStudents.filter(id => !visibleIds.includes(id)));
    } else {
      const newSelections = [...new Set([...selectedStudents, ...visibleIds])];
      setSelectedStudents(newSelections);
    }
  };

  // Get departments present in DB
  const departments = Array.from(
    new Set(
      [...students, ...faculty].map(u => u.department).filter(Boolean)
    )
  ).sort();

  // Faculty mapping for advisor name lookup
  const facultyMap = new Map();
  faculty.forEach(f => facultyMap.set(f._id.toString(), f));

  // Filter lists
  const filteredStudents = students.filter(s => {
    const matchDept = filterDept === 'All' || s.department === filterDept;
    const matchSearch = 
      (s.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (s.email || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (s.studentId || '').toLowerCase().includes(searchTerm.toLowerCase());
    return matchDept && matchSearch;
  });

  const filteredFaculty = faculty.filter(f => {
    const matchDept = filterDept === 'All' || f.department === filterDept;
    const matchSearch = 
      (f.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (f.email || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (f.facultyId || '').toLowerCase().includes(searchTerm.toLowerCase());
    return matchDept && matchSearch;
  });

  // Calculate stats
  const totalStudentsCount = students.length;
  const assignedCount = students.filter(s => s.advisorId).length;
  const unassignedCount = totalStudentsCount - assignedCount;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-4">
        <div>
          <h1 className="text-3xl font-bold" style={{ color: 'var(--text-primary)' }}>Advisor Mappings</h1>
          <p className="mt-2" style={{ color: 'var(--text-secondary)' }}>
            Manage student-advisor linkages and department approval hierarchies
          </p>
        </div>

        {/* Tab Controls */}
        <div className="flex bg-white/5 p-1 rounded-lg border" style={{ borderColor: 'var(--border-color)' }}>
          <button 
            className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${activeTab === 'students' ? 'bg-blue-600 text-white' : 'subtle hover:text-white'}`}
            onClick={() => { setActiveTab('students'); setSearchTerm(''); }}
          >
            Students view
          </button>
          <button 
            className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${activeTab === 'faculty' ? 'bg-blue-600 text-white' : 'subtle hover:text-white'}`}
            onClick={() => { setActiveTab('faculty'); setSearchTerm(''); }}
          >
            Faculty list
          </button>
        </div>
      </div>

      {/* Alert Notices */}
      {error && (
        <div className="flex items-center gap-2 p-3 rounded-lg text-sm" style={{ background: 'rgba(239,68,68,0.15)', color: 'var(--danger-color)', border: '1px solid var(--danger-color)' }}>
          <AlertCircle size={16} /> {error}
        </div>
      )}

      {successMsg && (
        <div className="flex items-center gap-2 p-3 rounded-lg text-sm" style={{ background: 'rgba(34,197,94,0.15)', color: '#4ade80', border: '1px solid #22c55e' }}>
          <CheckCircle2 size={16} /> {successMsg}
        </div>
      )}

      {/* Quick Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="card p-5 flex items-center justify-between">
          <div>
            <div className="text-2xl font-bold" style={{ color: 'var(--primary-blue)' }}>{totalStudentsCount}</div>
            <div className="text-xs uppercase tracking-wider mt-1" style={{ color: 'var(--text-secondary)' }}>Total Students</div>
          </div>
          <Users size={32} className="text-blue-500 opacity-20" />
        </div>
        <div className="card p-5 flex items-center justify-between">
          <div>
            <div className="text-2xl font-bold text-green-400">{assignedCount}</div>
            <div className="text-xs uppercase tracking-wider mt-1" style={{ color: 'var(--text-secondary)' }}>Assigned to Advisor</div>
          </div>
          <UserCheck size={32} className="text-green-500 opacity-20" />
        </div>
        <div className="card p-5 flex items-center justify-between">
          <div>
            <div className="text-2xl font-bold text-yellow-500">{unassignedCount}</div>
            <div className="text-xs uppercase tracking-wider mt-1" style={{ color: 'var(--text-secondary)' }}>Unassigned (Advisor: null)</div>
          </div>
          <UserMinus size={32} className="text-yellow-500 opacity-20" />
        </div>
      </div>

      {/* Controls Bar */}
      <div className="flex flex-col lg:flex-row gap-4 justify-between items-stretch lg:items-center">
        {/* Search & Filter */}
        <div className="flex flex-col md:flex-row gap-4 flex-1">
          <div className="relative flex-1 min-w-[240px]">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder={activeTab === 'students' ? "Search students by name, email, ID..." : "Search faculty by name, email..."}
              className="input-dark pl-9 py-2 w-full"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter size={16} className="text-slate-400" />
            <select
              className="input-dark px-3 py-2"
              value={filterDept}
              onChange={(e) => setFilterDept(e.target.value)}
            >
              <option value="All">All Departments</option>
              {departments.map(d => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Bulk Assignment Panel (Students tab only) */}
        {activeTab === 'students' && (
          <div className="flex flex-wrap items-center gap-4 bg-white/5 p-3 rounded-lg border" style={{ borderColor: 'var(--border-color)' }}>
            <span className="text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>
              {selectedStudents.length} selected
            </span>
            <select
              className="input-dark px-2 py-1.5 text-xs"
              value={bulkAdvisorId}
              onChange={(e) => setBulkAdvisorId(e.target.value)}
              disabled={selectedStudents.length === 0}
            >
              <option value="">Select Advisor to Assign...</option>
              <option value="unassign">Unassign Advisor (Set null)</option>
              {faculty.map(f => (
                <option key={f._id} value={f._id}>
                  {f.name} ({f.department})
                </option>
              ))}
            </select>
            <button
              onClick={() => handleAssignAdvisor(selectedStudents, bulkAdvisorId === 'unassign' ? null : bulkAdvisorId)}
              className="btn btn-outline px-3 py-1.5 text-xs"
              disabled={selectedStudents.length === 0 || !bulkAdvisorId}
            >
              Apply Bulk Assignment
            </button>
          </div>
        )}
      </div>

      {/* Bulk Department Auto-Assignment Panel (Optional tool for Operators) */}
      {activeTab === 'students' && (
        <div className="card p-5 border-dashed border-2" style={{ borderColor: 'var(--border-color)' }}>
          <h3 className="text-md font-semibold mb-3 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
            <BookOpen size={18} className="text-blue-500" /> Bulk Map Department
          </h3>
          <p className="text-xs mb-4" style={{ color: 'var(--text-secondary)' }}>
            Map all unassigned students in a specific department to an advisor in a single transaction.
          </p>
          <div className="flex flex-wrap gap-4 items-center">
            <select
              className="input-dark px-3 py-2 text-sm"
              value={bulkDept}
              onChange={(e) => setBulkDept(e.target.value)}
            >
              <option value="">Select Department...</option>
              {departments.map(d => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
            <select
              className="input-dark px-3 py-2 text-sm"
              value={bulkDeptAdvisorId}
              onChange={(e) => setBulkDeptAdvisorId(e.target.value)}
            >
              <option value="">Select Faculty Advisor...</option>
              {faculty.map(f => (
                <option key={f._id} value={f._id}>
                  {f.name} ({f.department})
                </option>
              ))}
            </select>
            <button
              onClick={handleBulkDeptAssign}
              className="btn btn-outline px-4 py-2 text-sm"
              disabled={!bulkDept || !bulkDeptAdvisorId}
            >
              Assign All Unassigned
            </button>
          </div>
        </div>
      )}

      {/* Students / Faculty Tables */}
      {activeTab === 'students' ? (
        <div className="card p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b" style={{ borderColor: 'var(--border-color)', background: 'var(--bg-medium)' }}>
                  <th className="py-4 px-6 text-left w-12">
                    <button 
                      onClick={() => toggleSelectAll(filteredStudents)}
                      className="text-slate-400 hover:text-white"
                      disabled={filteredStudents.length === 0}
                    >
                      {filteredStudents.length > 0 && filteredStudents.every(s => selectedStudents.includes(s._id)) ? (
                        <CheckSquare size={16} />
                      ) : (
                        <Square size={16} />
                      )}
                    </button>
                  </th>
                  <th className="py-4 px-6 text-left font-semibold" style={{ color: 'var(--text-secondary)' }}>Student</th>
                  <th className="py-4 px-6 text-left font-semibold" style={{ color: 'var(--text-secondary)' }}>Department</th>
                  <th className="py-4 px-6 text-left font-semibold" style={{ color: 'var(--text-secondary)' }}>Current Advisor</th>
                  <th className="py-4 px-6 text-left font-semibold" style={{ color: 'var(--text-secondary)' }}>Status</th>
                  <th className="py-4 px-6 text-right font-semibold" style={{ color: 'var(--text-secondary)' }}>Quick Assignment</th>
                </tr>
              </thead>
              <tbody className="divide-y" style={{ divideColor: 'var(--border-color)' }}>
                {loading ? (
                  [1,2,3].map(i => (
                    <tr key={i}>
                      <td className="py-4 px-6"><div className="skeleton h-4 w-4" /></td>
                      <td className="py-4 px-6"><div className="skeleton h-5 w-32" /><div className="skeleton h-3 w-20 mt-1" /></td>
                      <td className="py-4 px-6"><div className="skeleton h-5 w-20" /></td>
                      <td className="py-4 px-6"><div className="skeleton h-5 w-40" /></td>
                      <td className="py-4 px-6"><div className="skeleton h-6 w-16" /></td>
                      <td className="py-4 px-6 text-right"><div className="skeleton h-8 w-48 float-right" /></td>
                    </tr>
                  ))
                ) : filteredStudents.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="py-8 text-center subtle">No students found.</td>
                  </tr>
                ) : (
                  filteredStudents.map((s) => {
                    const advisor = s.advisorId ? facultyMap.get(s.advisorId.toString()) : null;
                    const isSelected = selectedStudents.includes(s._id);
                    return (
                      <tr key={s._id} className="hover:bg-white/5 transition-colors">
                        <td className="py-4 px-6">
                          <button 
                            onClick={() => toggleStudentSelect(s._id)}
                            className="text-slate-400 hover:text-white"
                          >
                            {isSelected ? <CheckSquare size={16} /> : <Square size={16} />}
                          </button>
                        </td>
                        <td className="py-4 px-6">
                          <div className="font-medium" style={{ color: 'var(--text-primary)' }}>{s.name}</div>
                          <div className="text-xs subtle mt-1">{s.email} · ID: {s.studentId || 'N/A'}</div>
                        </td>
                        <td className="py-4 px-6">{s.department || '–'}</td>
                        <td className="py-4 px-6">
                          {advisor ? (
                            <div>
                              <div className="font-medium">{advisor.name}</div>
                              <div className="text-xs subtle">{advisor.email}</div>
                            </div>
                          ) : (
                            <span className="subtle italic">None assigned</span>
                          )}
                        </td>
                        <td className="py-4 px-6">
                          {s.advisorId ? (
                            <span className="badge badge-green">Assigned</span>
                          ) : (
                            <span className="badge badge-yellow">Unassigned</span>
                          )}
                        </td>
                        <td className="py-4 px-6 text-right">
                          <select
                            className="input-dark px-2 py-1 text-xs"
                            value={s.advisorId || ''}
                            onChange={(e) => handleAssignAdvisor([s._id], e.target.value)}
                          >
                            <option value="">Unassign (None)</option>
                            {faculty.map(f => (
                              <option key={f._id} value={f._id}>
                                {f.name} ({f.department})
                              </option>
                            ))}
                          </select>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Faculty List View */
        <div className="card p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b" style={{ borderColor: 'var(--border-color)', background: 'var(--bg-medium)' }}>
                  <th className="py-4 px-6 text-left font-semibold" style={{ color: 'var(--text-secondary)' }}>Faculty Name</th>
                  <th className="py-4 px-6 text-left font-semibold" style={{ color: 'var(--text-secondary)' }}>Email</th>
                  <th className="py-4 px-6 text-left font-semibold" style={{ color: 'var(--text-secondary)' }}>Department</th>
                  <th className="py-4 px-6 text-left font-semibold" style={{ color: 'var(--text-secondary)' }}>Faculty ID</th>
                  <th className="py-4 px-6 text-right font-semibold" style={{ color: 'var(--text-secondary)' }}>Assigned Student Count</th>
                </tr>
              </thead>
              <tbody className="divide-y" style={{ divideColor: 'var(--border-color)' }}>
                {loading ? (
                  [1,2,3].map(i => (
                    <tr key={i}>
                      <td className="py-4 px-6"><div className="skeleton h-5 w-32" /></td>
                      <td className="py-4 px-6"><div className="skeleton h-5 w-40" /></td>
                      <td className="py-4 px-6"><div className="skeleton h-5 w-20" /></td>
                      <td className="py-4 px-6"><div className="skeleton h-5 w-16" /></td>
                      <td className="py-4 px-6 text-right"><div className="skeleton h-5 w-10 float-right" /></td>
                    </tr>
                  ))
                ) : filteredFaculty.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="py-8 text-center subtle">No faculty accounts found.</td>
                  </tr>
                ) : (
                  filteredFaculty.map((f) => {
                    const assignedStudentCount = students.filter(s => s.advisorId === f._id).length;
                    return (
                      <tr key={f._id} className="hover:bg-white/5 transition-colors">
                        <td className="py-4 px-6 font-medium" style={{ color: 'var(--text-primary)' }}>{f.name}</td>
                        <td className="py-4 px-6">{f.email}</td>
                        <td className="py-4 px-6">{f.department || '–'}</td>
                        <td className="py-4 px-6">{f.facultyId || '–'}</td>
                        <td className="py-4 px-6 text-right font-bold" style={{ color: 'var(--primary-blue)' }}>
                          {assignedStudentCount}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminAdvisors;
