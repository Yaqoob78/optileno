"""
🚀 Optileno Auto-Outreach & Lead-Generation Bot
This script searches for digital/creative agency websites, extracts their contact emails,
pre-approves them in the Optileno database/file storage, and sends them a personalized
VIP invitation via Gmail SMTP.

Setup:
1. Generate a Gmail App Password:
   - Go to: https://myaccount.google.com/security
   - Enable 2-Step Verification if not done.
   - Go to: Security -> App Passwords.
   - Create a new App Password called "Optileno Outreach".
2. Add these to your backend/.env (or set them as env vars):
   OUTREACH_GMAIL_USER=your_email@gmail.com
   OUTREACH_GMAIL_APP_PASSWORD=xxxx-xxxx-xxxx-xxxx

Usage:
   python scripts/auto_outreach_bot.py --niche "digital agency" --location "london" --limit 5
"""

import argparse
import asyncio
import os
import re
import smtplib
import ssl
from datetime import datetime, timedelta, timezone
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
import urllib.parse
from bs4 import BeautifulSoup
import httpx
from dotenv import load_dotenv

# Initialize backend config path lookup
from backend.utils.access_grants import upsert_access_grant_sync
from backend.services.entitlements_service import PLAN_ULTRA

# Load env vars
load_dotenv("backend/.env")
load_dotenv("env/.env")

GMAIL_USER = os.getenv("OUTREACH_GMAIL_USER")
GMAIL_PASS = os.getenv("OUTREACH_GMAIL_APP_PASSWORD")


async def search_agencies(niche: str, location: str, limit: int) -> list[str]:
    """Search DuckDuckGo HTML for agency websites."""
    query = f"{niche} {location} contact website"
    encoded_query = urllib.parse.quote(query)
    url = f"https://html.duckduckgo.com/html/?q={encoded_query}"
    
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }

    print(f"🔍 Searching for '{niche}' in '{location}'...")
    
    async with httpx.AsyncClient(headers=headers, timeout=10.0) as client:
        try:
            res = await client.get(url)
            if res.status_code != 200:
                print(f"❌ DuckDuckGo search failed with status {res.status_code}")
                return []
            
            soup = BeautifulSoup(res.text, "html.parser")
            links = []
            for a in soup.find_all("a", class_="result__snippet"):
                href = a.get("href", "")
                # Parse out the actual URL redirect from DuckDuckGo
                parsed = urllib.parse.urlparse(href)
                params = urllib.parse.parse_qs(parsed.query)
                actual_url = params.get("uddg", [None])[0]
                if actual_url:
                    parsed_actual = urllib.parse.urlparse(actual_url)
                    base_domain = f"{parsed_actual.scheme}://{parsed_actual.netloc}"
                    if base_domain not in links and "duckduckgo" not in base_domain:
                        links.append(base_domain)
                        if len(links) >= limit:
                            break
            return links
        except Exception as e:
            print(f"❌ Error during search: {e}")
            return []


async def find_emails_on_site(domain: str) -> list[str]:
    """Crawl a website home page and contact page to find email addresses."""
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }
    email_regex = re.compile(r"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}")
    emails = set()

    pages_to_try = [domain, f"{domain.rstrip('/')}/contact", f"{domain.rstrip('/')}/contact-us", f"{domain.rstrip('/')}/about"]
    
    async with httpx.AsyncClient(headers=headers, timeout=10.0, follow_redirects=True) as client:
        for page in pages_to_try:
            try:
                res = await client.get(page)
                if res.status_code == 200:
                    found = email_regex.findall(res.text)
                    for email in found:
                        # Filter out common false positives/images
                        email_lower = email.lower()
                        if not any(ext in email_lower for ext in [".png", ".jpg", ".gif", "sentry.io", "bootstrap", "w3.org"]):
                            emails.add(email.strip().lower())
                if len(emails) >= 2:  # Found enough emails on this site
                    break
            except Exception:
                continue

    return list(emails)


