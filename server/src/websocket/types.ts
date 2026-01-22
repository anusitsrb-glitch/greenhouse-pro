/**
 * WebSocket Type Definitions
 */

// Message from client to server
export interface ClientMessage {
  type: 'subscribe' | 'unsubscribe' | 'ping';
  project?: string;
  gh?: string;
}

// Message from server to client
export type ServerMessage =
  | ConnectedMessage
  | SubscribedMessage
  | UnsubscribedMessage
  | AttributeUpdateMessage
  | PongMessage
  | ErrorMessage;

export interface ConnectedMessage {
  type: 'connected';
  message: string;
  timestamp: number;
}

export interface SubscribedMessage {
  type: 'subscribed';
  project: string;
  gh: string;
  timestamp: number;
}

export interface UnsubscribedMessage {
  type: 'unsubscribed';
  timestamp: number;
}

export interface AttributeUpdateMessage {
  type: 'attributeUpdate';
  project: string;
  gh: string;
  data: Record<string, any>;
  timestamp: number;
}

export interface PongMessage {
  type: 'pong';
  timestamp: number;
}

export interface ErrorMessage {
  type: 'error';
  error: string;
  timestamp: number;
}

// Client subscription info
export interface ClientSubscription {
  project: string;
  gh: string;
}
