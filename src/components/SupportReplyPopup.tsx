import React, { useEffect, useState } from 'react';
import { MessageCircle, X, ArrowRight } from 'lucide-react';
import { supportApi } from '@/services/supportApi';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

export const SupportReplyPopup: React.FC = () => {
  const [show, setShow] = useState(false);
  const [visible, setVisible] = useState(false);
  const [count, setCount] = useState(0);
  const [preview, setPreview] = useState<string | null>(null);
  const navigate = useNavigate();
  const { user, isAuthenticated, isPublisher } = useAuth();

  useEffect(() => {
    if (!isAuthenticated || !user || !isPublisher) return;

    const justLoggedIn = sessionStorage.getItem('just_logged_in');
    const popupKey = `support_popup_shown_${user.id}`;
    const alreadyShown = sessionStorage.getItem(popupKey);

    if (!justLoggedIn && alreadyShown) return;

    sessionStorage.removeItem('just_logged_in');
    sessionStorage.setItem(popupKey, '1');

    const timer = setTimeout(() => {
      supportApi.checkUnreadReplies()
        .then(res => {
          if (res.success && res.unread_count > 0) {
            setCount(res.unread_count);
            setPreview(res.preview);
            setShow(true);
            setTimeout(() => setVisible(true), 80);
          }
        })
        .catch(() => {});
    }, 1200);

    return () => clearTimeout(timer);
  }, [user?.id, isAuthenticated, isPublisher]);

  const dismiss = () => {
    setVisible(false);
    setTimeout(() => setShow(false), 300);
  };

  const handleView = () => {
    dismiss();
    navigate('/dashboard/support');
  };

  if (!show) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={dismiss}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 9998,
          background: 'rgba(0, 0, 0, 0.35)',
          backdropFilter: 'blur(3px)',
          WebkitBackdropFilter: 'blur(3px)',
          transition: 'opacity 0.3s ease',
          opacity: visible ? 1 : 0,
        }}
      />

      {/* Centered modal */}
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          pointerEvents: 'none',
        }}
      >
        <div
          style={{
            width: '620px',
            maxWidth: '92vw',
            pointerEvents: 'auto',
            transition: 'opacity 0.35s ease, transform 0.35s ease',
            opacity: visible ? 1 : 0,
            transform: visible ? 'translateY(0) scale(1)' : 'translateY(20px) scale(0.96)',
          }}
        >
          {/* Card — dark frosted glass so it pops on light backgrounds */}
          <div
            style={{
              borderRadius: '24px',
              background: 'rgba(30, 30, 35, 0.72)',
              backdropFilter: 'blur(32px)',
              WebkitBackdropFilter: 'blur(32px)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              boxShadow: '0 24px 80px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.08)',
              minHeight: '380px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
            }}
          >
            <div style={{ padding: '52px 48px 44px' }}>

              {/* Header */}
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '28px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '18px' }}>
                  <div style={{
                    width: '60px', height: '60px', borderRadius: '16px', flexShrink: 0,
                    background: 'rgba(255,255,255,0.1)',
                    border: '1px solid rgba(255,255,255,0.15)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <MessageCircle size={28} color="rgba(255,255,255,0.85)" />
                  </div>
                  <div>
                    <div style={{ fontSize: '20px', fontWeight: 700, color: '#ffffff', lineHeight: 1.35, marginBottom: '6px' }}>
                      You have received a reply from MoustacheLeads
                    </div>
                    <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.45)', lineHeight: 1.4 }}>
                      {count === 1 ? '1 unread reply' : `${count} unread replies`} in your support inbox
                    </div>
                  </div>
                </div>
                <button
                  onClick={dismiss}
                  style={{
                    background: 'rgba(255,255,255,0.08)',
                    border: '1px solid rgba(255,255,255,0.12)',
                    borderRadius: '10px', cursor: 'pointer',
                    color: 'rgba(255,255,255,0.5)', padding: '8px', lineHeight: 1,
                    flexShrink: 0, marginLeft: '16px',
                  }}
                >
                  <X size={17} />
                </button>
              </div>

              {/* Preview */}
              {preview && (
                <div style={{
                  borderRadius: '14px',
                  padding: '18px 20px',
                  marginBottom: '28px',
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  fontSize: '14px',
                  color: 'rgba(255,255,255,0.65)',
                  lineHeight: 1.7,
                  fontStyle: 'italic',
                  overflow: 'hidden',
                  display: '-webkit-box',
                  WebkitLineClamp: 4,
                  WebkitBoxOrient: 'vertical',
                }}>
                  "{preview}"
                </div>
              )}

              {/* Buttons */}
              <div style={{ display: 'flex', gap: '12px' }}>
                <button
                  onClick={dismiss}
                  style={{
                    flex: 1, padding: '14px 0', borderRadius: '12px', cursor: 'pointer',
                    background: 'rgba(255,255,255,0.08)',
                    border: '1px solid rgba(255,255,255,0.14)',
                    color: 'rgba(255,255,255,0.6)', fontSize: '14px', fontWeight: 500,
                  }}
                >
                  Later
                </button>
                <button
                  onClick={handleView}
                  style={{
                    flex: 2, padding: '14px 0', borderRadius: '12px', cursor: 'pointer',
                    background: '#ffffff',
                    border: 'none',
                    color: '#111111', fontSize: '14px', fontWeight: 700,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                  }}
                >
                  View Replies <ArrowRight size={15} />
                </button>
              </div>

            </div>
          </div>
        </div>
      </div>
    </>
  );
};
