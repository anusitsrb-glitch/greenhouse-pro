/**
 * WebSocket Server for Real-time Updates
 * Handles client connections and broadcasts ThingsBoard attribute updates
 */

import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';
import { IncomingMessage } from 'http';
import { ClientMessage, ServerMessage, ClientSubscription } from './types.js';

// Store WebSocket clients grouped by greenhouse
const clients = new Map<string, Set<WebSocket>>();

// Store subscriptions to track what each client is subscribed to
const subscriptions = new Map<WebSocket, ClientSubscription>();

// Rate limiting for messages
const messageRateLimits = new Map<WebSocket, { count: number; resetAt: number }>();
const MESSAGE_RATE_LIMIT = 100; // messages per minute
const RATE_LIMIT_WINDOW = 60000; // 1 minute

/**
 * Initialize WebSocket Server
 */
export function initWebSocket(server: Server): WebSocketServer {
  const wss = new WebSocketServer({ 
    server, 
    path: '/api/ws',
    // Verify origin to prevent CSRF
    verifyClient: (info: { origin?: string; req: IncomingMessage }) => {
      // Allow all origins in development
      if (process.env.NODE_ENV === 'development') {
        return true;
      }
      
      // In production, verify origin
      const origin = info.origin || info.req.headers.origin;
      if (!origin) return false;
      
      // Allow same origin
      const allowedOrigins = process.env.CORS_ORIGINS?.split(',').map(s => s.trim()) || [];
      return allowedOrigins.some(allowed => origin.startsWith(allowed));
    }
  });

  wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
    console.log('📱 WebSocket client connected');

    // Setup event handlers
    setupClientHandlers(ws, req);

    // Send welcome message
    sendMessage(ws, {
      type: 'connected',
      message: 'WebSocket connected successfully',
      timestamp: Date.now(),
    });
  });

  wss.on('error', (error) => {
    console.error('❌ WebSocket Server Error:', error);
  });

  console.log('✅ WebSocket Server initialized on /api/ws');

  return wss;
}

/**
 * Setup event handlers for a client connection
 */
function setupClientHandlers(ws: WebSocket, req: IncomingMessage) {
  // Handle incoming messages
  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data.toString()) as ClientMessage;
      
      // Check rate limit
      if (!checkRateLimit(ws)) {
        sendMessage(ws, {
          type: 'error',
          error: 'Rate limit exceeded',
          timestamp: Date.now(),
        });
        return;
      }

      handleClientMessage(ws, message);
    } catch (error) {
      console.error('❌ Invalid WebSocket message:', error);
      sendMessage(ws, {
        type: 'error',
        error: 'Invalid message format',
        timestamp: Date.now(),
      });
    }
  });

  // Handle disconnection
  ws.on('close', () => {
    console.log('📱 WebSocket client disconnected');
    cleanupClient(ws);
  });

  // Handle errors
  ws.on('error', (error) => {
    console.error('❌ WebSocket client error:', error);
    cleanupClient(ws);
  });

  // Setup ping/pong for connection health
  ws.on('pong', () => {
    // Client is alive
  });
}

/**
 * Handle messages from clients
 */
function handleClientMessage(ws: WebSocket, message: ClientMessage) {
  switch (message.type) {
    case 'subscribe':
      if (message.project && message.gh) {
        handleSubscribe(ws, message.project, message.gh);
      }
      break;
      
    case 'unsubscribe':
      handleUnsubscribe(ws);
      break;
      
    case 'ping':
      sendMessage(ws, {
        type: 'pong',
        timestamp: Date.now(),
      });
      break;
      
    default:
      sendMessage(ws, {
        type: 'error',
        error: 'Unknown message type',
        timestamp: Date.now(),
      });
  }
}

/**
 * Subscribe client to greenhouse updates
 */
