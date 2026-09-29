import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import * as SecureStore from 'expo-secure-store';
import { api } from '@/services/api';

type User = {
  id: string;
  email: string;
  name: string | null;
};

type AuthContextType = {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadStoredUser();
  }, []);

  async function loadStoredUser() {
    try {
      const token = await SecureStore.getItemAsync('accessToken');
      if (token) {
        const response = await api.get('/auth/me');
        setUser({ id: response.data.userId, email: response.data.email, name: null });
      }
    } catch {
      await SecureStore.deleteItemAsync('accessToken');
    } finally {
      setIsLoading(false);
    }
  }

  async function login(email: string, password: string) {
    const response = await api.post('/auth/login', { email, password });
    await SecureStore.setItemAsync('accessToken', response.data.accessToken);
    setUser(response.data.user);
  }

  async function register(email: string, password: string, name: string) {
    const response = await api.post('/auth/register', { email, password, name });
    await SecureStore.setItemAsync('accessToken', response.data.accessToken);
    setUser(response.data.user);
  }

  async function logout() {
    await SecureStore.deleteItemAsync('accessToken');
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, isLoading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth deve ser usado dentro de um AuthProvider');
  }
  return context;
}