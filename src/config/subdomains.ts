// Subdomain configuration
export const SUBDOMAINS = {
  admin: 'dashboard.moustacheleads.com',      // Admin dashboard
  offers: 'offers.moustacheleads.com',        // Publisher offers
  offerwall: 'offerwall.moustacheleads.com',  // User offerwall
  landing: 'landing.moustacheleads.com',      // Landing page
  main: 'moustacheleads.com'                  // Main domain
} as const;

// Note: Postback URLs are backend endpoints, not frontend subdomains
// They use the backend domain: https://moustacheleads-backend.onrender.com/postback/{key}

// Get current subdomain
export const getCurrentSubdomain = (): string | null => {
  if (typeof window === 'undefined') return null;
  
  const hostname = window.location.hostname;
  
  // Local development
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return null;
  }
  
  // Extract subdomain
  const parts = hostname.split('.');
  if (parts.length >= 3) {
    return parts[0]; // Returns 'dashboard', 'offers', etc.
  }
  
  return null;
};

// Check if current domain matches a specific subdomain
export const isSubdomain = (subdomain: keyof typeof SUBDOMAINS): boolean => {
  const current = getCurrentSubdomain();
  return current === subdomain;
};

// Get full URL for a subdomain
export const getSubdomainUrl = (subdomain: keyof typeof SUBDOMAINS, path: string = ''): string => {
  const domain = SUBDOMAINS[subdomain];
  const protocol = window.location.protocol;
  return `${protocol}//${domain}${path}`;
};

// Redirect to subdomain
export const redirectToSubdomain = (subdomain: keyof typeof SUBDOMAINS, path: string = '') => {
  const url = getSubdomainUrl(subdomain, path);
  window.location.href = url;
};
