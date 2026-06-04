import React, { useEffect, useState } from 'react';
import { OfferwallProfessional } from '../components/OfferwallProfessional';

export const OfferwallPage: React.FC = () => {
  const [params, setParams] = useState({
    placementId: '',
    userId: '',
    subId: '',
    country: '',
  });

  useEffect(() => {
    // Get URL parameters
    const searchParams = new URLSearchParams(window.location.search);
    setParams({
      placementId: searchParams.get('placement_id') || '',
      userId: searchParams.get('user_id') || '',
      subId: searchParams.get('sub_id') || '',
      country: searchParams.get('country') || '',
    });
  }, []);

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
    <OfferwallProfessional
      placementId={params.placementId}
      userId={params.userId}
      subId={params.subId}
      country={params.country}
    />
  );
};

export default OfferwallPage;
