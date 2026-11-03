import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { authApi, type AuthUser, type SignupInput } from '../services/api';

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<{ ok: boolean; user?: AuthUser; message?: string }>;
  signup: (data: SignupInput) => Promise<{ ok: boolean; message?: string }>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  // Restore session from localStorage on mount
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) { setLoading(false); return; }
    authApi.me()
      .then(setUser)
      .catch(() => { localStorage.removeItem('token'); })
      .finally(() => setLoading(false));
  }, []);

  const login = async (username: string, password: string) => {
    try {
      const { token, user: loginUser } = await authApi.login(username, password);
      localStorage.setItem('token', token);
      
      try {
        const fullUser = await authApi.me();
        setUser(fullUser);
        return { ok: true, user: fullUser };
      } catch (err) {
        setUser(loginUser);
        return { ok: true, user: loginUser };
      }
    } catch (e: unknown) {
      return { ok: false, message: e instanceof Error ? e.message : 'Login failed' };
    }
  };

  const signup = async (data: SignupInput) => {
    try {
      // Registration only — do NOT persist a token or set the user (no auto-login).
      const { message } = await authApi.signup(data);
      return { ok: true, message };
    } catch (e: unknown) {
      return { ok: false, message: e instanceof Error ? e.message : 'Signup failed' };
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, signup, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
};

