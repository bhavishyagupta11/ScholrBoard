import { BaseLoginForm } from '../../components/auth/BaseLoginForm';

export function AdminLoginPage() {
  return (
    <BaseLoginForm
      role="admin"
      disableSignup={true} // Admin accounts are created by superadmins only
    />
  );
}