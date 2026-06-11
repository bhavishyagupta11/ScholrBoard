/**
 * FacultyStudent360.jsx — Real dynamic student tracking
 */
import { useState, useEffect } from 'react';
import usersApi from '../api/users.api.js';
import profileApi from '../api/profile.api.js';
import { AlertCircle, Search } from 'lucide-react';

export function FacultyStudent360() {
  const [students, setStudents] = useState([]);
  const [loadingList, setLoadingList] = useState(true);
  const [errorList, setErrorList] = useState(null);

  const [selectedStudent, setSelectedStudent] = useState(null);
  const [studentProfile, setStudentProfile] = useState(null);
  const [loadingProfile, setLoadingProfile] = useState(false);

  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    // Fetch students in this faculty's department
    usersApi.getUsers({ role: 'student' })
      .then(res => {
        setStudents(res.users || []);
        if (res.users?.length > 0) {
          handleSelectStudent(res.users[0]);
        }
      })
      .catch(err => setErrorList(err.message))
      .finally(() => setLoadingList(false));
  }, []);

  const handleSelectStudent = async (student) => {
    setSelectedStudent(student);
    setLoadingProfile(true);
    setActiveTab('overview');
    try {
      const res = await profileApi.getUserProfile(student._id);
      setStudentProfile(res.profile);
    } catch (err) {
      console.error(err);
      setStudentProfile(null);
    } finally {
      setLoadingProfile(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold" style={{color:'var(--text-primary)'}}>Student 360° View</h1>
        <p className="mt-2" style={{color:'var(--text-secondary)'}}>Comprehensive student progress and academic tracking</p>
      </div>

      {errorList && (
        <div className="flex items-center gap-2 p-3 rounded-lg text-sm" style={{ background: 'rgba(239,68,68,0.15)', color: 'var(--danger-color)', border: '1px solid var(--danger-color)' }}>
          <AlertCircle size={16} /> {errorList}
        </div>
      )}

      {/* Student Selector */}
      <div className="card p-6">
        <h3 className="text-lg font-semibold mb-4" style={{color:'var(--text-primary)'}}>Select Student</h3>
        {loadingList ? (
          <div className="flex gap-4 overflow-x-auto pb-2">
            {[1, 2, 3].map(i => <div key={i} className="skeleton h-20 w-64 rounded-lg flex-shrink-0" />)}
          </div>
        ) : students.length === 0 ? (
          <div className="text-sm subtle">No students found in your department.</div>
        ) : (
          <div className="flex gap-4 overflow-x-auto pb-2 custom-scrollbar">
            {students.map((student) => (
              <div
                key={student._id}
                onClick={() => handleSelectStudent(student)}
                className={`p-4 rounded-lg cursor-pointer flex-shrink-0 w-64 border transition-colors ${
                  selectedStudent?._id === student._id 
                    ? 'border-blue-500' 
                    : 'border-transparent hover:border-blue-500/30'
                }`}
                style={{ background: selectedStudent?._id === student._id ? 'rgba(59,130,246,0.1)' : 'var(--bg-medium)' }}
              >
                <div className="font-semibold truncate" style={{color:'var(--text-primary)'}}>{student.name}</div>
                <div className="text-sm subtle truncate">{student.studentId || 'No ID'} • {student.department || 'No Dept'}</div>
                <div className="text-sm subtle mt-1 truncate">{student.email}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Student Details */}
      {selectedStudent && (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="lg:col-span-1">
            <div className="card p-6">
              <div className="flex flex-col items-center text-center mb-6">
                <img 
                  src={selectedStudent.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(selectedStudent.name)}&background=3b82f6&color=fff`} 
                  alt={selectedStudent.name} 
                  className="w-20 h-20 rounded-full mb-3 object-cover"
                />
                <h3 className="text-lg font-semibold leading-tight" style={{color:'var(--text-primary)'}}>{selectedStudent.name}</h3>
                <div className="text-sm subtle">{selectedStudent.studentId || 'No ID'}</div>
              </div>
              <div className="space-y-3 text-sm border-t pt-4" style={{borderColor:'var(--border-color)'}}>
                <div><span className="subtle">Department:</span> <span style={{color:'var(--text-primary)'}} className="float-right font-medium">{selectedStudent.department || '–'}</span></div>
                <div><span className="subtle">Semester:</span> <span style={{color:'var(--text-primary)'}} className="float-right font-medium">{selectedStudent.semester || '–'}</span></div>
                <div><span className="subtle">Email:</span> <div style={{color:'var(--text-primary)'}} className="mt-1 break-all bg-white/5 p-2 rounded">{selectedStudent.email}</div></div>
              </div>
            </div>
          </div>

          <div className="lg:col-span-3">
            {/* Tab Navigation */}
            <div className="border-b mb-6 flex space-x-6 overflow-x-auto custom-scrollbar" style={{borderColor:'var(--border-color)'}}>
              {['overview', 'projects'].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`py-3 px-1 border-b-2 font-medium text-sm whitespace-nowrap capitalize transition-colors ${
                    activeTab === tab 
                      ? 'border-blue-500 text-blue-500' 
                      : 'border-transparent text-gray-400 hover:text-white'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>

            {/* Tab Content */}
            {loadingProfile ? (
              <div className="card p-6 min-h-[300px] flex items-center justify-center">
                <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : !studentProfile ? (
              <div className="card p-6 text-center text-sm subtle">Profile not fully setup by student yet.</div>
            ) : (
              <>
                {activeTab === 'overview' && (
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="card p-4 text-center">
                        <div className="text-3xl font-bold text-green-400">{studentProfile.gpa || '–'}</div>
                        <div className="text-sm subtle mt-1">Current GPA</div>
                      </div>
                      <div className="card p-4 text-center">
                        <div className="text-3xl font-bold text-blue-400">{studentProfile.attendanceOverall ? `${studentProfile.attendanceOverall}%` : '–'}</div>
                        <div className="text-sm subtle mt-1">Attendance</div>
                      </div>
                      <div className="card p-4 text-center">
                        <div className="text-3xl font-bold text-purple-400">{(studentProfile.skills || []).length}</div>
                        <div className="text-sm subtle mt-1">Skills Listed</div>
                      </div>
                    </div>
                    {studentProfile.bio && (
                      <div className="card p-6">
                        <div className="font-semibold mb-2">Bio</div>
                        <p className="text-sm subtle leading-relaxed">{studentProfile.bio}</p>
                      </div>
                    )}
                  </div>
                )}

                {activeTab === 'projects' && (
                  <div className="space-y-4">
                    {(!studentProfile.projects || studentProfile.projects.length === 0) ? (
                      <div className="text-sm subtle text-center py-8 card">No projects added by student.</div>
                    ) : (
                      studentProfile.projects.map((project, index) => (
                        <div key={index} className="card p-5 border-l-4" style={{ borderLeftColor: 'var(--primary-blue)' }}>
                          <div className="font-medium text-lg mb-1">{project.name}</div>
                          <div className="text-sm subtle mb-3">{project.description}</div>
                          {project.link && (
                            <a href={project.link} target="_blank" rel="noreferrer" className="text-xs text-blue-400 hover:underline">View Project ↗</a>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
