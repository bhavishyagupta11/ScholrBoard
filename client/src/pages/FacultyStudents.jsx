/**
 * FacultyStudents.jsx — Real dynamic student tracking list
 */
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import usersApi from '../api/users.api.js';
import { AlertCircle, Search, Users, ExternalLink } from 'lucide-react';

export function FacultyStudents() {
  const navigate = useNavigate();
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [filterDept, setFilterDept] = useState('All');

  useEffect(() => {
    fetchStudents();
  }, []);

  const fetchStudents = async () => {
    setLoading(true);
    try {
      const res = await usersApi.getUsers({ role: 'student' });
      setStudents(res.users || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const filteredStudents = students.filter(student => {
    const matchDept = filterDept === 'All' || student.department === filterDept;
    const matchSearch = (student.name?.toLowerCase() || '').includes(searchTerm.toLowerCase()) || 
                        (student.studentId?.toLowerCase() || '').includes(searchTerm.toLowerCase());
    return matchDept && matchSearch;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold" style={{color:'var(--text-primary)'}}>Student Tracker</h1>
        <p className="mt-2" style={{color:'var(--text-secondary)'}}>Monitor student progress and academic performance</p>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 rounded-lg text-sm" style={{ background: 'rgba(239,68,68,0.15)', color: 'var(--danger-color)', border: '1px solid var(--danger-color)' }}>
          <AlertCircle size={16} /> {error}
        </div>
      )}

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="card p-4">
          <div className="flex justify-between items-center">
            <div className="text-2xl font-bold" style={{color:'var(--primary-blue)'}}>{students.length}</div>
            <Users size={20} className="text-blue-500 opacity-50" />
          </div>
          <div className="text-sm mt-1" style={{color:'var(--text-secondary)'}}>Total Students</div>
        </div>
        <div className="card p-4">
          <div className="text-2xl font-bold text-green-400">
            –
          </div>
          <div className="text-sm mt-1" style={{color:'var(--text-secondary)'}}>Average GPA</div>
        </div>
        <div className="card p-4">
          <div className="text-2xl font-bold text-blue-400">
            –
          </div>
          <div className="text-sm mt-1" style={{color:'var(--text-secondary)'}}>Average Attendance</div>
        </div>
        <div className="card p-4">
          <div className="text-2xl font-bold text-purple-400">
            –
          </div>
          <div className="text-sm mt-1" style={{color:'var(--text-secondary)'}}>Avg Activities</div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search students..."
            className="input-dark pl-9 py-2 w-full"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <select
          className="input-dark px-3 py-2"
          value={filterDept}
          onChange={(e) => setFilterDept(e.target.value)}
        >
          <option value="All">All Departments</option>
          {Array.from(new Set(students.map(s => s.department).filter(Boolean))).map(d => (
            <option key={d} value={d}>{d}</option>
          ))}
        </select>
      </div>

      {/* Students Table */}
      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b" style={{borderColor:'var(--border-color)', background: 'var(--bg-medium)'}}>
                <th className="text-left py-4 px-6 font-semibold" style={{color:'var(--text-secondary)'}}>Student</th>
                <th className="text-left py-4 px-6 font-semibold" style={{color:'var(--text-secondary)'}}>Department</th>
                <th className="text-left py-4 px-6 font-semibold" style={{color:'var(--text-secondary)'}}>Semester</th>
                <th className="text-left py-4 px-6 font-semibold" style={{color:'var(--text-secondary)'}}>Email</th>
                <th className="text-right py-4 px-6 font-semibold" style={{color:'var(--text-secondary)'}}>Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y" style={{ divideColor: 'var(--border-color)' }}>
              {loading ? (
                [1,2,3].map(i => (
                  <tr key={i}>
                    <td className="py-4 px-6"><div className="skeleton h-5 w-32" /><div className="skeleton h-3 w-20 mt-1" /></td>
                    <td className="py-4 px-6"><div className="skeleton h-5 w-20" /></td>
                    <td className="py-4 px-6"><div className="skeleton h-5 w-16" /></td>
                    <td className="py-4 px-6"><div className="skeleton h-5 w-40" /></td>
                    <td className="py-4 px-6"><div className="skeleton h-8 w-24 float-right" /></td>
                  </tr>
                ))
              ) : filteredStudents.length === 0 ? (
                <tr>
                  <td colSpan="5" className="py-8 text-center subtle">No students found.</td>
                </tr>
              ) : (
                filteredStudents.map((student) => (
                  <tr key={student._id} className="hover:bg-white/5 transition-colors">
                    <td className="py-4 px-6">
                      <div className="font-medium" style={{color:'var(--text-primary)'}}>{student.name}</div>
                      <div className="text-xs subtle mt-1">{student.studentId || 'No ID'}</div>
                    </td>
                    <td className="py-4 px-6">{student.department || '–'}</td>
                    <td className="py-4 px-6">{student.semester || '–'}</td>
                    <td className="py-4 px-6">
                      <a href={`mailto:${student.email}`} className="text-blue-400 hover:underline">{student.email}</a>
                    </td>
                    <td className="py-4 px-6 text-right">
                      <div className="flex gap-2 justify-end">
                        <button 
                          onClick={() => navigate('/faculty/mentor')}
                          className="btn btn-outline px-3 py-1.5 text-xs flex items-center gap-1"
                        >
                          360° View <ExternalLink size={12} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
