import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { OfferDetailsModal } from './OfferDetailsModal';
import { Offer } from '@/services/adminOfferApi';

// Test component to verify the modal works
export const TestOfferModal: React.FC = () => {
  const [modalOpen, setModalOpen] = useState(false);

  // Mock offer data for testing
  const mockOffer: Offer = {
    offer_id: 'ML-00001',
    campaign_id: 'TEST-CAMPAIGN-001',
    name: 'Paramount+ Video On Demand (Main Page)_CPA Free Trial_US',
    description: 'Premium streaming service with exclusive content and live sports',
    status: 'active',
    category: 'Entertainment',
    offer_type: 'CPA',
    countries: ['US', 'CA', 'GB'],
    languages: ['en'],
    device_targeting: 'all',
    payout: 9.60,
    currency: 'USD',
    network: 'Adsnextgen',
    target_url: 'https://www.paramountplus.com/signup',
    preview_url: 'https://www.paramountplus.com/preview',
    affiliates: 'all',
    hits: 1250,
    limit: 5000,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    expiration_date: '2029-01-21',
    image_url: 'https://via.placeholder.com/300x200/0066cc/ffffff?text=Paramount+',
    thumbnail_url: 'https://via.placeholder.com/150x100/0066cc/ffffff?text=P+',
    tags: ['streaming', 'entertainment', 'premium'],
    keywords: ['paramount', 'streaming', 'movies', 'tv'],
    is_active: true
  };

  return (
    <div className="p-4">
      <h2 className="text-xl font-bold mb-4">Test Offer Details Modal</h2>
      <Button onClick={() => setModalOpen(true)}>
        Open Test Offer Modal
      </Button>
      
      <OfferDetailsModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        offer={mockOffer}
      />
    </div>
  );
};
