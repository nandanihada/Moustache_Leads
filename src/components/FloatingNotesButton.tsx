import React, { useState, useEffect } from 'react';
import { adminNotesApi } from '../services/adminNotesApi';
import { toast } from '@/hooks/use-toast';
import { useLocation, useNavigate } from 'react-router-dom';

interface QuickAddModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentPage: string;
  onNoteAdded: () => void;
}

const QuickAddModal: React.FC<QuickAddModalProps> = ({ isOpen, onClose, currentPage, onNoteAdded }) => {
  // Get all available pages for dropdown
  const availablePages = [
    'Overview', 'Users', 'Advertisers', 'Subadmin Management', 'Offer Access Requests',
    'Placement Approval', 'Offers', 'Offers New', 'Public Smart Link', 'Smart Links',
    'Offer Analytics', 'Missing Offers', 'Offer Insights', 'Email Activity',
    'Promo Codes', 'Promo Analytics V2', 'Gift Cards', 'Reports', 'Offerwall Analytics',
    'Search Logs', 'Reactivation', 'Network Analytics', 'Vertical Analytics',
    'Geo Analytics', 'Status Analytics', 'Fraud Management', 'Activity Logs',
    'Login Logs', 'Active Users', 'Partners', 'Postback', 'Test Postback',
    'API Stats', 'User Polls', 'Support', 'Referrals', 'Payments', 'Admin Notes',
    'Click Tracking'
  ];

  const [formData, setFormData] = useState({
    title: '',
    type: '',
    priority: 'medium',
    page: currentPage,
    assignee: '',
    body: ''
  });

  // Update page when modal opens or currentPage changes
  useEffect(() => {
    if (isOpen) {
      setFormData(prev => ({
        ...prev,
        page: currentPage
      }));
    }
  }, [isOpen, currentPage]);

  const handleSubmit = async () => {
    if (!formData.title || !formData.type) {
      toast({
        title: 'Error',
        description: 'Title and type are required',
        variant: 'destructive',
      });
      return;
    }

    try {
      await adminNotesApi.createNote({
        ...formData,
        page: formData.page || currentPage
      });
      console.log('[FloatingNotesButton] Note created successfully');
      toast({
        title: 'Success',
        description: 'Note added successfully',
      });
      onClose();
      resetForm();
      onNoteAdded();
    } catch (error: any) {
      console.error('[FloatingNotesButton] Error creating note:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to add note',
        variant: 'destructive',
      });
    }
  };

  const resetForm = () => {
    setFormData({
      title: '',
      type: '',
      priority: 'medium',
      page: currentPage,
      assignee: '',
      body: ''
    });
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-35 backdrop-blur-sm z-[300] flex items-center justify-center"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white rounded-2xl p-7 w-[520px] max-w-[calc(100vw-40px)] shadow-2xl relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-7 h-7 bg-gray-100 border border-gray-300 rounded-md flex items-center justify-center text-gray-600 hover:bg-red-50 hover:text-red-600 text-sm"
        >
          ✕
        </button>

        <div className="text-lg font-bold mb-1">📝 Add Suggestion Note</div>
        <div className="text-xs text-gray-600 mb-5">
          Capture issues, ideas, or tasks from this page for later review
        </div>

        <div className="inline-flex items-center gap-2 px-3 py-1 bg-purple-100 text-purple-700 rounded-md text-xs font-semibold mb-4">
          📍 Currently on: <strong>{currentPage}</strong>
        </div>

        <div className="mb-4">
          <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">
            Page *
          </label>
          <select
            value={formData.page}
            onChange={(e) => setFormData({ ...formData, page: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            {availablePages.map((page) => (
              <option key={page} value={page}>
                {page}
              </option>
            ))}
          </select>
        </div>

        <div className="mb-4">
          <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">
            Note Title / Subject *
          </label>
          <input
            type="text"
            placeholder="e.g. Zero-results not sending email alert"
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            maxLength={100}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div className="grid grid-cols-3 gap-3 mb-4">
          <div>
            <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">
              Type *
            </label>
            <select
              value={formData.type}
              onChange={(e) => setFormData({ ...formData, type: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">Select type</option>
              <option value="bug">🐛 Bug</option>
              <option value="issue">⚠️ Issue</option>
              <option value="idea">💡 Idea</option>
              <option value="task">✅ Task</option>
              <option value="general">📌 General</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">
              Priority
            </label>
            <select
              value={formData.priority}
              onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="medium">🟡 Medium</option>
              <option value="high">🔴 High</option>
              <option value="low">🟢 Low</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">
              Assign To
            </label>
            <input
              type="text"
              placeholder="Dev / admin name"
              value={formData.assignee}
              onChange={(e) => setFormData({ ...formData, assignee: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>

        <div className="mb-2">
          <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">
            Description
          </label>
          <textarea
            placeholder="Describe in detail what you noticed or want to suggest..."
            value={formData.body}
            onChange={(e) => setFormData({ ...formData, body: e.target.value })}
            maxLength={500}
            rows={4}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
          />
          <div className="text-xs text-gray-500 text-right mt-1">{formData.body.length}/500</div>
        </div>

        <div className="flex gap-2 justify-end mt-4">
          <button
            onClick={() => {
              onClose();
              resetForm();
            }}
            className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700"
          >
            💾 Save Note
          </button>
        </div>
      </div>
    </div>
  );
};

const FloatingNotesButton: React.FC = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [noteCount, setNoteCount] = useState(0);
  const location = useLocation();
  const navigate = useNavigate();

  const pageLabels: { [key: string]: string } = {
    '/admin': 'Overview',
    '/admin/users': 'Users',
    '/admin/advertisers': 'Advertisers',
    '/admin/subadmin-management': 'Subadmin Management',
    '/admin/offer-access-requests': 'Offer Access Requests',
    '/admin/placement-approval': 'Placement Approval',
    '/admin/offers': 'Offers',
    '/admin/offers-new': 'Offers New',
    '/admin/offers-v3': 'Public Smart Link',
    '/admin/smart-links': 'Smart Links',
    '/admin/offer-analytics': 'Offer Analytics',
    '/admin/missing-offers': 'Missing Offers',
    '/admin/offer-insights': 'Offer Insights',
    '/admin/email-activity': 'Email Activity',
    '/admin/promo-codes': 'Promo Codes',
    '/admin/promo-analytics-v2': 'Promo Analytics V2',
    '/admin/gift-cards': 'Gift Cards',
    '/admin/tracking-reports': 'Reports',
    '/admin/offerwall-analytics': 'Offerwall Analytics',
    '/admin/search-logs': 'Search Logs',
    '/admin/reactivation': 'Reactivation',
    '/admin/network-analytics': 'Network Analytics',
    '/admin/vertical-analytics': 'Vertical Analytics',
    '/admin/geo-analytics': 'Geo Analytics',
    '/admin/status-analytics': 'Status Analytics',
    '/admin/fraud-management': 'Fraud Management',
    '/admin/activity-logs': 'Activity Logs',
    '/admin/login-logs': 'Login Logs',
    '/admin/active-users': 'Active Users',
    '/admin/partners': 'Partners',
    '/admin/postback': 'Postback',
    '/admin/test-postback': 'Test Postback',
    '/admin/api-stats': 'API Stats',
    '/admin/polls': 'User Polls',
    '/admin/support-inbox': 'Support',
    '/admin/referrals': 'Referrals',
    '/admin/payments': 'Payments',
    '/admin/notes': 'Admin Notes',
    '/admin/click-tracking': 'Click Tracking'
  };

  const currentPage = pageLabels[location.pathname] || 'Admin Panel';

  useEffect(() => {
    fetchCounts();
  }, []);

  const fetchCounts = async () => {
    try {
      const response = await adminNotesApi.getCounts();
      setNoteCount(response.counts?.total || 0);
    } catch (error) {
      console.error('Failed to fetch note counts:', error);
      // Set to 0 on error instead of breaking
      setNoteCount(0);
    }
  };

  const handleNavigateToNotes = () => {
    navigate('/admin/notes');
  };

  return (
    <>
      <button
        onClick={() => setIsModalOpen(true)}
        className="fixed bottom-7 right-7 z-[200] bg-indigo-600 text-white rounded-full px-5 py-3 text-sm font-semibold shadow-lg hover:bg-indigo-700 hover:-translate-y-0.5 transition-all flex items-center gap-2"
        style={{ boxShadow: '0 4px 20px rgba(99,102,241,0.4)' }}
      >
        📝 Admin Notes
      </button>

      <QuickAddModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        currentPage={currentPage}
        onNoteAdded={fetchCounts}
      />
    </>
  );
};

export default FloatingNotesButton;
