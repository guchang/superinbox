import { Request, Response } from 'express';
import { oauthService } from '../services/oauth.service.js';
import { sendError } from '../../utils/error-response.js';
import { v4 as uuidv4 } from 'uuid';

export const authorize = async (req: Request, res: Response) => {
  try {
    const { provider } = req.params;
    const state = uuidv4(); // In a production environment, store this in a secure httpOnly cookie to prevent CSRF

    // Set cookie for state verification (optional but recommended)
    // res.cookie('oauth_state', state, { httpOnly: true, secure: process.env.NODE_ENV === 'production', maxAge: 600000 });

    const url = oauthService.getAuthorizationUrl(provider, state);
    res.redirect(url);
  } catch (error: any) {
    sendError(res, {
      statusCode: 400,
      code: 'AUTH.OAUTH_INIT_FAILED',
      message: error.message
    });
  }
};

export const callback = async (req: Request, res: Response) => {
  try {
    const { provider } = req.params;
    const { code, state, error } = req.query;

    if (error) {
      throw new Error(`Provider returned error: ${error}`);
    }

    if (!code || typeof code !== 'string') {
      throw new Error('Missing authorization code');
    }

    // Verify state here if cookie was set
    // const storedState = req.cookies?.oauth_state;
    // if (state !== storedState) { throw new Error('Invalid state parameter'); }

    const tokens = await oauthService.exchangeCodeForToken(provider, code as string);

    // Allow opener access across origins
    res.setHeader('Cross-Origin-Opener-Policy', 'unsafe-none');

    // Return HTML that posts message to opener (the frontend window)
    const html = `
      <html>
        <head>
          <title>Authentication Successful</title>
          <style>
            body { font-family: sans-serif; text-align: center; padding-top: 50px; }
            .success { color: green; font-size: 1.2em; margin-bottom: 20px; }
            .token-box { background: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px auto; max-width: 500px; word-break: break-all; display: none; }
            .btn { background: #333; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; cursor: pointer; border: none; }
          </style>
        </head>
        <body>
          <div class="success">✅ Authentication successful!</div>
          <p id="status">Syncing with application...</p>

          <div id="manual-entry" style="display:none">
            <p>Could not verify with parent window automatically.</p>
            <p>Please copy this token manually:</p>
            <div class="token-box" style="display:block">${tokens.accessToken}</div>
            <button class="btn" onclick="copyToken()">Copy Token</button>
          </div>

          <script>
            const token = '${tokens.accessToken}';
            const refreshToken = '${tokens.refreshToken || ''}';

            function copyToken() {
              navigator.clipboard.writeText(token).then(() => alert('Copied!'));
            }

            try {
              if (window.opener) {
                window.opener.postMessage({
                  type: 'OAUTH_SUCCESS',
                  provider: '${provider}',
                  token: token,
                  refreshToken: refreshToken
                }, '*');
                document.getElementById('status').innerText = 'Closing window...';
                setTimeout(() => window.close(), 1000);
              } else {
                document.getElementById('status').style.display = 'none';
                document.getElementById('manual-entry').style.display = 'block';
              }
            } catch (e) {
              console.error('Error posting message:', e);
              document.getElementById('status').style.display = 'none';
              document.getElementById('manual-entry').style.display = 'block';
            }
          </script>
        </body>
      </html>
    `;

    res.send(html);
  } catch (error: any) {
    console.error('OAuth callback error:', error);

    // Return HTML that posts error to opener
    const errorMessage = error.message.replace(/'/g, "\\'"); // Escape single quotes for JS string
    const html = `
      <html>
        <head>
          <title>Authentication Failed</title>
          <style>
            body { font-family: sans-serif; text-align: center; padding-top: 50px; }
            .error { color: red; font-size: 1.2em; }
          </style>
        </head>
        <body>
          <div class="error">❌ Authentication failed</div>
          <p>${error.message}</p>
          <script>
            try {
              if (window.opener) {
                window.opener.postMessage({
                  type: 'OAUTH_ERROR',
                  provider: '${req.params.provider}',
                  error: '${errorMessage}'
                }, '*');
                // Keep window open so user can read error
              }
            } catch (e) {}
          </script>
        </body>
      </html>
    `;
    res.send(html);
  }
};
