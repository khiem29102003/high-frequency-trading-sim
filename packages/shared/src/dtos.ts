import type { AssetSymbol, OrderSide } from './types.js';

export interface RegisterRequest {
  email: string;
  password: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface AuthResponse {
  accessToken: string;
}

export interface PlaceOrderRequest {
  symbol: AssetSymbol;
  side: OrderSide;
  limitPrice: string;
  qty: string;
}

export interface CancelOrderRequest {
  orderId: string;
}
