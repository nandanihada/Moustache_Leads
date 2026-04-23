import React, { useState } from 'react';
import { Mail, Send, X, Loader2, Sparkles, User, AtSign, FileText, Zap } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { API_BASE_URL } from '@/services/apiConfig';

interface EmailDialogProps {
  isOpen: boolean;
  onClose: () => void;
  publisherId: string;
  publisherName: string;
  publisherEmail: string;
}

export const EmailDialog: React.FC<EmailDialogProps> = ({
  isOpen,
  onClose,
  publisherId,
  publisherName,
  publisherEmail,
}) => {
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const { toast } = useToast();

  const handleSend = async () => {
    // Validation
    if (!subject.trim()) {
      toast({
        title: 'Error',
        description: 'Please enter a subject',
        variant: 'destructive',
      });
      return;
    }

    if (!message.trim()) {
      toast({
        title: 'Error',
        description: 'Please enter a message',
        variant: 'destructive',
      });
      return;
    }

    if (subject.length > 200) {
      toast({
        title: 'Error',
        description: 'Subject is too long (max 200 characters)',
        variant: 'destructive',
      });
      return;
    }

    if (message.length > 5000) {
      toast({
        title: 'Error',
        description: 'Message is too long (max 5000 characters)',
        variant: 'destructive',
      });
      return;
    }

    try {
      setSending(true);
      const token = localStorage.getItem('token');

      const response = await fetch(
        `${API_BASE_URL}/api/admin/publishers/${publisherId}/send-email`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            subject: subject.trim(),
            message: message.trim(),
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to send email');
      }

      toast({
        title: '✅ Email Sent!',
        description: `Your message has been delivered to ${publisherName}`,
      });

      // Reset form and close
      setSubject('');
      setMessage('');
      onClose();
    } catch (error: any) {
      console.error('Error sending email:', error);
      toast({
        title: 'Failed to Send',
        description: error.message || 'Please try again later',
        variant: 'destructive',
      });
    } finally {
      setSending(false);
    }
  };

  const handleClose = () => {
    if (!sending) {
      setSubject('');
      setMessage('');
      onClose();
    }
  };

  const templates = [
    {
      icon: Sparkles,
      label: 'New Offers',
      color: 'from-purple-500 to-pink-500',
      subject: '🎯 Exclusive High-Paying Offers Just For You',
      message: `Hi ${publisherName},\n\nGreat news! We've handpicked some premium offers that perfectly match your traffic profile.\n\n✨ Why these offers?\n• High conversion rates (15-25%)\n• Competitive payouts ($20-$50 per conversion)\n• Proven performance with similar publishers\n\nThese are available in your dashboard right now. I'd love to help you get started!\n\nLet me know if you have any questions.`,
    },
    {
      icon: Zap,
      label: 'Performance',
      color: 'from-blue-500 to-cyan-500',
      subject: '📊 Your Account Performance - Let\'s Optimize Together',
      message: `Hi ${publisherName},\n\nI've been reviewing your account metrics, and I'm impressed with your progress!\n\n📈 Current Stats:\n• Strong engagement rates\n• Quality traffic sources\n• Room for optimization\n\nI'd love to share some strategies that could boost your earnings by 30-50%. These are tactics that have worked incredibly well for our top publishers.\n\nAre you available for a quick 15-minute call this week?`,
    },
    {
      icon: FileText,
      label: 'Update',
      color: 'from-orange-500 to-red-500',
      subject: '🔔 Important Account Update',
      message: `Hi ${publisherName},\n\nI wanted to personally reach out about some updates to your account.\n\n📋 What's New:\n• Enhanced reporting features\n• New payment options\n• Updated terms (please review)\n\nEverything is ready for you in the dashboard. If you have any questions or concerns, I'm here to help.\n\nLooking forward to your continued success!`,
    },
  ];

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[700px] p-0 gap-0 overflow-hidden">
        {/* Header with Gradient */}
        <div className="bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 p-6 text-white">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
                <Mail className="w-6 h-6" />
              </div>
              <div>
                <DialogTitle className="text-2xl font-bold text-white mb-1">
                  Compose Email
                </DialogTitle>
                <DialogDescription className="text-blue-100">
                  Send a personalized message to your publisher
                </DialogDescription>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleClose}
              disabled={sending}
              className="text-white hover:bg-white/20 rounded-full"
            >
              <X className="w-5 h-5" />
            </Button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Recipient Card */}
          <div className="bg-gradient-to-r from-blue-50 to-purple-50 border-2 border-blue-200 rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 flex items-center justify-center text-white font-bold text-lg">
                {publisherName.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <User className="w-4 h-4 text-blue-600" />
                  <span className="font-semibold text-gray-900">{publisherName}</span>
                </div>
                <div className="flex items-center gap-2">
                  <AtSign className="w-4 h-4 text-purple-600" />
                  <span className="text-sm text-gray-600">{publisherEmail}</span>
                </div>
              </div>
              <div className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-semibold">
                Active
              </div>
            </div>
          </div>

          {/* Quick Templates */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-purple-600" />
              <Label className="text-sm font-semibold text-gray-700">Quick Templates</Label>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {templates.map((template, idx) => {
                const Icon = template.icon;
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      setSubject(template.subject);
                      setMessage(template.message);
                    }}
                    disabled={sending}
                    className="group relative overflow-hidden rounded-xl border-2 border-gray-200 hover:border-transparent transition-all duration-300 hover:scale-105 hover:shadow-lg"
                  >
                    <div className={`absolute inset-0 bg-gradient-to-br ${template.color} opacity-0 group-hover:opacity-100 transition-opacity duration-300`} />
                    <div className="relative p-4 flex flex-col items-center gap-2">
                      <div className="w-10 h-10 rounded-full bg-gray-100 group-hover:bg-white/20 flex items-center justify-center transition-colors duration-300">
                        <Icon className="w-5 h-5 text-gray-600 group-hover:text-white transition-colors duration-300" />
                      </div>
                      <span className="text-sm font-semibold text-gray-700 group-hover:text-white transition-colors duration-300">
                        {template.label}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Subject Input */}
          <div className="space-y-2">
            <Label htmlFor="subject" className="text-sm font-semibold text-gray-700">
              Subject Line *
            </Label>
            <div className="relative">
              <Input
                id="subject"
                placeholder="Enter a compelling subject line..."
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                maxLength={200}
                disabled={sending}
                className="pl-10 h-12 text-base border-2 focus:border-purple-500 focus:ring-purple-500"
              />
              <FileText className="absolute left-3 top-3.5 w-5 h-5 text-gray-400" />
            </div>
            <div className="flex justify-between items-center">
              <p className="text-xs text-gray-500">Make it catchy and clear</p>
              <p className={`text-xs font-medium ${
                subject.length > 180 ? 'text-red-600' : 'text-gray-500'
              }`}>
                {subject.length}/200
              </p>
            </div>
          </div>

          {/* Message Textarea */}
          <div className="space-y-2">
            <Label htmlFor="message" className="text-sm font-semibold text-gray-700">
              Your Message *
            </Label>
            <Textarea
              id="message"
              placeholder="Write your message here...\n\nTip: Be personal, clear, and actionable. Publishers appreciate direct communication!"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={10}
              maxLength={5000}
              disabled={sending}
              className="resize-none text-base border-2 focus:border-purple-500 focus:ring-purple-500 leading-relaxed"
            />
            <div className="flex justify-between items-center">
              <p className="text-xs text-gray-500">Use line breaks for better readability</p>
              <p className={`text-xs font-medium ${
                message.length > 4500 ? 'text-red-600' : 'text-gray-500'
              }`}>
                {message.length}/5000
              </p>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="bg-gray-50 px-6 py-4 border-t flex justify-between items-center">
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span>Ready to send</span>
          </div>
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={handleClose}
              disabled={sending}
              className="px-6"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSend}
              disabled={sending || !subject.trim() || !message.trim()}
              className="px-8 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold shadow-lg hover:shadow-xl transition-all duration-300"
            >
              {sending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4 mr-2" />
                  Send Email
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
