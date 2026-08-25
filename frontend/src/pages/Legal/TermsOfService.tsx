import React from 'react';
import { Link } from 'react-router-dom';

const TermsOfService: React.FC = () => {
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
        important: { padding: '1.25rem', backgroundColor: '#fff8f0', borderLeft: '4px solid #f59e0b', marginTop: '1rem', borderRadius: '0 8px 8px 0' } as React.CSSProperties,
        warning: { padding: '1.25rem', backgroundColor: '#fef2f2', borderLeft: '4px solid #ef4444', marginTop: '1rem', borderRadius: '0 8px 8px 0' } as React.CSSProperties,
        info: { padding: '1.25rem', backgroundColor: '#f0f9ff', borderLeft: '4px solid #3b82f6', marginTop: '1rem', borderRadius: '0 8px 8px 0' } as React.CSSProperties,
        backLink: { display: 'inline-flex', alignItems: 'center', gap: '0.5rem', color: '#6366f1', textDecoration: 'none', fontSize: '0.9rem', marginBottom: '2rem', fontWeight: 500 } as React.CSSProperties,
        nav: { display: 'flex', gap: '1.5rem', marginBottom: '2rem', flexWrap: 'wrap' as const, fontSize: '0.85rem' } as React.CSSProperties,
        navLink: { color: '#6366f1', textDecoration: 'none' } as React.CSSProperties,
    };

    return (
        <div style={styles.page}>
            <Link to="/" style={styles.backLink}>← Back to Home</Link>

            <h1 style={styles.h1}>Terms & Conditions</h1>
            <p style={styles.updated}>Last Updated: February 17, 2026 &nbsp;|&nbsp; Effective Date: February 17, 2026</p>

            <div style={styles.nav}>
                <Link to="/privacy" style={styles.navLink}>Privacy Policy</Link>
                <Link to="/refund" style={styles.navLink}>Refund Policy</Link>
                <Link to="/cookies" style={styles.navLink}>Cookies Policy</Link>
            </div>

            <p>
                Welcome to Optileno. These Terms & Conditions ("Terms", "Agreement") govern your use of the Optileno website, applications, and all related services (collectively, the "Service") operated by Optileno ("we", "us", "our").
            </p>
            <p style={{ marginTop: '0.75rem' }}>
                Please read these Terms carefully before using the Service. By accessing or using Optileno, you agree to be bound by these Terms. If you do not agree, you must not access or use the Service.
            </p>

            {/* 1. Service Description */}
            <section style={styles.section}>
                <h2 style={styles.h2}>1. Service Description</h2>
                <p>
                    Optileno is an AI-powered productivity and personal growth platform. The Service provides:
                </p>
                <ul>
                    <li>AI-powered productivity tools, planning, and scheduling assistance</li>
                    <li>Personal analytics including behavior timeline, focus tracking, and performance insights</li>
                    <li>Goal setting, task management, and habit tracking features</li>
                    <li>Mood tracking and well-being monitoring</li>
                    <li>Personality assessments (Big Five personality test)</li>
                    <li>AI-driven recommendations and insights to help users track goals and improve performance</li>
                </ul>
                <p style={{ marginTop: '0.75rem' }}>
                    Optileno is a <strong>digital software service (SaaS)</strong> delivered entirely online. No physical goods are shipped or delivered.
                </p>
            </section>

            {/* 2. Eligibility */}
            <section style={styles.section}>
                <h2 style={styles.h2}>2. Eligibility</h2>
                <p>
                    You must be at least <strong>18 years of age</strong> to use Optileno. By creating an account or using the Service, you represent and warrant that:
                </p>
                <ul>
                    <li>You are at least 18 years old</li>
                    <li>You are legally capable of entering into a binding agreement under applicable law</li>
                    <li>You have not been previously suspended or removed from the Service</li>
                    <li>Your use of the Service does not violate any applicable law or regulation</li>
                </ul>
            </section>

            {/* 3. Account Registration & Security */}
            <section style={styles.section}>
                <h2 style={styles.h2}>3. Account Registration & Security</h2>
                <p>
                    To access the Service, you must create an account by providing accurate and complete information, including your name and email address.
                </p>
                <h3 style={styles.h3}>Your Responsibilities:</h3>
                <ul>
                    <li>You are responsible for maintaining the confidentiality of your account credentials (email and password)</li>
                    <li>You are responsible for all activities that occur under your account</li>
                    <li>You must notify us immediately at <strong>optilenoai@gmail.com</strong> if you suspect unauthorized access</li>
                    <li>You agree not to share, transfer, or sell your account to any other person</li>
                    <li>You agree not to create multiple accounts or impersonate any person</li>
                </ul>
                <p style={{ marginTop: '0.75rem' }}>
                    We reserve the right to suspend or terminate accounts that violate these Terms, without prior notice.
                </p>
            </section>

            {/* 4. Subscription Model & Pricing */}
            <section style={styles.section}>
                <h2 style={styles.h2}>4. Subscription Model & Pricing</h2>
                <p>
                    Optileno is a <strong>subscription-based digital service</strong> billed on a recurring basis (monthly or yearly, depending on the selected plan).
                </p>

                <h3 style={styles.h3}>4.1 Plans</h3>
                <p>We currently offer the following subscription plans:</p>
                <ul>
                    <li><strong>Explorer Plan</strong> — Entry-level plan with AI chat, manual planner, mood tracking, and basic analytics</li>
                    <li><strong>Ultra Plan</strong> — Premium plan with advanced AI capabilities, agentic planner automation, detailed analytics, and priority features</li>
                </ul>
                <p style={{ marginTop: '0.75rem' }}>
                    Detailed pricing information, including current rates and included features, is available on our registration page and within the application.
                </p>

                <h3 style={styles.h3}>4.2 Billing</h3>
                <ul>
                    <li>Subscription fees are charged automatically at the beginning of each billing cycle</li>
                    <li>All prices are listed in USD ($) and are subject to applicable taxes</li>
                    <li>We reserve the right to update pricing with reasonable notice to existing subscribers</li>
                </ul>
            </section>

            {/* 5. Free Plan & Subscriptions */}
            <section style={styles.section}>
                <h2 style={styles.h2}>5. Free Plan & Subscriptions</h2>
                <div style={styles.important}>
                    <h3 style={{ ...styles.h3, marginTop: 0, color: '#b45309' }}>📋 Plan Terms</h3>
                    <p>
                        Optileno offers a <strong>Free Forever plan</strong> with core task planning, habits, goals, and daily AI assistance at no charge.
                    </p>
                    <ul style={{ marginTop: '0.5rem' }}>
                        <li>The Free plan does not require a credit card or payment method</li>
                        <li>Optional paid subscriptions (such as <strong>Ultra Pro at $6.99/month or $49/year</strong>) provide higher daily AI limits and advanced features</li>
                        <li>Paid subscriptions renew automatically on a monthly or annual basis until cancelled</li>
                        <li>You may upgrade, downgrade, or cancel your subscription at any time from your account settings</li>
                    </ul>
                </div>
            </section>

            {/* 6. Payments */}
            <section style={styles.section}>
                <h2 style={styles.h2}>6. Payments</h2>
                <p>
                    All payments are processed securely through our trusted third-party merchant of record, <strong>Lemon Squeezy</strong>.
                </p>
                <ul>
                    <li>We do not store, process, or have access to your credit/debit card details or banking information</li>
                    <li>Payment processing is subject to the payment provider's terms and privacy policy</li>
                    <li>You agree to pay all applicable subscription fees and any taxes associated with your use of the Service</li>
                    <li>Failed payments may result in service interruption or account suspension</li>
                </ul>
            </section>

            {/* 7. Refund & Cancellation Policy */}
            <section style={styles.section}>
                <h2 style={styles.h2}>7. Refund & Cancellation Policy</h2>

                <h3 style={styles.h3}>7.1 Cancellation</h3>
                <p>
                    You may cancel your subscription at any time through your account settings or by contacting us at <strong>optilenoai@gmail.com</strong>.
                </p>
                <ul>
                    <li>Upon cancellation, your access continues until the end of your current billing period</li>
                    <li>No partial refunds are issued for unused portions of a billing cycle</li>
                    <li>Cancellation does not delete your account data — you can request account deletion separately</li>
                </ul>

                <h3 style={styles.h3}>7.2 Refund Policy</h3>
                <div style={styles.warning}>
                    <h3 style={{ ...styles.h3, marginTop: 0, color: '#dc2626' }}>Refund Terms</h3>
                    <p>
                        Due to the <strong>digital nature</strong> of the product, all payments are <strong>final and non-refundable</strong> once a subscription period has started. This includes, but is not limited to:
                    </p>
                    <ul style={{ marginTop: '0.5rem' }}>
                        <li>Partial usage of the subscription period</li>
                        <li>Dissatisfaction with features or AI outputs</li>
                        <li>Forgetting to cancel before the trial or billing cycle</li>
                        <li>Changes to features, pricing, or service availability</li>
                        <li>Technical issues on the user's end (browser, device, internet connectivity)</li>
                    </ul>
                    <p style={{ marginTop: '0.75rem' }}>
                        We encourage all users to fully utilize the free trial period (where applicable) to evaluate the Service before committing to a paid subscription.
                    </p>
                </div>
                <p style={{ marginTop: '1rem' }}>
                    For a complete overview of our refund terms, please see our <Link to="/refund" style={{ color: '#6366f1' }}>Refund Policy</Link>.
                </p>
            </section>

            {/* 8. Acceptable Use */}
            <section style={styles.section}>
                <h2 style={styles.h2}>8. Acceptable Use</h2>
                <p>You agree to use the Service only for lawful purposes and in accordance with these Terms. You agree not to:</p>
                <ul>
                    <li>Use the Service for any illegal, harmful, abusive, or unauthorized purpose</li>
                    <li>Copy, resell, sublicense, redistribute, or commercially exploit the Service or its outputs without written permission</li>
                    <li>Reverse engineer, scrape, decompile, or attempt to extract source code, AI models, or system logic</li>
                    <li>Use the Service to build, train, or compete with a similar AI, productivity, or automation product</li>
                    <li>Attempt to gain unauthorized access to the Service, other user accounts, or our systems</li>
                    <li>Upload or transmit viruses, malware, or any harmful code</li>
                    <li>Interfere with or disrupt the Service, servers, or networks</li>
                    <li>Use the Service to send spam, unsolicited messages, or bulk communications</li>
                    <li>Misrepresent your identity or affiliation with any person or organization</li>
                </ul>
                <p style={{ marginTop: '0.75rem' }}>
                    Violation of these terms may result in immediate termination of your account without notice or refund.
                </p>
            </section>

            {/* 9. AI Services Disclaimer */}
            <section style={styles.section}>
                <h2 style={styles.h2}>9. AI Services Disclaimer</h2>
                <div style={styles.info}>
                    <p>
                        Optileno provides <strong>AI-powered productivity insights</strong>, planning suggestions, behavioral analysis, and automation assistance. These features are powered by artificial intelligence and machine learning technologies.
                    </p>
                </div>
                <p style={{ marginTop: '1rem' }}>You expressly acknowledge and agree that:</p>
                <ul>
                    <li>AI-generated outputs, recommendations, and insights may be <strong>inaccurate, incomplete, misleading, or incorrect</strong></li>
                    <li>The Service <strong>does not</strong> provide professional, financial, medical, psychological, therapeutic, legal, or business advice</li>
                    <li>You are <strong>solely responsible</strong> for how you interpret, evaluate, and act upon any AI-generated output</li>
                    <li>Decisions made based on AI outputs are made <strong>entirely at your own risk</strong></li>
                    <li>AI features may use third-party AI providers (such as large language models) to process your data and generate insights</li>
                    <li>We do not guarantee specific outcomes, results, or improvements from using the Service</li>
                </ul>
                <p style={{ marginTop: '0.75rem' }}>
                    <strong>Optileno makes no guarantees</strong> regarding the accuracy, reliability, completeness, or suitability of any AI-generated content for any particular purpose.
                </p>
            </section>

            {/* 10. Data Usage */}
            <section style={styles.section}>
                <h2 style={styles.h2}>10. Data Usage & Privacy</h2>
                <p>
                    By using the Service, you consent to the collection, processing, and use of your data as described in our <Link to="/privacy" style={{ color: '#6366f1' }}>Privacy Policy</Link>. Your data is used for:
                </p>
                <ul>
                    <li>Providing and operating core Service functionality</li>
                    <li>Generating AI-powered insights and personalized recommendations</li>
                    <li>Improving the quality, relevance, and performance of the Service</li>
                    <li>Processing subscriptions and payments</li>
                    <li>System security, fraud prevention, and abuse detection</li>
                    <li>Communication about your account, billing, and service updates</li>
                </ul>
                <p style={{ marginTop: '0.75rem' }}>
                    We implement reasonable industry-standard security measures to protect your data. However, no system is completely secure, and we cannot guarantee absolute protection. For full details, please review our <Link to="/privacy" style={{ color: '#6366f1' }}>Privacy Policy</Link> and <Link to="/cookies" style={{ color: '#6366f1' }}>Cookies Policy</Link>.
                </p>
            </section>

            {/* 11. Service Availability */}
            <section style={styles.section}>
                <h2 style={styles.h2}>11. Service Availability & Changes</h2>
                <p>
                    We strive for continuous availability but <strong>do not guarantee uninterrupted, error-free, or always-available service</strong>.
                </p>
                <p style={{ marginTop: '0.75rem' }}>We reserve the right to:</p>
                <ul>
                    <li>Modify, update, or discontinue features or functionality at any time</li>
                    <li>Update pricing for new or renewing subscriptions with reasonable notice</li>
                    <li>Perform scheduled or emergency maintenance that may temporarily impact availability</li>
                    <li>Suspend or terminate the Service in whole or in part</li>
                </ul>
                <p style={{ marginTop: '0.75rem' }}>
                    All services are provided <strong>"AS IS"</strong> and <strong>"AS AVAILABLE"</strong>, without warranties of any kind, whether express, implied, or statutory.
                </p>
            </section>

            {/* 12. Intellectual Property */}
            <section style={styles.section}>
                <h2 style={styles.h2}>12. Intellectual Property</h2>
                <p>
                    All content, software, AI systems, algorithms, designs, branding, logos, trademarks, and features of the Service belong exclusively to Optileno or its licensors and are protected by intellectual property laws.
                </p>
                <ul>
                    <li>You do not acquire any ownership rights by using the Service</li>
                    <li>You may not copy, reproduce, distribute, or create derivative works based on the Service without express written permission</li>
                    <li>User-generated content (tasks, goals, notes, etc.) remains your property, but you grant us a limited license to process it as necessary to deliver the Service</li>
                </ul>
            </section>

            {/* 13. Termination */}
            <section style={styles.section}>
                <h2 style={styles.h2}>13. Termination</h2>
                <p>
                    We may suspend or terminate your account at any time, with or without notice, for any reason, including but not limited to violation of these Terms.
                </p>
                <h3 style={styles.h3}>Upon Termination:</h3>
                <ul>
                    <li>Access to the Service will cease immediately</li>
                    <li>No refunds will be provided for any remaining subscription period</li>
                    <li>Your data may be deleted permanently after a reasonable retention period</li>
                    <li>Sections of these Terms that by their nature should survive termination will continue to apply (including limitations of liability, indemnification, and dispute resolution)</li>
                </ul>
                <h3 style={styles.h3}>Voluntary Account Deletion:</h3>
                <p>
                    You may request deletion of your account and associated data at any time by contacting us at <strong>optilenoai@gmail.com</strong>. We will process your request within a reasonable timeframe, subject to any legal retention requirements.
                </p>
            </section>

            {/* 14. Limitation of Liability */}
            <section style={styles.section}>
                <h2 style={styles.h2}>14. Limitation of Liability</h2>
                <p>To the maximum extent permitted by applicable law:</p>
                <ul>
                    <li>Optileno shall <strong>not be liable</strong> for any indirect, incidental, special, consequential, or punitive damages, including but not limited to loss of data, profits, productivity, revenue, business opportunities, or reputation</li>
                    <li>Our <strong>total aggregate liability</strong>, if any, arising out of or relating to these Terms or your use of the Service shall not exceed the amount paid by you to Optileno in the <strong>three (3) months</strong> immediately preceding the event giving rise to the liability, or <strong>₹1,000 INR (approximately $12 USD)</strong>, whichever is lower</li>
                    <li>We are not liable for any loss or damage arising from your reliance on AI-generated outputs, recommendations, or insights</li>
                    <li>We are not liable for service interruptions, downtime, data loss, or technical issues beyond our reasonable control</li>
                </ul>
            </section>

            {/* 15. Indemnification */}
            <section style={styles.section}>
                <h2 style={styles.h2}>15. Indemnification</h2>
                <p>
                    You agree to indemnify, defend, and hold harmless Optileno, its founders, employees, contractors, and affiliates from and against any claims, damages, losses, liabilities, costs, or expenses (including reasonable legal fees) arising from or relating to:
                </p>
                <ul>
                    <li>Your use or misuse of the Service</li>
                    <li>Your violation of these Terms</li>
                    <li>Your reliance on AI-generated outputs or recommendations</li>
                    <li>Your violation of any applicable law, regulation, or third-party rights</li>
                    <li>Any content you submit or create through the Service</li>
                </ul>
            </section>

            {/* 16. Disclaimer of Warranties */}
            <section style={styles.section}>
                <h2 style={styles.h2}>16. Disclaimer of Warranties</h2>
                <p>
                    THE SERVICE IS PROVIDED ON AN "AS IS" AND "AS AVAILABLE" BASIS WITHOUT WARRANTIES OF ANY KIND, WHETHER EXPRESS, IMPLIED, STATUTORY, OR OTHERWISE. WE SPECIFICALLY DISCLAIM ALL IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, TITLE, AND NON-INFRINGEMENT.
                </p>
                <p style={{ marginTop: '0.75rem' }}>
                    We do not warrant that:
                </p>
                <ul>
                    <li>The Service will meet your specific requirements or expectations</li>
                    <li>The Service will be uninterrupted, timely, secure, or error-free</li>
                    <li>The results obtained from using the Service will be accurate or reliable</li>
                    <li>Any errors in the Service will be corrected</li>
                </ul>
            </section>

            {/* 17. Force Majeure */}
            <section style={styles.section}>
                <h2 style={styles.h2}>17. Force Majeure</h2>
                <p>
                    We shall not be liable for any failure or delay in performing our obligations under these Terms if such failure or delay results from circumstances beyond our reasonable control, including but not limited to natural disasters, pandemics, government actions, cyber attacks, internet outages, power failures, or third-party service provider failures.
                </p>
            </section>

            {/* 18. Dispute Resolution */}
            <section style={styles.section}>
                <h2 style={styles.h2}>18. Governing Law & Dispute Resolution</h2>
                <p>
                    These Terms shall be governed by and construed in accordance with the <strong>laws of India</strong>, without regard to its conflict of law provisions.
                </p>
                <ul>
                    <li>Any disputes arising out of or relating to these Terms or the Service shall first be attempted to be resolved through good-faith negotiation between the parties</li>
                    <li>If negotiation fails, disputes shall be subject to the <strong>exclusive jurisdiction of the courts located in India</strong></li>
                    <li>You waive any right to participate in class-action lawsuits or class-wide arbitration against Optileno</li>
                </ul>
            </section>

            {/* 19. Severability */}
            <section style={styles.section}>
                <h2 style={styles.h2}>19. Severability</h2>
                <p>
                    If any provision of these Terms is held to be invalid, illegal, or unenforceable by a court of competent jurisdiction, the remaining provisions shall continue in full force and effect. The invalid or unenforceable provision shall be modified to the minimum extent necessary to make it valid and enforceable.
                </p>
            </section>

            {/* 20. Entire Agreement */}
            <section style={styles.section}>
                <h2 style={styles.h2}>20. Entire Agreement</h2>
                <p>
                    These Terms, together with our <Link to="/privacy" style={{ color: '#6366f1' }}>Privacy Policy</Link>, <Link to="/refund" style={{ color: '#6366f1' }}>Refund Policy</Link>, and <Link to="/cookies" style={{ color: '#6366f1' }}>Cookies Policy</Link>, constitute the entire agreement between you and Optileno regarding the use of the Service, and supersede any prior agreements, understandings, or representations.
                </p>
            </section>

            {/* 21. Changes to Terms */}
            <section style={styles.section}>
                <h2 style={styles.h2}>21. Changes to These Terms</h2>
                <p>
                    We may update or modify these Terms at any time at our sole discretion. When we make changes, we will update the "Last Updated" date at the top of this page.
                </p>
                <p style={{ marginTop: '0.75rem' }}>
                    Continued use of the Service after any changes constitutes your acceptance of the revised Terms. If you do not agree with the updated Terms, you must stop using the Service and may cancel your subscription.
                </p>
            </section>

            {/* 22. Contact */}
            <section style={styles.section}>
                <h2 style={styles.h2}>22. Contact Us</h2>
                <p>If you have any questions, concerns, or requests regarding these Terms, please contact us:</p>
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

export default TermsOfService;
