import React, { createContext, useContext, useState } from 'react';

const AuthContext = createContext(null);

function loadUser() {
  try {
    const stored = sessionStorage.getItem('dockiq_user');
    return stored ? JSON.parse(stored) : null;
  } catch { return null; }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(loadUser);

  const login = (userData) => {
    sessionStorage.setItem('dockiq_user', JSON.stringify(userData));
    setUser(userData);
  };
  const logout = () => {
    sessionStorage.removeItem('dockiq_user');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
