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

export function FacultyLoginPage() {
  const additionalFields = [
    {
      name: 'facultyId',
      label: 'Faculty ID',
      required: true,
      placeholder: 'Enter your faculty ID'
    },
    {
      name: 'department',
      label: 'Department',
      type: 'select',
      required: true,
      placeholder: 'Select your department',
      options: departments
    }
  ];

  return (
    <BaseLoginForm
      role="faculty"
      additionalFields={additionalFields}
    />
  );
}