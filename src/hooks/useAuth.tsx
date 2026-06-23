"use client";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { onAuthStateChanged, signInWithPopup, signOut, type User } from "firebase/auth";
import { auth, googleProvider, githubProvider } from "@/lib/firebase/client";

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  loginGoogle: () => Promise<void>;
  loginGithub: () => Promise<void>;
  logout: () => Promise<void>;
  getToken: () => Promise<string | null>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => onAuthStateChanged(auth, (u) => {
    setUser(u);
    setLoading(false);
  }), []);

  const value: AuthContextValue = {
    user,
    loading,
    loginGoogle: async () => { await signInWithPopup(auth, googleProvider); },
    loginGithub: async () => { await signInWithPopup(auth, githubProvider); },
    logout: async () => { await signOut(auth); },
    getToken: async () => (auth.currentUser ? auth.currentUser.getIdToken() : null),
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth deve ser usado dentro de AuthProvider");
  return ctx;
}