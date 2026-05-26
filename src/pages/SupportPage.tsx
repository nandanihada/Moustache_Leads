import React, { useEffect, useState, useRef } from 'react';
import { MessageCircle, Send, Plus, RefreshCw, Clock, CheckCircle2, ArrowLeft, Image, X, Star, Award, UploadCloud, Gift, ArrowUpRight, ThumbsUp, Sparkles } from 'lucide-react';
import { supportApi, SupportMessage } from '@/services/supportApi';
import { getApiBaseUrl } from '@/services/apiConfig';
import { getAuthToken } from '@/utils/cookies';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { useImagePaste } from '@/hooks/useImagePaste';

const fmt = (iso: string) =>
  new Date(iso).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });

const SupportPage: React.FC = () => {
  const { user } = useAuth();
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<SupportMessage | null>(null);
  const [replyText, setReplyText] = useState('');
  const [replying, setReplying] = useState(false);
  const [showCompose, setShowCompose] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const saveDraftTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Review & Rewards States
  const [activeTab, setActiveTab] = useState<'inbox' | 'review'>('inbox');
  const [reviewUrl, setReviewUrl] = useState('');
  const [reviewSubmission, setReviewSubmission] = useState<any>(null);
  const [uploadingProof, setUploadingProof] = useState(false);
  const [selectedProofFile, setSelectedProofFile] = useState<File | null>(null);
  const [proofPreviewUrl, setProofPreviewUrl] = useState<string>('');

  const fetchReviewUrl = async () => {
    try {
      const res = await fetch(`${getApiBaseUrl()}/api/platform-settings/review-us`);
      const data = await res.json();
      if (data.url) {
        setReviewUrl(data.url);
      }
    } catch (err) {
      console.error('Failed to fetch review url', err);
    }
  };

  const fetchReviewSubmission = async () => {
    try {
      const token = getAuthToken();
      if (!token) return;
      const res = await fetch(`${getApiBaseUrl()}/api/user/review-submissions`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      setReviewSubmission(data.submission || null);
    } catch (err) {
      console.error('Failed to fetch review submission', err);
    }
  };

  const handleReviewFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedProofFile(file);
      const url = URL.createObjectURL(file);
      setProofPreviewUrl(url);
    }
  };

  const handleUploadReviewProof = async () => {
    if (!selectedProofFile) return;

    setUploadingProof(true);
    try {
      const token = getAuthToken();
      // 1. Upload file
      const formData = new FormData();
      formData.append('file', selectedProofFile);
      
      const uploadRes = await fetch(`${getApiBaseUrl()}/api/files/upload`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData
      });
      const uploadData = await uploadRes.json();
      if (!uploadRes.ok || uploadData.error) throw new Error(uploadData.error || 'Upload failed');
      
      const fileUrl = uploadData.access_url;

      // 2. Submit review proof
      const submitRes = await fetch(`${getApiBaseUrl()}/api/user/review-submissions`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify({ proof_image_url: fileUrl })
      });
      const submitData = await submitRes.json();
      if (!submitRes.ok || submitData.error) throw new Error(submitData.error || 'Submission failed');

      toast.success('Review proof submitted successfully! Waiting for admin approval.');
      setSelectedProofFile(null);
      setProofPreviewUrl('');
      fetchReviewSubmission(); // Refresh status
    } catch (err: any) {
      toast.error(err.message || 'Failed to submit review proof');
    } finally {
      setUploadingProof(false);
    }
  };

  const handleReviewButtonClick = () => {
    // Open review URL
    window.open(reviewUrl || 'https://trustpilot.com', '_blank');

    // Track button click in backend
    const token = getAuthToken();
    if (token) {
      fetch(`${getApiBaseUrl()}/api/user/review-button-click`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      }).catch(() => {});
    }
  };

  useEffect(() => {
    fetchReviewUrl();
    fetchReviewSubmission();
  }, []);

  // Sync/load drafts from local storage or backend
  useEffect(() => {
    if (messages.length === 0) return;
    const newDrafts: Record<string, string> = { ...drafts };
    let updated = false;

    messages.forEach(msg => {
      const storageKey = `pub_draft_${msg._id}`;
      const localVal = localStorage.getItem(storageKey);
      if (localVal) {
        if (newDrafts[msg._id] !== localVal) {
          newDrafts[msg._id] = localVal;
          updated = true;
        }
      } else if (msg.user_draft) {
        localStorage.setItem(storageKey, msg.user_draft);
        newDrafts[msg._id] = msg.user_draft;
        updated = true;
      }
    });

    if (updated) {
      setDrafts(newDrafts);
    }
  }, [messages]);

  const handleReplyTextChange = (val: string) => {
    setReplyText(val);
    if (!selected) return;

    const storageKey = `pub_draft_${selected._id}`;
    const newDrafts = { ...drafts };

    if (val.trim()) {
      newDrafts[selected._id] = val;
      localStorage.setItem(storageKey, val);

      if (saveDraftTimeoutRef.current) {
        clearTimeout(saveDraftTimeoutRef.current);
      }
      saveDraftTimeoutRef.current = setTimeout(() => {
        supportApi.saveDraft(selected._id, val).catch(err => console.error("Error saving draft:", err));
      }, 1500);
    } else {
      delete newDrafts[selected._id];
      localStorage.removeItem(storageKey);

      if (saveDraftTimeoutRef.current) {
        clearTimeout(saveDraftTimeoutRef.current);
      }
      supportApi.deleteDraft(selected._id).catch(err => console.error("Error deleting draft:", err));
    }
    setDrafts(newDrafts);
  };
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const [replyImageUrl, setReplyImageUrl] = useState('');
  const [replyUploading, setReplyUploading] = useState(false);
  const [composeImageUrl, setComposeImageUrl] = useState('');
  const [composeUploading, setComposeUploading] = useState(false);
  const replyFileRef = useRef<HTMLInputElement>(null);
  const composeFileRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = async (file: File, target: 'reply' | 'compose') => {
    const setUploading = target === 'reply' ? setReplyUploading : setComposeUploading;
    const setUrl = target === 'reply' ? setReplyImageUrl : setComposeImageUrl;
    setUploading(true);
    try {
      const res = await supportApi.uploadImage(file);
      if (res.success && res.image_url) {
        setUrl(res.image_url);
        toast.success('Image uploaded');
      } else {
        toast.error(res.error || 'Upload failed');
      }
    } catch { toast.error('Upload failed'); }
    finally { setUploading(false); }
  };

  // Ctrl+V paste support for images
  useImagePaste(
    (file) => {
      const target = showCompose ? 'compose' : 'reply';
      handleImageUpload(file, target);
      toast.success('Image pasted from clipboard');
    },
    { onError: (msg) => toast.error(msg) }
  );

  const load = async () => {
    setLoading(true);
    try {
      const res = await supportApi.getMyMessages();
      if (res.success) {
        setMessages(res.messages);
        if (selected) {
          const updated = res.messages.find(m => m._id === selected._id);
          if (updated) setSelected(updated);
        }
      }
    } finally { setLoading(false); }
  };

  useEffect(() => {
    load();
    supportApi.markRepliesRead().catch(() => {});
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [selected]);

  const openConversation = (msg: SupportMessage) => {
    setSelected(msg);
    if (saveDraftTimeoutRef.current) {
      clearTimeout(saveDraftTimeoutRef.current);
    }
    const draft = drafts[msg._id] || '';
    setReplyText(draft);
    if (msg.status === 'replied' && !msg.read_by_user) {
      supportApi.markRepliesRead().catch(() => {});
      setMessages(prev => prev.map(m => m._id === msg._id ? { ...m, read_by_user: true } : m));
    }
  };

  const handleSend = async () => {
    if (!body.trim() && !composeImageUrl) return toast.error('Please enter a message or attach an image');
    setSending(true);
    try {
      const res = await supportApi.sendMessage(subject, body, composeImageUrl || undefined);
      if (res.success) {
        toast.success('Message sent to support');
        setSubject(''); setBody(''); setComposeImageUrl(''); setShowCompose(false);
        await load();
        if (res.message) setSelected(res.message);
      } else { toast.error(res.error || 'Failed to send'); }
    } finally { setSending(false); }
  };

  const handleReply = async () => {
    if (!selected || (!replyText.trim() && !replyImageUrl)) return;
    setReplying(true);
    try {
      const token = getAuthToken();
      const res = await fetch(`${getApiBaseUrl()}/api/support/messages/${selected._id}/reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ reply: replyText, image_url: replyImageUrl || undefined }),
      }).then(r => r.json());
      if (res.success) {
        toast.success('Reply sent');
        setReplyText('');
        setReplyImageUrl('');
        
        // Remove draft
        const newDrafts = { ...drafts };
        delete newDrafts[selected._id];
        setDrafts(newDrafts);
        localStorage.removeItem(`pub_draft_${selected._id}`);
        if (saveDraftTimeoutRef.current) {
          clearTimeout(saveDraftTimeoutRef.current);
        }

        setSelected(res.message);
        setMessages(prev => prev.map(m => m._id === res.message._id ? res.message : m));
      } else { toast.error(res.error || 'Failed to send'); }
    } finally { setReplying(false); }
  };

  const handleClose = async () => {
    if (!selected) return;
    try {
      const token = getAuthToken();
      const res = await fetch(`${getApiBaseUrl()}/api/support/messages/${selected._id}/close`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      }).then(r => r.json());
      if (res.success) {
        toast.success('Conversation closed');
        setSelected(res.message);
        setMessages(prev => prev.map(m => m._id === res.message._id ? res.message : m));
      } else { toast.error(res.error || 'Failed to close'); }
    } catch { toast.error('Failed to close'); }
  };

  const newMsgCount = messages.filter(m => m.status === 'replied' && !m.read_by_user).length;
  const openCount = messages.filter(m => m.status === 'open').length;
  const closedCount = messages.filter(m => m.status === 'closed').length;

  return (
    <div className="space-y-5 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <MessageCircle className="w-6 h-6 text-primary" />
            Support & Rewards Hub
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Interact with support staff, manage tickets, and submit ratings for balance rewards</p>
        </div>
        {activeTab === 'inbox' && (
          <div className="flex gap-2">
            <button onClick={load} className="flex items-center gap-2 text-sm border border-border rounded-lg px-3 py-2 hover:bg-muted transition-colors">
              <RefreshCw className="w-4 h-4" /> Refresh
            </button>
            <button onClick={() => setShowCompose(true)} className="flex items-center gap-2 text-sm bg-primary text-primary-foreground rounded-lg px-4 py-2 hover:bg-primary/90 transition-colors">
              <Plus className="w-4 h-4" /> New Message
            </button>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border border-border bg-card/60 backdrop-blur-md rounded-xl p-1 gap-1">
        <button
          onClick={() => setActiveTab('inbox')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 ${
            activeTab === 'inbox'
              ? 'bg-primary text-primary-foreground shadow-sm'
              : 'text-muted-foreground hover:bg-muted hover:text-foreground'
          }`}
        >
          <MessageCircle className="w-4 h-4" /> Support Inbox
        </button>
        <button
          onClick={() => setActiveTab('review')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 ${
            activeTab === 'review'
              ? 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-sm font-bold'
              : 'text-muted-foreground hover:bg-muted hover:text-foreground'
          }`}
        >
          <Star className="w-4 h-4 fill-amber-400 text-amber-400" /> Review Us & Earn Cash
        </button>
      </div>

      {activeTab === 'inbox' ? (
        <>
          {/* Stats */}
          <div className="grid grid-cols-4 gap-4">
            {[
              { label: 'Total', value: messages.length, color: 'text-blue-600 bg-blue-50' },
              { label: 'New from Support', value: newMsgCount, color: 'text-green-600 bg-green-50' },
              { label: 'Waiting for Reply', value: openCount, color: 'text-yellow-600 bg-yellow-50' },
              { label: 'Closed', value: closedCount, color: 'text-gray-600 bg-gray-50' },
            ].map(s => (
              <div key={s.label} className={`rounded-xl p-4 border border-border ${s.color}`}>
                <p className="text-2xl font-bold">{s.value}</p>
                <p className="text-sm font-medium mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Main inbox layout */}
          <div className="flex gap-4 h-[600px]">
            {/* Left: Message list */}
            <div className={`${selected ? 'hidden md:flex' : 'flex'} w-full md:w-80 flex-shrink-0 flex-col border border-border rounded-xl overflow-hidden bg-card`}>
              <div className="px-4 py-3 border-b border-border bg-muted/30">
                <p className="text-sm font-semibold text-foreground">Conversations ({messages.length})</p>
              </div>
              <div className="flex-1 overflow-y-auto divide-y divide-border">
                {loading ? (
                  <div className="p-4 text-sm text-muted-foreground text-center">Loading...</div>
                ) : messages.length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground text-sm">
                    <MessageCircle className="w-10 h-10 mx-auto mb-2 opacity-30" />
                    No messages yet
                  </div>
                ) : (
                  messages.map(msg => {
                    const isUnread = msg.status === 'replied' && !msg.read_by_user;
                    const replyCount = msg.replies?.length || 0;
                    return (
                      <button
                        key={msg._id}
                        onClick={() => openConversation(msg)}
                        className={`w-full text-left px-4 py-3 hover:bg-muted/50 transition-colors ${
                          selected?._id === msg._id ? 'bg-primary/5 border-l-2 border-primary' : ''
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                              {isUnread && <span className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0 animate-pulse" />}
                              <p className={`text-sm truncate ${isUnread ? 'font-bold' : 'font-medium'}`}>
                                {msg.subject}
                              </p>
                            </div>
                            {drafts[msg._id] ? (
                              <p className="text-xs text-red-500 font-medium truncate mt-0.5">
                                <span className="font-semibold">[Draft]</span> {drafts[msg._id]}
                              </p>
                            ) : (
                              <>
                                {isUnread && (
                                  <p className="text-xs text-green-600 font-semibold mt-0.5">
                                    🟢 New Message from Support
                                  </p>
                                )}
                                {msg.status === 'open' && (
                                  <p className="text-xs text-yellow-600 mt-0.5">⏳ Waiting for reply...</p>
                                )}
                                {msg.status === 'closed' && (
                                  <p className="text-xs text-gray-500 mt-0.5">Closed</p>
                                )}
                                {msg.status === 'replied' && msg.read_by_user && (
                                  <p className="text-xs text-blue-600 mt-0.5">✓ Read</p>
                                )}
                              </>
                            )}
                            <div className="flex items-center gap-2 mt-1">
                              <p className="text-xs text-muted-foreground">{fmt(msg.updated_at || msg.created_at)}</p>
                              {replyCount > 0 && (
                                <span className="text-[10px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded-full">
                                  {replyCount + 1} messages
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </div>

            {/* Right: Conversation thread */}
            <div className={`${selected ? 'flex' : 'hidden md:flex'} flex-1 flex-col border border-border rounded-xl overflow-hidden bg-card`}>
              {!selected ? (
                <div className="flex-1 flex items-center justify-center text-muted-foreground">
                  <div className="text-center">
                    <MessageCircle className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p className="text-sm">Select a conversation to view</p>
                  </div>
                </div>
              ) : (
                <>
                  {/* Conversation header */}
                  <div className="px-4 sm:px-6 py-4 border-b border-border flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <button onClick={() => setSelected(null)} className="md:hidden text-muted-foreground hover:text-foreground">
                        <ArrowLeft className="w-5 h-5" />
                      </button>
                      <div className="min-w-0">
                        <h2 className="font-semibold text-foreground truncate">{selected.subject}</h2>
                        <p className="text-xs text-muted-foreground">
                          {fmt(selected.created_at)} · {(selected.replies?.length || 0) + 1} messages
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {selected.status !== 'closed' && (
                        <>
                          {selected.status === 'open' && (
                            <span className="text-xs text-yellow-600 hidden sm:inline">Waiting for Admin</span>
                          )}
                          {selected.status === 'replied' && !selected.read_by_user && (
                            <span className="text-xs text-green-600 font-semibold hidden sm:inline">New Message from Support</span>
                          )}
                          {selected.status === 'replied' && selected.read_by_user && (
                            <span className="text-xs text-muted-foreground hidden sm:inline">Read</span>
                          )}
                          <button
                            onClick={handleClose}
                            className="flex items-center gap-1.5 text-xs bg-green-600 text-white px-3 py-1.5 rounded-lg hover:bg-green-700 transition-colors"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" /> Close
                          </button>
                        </>
                      )}
                      {selected.status === 'closed' && (
                        <span className="text-xs bg-gray-100 text-gray-600 px-3 py-1.5 rounded-full font-medium">Closed</span>
                      )}
                    </div>
                  </div>

                  {/* Chat thread */}
                  <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-5">
                    <div className="space-y-4 max-w-2xl mx-auto">
                      {/* User's original message */}
                      {!selected.is_broadcast && (selected.body || selected.image_url) && (
                        <div className="flex gap-3 justify-end">
                          <div className="max-w-[80%]">
                            <div className="flex items-center gap-1.5 justify-end mb-1">
                              <div className="w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center">
                                <span className="text-[9px] font-bold text-white">
                                  {(user?.username || 'U')[0].toUpperCase()}
                                </span>
                              </div>
                              <p className="text-[11px] text-muted-foreground">
                                {user?.username || 'You'} · {fmt(selected.created_at)}
                              </p>
                            </div>
                            <div className="bg-blue-600 text-white rounded-2xl rounded-tr-sm px-4 py-2.5">
                              {selected.body && <p className="text-sm whitespace-pre-wrap">{selected.body}</p>}
                              {selected.image_url && (
                                <a href={`${getApiBaseUrl()}${selected.image_url}`} target="_blank" rel="noopener noreferrer">
                                  <img src={`${getApiBaseUrl()}${selected.image_url}`} alt="Attachment" className="mt-2 max-w-[240px] rounded-lg border border-white/20" />
                                </a>
                              )}
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Replies thread */}
                      {selected.replies.map((reply, idx) => {
                        const isAdmin = reply.from === 'admin';
                        const isLastAdminReply = isAdmin && reply._id === selected.replies.filter(r => r.from === 'admin').slice(-1)[0]?._id;
                        return (
                          <div key={reply._id} className={`flex gap-3 ${isAdmin ? 'justify-start' : 'justify-end'}`}>
                            {isAdmin && (
                              <img
                                src="/logo.png"
                                alt="ML"
                                className="w-7 h-7 rounded-full object-cover flex-shrink-0 mt-5"
                                onError={(e) => {
                                  const target = e.target as HTMLImageElement;
                                  target.style.display = 'none';
                                  const fallback = target.nextElementSibling as HTMLElement;
                                  if (fallback) fallback.style.display = 'flex';
                                }}
                              />
                            )}
                            {isAdmin && (
                              <div className="w-7 h-7 rounded-full bg-amber-500 items-center justify-center flex-shrink-0 mt-5 hidden">
                                <span className="text-[9px] font-bold text-white">ML</span>
                              </div>
                            )}
                            <div className="max-w-[80%]">
                              <div className={`flex items-center gap-1.5 mb-1 ${isAdmin ? '' : 'justify-end'}`}>
                                <p className="text-[11px] text-muted-foreground">
                                  {isAdmin ? 'MoustacheLeads Support' : (user?.username || 'You')} · {fmt(reply.created_at)}
                                </p>
                                {isAdmin && !selected.read_by_user && isLastAdminReply && (
                                  <span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full font-medium">Unread</span>
                                )}
                              </div>
                              <div className={`rounded-2xl px-4 py-2.5 ${
                                isAdmin
                                  ? 'bg-card border border-border rounded-tl-sm'
                                  : 'bg-blue-600 text-white rounded-tr-sm'
                              }`}>
                                <p className={`text-sm whitespace-pre-wrap ${isAdmin ? 'text-foreground' : ''}`}>{reply.text}</p>
                                {reply.image_url && (
                                  <a href={`${getApiBaseUrl()}${reply.image_url}`} target="_blank" rel="noopener noreferrer">
                                    <img src={`${getApiBaseUrl()}${reply.image_url}`} alt="Attachment" className={`mt-2 max-w-[240px] rounded-lg border ${isAdmin ? 'border-border' : 'border-white/20'}`} />
                                  </a>
                                )}
                              </div>
                            </div>
                            {!isAdmin && (
                              <div className="w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center flex-shrink-0 mt-5">
                                <span className="text-[9px] font-bold text-white">
                                  {(user?.username || 'U')[0].toUpperCase()}
                                </span>
                              </div>
                            )}
                          </div>
                        );
                      })}

                      {selected.replies.length === 0 && !selected.is_broadcast && (
                        <div className="text-center py-6">
                          <Clock className="w-8 h-8 mx-auto mb-2 text-muted-foreground opacity-40" />
                          <p className="text-sm text-muted-foreground">Waiting for admin reply...</p>
                        </div>
                      )}
                      <div ref={chatEndRef} />
                    </div>
                  </div>

                  {/* Reply input */}
                  {selected.status !== 'closed' && (
                    <div className="px-4 sm:px-6 py-4 border-t border-border bg-muted/20">
                      {replyImageUrl && (
                        <div className="mb-2 relative inline-block">
                          <img src={`${getApiBaseUrl()}${replyImageUrl}`} alt="Preview" className="h-16 rounded-lg border border-border" />
                          <button onClick={() => setReplyImageUrl('')} className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center">
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      )}
                      <div className="flex gap-3">
                        <input ref={replyFileRef} type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleImageUpload(f, 'reply'); e.target.value = ''; }} />
                        <button
                          onClick={() => replyFileRef.current?.click()}
                          disabled={replyUploading}
                          className="self-end flex items-center justify-center w-10 h-10 rounded-xl border border-border hover:bg-muted transition-colors disabled:opacity-50"
                          title="Attach image"
                        >
                          {replyUploading ? <span className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" /> : <Image className="w-4 h-4 text-muted-foreground" />}
                        </button>
                        <textarea
                          value={replyText}
                          onChange={e => handleReplyTextChange(e.target.value)}
                          placeholder="Type your message..."
                          rows={2}
                          className="flex-1 text-sm border border-border rounded-xl px-4 py-3 bg-background focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                          onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleReply(); }}
                        />
                        <button
                          onClick={handleReply}
                          disabled={replying || (!replyText.trim() && !replyImageUrl)}
                          className="self-end flex items-center gap-2 bg-primary text-primary-foreground px-4 py-3 rounded-xl text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
                        >
                          <Send className="w-4 h-4" />
                          {replying ? 'Sending...' : 'Send'}
                        </button>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">Ctrl+Enter to send</p>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Compose modal */}
          {showCompose && (
            <div className="fixed inset-0 z-50 flex items-center justify-center">
              <div className="absolute inset-0 bg-black/50" onClick={() => setShowCompose(false)} />
              <div className="relative bg-card border border-border rounded-2xl shadow-2xl w-full max-w-lg mx-4 p-6 space-y-4">
                <h2 className="font-semibold text-foreground text-lg">New Support Message</h2>
                <input
                  value={subject}
                  onChange={e => setSubject(e.target.value)}
                  placeholder="Subject (optional)"
                  className="w-full text-sm border border-border rounded-xl px-4 py-3 bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                />
                <textarea
                  value={body}
                  onChange={e => setBody(e.target.value)}
                  placeholder="Describe your query in detail..."
                  rows={5}
                  className="w-full text-sm border border-border rounded-xl px-4 py-3 bg-background focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                />
                <div>
                  <input ref={composeFileRef} type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleImageUpload(f, 'compose'); e.target.value = ''; }} />
                  {composeImageUrl ? (
                    <div className="relative inline-block">
                      <img src={`${getApiBaseUrl()}${composeImageUrl}`} alt="Preview" className="h-20 rounded-lg border border-border" />
                      <button onClick={() => setComposeImageUrl('')} className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center">
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => composeFileRef.current?.click()}
                      disabled={composeUploading}
                      className="flex items-center gap-2 text-sm text-muted-foreground border border-dashed border-border rounded-xl px-4 py-2 hover:bg-muted transition-colors disabled:opacity-50"
                    >
                      {composeUploading ? <span className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" /> : <Image className="w-4 h-4" />}
                      {composeUploading ? 'Uploading...' : 'Attach Image'}
                    </button>
                  )}
                </div>
                <div className="flex gap-3 justify-end">
                  <button onClick={() => { setShowCompose(false); setComposeImageUrl(''); }} className="px-4 py-2 text-sm border border-border rounded-xl hover:bg-muted transition-colors">
                    Cancel
                  </button>
                  <button
                    onClick={handleSend}
                    disabled={sending}
                    className="flex items-center gap-2 bg-primary text-primary-foreground px-5 py-2 rounded-xl text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
                  >
                    <Send className="w-4 h-4" />
                    {sending ? 'Sending...' : 'Send Message'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="space-y-6">
          {/* Welcome Banner Card */}
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-indigo-900 via-indigo-950 to-slate-900 border border-slate-800 p-6 md:p-8 text-white shadow-xl">
            <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
              <Sparkles className="w-40 h-40 text-amber-400" />
            </div>
            
            <div className="max-w-2xl space-y-4">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-bold uppercase tracking-wider rounded-full">
                <Gift className="w-3.5 h-3.5" /> High-Paying Publisher Reward
              </div>
              <h2 className="text-3xl font-extrabold tracking-tight">
                Rate MoustacheLeads & Get Extra Balance Bonus!
              </h2>
              <p className="text-slate-300 text-sm md:text-base leading-relaxed">
                We values our partnership. Share your experience and reviews on public platforms to help us grow! As a token of appreciation, we will credit your balance with a guaranteed bonus reward:
              </p>
              
              <div className="flex flex-wrap items-center gap-6 pt-2">
                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 rounded-full bg-emerald-500/15 flex items-center justify-center text-emerald-400 font-bold border border-emerald-500/20">$5</div>
                  <div>
                    <p className="text-xs text-slate-400">Guaranteed Cash</p>
                    <p className="text-sm font-bold text-white">+$5.00 Flat Reward</p>
                  </div>
                </div>
                <div className="text-2xl text-slate-500 font-light hidden sm:inline">+</div>
                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 rounded-full bg-amber-500/15 flex items-center justify-center text-amber-400 font-bold border border-amber-500/20">10%</div>
                  <div>
                    <p className="text-xs text-slate-400">Account Bonus</p>
                    <p className="text-sm font-bold text-white">+10% Extra of Balance</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Grid Content */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Step Action Cards */}
            <div className="lg:col-span-2 space-y-6">
              {/* Step 1 */}
              <div className="bg-card border border-border rounded-2xl p-6 shadow-sm space-y-4">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 font-bold text-lg flex items-center justify-center border border-indigo-100 flex-shrink-0">
                    1
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-base font-bold text-foreground">Step 1: Write an Honest Review</h3>
                    <p className="text-sm text-muted-foreground">
                      Click below to open our official review page and write your feedback about MoustacheLeads.
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleReviewButtonClick}
                  className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white font-bold py-3.5 px-6 rounded-xl shadow-md hover:shadow-lg transition-all duration-200 group text-sm"
                >
                  <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                  Go to Official Review Page
                  <ArrowUpRight className="w-4 h-4 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                </button>
              </div>

              {/* Step 2 */}
              <div className="bg-card border border-border rounded-2xl p-6 shadow-sm space-y-4">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 font-bold text-lg flex items-center justify-center border border-indigo-100 flex-shrink-0">
                    2
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-base font-bold text-foreground">Step 2: Upload Screenshot Proof</h3>
                    <p className="text-sm text-muted-foreground">
                      Take a clear screenshot of your submitted review (must show your name and rating) and upload it here for verification.
                    </p>
                  </div>
                </div>

                {reviewSubmission && (reviewSubmission.status === 'pending' || reviewSubmission.status === 'approved') ? (
                  <div className="bg-muted/40 border border-dashed border-border rounded-xl p-6 text-center space-y-2">
                    <Award className="w-8 h-8 mx-auto text-indigo-600 opacity-60 animate-bounce" />
                    <p className="text-xs text-muted-foreground font-semibold">
                      You already have an active "{reviewSubmission.status}" review proof.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="border-2 border-dashed border-border hover:border-indigo-500/40 bg-card rounded-xl p-8 text-center transition-colors relative group">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleReviewFileSelect}
                        disabled={uploadingProof}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
                      />
                      
                      {proofPreviewUrl ? (
                        <div className="space-y-3">
                          <img src={proofPreviewUrl} alt="Selected Screenshot Preview" className="max-h-48 mx-auto rounded-lg border border-border shadow-sm" />
                          <p className="text-xs text-muted-foreground truncate max-w-xs mx-auto">
                            {selectedProofFile?.name}
                          </p>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedProofFile(null);
                              setProofPreviewUrl('');
                            }}
                            className="text-xs text-red-500 hover:text-red-600 font-semibold"
                          >
                            Remove and Choose Another
                          </button>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <div className="w-12 h-12 rounded-full bg-slate-50 flex items-center justify-center mx-auto border border-border group-hover:bg-indigo-50 transition-colors">
                            <UploadCloud className="w-6 h-6 text-muted-foreground group-hover:text-indigo-600 transition-colors" />
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-foreground">Click to upload screenshot</p>
                            <p className="text-xs text-muted-foreground mt-1">PNG, JPG or JPEG up to 10MB</p>
                          </div>
                        </div>
                      )}
                    </div>

                    {selectedProofFile && (
                      <button
                        onClick={handleUploadReviewProof}
                        disabled={uploadingProof}
                        className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3.5 px-6 rounded-xl shadow-md disabled:opacity-50 transition-all duration-200 text-sm flex items-center justify-center gap-2"
                      >
                        {uploadingProof ? (
                          <>
                            <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            Uploading Proof...
                          </>
                        ) : (
                          <>
                            <CheckCircle2 className="w-4 h-4" />
                            Submit Screenshot Proof
                          </>
                        )}
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Sidebar Status Info */}
            <div className="space-y-6">
              {/* Submission Status */}
              <div className="bg-card border border-border rounded-2xl p-6 shadow-sm space-y-4">
                <h3 className="text-sm font-bold text-foreground uppercase tracking-wider">Your Submission Status</h3>
                
                {!reviewSubmission ? (
                  <div className="bg-slate-50 rounded-xl p-4 text-center space-y-2 border border-border">
                    <Star className="w-8 h-8 text-amber-400 fill-amber-400/20 mx-auto" />
                    <p className="text-sm font-semibold text-slate-800">No Review Submitted</p>
                    <p className="text-xs text-slate-500 leading-relaxed">
                      Complete Step 1 and Step 2 to submit your review screenshot and claim your cash reward!
                    </p>
                  </div>
                ) : reviewSubmission.status === 'pending' ? (
                  <div className="bg-amber-50/50 rounded-xl p-4 text-center space-y-2 border border-amber-100/50">
                    <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center mx-auto text-amber-600">
                      <Clock className="w-4 h-4 animate-pulse" />
                    </div>
                    <p className="text-sm font-semibold text-amber-800">Verification Pending</p>
                    <p className="text-xs text-amber-700 leading-relaxed">
                      Our moderation team is reviewing your screenshot. This usually takes 12-24 hours. Your cash bonus will be applied instantly upon approval!
                    </p>
                    {reviewSubmission.proof_image_url && (
                      <div className="pt-2">
                        <a href={`${getApiBaseUrl()}${reviewSubmission.proof_image_url}`} target="_blank" rel="noopener noreferrer" className="inline-block">
                          <img src={`${getApiBaseUrl()}${reviewSubmission.proof_image_url}`} alt="Submitted Proof" className="max-h-24 rounded border border-amber-200 hover:opacity-85 transition-opacity" />
                        </a>
                      </div>
                    )}
                  </div>
                ) : reviewSubmission.status === 'approved' ? (
                  <div className="bg-emerald-50/50 rounded-xl p-4 text-center space-y-2 border border-emerald-100/50">
                    <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center mx-auto text-emerald-600">
                      <CheckCircle2 className="w-4 h-4" />
                    </div>
                    <p className="text-sm font-semibold text-emerald-800">Reward Credited! 🎉</p>
                    <p className="text-xs text-emerald-700 leading-relaxed">
                      Your screenshot has been verified and approved. Your bonus payout of **${reviewSubmission.reward_amount?.toFixed(2) || '5.00'}** was successfully added to your balance!
                    </p>
                    <div className="p-2.5 bg-emerald-600/10 rounded-lg text-emerald-700 text-xs font-bold">
                      Payout: +${reviewSubmission.reward_amount?.toFixed(2) || '5.00'}
                    </div>
                  </div>
                ) : reviewSubmission.status === 'partially_deducted' ? (
                  <div className="bg-amber-50/50 rounded-xl p-4 text-center space-y-2 border border-amber-100/50">
                    <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center mx-auto text-amber-600">
                      <Award className="w-4 h-4" />
                    </div>
                    <p className="text-sm font-semibold text-amber-800">Partially Deducted ⚠️</p>
                    <p className="text-xs text-amber-700 leading-relaxed font-medium">
                      A compliance adjustment was applied to this review reward.
                    </p>
                    <div className="space-y-1 text-xs text-amber-700 leading-relaxed text-left bg-white/60 p-2.5 rounded-lg border border-amber-100">
                      <div>Original Reward: **${reviewSubmission.reward_amount?.toFixed(2)}**</div>
                      <div className="text-red-500 font-medium">Compliance Deduction: **-${reviewSubmission.deducted_amount?.toFixed(2)}**</div>
                      <div className="text-emerald-700 font-bold border-t border-amber-100 pt-1 mt-1">
                        Final Payout Credited: ${(reviewSubmission.reward_amount || 0) - (reviewSubmission.deducted_amount || 0) > 0 ? `$${((reviewSubmission.reward_amount || 0) - (reviewSubmission.deducted_amount || 0)).toFixed(2)}` : '$0.00'}
                      </div>
                    </div>
                  </div>
                ) : reviewSubmission.status === 'deducted' ? (
                  <div className="bg-red-50/50 rounded-xl p-4 text-center space-y-2 border border-red-100/50 animate-pulse-subtle">
                    <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center mx-auto text-red-600">
                      <X className="w-4 h-4" />
                    </div>
                    <p className="text-sm font-semibold text-red-800">Reward Reversed/Deducted</p>
                    <p className="text-xs text-red-700 leading-relaxed">
                      Your payout of **${reviewSubmission.reward_amount?.toFixed(2) || '5.00'}** was reverted by our compliance team. If you believe this is an error, please write a new review, take a valid screenshot, and submit it again using Step 2 above.
                    </p>
                  </div>
                ) : (
                  <div className="bg-red-50/50 rounded-xl p-4 text-center space-y-2 border border-red-100/50">
                    <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center mx-auto text-red-600">
                      <X className="w-4 h-4" />
                    </div>
                    <p className="text-sm font-semibold text-red-800">Submission Rejected</p>
                    <p className="text-xs text-red-700 leading-relaxed">
                      Verification failed. Please make sure the screenshot is high quality, clearly displays your review, and try re-submitting with Step 2.
                    </p>
                  </div>
                )}
              </div>

              {/* Guidelines / Terms */}
              <div className="bg-card border border-border rounded-2xl p-6 shadow-sm space-y-3">
                <h4 className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <Award className="w-4 h-4 text-indigo-600" /> Review Guidelines
                </h4>
                <ul className="text-xs text-muted-foreground space-y-2 list-disc pl-4 leading-relaxed">
                  <li>Your review must be public and remain active on the platform.</li>
                  <li>Screenshots must be uncropped, clear, and display your public reviewer name.</li>
                  <li>Rewards are calculated automatically as: **$5.00 fixed reward** + **10% of account balance** at the moment of approval.</li>
                  <li>Only one review bonus is allowed per publisher account per active cycle.</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SupportPage;
