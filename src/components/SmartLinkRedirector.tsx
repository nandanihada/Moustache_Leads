import React, { useEffect } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { getApiBaseUrl } from '../services/apiConfig';

/**
 * SmartLinkRedirector handles /smart/:slug routes in the frontend
 * It forces a server-side redirect by hitting the backend directly.
 * This ensures Vite proxy handles the request and no SPA routes interfere.
 */
export const SmartLinkRedirector: React.FC = () => {
  const { slug } = useParams();
  const [searchParams] = useSearchParams();
  
  useEffect(() => {
    if (slug) {
      const query = searchParams.toString();
      const backendUrl = `${getApiBaseUrl()}/smart/${slug}${query ? `?${query}` : ''}`;
      
      console.log(`🚀 Smart Redirecting to Backend: ${backendUrl}`);
      
      // Use window.location.replace to prevent back-button loops
      // and ensure the browser hits the server for the redirect
      window.location.replace(backendUrl);
    }
  }, [slug, searchParams]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-900 text-white">
      <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-blue-500 mb-4"></div>
      <h2 className="text-xl font-bold">Initializing Redirection...</h2>
      <p className="text-slate-400 mt-2 text-sm">Probing for the best available offer...</p>
    </div>
  );
};
