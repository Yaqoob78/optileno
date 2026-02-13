#!/usr/bin/env python3
"""
Optileno AI Client - Test and interact with the AI assistant
"""

import asyncio
import aiohttp
import json
from typing import Dict, Any, Optional
import argparse
import sys

class OptilenoClient:
    def __init__(self, base_url: str = "http://localhost:8000"):
        self.base_url = base_url
        self.session: Optional[aiohttp.ClientSession] = None
        self.access_token: Optional[str] = None

    async def __aenter__(self):
        self.session = aiohttp.ClientSession()
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if self.session:
            await self.session.close()

    async def login(self, email: str, password: str) -> bool:
        """Login to get access token"""
        if not self.session:
            raise RuntimeError("Session not initialized")
        
        try:
            async with self.session.post(
                f"{self.base_url}/api/v1/auth/login",
                json={"username": email, "password": password}
            ) as response:
                if response.status == 200:
                    data = await response.json()
                    self.access_token = data.get("access_token")
                    return True
                else:
                    print(f"Login failed: {response.status}")
                    return False
        except Exception as e:
            print(f"Login error: {e}")
            return False

    async def send_message(self, message: str, mode: str = "CHAT") -> Dict[str, Any]:
        """Send a message to the AI"""
        if not self.session or not self.access_token:
            raise RuntimeError("Not logged in")
        
        headers = {
            "Authorization": f"Bearer {self.access_token}",
            "Content-Type": "application/json"
        }
        
        try:
            async with self.session.post(
                f"{self.base_url}/api/v1/chat/send",
                json={
                    "message": message,
                    "mode": mode,
                    "history": []
                },
                headers=headers
            ) as response:
                if response.status == 200:
                    return await response.json()
                else:
                    error_text = await response.text()
                    print(f"Error sending message: {response.status} - {error_text}")
                    return {"error": f"HTTP {response.status}: {error_text}"}
        except Exception as e:
            print(f"Error sending message: {e}")
            return {"error": str(e)}

    async def get_analytics(self) -> Dict[str, Any]:
        """Get user analytics"""
        if not self.session or not self.access_token:
            raise RuntimeError("Not logged in")
        
        headers = {
            "Authorization": f"Bearer {self.access_token}",
            "Content-Type": "application/json"
        }
        
        try:
            async with self.session.get(
                f"{self.base_url}/api/v1/analytics/comprehensive",
                headers=headers
            ) as response:
                if response.status == 200:
                    return await response.json()
                else:
                    error_text = await response.text()
                    print(f"Error getting analytics: {response.status} - {error_text}")
                    return {"error": f"HTTP {response.status}: {error_text}"}
        except Exception as e:
            print(f"Error getting analytics: {e}")
            return {"error": str(e)}

async def main():
    parser = argparse.ArgumentParser(description="Optileno AI Client")
    parser.add_argument("--email", required=True, help="User email")
    parser.add_argument("--password", required=True, help="User password")
    parser.add_argument("--server", default="http://localhost:8000", help="Server URL")
    parser.add_argument("--interactive", action="store_true", help="Interactive mode")
    parser.add_argument("--message", help="Send a single message")
    
    args = parser.parse_args()

    async with OptilenoClient(args.server) as client:
        print("Logging in...")
        if await client.login(args.email, args.password):
            print("✅ Login successful!")
            
            if args.interactive:
                print("\n💬 Interactive mode started. Type 'quit' to exit, 'analytics' to view analytics.")
                while True:
                    try:
                        user_input = input("\nYou: ").strip()
                        if user_input.lower() in ['quit', 'exit', 'q']:
                            break
                        elif user_input.lower() == 'analytics':
                            print("Fetching analytics...")
                            analytics = await client.get_analytics()
                            print(f"📊 Analytics: {json.dumps(analytics, indent=2)}")
                        elif user_input:
                            print("Sending message...")
                            response = await client.send_message(user_input)
                            print(f"🤖 Leno: {response.get('message', 'No response')}")
                            
                            # Show any actions
                            actions = response.get('actions', [])
                            if actions:
                                print(f"🔧 Actions taken: {len(actions)}")
                                for action in actions:
                                    print(f"   - {action}")
                            
                            # Show any pending confirmations
                            confirmations = response.get('pending_confirmations', [])
                            if confirmations:
                                print(f"❓ Pending confirmations: {len(confirmations)}")
                                for conf in confirmations:
                                    print(f"   - {conf.get('message', 'Confirmation needed')}")
                    except KeyboardInterrupt:
                        break
                    except EOFError:
                        break
            elif args.message:
                print(f"Sending message: {args.message}")
                response = await client.send_message(args.message)
                print(f"🤖 Leno: {response.get('message', 'No response')}")
                
                # Show any actions
                actions = response.get('actions', [])
                if actions:
                    print(f"🔧 Actions taken: {len(actions)}")
                    for action in actions:
                        print(f"   - {action}")
                
                # Show any pending confirmations
                confirmations = response.get('pending_confirmations', [])
                if confirmations:
                    print(f"❓ Pending confirmations: {len(confirmations)}")
                    for conf in confirmations:
                        print(f"   - {conf.get('message', 'Confirmation needed')}")
            else:
                print("Use --interactive to start interactive mode or --message to send a single message")
        else:
            print("❌ Login failed")
            sys.exit(1)

if __name__ == "__main__":
    asyncio.run(main())