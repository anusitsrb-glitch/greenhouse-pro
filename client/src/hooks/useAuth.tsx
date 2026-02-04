import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { api, authApi } from '@/lib/api';
import type { User, AuthState } from '@/types';

interface AuthContextType extends AuthState {
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
  refreshUser: () => Promise<void>; // ✅ เพิ่มตัวนี้
  updateUser: (patch: Partial<User>) => void; // ✅ เพิ่ม
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    isLoading: true,
    isAuthenticated: false,
  });

  const updateUser = useCallback((patch: Partial<User>) => {
    setState(prev => {
      if (!prev.user) return prev;
      return {
        ...prev,
        user: { ...prev.user, ...patch } as User,
      };
    });
  }, []);


  const checkAuth = useCallback(async () => {
    try {
      const response = await authApi.me();
      if (response.success && response.data?.user) {
        setState({
          user: response.data.user as User,
          isLoading: false,
          isAuthenticated: true,
        });
      } else {
        setState({
          user: null,
          isLoading: false,
          isAuthenticated: false,
        });
      }
    } catch {
      setState({
        user: null,
        isLoading: false,
        isAuthenticated: false,
      });
    }
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  const login = useCallback(async (username: string, password: string): Promise<boolean> => {
    setState(prev => ({ ...prev, isLoading: true }));

    try {
      const response = await authApi.login(username, password);

      if (response.success && response.data) {
        if (response.data.csrfToken) {
          api.setCsrfToken(response.data.csrfToken);
        }

        const meResponse = await authApi.me();
        if (meResponse.success && meResponse.data?.user) {
          setState({
            user: meResponse.data.user as User,
            isLoading: false,
            isAuthenticated: true,
          });
          return true;
        }

        setState({
          user: response.data.user as User,
          isLoading: false,
          isAuthenticated: true,
        });
        return true;
      } else {
        setState({
          user: null,
          isLoading: false,
          isAuthenticated: false,
        });
        return false;
      }
    } catch (e) {
      console.error('Login error:', e);
      setState({
        user: null,
        isLoading: false,
        isAuthenticated: false,
      });
      return false;
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } catch (e) {
      console.error('Logout error:', e);
    } finally {
      api.clearCsrfToken();
      setState({
        user: null,
        isLoading: false,
        isAuthenticated: false,
      });
    }
  }, []);

  const refreshUser = useCallback(async () => {
    await checkAuth();
  }, [checkAuth]);

  return (
    <AuthContext.Provider value={{ ...state, login, logout, checkAuth, refreshUser, updateUser }}>

      {children}
    </AuthContext.Provider>
  );

  

}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
