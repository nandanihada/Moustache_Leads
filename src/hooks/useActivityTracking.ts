/**
 * Activity Tracking Hook
 * Automatically tracks page visits and sends heartbeats
 */

import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import loginLogsService from '@/services/loginLogsService';

export const useActivityTracking = () => {
  const location = useLocation();
  const sessionId = useRef<string | null>(null);
  const heartbeatInterval = useRef<NodeJS.Timeout | null>(null);

  // Get session ID from localStorage
  useEffect(() => {
    const storedSessionId = localStorage.getItem('session_id');
    if (storedSessionId) {
      sessionId.current = storedSessionId;
    }
  }, []);

  // Track page visits on route change
  useEffect(() => {
    if (!sessionId.current) return;

    const trackPageVisit = async () => {
      try {
        const pageTitle = document.title;
        const pageUrl = location.pathname + location.search;
        const referrer = document.referrer;

        await loginLogsService.trackPageVisit(
          sessionId.current!,
          pageUrl,
          pageTitle,
          referrer
        );

        console.log('📊 Page visit tracked:', pageUrl);
      } catch (error) {
        console.error('Failed to track page visit:', error);
      }
    };

    trackPageVisit();
  }, [location]);

  // Send heartbeat every 30 seconds
  useEffect(() => {
    if (!sessionId.current) return;

    const sendHeartbeat = async () => {
      try {
        const currentPage = location.pathname + location.search;
        await loginLogsService.updateHeartbeat(sessionId.current!, currentPage);
        console.log('💓 Heartbeat sent');
      } catch (error) {
        console.error('Failed to send heartbeat:', error);
      }
    };

    // Send initial heartbeat
    sendHeartbeat();

    // Set up interval for heartbeats
    heartbeatInterval.current = setInterval(sendHeartbeat, 30000); // Every 30 seconds

    return () => {
      if (heartbeatInterval.current) {
        clearInterval(heartbeatInterval.current);
      }
    };
  }, [location]);

  return {
    sessionId: sessionId.current,
  };
};
