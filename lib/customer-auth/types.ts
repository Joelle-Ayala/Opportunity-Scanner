export type SupabaseCustomerUser = {
  id: string;
  email?: string;
  phone?: string;
  role?: string;
  aud?: string;
  created_at?: string;
  updated_at?: string;
  last_sign_in_at?: string;
  user_metadata?: Record<string, unknown>;
  app_metadata?: Record<string, unknown>;
};

export type CustomerAuthTokens = {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: string;
};

export type CustomerSession = {
  user: SupabaseCustomerUser;
  accessToken: string;
  refreshedTokens: CustomerAuthTokens | null;
};
