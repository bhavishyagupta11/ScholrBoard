import { BaseLoginForm } from '../../components/auth/BaseLoginForm';

const departments = [
  'Computer Science',
  'Information Technology',
  'Electrical Engineering',
  'Electronics & Communication',
  'Mechanical Engineering',
  'Civil Engineering',
  'Chemical Engineering',
  'BioTechnology',
];

export function StudentLoginPage() {
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
    />
  );
}