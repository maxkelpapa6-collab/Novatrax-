import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import { api, hasStoredToken } from '@/api/client';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [authChecked, setAuthChecked] = useState(false);

  const checkUserAuth = useCallback(async () => {
    if (!hasStoredToken()) {
      setUser(null);
      setIsAuthenticated(false);
      setIsLoadingAuth(false);
      setAuthChecked(true);
      return;
    }
    setIsLoadingAuth(true);
    try {
      const currentUser = await api.auth.me();
      setUser(currentUser);
      setIsAuthenticated(true);
    } catch (error) {
      // Jeton expiré ou invalide : retour à l'état déconnecté
      if (error.status === 401) api.auth.logout();
      setUser(null);
      setIsAuthenticated(false);
    } finally {
      setIsLoadingAuth(false);
      setAuthChecked(true);
    }
  }, []);

  useEffect(() => {
    checkUserAuth();
  }, [checkUserAuth]);

  const logout = (shouldRedirect = true) => {
    setUser(null);
    setIsAuthenticated(false);
    api.auth.logout(shouldRedirect ? window.location.href : undefined);
  };

  const navigateToLogin = () => {
    api.auth.redirectToLogin(window.location.href);
  };

  return (
    <AuthContext.Provider value={{
      user,
      isAuthenticated,
      isLoadingAuth,
      authChecked,
      logout,
      navigateToLogin,
      checkUserAuth
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
