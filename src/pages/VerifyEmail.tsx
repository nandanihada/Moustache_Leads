import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Mail, CheckCircle, AlertCircle, Loader, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { API_BASE_URL } from '../services/apiConfig';

export default function VerifyEmail() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');
  const [accountStatus, setAccountStatus] = useState<string>('');
  const token = searchParams.get('token');

  useEffect(() => {
    const verifyEmail = async () => {
      if (!token) {
        setStatus('error');
        setMessage('No verification token provided');
        return;
      }

      try {
        const response = await fetch(`${API_BASE_URL}/api/auth/verify-email`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ token }),
        });

        const data = await response.json();

        if (response.ok) {
          setStatus('success');
          setAccountStatus(data.account_status || 'pending_approval');
          setMessage(data.message || 'Email verified successfully!');
        } else {
          setStatus('error');
          setMessage(data.error || 'Failed to verify email');
        }
      } catch (error) {
        setStatus('error');
        setMessage('An error occurred while verifying your email');
      }
    };

    verifyEmail();
  }, [token]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-lg shadow-2xl p-8">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full mb-4">
              <Mail className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Email Verification</h1>
          </div>

          {/* Status Content */}
          <div className="text-center">
            {status === 'loading' && (
              <div className="space-y-4">
                <div className="flex justify-center">
                  <Loader className="w-12 h-12 text-indigo-600 animate-spin" />
                </div>
                <p className="text-gray-600">Verifying your email...</p>
              </div>
            )}

            {status === 'success' && (
              <div className="space-y-6">
                <div className="flex justify-center">
                  <CheckCircle className="w-12 h-12 text-green-500" />
                </div>
                <div>
                  <p className="text-lg font-semibold text-gray-900 mb-2">
                    Email Verified!
                  </p>
                </div>
                
                {/* Account Under Review Message */}
                {accountStatus === 'pending_approval' && (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-6 text-left">
                    <div className="flex items-start gap-3">
                      <Clock className="w-6 h-6 text-amber-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <h3 className="font-semibold text-amber-800 mb-2">
                          Your Account is Under Review
                        </h3>
                        <p className="text-amber-700 text-sm mb-3">
                          Thank you for verifying your email! Your application is now being reviewed by our team.
                        </p>
                        <p className="text-amber-700 text-sm">
                          You will receive an email once your account has been approved. This usually takes 1-3 business days.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* What happens next */}
                <div className="bg-gray-50 rounded-lg p-4 text-left">
                  <h4 className="font-medium text-gray-900 mb-2">What happens next?</h4>
                  <ul className="text-sm text-gray-600 space-y-2">
                    <li className="flex items-start gap-2">
                      <span className="text-indigo-600 font-bold">1.</span>
                      <span>Our team will review your application</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-indigo-600 font-bold">2.</span>
                      <span>You'll receive an approval email</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-indigo-600 font-bold">3.</span>
                      <span>Then you can log in and create your placement</span>
                    </li>
                  </ul>
                </div>

                <Button
                  onClick={() => navigate('/login')}
                  variant="outline"
                  className="w-full"
                >
                  Go to Login
                </Button>
              </div>
            )}

            {status === 'error' && (
              <div className="space-y-4">
                <div className="flex justify-center">
                  <AlertCircle className="w-12 h-12 text-red-500" />
                </div>
                <div>
                  <p className="text-lg font-semibold text-gray-900 mb-2">
                    Verification Failed
                  </p>
                  <p className="text-gray-600 mb-6">{message}</p>
                  <Button
                    onClick={() => navigate('/register')}
                    className="w-full bg-indigo-600 hover:bg-indigo-700"
                  >
                    Back to Registration
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Info Box */}
          <div className="mt-8 p-4 bg-blue-50 rounded-lg border border-blue-200">
            <p className="text-sm text-blue-800">
              <strong>💡 Tip:</strong> Make sure to add <strong>moustacheleads.com</strong> to your email whitelist so you don't miss our approval notification.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
