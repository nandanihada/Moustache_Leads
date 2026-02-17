// Category to Image mapping
// Images are stored in /public/category-images/ and served directly

// Direct URLs to images in public folder
const healthImg = '/category-images/health.png';
const surveyImg = '/category-images/survey.png';
const sweepstakesImg = '/category-images/sweepstakes.png';
const educationImg = '/category-images/education.png';
const insuranceImg = '/category-images/insurance.png';
const loanImg = '/category-images/loan.png';
const financeImg = '/category-images/finance.png';
const datingImg = '/category-images/dating.png';
const freeTrialImg = '/category-images/free_trial.png';
const installsImg = '/category-images/installs.png';
const gamesInstallImg = '/category-images/games_install.png';
const otherImg = '/category-images/other.png';

// Map category names to their images
export const CATEGORY_IMAGES: Record<string, string> = {
  'HEALTH': healthImg,
  'SURVEY': surveyImg,
  'SWEEPSTAKES': sweepstakesImg,
  'EDUCATION': educationImg,
  'INSURANCE': insuranceImg,
  'LOAN': loanImg,
  'FINANCE': financeImg,
  'DATING': datingImg,
  'FREE_TRIAL': freeTrialImg,
  'INSTALLS': installsImg,
  'GAMES_INSTALL': gamesInstallImg,
  'GAMES INSTALL': gamesInstallImg,
  'OTHER': otherImg,
  'GENERAL': otherImg,
  // Lowercase variants
  'health': healthImg,
  'survey': surveyImg,
  'sweepstakes': sweepstakesImg,
  'education': educationImg,
  'insurance': insuranceImg,
  'loan': loanImg,
  'finance': financeImg,
  'dating': datingImg,
  'free_trial': freeTrialImg,
  'installs': installsImg,
  'games_install': gamesInstallImg,
  'other': otherImg,
  'general': otherImg,
  // Legacy/alternative names
  'Lifestyle': otherImg,
  'lifestyle': otherImg,
  'General': otherImg,
  'Gaming': gamesInstallImg,
  'gaming': gamesInstallImg,
  'Healthcare': healthImg,
  'healthcare': healthImg,
  'Medical': healthImg,
  'medical': healthImg,
  'Crypto': financeImg,
  'crypto': financeImg,
  'Banking': financeImg,
  'banking': financeImg,
  'Investment': financeImg,
  'investment': financeImg,
  'Sweeps': sweepstakesImg,
  'sweeps': sweepstakesImg,
  'Giveaway': sweepstakesImg,
  'giveaway': sweepstakesImg,
  'Contest': sweepstakesImg,
  'contest': sweepstakesImg,
  'App': installsImg,
  'app': installsImg,
  'Download': installsImg,
  'download': installsImg,
  'Game': gamesInstallImg,
  'game': gamesInstallImg,
  'Games': gamesInstallImg,
  'games': gamesInstallImg,
  'Trial': freeTrialImg,
  'trial': freeTrialImg,
  // Entertainment category
  'Entertainment': otherImg,
  'entertainment': otherImg,
  'ENTERTAINMENT': otherImg,
  // Utilities category
  'Utilities': otherImg,
  'utilities': otherImg,
  'UTILITIES': otherImg,
};

/**
 * Get the category image URL for a given category/vertical
 * Falls back to 'other' image if category not found
 */
export function getCategoryImage(category: string | undefined | null): string {
  if (!category) return otherImg;
  
  // Try exact match first
  if (CATEGORY_IMAGES[category]) {
    return CATEGORY_IMAGES[category];
  }
  
  // Try uppercase
  const upperCategory = category.toUpperCase();
  if (CATEGORY_IMAGES[upperCategory]) {
    return CATEGORY_IMAGES[upperCategory];
  }
  
  // Try lowercase
  const lowerCategory = category.toLowerCase();
  if (CATEGORY_IMAGES[lowerCategory]) {
    return CATEGORY_IMAGES[lowerCategory];
  }
  
  // Default to other
  return otherImg;
}

/**
 * Get offer image - uses offer's image_url if available, otherwise falls back to category image
 */
export function getOfferImage(offer: { image_url?: string; thumbnail_url?: string; vertical?: string; category?: string }): string {
  // Helper to check if URL is a placeholder or invalid path
  const isPlaceholderOrInvalid = (url: string): boolean => {
    if (!url || url.trim() === '') return true;
    const lowerUrl = url.toLowerCase();
    return (
      lowerUrl.includes('unsplash.com') ||
      lowerUrl.includes('/assets/category-images/') ||  // Old incorrect path
      lowerUrl.includes('placeholder') ||
      lowerUrl.includes('via.placeholder') ||
      lowerUrl.includes('picsum.photos')
    );
  };

  // If offer has a custom image that's not a placeholder, use it
  if (offer.thumbnail_url && !isPlaceholderOrInvalid(offer.thumbnail_url)) {
    return offer.thumbnail_url;
  }
  if (offer.image_url && !isPlaceholderOrInvalid(offer.image_url)) {
    return offer.image_url;
  }
  
  // Fall back to category image based on vertical or category
  const category = offer.vertical || offer.category;
  return getCategoryImage(category);
}
