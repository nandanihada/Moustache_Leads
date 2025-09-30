import React, { useState } from 'react';
import { BarChart2, DollarSign, ArrowLeft, ArrowRight, Menu, Moon, Bell, ChevronDown, Search, Download } from 'lucide-react';

// --- Data Simulation ---
const reportNavItems = [
  { name: 'Conversion', key: 'conversion' },
  { name: 'Placement', key: 'placement' },
  { name: 'Countries', key: 'countries' },
  { name: 'Reversal', key: 'reversal' },
  { name: 'Postbacks', key: 'postbacks' },
];

const mockTableData = [
  { placement: 'kingopinions', clicks: 148, conversions: 7, reversals: 25, revenue: 392 },
];

// Renamed the main function component to 'Reports'
const Reports = () => { 
  const [activeTab, setActiveTab] = useState('placement');
  
  // --- New State for Workability ---
  const [searchQuery, setSearchQuery] = useState('');
  const [currentDateRange, setCurrentDateRange] = useState('2025-09-23 ~ 2025-09-XX');
  const [currentPage, setCurrentPage] = useState(1);
  // We'll use these states to simulate interaction, even though they don't open full modals
  const [isSearchByOpen, setIsSearchByOpen] = useState(false);
  const [isFilterOpen, setIsFilterOpen] = useState(false);


  // Helper component for the Dashboard Header
  const Header = () => (
    <header className="flex justify-between items-center p-4 sm:px-8 bg-white shadow-md border-b sticky top-0 z-10">
      
      {/* Logo and Payment Info */}
      <div className="flex items-center space-x-6">
        {/* App Logo/Identifier */}
        <div className="flex items-center">
            <div className="w-8 h-8 mr-3 rounded-xl bg-blue-600/10 flex items-center justify-center">
                <div className="w-5 h-5 bg-blue-600 rounded-full relative overflow-hidden">
                    {/* Custom 'A' shape from the image */}
                    <div className="absolute top-1 left-0 w-full h-full bg-white opacity-90 transform skew-x-[-15deg]"></div>
                    <div className="absolute bottom-1 right-0 w-full h-full bg-white opacity-90 transform skew-x-[15deg]"></div>
                </div>
            </div>
        </div>

        {/* Payment Status */}
        <div className="hidden sm:flex items-center text-sm font-semibold text-gray-700 bg-blue-50/50 p-2 rounded-xl border border-blue-100">
            <DollarSign className="w-4 h-4 text-blue-600 mr-2" />
            <span className="text-blue-700 font-bold">$ 0 this month</span>
            <span className="ml-3 text-xs text-gray-500">Next Payment on: Sun Sep 07 2025</span>
        </div>
      </div>

      {/* User Actions and Profile */}
      <div className="flex items-center space-x-4">
        <button className="text-gray-500 hover:text-blue-600 p-2 rounded-full transition-colors">
          <Moon className="w-5 h-5" />
        </button>
        <button className="text-gray-500 hover:text-blue-600 p-2 rounded-full transition-colors">
          <Bell className="w-5 h-5" />
        </button>
        <div className="flex items-center space-x-2 cursor-pointer p-1 rounded-full hover:bg-gray-100 transition-colors">
          <img
            src="https://placehold.co/32x32/1d4ed8/ffffff?text=P"
            alt="Profile"
            className="w-8 h-8 rounded-full border-2 border-blue-500"
          />
          <span className="font-medium text-gray-700 hidden sm:block">Profile</span>
          <ChevronDown className="w-4 h-4 text-gray-500" />
        </div>
      </div>
    </header>
  );

  // Placeholder component for the Bar Chart based on the image
  const BarChartPlaceholder = () => (
    <div className="bg-white p-6 rounded-xl shadow-md border border-gray-100">
      <div className="flex justify-start items-center space-x-4 text-sm font-medium mb-6">
        <div className="flex items-center">
          <div className="w-3 h-3 bg-teal-300 rounded-full mr-2"></div>
          Clicks
        </div>
        <div className="flex items-center">
          <div className="w-3 h-3 bg-red-300 rounded-full mr-2"></div>
          Conversion
        </div>
        <div className="flex items-center">
          <div className="w-3 h-3 bg-blue-400 rounded-full mr-2"></div>
          Revenue
        </div>
      </div>
      <div className="relative h-96 w-full">
        {/* Y-Axis Labels */}
        <div className="absolute left-0 top-0 h-full w-8 flex flex-col justify-between text-xs text-gray-500 py-1">
          {['400', '350', '300', '250', '200', '150', '100', '50', '0'].map((label) => (
            <div key={label} className="text-right pr-2">{label}</div>
          ))}
        </div>
        {/* Chart Area */}
        <div className="ml-8 h-full w-[calc(100%-32px)] border-l border-b border-gray-200 relative">
          {/* Simulated Bar */}
          <div
            className="absolute bottom-0 left-1/2 transform -translate-x-1/2 w-1/3 bg-blue-300/80"
            style={{ height: '90%' }} // Represents the main revenue bar
          >
            {/* Simulated Conversion/Click dots */}
            <div className="absolute bottom-[20%] left-[20%] w-3 h-3 rounded-full bg-red-400 border border-white"></div>
            <div className="absolute bottom-[35%] right-[20%] w-3 h-3 rounded-full bg-teal-400 border border-white"></div>
          </div>
          {/* X-Axis Label */}
          <div className="absolute -bottom-6 left-1/2 transform -translate-x-1/2 text-xs text-gray-600">
            kingopinions
          </div>
        </div>
      </div>
    </div>
  );

  // Table Content based on the image
  const ReportsTable = ({ tabKey }) => {
    // Determine columns based on the active tab for a dynamic feel
    let columns = [];
    let data = [];

    if (tabKey === 'placement') {
      columns = ['PLACEMENT', 'CLICKS', 'CONVERSIONS', 'REVERSALS', 'REVENUE'];
      data = mockTableData.map(d => ({
        ...d,
        revenue: `$${d.revenue}`, // Format revenue
        clicks: d.clicks.toLocaleString(),
      }));
    } else {
        // For Conversion, Reversal, Postbacks, etc. when data is empty
        columns = ['PLACEMENT NAME', 'USER ID', 'TRANSACTION ID', 'OFFER NAME', 'OFFER ID', 'PAYOUT', 'CLICKED DATE', 'CONVERSION DATE', 'REVERSAL/ISO CODE', 'OS', 'IP'];
        data = [];
    }
    
    // Pagination Handlers
    const handlePrev = () => {
        if (currentPage > 1) {
            setCurrentPage(currentPage - 1);
            console.log('Pagination: Previous page requested.');
        }
    };

    const handleNext = () => {
        // Assume maximum 10 pages for demo purposes
        if (currentPage < 10) { 
            setCurrentPage(currentPage + 1);
            console.log('Pagination: Next page requested.');
        }
    };


    return (
      <div className="bg-white p-6 rounded-xl shadow-md border border-gray-100 mt-6">
        {data.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  {columns.map((col, index) => (
                    <th
                      key={index}
                      scope="col"
                      className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider"
                    >
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {data.map((item, rowIndex) => (
                  <tr key={rowIndex} className="hover:bg-blue-50/50 transition-colors">
                    {columns.map((col, colIndex) => {
                      const key = col.toLowerCase().replace(/ /g, '').replace(/[\/]/g, '').replace('id', 'Id');
                      return (
                        <td
                          key={colIndex}
                          className="px-6 py-4 whitespace-nowrap text-sm text-gray-800 font-medium"
                        >
                          {item[key] || item[key.replace('clicked', 'clickedDate')] || item[key.replace('conversion', 'conversionDate')] || '-'}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          // Empty state from images
          <div className="flex flex-col items-center justify-center p-12 text-gray-500">
            <div className="p-4 border-2 border-dashed border-gray-300 rounded-full mb-4">
              <Download className="w-8 h-8" />
            </div>
            <p className="text-lg font-medium">No conversions found</p>
          </div>
        )}

        {/* Pagination */}
        <div className="flex justify-end items-center mt-4">
          <div className="text-sm text-gray-600">
            <span 
              onClick={handlePrev} // Added functional handler
              className={`cursor-pointer transition-colors p-2 mr-1 ${currentPage === 1 ? 'text-gray-400 cursor-not-allowed' : 'text-blue-600 hover:text-blue-800'}`}
            >
              <ArrowLeft className="w-4 h-4 inline-block align-text-bottom" /> Prev
            </span>
            <span className="bg-blue-600 text-white font-bold px-3 py-1.5 rounded-lg mx-1 shadow-md">
              {currentPage}
            </span>
            <span 
              onClick={handleNext} // Added functional handler
              className={`cursor-pointer transition-colors p-2 ml-1 ${currentPage === 10 ? 'text-gray-400 cursor-not-allowed' : 'text-blue-600 hover:text-blue-800'}`}
            >
              Next <ArrowRight className="w-4 h-4 inline-block align-text-bottom" />
            </span>
          </div>
        </div>
      </div>
    );
  };

  // Main Report Content Area
  const ReportsContent = () => (
    // Increase horizontal padding on mobile now that there is no sidebar
    <div className="flex-1 p-4 sm:p-6 lg:p-8 bg-gray-50 min-h-screen"> 
      {/* Report Navigation Tabs */}
      <div className="flex space-x-1 p-1 bg-white rounded-xl shadow-md border border-gray-100 overflow-x-auto mb-6">
        {reportNavItems.map((item) => (
          <button
            key={item.key}
            onClick={() => setActiveTab(item.key)}
            className={`flex-shrink-0 px-4 py-2 text-sm font-semibold rounded-lg transition-all duration-300 ease-in-out
              ${activeTab === item.key
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/50'
                : 'text-gray-700 hover:bg-gray-100'
              }`
            }
          >
            {item.name}
          </button>
        ))}
      </div>

      {/* Conditional Content based on active tab */}
      {activeTab === 'placement' ? (
        <>
          {/* Bar Chart Section */}
          <BarChartPlaceholder />
          {/* Table Section for Placement (with mock data) */}
          <ReportsTable tabKey={activeTab} />
        </>
      ) : (
        <>
          {/* Conversion/Reversal/Postbacks Header - Now Workable */}
          <div className="flex flex-wrap items-center justify-between p-4 bg-white rounded-xl shadow-md border border-gray-100 mb-6 space-y-4 sm:space-y-0">
            <div className="flex items-center w-full sm:w-auto space-x-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search..."
                  value={searchQuery} // Bound search query
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    console.log('Search query updated:', e.target.value);
                  }}
                  className="pl-10 pr-4 py-2 border border-gray-300 rounded-xl focus:ring-blue-500 focus:border-blue-500 w-full sm:w-64"
                />
              </div>
              <button 
                onClick={() => {
                    setIsSearchByOpen(!isSearchByOpen);
                    console.log(`Search By button clicked. Is dropdown open: ${!isSearchByOpen}`);
                }}
                className="flex items-center px-4 py-2 bg-gray-100 text-gray-700 font-medium rounded-xl hover:bg-gray-200 transition-colors"
              >
                Search By <ChevronDown className={`w-4 h-4 ml-1 transition-transform ${isSearchByOpen ? 'rotate-180' : 'rotate-0'}`} />
              </button>

              {/* Date Range Display (Conditionally rendered) */}
              {currentDateRange && (
                <div className="flex items-center space-x-2 px-3 py-2 border border-gray-300 rounded-xl bg-white">
                  <span className="text-sm">{currentDateRange}</span>
                  <button 
                    onClick={() => {
                        setCurrentDateRange(null); // Clears the date range
                        console.log('Date range cleared.');
                    }}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <span className="font-bold">×</span>
                  </button>
                </div>
              )}

              <button 
                onClick={() => {
                    setIsFilterOpen(!isFilterOpen);
                    console.log(`Filter button clicked. Is modal open: ${!isFilterOpen}`);
                }}
                className="flex items-center px-4 py-2 bg-gray-100 text-gray-700 font-medium rounded-xl hover:bg-gray-200 transition-colors"
              >
                Filter <ChevronDown className={`w-4 h-4 ml-1 transition-transform ${isFilterOpen ? 'rotate-180' : 'rotate-0'}`} />
              </button>
            </div>
            <button 
              onClick={() => {
                console.log(`Exporting data for tab: ${activeTab}. Current Search Query: "${searchQuery}"`);
              }}
              className="flex items-center px-4 py-2 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition-colors shadow-lg"
            >
              Export Data <Download className="w-4 h-4 ml-2" />
            </button>
          </div>
          {/* Table Section for Conversion/Reversal/Postbacks (empty state) */}
          <ReportsTable tabKey={activeTab} />
        </>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 font-sans">
      <Header />
      <ReportsContent />

      {/* Fixed chat bubble/help icon */}
      <div className="fixed bottom-6 right-6 z-30">
        <div className="bg-black text-white p-3 rounded-full cursor-pointer shadow-xl hover:bg-gray-800 transition-colors">
          <Menu className="w-6 h-6" />
        </div>
      </div>
    </div>
  );
};

export default Reports;
