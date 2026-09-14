import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getFirebase } from '../../lib/firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import { signOut } from 'firebase/auth';
import './Profile.css';

const Profile = () => {
    const [user, setUser] = useState(null);
    const [profileData, setProfileData] = useState(null);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    useEffect(() => {
        const storedUser = localStorage.getItem('user');
        if (storedUser) {
            const parsedUser = JSON.parse(storedUser);
            setUser(parsedUser);
            
            // Listen to Firestore user doc in real-time
            let unsubscribe;
            const initProfile = async () => {
                try {
                    const { db } = await getFirebase();
                const userDocRef = doc(db, "users", parsedUser.uid);
                
                const unsubscribe = onSnapshot(userDocRef, (docSnap) => {
                    if (docSnap.exists()) {
                        const data = docSnap.data();
                        setProfileData({
                            credits: data.credits,
                            last_login: data.last_login?.toDate?.() ? data.last_login.toDate().toISOString() : data.last_login
                        });
                    } else {
                        setProfileData({ credits: 5 });
                    }
                    setLoading(false);
                }, (error) => {
                    console.error("Firestore onSnapshot error:", error);
                    setLoading(false);
                });
                
                } catch (err) {
                    console.error("Firebase init error in Profile:", err);
                    setLoading(false);
                }
            };
            initProfile();
            return () => {
                if (unsubscribe) unsubscribe();
            };
        } else {
            navigate('/');
        }
    }, [navigate]);

    const handleLogout = async () => {
        try {
            const { auth } = await getFirebase();
            await signOut(auth);
        } catch (err) {
            console.error("Logout error:", err);
        }
        localStorage.removeItem('user');
        navigate('/');
    };

    if (!user) return null;

    return (
        <div className="profile-container">
            <div className="profile-card">
                <div className="profile-header">
                    <button className="back-btn" onClick={() => navigate('/')}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline-block', verticalAlign: 'middle' }}><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
                    </button>
                    <h2>Profile Folder</h2>
                </div>
                
                <div className="profile-content">
                    <div className="profile-image-container">
<img 
  src={user.picture || '/suu-icon.webp'} 
  alt={user.name} 
  className="profile-pic-large" 
  onError={(e) => {
    e.target.src = '/suu-icon.webp';
    e.target.alt = 'Sayraa Avatar';
  }}
/>
                    </div>
                    
                    <div className="profile-info">
                        <div className="info-group">
                            <label>Name</label>
                            <p>{user.name}</p>
                        </div>
                        <div className="info-group">
                            <label>Email</label>
                            <p>{user.email}</p>
                        </div>
                        <div className="info-group">
                            <label>Talks Remaining</label>
                            <p className="credits-text">
                                Unlimited ∞
                            </p>
                        </div>
                        <div className="info-group">
                            <label>Member Since</label>
                            <p>{new Date(user.last_login).toLocaleDateString()}</p>
                        </div>
                    </div>

                    <button className="logout-btn" onClick={handleLogout}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '6px', display: 'inline-block', verticalAlign: 'middle' }}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg> Logout
                    </button>
                </div>
            </div>
            
            <div className="profile-footer">
                <p>Protected by Sayraa Backend SSO</p>
            </div>
        </div>
    );
};

export default Profile;
