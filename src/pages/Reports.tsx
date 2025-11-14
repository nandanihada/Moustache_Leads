import React, { useState, useMemo, useEffect, useCallback } from 'react';
import PlacementRequired from '@/components/PlacementRequired';

// --- TYPE DEFINITIONS ---
interface SvgIconProps extends React.SVGProps<SVGSVGElement> {}

interface Column {
  key: keyof ReportData; // Ensure key is one of the valid data properties
  label: string;
}

interface ReportData {
  placementName: string;
  userId: string;
  transactionId: string;
  offerName: string;
  offerId: string;
  payout: string; 
  rewardValue?: string;
  clickedDate?: string;
  conversionDate?: string;
  reversalDate?: string;
  reversalReason?: string;
  isoCode: string;
  os: string;
  ip: string;
  conversionIp?: string;
  status?: string;
  postbackStatus?: string;
  postbackResponse?: string;
  createdAt?: string;
  action?: string;
  [key: string]: string | number | undefined; // Index signature for dynamic access
}

interface AggregatedReportItem {
    name: string;
    conversions: number;
    totalPayout: string;
}

interface CountryReportItem {
    code: string;
    conversions: number;
    totalPayout: string;
}


/**
 * --- ICON COMPONENTS (Inline SVGs) ---
 */

const ChevronDownIcon: React.FC<SvgIconProps> = (props) => (
  <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
);

const ArchiveIcon: React.FC<SvgIconProps> = (props) => (
  <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="5" x="2" y="3" rx="1"/><path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8"/><path d="M10 12h4"/></svg>
);

const DollarSignIcon: React.FC<SvgIconProps> = (props) => (
  <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" x2="12" y1="2" y2="22"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
);


/**
 * --- MOCK DATA GENERATION & CONFIGURATION ---
 */

const generateMockData = (count: number, type: 'conversion' | 'reversal' | 'postback'): ReportData[] => {
  const data: ReportData[] = [];
  const now = new Date();
  const dateStr = (daysAgo: number): string => {
    const d = new Date(now);
    d.setDate(now.getDate() - daysAgo);
    return d.toISOString().split('T')[0];
  };

  for (let i = 1; i <= count; i++) {
    // Type assertion is safe here as we're building the object piece by piece
    const base: ReportData = {
      placementName: `kingopinions-${i % 3 + 1}`,
      userId: `user-${1000 + i}`,
      transactionId: `txn-${Math.random().toString(36).substring(2, 10).toUpperCase()}`,
      offerName: `Offer XYZ-${i}`,
      offerId: `OID-${500 + i}`,
      payout: (1.50 + i * 0.1).toFixed(2),
      clickedDate: dateStr(i),
      conversionDate: dateStr(i - 1),
      isoCode: i % 2 === 0 ? 'US' : 'GB',
      os: i % 3 === 0 ? 'iOS' : (i % 3 === 1 ? 'Android' : 'Windows'),
      ip: `192.168.1.${i % 255}`,
    } as ReportData;

    if (type === 'reversal') {
      data.push({
        ...base,
        reversalDate: dateStr(i - 2),
        reversalReason: i % 2 === 0 ? 'Fraudulent Activity' : 'Duplicate Conversion',
        conversionIp: `203.0.113.${i % 255}`,
      });
    } else if (type === 'postback') {
      data.push({
        ...base,
        payout: base.payout, // Keep payout for consistency
        rewardValue: (0.50 + i * 0.05).toFixed(2),
        status: i % 4 === 0 ? 'Failed' : 'Success',
        postbackStatus: i % 4 === 0 ? 'failed' : 'completed',
        postbackResponse: i % 4 === 0 ? 'Timeout' : '200 OK',
        createdAt: new Date().toLocaleTimeString(),
        action: 'View Log',
      });
    } else {
      data.push(base);
    }
  }
  return data;
};

