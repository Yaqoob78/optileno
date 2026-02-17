import React from 'react';
import { ArrowLeft } from 'lucide-react';

interface Props {
    onBack?: () => void;
}

export default function PrivacyPolicy({ onBack }: Props) {
    return (
        <div className="legal-content animate-fade-in text-left">
            {onBack && (
                <button onClick={onBack} className="flex items-center gap-2 text-sm text-gray-400 hover:text-white mb-6">
                    <ArrowLeft size={16} /> Back
                </button>
            )}
            <h2 className="text-2xl font-bold text-white mb-6">Privacy Policy</h2>
            <p className="text-sm text-gray-400 mb-8">Last Updated: February 17, 2026</p>

            <div className="space-y-6 text-gray-300">
                <p>
                    Optileno ("we", "our", "us") is committed to protecting your privacy and personal information. By using Optileno, you agree to the practices described in this Privacy Policy.
                </p>

                <section>
                    <h3 className="text-lg font-semibold text-white mb-2">1. Information We Collect</h3>
                    <div className="space-y-3">
                        <div>
                            <h4 className="font-medium text-white/90">a. Personal Information</h4>
                            <p className="text-sm">Full name, email address, password (encrypted), and profile information you voluntarily provide.</p>
                        </div>
                        <div>
                            <h4 className="font-medium text-white/90">b. Usage & Behavioral Data</h4>
                            <p className="text-sm">Feature usage, interaction logs, session duration, tasks, goals, habits, mood tracking inputs, and productivity signals.</p>
                        </div>
                        <div>
                            <h4 className="font-medium text-white/90">c. AI Interaction Data</h4>
                            <p className="text-sm">Prompts, messages, behavioral signals, and planning data provided to AI features. Some data may be processed by third-party AI providers to generate insights.</p>
                        </div>
                        <div>
                            <h4 className="font-medium text-white/90">d. Payment Information</h4>
                            <p className="text-sm">Processed securely by third-party providers (e.g., Razorpay, Cashfree). We do not store card details.</p>
                        </div>
                        <div>
                            <h4 className="font-medium text-white/90">e. Cookies & Tracking</h4>
                            <p className="text-sm">We use cookies and similar technologies for authentication, preferences, and analytics. See our Cookies Policy for details.</p>
                        </div>
                    </div>
                </section>

                <section>
                    <h3 className="text-lg font-semibold text-white mb-2">2. Why We Collect This Information</h3>
                    <p>To provide, operate, and personalize the Service. To generate AI insights and recommendations. To process payments and billing. To improve features, performance, and security. To communicate service updates and respond to support requests.</p>
                </section>

                <section>
                    <h3 className="text-lg font-semibold text-white mb-2">3. Legal Basis for Processing</h3>
                    <p>We process data based on your consent, contract performance (providing the Service), our legitimate interests in operating Optileno, and legal compliance obligations.</p>
                </section>

                <section>
                    <h3 className="text-lg font-semibold text-white mb-2">4. AI & Automated Processing</h3>
                    <div className="bg-blue-900/20 border-l-4 border-blue-500 p-4">
                        <p className="text-sm">Optileno uses AI models (including third-party providers) to process inputs and generate outputs. AI outputs may be inaccurate. We do not sell your personal data to AI providers. Data is processed solely to deliver functionality.</p>
                    </div>
                </section>

                <section>
                    <h3 className="text-lg font-semibold text-white mb-2">5. Data Security</h3>
                    <p>We take reasonable measures to protect user data through encryption, access controls, and security monitoring. We do not sell personal information. However, no system is completely secure and we cannot guarantee absolute protection.</p>
                </section>

                <section>
                    <h3 className="text-lg font-semibold text-white mb-2">6. Data Sharing</h3>
                    <p>We share limited data with payment processors, AI infrastructure providers, and cloud hosting as necessary to operate the Service. We do not sell your data or share it for advertising purposes.</p>
                </section>

                <section>
                    <h3 className="text-lg font-semibold text-white mb-2">7. Data Retention</h3>
                    <p>Data is retained as long as your account is active or as required by legal obligations. Upon account deletion, data is removed within 30 days, except where legally required.</p>
                </section>

                <section>
                    <h3 className="text-lg font-semibold text-white mb-2">8. Children's Privacy</h3>
                    <p>Optileno is not intended for users under 18. We do not knowingly collect data from minors.</p>
                </section>

                <section>
                    <h3 className="text-lg font-semibold text-white mb-2">9. Your Rights</h3>
                    <p>You have the right to access, correct, delete, or export your personal data. You may also withdraw consent or object to processing. Contact us at <span className="text-white font-semibold">optilenoai@gmail.com</span> to exercise these rights.</p>
                </section>

                <section>
                    <h3 className="text-lg font-semibold text-white mb-2">10. Account Deletion</h3>
                    <p>You may request deletion of your account and all associated data at any time by contacting us. This action is irreversible.</p>
                </section>

                <section>
                    <h3 className="text-lg font-semibold text-white mb-2">11. Changes to This Policy</h3>
                    <p>We may update this policy periodically. Continued use constitutes acceptance. For the full Privacy Policy, visit our <a href="/privacy" target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:underline">Privacy Policy page</a>.</p>
                </section>

                <section>
                    <h3 className="text-lg font-semibold text-white mb-2">12. Contact Us</h3>
                    <p>For privacy-related questions: <span className="text-white font-semibold">optilenoai@gmail.com</span></p>
                    <p className="mt-8 text-sm text-gray-500">© 2026 Optileno. All rights reserved.</p>
                </section>
            </div>
        </div>
    );
}
