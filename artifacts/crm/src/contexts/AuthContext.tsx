import { createContext, useContext, useEffect, useState } from "react";
import { User as FirebaseUser, onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";

export interface AppUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  companyId: string | null;
  role: string | null;
}

interface AuthContextType {
  user: AppUser | null;
  loading: boolean;
  firestoreError: string | null;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  firestoreError: null,
});

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [firestoreError, setFirestoreError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          const userDoc = await getDoc(doc(db, "users", firebaseUser.uid));
          const userData = userDoc.data();
          setFirestoreError(null);
          setUser({
            uid: firebaseUser.uid,
            email: firebaseUser.email,
            displayName: userData?.displayName ?? firebaseUser.displayName ?? null,
            companyId: userData?.companyId ?? null,
            role: userData?.role ?? null,
          });
        } catch (error: unknown) {
          const code = (error as { code?: string })?.code ?? "";
          // Firestore not set up or offline — still let the user in so they
          // aren't trapped on the login screen. Show a setup banner instead.
          console.error("Firestore error:", code, error);
          if (
            code === "unavailable" ||
            code === "failed-precondition" ||
            code === "permission-denied"
          ) {
            setFirestoreError(code);
          } else {
            setFirestoreError("unknown");
          }
          // Fall back to Firebase Auth data so login still works
          setUser({
            uid: firebaseUser.uid,
            email: firebaseUser.email,
            displayName: firebaseUser.displayName,
            companyId: null,
            role: null,
          });
        }
      } else {
        setUser(null);
        setFirestoreError(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, firestoreError }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