def send_gmail_invite(to_email: str, company_name: str) -> bool:
    """Send outreach invitation via Gmail SMTP."""
    if not GMAIL_USER or not GMAIL_PASS:
        print("❌ Gmail credentials missing. Skip sending email.")
        return False

    # Create message container
    msg = MIMEMultipart("alternative")
    msg["Subject"] = "Simple way to turn your goals into daily tasks?"
    msg["From"] = GMAIL_USER
    msg["To"] = to_email

    # Email text body
    text = f"""Hi there,

I saw your work online and wanted to reach out. As a creative team, keeping track of tasks and clients without getting overwhelmed is a constant battle.

I built a lean daily focus app called Optileno. It's designed specifically for solo agency owners and creators to break down high-level business goals into specific daily execution steps and focus sessions automatically with AI.

I've whitelisted your email ({to_email}) for a free 30-day VIP pass to our Premium/Ultra tier. No credit card required. You can try it out here:

https://www.optileno.com/get-access

Let me know if you find it helpful!

Best regards,
Optileno Founder
"""

    # Email HTML body
    html = f"""
    <html>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <h3 style="color: #2563eb;">Goal Execution for Creative Agencies</h3>
        <p>Hi there,</p>
        <p>As a growing creative team, turning big objectives into daily tasks without drowning in calendar clutter is a constant battle.</p>
        <p>I built a daily planner called <strong>Optileno</strong>. It's a clean focus app that helps you break down your high-level goals into daily tasks, protect your deep work time, and track focus patterns automatically with AI.</p>
        <div style="background-color: #f3f4f6; padding: 15px; border-left: 4px solid #2563eb; margin: 20px 0;">
            <strong>Your VIP Invitation:</strong><br/>
            We've whitelisted your email (<strong>{to_email}</strong>) for a free 30-day VIP pass to our Premium tier. No payment info or credit card required.
        </div>
        <p style="margin-top: 25px;">
            <a href="https://www.optileno.com/get-access" style="background-color: #2563eb; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; font-weight: bold;">Claim Your VIP Access</a>
        </p>
        <p style="margin-top: 30px;">Let me know if this helps your team stay aligned!</p>
        <p>Best regards,<br/><strong>Yaqoob</strong><br/>Founder, Optileno</p>
      </body>
    </html>
    """

    msg.attach(MIMEText(text, "plain"))
    msg.attach(MIMEText(html, "html"))

    # Connect to Google SMTP
    context = ssl.create_default_context()
    try:
        with smtplib.SMTP_SSL("smtp.gmail.com", 465, context=context) as server:
            server.login(GMAIL_USER, GMAIL_PASS)
            server.sendmail(GMAIL_USER, to_email, msg.as_string())
        print(f"✉️ Invite email successfully sent to: {to_email}")
        return True
    except Exception as e:
        print(f"❌ Failed to send email to {to_email}: {e}")
        return False


async def main():
    parser = argparse.ArgumentParser(description="Find agencies, whitelist emails, and invite them.")
    parser.add_argument("--niche", default="digital agency", help="Type of company to find")
    parser.add_argument("--location", default="london", help="City/Location of search")
    parser.add_argument("--limit", type=int, default=5, help="Number of sites to crawl")
    args = parser.parse_args()

    if not GMAIL_USER or not GMAIL_PASS:
        print("⚠️ Warning: OUTREACH_GMAIL_USER or OUTREACH_GMAIL_APP_PASSWORD not set in environment.")
        print("The bot will search and whitelist leads, but will not send the email invites.")

    domains = await search_agencies(args.niche, args.location, args.limit)
    if not domains:
        print("❌ No agency websites found.")
        return

    print(f"Found {len(domains)} target websites. Scraping for contact emails...")
    
    total_emails_sent = 0
    for domain in domains:
        print(f"\n🌐 Scanning: {domain}...")
        emails = await find_emails_on_site(domain)
        if not emails:
            print("  No emails found on website.")
            continue
        
        parsed_domain = urllib.parse.urlparse(domain)
        company_name = parsed_domain.netloc.replace("www.", "").split(".")[0].capitalize()
        
        for email in emails:
            print(f"  ✨ Found email: {email}")
            
            # 1. Whitelist the user in Optileno database
            try:
                expiry = datetime.now(timezone.utc) + timedelta(days=30)
                upsert_access_grant_sync(
                    email=email,
                    tier=PLAN_ULTRA,
                    expires_at=expiry,
                    reason=f"Auto-outreach lead: {company_name} ({domain})"
                )
                print(f"  ✅ Whitelisted {email} for 30 days of VIP access")
            except Exception as e:
                print(f"  ❌ Whitelist failed for {email}: {e}")
                continue

            # 2. Send invitation email
            if GMAIL_USER and GMAIL_PASS:
                sent = send_gmail_invite(email, company_name)
                if sent:
                    total_emails_sent += 1
                    # Pause briefly to prevent Gmail spam triggers
                    await asyncio.sleep(2.0)

    print(f"\n🎉 Finished outreach run. Total emails sent: {total_emails_sent}")


if __name__ == "__main__":
    asyncio.run(main())
