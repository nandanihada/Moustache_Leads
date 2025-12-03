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
      <div className="w-full min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-white mb-4">Offerwall</h1>
          <p className="text-gray-400 mb-4">Missing required parameters</p>
          <p className="text-gray-500 text-sm">
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
