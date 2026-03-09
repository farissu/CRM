import axios from 'axios';
import { redisClient } from '../config/redis';

const WAPPIN_TOKEN_KEY = 'wappin:token';

interface WappinLoginResponse {
  users: Array<{
    token: string;
    expired_after: string;
  }>;
}

export class WappinAuthService {
  private apiUrl: string;
  private username: string;
  private password: string;

  constructor() {
    this.apiUrl = process.env.WAPPIN_API_URL || 'https://api.chat.wappin.app/v1';
    this.username = process.env.WAPPIN_USERNAME || '';
    this.password = process.env.WAPPIN_PASSWORD || '';
  }

  /**
   * Login to Wappin and get authentication token
   */
  async login(): Promise<string> {
    try {
      const authString = Buffer.from(`${this.username}:${this.password}`).toString('base64');
      
      const response = await axios.post<WappinLoginResponse>(
        `${this.apiUrl}/users/login`,
        {},
        {
          headers: {
            'Authorization': `Basic ${authString}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (!response.data.users || response.data.users.length === 0) {
        throw new Error('No user data in Wappin login response');
      }

      const { token, expired_after } = response.data.users[0];

      // Calculate TTL in seconds
      const expirationDate = new Date(expired_after);
      const now = new Date();
      const ttlSeconds = Math.floor((expirationDate.getTime() - now.getTime()) / 1000);

      // Store token in Redis with TTL minus 5 minutes buffer for refresh
      const ttlWithBuffer = Math.max(ttlSeconds - 300, 60);
      await redisClient.setEx(WAPPIN_TOKEN_KEY, ttlWithBuffer, token);

      console.log(`Wappin token stored in Redis, expires in ${ttlWithBuffer} seconds`);

      return token;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        console.error('Wappin login failed:', error.response?.data || error.message);
        throw new Error(`Wappin authentication failed: ${error.response?.data?.message || error.message}`);
      }
      throw error;
    }
  }

  /**
   * Get current valid token from cache or login if expired
   */
  async getToken(): Promise<string> {
    try {
      // Try to get token from Redis
      const cachedToken = await redisClient.get(WAPPIN_TOKEN_KEY);
      
      if (cachedToken) {
        console.log('Using cached Wappin token');
        return cachedToken;
      }

      // Token not in cache or expired, login again
      console.log('Wappin token not found or expired, logging in...');
      return await this.login();
    } catch (error) {
      console.error('Failed to get Wappin token:', error);
      throw error;
    }
  }

  /**
   * Force refresh token
   */
  async refreshToken(): Promise<string> {
    console.log('Forcing Wappin token refresh...');
    await redisClient.del(WAPPIN_TOKEN_KEY);
    return await this.login();
  }

  /**
   * Initialize service and login on startup
   */
  async initialize(): Promise<void> {
    try {
      console.log('Initializing Wappin authentication...');
      await this.login();
      console.log('Wappin authentication initialized successfully');
    } catch (error) {
      console.error('Failed to initialize Wappin authentication:', error);
      throw error;
    }
  }
}

export const wappinAuthService = new WappinAuthService();
