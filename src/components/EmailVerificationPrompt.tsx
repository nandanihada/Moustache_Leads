import { useState } from 'react';
import { Mail, AlertCircle, Loader, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { API_BASE_URL } from '../services/apiConfig';

interface EmailVerificationPromptProps {
  email: string;
  username: string;
  token: string;
  onVerified?: () => void;
}

export default function EmailVerificationPrompt({
  email,
  username,
  token,
  onVerified,
}: EmailVerificationPromptProps) {
  const [resendLoading, setResendLoading] = useState(false);
  const [resendMessage, setResendMessage] = useState('');
  const [resendError, setResendError] = useState('');

  const handleResendEmail = async () => {
    setResendLoading(true);
    setResendMessage('');
    setResendError('');

    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/resend-verification`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (response.ok) {
        setResendMessage('Verification email resent successfully!');
      } else {
        setResendError(data.error || 'Failed to resend verification email');
      }
    } catch (error) {
      setResendError('An error occurred while resending the email');
    } finally {
      setResendLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-2xl max-w-md w-full p-8">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full mb-4">
            <Mail className="w-7 h-7 text-white" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900">Verify Your Email</h2>
        </div>

        {/* Message */}
        <div className="space-y-4 mb-6">
          <p className="text-gray-600 text-center">
            We've sent a verification email to:
          </p>
          <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
            <p className="text-center font-semibold text-gray-900">{email}</p>
          </div>
          <p className="text-gray-600 text-center text-sm">
            Click the link in the email to verify your account and get started.
          </p>
        </div>

        {/* Info Box */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <div className="flex gap-3">
            <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-800">
              <p className="font-semibold mb-1">Didn't receive the email?</p>
              <ul className="text-xs space-y-1">
                <li>• Check your spam or junk folder</li>
                <li>• Wait a few minutes for delivery</li>
                <li>• Request a new verification email below</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Messages */}
        {resendMessage && (
          <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg flex gap-2">
            <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
            <p className="text-sm text-green-800">{resendMessage}</p>
          </div>
        )}

        {resendError && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex gap-2">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
            <p className="text-sm text-red-800">{resendError}</p>
          </div>
        )}

        {/* Actions */}
        <div className="space-y-3">
          <Button
            onClick={handleResendEmail}
            disabled={resendLoading}
            variant="outline"
            className="w-full"
          >
            {resendLoading ? (
              <>
                <Loader className="w-4 h-4 mr-2 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Mail className="w-4 h-4 mr-2" />
                Resend Verification Email
              </>
            )}
          </Button>

          <p className="text-xs text-gray-500 text-center">
            Verification link expires in 24 hours
          </p>
        </div>

        {/* Additional Info */}
        <div className="mt-6 pt-6 border-t border-gray-200">
          <p className="text-xs text-gray-600 text-center">
            You can still browse and explore offers while waiting to verify your email.
          </p>
        </div>
      </div>
    </div>
  );
}
