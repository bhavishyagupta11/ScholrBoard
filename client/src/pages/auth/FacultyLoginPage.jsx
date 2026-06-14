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

export function FacultyLoginPage({ presentation = 'page' }) {
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
      presentation={presentation}
      disableSignup={true}
    />
  );
}
