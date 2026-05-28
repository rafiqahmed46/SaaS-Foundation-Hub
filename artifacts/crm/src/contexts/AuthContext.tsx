import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, setDoc, addDoc, collection } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";

export interface AppUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  companyId: string | null;
  role: string | null;
  technicianId?: string | null;
  onboardingCompleted?: boolean;
}

interface AuthContextType {
  user: AppUser | null;
  loading: boolean;
  firestoreError: string | null;
  needsSetup: boolean;
  refreshUser: () => Promise<void>;
  completeSetup: (companyName: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  firestoreError: null,
  needsSetup: false,
  refreshUser: async () => {},
  completeSetup: async () => {},
});

async function fetchUserData(uid: string, email: string | null, displayName: string | null) {
  const userDoc = await getDoc(doc(db, "users", uid));
  if (!userDoc.exists()) {
    return { user: { uid, email, displayName, companyId: null, role: null }, needsSetup: true };
  }
  const data = userDoc.data();
  return {
    user: { uid, email, displayName: data.displayName ?? displayName ?? null, companyId: data.companyId ?? null, role: data.role ?? null, technicianId: data.technicianId ?? null, onboardingCompleted: data.onboardingCompleted ?? false },
    needsSetup: false,
  };
}

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [firestoreError, setFirestoreError] = useState<string | null>(null);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [firebaseUser, setFirebaseUser] = useState<{ uid: string; email: string | null; displayName: string | null } | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      if (fbUser) {
        setFirebaseUser({ uid: fbUser.uid, email: fbUser.email, displayName: fbUser.displayName });
        try {
          const result = await fetchUserData(fbUser.uid, fbUser.email, fbUser.displayName);
          setFirestoreError(null);
          setNeedsSetup(result.needsSetup);
          setUser(result.user);
        } catch (error: unknown) {
          const code = (error as { code?: string })?.code ?? "";
          console.error("Firestore error:", code, error);
          setFirestoreError(code || "unknown");
          setNeedsSetup(false);
          setUser({ uid: fbUser.uid, email: fbUser.email, displayName: fbUser.displayName, companyId: null, role: null });
        }
      } else {
        setFirebaseUser(null);
        setUser(null);
        setFirestoreError(null);
        setNeedsSetup(false);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const refreshUser = useCallback(async () => {
    if (!firebaseUser) return;
    try {
      const result = await fetchUserData(firebaseUser.uid, firebaseUser.email, firebaseUser.displayName);
      setFirestoreError(null);
      setNeedsSetup(result.needsSetup);
      setUser(result.user);
    } catch (error: unknown) {
      const code = (error as { code?: string })?.code ?? "";
      setFirestoreError(code || "unknown");
    }
  }, [firebaseUser]);

  const completeSetup = useCallback(async (companyName: string) => {
    if (!firebaseUser) throw new Error("Not logged in");
    const companyRef = await addDoc(collection(db, "companies"), {
      name: companyName,
      ownerId: firebaseUser.uid,
      createdAt: new Date().toISOString(),
    });
    await setDoc(doc(db, "users", firebaseUser.uid), {
      email: firebaseUser.email,
      displayName: firebaseUser.displayName,
      companyId: companyRef.id,
      role: "owner",
      createdAt: new Date().toISOString(),
    });
    await setDoc(doc(db, "settings", companyRef.id), {
      companyName,
      companyLogo: "",
      currency: "USD",
      invoicePrefix: "INV-",
      taxEnabled: false,
      taxRate: 10,
      discountEnabled: false,
      address: "",
      phone: "",
      email: firebaseUser.email ?? "",
      website: "",
    });
    setNeedsSetup(false);
    setFirestoreError(null);
    setUser({
      uid: firebaseUser.uid,
      email: firebaseUser.email,
      displayName: firebaseUser.displayName,
      companyId: companyRef.id,
      role: "owner",
    });
  }, [firebaseUser]);

  return (
    <AuthContext.Provider value={{ user, loading, firestoreError, needsSetup, refreshUser, completeSetup }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
