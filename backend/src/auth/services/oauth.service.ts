import axios from 'axios';

interface OAuthConfig {
  clientId: string;
  clientSecret: string;
  authUrl: string;
  tokenUrl: string;
  scope: string;
}

interface OAuthTokenResponse {
  accessToken: string;
  refreshToken?: string;
  expiresIn?: number;
  tokenType?: string;
}

export class OAuthService {
  private configs: Record<string, OAuthConfig>;
  private redirectUriBase: string;

  constructor() {
    // Determine base URL (default to localhost:3000 if not set)
    // IMPORTANT: This must match what is registered in the provider's developer console
    this.redirectUriBase = process.env.APP_URL || 'http://localhost:3000';

    this.configs = {
      todoist: {
        clientId: process.env.TODOIST_CLIENT_ID || '',
        clientSecret: process.env.TODOIST_CLIENT_SECRET || '',
        authUrl: 'https://todoist.com/oauth/authorize',
        tokenUrl: 'https://todoist.com/oauth/access_token',
        scope: 'data:read_write,data:delete',
      },
      notion: {
        clientId: process.env.NOTION_CLIENT_ID || '',
        clientSecret: process.env.NOTION_CLIENT_SECRET || '',
        authUrl: 'https://api.notion.com/v1/oauth/authorize',
        tokenUrl: 'https://api.notion.com/v1/oauth/token',
        scope: '', // Notion scopes are configured in the integration settings UI
      }
    };
  }

  public getAuthorizationUrl(provider: string, state: string): string {
    const config = this.configs[provider];
    if (!config) {
      throw new Error(`Unsupported OAuth provider: ${provider}`);
    }

    if (!config.clientId) {
      throw new Error(`Missing Client ID for ${provider}. Please check your environment variables.`);
    }

    const redirectUri = `${this.redirectUriBase}/v1/auth/oauth/${provider}/callback`;
    const params = new URLSearchParams({
      client_id: config.clientId,
      state: state,
      response_type: 'code',
      redirect_uri: redirectUri,
    });

    if (config.scope) {
      params.append('scope', config.scope);
    }

    return `${config.authUrl}?${params.toString()}`;
  }

  public async exchangeCodeForToken(provider: string, code: string): Promise<OAuthTokenResponse> {
    const config = this.configs[provider];
    if (!config) {
      throw new Error(`Unsupported OAuth provider: ${provider}`);
    }

    const redirectUri = `${this.redirectUriBase}/v1/auth/oauth/${provider}/callback`;

    try {
      // Different providers might have slightly different requirements
      if (provider === 'notion') {
        // Notion requires Basic Auth with Client ID/Secret
        const auth = Buffer.from(`${config.clientId}:${config.clientSecret}`).toString('base64');
        const response = await axios.post(config.tokenUrl, {
          grant_type: 'authorization_code',
          code: code,
          redirect_uri: redirectUri,
        }, {
          headers: {
            'Authorization': `Basic ${auth}`,
            'Content-Type': 'application/json',
          },
        });

        return {
          accessToken: response.data.access_token,
          // Notion puts workspace info in response, might be useful later
        };
      } else {
        // Todoist and others usually accept client_id/secret in body
        const response = await axios.post(config.tokenUrl, {
          client_id: config.clientId,
          client_secret: config.clientSecret,
          code: code,
          redirect_uri: redirectUri,
        });

        return {
          accessToken: response.data.access_token,
          refreshToken: response.data.refresh_token,
        };
      }
    } catch (error: any) {
      console.error(`OAuth token exchange failed for ${provider}:`, error.response?.data || error.message);
      throw new Error(`Failed to exchange code for token: ${error.response?.data?.error || error.message}`);
    }
  }
}

export const oauthService = new OAuthService();
