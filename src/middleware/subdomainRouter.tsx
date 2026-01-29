import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { getCurrentSubdomain } from '../config/subdomains';

// Map subdomains to their default routes
const SUBDOMAIN_ROUTES: Record<string, string> = {
  dashboard: '/admin',
  offers: '/dashboard/offers',
  offerwall: '/offerwall'
};

export const SubdomainRouter: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const location = useLocation();
  const subdomain = getCurrentSubdomain();

  useEffect(() => {
    // Skip if on localhost or no subdomain
    if (!subdomain || subdomain === 'www') return;

    const currentPath = location.pathname;
    const currentSearch = location.search;
    
    // Check if we're on the wrong subdomain for this path
    if (currentPath.startsWith('/admin') && subdomain !== 'dashboard') {
      window.location.href = `https://dashboard.moustacheleads.com${currentPath}${currentSearch}`;
      return;
    }
    
    if (currentPath.startsWith('/offerwall') && subdomain !== 'offerwall') {
      window.location.href = `https://offerwall.moustacheleads.com${currentPath}${currentSearch}`;
      return;
    }
    
    // Redirect offers subdomain to offers page
    if (subdomain === 'offers' && currentPath === '/') {
      window.location.href = `https://offers.moustacheleads.com/dashboard/offers`;
      return;
    }

  }, [subdomain, location.pathname, location.search]);

  return <>{children}</>;
};

// Hook to handle subdomain-aware navigation
export const useSubdomainNavigation = () => {
  const navigateToRoute = (path: string) => {
    const currentSubdomain = getCurrentSubdomain();
    
    // Determine which subdomain this path should be on
    if (path.startsWith('/admin') && currentSubdomain !== 'dashboard') {
      window.location.href = `https://dashboard.moustacheleads.com${path}`;
      return;
    }
    
    if (path.startsWith('/offerwall') && currentSubdomain !== 'offerwall') {
      window.location.href = `https://offerwall.moustacheleads.com${path}`;
      return;
    }

    // If already on correct subdomain, use normal navigation
    window.location.href = path;
  };

  return { navigateToRoute };
};
