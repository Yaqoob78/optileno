# backend/api/v1/endpoints/legal.py
"""
Legal Documents API for Optileno SaaS.

Endpoints:
- GET /legal/privacy-policy - Privacy Policy
- GET /legal/terms - Terms and Conditions
- GET /legal/refund-policy - Refund Policy
- GET /legal/cookie-policy - Cookie Policy
"""

from fastapi import APIRouter
from datetime import datetime

router = APIRouter(prefix="/legal", tags=["Legal"])


# ==================================================
# Privacy Policy
# ==================================================
PRIVACY_POLICY = {
    "title": "Privacy Policy",
    "last_updated": "2026-02-12",
    "version": "3.0",
    "company": "Optileno",
    "sections": [
        {
            "heading": "1. Information We Collect",
            "content": """**a. Personal Information**
We may collect:
- Name
- Email address
- Profile information you voluntarily provide

**b. Usage & Behavioral Data**
We collect information about how you interact with the Service, including:
- Feature usage
- Interaction logs
- Session duration
- Goals, tasks, and productivity signals

**c. AI Interaction Data**
We collect inputs you provide to AI features, including:
- Prompts
- Behavioral signals
- Planning and productivity data

This data is used only to deliver, personalize, and improve the Service.

**d. Payment Information**
Payments are processed by third-party payment providers such as Razorpay. We do not store or process credit/debit card details on our servers."""
        },
        {
            "heading": "2. Legal Basis for Processing",
            "content": """We process your data based on:
- Your consent
- The performance of a contract (providing the Service)
- Our legitimate interests in improving, securing, and operating Optileno"""
        },
        {
            "heading": "3. How We Use Your Information",
            "content": """We use collected information to:
- Provide and operate the Service
- Personalize user experience
- Generate AI-powered insights and behavioral analytics
- Improve features, performance, and reliability
- Process subscriptions and transactions
- Respond to support requests
- Maintain security and prevent misuse"""
        },
        {
            "heading": "4. AI & Automated Processing Disclosure",
            "content": """Optileno uses artificial intelligence models (including third-party providers such as large language models) to process user inputs and generate outputs.

You acknowledge that:
- AI processing may involve automated analysis
- AI-generated outputs may be inaccurate or incomplete
- AI providers may process limited data solely to deliver functionality

We do not sell your personal data to AI providers."""
        },
        {
            "heading": "5. Cookies & Tracking",
            "content": """We use cookies and similar technologies to:
- Store preferences
- Improve user experience
- Analyze usage patterns

You can control cookies through your browser settings."""
        },
        {
            "heading": "6. Data Retention",
            "content": """We retain personal data:
- For as long as your account remains active
- As necessary to provide the Service
- As required by legal or regulatory obligations

Upon account deletion, we will delete or anonymize personal data within a reasonable timeframe, except where retention is legally required."""
        },
        {
            "heading": "7. Data Security",
            "content": """We use reasonable administrative, technical, and organizational measures (such as encryption and access controls) to protect your information.

However, no system is completely secure, and we cannot guarantee absolute security of your data."""
        },
        {
            "heading": "8. Third-Party Services",
            "content": """We may share limited data with trusted third parties, including:
- Payment processors (e.g., Razorpay)
- AI infrastructure providers
- Analytics and monitoring tools

We are not responsible for the privacy practices of third-party services. Their use is governed by their respective privacy policies."""
        },
        {
            "heading": "9. International Users & Data Transfers",
            "content": """Your information may be processed or stored in servers located outside your country of residence. By using Optileno, you consent to such data transfers in accordance with this Privacy Policy."""
        },
        {
            "heading": "10. Children’s Privacy",
            "content": """Optileno is not intended for users under 18 years of age. We do not knowingly collect personal data from minors. If such data is discovered, it will be deleted promptly."""
        },
        {
            "heading": "11. Your Rights",
            "content": """You have the right to:
- Access your personal data
- Correct inaccurate data
- Delete your data
- Withdraw consent (where applicable)

You can manage most options through your account or by contacting us."""
        },
        {
            "heading": "12. Changes to This Policy",
            "content": """We may update this Privacy Policy from time to time. Changes will be posted on this page with an updated “Last Updated” date. Continued use of the Service after changes constitutes acceptance of the revised policy."""
        },
        {
            "heading": "13. Contact Us",
            "content": """For privacy-related questions or requests, contact: optilenoai@gmail.com

© 2026 Optileno. All rights reserved."""
        }
    ]
}


