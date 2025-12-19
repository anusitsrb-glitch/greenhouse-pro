import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { api, authApi } from '@/lib/api';
import type { User, AuthState } from '@/types';

interface AuthContextType extends AuthState {
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    isLoading: true,
    isAuthenticated: false,
  });
  
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
        // Set CSRF token from login response
        if (response.data.csrfToken) {
          api.setCsrfToken(response.data.csrfToken);
        }
        
        // Get full user info
        const meResponse = await authApi.me();
        if (meResponse.success && meResponse.data?.user) {
          setState({
            user: meResponse.data.user as User,
            isLoading: false,
            isAuthenticated: true,
          });
          return true;
        }
        
        // Fallback to login response user
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
  
  return (
    <AuthContext.Provider value={{ ...state, login, logout, checkAuth }}>
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
