import { useNavigate } from "react-router-dom";

interface UserTypeToggleProps {
  currentType: 'publisher' | 'advertiser';
  basePath: 'signin' | 'register';
}

export default function UserTypeToggle({ currentType, basePath }: UserTypeToggleProps) {
  const navigate = useNavigate();

  const handleToggle = (type: 'publisher' | 'advertiser') => {
    if (type !== currentType) {
      navigate(`/${type}/${basePath}`);
    }
  };

  return (
    <div className="flex items-center justify-center space-x-4 mt-6">
      <button
        onClick={() => handleToggle('publisher')}
        className={`px-6 py-3 rounded-xl font-semibold transition-all duration-300 ${
          currentType === 'publisher'
            ? 'bg-gradient-to-r from-blue-500 to-purple-600 text-white shadow-lg'
            : 'bg-white/10 border border-white/20 text-gray-300 hover:bg-white/20'
        }`}
      >
        Publisher
      </button>
      <button
        onClick={() => handleToggle('advertiser')}
        className={`px-6 py-3 rounded-xl font-semibold transition-all duration-300 ${
          currentType === 'advertiser'
            ? 'bg-gradient-to-r from-blue-500 to-purple-600 text-white shadow-lg'
            : 'bg-white/10 border border-white/20 text-gray-300 hover:bg-white/20'
        }`}
      >
        Advertiser
      </button>
    </div>
  );
}
