import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, setDoc, addDoc, collection } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { Subscription, createTrialSubscription, getSubscription, saveSubscription } from "@/lib/firestore";

export interface AppUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  companyId: string | null;
  role: string | null;
  technicianId?: string | null;
  onboardingCompleted?: boolean;
}

function computeSubStatus(sub: Subscription | null): { isSubscribed: boolean; trialDaysLeft: number } {
  if (!sub) return { isSubscribed: false, trialDaysLeft: 0 };
  if (sub.status === "active") return { isSubscribed: true, trialDaysLeft: 0 };
  if (sub.status === "trialing") {
    const daysLeft = Math.max(0, Math.ceil((new Date(sub.trialEndsAt).getTime() - Date.now()) / 86_400_000));
    return { isSubscribed: daysLeft > 0, trialDaysLeft: daysLeft };
  }
  return { isSubscribed: false, trialDaysLeft: 0 };
}

interface AuthContextType {
  user: AppUser | null;
  loading: boolean;
  firestoreError: string | null;
  needsSetup: boolean;
  subscription: Subscription | null;
  isSubscribed: boolean;
  trialDaysLeft: number;
  refreshUser: () => Promise<void>;
  refreshSubscription: () => Promise<void>;
  completeSetup: (companyName: string) => Promise<void>;
  markOnboardingComplete: () => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  firestoreError: null,
  needsSetup: false,
  subscription: null,
  isSubscribed: false,
  trialDaysLeft: 0,
  refreshUser: async () => {},
  refreshSubscription: async () => {},
  completeSetup: async () => {},
  markOnboardingComplete: () => {},
});

async function fetchUserData(uid: string, email: string | null, displayName: string | null) {
  const userDoc = await getDoc(doc(db, "users", uid));
  if (!userDoc.exists()) {
    return { user: { uid, email, displayName, companyId: null, role: null }, needsSetup: true, subscription: null };
  }
  const data = userDoc.data();
  const companyId: string | null = data.companyId ?? null;
  let subscription: Subscription | null = null;
  if (companyId) {
    try { subscription = await getSubscription(companyId); } catch { /* ignore */ }
  }
  return {
    user: {
      uid, email,
      displayName: data.displayName ?? displayName ?? null,
      companyId,
      role: data.role ?? null,
      technicianId: data.technicianId ?? null,
      onboardingCompleted: data.onboardingCompleted ?? false,
    },
    needsSetup: false,
    subscription,
  };
}

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [firestoreError, setFirestoreError] = useState<string | null>(null);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
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
          setSubscription(result.subscription);
        } catch (error: unknown) {
          const code = (error as { code?: string })?.code ?? "";
          console.error("Firestore error:", code, error);
          setFirestoreError(code || "unknown");
          setNeedsSetup(false);
          setUser({ uid: fbUser.uid, email: fbUser.email, displayName: fbUser.displayName, companyId: null, role: null });
          setSubscription(null);
        }
      } else {
        setFirebaseUser(null);
        setUser(null);
        setFirestoreError(null);
        setNeedsSetup(false);
        setSubscription(null);
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
      setSubscription(result.subscription);
    } catch (error: unknown) {
      const code = (error as { code?: string })?.code ?? "";
      setFirestoreError(code || "unknown");
    }
  }, [firebaseUser]);

  const refreshSubscription = useCallback(async () => {
    const companyId = user?.companyId;
    if (!companyId) return;
    try {
      const { cacheInvalidate } = await import("@/lib/firestore");
      cacheInvalidate(`subscriptions:${companyId}`);
      const sub = await getSubscription(companyId);
      setSubscription(sub);
    } catch { /* ignore */ }
  }, [user?.companyId]);

  const markOnboardingComplete = useCallback(() => {
    setUser(prev => prev ? { ...prev, onboardingCompleted: true } : prev);
  }, []);

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
    await createTrialSubscription(companyRef.id);
    const trialSub = await getSubscription(companyRef.id);
    setNeedsSetup(false);
    setFirestoreError(null);
    setSubscription(trialSub);
    setUser({
      uid: firebaseUser.uid,
      email: firebaseUser.email,
      displayName: firebaseUser.displayName,
      companyId: companyRef.id,
      role: "owner",
    });
  }, [firebaseUser]);

  const { isSubscribed, trialDaysLeft } = computeSubStatus(subscription);

  return (
    <AuthContext.Provider value={{
      user, loading, firestoreError, needsSetup,
      subscription, isSubscribed, trialDaysLeft,
      refreshUser, refreshSubscription, completeSetup, markOnboardingComplete,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);

export { saveSubscription };
