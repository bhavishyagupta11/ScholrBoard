import { useState } from 'react';
import { BaseLoginForm } from '../components/auth/BaseLoginForm';

export function FacultyAdminAuth() {
  const [role, setRole] = useState('faculty');

  const additionalFields = role === 'faculty' ? [
    { 
      name: 'facultyId', 
      label: 'Faculty ID',
      placeholder: 'Enter your faculty ID',
      required: true 
    },
    { 
      name: 'department', 
      label: 'Department',
      placeholder: 'Select your department',
      required: true 
    }
  ] : [];

  return (
    <div className="flex flex-col min-h-screen" style={{background:'var(--bg-dark)'}}>
      <div className="w-full p-4 bg-opacity-50 backdrop-blur-sm sticky top-0" style={{background:'var(--bg-darker)'}}>
        <div className="flex gap-2 max-w-md mx-auto">
          <button 
            className={`btn ${role === 'faculty' ? 'btn-primary' : 'btn-outline'}`} 
            onClick={() => setRole('faculty')}
          >
            Faculty
          </button>
          <button 
            className={`btn ${role === 'admin' ? 'btn-primary' : 'btn-outline'}`} 
            onClick={() => setRole('admin')}
          >
            Admin
          </button>
        </div>
      </div>
      
      <BaseLoginForm role={role} additionalFields={additionalFields} />
    </div>
  );
}
