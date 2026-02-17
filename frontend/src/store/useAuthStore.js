import { create } from 'zustand';

/**
 * Auth store — persisted to localStorage.
 * Stores Google user profile after successful sign-in.
 */
const useAuthStore = create((set) => ({
  user: JSON.parse(localStorage.getItem('lw_user') || 'null'),
  isAuthenticated: !!localStorage.getItem('lw_user'),

  login: (userData) => {
    localStorage.setItem('lw_user', JSON.stringify(userData));
    set({ user: userData, isAuthenticated: true });
  },

  logout: () => {
    localStorage.removeItem('lw_user');
    set({ user: null, isAuthenticated: false });
  },
}));

export default useAuthStore;