function handleSubscribe(ws: WebSocket, project: string, gh: string) {
  if (!project || !gh) {
    sendMessage(ws, {
      type: 'error',
      error: 'Missing project or gh parameter',
      timestamp: Date.now(),
    });
    return;
  }

  const key = `${project}/${gh}`;

  // Remove from previous subscription if any
  const prevSubscription = subscriptions.get(ws);
  if (prevSubscription) {
    const prevKey = `${prevSubscription.project}/${prevSubscription.gh}`;
    clients.get(prevKey)?.delete(ws);
  }

  // Add to new subscription
  if (!clients.has(key)) {
    clients.set(key, new Set());
  }
  clients.get(key)!.add(ws);

  // Store subscription info
  subscriptions.set(ws, { project, gh });

  console.log(`✅ Client subscribed to ${key} (total: ${clients.get(key)!.size})`);

  // Send confirmation
  sendMessage(ws, {
    type: 'subscribed',
    project,
    gh,
    timestamp: Date.now(),
  });
}

/**
 * Unsubscribe client from updates
 */
function handleUnsubscribe(ws: WebSocket) {
  const subscription = subscriptions.get(ws);
  if (!subscription) return;

  const key = `${subscription.project}/${subscription.gh}`;
  clients.get(key)?.delete(ws);
  subscriptions.delete(ws);

  console.log(`✅ Client unsubscribed from ${key}`);

  sendMessage(ws, {
    type: 'unsubscribed',
    timestamp: Date.now(),
  });
}

/**
 * Cleanup client on disconnect
 */
function cleanupClient(ws: WebSocket) {
  const subscription = subscriptions.get(ws);
  if (subscription) {
    const key = `${subscription.project}/${subscription.gh}`;
    clients.get(key)?.delete(ws);
    
    // Remove empty sets
    if (clients.get(key)?.size === 0) {
      clients.delete(key);
    }
  }
  
  subscriptions.delete(ws);
  messageRateLimits.delete(ws);
}

/**
 * Broadcast attribute update to all subscribed clients
 */
export function broadcastAttributeUpdate(
  project: string,
  gh: string,
  attributes: Record<string, any>
) {
  const key = `${project}/${gh}`;
  const subscribers = clients.get(key);

  if (!subscribers || subscribers.size === 0) {
    return;
  }

  const message: ServerMessage = {
    type: 'attributeUpdate',
    project,
    gh,
    data: attributes,
    timestamp: Date.now(),
  };

  const messageStr = JSON.stringify(message);
  let successCount = 0;

  subscribers.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      try {
        client.send(messageStr);
        successCount++;
      } catch (error) {
        console.error('❌ Error sending to client:', error);
      }
    }
  });

  if (successCount > 0) {
    console.log(`📡 Broadcast to ${key}: ${successCount} clients`);
  }
}

/**
 * Send message to a specific client
 */
function sendMessage(ws: WebSocket, message: ServerMessage) {
  if (ws.readyState === WebSocket.OPEN) {
    try {
      ws.send(JSON.stringify(message));
    } catch (error) {
      console.error('❌ Error sending message:', error);
    }
  }
}

/**
 * Check rate limit for a client
 */
function checkRateLimit(ws: WebSocket): boolean {
  const now = Date.now();
  const limit = messageRateLimits.get(ws);

  if (!limit || limit.resetAt < now) {
    // Reset limit
    messageRateLimits.set(ws, {
      count: 1,
      resetAt: now + RATE_LIMIT_WINDOW,
    });
    return true;
  }

  if (limit.count >= MESSAGE_RATE_LIMIT) {
    return false;
  }

  limit.count++;
  return true;
}

/**
 * Periodic cleanup and health check
 */
setInterval(() => {
  // Clean up rate limits
  const now = Date.now();
  for (const [ws, limit] of messageRateLimits.entries()) {
    if (limit.resetAt < now) {
      messageRateLimits.delete(ws);
    }
  }

  // Send ping to all clients
  for (const clientSet of clients.values()) {
    clientSet.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        try {
          client.ping();
        } catch (error) {
          // Client will be cleaned up on error event
        }
      }
    });
  }
}, 30000); // Every 30 seconds

/**
 * Get current statistics
 */
export function getWebSocketStats() {
  let totalClients = 0;
  const greenhouseStats: Record<string, number> = {};

  for (const [key, clientSet] of clients.entries()) {
    const count = clientSet.size;
    totalClients += count;
    greenhouseStats[key] = count;
  }

  return {
    totalClients,
    totalGreenhouses: clients.size,
    greenhouseStats,
  };
}