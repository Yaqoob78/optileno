import React from 'react';

const TermsOfService: React.FC = () => {
    return (
        <div style={{
            backgroundColor: '#ffffff',
            color: '#1a1a1a',
            minHeight: '100vh',
            padding: '4rem 2rem',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
            lineHeight: '1.6',
            maxWidth: '800px',
            margin: '0 auto'
        }}>
            <h1 style={{ fontSize: '2.5rem', marginBottom: '1rem', borderBottom: '2px solid #f0f0f0', paddingBottom: '1rem' }}>Terms of Service</h1>
            <p style={{ color: '#666', marginBottom: '2rem' }}>Last Updated: February 12, 2026</p>

            <section style={{ marginBottom: '2rem' }}>
                <h2 style={{ fontSize: '1.5rem', marginTop: '2rem' }}>1. Acceptance of Terms</h2>
                <p>
                    By accessing or using Optileno (“the Service”, “we”, “us”, “our”), you agree to be bound by these Terms of Service (“Terms”). If you do not agree to these Terms, you must not access or use the Service.
                </p>
                <p>
                    By using the Service, you confirm that you are legally capable of entering into a binding agreement under applicable law.
                </p>
            </section>

            <section style={{ marginBottom: '2rem' }}>
                <h2 style={{ fontSize: '1.5rem', marginTop: '2rem' }}>2. Eligibility</h2>
                <p>
                    You must be at least 18 years old to use Optileno. By using the Service, you represent and warrant that you meet this requirement.
                </p>
            </section>

            <section style={{ marginBottom: '2rem' }}>
                <h2 style={{ fontSize: '1.5rem', marginTop: '2rem' }}>3. License to Use the Service</h2>
                <p>
                    We grant you a limited, non-exclusive, non-transferable, revocable license to access and use the Service strictly in accordance with these Terms.
                </p>
                <p>You agree not to:</p>
                <ul>
                    <li>Use the Service for any illegal, harmful, or unauthorized purpose</li>
                    <li>Copy, resell, sublicense, or exploit the Service or its outputs commercially without permission</li>
                    <li>Reverse engineer, scrape, or attempt to extract source code, models, or system logic</li>
                    <li>Use the Service to build or compete with a similar AI or automation product</li>
                </ul>
                <p>We reserve the right to revoke access at any time.</p>
            </section>

            <section style={{ marginBottom: '2rem' }}>
                <h2 style={{ fontSize: '1.5rem', marginTop: '2rem' }}>4. User Accounts & Security</h2>
                <p>
                    You are responsible for maintaining the confidentiality of your account credentials and for all activity that occurs under your account.
                </p>
                <p>You agree:</p>
                <ul>
                    <li>Not to share accounts</li>
                    <li>Not to impersonate others</li>
                    <li>Not to misuse the Service</li>
                </ul>
                <p>Any misuse may result in immediate termination without notice.</p>
            </section>

            <section style={{ marginBottom: '2rem' }}>
                <h2 style={{ fontSize: '1.5rem', marginTop: '2rem' }}>5. AI Services Disclaimer (IMPORTANT)</h2>
                <p>
                    Optileno provides AI-powered productivity insights, planning suggestions, behavioral analysis, and automation assistance.
                </p>
                <p>You expressly acknowledge and agree that:</p>
                <ul>
                    <li>AI-generated outputs may be inaccurate, incomplete, misleading, or incorrect</li>
                    <li>The Service does not provide professional, financial, medical, psychological, legal, or business advice</li>
                    <li>You are solely responsible for how you interpret and use any output</li>
                    <li>Decisions made based on AI outputs are made entirely at your own risk</li>
                </ul>
                <p>Optileno makes no guarantees regarding accuracy, reliability, availability, or results.</p>
            </section>

            <section style={{ marginBottom: '2rem' }}>
                <h2 style={{ fontSize: '1.5rem', marginTop: '2rem' }}>6. Data Usage</h2>
                <p>
                    By using the Service, you consent to the processing of your interaction data for:
                </p>
                <ul>
                    <li>Providing core functionality</li>
                    <li>Improving relevance and personalization</li>
                    <li>System optimization and security</li>
                </ul>
                <p>
                    We implement reasonable industry-standard security measures, but no system is 100% secure, and we do not guarantee absolute protection.
                </p>
                <p>Details are explained further in our Privacy Policy.</p>
            </section>

            <section style={{ marginBottom: '2rem' }}>
                <h2 style={{ fontSize: '1.5rem', marginTop: '2rem' }}>7. Free Trial, Subscriptions & Payments</h2>
                <p>
                    Optileno offers a 7-day free trial on the Explorer plan only.
                </p>
                <p>After the free trial ends:</p>
                <ul>
                    <li>Your subscription will begin automatically unless canceled</li>
                    <li>You will be charged according to the selected plan</li>
                </ul>
                <div style={{ padding: '1rem', backgroundColor: '#fff8f8', borderLeft: '4px solid #ff4444', marginTop: '1rem' }}>
                    <h3 style={{ fontSize: '1.1rem', marginBottom: '0.5rem', color: '#cc0000' }}>⚠️ No Refund Policy</h3>
                    <p>All payments are final and non-refundable, including:</p>
                    <ul>
                        <li>Partial usage</li>
                        <li>Dissatisfaction</li>
                        <li>Forgetting to cancel</li>
                        <li>Feature changes</li>
                        <li>AI output issues</li>
                    </ul>
                    <p>No refunds will be issued once a paid subscription begins.</p>
                </div>
                <p style={{ marginTop: '1rem' }}>
                    Payments are processed securely through third-party payment providers (e.g., Razorpay). We do not control or store payment details.
                </p>
            </section>

            <section style={{ marginBottom: '2rem' }}>
                <h2 style={{ fontSize: '1.5rem', marginTop: '2rem' }}>8. Service Availability & Changes</h2>
                <p>We may:</p>
                <ul>
                    <li>Modify or discontinue features</li>
                    <li>Update pricing</li>
                    <li>Suspend or terminate the Service</li>
                    <li>Perform maintenance or upgrades</li>
                </ul>
                <p>All services are provided “AS IS” and “AS AVAILABLE”, without warranties of any kind.</p>
            </section>

            <section style={{ marginBottom: '2rem' }}>
                <h2 style={{ fontSize: '1.5rem', marginTop: '2rem' }}>9. Termination</h2>
                <p>
                    We may suspend or terminate your account at any time, with or without notice, for any reason, including violation of these Terms.
                </p>
                <p>Upon termination:</p>
                <ul>
                    <li>Access to the Service will cease immediately</li>
                    <li>No refunds will be provided</li>
                    <li>Data may be deleted permanently</li>
                </ul>
            </section>

            <section style={{ marginBottom: '2rem' }}>
                <h2 style={{ fontSize: '1.5rem', marginTop: '2rem' }}>10. Intellectual Property</h2>
                <p>
                    All content, software, AI systems, branding, and features belong exclusively to Optileno or its licensors.
                </p>
                <p>You do not acquire ownership rights by using the Service.</p>
            </section>

            <section style={{ marginBottom: '2rem' }}>
                <h2 style={{ fontSize: '1.5rem', marginTop: '2rem' }}>11. Limitation of Liability</h2>
                <p>To the maximum extent permitted by law:</p>
                <ul>
                    <li>Optileno shall not be liable for any indirect, incidental, special, consequential, or punitive damages, including but not limited to loss of data, profits, productivity, business, or reputation.</li>
                    <li>Our total liability, if any, shall not exceed the amount paid by you in the last 3 months, or ₹1,000 INR, whichever is lower.</li>
                </ul>
            </section>

            <section style={{ marginBottom: '2rem' }}>
                <h2 style={{ fontSize: '1.5rem', marginTop: '2rem' }}>12. Indemnification</h2>
                <p>
                    You agree to indemnify and hold harmless Optileno from any claims, damages, losses, or legal actions arising from:
                </p>
                <ul>
                    <li>Your misuse of the Service</li>
                    <li>Violation of these Terms</li>
                    <li>Reliance on AI-generated outputs</li>
                </ul>
            </section>

            <section style={{ marginBottom: '2rem' }}>
                <h2 style={{ fontSize: '1.5rem', marginTop: '2rem' }}>13. Governing Law & Jurisdiction</h2>
                <p>
                    These Terms shall be governed by the laws of India. Any disputes shall be subject to the exclusive jurisdiction of courts located in India.
                </p>
            </section>

            <section style={{ marginBottom: '2rem' }}>
                <h2 style={{ fontSize: '1.5rem', marginTop: '2rem' }}>14. Changes to Terms</h2>
                <p>
                    We may update these Terms at any time. Continued use of the Service after changes constitutes acceptance of the revised Terms.
                </p>
            </section>

            <section style={{ marginBottom: '2rem' }}>
                <h2 style={{ fontSize: '1.5rem', marginTop: '2rem' }}>15. Contact</h2>
                <p>For questions regarding these Terms, contact us at:</p>
                <p style={{ fontWeight: 'bold' }}>optilenoai@gmail.com</p>
                <p style={{ marginTop: '2rem', fontSize: '0.9rem', color: '#888' }}>
                    © 2026 Optileno. All rights reserved.
                </p>
            </section>
        </div>
    );
};

export default TermsOfService;