// Define Column Headers based on user request
const COLUMNS: { [key: string]: Column[] } = {
  conversion: [
    { key: 'placementName', label: 'PLACEMENT NAME' },
    { key: 'userId', label: 'USER ID' },
    { key: 'transactionId', label: 'TRANSACTION ID' },
    { key: 'offerName', label: 'OFFER NAME' },
    { key: 'offerId', label: 'OFFER ID' },
    { key: 'payout', label: 'PAYOUT' },
    { key: 'clickedDate', label: 'CLICKED DATE' },
    { key: 'conversionDate', label: 'CONVERSION DATE' },
    { key: 'isoCode', label: 'ISO CODE' },
    { key: 'os', label: 'OS' },
    { key: 'ip', label: 'IP' },
  ] as Column[],
  reversal: [
    { key: 'placementName', label: 'PLACEMENT NAME' },
    { key: 'userId', label: 'USER ID' },
    { key: 'transactionId', label: 'TRANSACTION ID' },
    { key: 'offerName', label: 'OFFER NAME' },
    { key: 'offerId', label: 'OFFER ID' },
    { key: 'payout', label: 'PAYOUT' },
    { key: 'clickedDate', label: 'CLICKED DATE' },
    { key: 'conversionDate', label: 'CONVERSION DATE' },
    { key: 'reversalDate', label: 'REVERSAL DATE' },
    { key: 'reversalReason', label: 'REVERSAL REASON' },
    { key: 'isoCode', label: 'ISO CODE' },
    { key: 'os', label: 'OS' },
    { key: 'ip', label: 'IP' },
    { key: 'conversionIp', label: 'CONVERSION IP' },
  ] as Column[],
  postback: [
    { key: 'placementName', label: 'PLACEMENT NAME' },
    { key: 'userId', label: 'USER ID' },
    { key: 'transactionId', label: 'TRANSACTION ID' },
    { key: 'status', label: 'STATUS' },
    { key: 'postbackStatus', label: 'POSTBACK STATUS' },
    { key: 'postbackResponse', label: 'POSTBACK RESPONSE' },
    { key: 'offerName', label: 'OFFER NAME' },
    { key: 'offerId', label: 'OFFER ID' },
    { key: 'rewardValue', label: 'REWARD VALUE' },
    { key: 'isoCode', label: 'ISO CODE' },
    { key: 'createdAt', label: 'CREATED AT' },
    { key: 'action', label: 'ACTION' },
  ] as Column[],
};

// Memoize data generation
const DATA: { [key: string]: ReportData[] } = {
  conversion: generateMockData(25, 'conversion'),
  reversal: generateMockData(15, 'reversal'),
  postback: generateMockData(30, 'postback'),
};


/**
 * --- UTILITY FUNCTIONS FOR AGGREGATION ---
 */

// Aggregate data by placement name
const aggregatePlacements = (data: ReportData[]): AggregatedReportItem[] => {
    const totals: { [key: string]: { name: string, conversions: number, totalPayout: number } } = data.reduce((acc, row) => {
        const name = row.placementName;
        // Payout is a string in mock data, parse it. Fallback to 0 if undefined.
        const payout = parseFloat(row.payout || '0');
        acc[name] = acc[name] || { name, conversions: 0, totalPayout: 0 };
        acc[name].conversions += 1;
        acc[name].totalPayout += payout;
        return acc;
    }, {});
    return Object.values(totals).map(item => ({
        ...item,
        totalPayout: item.totalPayout.toFixed(2)
    })).sort((a, b) => parseFloat(b.totalPayout) - parseFloat(a.totalPayout));
};

// Aggregate data by country code
const aggregateCountries = (data: ReportData[]): CountryReportItem[] => {
    const totals: { [key: string]: { code: string, conversions: number, totalPayout: number } } = data.reduce((acc, row) => {
        const code = row.isoCode;
        // Payout is a string in mock data, parse it. Fallback to 0 if undefined.
        const payout = parseFloat(row.payout || '0');
        acc[code] = acc[code] || { code, conversions: 0, totalPayout: 0 };
        acc[code].conversions += 1;
        acc[code].totalPayout += payout;
        return acc;
    }, {});
    return Object.values(totals).map(item => ({
        ...item,
        totalPayout: item.totalPayout.toFixed(2)
    })).sort((a, b) => parseFloat(b.totalPayout) - parseFloat(a.totalPayout));
};


/**
 * --- REPORT COMPONENTS FOR PLACEMENT AND COUNTRIES ---
 */

