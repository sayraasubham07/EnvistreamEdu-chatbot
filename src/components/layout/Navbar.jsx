import React, { useState, useEffect, useRef } from "react";
import 'bootstrap/dist/css/bootstrap.min.css';
import './Navbar.css';
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../lib/AuthContext";

export default function Navbar() {
    const [scrolled, setScrolled] = useState(false);
    const [showDropdown, setShowDropdown] = useState(false);
    const { user, loginWithGoogle, logout, authError, clearAuthError } = useAuth();
    const navigate = useNavigate();
    const dropdownRef = useRef(null);

    useEffect(() => {
        const handleScroll = () => {
            if (window.scrollY > 50) {
                setScrolled(true);
            } else {
                setScrolled(false);
            }
        };

        window.addEventListener("scroll", handleScroll);
        return () => {
            window.removeEventListener("scroll", handleScroll);
        };
    }, []);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
                setShowDropdown(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const handleProfileClick = async () => {
        if (user) {
            setShowDropdown(!showDropdown);
        } else {
            try {
                const result = await loginWithGoogle();
                console.log("Login successful:", result);
            } catch (err) {
                console.error("Login Error:", err);
            }
        }
    };

    const handleLogout = async () => {
        setShowDropdown(false);
        await logout();
    };

    const handleGoToProfile = () => {
        setShowDropdown(false);
        navigate('/profile');
    };

    return (
        <>
            {authError && (
                <div className="alert alert-danger alert-dismissible fade show text-center m-0 rounded-0" role="alert" style={{ zIndex: 1100, position: 'relative' }}>
                    <div className="container position-relative">
                        <strong>Authentication Error:</strong> {authError}
                        <div className="small mt-1">
                            Please make sure Google Sign-in is enabled in your Firebase Console (Authentication &gt; Sign-in method) and this domain is added to your Authorized Domains list.
                        </div>
                        <button type="button" className="btn-close" aria-label="Close" onClick={clearAuthError} style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', border: 'none', background: 'transparent', fontSize: '1.25rem', cursor: 'pointer' }}>×</button>
                    </div>
                </div>
            )}
            <nav className={`navbar navbar-expand-lg sticky-top ${scrolled ? 'scrolled' : ''}`}>
                <div className="container d-flex justify-content-between align-items-center">
                    <a className="navbar-brand" href="/">
                        <img src="/envistream-logo.png" alt="Envistream EduSkill Logo" className="navbar-logo" />
                    </a>
                    
                    <div className="d-flex align-items-center gap-3">
                        <div className="nav-profile-wrapper" ref={dropdownRef}>
                            <div className="nav-profile" onClick={handleProfileClick}>
                            {user && user.picture ? (
                                <img 
                                  src={user.picture} 
                                  alt="Profile" 
                                  className="profile-pic-nav" 
                                  referrerPolicy="no-referrer"
                                  onError={(e) => {
                                    e.target.style.display = 'none';
                                    e.target.parentElement.innerHTML = '<div class="profile-dummy-icon"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="d-inline-block"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg></div>';
                                  }}
                                />
                            ) : (
                                <div className="profile-dummy-icon">
                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="d-inline-block"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                                </div>
                            )}
                        </div>

                        {/* Dropdown menu for logged-in users */}
                        {showDropdown && user && (
                            <div className="nav-profile-dropdown">
                                <div className="dropdown-user-info">
                                    <span className="dropdown-user-name">{user.name}</span>
                                    <span className="dropdown-user-email">{user.email}</span>
                                </div>
                                <hr className="dropdown-divider" />
                                <button className="dropdown-item" onClick={() => { setShowDropdown(false); navigate('/chat'); }}>
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '8px', color: '#007bff' }}><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg> Chat
                                </button>
                                <button className="dropdown-item" onClick={handleGoToProfile}>
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '8px', color: '#17a2b8' }}><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg> Profile
                                </button>
                                <button className="dropdown-item dropdown-logout" onClick={handleLogout}>
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '8px', color: '#ff6b6b' }}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg> Logout
                                </button>
                            </div>
                        )}
                        </div>
                    </div>
                </div>
            </nav>
        </>
    );
}
