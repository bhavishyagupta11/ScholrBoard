import { BaseLoginForm } from '../../components/auth/BaseLoginForm';

const departments = [
  { value: 'CSE', label: 'Computer Science (CSE)' },
  { value: 'IT', label: 'Information Technology (IT)' },
  { value: 'EE', label: 'Electrical Engineering (EE)' },
  { value: 'ECE', label: 'Electronics & Communication (ECE)' },
  { value: 'ME', label: 'Mechanical Engineering (ME)' },
  { value: 'CE', label: 'Civil Engineering (CE)' },
  { value: 'CHE', label: 'Chemical Engineering (CHE)' },
  { value: 'BT', label: 'BioTechnology (BT)' },
];

export function StudentLoginPage({ presentation = 'page' }) {
  const additionalFields = [
    {
      name: 'studentId',
      label: 'Student ID',
      required: true,
      placeholder: 'Enter your student ID'
    },
    {
      name: 'department',
      label: 'Department',
      type: 'select',
      required: true,
      placeholder: 'Select your department',
      options: departments
    },
    {
      name: 'semester',
      label: 'Semester',
      type: 'number',
      required: true,
      placeholder: 'Current semester (1-8)',
      min: 1,
      max: 8
    }
  ];

  return (
    <BaseLoginForm
      role="student"
      additionalFields={additionalFields}
      presentation={presentation}
    />
  );
}