const PlacementReport: React.FC = () => {
    // We'll use the Conversion data as the base for aggregation
    const data: AggregatedReportItem[] = useMemo(() => aggregatePlacements(DATA.conversion), []);

    return (
        <div className="bg-white p-6 rounded-xl shadow-lg mt-6">
            <h2 className="text-xl font-bold text-gray-800 mb-4 border-b pb-2">Placement Performance Summary (Based on Conversions)</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {data.map((item) => (
                    <div key={item.name} className="bg-blue-50 p-4 rounded-lg shadow-md border-l-4 border-blue-600">
                        <h3 className="text-lg font-semibold text-blue-800 mb-2">{item.name}</h3>
                        <div className="flex justify-between items-center text-gray-700">
                            <span className="text-sm font-medium">Conversions:</span>
                            <span className="text-base font-bold text-gray-900">{item.conversions}</span>
                        </div>
                        <div className="flex justify-between items-center text-gray-700 mt-1">
                            <span className="text-sm font-medium">Total Payout:</span>
                            <span className="text-base font-bold text-green-600">${item.totalPayout}</span>
                        </div>
                        {/* Placeholder for a small line chart or progress bar */}
                        <div className="h-2 bg-blue-200 rounded-full mt-3">
                            <div
                                className="h-2 bg-blue-600 rounded-full"
                                style={{ width: `${(item.conversions / DATA.conversion.length) * 100}%` }}
                                title={`${((item.conversions / DATA.conversion.length) * 100).toFixed(1)}% of total conversions`}
                            ></div>
                        </div>
                    </div>
                ))}
            </div>
            {data.length === 0 && <p className="text-center py-8 text-gray-500">No placement data available for analysis.</p>}
        </div>
    );
};

