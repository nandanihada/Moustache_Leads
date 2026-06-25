import React, { useEffect, useState, useRef, useCallback } from 'react';
import { OfferwallProfessional } from '../components/OfferwallProfessional';

export const OfferwallPage: React.FC = () => {
  const [params, setParams] = useState({
    placementId: '',
    userId: '',
    subId: '',
    country: '',
    apiKey: '',
  });
  const containerRef = useRef<HTMLDivElement>(null);
  const [isInIframe, setIsInIframe] = useState(false);

  useEffect(() => {
    // Get URL parameters
    const searchParams = new URLSearchParams(window.location.search);
    setParams({
      placementId: searchParams.get('placement_id') || '',
      userId: searchParams.get('user_id') || '',
      subId: searchParams.get('sub_id') || '',
      country: searchParams.get('country') || '',
      apiKey: searchParams.get('api_key') || '',
    });

    // Detect if we're inside an iframe
    try {
      const inIframe = window.self !== window.top;
      setIsInIframe(inIframe);
    } catch {
      // Cross-origin iframe — we're definitely in one
      setIsInIframe(true);
    }
  }, []);

  // ==================== IFRAME AUTO-RESIZE ====================
  // Communicates content height to the parent window so the iframe
  // can grow to fit content without internal scrollbars
  const sendHeight = useCallback(() => {
    if (!isInIframe) return;
    try {
      const height = document.documentElement.scrollHeight;
      window.parent.postMessage(
        { type: 'moustache-offerwall-resize', height },
        '*'
      );
    } catch {
      // Cross-origin — parent can't receive, that's ok
    }
  }, [isInIframe]);

  useEffect(() => {
    if (!isInIframe) return;

    // Send height on load, after renders, and on resize
    const observer = new ResizeObserver(() => sendHeight());
    observer.observe(document.documentElement);

    // Also poll briefly after load for dynamic content
    const intervals = [100, 300, 500, 1000, 2000, 5000];
    const timers = intervals.map(ms => setTimeout(sendHeight, ms));

    // Send on scroll (for infinite scroll scenarios)
    const handleMutation = () => sendHeight();
    const mutObs = new MutationObserver(handleMutation);
    mutObs.observe(document.body, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
      mutObs.disconnect();
      timers.forEach(clearTimeout);
    };
  }, [isInIframe, sendHeight]);

  // ==================== IFRAME-FRIENDLY STYLES ====================
  // Override global CSS that causes scrolling issues inside iframes
  useEffect(() => {
    if (!isInIframe) return;

    // Fix html/body for iframe context
    const style = document.createElement('style');
    style.id = 'offerwall-iframe-fixes';
    style.textContent = `
      html, body, #root {
        height: auto !important;
        min-height: auto !important;
        overflow: visible !important;
        overflow-x: hidden !important;
      }
      body {
        overflow-y: auto !important;
        -webkit-overflow-scrolling: touch !important;
      }
      /* Remove sticky positioning inside iframes — it fights with parent scroll */
      .ow-header {
        position: relative !important;
      }
      /* Ensure the offerwall fills available width */
      #root {
        width: 100% !important;
        max-width: 100% !important;
      }
      /* Fix main overflow for iframe */
      main {
        overflow: visible !important;
      }
    `;
    document.head.appendChild(style);

    return () => {
      const el = document.getElementById('offerwall-iframe-fixes');
      if (el) el.remove();
    };
  }, [isInIframe]);

  if (!params.placementId || !params.userId) {
    return (
      <div className="w-full min-h-screen flex items-center justify-center" style={{ background: '#fcf8ff', fontFamily: "'DM Sans', sans-serif" }}>
        <div className="text-center">
          <div className="w-16 h-16 bg-gradient-to-br from-[#340075] to-[#4c1d95] rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-xl">
            <span className="text-white font-black text-xl">ML</span>
          </div>
          <h1 className="text-3xl font-bold mb-4" style={{ color: '#181445' }}>Moustache Leads</h1>
          <p className="mb-4" style={{ color: '#4a4452' }}>Missing required parameters</p>
          <p className="text-sm" style={{ color: '#7b7483' }}>
            Please provide placement_id and user_id in the URL
          </p>
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} style={{ width: '100%', minHeight: isInIframe ? 'auto' : '100vh' }}>
      <OfferwallProfessional
        placementId={params.placementId}
        userId={params.userId}
        subId={params.subId}
        country={params.country}
        apiKey={params.apiKey}
      />

      {/* Embed script helper — publishers can include this on their page for auto-resize */}
      {isInIframe && (
        <script
          dangerouslySetInnerHTML={{
            __html: `
              // Auto-resize is handled via postMessage from within the iframe.
              // Parent page should add this script for seamless height sync:
              // window.addEventListener('message', function(e) {
              //   if (e.data && e.data.type === 'moustache-offerwall-resize') {
              //     document.getElementById('your-iframe-id').style.height = e.data.height + 'px';
              //   }
              // });
            `,
          }}
        />
      )}
    </div>
  );
};

export default OfferwallPage;
