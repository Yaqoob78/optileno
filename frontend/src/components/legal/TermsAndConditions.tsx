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
            <h2 className="text-2xl font-bold text-white mb-6">Terms of Service</h2>
            <p className="text-sm text-gray-400 mb-8">Last Updated: February 12, 2026</p>

            <div className="space-y-6 text-gray-300">
                <section>
                    <h3 className="text-lg font-semibold text-white mb-2">1. Acceptance of Terms</h3>
                    <p>By accessing or using Optileno (“the Service”, “we”, “us”, “our”), you agree to be bound by these Terms of Service (“Terms”). If you do not agree to these Terms, you must not access or use the Service.</p>
                    <p className="mt-2">By using the Service, you confirm that you are legally capable of entering into a binding agreement under applicable law.</p>
                </section>

                <section>
                    <h3 className="text-lg font-semibold text-white mb-2">2. Eligibility</h3>
                    <p>You must be at least 18 years old to use Optileno. By using the Service, you represent and warrant that you meet this requirement.</p>
                </section>

                <section>
                    <h3 className="text-lg font-semibold text-white mb-2">3. License to Use the Service</h3>
                    <p>We grant you a limited, non-exclusive, non-transferable, revocable license to access and use the Service strictly in accordance with these Terms.</p>
                    <p className="mt-2">You agree not to:</p>
                    <ul className="list-disc pl-5 mt-2 space-y-1">
                        <li>Use the Service for any illegal, harmful, or unauthorized purpose</li>
                        <li>Copy, resell, sublicense, or exploit the Service or its outputs commercially without permission</li>
                        <li>Reverse engineer, scrape, or attempt to extract source code, models, or system logic</li>
                        <li>Use the Service to build or compete with a similar AI or automation product</li>
                    </ul>
                    <p className="mt-2">We reserve the right to revoke access at any time.</p>
                </section>

                <section>
                    <h3 className="text-lg font-semibold text-white mb-2">4. User Accounts & Security</h3>
                    <p>You are responsible for maintaining the confidentiality of your account credentials and for all activity that occurs under your account.</p>
                    <p className="mt-2">You agree:</p>
                    <ul className="list-disc pl-5 mt-2 space-y-1">
                        <li>Not to share accounts</li>
                        <li>Not to impersonate others</li>
                        <li>Not to misuse the Service</li>
                    </ul>
                    <p className="mt-2">Any misuse may result in immediate termination without notice.</p>
                </section>

                <section>
                    <h3 className="text-lg font-semibold text-white mb-2">5. AI Services Disclaimer (IMPORTANT)</h3>
                    <p>Optileno provides AI-powered productivity insights, planning suggestions, behavioral analysis, and automation assistance.</p>
                    <p className="mt-2">You expressly acknowledge and agree that:</p>
                    <ul className="list-disc pl-5 mt-2 space-y-1">
                        <li>AI-generated outputs may be inaccurate, incomplete, misleading, or incorrect</li>
                        <li>The Service does not provide professional, financial, medical, psychological, legal, or business advice</li>
                        <li>You are solely responsible for how you interpret and use any output</li>
                        <li>Decisions made based on AI outputs are made entirely at your own risk</li>
                    </ul>
                    <p className="mt-2">Optileno makes no guarantees regarding accuracy, reliability, availability, or results.</p>
                </section>

                <section>
                    <h3 className="text-lg font-semibold text-white mb-2">6. Data Usage</h3>
                    <p>By using the Service, you consent to the processing of your interaction data for:</p>
                    <ul className="list-disc pl-5 mt-2 space-y-1">
                        <li>Providing core functionality</li>
                        <li>Improving relevance and personalization</li>
                        <li>System optimization and security</li>
                    </ul>
                    <p className="mt-2">We implement reasonable industry-standard security measures, but no system is 100% secure, and we do not guarantee absolute protection.</p>
                    <p className="mt-2">Details are explained further in our Privacy Policy.</p>
                </section>

                <section>
                    <h3 className="text-lg font-semibold text-white mb-2">7. Free Trial, Subscriptions & Payments</h3>
                    <p>Optileno offers a 7-day free trial on the Explorer plan only.</p>
                    <p className="mt-2">After the free trial ends, your subscription will begin automatically unless canceled and you will be charged according to the selected plan.</p>
                    <div className="bg-red-900/20 border-l-4 border-red-500 p-4 mt-4">
                        <h4 className="text-red-400 font-bold mb-2">⚠️ No Refund Policy</h4>
                        <p className="text-sm">All payments are final and non-refundable, including partial usage, dissatisfaction, forgetting to cancel, feature changes, or AI output issues. No refunds will be issued once a paid subscription begins.</p>
                    </div>
                    <p className="mt-4">Payments are processed securely through third-party payment providers (e.g., Razorpay). We do not control or store payment details.</p>
                </section>

                <section>
                    <h3 className="text-lg font-semibold text-white mb-2">8. Service Availability & Changes</h3>
                    <p>We may modify or discontinue features, update pricing, suspend or terminate the Service, or perform maintenance. All services are provided “AS IS” and “AS AVAILABLE”.</p>
                </section>

                <section>
                    <h3 className="text-lg font-semibold text-white mb-2">9. Termination</h3>
                    <p>We may suspend or terminate your account at any time, with or without notice, for any reason. Upon termination, access ceases immediately, no refunds are provided, and data may be deleted permanently.</p>
                </section>

                <section>
                    <h3 className="text-lg font-semibold text-white mb-2">10. Intellectual Property</h3>
                    <p>All content, software, AI systems, branding, and features belong exclusively to Optileno or its licensors. You do not acquire ownership rights by using the Service.</p>
                </section>

                <section>
                    <h3 className="text-lg font-semibold text-white mb-2">11. Limitation of Liability</h3>
                    <p>To the maximum extent permitted by law, Optileno shall not be liable for any indirect, incidental, special, consequential, or punitive damages. Our total liability shall not exceed the amount paid by you in the last 3 months, or ₹1,000 INR, whichever is lower.</p>
                </section>

                <section>
                    <h3 className="text-lg font-semibold text-white mb-2">12. Indemnification</h3>
                    <p>You agree to indemnify Optileno from any claims arising from your misuse of the Service, violation of these Terms, or reliance on AI-generated outputs.</p>
                </section>

                <section>
                    <h3 className="text-lg font-semibold text-white mb-2">13. Governing Law & Jurisdiction</h3>
                    <p>These Terms shall be governed by the laws of India. Any disputes shall be subject to the exclusive jurisdiction of courts located in India.</p>
                </section>

                <section>
                    <h3 className="text-lg font-semibold text-white mb-2">14. Changes to Terms</h3>
                    <p>We may update these Terms at any time. Continued use of the Service after changes constitutes acceptance of the revised Terms.</p>
                </section>

                <section>
                    <h3 className="text-lg font-semibold text-white mb-2">15. Contact</h3>
                    <p>For questions regarding these Terms, contact us at: <span className="text-white font-semibold">optilenoai@gmail.com</span></p>
                    <p className="mt-8 text-sm text-gray-500">© 2026 Optileno. All rights reserved.</p>
                </section>
            </div>
        </div>
    );
}
