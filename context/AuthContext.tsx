import React, { createContext, useContext, useEffect, useState } from 'react';
import { getToken, saveToken, deleteToken, registerPushToken } from '@/lib/auth';
import { apiFetch, apiPost } from '@/lib/api';

interface Member {
  id: string; email: string; name: string; role: string;
  memberId: string; memberInternalId: string;
  firstName: string; lastName: string; phone?: string;
  dateOfBirth?: string; address?: string;
  emergencyName?: string; emergencyPhone?: string; emergencyRelation?: string;
  image?: string; qrToken: string; qrCode: string;
  subscription?: any; plan?: any;
  bookings: any[]; ptBookings: any[]; dayPasses: any[]; entryLogs: any[];
}

interface AuthContextType {
  member: Member | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [member, setMember] = useState<Member | null>(null);
  const [loading, setLoading] = useState(true);

  async function loadMember() {
    try {
      const token = await getToken();
      if (!token) { setLoading(false); return; }
      const data = await apiFetch('/me');
      setMember(data);
    } catch {
      await deleteToken();
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadMember(); }, []);

  async function login(email: string, password: string) {
    const { token } = await apiPost('/auth', { email, password });
    await saveToken(token);
    registerPushToken(token).catch(() => {});
    await loadMember();
  }

  async function logout() {
    await deleteToken();
    setMember(null);
  }

  async function refresh() {
    await loadMember();
  }

  return (
    <AuthContext.Provider value={{ member, loading, login, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