const CountriesReport: React.FC = () => {
    // We'll use the Conversion data as the base for aggregation
    const data: CountryReportItem[] = useMemo(() => aggregateCountries(DATA.conversion), []);

    return (
        <div className="bg-white p-6 rounded-xl shadow-lg mt-6">
            <h2 className="text-xl font-bold text-gray-800 mb-4 border-b pb-2">Country Performance Summary (Based on Conversions)</h2>
            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Country Code</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Conversions</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Payout</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {data.map((item) => (
                            <tr key={item.code} className="hover:bg-gray-50">
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-blue-600">{item.code}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{item.conversions}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600 font-semibold">${item.totalPayout}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            {data.length === 0 && <p className="text-center py-8 text-gray-500">No country data available for analysis.</p>}
        </div>
    );
};


/**
 * --- REUSABLE DATA TABLE COMPONENT (DataTable) ---
 */

interface DataTableProps {
  columns: Column[];
  data: ReportData[];
  reportType: string;
}

const DataTable: React.FC<DataTableProps> = ({ columns, data, reportType }) => {
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [filterText, setFilterText] = useState<string>('');
  const [searchKey, setSearchKey] = useState<keyof ReportData>(columns[0].key);
  const [isDropdownOpen, setIsDropdownOpen] = useState<boolean>(false);
  const itemsPerPage = 10;

  // Effect to reset state when the report tab changes
  useEffect(() => {
    if (columns.length > 0) {
      setSearchKey(columns[0].key);
      setFilterText('');
      setCurrentPage(1);
      setIsDropdownOpen(false);
    }
  }, [columns]); // Dependency on columns ensures reset when report type changes

  // Memoized filter logic
  const filteredData: ReportData[] = useMemo(() => {
    if (!filterText || !searchKey) return data;
    const lowerCaseFilter = filterText.toLowerCase();

    return data.filter(row => {
      // Accessing property using index signature for dynamic access
      const value = String(row[searchKey as keyof ReportData] || '').toLowerCase();
      return value.includes(lowerCaseFilter);
    });
  }, [data, filterText, searchKey]);

  const totalPages = Math.ceil(filteredData.length / itemsPerPage);
  const currentData: ReportData[] = filteredData.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const handlePrev = useCallback(() => setCurrentPage((prev) => Math.max(1, prev - 1)), []);
  const handleNext = useCallback(() => setCurrentPage((prev) => Math.min(totalPages, prev + 1)), [totalPages]);
  
  /**
   * Helper function to convert JSON data to CSV format string.
   */
  const convertToCSV = (data: ReportData[], cols: Column[]): string => {
    const headers = cols.map(col => `"${col.label}"`).join(',');
    
    const rows = data.map(row => {
      return cols.map(col => {
        // Use col.key to dynamically access the property
        const value = row[col.key] !== undefined && row[col.key] !== null ? String(row[col.key]) : '';
        
        // Clean up payout/reward values for pure data export
        let cleanedValue = value;
        if (col.key === 'payout' || col.key === 'rewardValue') {
          cleanedValue = cleanedValue.replace('$', '');
        }
        
        // Escape quotes and wrap in quotes to handle commas within data fields
        return `"${cleanedValue.replace(/"/g, '""')}"`;
      }).join(',');
    }).join('\n');
    
    return headers + '\n' + rows;
  };

  /**
   * Function to trigger the data download.
   */
  const exportData = useCallback(() => {
    const messageBox = document.getElementById('message-box');
    if (!messageBox) return;

    if (filteredData.length === 0) {
        messageBox.textContent = `No data to export. Filtered results are empty.`;
        // Temporarily change color for error/warning
        messageBox.classList.replace('bg-green-500', 'bg-yellow-500');
        setTimeout(() => {
            messageBox.textContent = '';
            messageBox.classList.replace('bg-yellow-500', 'bg-green-500');
        }, 3000);
        return;
    }

    const csvContent = convertToCSV(filteredData, columns);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.setAttribute('hidden', '');
    a.setAttribute('href', url);
    a.setAttribute('download', `${reportType.toLowerCase().replace(/\s/g, '_')}_report.csv`);
    
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    // Show confirmation message
    messageBox.textContent = `Export of ${reportType} data successful!`;
    setTimeout(() => messageBox.textContent = '', 3000);
  }, [filteredData, columns, reportType]);

  // Content to display when no data is found
  const noDataContent = (
    <div className="text-center py-16 text-gray-500">
      <ArchiveIcon className="w-16 h-16 mx-auto mb-4 text-gray-300" />
      <p className="text-xl font-semibold">
        {filterText
          ? `No results found for "${filterText}" in ${columns.find(c => c.key === searchKey)?.label}`
          : `No ${reportType} found`}
      </p>
      <p>Check your filters or the selected date range.</p>
    </div>
  );

  return (
    <div className="bg-white p-6 rounded-xl shadow-lg mt-6">
      {/* Utility Bar (Search, Date, Filter, Export) */}
      <div className="flex flex-col md:flex-row gap-4 items-start md:items-center mb-6">
        <input
          type="text"
          placeholder={`Search by ${columns.find(c => c.key === searchKey)?.label || '...'}`}
          className="p-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 w-full md:w-56"
          value={filterText}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
            setFilterText(e.target.value);
            setCurrentPage(1); // Reset page on filter change
          }}
        />
        
        {/* Search By Dropdown */}
        <div className="relative z-30">
          <button
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            className="flex items-center p-2 rounded-lg border border-gray-300 bg-white hover:bg-gray-50 text-sm w-full md:w-auto"
          >
            Search By: {columns.find(c => c.key === searchKey)?.label} <ChevronDownIcon className={`w-4 h-4 ml-1 transition-transform ${isDropdownOpen ? 'rotate-180' : 'rotate-0'}`} />
          </button>
          {isDropdownOpen && (
            <div className="absolute top-full mt-1 w-48 bg-white border border-gray-200 rounded-lg shadow-xl max-h-60 overflow-y-auto">
              {columns.map((col) => (
                <div
                  key={col.key as string}
                  className={`px-4 py-2 text-sm text-gray-700 cursor-pointer ${col.key === searchKey ? 'bg-blue-100 font-semibold' : 'hover:bg-gray-50'}`}
                  onClick={() => {
                    setSearchKey(col.key);
                    setIsDropdownOpen(false);
                    setCurrentPage(1); // Reset page on key change
                  }}
                >
                  {col.label}
                </div>
              ))}
            </div>
          )}
        </div>
        
        {/* Date and Filter (Keeping mock for 'Filter' button for now) */}
        <div className="flex items-center space-x-2 w-full md:w-auto">
          <input
            type="text"
            placeholder="2025-09-23 ~ 2025-09-x"
            className="p-2 border border-gray-300 rounded-lg text-sm w-48 text-center"
            readOnly
          />
          <button 
            className="flex items-center p-2 rounded-lg border border-gray-300 bg-white hover:bg-gray-50 text-sm"
            onClick={() => {
              const messageBox = document.getElementById('message-box');
              if (messageBox) {
                messageBox.textContent = `Filter button clicked! Implement advanced filter logic here.`;
                setTimeout(() => messageBox.textContent = '', 3000);
              }
            }}
          >
            Filter <ChevronDownIcon className="w-4 h-4 ml-1" />
          </button>
        </div>

        <button
          onClick={exportData}
          className="ml-auto px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors shadow-md"
        >
          Export Data
        </button>
      </div>

      {filteredData.length === 0 ? (
        noDataContent
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  {columns.map((col) => (
                    <th
                      key={col.key as string}
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap"
                    >
                      {col.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {currentData.map((row, rowIndex) => (
                  <tr key={rowIndex} className="hover:bg-blue-50">
                    {columns.map((col) => (
                      <td key={col.key as string} className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                        {/* Access row property using the key defined in the column */}
                        {col.key === 'payout' || col.key === 'rewardValue'
                          ? `$${row[col.key] || '0.00'}` // Ensure fallback for payout/reward value
                          : row[col.key]}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex justify-between items-center mt-6">
            <p className="text-sm text-gray-600">
                Showing {((currentPage - 1) * itemsPerPage) + 1} - {Math.min(currentPage * itemsPerPage, filteredData.length)} of {filteredData.length} records
            </p>
            <div className="flex items-center space-x-2">
                <button
                onClick={handlePrev}
                disabled={currentPage === 1}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-100 disabled:opacity-50 transition-colors"
                >
                ← Prev
                </button>
                <span className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg shadow-md">
                {currentPage} / {totalPages}
                </span>
                <button
                onClick={handleNext}
                disabled={currentPage === totalPages}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-100 disabled:opacity-50 transition-colors"
                >
                Next →
                </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};


/**
 * --- REPORTS HEADER (ReportsHeader) ---
 */

interface ReportsHeaderProps {
    activeTab: string;
    setActiveTab: (tab: string) => void;
}

const ReportsHeader: React.FC<ReportsHeaderProps> = ({ activeTab, setActiveTab }) => {
  const tabs: string[] = ['Conversion', 'Placement', 'Countries', 'Reversal', 'Postbacks'];

  return (
    <div className="bg-white p-6 rounded-xl shadow-lg">
      <div className="flex items-center mb-4">
        <DollarSignIcon className="w-6 h-6 text-blue-600 mr-2" />
        <div className="text-lg font-semibold text-gray-700">
          $ 0 this month
          <p className="text-sm font-normal text-gray-500">Next Payment on: Sun Sep 07 2025</p>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex overflow-x-auto border-b border-gray-200">
        {tabs.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-shrink-0 px-4 py-3 rounded-t-lg transition-all font-semibold text-sm ${
              activeTab === tab
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>
    </div>
  );
};

/**
 * --- REPORT VIEW RENDERER (ReportView) ---
 */

interface ReportViewProps {
    activeTab: string;
}

const ReportView: React.FC<ReportViewProps> = ({ activeTab }) => {
  switch (activeTab) {
    case 'Conversion':
      return <DataTable columns={COLUMNS.conversion} data={DATA.conversion} reportType="Conversions" />;
    case 'Reversal':
      return <DataTable columns={COLUMNS.reversal} data={DATA.reversal} reportType="Reversals" />;
    case 'Postbacks':
      // Postback data uses rewardValue, but the data structure should be compatible
      return <DataTable columns={COLUMNS.postback} data={DATA.postback} reportType="Postbacks" />;
    case 'Placement':
      return <PlacementReport />;
    case 'Countries':
      return <CountriesReport />;
    default:
      return <div className="p-8 text-center text-gray-500">Select a report tab.</div>;
  }
};


/**
 * --- MAIN APP COMPONENT (Reports) ---
 */

const ReportsContent: React.FC = () => {
  const [activeTab, setActiveTab] = useState<string>('Conversion');

  return (
    <div className="min-h-screen bg-gray-50 font-sans antialiased p-4 sm:p-8">
        {/* Custom Message Box for Export/Alerts */}
        {/* Using style to default to invisible when empty or opacity 0 */}
        <div 
          id="message-box" 
          className="fixed top-4 right-4 bg-green-500 text-white p-3 rounded-xl shadow-xl z-50 transition-opacity duration-300 opacity-0 empty:opacity-0" 
          style={{ minWidth: '200px' }}
        ></div>

        <h1 className="text-3xl font-bold text-gray-800 mb-6">Reports</h1>
        <ReportsHeader activeTab={activeTab} setActiveTab={setActiveTab} />
        <ReportView activeTab={activeTab} />
    </div>
  );
};

const Reports: React.FC = () => {
  return (
    <PlacementRequired>
      <ReportsContent />
    </PlacementRequired>
  );
};

export default Reports; // Changed export to Reports
