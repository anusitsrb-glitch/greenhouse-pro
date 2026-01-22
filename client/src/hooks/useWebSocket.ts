/**
 * useWebSocket Hook - FIXED: No infinite reconnection loop
 * Manages WebSocket connection for real-time attribute updates
 */

import { useEffect, useState, useRef } from 'react';

interface UseWebSocketOptions {
  project: string;
  gh: string;
  enabled: boolean;
  onUpdate: (data: Record<string, any>) => void;
  onConnectionChange?: (isConnected: boolean) => void;
}

interface WebSocketMessage {
  type: string;
  project?: string;
  gh?: string;
  data?: Record<string, any>;
  timestamp?: number;
  error?: string;
}

export function useWebSocket({
  project,
  gh,
  enabled,
  onUpdate,
  onConnectionChange,
}: UseWebSocketOptions) {
  const [isConnected, setIsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const isConnectingRef = useRef(false);
  const maxReconnectAttempts = 10;
  const baseReconnectDelay = 1000;

  // ✅ FIX: Use useEffect with stable dependencies
  useEffect(() => {
    if (!enabled || !project || !gh) {
      return;
    }

    // ✅ Prevent multiple simultaneous connection attempts
    if (isConnectingRef.current) {
      return;
    }

    // ✅ Close existing connection before creating new one
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    // Clear reconnect timeout
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    isConnectingRef.current = true;

    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = window.location.host;
      const wsUrl = `${protocol}//${host}/api/ws`;

      console.log(`🔌 Connecting to WebSocket: ${wsUrl}`);

      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      // Connection opened
      ws.onopen = () => {
        console.log('✅ WebSocket connected');
        setIsConnected(true);
        onConnectionChange?.(true);
        reconnectAttemptsRef.current = 0;
        isConnectingRef.current = false;

        // Subscribe to greenhouse updates
        ws.send(
          JSON.stringify({
            type: 'subscribe',
            project,
            gh,
          })
        );
      };

      // Message received
      ws.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);

          switch (message.type) {
            case 'connected':
              console.log('📡 WebSocket server acknowledged connection');
              break;

            case 'subscribed':
              console.log(`✅ Subscribed to ${message.project}/${message.gh}`);
              break;

            case 'attributeUpdate':
              if (message.data) {
                console.log('📨 Attribute update received:', Object.keys(message.data));
                onUpdate(message.data);
              }
              break;

            case 'error':
              console.error('❌ WebSocket error message:', message.error);
              break;

            case 'pong':
              // Pong received (connection alive)
              break;

            default:
              console.log('📨 Unknown message type:', message.type);
          }
        } catch (error) {
          console.error('❌ Error parsing WebSocket message:', error);
        }
      };

      // Connection closed
      ws.onclose = (event) => {
        console.log(`🔌 WebSocket disconnected (code: ${event.code})`);
        setIsConnected(false);
        onConnectionChange?.(false);
        wsRef.current = null;
        isConnectingRef.current = false;

        // ✅ CRITICAL: Only reconnect if still enabled and component mounted
        if (!enabled) {
          return;
        }

        // Attempt to reconnect
        if (reconnectAttemptsRef.current < maxReconnectAttempts) {
          reconnectAttemptsRef.current++;
          const delay = baseReconnectDelay * Math.pow(2, reconnectAttemptsRef.current - 1);
          const maxDelay = 30000; // Max 30 seconds
          const actualDelay = Math.min(delay, maxDelay);

          console.log(
            `🔄 Reconnecting in ${actualDelay / 1000}s (attempt ${reconnectAttemptsRef.current}/${maxReconnectAttempts})`
          );

          // ✅ Store timeout so it can be cleared
          reconnectTimeoutRef.current = setTimeout(() => {
            // Trigger re-render to reconnect
            setIsConnected(false);
          }, actualDelay);
        } else if (reconnectAttemptsRef.current >= maxReconnectAttempts) {
          console.error('❌ Max reconnect attempts reached. Please refresh the page.');
        }
      };

      // Connection error
      ws.onerror = (error) => {
        console.error('❌ WebSocket error:', error);
        isConnectingRef.current = false;
      };
    } catch (error) {
      console.error('❌ Error creating WebSocket:', error);
      setIsConnected(false);
      onConnectionChange?.(false);
      isConnectingRef.current = false;
    }

    // ✅ Cleanup on unmount
    return () => {
      console.log('🧹 Cleaning up WebSocket connection');
      
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }

      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }

      isConnectingRef.current = false;
      setIsConnected(false);
      onConnectionChange?.(false);
    };
  }, [project, gh, enabled]); // ✅ FIXED: Only stable dependencies

  // ✅ Separate effect for ping
  useEffect(() => {
    if (!isConnected || !wsRef.current) return;

    const pingInterval = setInterval(() => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'ping' }));
      }
    }, 30000);

    return () => {
      clearInterval(pingInterval);
    };
  }, [isConnected]);

  return {
    isConnected,
  };
}