# ==================================================
# Terms and Conditions
# ==================================================
TERMS_CONDITIONS = {
    "title": "Terms of Service",
    "last_updated": "2026-02-12",
    "version": "3.0",
    "company": "Optileno",
    "sections": [
        {
            "heading": "1. Acceptance of Terms",
            "content": """By accessing or using Optileno (“the Service”, “we”, “us”, “our”), you agree to be bound by these Terms of Service (“Terms”). If you do not agree to these Terms, you must not access or use the Service.

By using the Service, you confirm that you are legally capable of entering into a binding agreement under applicable law."""
        },
        {
            "heading": "2. Eligibility",
            "content": """You must be at least 18 years old to use Optileno. By using the Service, you represent and warrant that you meet this requirement."""
        },
        {
            "heading": "3. License to Use the Service",
            "content": """We grant you a limited, non-exclusive, non-transferable, revocable license to access and use the Service strictly in accordance with these Terms.

You agree not to:
- Use the Service for any illegal, harmful, or unauthorized purpose
- Copy, resell, sublicense, or exploit the Service or its outputs commercially without permission
- Reverse engineer, scrape, or attempt to extract source code, models, or system logic
- Use the Service to build or compete with a similar AI or automation product

We reserve the right to revoke access at any time."""
        },
        {
            "heading": "4. User Accounts & Security",
            "content": """You are responsible for maintaining the confidentiality of your account credentials and for all activity that occurs under your account.

You agree:
- Not to share accounts
- Not to impersonate others
- Not to misuse the Service

Any misuse may result in immediate termination without notice."""
        },
        {
            "heading": "5. AI Services Disclaimer (IMPORTANT)",
            "content": """Optileno provides AI-powered productivity insights, planning suggestions, behavioral analysis, and automation assistance.

You expressly acknowledge and agree that:
- AI-generated outputs may be inaccurate, incomplete, misleading, or incorrect
- The Service does not provide professional, financial, medical, psychological, legal, or business advice
- You are solely responsible for how you interpret and use any output
- Decisions made based on AI outputs are made entirely at your own risk

Optileno makes no guarantees regarding accuracy, reliability, availability, or results."""
        },
        {
            "heading": "6. Data Usage",
            "content": """By using the Service, you consent to the processing of your interaction data for:
- Providing core functionality
- Improving relevance and personalization
- System optimization and security

We implement reasonable industry-standard security measures, but no system is 100% secure, and we do not guarantee absolute protection.

Details are explained further in our Privacy Policy."""
        },
        {
            "heading": "7. Free Trial, Subscriptions & Payments",
            "content": """Optileno offers a 7-day free trial on the Explorer plan only.

After the free trial ends:
- Your subscription will begin automatically unless canceled
- You will be charged according to the selected plan

**⚠️ No Refund Policy**
All payments are final and non-refundable, including:
- Partial usage
- Dissatisfaction
- Forgetting to cancel
- Feature changes
- AI output issues

No refunds will be issued once a paid subscription begins.

Payments are processed securely through third-party payment providers (e.g., Razorpay). We do not control or store payment details."""
        },
        {
            "heading": "8. Service Availability & Changes",
            "content": """We may:
- Modify or discontinue features
- Update pricing
- Suspend or terminate the Service
- Perform maintenance or upgrades

All services are provided “AS IS” and “AS AVAILABLE”, without warranties of any kind."""
        },
        {
            "heading": "9. Termination",
            "content": """We may suspend or terminate your account at any time, with or without notice, for any reason, including violation of these Terms.

Upon termination:
- Access to the Service will cease immediately
- No refunds will be provided
- Data may be deleted permanently."""
        },
        {
            "heading": "10. Intellectual Property",
            "content": """All content, software, AI systems, branding, and features belong exclusively to Optileno or its licensors.

You do not acquire ownership rights by using the Service."""
        },
        {
            "heading": "11. Limitation of Liability",
            "content": """To the maximum extent permitted by law:
- Optileno shall not be liable for any indirect, incidental, special, consequential, or punitive damages, including but not limited to loss of data, profits, productivity, business, or reputation.
- Our total liability, if any, shall not exceed the amount paid by you in the last 3 months, or ₹1,000 INR, whichever is lower."""
        },
        {
            "heading": "12. Indemnification",
            "content": """You agree to indemnify and hold harmless Optileno from any claims, damages, losses, or legal actions arising from:
- Your misuse of the Service
- Violation of these Terms
- Reliance on AI-generated outputs"""
        },
        {
            "heading": "13. Governing Law & Jurisdiction",
            "content": """These Terms shall be governed by the laws of India. Any disputes shall be subject to the exclusive jurisdiction of courts located in India."""
        },
        {
            "heading": "14. Changes to Terms",
            "content": """We may update these Terms at any time. Continued use of the Service after changes constitutes acceptance of the revised Terms."""
        },
        {
            "heading": "15. Contact",
            "content": """For questions regarding these Terms, contact us at: optilenoai@gmail.com

© 2026 Optileno. All rights reserved."""
        }
    ]
}


