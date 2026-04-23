import React, { useState, useEffect } from 'react';
import { adminNotesApi } from '../services/adminNotesApi';
import { toast } from '@/hooks/use-toast';

const AdminNotes: React.FC = () => {
  const [notes, setNotes] = useState<any[]>([]);
  const [counts, setCounts] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [activeFilter, setActiveFilter] = useState('all');
  
  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [pageFilter, setPageFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [sortBy, setSortBy] = useState('newest');
  
  // Form state
  const [formData, setFormData] = useState({
    title: '',
    type: '',
    priority: 'medium',
    page: 'Search Logs',
    assignee: '',
    body: ''
  });

  useEffect(() => {
    fetchNotes();
  }, [searchQuery, pageFilter, typeFilter, statusFilter, priorityFilter, sortBy]);

  const fetchNotes = async () => {
    try {
      setLoading(true);
      const response = await adminNotesApi.getNotes({
        search: searchQuery,
        page: pageFilter,
        type: typeFilter,
        status: statusFilter,
        priority: priorityFilter,
        sort: sortBy
      });
      console.log('[AdminNotes] API Response:', response);
      console.log('[AdminNotes] Notes received:', response.notes);
      console.log('[AdminNotes] Counts received:', response.counts);
      setNotes(response.notes || []);
      setCounts(response.counts || {});
    } catch (error: any) {
      console.error('[AdminNotes] Error fetching notes:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to fetch notes',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAddNote = async () => {
    if (!formData.title || !formData.type) {
      toast({
        title: 'Error',
        description: 'Title and type are required',
        variant: 'destructive',
      });
      return;
    }

    try {
      await adminNotesApi.createNote(formData);
      toast({
        title: 'Success',
        description: 'Note added successfully',
      });
      setShowAddForm(false);
      resetForm();
      fetchNotes();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to add note',
        variant: 'destructive',
      });
    }
  };

  const handleDeleteNote = async (noteId: string) => {
    if (!window.confirm('Delete this note?')) return;

    try {
      await adminNotesApi.deleteNote(noteId);
      toast({
        title: 'Success',
        description: 'Note deleted',
      });
      fetchNotes();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete note',
        variant: 'destructive',
      });
    }
  };

  const handleStatusChange = async (noteId: string, currentStatus: string) => {
    const statusCycle: any = {
      'pending': 'in-progress',
      'in-progress': 'completed',
      'completed': 'pending'
    };
    const newStatus = statusCycle[currentStatus] || 'pending';

    try {
      await adminNotesApi.updateNoteStatus(noteId, newStatus);
      fetchNotes();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update status',
        variant: 'destructive',
      });
    }
  };

  const handleMarkDone = async (noteId: string) => {
    try {
      await adminNotesApi.updateNoteStatus(noteId, 'completed');
      toast({
        title: 'Success',
        description: 'Marked as completed',
      });
      fetchNotes();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to mark as done',
        variant: 'destructive',
      });
    }
  };

  const resetForm = () => {
    setFormData({
      title: '',
      type: '',
      priority: 'medium',
      page: 'Search Logs',
      assignee: '',
      body: ''
    });
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = Math.floor((now.getTime() - date.getTime()) / 1000);
    
    if (diff < 60) return 'just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    
    return date.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getTypeColor = (type: string) => {
    const colors: any = {
      bug: 'bg-red-100 text-red-800 border-l-red-500',
      issue: 'bg-yellow-100 text-yellow-800 border-l-yellow-500',
      idea: 'bg-blue-100 text-blue-800 border-l-blue-500',
      task: 'bg-pink-100 text-pink-800 border-l-pink-500',
      general: 'bg-gray-100 text-gray-800 border-l-gray-500'
    };
    return colors[type] || colors.general;
  };

  const getPriorityColor = (priority: string) => {
    const colors: any = {
      high: 'bg-red-100 text-red-700',
      medium: 'bg-yellow-100 text-yellow-700',
      low: 'bg-green-100 text-green-700'
    };
    return colors[priority] || colors.medium;
  };

  const getStatusColor = (status: string) => {
    const colors: any = {
      pending: 'bg-yellow-100 text-yellow-800 border-yellow-300',
      'in-progress': 'bg-blue-100 text-blue-800 border-blue-300',
      completed: 'bg-green-100 text-green-800 border-green-300'
    };
    return colors[status] || colors.pending;
  };

  const getPageIcon = (page: string) => {
    const icons: any = {
      'Search Logs': '🔍',
      'Reports': '📊',
      'Click Tracking': '🖱️',
      'Payments': '💳',
      'Support': '💬',
      'Offerwall Analytics': '📈',
      'Fraud & Security': '🔒',
      'Referrals': '👥'
    };
    return icons[page] || '📌';
  };

  const filteredNotes = notes;

  console.log('[AdminNotes] Total notes:', notes.length);
  console.log('[AdminNotes] Filtered notes:', filteredNotes.length);
  console.log('[AdminNotes] Active filter:', activeFilter);

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Admin Notes</h1>
          <p className="text-sm text-gray-600 mt-1">
            All suggestion notes across every page — issues, ideas, bugs, tasks
          </p>
        </div>
        <button
          onClick={() => {/* Export functionality */}}
          className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm hover:bg-gray-50"
        >
          📤 Export notes
        </button>
      </div>

      {/* Summary Chips */}
      <div className="flex gap-2 flex-wrap mb-5">
        <button
          onClick={() => {
            setActiveFilter('all');
            setTypeFilter('all');
            setStatusFilter('all');
          }}
          className={`px-4 py-2 rounded-lg text-sm font-medium border transition-all ${
            activeFilter === 'all'
              ? 'bg-indigo-50 border-indigo-500 text-indigo-700'
              : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
          }`}
        >
          <span className="inline-block w-2 h-2 rounded-full bg-gray-600 mr-2"></span>
          <span className="font-bold">{counts.total || 0}</span> Total
        </button>
        <button
          onClick={() => {
            setActiveFilter('bug');
            setTypeFilter('bug');
            setStatusFilter('all');
          }}
          className={`px-4 py-2 rounded-lg text-sm font-medium border transition-all ${
            activeFilter === 'bug'
              ? 'bg-indigo-50 border-indigo-500 text-indigo-700'
              : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
          }`}
        >
          <span className="inline-block w-2 h-2 rounded-full bg-red-500 mr-2"></span>
          <span className="font-bold">{counts.by_type?.bug || 0}</span> Bugs
        </button>
        <button
          onClick={() => {
            setActiveFilter('issue');
            setTypeFilter('issue');
            setStatusFilter('all');
          }}
          className={`px-4 py-2 rounded-lg text-sm font-medium border transition-all ${
            activeFilter === 'issue'
              ? 'bg-indigo-50 border-indigo-500 text-indigo-700'
              : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
          }`}
        >
          <span className="inline-block w-2 h-2 rounded-full bg-yellow-500 mr-2"></span>
          <span className="font-bold">{counts.by_type?.issue || 0}</span> Issues
        </button>
        <button
          onClick={() => {
            setActiveFilter('idea');
            setTypeFilter('idea');
            setStatusFilter('all');
          }}
          className={`px-4 py-2 rounded-lg text-sm font-medium border transition-all ${
            activeFilter === 'idea'
              ? 'bg-indigo-50 border-indigo-500 text-indigo-700'
              : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
          }`}
        >
          <span className="inline-block w-2 h-2 rounded-full bg-blue-500 mr-2"></span>
          <span className="font-bold">{counts.by_type?.idea || 0}</span> Ideas
        </button>
        <button
          onClick={() => {
            setActiveFilter('pending');
            setTypeFilter('all');
            setStatusFilter('pending');
          }}
          className={`px-4 py-2 rounded-lg text-sm font-medium border transition-all ${
            activeFilter === 'pending'
              ? 'bg-indigo-50 border-indigo-500 text-indigo-700'
              : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
          }`}
        >
          <span className="inline-block w-2 h-2 rounded-full bg-yellow-500 mr-2"></span>
          <span className="font-bold">{counts.by_status?.pending || 0}</span> Pending
        </button>
        <button
          onClick={() => {
            setActiveFilter('completed');
            setTypeFilter('all');
            setStatusFilter('completed');
          }}
          className={`px-4 py-2 rounded-lg text-sm font-medium border transition-all ${
            activeFilter === 'completed'
              ? 'bg-indigo-50 border-indigo-500 text-indigo-700'
              : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
          }`}
        >
          <span className="inline-block w-2 h-2 rounded-full bg-green-500 mr-2"></span>
          <span className="font-bold">{counts.by_status?.completed || 0}</span> Completed
        </button>
      </div>

      {/* Controls */}
      <div className="flex gap-2 flex-wrap mb-5">
        <input
          type="text"
          placeholder="Search notes..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="flex-1 min-w-[200px] px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        <select
          value={pageFilter}
          onChange={(e) => setPageFilter(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="all">All pages</option>
          <option value="Search Logs">Search Logs</option>
          <option value="Reports">Reports</option>
          <option value="Click Tracking">Click Tracking</option>
          <option value="Payments">Payments</option>
          <option value="Support">Support</option>
          <option value="Offerwall Analytics">Offerwall Analytics</option>
        </select>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="all">All types</option>
          <option value="bug">Bug</option>
          <option value="issue">Issue</option>
          <option value="idea">Idea</option>
          <option value="task">Task</option>
          <option value="general">General</option>
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="all">All statuses</option>
          <option value="pending">Pending</option>
          <option value="in-progress">In Progress</option>
          <option value="completed">Completed</option>
        </select>
        <select
          value={priorityFilter}
          onChange={(e) => setPriorityFilter(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="all">All priorities</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
          <option value="priority">By priority</option>
          <option value="status">By status</option>
        </select>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700"
        >
          + Add Note
        </button>
      </div>

      {/* Add Note Form */}
      {showAddForm && (
        <div className="bg-white border-2 border-dashed border-indigo-500 rounded-xl p-5 mb-5">
          <div className="font-bold text-base mb-4">✏️ New Suggestion Note</div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
            <input
              type="text"
              placeholder="Note title / subject *"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              maxLength={100}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <select
              value={formData.type}
              onChange={(e) => setFormData({ ...formData, type: e.target.value })}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">Type *</option>
              <option value="bug">🐛 Bug</option>
              <option value="issue">⚠️ Issue</option>
              <option value="idea">💡 Idea</option>
              <option value="task">✅ Task</option>
              <option value="general">📌 General</option>
            </select>
            <select
              value={formData.priority}
              onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="medium">🟡 Medium</option>
              <option value="high">🔴 High</option>
              <option value="low">🟢 Low</option>
            </select>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
            <select
              value={formData.page}
              onChange={(e) => setFormData({ ...formData, page: e.target.value })}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="Search Logs">Search Logs</option>
              <option value="Reports">Reports</option>
              <option value="Click Tracking">Click Tracking</option>
              <option value="Payments">Payments</option>
              <option value="Support">Support</option>
              <option value="Offerwall Analytics">Offerwall Analytics</option>
              <option value="Fraud & Security">Fraud & Security</option>
              <option value="Referrals">Referrals</option>
              <option value="Other">Other</option>
            </select>
            <input
              type="text"
              placeholder="Assign to (optional)"
              value={formData.assignee}
              onChange={(e) => setFormData({ ...formData, assignee: e.target.value })}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <textarea
            placeholder="Describe the issue / idea / task in detail..."
            value={formData.body}
            onChange={(e) => setFormData({ ...formData, body: e.target.value })}
            maxLength={500}
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
          />
          <div className="text-xs text-gray-500 text-right mb-3">{formData.body.length}/500</div>
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => {
                setShowAddForm(false);
                resetForm();
              }}
              className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleAddNote}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700"
            >
              💾 Save Note
            </button>
          </div>
        </div>
      )}

      {/* Notes List */}
      {loading ? (
        <div className="text-center py-12 text-gray-500">Loading notes...</div>
      ) : filteredNotes.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-4xl mb-3">🗒️</div>
          <p className="text-gray-500">No notes match your filters.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredNotes.map((note) => (
            <div
              key={note._id}
              className={`bg-white border rounded-xl p-4 hover:shadow-lg transition-shadow border-l-4 ${getTypeColor(note.type)}`}
            >
              <div className="flex items-start gap-3 mb-2">
                {/* Checkbox for completion */}
                <input
                  type="checkbox"
                  checked={note.status === 'completed'}
                  onChange={() => {
                    if (note.status === 'completed') {
                      handleStatusChange(note._id, 'completed'); // Cycle back to pending
                    } else {
                      handleMarkDone(note._id); // Mark as completed
                    }
                  }}
                  className="mt-1 w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500 cursor-pointer"
                  title={note.status === 'completed' ? 'Mark as pending' : 'Mark as completed'}
                />
                <span className={`px-2 py-1 rounded text-xs font-bold uppercase ${getTypeColor(note.type)}`}>
                  {note.type}
                </span>
                <span className="px-2 py-1 rounded text-xs font-medium bg-purple-100 text-purple-700 cursor-pointer">
                  {getPageIcon(note.page)} {note.page}
                </span>
                <div className={`flex-1 font-semibold text-sm ${note.status === 'completed' ? 'line-through text-gray-500' : ''}`}>
                  {note.title}
                </div>
                <span className={`px-2 py-1 rounded text-xs font-bold ${getPriorityColor(note.priority)}`}>
                  {note.priority === 'high' && '🔴'} {note.priority === 'medium' && '🟡'} {note.priority === 'low' && '🟢'} {note.priority}
                </span>
              </div>
              {note.body && (
                <div className={`text-sm mb-3 leading-relaxed ml-7 ${note.status === 'completed' ? 'text-gray-400 line-through' : 'text-gray-600'}`}>
                  {note.body}
                </div>
              )}
              <div className="flex items-center gap-3 flex-wrap ml-7">
                <span className="text-xs text-gray-500">
                  🕐 {formatTime(note.created_at)} {note.edited && '· (edited)'}
                </span>
                {note.assignee && (
                  <span className="text-xs text-gray-500">👤 {note.assignee}</span>
                )}
                <button
                  onClick={() => handleStatusChange(note._id, note.status)}
                  className={`px-2 py-1 rounded text-xs font-semibold border cursor-pointer ${getStatusColor(note.status)}`}
                >
                  {note.status === 'pending' && '⏳ Pending'}
                  {note.status === 'in-progress' && '🔵 In Progress'}
                  {note.status === 'completed' && '✅ Completed'}
                </button>
                <div className="ml-auto flex gap-2">
                  <button
                    onClick={() => handleDeleteNote(note._id)}
                    className="px-2 py-1 bg-white border border-gray-300 rounded text-xs hover:bg-red-50 hover:text-red-600 hover:border-red-600"
                    title="Delete"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AdminNotes;
