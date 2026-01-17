#!/usr/bin/env python3
"""
Test authentication and permissions for logs page

This script tests:
1. Login with username/password
2. Check if the JWT token contains scopes
3. Try to access the logs page
4. Capture console logs to debug permission issues
"""

from playwright.sync_api import sync_playwright
import json
import base64

def decode_jwt(token):
    """Decode JWT token (without verification)"""
    parts = token.split('.')
    if len(parts) != 3:
        return None

    # Decode payload
    payload = parts[1]
    # Add padding if needed
    payload += '=' * (4 - len(payload) % 4)
    decoded = base64.b64decode(payload)
    return json.loads(decoded)

def main():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=False)
        context = browser.new_context()
        page = context.new_page()

        # Capture console logs
        console_messages = []
        def on_console(msg):
            console_messages.append({
                'type': msg.type,
                'text': msg.text,
                'location': f"{msg.location.get('url', '')}:{msg.location.get('lineNumber', '')}"
            })
            print(f"[Console {msg.type}] {msg.text}")

        page.on('console', on_console)

        # Capture network requests
        api_requests = []
        def on_request(request):
            if '/api/' in request.url or '/v1/' in request.url:
                print(f"[API Request] {request.method} {request.url}")

        def on_response(response):
            if '/api/' in response.url or '/v1/' in response.url:
                try:
                    body = response.json()
                    print(f"[API Response] {response.url}")
                    print(f"  Status: {response.status}")
                    print(f"  Body: {json.dumps(body, indent=2)[:500]}")

                    # Store login response
                    if '/auth/login' in response.url and response.status == 200:
                        api_requests.append({
                            'type': 'login',
                            'url': response.url,
                            'status': response.status,
                            'body': body
                        })
                    # Store logs response
                    elif '/auth/logs' in response.url:
                        api_requests.append({
                            'type': 'logs',
                            'url': response.url,
                            'status': response.status,
                            'body': body
                        })
                except:
                    print(f"[API Response] {response.url} - Status: {response.status}")

        page.on('request', on_request)
        page.on('response', on_response)

        print("=" * 80)
        print("STEP 1: Navigate to login page")
        print("=" * 80)
        page.goto('http://localhost:3000/login')
        page.wait_for_load_state('networkidle')
        page.screenshot(path='/tmp/01_login_page.png')

        print("\n" + "=" * 80)
        print("STEP 2: Fill login form")
        print("=" * 80)

        # Wait for form to be ready
        page.wait_for_selector('input[type="text"], input[type="email"], input[name="username"]', timeout=5000)

        # Try to find username/email input
        username_input = page.locator('input[type="text"], input[type="email"], input[name="username"]').first
        password_input = page.locator('input[type="password"]').first

        print("Filling in credentials...")
        username_input.fill('wudao')
        password_input.fill('test123')

        page.screenshot(path='/tmp/02_form_filled.png')

        print("\n" + "=" * 80)
        print("STEP 3: Submit login form")
        print("=" * 80)

        # Click login button
        login_button = page.locator('button[type="submit"], button:has-text("登录"), button:has-text("Login")').first
        login_button.click()

        # Wait for navigation or response
        try:
            page.wait_for_url('**/inbox', timeout=5000)
            print("Login successful! Redirected to inbox.")
        except:
            print("Did not redirect to inbox, checking current URL...")
            print(f"Current URL: {page.url}")

        page.wait_for_load_state('networkidle')
        page.screenshot(path='/tmp/03_after_login.png')

        print("\n" + "=" * 80)
        print("STEP 4: Check localStorage for auth data")
        print("=" * 80)

        # Check localStorage
        local_storage = page.evaluate('''() => {
            return {
                token: localStorage.getItem('superinbox_auth_token'),
                user: localStorage.getItem('superinbox_user')
            }
        }''')

        print(f"Token in localStorage: {local_storage['token'][:50] if local_storage['token'] else 'None'}...")
        print(f"User in localStorage: {local_storage['user']}")

        # Decode and analyze JWT
        if local_storage['token']:
            token_data = decode_jwt(local_storage['token'])
            print(f"\nJWT Token Payload:")
            print(json.dumps(token_data, indent=2))

            if 'scopes' in token_data:
                print(f"\n✅ Token contains scopes: {token_data['scopes']}")
                if 'admin:full' in token_data['scopes']:
                    print("✅ Token has 'admin:full' scope!")
                else:
                    print("❌ Token does NOT have 'admin:full' scope!")
            else:
                print("\n❌ Token does NOT contain 'scopes' field!")

        print("\n" + "=" * 80)
        print("STEP 5: Navigate to logs page")
        print("=" * 80)

        page.goto('http://localhost:3000/settings/logs')
        page.wait_for_load_state('networkidle')
        page.screenshot(path='/tmp/04_logs_page.png')

        print("\n" + "=" * 80)
        print("STEP 6: Check page content and console logs")
        print("=" * 80)

        # Check if permission denied message is shown
        page_content = page.content()
        if '权限不足' in page_content or 'Admin permission required' in page_content:
            print("❌ PERMISSION DENIED message found on page!")
            print("Looking for permission error details...")

            # Try to find the alert
            alert = page.locator('[role="alert"], .alert, [data-testid*="permission"]').first
            if alert.count() > 0:
                print(f"Alert text: {alert.text_content()}")
        else:
            print("✅ No permission denied message found")

        # Check if table is rendered
        table = page.locator('table, [role="table"]').first
        if table.count() > 0:
            print("✅ Table is rendered on the page")
        else:
            print("❌ Table NOT found on page")

        print("\n" + "=" * 80)
        print("STEP 7: Summary")
        print("=" * 80)

        print("\nConsole Logs (filtered for auth/permission):")
        for msg in console_messages:
            if any(keyword in msg['text'].lower() for keyword in ['auth', 'permission', 'scope', 'role', 'admin']):
                print(f"  - [{msg['type']}] {msg['text']}")

        print("\nAPI Requests Summary:")
        for req in api_requests:
            print(f"  - {req['type']}: {req['url']} (Status: {req['status']})")
            if req['type'] == 'login' and req['status'] == 200:
                print(f"    Response: {json.dumps(req['body'], indent=2)[:200]}")

        print("\nScreenshots saved to /tmp/:")
        print("  - 01_login_page.png")
        print("  - 02_form_filled.png")
        print("  - 03_after_login.png")
        print("  - 04_logs_page.png")

        input("\nPress Enter to close browser...")

        browser.close()

if __name__ == '__main__':
    main()
