import React from 'react';
import { Link } from 'react-router-dom';

const PrivacyPolicy: React.FC = () => {
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
        important: { padding: '1.25rem', backgroundColor: '#fff8f0', borderLeft: '4px solid #f59e0b', marginTop: '1rem', borderRadius: '0 8px 8px 0' } as React.CSSProperties,
        backLink: { display: 'inline-flex', alignItems: 'center', gap: '0.5rem', color: '#6366f1', textDecoration: 'none', fontSize: '0.9rem', marginBottom: '2rem', fontWeight: 500 } as React.CSSProperties,
        nav: { display: 'flex', gap: '1.5rem', marginBottom: '2rem', flexWrap: 'wrap' as const, fontSize: '0.85rem' } as React.CSSProperties,
        navLink: { color: '#6366f1', textDecoration: 'none' } as React.CSSProperties,
        table: { width: '100%', borderCollapse: 'collapse' as const, marginTop: '1rem', fontSize: '0.95rem' } as React.CSSProperties,
        th: { textAlign: 'left' as const, padding: '0.75rem', borderBottom: '2px solid #e2e8f0', fontWeight: 600, color: '#374151' } as React.CSSProperties,
        td: { padding: '0.75rem', borderBottom: '1px solid #f1f5f9', verticalAlign: 'top' as const } as React.CSSProperties,
    };

    return (
        <div style={styles.page}>
            <Link to="/" style={styles.backLink}>← Back to Home</Link>

            <h1 style={styles.h1}>Privacy Policy</h1>
            <p style={styles.updated}>Last Updated: February 17, 2026 &nbsp;|&nbsp; Effective Date: February 17, 2026</p>

            <div style={styles.nav}>
                <Link to="/terms" style={styles.navLink}>Terms & Conditions</Link>
                <Link to="/refund" style={styles.navLink}>Refund Policy</Link>
                <Link to="/cookies" style={styles.navLink}>Cookies Policy</Link>
            </div>

            <p>
                Optileno ("we", "our", "us") is committed to protecting your privacy and personal information. This Privacy Policy explains how we collect, use, store, share, and protect information when you use our website, applications, and AI-powered services (collectively, the "Service").
            </p>
            <p style={{ marginTop: '0.75rem' }}>
                By using Optileno, you agree to the collection and use of information in accordance with this Privacy Policy. If you do not agree, please do not use the Service.
            </p>

            {/* 1. Information We Collect */}
            <section style={styles.section}>
                <h2 style={styles.h2}>1. Information We Collect</h2>

                <h3 style={styles.h3}>1.1 Personal Information (provided by you)</h3>
                <p>When you register for an account or use the Service, we may collect:</p>
                <ul>
                    <li>Full name</li>
                    <li>Email address</li>
                    <li>Password (stored in encrypted/hashed form)</li>
                    <li>Profile information you voluntarily provide</li>
                    <li>Subscription and plan details</li>
                </ul>

                <h3 style={styles.h3}>1.2 Usage & Behavioral Data (collected automatically)</h3>
                <p>We automatically collect information about how you interact with the Service, including:</p>
                <ul>
                    <li>Feature usage patterns and frequency</li>
                    <li>Interaction logs and session duration</li>
                    <li>Tasks, goals, habits, and productivity data you create</li>
                    <li>Mood tracking inputs and well-being data</li>
                    <li>Performance and analytics data</li>
                    <li>Device information (browser type, operating system)</li>
                    <li>IP address and approximate location (country/region level only)</li>
                </ul>

                <h3 style={styles.h3}>1.3 AI Interaction Data</h3>
                <p>We collect data from your interactions with AI features, including:</p>
                <ul>
                    <li>Prompts, messages, and queries submitted to the AI assistant</li>
                    <li>Behavioral signals and planning data processed by AI</li>
                    <li>AI-generated outputs and recommendations</li>
                    <li>Personality assessment responses and results</li>
                </ul>
                <div style={styles.important}>
                    <p>
                        <strong>⚠️ AI Processing Disclosure:</strong> Some of your data may be processed by <strong>third-party AI providers</strong> (such as large language model providers) to generate insights, recommendations, and analysis. This processing is solely for the purpose of delivering the Service's AI features and improving your experience. We do not sell your personal data to AI providers.
                    </p>
                </div>

                <h3 style={styles.h3}>1.4 Payment Information</h3>
                <p>
                    Payments are processed securely by third-party payment processors, including <strong>Razorpay</strong> and <strong>Cashfree</strong>.
                </p>
                <ul>
                    <li>We do <strong>not</strong> store, process, or have access to your credit/debit card numbers, CVV, or banking details</li>
                    <li>We may receive limited transaction information such as payment status, transaction ID, and billing period for record-keeping purposes</li>
                    <li>Payment processors are PCI-DSS compliant</li>
                </ul>

                <h3 style={styles.h3}>1.5 Cookies & Tracking Technologies</h3>
                <p>
                    We use cookies and similar tracking technologies to enhance your experience. For detailed information, please see our <Link to="/cookies" style={{ color: '#6366f1' }}>Cookies Policy</Link>.
                </p>
            </section>

            {/* 2. Why We Collect This Information */}
            <section style={styles.section}>
                <h2 style={styles.h2}>2. Why We Collect This Information</h2>
                <p>We use the information we collect for the following purposes:</p>

                <table style={styles.table}>
                    <thead>
                        <tr>
                            <th style={styles.th}>Purpose</th>
                            <th style={styles.th}>Description</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td style={styles.td}><strong>Service Delivery</strong></td>
                            <td style={styles.td}>To provide, operate, and maintain core features and functionality</td>
                        </tr>
                        <tr>
                            <td style={styles.td}><strong>Personalization</strong></td>
                            <td style={styles.td}>To customize AI insights, recommendations, and analytics to your needs</td>
                        </tr>
                        <tr>
                            <td style={styles.td}><strong>AI Features</strong></td>
                            <td style={styles.td}>To generate AI-powered productivity insights, behavioral analysis, and planning assistance</td>
                        </tr>
                        <tr>
                            <td style={styles.td}><strong>Improvement</strong></td>
                            <td style={styles.td}>To improve features, performance, accuracy, and user experience</td>
                        </tr>
                        <tr>
                            <td style={styles.td}><strong>Billing & Payments</strong></td>
                            <td style={styles.td}>To process subscriptions, handle payments, and manage billing</td>
                        </tr>
                        <tr>
                            <td style={styles.td}><strong>Communication</strong></td>
                            <td style={styles.td}>To respond to support requests, send service updates, and important notifications</td>
                        </tr>
                        <tr>
                            <td style={styles.td}><strong>Security</strong></td>
                            <td style={styles.td}>To maintain security, detect fraud, prevent abuse, and protect the Service</td>
                        </tr>
                        <tr>
                            <td style={styles.td}><strong>Legal Compliance</strong></td>
                            <td style={styles.td}>To comply with applicable legal and regulatory obligations</td>
                        </tr>
                    </tbody>
                </table>
            </section>

            {/* 3. Legal Basis for Processing */}
            <section style={styles.section}>
                <h2 style={styles.h2}>3. Legal Basis for Processing</h2>
                <p>We process your personal data based on the following legal grounds:</p>
                <ul>
                    <li><strong>Consent:</strong> You have given consent for processing (e.g., by creating an account and accepting these terms)</li>
                    <li><strong>Contract Performance:</strong> Processing is necessary to provide the Service as agreed upon in our Terms & Conditions</li>
                    <li><strong>Legitimate Interests:</strong> We have legitimate interests in improving, securing, and operating Optileno, including fraud prevention and service enhancement</li>
                    <li><strong>Legal Obligation:</strong> Processing is required to comply with applicable laws and regulations</li>
                </ul>
            </section>

            {/* 4. AI & Automated Processing */}
            <section style={styles.section}>
                <h2 style={styles.h2}>4. AI & Automated Processing Disclosure</h2>
                <div style={styles.highlight}>
                    <p>
                        Optileno uses <strong>artificial intelligence models</strong>, including third-party AI providers (such as large language models), to process user inputs and generate outputs including productivity insights, behavioral analysis, recommendations, and automated planning suggestions.
                    </p>
                </div>
                <p style={{ marginTop: '1rem' }}>You acknowledge that:</p>
                <ul>
                    <li>AI processing may involve automated analysis, pattern recognition, and machine learning</li>
                    <li>AI-generated outputs may be inaccurate, incomplete, or unsuitable for your specific situation</li>
                    <li>Third-party AI providers may process limited data <strong>solely to deliver functionality</strong> — we carefully select providers with strong privacy commitments</li>
                    <li>We do <strong>not sell</strong> your personal data to AI providers or any third party</li>
                    <li>You should not rely on AI outputs as professional, medical, financial, legal, or therapeutic advice</li>
                </ul>
            </section>

            {/* 5. Data Sharing */}
            <section style={styles.section}>
                <h2 style={styles.h2}>5. Data Sharing & Third-Party Services</h2>
                <p>We may share limited data with trusted third parties, strictly as necessary to operate the Service:</p>
                <ul>
                    <li><strong>Payment processors</strong> (e.g., Razorpay, Cashfree) — for processing subscription payments securely</li>
                    <li><strong>AI infrastructure providers</strong> — for powering AI features and generating insights</li>
                    <li><strong>Cloud hosting and infrastructure</strong> — for storing and serving the application</li>
                    <li><strong>Analytics tools</strong> — for understanding usage patterns and improving the Service (aggregated, anonymized data where possible)</li>
                </ul>

                <h3 style={styles.h3}>We do NOT:</h3>
                <ul>
                    <li>Sell your personal information to third parties</li>
                    <li>Share your data for advertising or marketing purposes with external companies</li>
                    <li>Provide your data to data brokers</li>
                </ul>

                <p style={{ marginTop: '0.75rem' }}>
                    We are not responsible for the privacy practices of third-party services. Their use is governed by their respective privacy policies, and we encourage you to review them.
                </p>
            </section>

            {/* 6. Data Safety */}
            <section style={styles.section}>
                <h2 style={styles.h2}>6. Data Security</h2>
                <div style={styles.highlight}>
                    <p>
                        We take <strong>reasonable administrative, technical, and organizational measures</strong> to protect your personal data, including:
                    </p>
                    <ul style={{ marginTop: '0.5rem' }}>
                        <li>Encryption of data in transit (HTTPS/TLS) and at rest</li>
                        <li>Secure password hashing</li>
                        <li>Access controls and authentication mechanisms</li>
                        <li>Regular security reviews and monitoring</li>
                    </ul>
                </div>
                <p style={{ marginTop: '1rem' }}>
                    However, no method of electronic transmission or storage is completely secure. While we strive to use commercially acceptable means to protect your data, we <strong>cannot guarantee absolute security</strong> and are not liable for unauthorized access resulting from circumstances beyond our reasonable control.
                </p>
                <p style={{ marginTop: '0.75rem' }}>
                    <strong>We do not sell personal information.</strong> Your data is used solely to provide and improve the Service.
                </p>
            </section>

            {/* 7. Data Retention */}
            <section style={styles.section}>
                <h2 style={styles.h2}>7. Data Retention</h2>
                <p>We retain your personal data:</p>
                <ul>
                    <li>For as long as your account remains active</li>
                    <li>As necessary to provide the Service and maintain your subscription</li>
                    <li>As required by legal, regulatory, or compliance obligations</li>
                    <li>For a reasonable period after account deletion to process the request and fulfill legal requirements</li>
                </ul>
                <p style={{ marginTop: '0.75rem' }}>
                    Upon account deletion, we will delete or anonymize your personal data within a reasonable timeframe (typically within 30 days), except where retention is legally required.
                </p>
            </section>

            {/* 8. International Data Transfers */}
            <section style={styles.section}>
                <h2 style={styles.h2}>8. International Data Transfers</h2>
                <p>
                    Your information may be processed or stored on servers located outside your country of residence, including in countries that may have different data protection laws than your jurisdiction.
                </p>
                <p style={{ marginTop: '0.75rem' }}>
                    By using Optileno, you consent to such data transfers in accordance with this Privacy Policy. We take reasonable steps to ensure your data is treated securely regardless of where it is processed.
                </p>
            </section>

            {/* 9. Children's Privacy */}
            <section style={styles.section}>
                <h2 style={styles.h2}>9. Children's Privacy</h2>
                <p>
                    Optileno is <strong>not intended for users under 18 years of age</strong>. We do not knowingly collect personal data from minors. If we discover that we have inadvertently collected data from a user under 18, we will promptly delete such data and terminate the associated account.
                </p>
                <p style={{ marginTop: '0.75rem' }}>
                    If you believe a minor has provided us with personal information, please contact us immediately at <strong>optilenoai@gmail.com</strong>.
                </p>
            </section>

            {/* 10. Your Rights */}
            <section style={styles.section}>
                <h2 style={styles.h2}>10. Your Rights</h2>
                <p>Depending on your jurisdiction, you may have the following rights regarding your personal data:</p>
                <ul>
                    <li><strong>Right to Access:</strong> Request a copy of the personal data we hold about you</li>
                    <li><strong>Right to Correction:</strong> Request correction of inaccurate or incomplete data</li>
                    <li><strong>Right to Deletion:</strong> Request deletion of your personal data and account</li>
                    <li><strong>Right to Data Portability:</strong> Request your data in a structured, machine-readable format</li>
                    <li><strong>Right to Withdraw Consent:</strong> Withdraw consent for data processing where applicable (this may affect Service functionality)</li>
                    <li><strong>Right to Object:</strong> Object to certain types of data processing</li>
                    <li><strong>Right to Restrict Processing:</strong> Request restriction of processing in certain circumstances</li>
                </ul>
                <p style={{ marginTop: '0.75rem' }}>
                    To exercise any of these rights, please contact us at <strong>optilenoai@gmail.com</strong>. We will respond to your request within a reasonable timeframe (typically within 30 days).
                </p>
            </section>

            {/* 11. Account Deletion */}
            <section style={styles.section}>
                <h2 style={styles.h2}>11. Account Deletion</h2>
                <p>
                    You may request the deletion of your account and all associated personal data at any time by contacting us at <strong>optilenoai@gmail.com</strong>.
                </p>
                <p style={{ marginTop: '0.75rem' }}>Upon receiving your deletion request:</p>
                <ul>
                    <li>We will verify your identity before processing the request</li>
                    <li>Your account and personal data will be permanently deleted within 30 days</li>
                    <li>Some data may be retained if required by legal or regulatory obligations</li>
                    <li>Deletion is irreversible — all your data including tasks, goals, habits, analytics, and AI history will be permanently removed</li>
                </ul>
            </section>

            {/* 12. Do Not Track */}
            <section style={styles.section}>
                <h2 style={styles.h2}>12. Do Not Track Signals</h2>
                <p>
                    Some browsers offer a "Do Not Track" (DNT) feature. At this time, we do not respond to DNT signals, as there is no industry-wide uniform standard for recognizing or honoring DNT signals.
                </p>
            </section>

            {/* 13. Changes to Policy */}
            <section style={styles.section}>
                <h2 style={styles.h2}>13. Changes to This Privacy Policy</h2>
                <p>
                    We may update this Privacy Policy from time to time to reflect changes in our practices, technologies, legal requirements, or other operational reasons.
                </p>
                <p style={{ marginTop: '0.75rem' }}>
                    When we make changes, we will update the "Last Updated" date at the top of this page. We may also notify you via email or in-app notification for significant changes.
                </p>
                <p style={{ marginTop: '0.75rem' }}>
                    Continued use of the Service after any changes constitutes your acceptance of the revised Privacy Policy.
                </p>
            </section>

            {/* 14. Contact */}
            <section style={styles.section}>
                <h2 style={styles.h2}>14. Contact Us</h2>
                <p>If you have any questions, concerns, or requests regarding this Privacy Policy or our data practices, please contact us:</p>
                <div style={{ marginTop: '1rem', padding: '1.25rem', background: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                    <p><strong>Optileno</strong></p>
                    <p>Email: <strong>optilenoai@gmail.com</strong></p>
                    <p>Website: <strong>optileno.com</strong></p>
                    <p style={{ marginTop: '0.5rem', fontSize: '0.9rem', color: '#666' }}>
                        We aim to respond to all privacy-related inquiries within 30 days.
                    </p>
                </div>
                <p style={{ marginTop: '2rem', fontSize: '0.9rem', color: '#888' }}>
                    © 2026 Optileno. All rights reserved.
                </p>
            </section>
        </div>
    );
};

export default PrivacyPolicy;
