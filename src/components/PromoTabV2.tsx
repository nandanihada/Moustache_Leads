import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { redeemPromoCode, trackPromoEvent } from '@/services/promoServiceV2';
import { Zap, CheckCircle, XCircle } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

const PromoTabV2 = () => {
  const { user } = useAuth();
  const [code, setCode] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');

  useEffect(() => {
    trackPromoEvent('PROMO_TAB_OPENED', { status: 'opened' });
  }, []);

  const handleRedeem = async () => {
    if (!code.trim()) {
      setStatus('error');
      setMessage('Please enter a promo code');
      return;
    }

    setStatus('loading');
    setMessage('');

    const res = await redeemPromoCode(code);
    if (res.success) {
      setStatus('success');
      setMessage(res.message || 'Promo code successfully redeemed!');
      trackPromoEvent('PROMO_REDEEM_SUCCESS', {
        promoCode: code,
        status: 'success'
      });
      if (res.redirect_url) {
        setTimeout(() => {
          window.location.href = res.redirect_url as string;
        }, 1500);
      }
    } else {
      setStatus('error');
      const errMsg = res.error || 'Failed to redeem promo code';
      setMessage(errMsg);
      trackPromoEvent('PROMO_REDEEM_FAILED', {
        promoCode: code,
        status: 'failed',
        failureReason: errMsg
      });
    }
  };

  return (
    <Card className="w-full max-w-lg shadow-sm border-slate-200">
      <CardHeader className="bg-slate-50 border-b border-slate-100 pb-6 rounded-t-xl">
        <div className="flex items-center gap-3 mb-2">
          <div className="bg-blue-100 p-2 rounded-lg">
            <Zap className="text-blue-600 h-5 w-5" />
          </div>
          <CardTitle className="text-xl font-bold text-slate-800">Redeem Direct Promo</CardTitle>
        </div>
        <CardDescription className="text-slate-500">
          Enter your promotional code below to unlock bonuses, special offers, or direct payouts.
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-6 space-y-4">
        <div className="space-y-2">
          <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Promo Code</label>
          <div className="flex gap-2">
            <Input 
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="e.g. SUMMER50"
              className="font-mono text-lg tracking-wider bg-white h-12 border-slate-200 focus-visible:ring-blue-500"
              disabled={status === 'loading' || status === 'success'}
            />
          </div>
        </div>

        {message && (
          <div className={`p-4 flex items-start gap-3 rounded-xl border \${status === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-rose-50 border-rose-200 text-rose-800'}`}>
            {status === 'success' ? <CheckCircle className="h-5 w-5 shrink-0 mt-0.5" /> : <XCircle className="h-5 w-5 shrink-0 mt-0.5" />}
            <span className="text-sm font-medium">{message}</span>
          </div>
        )}
      </CardContent>
      <CardFooter className="bg-slate-50 border-t border-slate-100 rounded-b-xl py-4 flex flex-col sm:flex-row gap-3">
        <Button 
          variant="outline" 
          className="w-full sm:w-1/3 hover:bg-slate-100 font-bold border-slate-200 text-slate-700 h-11"
          onClick={() => {
            setCode('');
            setStatus('idle');
            setMessage('');
          }}
          disabled={status === 'loading'}
        >
          Clear
        </Button>
        <Button 
          onClick={handleRedeem}
          disabled={!code.trim() || status === 'loading' || status === 'success'}
          className="w-full sm:flex-1 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold h-11 shadow-md shadow-blue-500/20 transition-all disabled:opacity-50"
        >
          {status === 'loading' ? 'Verifying...' : 'Redeem Now'}
        </Button>
      </CardFooter>
    </Card>
  );
};

export default PromoTabV2;
