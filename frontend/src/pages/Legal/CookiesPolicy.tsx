import React from 'react';
import { Link } from 'react-router-dom';

const CookiesPolicy: React.FC = () => {
    const styles = {
        page: {
            backgroundColor: '#ffffff',
            color: '#1a1a1a',
            minHeight: '100vh',
            padding: '4rem 2rem',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
            lineHeight: '1.7',
            maxWidth: '820px',
            margin: '0 auto',
        } as React.CSSProperties,
        h1: { fontSize: '2.5rem', marginBottom: '0.5rem', borderBottom: '2px solid #f0f0f0', paddingBottom: '1rem', fontWeight: 700 } as React.CSSProperties,
        updated: { color: '#666', marginBottom: '2rem', fontSize: '0.95rem' } as React.CSSProperties,
        section: { marginBottom: '2.5rem' } as React.CSSProperties,
        h2: { fontSize: '1.45rem', marginTop: '2rem', marginBottom: '0.75rem', color: '#111', fontWeight: 600 } as React.CSSProperties,
        h3: { fontSize: '1.1rem', marginTop: '1rem', marginBottom: '0.5rem', color: '#222', fontWeight: 600 } as React.CSSProperties,
        highlight: { padding: '1.25rem', backgroundColor: '#f0f9ff', borderLeft: '4px solid #3b82f6', marginTop: '1rem', borderRadius: '0 8px 8px 0' } as React.CSSProperties,
        backLink: { display: 'inline-flex', alignItems: 'center', gap: '0.5rem', color: '#6366f1', textDecoration: 'none', fontSize: '0.9rem', marginBottom: '2rem', fontWeight: 500 } as React.CSSProperties,
        nav: { display: 'flex', gap: '1.5rem', marginBottom: '2rem', flexWrap: 'wrap' as const, fontSize: '0.85rem' } as React.CSSProperties,
        navLink: { color: '#6366f1', textDecoration: 'none' } as React.CSSProperties,
        table: { width: '100%', borderCollapse: 'collapse' as const, marginTop: '1rem', fontSize: '0.9rem' } as React.CSSProperties,
        th: { textAlign: 'left' as const, padding: '0.75rem', borderBottom: '2px solid #e2e8f0', fontWeight: 600, color: '#374151', background: '#f8fafc' } as React.CSSProperties,
        td: { padding: '0.75rem', borderBottom: '1px solid #f1f5f9', verticalAlign: 'top' as const } as React.CSSProperties,
    };

    return (
        <div style={styles.page}>
            <Link to="/" style={styles.backLink}>← Back to Home</Link>

            <h1 style={styles.h1}>Cookies Policy</h1>
            <p style={styles.updated}>Last Updated: February 17, 2026 &nbsp;|&nbsp; Effective Date: February 17, 2026</p>

            <div style={styles.nav}>
                <Link to="/terms" style={styles.navLink}>Terms & Conditions</Link>
                <Link to="/privacy" style={styles.navLink}>Privacy Policy</Link>
                <Link to="/refund" style={styles.navLink}>Refund Policy</Link>
            </div>

            <p>
                This Cookies Policy explains how Optileno ("we", "our", "us") uses cookies and similar tracking technologies when you visit or use our website and applications (the "Service"). This policy should be read alongside our <Link to="/privacy" style={{ color: '#6366f1' }}>Privacy Policy</Link>.
            </p>

            {/* 1. What Are Cookies */}
            <section style={styles.section}>
                <h2 style={styles.h2}>1. What Are Cookies?</h2>
                <p>
                    Cookies are small text files that are placed on your device (computer, smartphone, tablet) when you visit a website. They are widely used to make websites work more efficiently and to provide information to website owners.
                </p>
                <p style={{ marginTop: '0.75rem' }}>
                    Cookies can be "persistent" (they remain on your device until deleted or expired) or "session" cookies (they are deleted when you close your browser). Cookies can also be set by the website you are visiting ("first-party cookies") or by third parties ("third-party cookies").
                </p>
            </section>

            {/* 2. How We Use Cookies */}
            <section style={styles.section}>
                <h2 style={styles.h2}>2. How We Use Cookies</h2>
                <p>Optileno uses cookies and similar technologies for the following purposes:</p>

                <table style={styles.table}>
                    <thead>
                        <tr>
                            <th style={styles.th}>Category</th>
                            <th style={styles.th}>Purpose</th>
                            <th style={styles.th}>Required?</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td style={styles.td}><strong>Essential / Strictly Necessary</strong></td>
                            <td style={styles.td}>Required for the website to function. These enable core functionality such as authentication, session management, security, and account access. The Service cannot operate without these.</td>
                            <td style={styles.td}>Yes</td>
                        </tr>
                        <tr>
                            <td style={styles.td}><strong>Functional / Preferences</strong></td>
                            <td style={styles.td}>Used to remember your preferences and settings (such as theme, language, and display options) to provide a customized experience.</td>
                            <td style={styles.td}>No</td>
                        </tr>
                        <tr>
                            <td style={styles.td}><strong>Analytics / Performance</strong></td>
                            <td style={styles.td}>Help us understand how visitors interact with the Service by collecting usage data (pages visited, features used, session duration). This data is aggregated and anonymized to improve the Service.</td>
                            <td style={styles.td}>No</td>
                        </tr>
                        <tr>
                            <td style={styles.td}><strong>Security</strong></td>
                            <td style={styles.td}>Used to detect and prevent fraud, protect against unauthorized access, and maintain the security of your account and our systems.</td>
                            <td style={styles.td}>Yes</td>
                        </tr>
                    </tbody>
                </table>
            </section>

            {/* 3. Specific Cookies Used */}
            <section style={styles.section}>
                <h2 style={styles.h2}>3. Specific Cookies & Technologies We Use</h2>

                <table style={styles.table}>
                    <thead>
                        <tr>
                            <th style={styles.th}>Cookie / Technology</th>
                            <th style={styles.th}>Type</th>
                            <th style={styles.th}>Purpose</th>
                            <th style={styles.th}>Duration</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td style={styles.td}><strong>Authentication Token</strong></td>
                            <td style={styles.td}>Essential</td>
                            <td style={styles.td}>Maintains your login session and authenticates requests to the Service</td>
                            <td style={styles.td}>Session / up to 30 days</td>
                        </tr>
                        <tr>
                            <td style={styles.td}><strong>Refresh Token</strong></td>
                            <td style={styles.td}>Essential</td>
                            <td style={styles.td}>Used to renew your authentication session securely</td>
                            <td style={styles.td}>Up to 30 days</td>
                        </tr>
                        <tr>
                            <td style={styles.td}><strong>User Preferences</strong></td>
                            <td style={styles.td}>Functional</td>
                            <td style={styles.td}>Stores your theme, display, and interface preferences</td>
                            <td style={styles.td}>Persistent (up to 1 year)</td>
                        </tr>
                        <tr>
                            <td style={styles.td}><strong>Cookie Consent</strong></td>
                            <td style={styles.td}>Essential</td>
                            <td style={styles.td}>Remembers your cookie consent choice so we don't ask you again</td>
                            <td style={styles.td}>1 year</td>
                        </tr>
                        <tr>
                            <td style={styles.td}><strong>Local Storage</strong></td>
                            <td style={styles.td}>Functional</td>
                            <td style={styles.td}>Stores application state and cached data for better performance</td>
                            <td style={styles.td}>Until cleared</td>
                        </tr>
                    </tbody>
                </table>

                <div style={styles.highlight}>
                    <p>
                        <strong>📋 Note:</strong> Optileno does <strong>not</strong> use advertising cookies or tracking pixels. We do not serve third-party ads, and we do not share your browsing data with advertisers.
                    </p>
                </div>
            </section>

            {/* 4. Local Storage & Similar Technologies */}
            <section style={styles.section}>
                <h2 style={styles.h2}>4. Local Storage & Similar Technologies</h2>
                <p>
                    In addition to cookies, we may use other browser-based storage technologies such as:
                </p>
                <ul>
                    <li><strong>Local Storage:</strong> Used to store application state, user preferences, and cached data for improved performance</li>
                    <li><strong>Session Storage:</strong> Used to maintain temporary data during your browsing session</li>
                    <li><strong>IndexedDB:</strong> May be used for storing larger amounts of local data for offline functionality (if applicable)</li>
                </ul>
                <p style={{ marginTop: '0.75rem' }}>
                    These technologies serve similar purposes to cookies and are governed by the same principles outlined in this policy.
                </p>
            </section>

            {/* 5. Third-Party Cookies */}
            <section style={styles.section}>
                <h2 style={styles.h2}>5. Third-Party Cookies</h2>
                <p>
                    Some cookies may be set by trusted third-party services that we use to operate the Service:
                </p>
                <ul>
                    <li><strong>Payment Processors (Razorpay / Cashfree):</strong> May set cookies during the payment process for security, fraud detection, and transaction verification</li>
                    <li><strong>Cloud Infrastructure Providers:</strong> May set cookies for load balancing, security, and service delivery</li>
                </ul>
                <p style={{ marginTop: '0.75rem' }}>
                    We do not control the cookies set by third parties. Please refer to their respective privacy and cookie policies for more information.
                </p>
            </section>

            {/* 6. Managing Cookies */}
            <section style={styles.section}>
                <h2 style={styles.h2}>6. Managing Your Cookie Preferences</h2>
                <p>
                    You have several options for managing cookies:
                </p>

                <h3 style={styles.h3}>6.1 Cookie Consent Banner</h3>
                <p>
                    When you first visit Optileno, you will see a cookie consent banner that allows you to accept or manage your cookie preferences.
                </p>

                <h3 style={styles.h3}>6.2 Browser Settings</h3>
                <p>
                    Most web browsers allow you to control cookies through their settings. You can typically:
                </p>
                <ul>
                    <li>View what cookies are stored on your device</li>
                    <li>Delete individual or all cookies</li>
                    <li>Block cookies from specific websites</li>
                    <li>Block all third-party cookies</li>
                    <li>Set up notifications when cookies are being set</li>
                </ul>

                <p style={{ marginTop: '0.75rem' }}>
                    Here are links to cookie management instructions for popular browsers:
                </p>
                <ul>
                    <li><strong>Google Chrome:</strong> Settings → Privacy and Security → Cookies</li>
                    <li><strong>Mozilla Firefox:</strong> Settings → Privacy & Security → Cookies</li>
                    <li><strong>Safari:</strong> Preferences → Privacy → Cookies</li>
                    <li><strong>Microsoft Edge:</strong> Settings → Cookies and Site Permissions</li>
                </ul>

                <div style={styles.highlight}>
                    <p>
                        <strong>⚠️ Important:</strong> Disabling essential cookies may prevent the Service from functioning correctly. You may not be able to log in, access your account, or use core features if essential cookies are blocked.
                    </p>
                </div>
            </section>

            {/* 7. Changes */}
            <section style={styles.section}>
                <h2 style={styles.h2}>7. Changes to This Cookies Policy</h2>
                <p>
                    We may update this Cookies Policy from time to time to reflect changes in our practices or applicable regulations. When we make changes, we will update the "Last Updated" date at the top of this page.
                </p>
                <p style={{ marginTop: '0.75rem' }}>
                    Continued use of the Service after any changes constitutes your acceptance of the revised Cookies Policy.
                </p>
            </section>

            {/* 8. Contact */}
            <section style={styles.section}>
                <h2 style={styles.h2}>8. Contact Us</h2>
                <p>If you have any questions about this Cookies Policy, please contact us:</p>
                <div style={{ marginTop: '1rem', padding: '1.25rem', background: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                    <p><strong>Optileno</strong></p>
                    <p>Email: <strong>optilenoai@gmail.com</strong></p>
                    <p>Website: <strong>optileno.com</strong></p>
                </div>
                <p style={{ marginTop: '2rem', fontSize: '0.9rem', color: '#888' }}>
                    © 2026 Optileno. All rights reserved.
                </p>
            </section>
        </div>
    );
};

export default CookiesPolicy;