# ==================================================
# Refund Policy
# ==================================================
REFUND_POLICY = {
    "title": "Refund Policy",
    "last_updated": "2026-02-12",
    "version": "3.0",
    "company": "Optileno",
    "sections": [
        {
            "heading": "1. Overview",
            "content": """This Refund Policy outlines our policy regarding payment cancellations and refunds. As stated in our Terms of Service, Optileno follows a strict No Refund Policy."""
        },
        {
            "heading": "2. No Refund Policy",
            "content": """All payments are final and non-refundable. We do not offer refunds or credits for:
- Partial usage of the Service
- Dissatisfaction with AI outputs or features
- Forgetting to cancel a subscription before renewal
- Feature modifications or service changes

Once a paid subscription begins, no refunds will be issued under any circumstances."""
        },
        {
            "heading": "3. Free Trial",
            "content": """The Explorer plan includes a 7-day free trial. You can cancel at any time during the trial period to avoid being charged. Once the trial ends and the first payment is processed, the No Refund Policy applies."""
        },
        {
            "heading": "4. Cancellations",
            "content": """You may cancel your subscription at any time. Upon cancellation, you will continue to have access to the paid features until the end of your current billing period. No partial refunds will be provided for the remaining time in the billing cycle."""
        },
        {
            "heading": "5. Contact",
            "content": """If you have questions about your billing or need help with cancellation, please contact us at optilenoai@gmail.com."""
        }
    ]
}


# ==================================================
# Cookie Policy
# ==================================================
COOKIE_POLICY = {
    "title": "Cookie Policy",
    "last_updated": "2026-02-08",
    "version": "2.0",
    "company": "Optileno",
    "sections": [
        {
            "heading": "1. What Are Cookies",
            "content": """Cookies are small text files stored on your device when you visit a website. They help websites remember your preferences and improve your experience."""
        },
        {
            "heading": "2. How We Use Cookies",
            "content": """We use cookies for:

**Essential Cookies:**
- Authentication and login sessions
- Security features
- Remembering your preferences

**Analytics Cookies:**
- Understanding how you use our service
- Improving our features
- Measuring performance

**Functional Cookies:**
- Remembering your settings
- Personalizing your experience"""
        },
        {
            "heading": "3. Managing Cookies",
            "content": """You can control cookies through your browser settings. Note that disabling cookies may affect the functionality of Optileno.

Most browsers allow you to:
- See what cookies are stored
- Delete individual or all cookies
- Block cookies from specific or all sites
- Block third-party cookies"""
        },
        {
            "heading": "4. Updates to This Policy",
            "content": """We may update this Cookie Policy from time to time. Changes will be posted on this page with an updated revision date."""
        }
    ]
}


# ==================================================
# API Routes
# ==================================================
@router.get("/privacy-policy")
async def get_privacy_policy():
    """Get the Privacy Policy."""
    return PRIVACY_POLICY


@router.get("/terms")
async def get_terms_conditions():
    """Get the Terms and Conditions."""
    return TERMS_CONDITIONS


@router.get("/refund-policy")
async def get_refund_policy():
    """Get the Refund Policy."""
    return REFUND_POLICY


@router.get("/cookie-policy")
async def get_cookie_policy():
    """Get the Cookie Policy."""
    return COOKIE_POLICY


@router.get("/all")
async def get_all_legal_documents():
    """Get all legal documents."""
    return {
        "privacy_policy": PRIVACY_POLICY,
        "terms_conditions": TERMS_CONDITIONS,
        "refund_policy": REFUND_POLICY,
        "cookie_policy": COOKIE_POLICY,
    }
