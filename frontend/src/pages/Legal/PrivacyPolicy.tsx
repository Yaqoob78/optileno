import React from 'react';

const PrivacyPolicy: React.FC = () => {
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
            <h1 style={{ fontSize: '2.5rem', marginBottom: '1rem', borderBottom: '2px solid #f0f0f0', paddingBottom: '1rem' }}>Privacy Policy</h1>
            <p style={{ color: '#666', marginBottom: '2rem' }}>Last Updated: February 12, 2026</p>

            <p>
                Optileno (“we”, “our”, “us”) values your privacy and is committed to protecting your personal information. This Privacy Policy explains how we collect, use, store, and disclose information when you use our website, applications, and AI-powered services (collectively, the “Service”).
            </p>
            <p style={{ marginTop: '1rem' }}>
                By using Optileno, you agree to the practices described in this Privacy Policy.
            </p>

            <section style={{ marginBottom: '2rem' }}>
                <h2 style={{ fontSize: '1.5rem', marginTop: '2rem' }}>1. Information We Collect</h2>
                <h3 style={{ fontSize: '1.1rem', marginTop: '1rem' }}>a. Personal Information</h3>
                <p>We may collect:</p>
                <ul>
                    <li>Name</li>
                    <li>Email address</li>
                    <li>Profile information you voluntarily provide</li>
                </ul>

                <h3 style={{ fontSize: '1.1rem', marginTop: '1rem' }}>b. Usage & Behavioral Data</h3>
                <p>We collect information about how you interact with the Service, including:</p>
                <ul>
                    <li>Feature usage</li>
                    <li>Interaction logs</li>
                    <li>Session duration</li>
                    <li>Goals, tasks, and productivity signals</li>
                </ul>

                <h3 style={{ fontSize: '1.1rem', marginTop: '1rem' }}>c. AI Interaction Data</h3>
                <p>We collect inputs you provide to AI features, including:</p>
                <ul>
                    <li>Prompts</li>
                    <li>Behavioral signals</li>
                    <li>Planning and productivity data</li>
                </ul>
                <p>This data is used only to deliver, personalize, and improve the Service.</p>

                <h3 style={{ fontSize: '1.1rem', marginTop: '1rem' }}>d. Payment Information</h3>
                <p>
                    Payments are processed by third-party payment providers such as Razorpay.
                    We do not store or process credit/debit card details on our servers.
                </p>
            </section>

            <section style={{ marginBottom: '2rem' }}>
                <h2 style={{ fontSize: '1.5rem', marginTop: '2rem' }}>2. Legal Basis for Processing</h2>
                <p>We process your data based on:</p>
                <ul>
                    <li>Your consent</li>
                    <li>The performance of a contract (providing the Service)</li>
                    <li>Our legitimate interests in improving, securing, and operating Optileno</li>
                </ul>
            </section>

            <section style={{ marginBottom: '2rem' }}>
                <h2 style={{ fontSize: '1.5rem', marginTop: '2rem' }}>3. How We Use Your Information</h2>
                <p>We use collected information to:</p>
                <ul>
                    <li>Provide and operate the Service</li>
                    <li>Personalize user experience</li>
                    <li>Generate AI-powered insights and behavioral analytics</li>
                    <li>Improve features, performance, and reliability</li>
                    <li>Process subscriptions and transactions</li>
                    <li>Respond to support requests</li>
                    <li>Maintain security and prevent misuse</li>
                </ul>
            </section>

            <section style={{ marginBottom: '2rem' }}>
                <h2 style={{ fontSize: '1.5rem', marginTop: '2rem' }}>4. AI & Automated Processing Disclosure</h2>
                <p>
                    Optileno uses artificial intelligence models (including third-party providers such as large language models) to process user inputs and generate outputs.
                </p>
                <p>You acknowledge that:</p>
                <ul>
                    <li>AI processing may involve automated analysis</li>
                    <li>AI-generated outputs may be inaccurate or incomplete</li>
                    <li>AI providers may process limited data solely to deliver functionality</li>
                </ul>
                <p>We do not sell your personal data to AI providers.</p>
            </section>

            <section style={{ marginBottom: '2rem' }}>
                <h2 style={{ fontSize: '1.5rem', marginTop: '2rem' }}>5. Cookies & Tracking</h2>
                <p>We use cookies and similar technologies to:</p>
                <ul>
                    <li>Store preferences</li>
                    <li>Improve user experience</li>
                    <li>Analyze usage patterns</li>
                </ul>
                <p>You can control cookies through your browser settings.</p>
            </section>

            <section style={{ marginBottom: '2rem' }}>
                <h2 style={{ fontSize: '1.5rem', marginTop: '2rem' }}>6. Data Retention</h2>
                <p>We retain personal data:</p>
                <ul>
                    <li>For as long as your account remains active</li>
                    <li>As necessary to provide the Service</li>
                    <li>As required by legal or regulatory obligations</li>
                </ul>
                <p>
                    Upon account deletion, we will delete or anonymize personal data within a reasonable timeframe, except where retention is legally required.
                </p>
            </section>

            <section style={{ marginBottom: '2rem' }}>
                <h2 style={{ fontSize: '1.5rem', marginTop: '2rem' }}>7. Data Security</h2>
                <p>
                    We use reasonable administrative, technical, and organizational measures (such as encryption and access controls) to protect your information.
                </p>
                <p>
                    However, no system is completely secure, and we cannot guarantee absolute security of your data.
                </p>
            </section>

            <section style={{ marginBottom: '2rem' }}>
                <h2 style={{ fontSize: '1.5rem', marginTop: '2rem' }}>8. Third-Party Services</h2>
                <p>We may share limited data with trusted third parties, including:</p>
                <ul>
                    <li>Payment processors (e.g., Razorpay)</li>
                    <li>AI infrastructure providers</li>
                    <li>Analytics and monitoring tools</li>
                </ul>
                <p>
                    We are not responsible for the privacy practices of third-party services. Their use is governed by their respective privacy policies.
                </p>
            </section>

            <section style={{ marginBottom: '2rem' }}>
                <h2 style={{ fontSize: '1.5rem', marginTop: '2rem' }}>9. International Users & Data Transfers</h2>
                <p>
                    Your information may be processed or stored in servers located outside your country of residence. By using Optileno, you consent to such data transfers in accordance with this Privacy Policy.
                </p>
            </section>

            <section style={{ marginBottom: '2rem' }}>
                <h2 style={{ fontSize: '1.5rem', marginTop: '2rem' }}>10. Children’s Privacy</h2>
                <p>
                    Optileno is not intended for users under 18 years of age.
                    We do not knowingly collect personal data from minors. If such data is discovered, it will be deleted promptly.
                </p>
            </section>

            <section style={{ marginBottom: '2rem' }}>
                <h2 style={{ fontSize: '1.5rem', marginTop: '2rem' }}>11. Your Rights</h2>
                <p>You have the right to:</p>
                <ul>
                    <li>Access your personal data</li>
                    <li>Correct inaccurate data</li>
                    <li>Delete your data</li>
                    <li>Withdraw consent (where applicable)</li>
                </ul>
                <p>You can manage most options through your account or by contacting us.</p>
            </section>

            <section style={{ marginBottom: '2rem' }}>
                <h2 style={{ fontSize: '1.5rem', marginTop: '2rem' }}>12. Changes to This Policy</h2>
                <p>
                    We may update this Privacy Policy from time to time.
                    Changes will be posted on this page with an updated “Last Updated” date. Continued use of the Service constitutes acceptance of the revised policy.
                </p>
            </section>

            <section style={{ marginBottom: '2rem' }}>
                <h2 style={{ fontSize: '1.5rem', marginTop: '2rem' }}>13. Contact Us</h2>
                <p>For privacy-related questions or requests, contact:</p>
                <p style={{ fontWeight: 'bold' }}>optilenoai@gmail.com</p>
                <p style={{ marginTop: '2rem', fontSize: '0.9rem', color: '#888' }}>
                    © 2026 Optileno. All rights reserved.
                </p>
            </section>
        </div>
    );
};

export default PrivacyPolicy;
