# backend/services/email_service.py
"""
Email delivery service using SendGrid
"""

import logging
from typing import List, Dict, Any, Optional
from sendgrid import SendGridAPIClient
from sendgrid.helpers.mail import Mail, Email, To, Content
import os

logger = logging.getLogger(__name__)

class EmailService:
    """Service for sending emails via SendGrid"""
    
    def __init__(self):
        self.api_key = os.getenv('SENDGRID_API_KEY', '')
        self.from_email = os.getenv('SENDGRID_FROM_EMAIL', 'noreply@concierge.ai')
        self.sg = SendGridAPIClient(self.api_key) if self.api_key else None
    
    async def send_email(
        self,
        to_email: str,
        subject: str,
        html_content: str,
        text_content: Optional[str] = None,
        cc_emails: Optional[List[str]] = None,
        bcc_emails: Optional[List[str]] = None,
    ) -> Dict[str, Any]:
        """Send email via SendGrid"""
        
        if not self.sg:
            logger.warning("SendGrid not configured")
            return {"status": "failed", "reason": "SendGrid not configured"}
        
        try:
            # Create mail object
            mail = Mail(
                from_email=Email(self.from_email),
                to_emails=To(to_email),
                subject=subject,
                plain_text_content=text_content or subject,
                html_content=html_content,
            )
            
            # Add CC if provided
            if cc_emails:
                for cc_email in cc_emails:
                    mail.add_cc(Email(cc_email))
            
            # Add BCC if provided
            if bcc_emails:
                for bcc_email in bcc_emails:
                    mail.add_bcc(Email(bcc_email))
            
            # Send
            response = self.sg.send(mail)
            
            logger.info(f"✉️ Email sent to {to_email} - Status: {response.status_code}")
            
            return {
                "status": "sent",
                "to": to_email,
                "status_code": response.status_code
            }
            
        except Exception as e:
            logger.error(f"❌ Email send failed: {e}")
            return {
                "status": "failed",
                "reason": str(e),
                "to": to_email
            }
    
    async def send_notification_email(
        self,
        user_email: str,
        user_name: str,
        notification_title: str,
        notification_message: str,
        action_url: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Send notification as email"""
        
        html_content = f"""
        <html>
            <body style="font-family: Arial, sans-serif;">
                <h2>{notification_title}</h2>
                <p>{notification_message}</p>
                {f'<a href="{action_url}" style="background-color: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">View</a>' if action_url else ''}
                <hr>
                <p style="color: #666; font-size: 12px;">
                    This is an automated notification from Optileno AI
                </p>
            </body>
        </html>
        """
        
        return await self.send_email(
            to_email=user_email,
            subject=notification_title,
            html_content=html_content,
            text_content=notification_message
        )
    
    async def send_task_shared_email(
        self,
        recipient_email: str,
        recipient_name: str,
        sender_name: str,
        task_name: str,
        task_url: str,
    ) -> Dict[str, Any]:
        """Send task sharing notification email"""
        
        html_content = f"""
        <html>
            <body style="font-family: Arial, sans-serif;">
                <h2>Task Shared with You</h2>
                <p>Hi {recipient_name},</p>
                <p><strong>{sender_name}</strong> shared a task with you:</p>
                <p style="background-color: #f5f5f5; padding: 15px; border-radius: 5px;">
                    <strong>{task_name}</strong>
                </p>
                <p>
                    <a href="{task_url}" style="background-color: #28a745; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
                        View Task
                    </a>
                </p>
                <hr>
                <p style="color: #666; font-size: 12px;">
                    You received this email because a task was shared with you on Optileno AI
                </p>
            </body>
        </html>
        """
        
        return await self.send_email(
            to_email=recipient_email,
            subject=f"Task Shared: {task_name}",
            html_content=html_content
        )


# Singleton instance
email_service = EmailService()
