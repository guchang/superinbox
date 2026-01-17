/**
 * Authentication Service
 */

import { v4 as uuidv4 } from 'uuid';
import { getDatabase } from '../storage/database.js';
import { hashPassword, comparePassword } from '../utils/password.js';
import {
  generateAccessToken,
  generateRefreshToken,
  verifyToken,
  getRefreshTokenExpiration,
  type TokenPayload,
} from '../utils/jwt.js';

export interface LoginCredentials {
  username: string;
  password: string;
}

export interface RegisterData {
  username: string;
  email: string;
  password: string;
}

export interface AuthResponse {
  user: {
    id: string;
    username: string;
    email: string;
    role: string;
    createdAt: Date;
    lastLoginAt?: Date;
  };
  token: string;
  refreshToken: string;
}

/**
 * Register a new user
 */
export async function register(data: RegisterData): Promise<AuthResponse> {
  const db = getDatabase();

  // Check if username already exists
  const existingByUsername = db.getUserByUsername(data.username);
  if (existingByUsername) {
    throw new Error('用户名已存在');
  }

  // Check if email already exists
  const existingByEmail = db.getUserByEmail(data.email);
  if (existingByEmail) {
    throw new Error('邮箱已被使用');
  }

  // Hash password
  const passwordHash = await hashPassword(data.password);

  // Check if this is the first user (make them admin)
  const allUsers = db.getAllUsers();
  const isFirstUser = !allUsers || allUsers.length === 0;
  const userRole = isFirstUser ? 'admin' : 'user';

  // Create user
  const userId = uuidv4();
  const user = db.createUser({
    id: userId,
    username: data.username,
    email: data.email,
    passwordHash,
    role: userRole,
  });

  // Generate tokens
  const tokenPayload: TokenPayload = {
    userId: user.id,
    username: user.username,
    email: user.email,
    role: user.role,
  };

  const token = generateAccessToken(tokenPayload);
  const refreshToken = generateRefreshToken(tokenPayload);

  // Store refresh token in database
  db.createRefreshToken({
    id: uuidv4(),
    userId: user.id,
    token: refreshToken,
    expiresAt: getRefreshTokenExpiration(),
  });

  return {
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt,
    },
    token,
    refreshToken,
  };
}

/**
 * Login user
 */
export async function login(credentials: LoginCredentials): Promise<AuthResponse> {
  const db = getDatabase();

  // Find user by username
  const user = db.getUserByUsername(credentials.username);
  if (!user) {
    throw new Error('用户名或密码错误');
  }

  // Verify password
  const isPasswordValid = await comparePassword(
    credentials.password,
    user.passwordHash
  );

  if (!isPasswordValid) {
    throw new Error('用户名或密码错误');
  }

  // Update last login time
  db.updateUserLastLogin(user.id);

  // Generate tokens
  const tokenPayload: TokenPayload = {
    userId: user.id,
    username: user.username,
    email: user.email,
    role: user.role,
  };

  const token = generateAccessToken(tokenPayload);
  const refreshToken = generateRefreshToken(tokenPayload);

  // Store refresh token in database (delete old ones first)
  db.deleteUserRefreshTokens(user.id);
  db.createRefreshToken({
    id: uuidv4(),
    userId: user.id,
    token: refreshToken,
    expiresAt: getRefreshTokenExpiration(),
  });

  // Get updated user info
  const updatedUser = db.getUserById(user.id);

  return {
    user: {
      id: updatedUser.id,
      username: updatedUser.username,
      email: updatedUser.email,
      role: updatedUser.role,
      createdAt: updatedUser.createdAt,
      lastLoginAt: updatedUser.lastLoginAt,
    },
    token,
    refreshToken,
  };
}

/**
 * Refresh access token using refresh token
 */
export async function refreshToken(refreshTokenValue: string): Promise<AuthResponse> {
  const db = getDatabase();

  // Verify refresh token
  const tokenPayload = verifyToken(refreshTokenValue);
  if (!tokenPayload) {
    throw new Error('无效的刷新令牌');
  }

  // Check if refresh token exists in database
  const storedToken = db.getRefreshToken(refreshTokenValue);
  if (!storedToken) {
    throw new Error('刷新令牌不存在');
  }

  // Check if refresh token is expired
  if (storedToken.expiresAt < new Date()) {
    db.deleteRefreshToken(refreshTokenValue);
    throw new Error('刷新令牌已过期');
  }

  // Get user
  const user = db.getUserById(tokenPayload.userId);
  if (!user) {
    throw new Error('用户不存在');
  }

  // Generate new tokens
  const newTokenPayload: TokenPayload = {
    userId: user.id,
    username: user.username,
    email: user.email,
    role: user.role,
  };

  const token = generateAccessToken(newTokenPayload);
  const newRefreshToken = generateRefreshToken(newTokenPayload);

  // Delete old refresh token and create new one
  db.deleteRefreshToken(refreshTokenValue);
  db.createRefreshToken({
    id: uuidv4(),
    userId: user.id,
    token: newRefreshToken,
    expiresAt: getRefreshTokenExpiration(),
  });

  return {
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt,
      lastLoginAt: user.lastLoginAt,
    },
    token,
    refreshToken: newRefreshToken,
  };
}

/**
 * Logout user (delete refresh token)
 */
export async function logout(refreshTokenValue: string): Promise<void> {
  const db = getDatabase();
  db.deleteRefreshToken(refreshTokenValue);
}

/**
 * Get user by ID
 */
export async function getMe(userId: string): Promise<{
  id: string;
  username: string;
  email: string;
  role: string;
  createdAt: Date;
  lastLoginAt?: Date;
} | null> {
  const db = getDatabase();
  return db.getUserById(userId);
}
