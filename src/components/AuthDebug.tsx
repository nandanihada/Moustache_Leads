import { useAuth } from '../contexts/AuthContext';

export const AuthDebug = () => {
  const { user, token, isAuthenticated, loading } = useAuth();

  return (
    <div className="fixed bottom-4 right-4 bg-black text-white p-4 rounded-lg text-xs max-w-sm">
      <h3 className="font-bold mb-2">Auth Debug</h3>
      <div>Loading: {loading ? 'Yes' : 'No'}</div>
      <div>Authenticated: {isAuthenticated ? 'Yes' : 'No'}</div>
      <div>Has Token: {token ? 'Yes' : 'No'}</div>
      <div>Has User: {user ? 'Yes' : 'No'}</div>
      {user && <div>Username: {user.username}</div>}
      <div>LocalStorage Token: {localStorage.getItem('token') ? 'Yes' : 'No'}</div>
      <div>LocalStorage User: {localStorage.getItem('user') ? 'Yes' : 'No'}</div>
    </div>
  );
};
