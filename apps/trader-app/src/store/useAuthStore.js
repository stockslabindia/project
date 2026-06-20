import { create } from 'zustand';
import { api, isLoggedIn, getStoredUser, disconnectPriceFeed, disconnectUserSocket } from '../services/api';

function normalizeUser(raw) {
  if (!raw) return null;
  return {
    ...raw,
    name: raw.full_name || raw.name || '',
    clientId: raw.client_id || raw.clientId || '',
    referralCode: raw.referral_code || raw.referralCode || '',
    kycStatus: raw.kyc_status || raw.kycStatus || 'pending',
  };
}

export const useAuthStore = create((set, get) => ({
  isAuthenticated: isLoggedIn(),
  user: normalizeUser(getStoredUser()),
  authLoading: false,
  authError: null,

  login: async (email, password) => {
    set({ authLoading: true, authError: null });
    try {
      const data = await api.login(email, password);
      set({ isAuthenticated: true, user: normalizeUser(data.user), authLoading: false });
      return { success: true, user: data.user };
    } catch (err) {
      if (err.data && err.data.requires_otp) {
        set({ authLoading: false });
        return { success: false, requires_otp: true, user: err.data.user, error: err.data.error };
      }
      set({ authLoading: false, authError: err.message });
      return { success: false, error: err.message };
    }
  },

  signup: async (email, password, full_name, phone, referral_code) => {
    set({ authLoading: true, authError: null });
    try {
      const data = await api.signup(email, password, full_name, phone, referral_code);
      if (data.requires_otp) {
        set({ authLoading: false });
        return { success: true, requires_otp: true, sessionId: data.sessionId, user: data.user };
      }
      set({ isAuthenticated: true, user: normalizeUser(data.user), authLoading: false });
      return { success: true, user: data.user };
    } catch (err) {
      set({ authLoading: false, authError: err.message });
      return { success: false, error: err.message };
    }
  },

  verifyOtp: async (userId, idToken, email, password) => {
    set({ authLoading: true, authError: null });
    try {
      const data = await api.verifyOtp(userId, idToken, email, password);
      set({ isAuthenticated: true, user: normalizeUser(data.user), authLoading: false });
      return { success: true, user: data.user };
    } catch (err) {
      set({ authLoading: false, authError: err.message });
      return { success: false, error: err.message };
    }
  },

  logout: async () => {
    try {
      await api.logout();
    } catch (err) {
      console.error('Logout API error:', err);
    }
    disconnectPriceFeed();
    disconnectUserSocket();
    set({ isAuthenticated: false, user: null, authLoading: false, authError: null });
  },

  setUser: (user) => set({ user: normalizeUser(user), isAuthenticated: !!user }),

  fetchProfile: async () => {
    try {
      const data = await api.getMe();
      if (data && data.user) {
        set({ user: normalizeUser(data.user) });
        localStorage.setItem('tradex_user', JSON.stringify(data.user));
      }
    } catch (err) {
      console.error('Failed to fetch user profile:', err);
    }
  },
}));
