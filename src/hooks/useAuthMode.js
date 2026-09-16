import { useEffect, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";

export default function useAuthMode({ auth, db }) {
  const [mode, setMode] = useState(null);
  const [authUser, setAuthUser] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [showAdminForm, setShowAdminForm] = useState(false);

  const [adminEmail, setAdminEmail] = useState("");
  const [adminPass, setAdminPass] = useState("");
  const [adminError, setAdminError] = useState("");
  const [checkingAdmin, setCheckingAdmin] = useState(false);

  function enterReader() {
    setMode("reader");
  }

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      setAuthUser(user || null);
      setAuthChecked(true);

      if (!user) {
        setCheckingAdmin(false);
        return;
      }

      try {
        setCheckingAdmin(true);
        const adminSnap = await getDoc(doc(db, "admins", user.uid));
        if (adminSnap.exists()) {
          setMode("admin");
        } else {
          setMode("reader");
        }
      } finally {
        setCheckingAdmin(false);
      }
    });

    return () => unsub();
  }, []);

  async function loginAdminEmailPassword() {
    setAdminError("");
    try {
      await signInWithEmailAndPassword(auth, adminEmail.trim(), adminPass);
    } catch (e) {
      console.error(e);
      setAdminError("Login failed. Check email/password.");
    }
  }

  async function logout() {
    await signOut(auth);
    setMode(null);
    setAdminPass("");
  }

  return {
    mode,
    setMode,
    authUser,
    authChecked,
    showAdminForm,
    setShowAdminForm,
    adminEmail,
    setAdminEmail,
    adminPass,
    setAdminPass,
    adminError,
    setAdminError,
    checkingAdmin,
    enterReader,
    loginAdminEmailPassword,
    logout,
  };
}