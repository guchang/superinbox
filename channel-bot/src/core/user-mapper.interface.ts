/**
 * User Mapper Interface
 *
 * Manages the mapping between SuperInbox users and platform users.
 */

export interface IUserMapper {
  /**
   * Find SuperInbox user ID by platform channel ID
   * @param channelId - Platform user ID (e.g., Telegram User ID)
   * @param channel - Channel type
   * @returns SuperInbox user ID or null if not found
   */
  findSuperInboxUser(channelId: string, channel: string): Promise<string | null>;

  /**
   * Find platform channel ID by SuperInbox user ID
   * @param userId - SuperInbox user ID
   * @param channel - Channel type
   * @returns Platform channel ID or null if not found
   */
  findChannelUser(userId: string, channel: string): Promise<string | null>;

  /**
   * Bind SuperInbox user with platform channel
   * @param userId - SuperInbox user ID
   * @param channelId - Platform user ID
   * @param channel - Channel type
   */
  bindUser(userId: string, channelId: string, channel: string): Promise<void>;

  /**
   * Unbind platform channel from SuperInbox user
   * @param userId - SuperInbox user ID
   * @param channel - Channel type
   */
  unbindUser(userId: string, channel: string): Promise<void>;

  /**
   * Get all bindings for a SuperInbox user
   * @param userId - SuperInbox user ID
   * @returns Array of user bindings
   */
  getUserBindings(userId: string): Promise<UserBinding[]>;
}

/**
 * User binding record
 */
export interface UserBinding {
  id: string;
  superInboxUserId: string;
  channel: string;
  channelId: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Create binding request
 */
export interface CreateBindingRequest {
  superInboxUserId: string;
  channel: string;
  channelId: string;
  token?: string; // Verification token for security
}
