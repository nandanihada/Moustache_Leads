import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { getCurrentSubdomain, redirectToSubdomain } from '../config/subdomains';

// Map subdomains to their default routes
const SUBDOMAIN_ROUTES: Record<string, string> = {
  dashboard: '/admin',           // Admin dashboard
  offers: '/dashboard/offers',   // Publisher offers (inside dashboard)
  offerwall: '/offerwall',       // User offerwall (with query params)
  landing: '/'                   // Landing page
};

export const SubdomainRouter: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const subdomain = getCurrentSubdomain();

  useEffect(() => {
    // Skip if on localhost
    if (!subdomain) return;

    // Check if we need to redirect to a different subdomain
    const currentPath = location.pathname;
    
    // Admin routes should be on dashboard subdomain
    if (currentPath.startsWith('/admin') && subdomain !== 'dashboard') {
      window.location.href = `https://dashboard.moustacheleads.com${currentPath}${location.search}`;
      return;
    }
    
    // Publisher offers should be on offers subdomain
    if (currentPath.startsWith('/dashboard/offers') && subdomain !== 'offers') {
      window.location.href = `https://offers.moustacheleads.com${currentPath}${location.search}`;
      return;
    }
    
    // Offerwall should be on offerwall subdomain
    if (currentPath.startsWith('/offerwall') && subdomain !== 'offerwall') {
      window.location.href = `https://offerwall.moustacheleads.com${currentPath}${location.search}`;
      return;
    }

    // If on a subdomain, ensure we're on the correct route
    if (SUBDOMAIN_ROUTES[subdomain]) {
      const expectedRoute = SUBDOMAIN_ROUTES[subdomain];
      
      // If not on the expected route or a sub-route, navigate to it
      if (!currentPath.startsWith(expectedRoute)) {
        navigate(expectedRoute, { replace: true });
      }
    }
  }, [subdomain, location.pathname, location.search, navigate]);

  return <>{children}</>;
};

// Hook to handle subdomain-aware navigation
export const useSubdomainNavigation = () => {
  const navigate = useNavigate();

  const navigateToRoute = (path: string) => {
    const currentSubdomain = getCurrentSubdomain();
    
    // Check if path should be on a different subdomain
    if (path.startsWith('/admin')) {
      if (currentSubdomain !== 'dashboard') {
        redirectToSubdomain('admin', path);
        return;
      }
    } else if (path.startsWith('/dashboard/offers')) {
      if (currentSubdomain !== 'offers') {
        redirectToSubdomain('offers', path);
        return;
      }
    } else if (path.startsWith('/offerwall')) {
      if (currentSubdomain !== 'offerwall') {
        // Preserve query parameters when redirecting to offerwall
        const fullPath = path.includes('?') ? path : `${path}${window.location.search}`;
        redirectToSubdomain('offerwall', fullPath);
        return;
      }
    } else if (path === '/' || path.startsWith('/landing')) {
      if (currentSubdomain !== 'landing' && currentSubdomain !== null) {
        redirectToSubdomain('landing', path);
        return;
      }
    }

    // Navigate normally if already on correct subdomain
    navigate(path);
  };

  return { navigateToRoute };
};
