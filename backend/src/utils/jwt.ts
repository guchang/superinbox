/**
 * JWT Token Utilities
 */

import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const JWT_EXPIRES_IN = '7d'; // Access token expires in 7 days
const REFRESH_TOKEN_EXPIRES_DAYS = 30; // Refresh token expires in 30 days

export interface TokenPayload {
  userId: string;
  username: string;
  email: string;
  role: string;
  scopes: string[];
}

/**
 * Generate an access token
 */
export function generateAccessToken(payload: TokenPayload): string {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
  });
}

/**
 * Generate a refresh token
 */
export function generateRefreshToken(payload: TokenPayload): string {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: `${REFRESH_TOKEN_EXPIRES_DAYS}d`,
  });
}

/**
 * Verify and decode a token
 */
export function verifyToken(token: string): TokenPayload | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as TokenPayload;
    return decoded;
  } catch (error) {
    return null;
  }
}

/**
 * Calculate refresh token expiration date
 */
export function getRefreshTokenExpiration(): Date {
  const expiration = new Date();
  expiration.setDate(expiration.getDate() + REFRESH_TOKEN_EXPIRES_DAYS);
  return expiration;
}
