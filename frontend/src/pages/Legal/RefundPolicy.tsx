import React from 'react';
import { Link } from 'react-router-dom';

const RefundPolicy: React.FC = () => {
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
        warning: { padding: '1.25rem', backgroundColor: '#fef2f2', borderLeft: '4px solid #ef4444', marginTop: '1rem', borderRadius: '0 8px 8px 0' } as React.CSSProperties,
        important: { padding: '1.25rem', backgroundColor: '#fff8f0', borderLeft: '4px solid #f59e0b', marginTop: '1rem', borderRadius: '0 8px 8px 0' } as React.CSSProperties,
        backLink: { display: 'inline-flex', alignItems: 'center', gap: '0.5rem', color: '#6366f1', textDecoration: 'none', fontSize: '0.9rem', marginBottom: '2rem', fontWeight: 500 } as React.CSSProperties,
        nav: { display: 'flex', gap: '1.5rem', marginBottom: '2rem', flexWrap: 'wrap' as const, fontSize: '0.85rem' } as React.CSSProperties,
        navLink: { color: '#6366f1', textDecoration: 'none' } as React.CSSProperties,
    };

    return (
        <div style={styles.page}>
            <Link to="/" style={styles.backLink}>← Back to Home</Link>

            <h1 style={styles.h1}>Refund Policy</h1>
            <p style={styles.updated}>Last Updated: February 17, 2026 &nbsp;|&nbsp; Effective Date: February 17, 2026</p>

            <div style={styles.nav}>
                <Link to="/terms" style={styles.navLink}>Terms & Conditions</Link>
                <Link to="/privacy" style={styles.navLink}>Privacy Policy</Link>
                <Link to="/cookies" style={styles.navLink}>Cookies Policy</Link>
            </div>

            <p>
                Thank you for choosing Optileno. This Refund Policy outlines the terms under which refunds are handled for our subscription-based digital service.
            </p>
            <p style={{ marginTop: '0.75rem' }}>
                By subscribing to Optileno, you acknowledge and agree to the terms outlined in this Refund Policy.
            </p>

            {/* 1. Digital Nature of the Service */}
            <section style={styles.section}>
                <h2 style={styles.h2}>1. Digital Nature of the Service</h2>
                <p>
                    Optileno is a <strong>digital software service (SaaS)</strong> that provides AI-powered productivity tools, analytics, planning, and personal growth features delivered entirely online. No physical products or goods are shipped or delivered.
                </p>
                <p style={{ marginTop: '0.75rem' }}>
                    As a digital service, you receive immediate access to all features upon subscription activation, and the Service begins delivering value from the moment your subscription starts.
                </p>
            </section>

            {/* 2. No Refund Policy */}
            <section style={styles.section}>
                <h2 style={styles.h2}>2. Refund Terms</h2>
                <div style={styles.warning}>
                    <h3 style={{ ...styles.h3, marginTop: 0, color: '#dc2626' }}>No Refunds on Processed Payments</h3>
                    <p>
                        Due to the <strong>digital nature of the product</strong>, all payments are <strong>final and non-refundable</strong> once a subscription payment has been processed.
                    </p>
                </div>

                <p style={{ marginTop: '1rem' }}>This no-refund policy applies to all situations, including but not limited to:</p>
                <ul>
                    <li>Partial usage or non-usage of features during a billing period</li>
                    <li>Dissatisfaction with the Service, features, or AI outputs</li>
                    <li>Forgetting to cancel before the free trial period ends</li>
                    <li>Forgetting to cancel before a new billing cycle begins</li>
                    <li>Changes to features, functionality, or pricing</li>
                    <li>Technical issues on the user's end (browser compatibility, internet connectivity, device issues)</li>
                    <li>Account suspension or termination due to Terms violation</li>
                    <li>Duplicate payments (contact us for assistance — see Section 5)</li>
                </ul>
            </section>

            {/* 3. Free Plan & Subscriptions */}
            <section style={styles.section}>
                <h2 style={styles.h2}>3. Free Plan & Subscriptions</h2>
                <div style={styles.important}>
                    <p>
                        Optileno provides a <strong>Free Forever plan</strong> that requires no payment or credit card to access core daily planning, habits, goals, and AI assistance.
                    </p>
                </div>
                <p style={{ marginTop: '1rem' }}>Subscription terms:</p>
                <ul>
                    <li>The core Free plan is 100% free with no recurring charges</li>
                    <li>Optional paid upgrades (such as <strong>Ultra Pro at $6.99/month or $49/year</strong>) are billed in advance on a recurring basis</li>
                    <li>You can cancel your paid subscription at any time before the next billing date</li>
                    <li>Payments for active billing periods are non-refundable once processed</li>
                </ul>
            </section>

            {/* 4. Cancellation */}
            <section style={styles.section}>
                <h2 style={styles.h2}>4. Cancellation Policy</h2>
                <p>
                    You can cancel your subscription <strong>at any time</strong>. Cancellation can be done through:
                </p>
                <ul>
                    <li>Your account settings within the application</li>
                    <li>Contacting us via email at <strong>optilenoai@gmail.com</strong></li>
                </ul>

                <h3 style={styles.h3}>What happens when you cancel:</h3>
                <ul>
                    <li>Your access to paid features continues until the <strong>end of the current billing period</strong></li>
                    <li>No further charges will be applied after the current period ends</li>
                    <li>No partial or prorated refunds are issued for the remaining days in the billing cycle</li>
                    <li>Your account data remains intact unless you separately request account deletion</li>
                </ul>

                <div style={styles.highlight}>
                    <p>
                        <strong>💡 Tip:</strong> Users can cancel anytime to stop future billing. Your access continues until the billing period ends, so you won't lose access immediately upon cancellation.
                    </p>
                </div>
            </section>

            {/* 5. Exceptions & Disputes */}
            <section style={styles.section}>
                <h2 style={styles.h2}>5. Payment Disputes & Special Circumstances</h2>
                <p>
                    While our general policy is no refunds, we understand that exceptional circumstances may arise. If you experience any of the following, please contact us:
                </p>
                <ul>
                    <li><strong>Duplicate charges:</strong> If you were charged more than once for the same billing period in error</li>
                    <li><strong>Unauthorized transactions:</strong> If you believe your payment method was used without your authorization</li>
                    <li><strong>Technical billing errors:</strong> If there was a verifiable error in the billing process on our end</li>
                </ul>
                <p style={{ marginTop: '0.75rem' }}>
                    In such cases, please contact us at <strong>optilenoai@gmail.com</strong> with your account email, transaction details, and a description of the issue. We will review your request and respond within <strong>5-7 business days</strong>.
                </p>
                <p style={{ marginTop: '0.75rem' }}>
                    We reserve the right to approve or deny refund requests for special circumstances at our sole discretion, on a case-by-case basis.
                </p>
            </section>

            {/* 6. Chargebacks */}
            <section style={styles.section}>
                <h2 style={styles.h2}>6. Chargebacks</h2>
                <p>
                    If you initiate a chargeback or payment dispute through your bank or payment provider without first contacting us, we reserve the right to:
                </p>
                <ul>
                    <li>Immediately suspend or terminate your account</li>
                    <li>Restrict future access to the Service</li>
                    <li>Pursue recovery of the disputed amount through available legal means</li>
                </ul>
                <p style={{ marginTop: '0.75rem' }}>
                    We encourage you to contact us directly at <strong>optilenoai@gmail.com</strong> before initiating a chargeback so we can resolve the issue.
                </p>
            </section>

            {/* 7. Payment Processor */}
            <section style={styles.section}>
                <h2 style={styles.h2}>7. Payment Processing</h2>
                <p>
                    All payments are processed through secure, trusted third-party payment processors including <strong>Razorpay</strong> and <strong>Cashfree</strong>. These processors are PCI-DSS compliant and handle all payment data securely.
                </p>
                <p style={{ marginTop: '0.75rem' }}>
                    Optileno does not store, process, or have access to your credit/debit card details. Any payment-related concerns should be directed to both our support team and your payment provider.
                </p>
            </section>

            {/* 8. Changes */}
            <section style={styles.section}>
                <h2 style={styles.h2}>8. Changes to This Policy</h2>
                <p>
                    We may update this Refund Policy from time to time. Any changes will be reflected on this page with an updated "Last Updated" date. Continued use of the Service after changes constitutes acceptance of the revised policy.
                </p>
            </section>

            {/* 9. Contact */}
            <section style={styles.section}>
                <h2 style={styles.h2}>9. Contact Us</h2>
                <p>If you have any questions about this Refund Policy or need assistance with a billing issue, please contact us:</p>
                <div style={{ marginTop: '1rem', padding: '1.25rem', background: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                    <p><strong>Optileno</strong></p>
                    <p>Email: <strong>optilenoai@gmail.com</strong></p>
                    <p>Website: <strong>optileno.com</strong></p>
                    <p style={{ marginTop: '0.5rem', fontSize: '0.9rem', color: '#666' }}>
                        We aim to respond to all billing and refund inquiries within 5-7 business days.
                    </p>
                </div>
                <p style={{ marginTop: '2rem', fontSize: '0.9rem', color: '#888' }}>
                    © 2026 Optileno. All rights reserved.
                </p>
            </section>
        </div>
    );
};

export default RefundPolicy;
