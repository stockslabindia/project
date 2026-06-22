import { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext(null);
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async (token) => {
    try {
      const res = await fetch(`${API_BASE}/affiliates/auth/me`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (res.ok) {
        const data = await res.json();
        setUser(data.affiliate);
      } else {
        localStorage.removeItem('affiliate_token');
        setUser(null);
      }
    } catch (err) {
      console.error('Fetch profile error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const token = localStorage.getItem('affiliate_token');
    if (token) {
      fetchProfile(token);
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (email, password) => {
    const res = await fetch(`${API_BASE}/affiliates/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ email, password })
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Login failed');
    }

    localStorage.setItem('affiliate_token', data.token);
    setUser(data.affiliate);
    return data.affiliate;
  };

  const logout = async () => {
    const token = localStorage.getItem('affiliate_token');
    try {
      await fetch(`${API_BASE}/affiliates/auth/logout`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
    } catch (e) {}
    localStorage.removeItem('affiliate_token');
    setUser(null);
  };

  const updateProfileLocally = (updates) => {
    setUser(prev => prev ? { ...prev, ...updates } : null);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, loading, fetchProfile, updateProfileLocally }}>
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
