import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Cookie, X, Shield } from 'lucide-react';
import './CookieConsent.css';

const COOKIE_CONSENT_KEY = 'optileno_cookie_consent';

export default function CookieConsent() {
    const [visible, setVisible] = useState(false);
    const [animateOut, setAnimateOut] = useState(false);

    useEffect(() => {
        const consent = localStorage.getItem(COOKIE_CONSENT_KEY);
        if (!consent) {
            // Small delay so it slides in nicely after page load
            const timer = setTimeout(() => setVisible(true), 1500);
            return () => clearTimeout(timer);
        }
    }, []);

    const handleAccept = () => {
        localStorage.setItem(COOKIE_CONSENT_KEY, JSON.stringify({
            accepted: true,
            timestamp: new Date().toISOString(),
            essential: true,
            functional: true,
            analytics: true,
        }));
        setAnimateOut(true);
        setTimeout(() => setVisible(false), 400);
    };

    const handleEssentialOnly = () => {
        localStorage.setItem(COOKIE_CONSENT_KEY, JSON.stringify({
            accepted: true,
            timestamp: new Date().toISOString(),
            essential: true,
            functional: false,
            analytics: false,
        }));
        setAnimateOut(true);
        setTimeout(() => setVisible(false), 400);
    };

    if (!visible) return null;

    return (
        <div className={`cookie-consent-overlay ${animateOut ? 'cookie-consent-exit' : 'cookie-consent-enter'}`}>
            <div className="cookie-consent-banner">
                <button
                    className="cookie-consent-close"
                    onClick={handleEssentialOnly}
                    aria-label="Close cookie banner"
                >
                    <X size={16} />
                </button>

                <div className="cookie-consent-header">
                    <div className="cookie-consent-icon">
                        <Cookie size={22} />
                    </div>
                    <h3 className="cookie-consent-title">We Value Your Privacy</h3>
                </div>

                <p className="cookie-consent-text">
                    Optileno uses cookies and similar technologies to ensure essential functionality,
                    enhance your experience, and analyze usage to improve our service.
                    By clicking "Accept All", you consent to our use of cookies as described in our{' '}
                    <Link to="/cookies" className="cookie-consent-link">Cookies Policy</Link>.
                </p>

                <div className="cookie-consent-details">
                    <div className="cookie-detail-item">
                        <Shield size={14} />
                        <span>Essential cookies are always active for security & authentication</span>
                    </div>
                </div>

                <div className="cookie-consent-actions">
                    <button className="cookie-btn-accept" onClick={handleAccept}>
                        Accept All Cookies
                    </button>
                    <button className="cookie-btn-essential" onClick={handleEssentialOnly}>
                        Essential Only
                    </button>
                </div>

                <p className="cookie-consent-learn">
                    Learn more: <Link to="/cookies" className="cookie-consent-link">Cookies Policy</Link> · <Link to="/privacy" className="cookie-consent-link">Privacy Policy</Link>
                </p>
            </div>
        </div>
    );
}
