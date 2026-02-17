import React from 'react';
import { ArrowLeft } from 'lucide-react';

interface Props {
    onBack?: () => void;
}

export default function TermsAndConditions({ onBack }: Props) {
    return (
        <div className="legal-content animate-fade-in text-left">
            {onBack && (
                <button onClick={onBack} className="flex items-center gap-2 text-sm text-gray-400 hover:text-white mb-6">
                    <ArrowLeft size={16} /> Back
                </button>
            )}
            <h2 className="text-2xl font-bold text-white mb-6">Terms & Conditions</h2>
            <p className="text-sm text-gray-400 mb-8">Last Updated: February 17, 2026</p>

            <div className="space-y-6 text-gray-300">
                <section>
                    <h3 className="text-lg font-semibold text-white mb-2">1. Service Description</h3>
                    <p>Optileno provides AI-powered productivity tools, analytics, planning features, goal tracking, mood monitoring, and personal growth assistance to help users track goals and improve performance. This is a subscription-based digital service (SaaS) delivered entirely online.</p>
                </section>

                <section>
                    <h3 className="text-lg font-semibold text-white mb-2">2. Acceptance of Terms</h3>
                    <p>By accessing or using Optileno ("the Service", "we", "us", "our"), you agree to be bound by these Terms & Conditions. If you do not agree, you must not access or use the Service.</p>
                    <p className="mt-2">By using the Service, you confirm that you are at least 18 years old and legally capable of entering into a binding agreement.</p>
                </section>

                <section>
                    <h3 className="text-lg font-semibold text-white mb-2">3. Subscription Model</h3>
                    <p>This is a subscription-based digital service billed monthly or yearly. We offer Explorer (entry-level) and Ultra (premium) plans with different feature sets and pricing.</p>
                </section>

                <section>
                    <h3 className="text-lg font-semibold text-white mb-2">4. Free Trial</h3>
                    <p>The Explorer plan includes a 3-day free trial. After the trial ends, billing begins automatically unless cancelled before the trial period expires. Only one free trial is available per user.</p>
                </section>

                <section>
                    <h3 className="text-lg font-semibold text-white mb-2">5. Account Security</h3>
                    <p>You are responsible for maintaining the confidentiality of your account credentials and for all activity under your account. You agree not to share, transfer, or sell your account, and not to impersonate any person or create multiple accounts.</p>
                </section>

                <section>
                    <h3 className="text-lg font-semibold text-white mb-2">6. Acceptable Use</h3>
                    <p>You agree not to:</p>
                    <ul className="list-disc pl-5 mt-2 space-y-1">
                        <li>Use the Service for any illegal, harmful, or unauthorized purpose</li>
                        <li>Copy, resell, sublicense, or exploit the Service commercially</li>
                        <li>Reverse engineer, scrape, or extract source code or AI models</li>
                        <li>Use the Service to build or compete with a similar product</li>
                        <li>Attempt unauthorized access to the Service or other accounts</li>
                        <li>Upload viruses or interfere with the Service</li>
                    </ul>
                </section>

                <section>
                    <h3 className="text-lg font-semibold text-white mb-2">7. AI Services Disclaimer</h3>
                    <p>Optileno provides AI-powered productivity insights, planning suggestions, and behavioral analysis. You acknowledge that:</p>
                    <ul className="list-disc pl-5 mt-2 space-y-1">
                        <li>AI outputs may be inaccurate, incomplete, or incorrect</li>
                        <li>The Service does not provide professional, medical, financial, or legal advice</li>
                        <li>You are solely responsible for how you use AI outputs</li>
                        <li>Decisions based on AI outputs are at your own risk</li>
                        <li>Some data may be processed by third-party AI providers</li>
                    </ul>
                </section>

                <section>
                    <h3 className="text-lg font-semibold text-white mb-2">8. Payments</h3>
                    <p>Payments are processed securely through third-party processors (e.g., Razorpay, Cashfree). We do not store or process your payment card details.</p>
                </section>

                <section>
                    <h3 className="text-lg font-semibold text-white mb-2">9. Cancellation & Refund Policy</h3>
                    <p>You can cancel anytime. Access continues until the billing period ends.</p>
                    <div className="bg-red-900/20 border-l-4 border-red-500 p-4 mt-4">
                        <h4 className="text-red-400 font-bold mb-2">Refund Terms</h4>
                        <p className="text-sm">Due to the digital nature of the product, all payments are final and non-refundable once a subscription period has started. This includes partial usage, dissatisfaction, forgetting to cancel, feature changes, or AI output issues.</p>
                    </div>
                </section>

                <section>
                    <h3 className="text-lg font-semibold text-white mb-2">10. Service Availability</h3>
                    <p>We strive for continuous availability but do not guarantee uninterrupted, error-free service. We may modify features, update pricing, or perform maintenance. All services are provided "AS IS" and "AS AVAILABLE".</p>
                </section>

                <section>
                    <h3 className="text-lg font-semibold text-white mb-2">11. Intellectual Property</h3>
                    <p>All content, software, AI systems, branding, and features belong exclusively to Optileno. You do not acquire ownership rights by using the Service. User-generated content remains your property.</p>
                </section>

                <section>
                    <h3 className="text-lg font-semibold text-white mb-2">12. Limitation of Liability</h3>
                    <p>To the maximum extent permitted by law, Optileno shall not be liable for any indirect, incidental, special, consequential, or punitive damages. Our total liability shall not exceed the amount paid by you in the last 3 months, or ₹1,000 INR, whichever is lower.</p>
                </section>

                <section>
                    <h3 className="text-lg font-semibold text-white mb-2">13. Indemnification</h3>
                    <p>You agree to indemnify Optileno from any claims arising from your misuse of the Service, violation of these Terms, or reliance on AI-generated outputs.</p>
                </section>

                <section>
                    <h3 className="text-lg font-semibold text-white mb-2">14. Termination</h3>
                    <p>We may suspend or terminate your account at any time for violation of these Terms. Upon termination, access ceases immediately, no refunds are provided, and data may be deleted. You may request account deletion at any time.</p>
                </section>

                <section>
                    <h3 className="text-lg font-semibold text-white mb-2">15. Governing Law</h3>
                    <p>These Terms are governed by the laws of India. Disputes shall be subject to the exclusive jurisdiction of courts in India.</p>
                </section>

                <section>
                    <h3 className="text-lg font-semibold text-white mb-2">16. Changes to Terms</h3>
                    <p>We may update these Terms at any time. Continued use constitutes acceptance. For full Terms, visit our <a href="/terms" target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:underline">Terms & Conditions page</a>.</p>
                </section>

                <section>
                    <h3 className="text-lg font-semibold text-white mb-2">17. Contact</h3>
                    <p>For questions: <span className="text-white font-semibold">optilenoai@gmail.com</span></p>
                    <p className="mt-8 text-sm text-gray-500">© 2026 Optileno. All rights reserved.</p>
                </section>
            </div>
        </div>
    );
}
