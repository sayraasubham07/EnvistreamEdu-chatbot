import React, { createContext, useContext, useState, useEffect } from 'react';
import { getFirebase } from './firebase';
import { signInWithPopup, onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [authError, setAuthError] = useState(null);

    useEffect(() => {
        let unsubscribe;
        const initAuth = async () => {
            try {
                const { auth, db } = await getFirebase();
                unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
                    if (firebaseUser) {
                        // 1. Instantly set user state with local details so the UI loads immediately!
                        let initialCredits = 5;
                        try {
                            const cached = localStorage.getItem('user');
                            if (cached) {
                                const parsed = JSON.parse(cached);
                                if (parsed.uid === firebaseUser.uid) {
                                    initialCredits = parsed.credits ?? 5;
                                }
                            }
                        } catch (e) {}

                        const immediateUserData = {
                            uid: firebaseUser.uid,
                            name: firebaseUser.displayName,
                            email: firebaseUser.email,
                            picture: firebaseUser.photoURL,
                            credits: initialCredits,
                            last_login: new Date().toISOString()
                        };
                        
                        setUser(immediateUserData);
                        setLoading(false);

                        // 2. Perform Firestore sync and token fetch in the background asynchronously
                        (async () => {
                            try {
                                const token = await firebaseUser.getIdToken();
                                
                                // Backend sync disabled — no backend server running
                                // If you add a backend later, uncomment the fetch below:
                                // fetch("/api/auth/verify", {
                                //     method: "POST",
                                //     headers: { 
                                //         "Content-Type": "application/json",
                                //         "Authorization": `Bearer ${token}`
                                //     },
                                //     body: JSON.stringify(immediateUserData)
                                // }).catch(() => {});

                                // Async firestore sync
                                const userDocRef = doc(db, "users", firebaseUser.uid);
                                const userDocSnap = await getDoc(userDocRef);
                                let finalCredits = initialCredits;

                                if (!userDocSnap.exists()) {
                                    await setDoc(userDocRef, {
                                        uid: firebaseUser.uid,
                                        name: firebaseUser.displayName,
                                        email: firebaseUser.email,
                                        picture: firebaseUser.photoURL,
                                        credits: 5,
                                        last_login: serverTimestamp()
                                    });
                                    finalCredits = 5;
                                } else {
                                    await setDoc(userDocRef, {
                                        last_login: serverTimestamp()
                                    }, { merge: true });
                                    finalCredits = userDocSnap.data().credits ?? 5;
                                }

                                // Update user state with the final synced credits asynchronously
                                const syncedUserData = {
                                    ...immediateUserData,
                                    credits: finalCredits
                                };
                                setUser(syncedUserData);
                                localStorage.setItem('user', JSON.stringify(syncedUserData));
                            } catch (firestoreError) {
                                console.warn("Background Firestore user sync failed:", firestoreError);
                                localStorage.setItem('user', JSON.stringify(immediateUserData));
                            }
                        })();
                        
                        // The async IIFE above handles setting user, fetching token, and backend sync.
                    } else {
                        setUser(null);
                        localStorage.removeItem('user');
                    }
                    setLoading(false);
                });
            } catch (error) {
                console.error("Auth init error:", error);
                setAuthError(error.message);
                setLoading(false);
            }
        };

        initAuth();
        return () => unsubscribe && unsubscribe();
    }, []);

    const loginWithGoogle = async () => {
        try {
            setAuthError(null);
            const { auth, provider } = await getFirebase();
            const result = await signInWithPopup(auth, provider);
            return result.user;
        } catch (error) {
            console.error("Login failed:", error);
            // More detailed error logging
            if (error.code === 'auth/popup-closed-by-user') {
                setAuthError('Sign-in popup was closed. Please try again.');
            } else if (error.code === 'auth/cancelled-popup-request') {
                setAuthError('Multiple popup requests detected. Please try again.');
            } else if (error.code === 'auth/operation-not-allowed') {
                setAuthError('Google sign-in is not enabled. Please contact the administrator.');
            } else if (error.code === 'auth/unauthorized-domain') {
                const currentDomain = window.location.hostname;
                setAuthError(
                    `Domain "${currentDomain}" is not authorized for OAuth. ` +
                    `Please add it to Firebase Console > Authentication > Settings > Authorized domains.`
                );
            } else {
                setAuthError(error.message);
            }
            throw error;
        }
    };

    const logout = async () => {
        try {
            const { auth } = await getFirebase();
            await signOut(auth);
            setUser(null);
            localStorage.removeItem('user');
        } catch (error) {
            console.error("Logout failed:", error);
        }
    };

    const clearAuthError = () => setAuthError(null);

    return (
        <AuthContext.Provider value={{ user, loading, loginWithGoogle, logout, authError, clearAuthError }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
