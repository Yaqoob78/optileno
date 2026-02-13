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
            <p className="text-sm text-gray-400 mb-8">Last Updated: February 12, 2026</p>

            <div className="space-y-6 text-gray-300">
                <p>
                    Optileno (“we”, “our”, “us”) values your privacy and is committed to protecting your personal information. By using Optileno, you agree to the practices described in this Privacy Policy.
                </p>

                <section>
                    <h3 className="text-lg font-semibold text-white mb-2">1. Information We Collect</h3>
                    <div className="space-y-3">
                        <div>
                            <h4 className="font-medium text-white/90">a. Personal Information</h4>
                            <p className="text-sm">Name, email address, and profile information you voluntarily provide.</p>
                        </div>
                        <div>
                            <h4 className="font-medium text-white/90">b. Usage & Behavioral Data</h4>
                            <p className="text-sm">Feature usage, interaction logs, session duration, and productivity signals.</p>
                        </div>
                        <div>
                            <h4 className="font-medium text-white/90">c. AI Interaction Data</h4>
                            <p className="text-sm">Prompts and behavioral data provided to AI features to improve the Service.</p>
                        </div>
                        <div>
                            <h4 className="font-medium text-white/90">d. Payment Information</h4>
                            <p className="text-sm">Processed securely by third-party providers (e.g., Razorpay). We do not store card details.</p>
                        </div>
                    </div>
                </section>

                <section>
                    <h3 className="text-lg font-semibold text-white mb-2">2. Legal Basis for Processing</h3>
                    <p>We process data based on your consent, contract performance, and our legitimate interests in operating Optileno.</p>
                </section>

                <section>
                    <h3 className="text-lg font-semibold text-white mb-2">3. How We Use Information</h3>
                    <p>To provide, personalize, and improve the Service, generate AI insights, process transactions, and maintain security.</p>
                </section>

                <section>
                    <h3 className="text-lg font-semibold text-white mb-2">4. AI & Automated Processing</h3>
                    <p>Optileno uses AI models to process inputs. AI-generated outputs may be inaccurate. We do not sell your personal data to AI providers.</p>
                </section>

                <section>
                    <h3 className="text-lg font-semibold text-white mb-2">5. Cookies & Tracking</h3>
                    <p>We use cookies to store preferences and analyze usage. You can control these through your browser settings.</p>
                </section>

                <section>
                    <h3 className="text-lg font-semibold text-white mb-2">6. Data Retention</h3>
                    <p>Data is retained as long as your account is active or as required by legal obligations.</p>
                </section>

                <section>
                    <h3 className="text-lg font-semibold text-white mb-2">7. Data Security</h3>
                    <p>We use reasonable technical measures to protect your info, though no system is 100% secure.</p>
                </section>

                <section>
                    <h3 className="text-lg font-semibold text-white mb-2">8. Third-Party Services</h3>
                    <p>We share limited data with payment processors and AI infrastructure providers necessary for operation.</p>
                </section>

                <section>
                    <h3 className="text-lg font-semibold text-white mb-2">9. Children’s Privacy</h3>
                    <p>Optileno is not intended for users under 18. We do not knowingly collect data from minors.</p>
                </section>

                <section>
                    <h3 className="text-lg font-semibold text-white mb-2">10. Your Rights</h3>
                    <p>You have the right to access, correct, or delete your personal data through your account or by contacting us.</p>
                </section>

                <section>
                    <h3 className="text-lg font-semibold text-white mb-2">11. Contact Us</h3>
                    <p>For privacy-related questions: <span className="text-white font-semibold">optilenoai@gmail.com</span></p>
                    <p className="mt-8 text-sm text-gray-500">© 2026 Optileno. All rights reserved.</p>
                </section>
            </div>
        </div>
    );
}
