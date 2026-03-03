import React, { useState, useRef } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { placementProofApi } from '@/services/placementProofApi';
import {
  Camera, Upload, X, CheckCircle2, Loader2, ImagePlus, Link, Star,
} from 'lucide-react';

interface PlacementProofPopupProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  offer: { offer_id: string; name: string } | null;
  onSubmitted?: () => void;
}

export const PlacementProofPopup: React.FC<PlacementProofPopupProps> = ({
  open, onOpenChange, offer, onSubmitted,
}) => {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [images, setImages] = useState<string[]>([]);
  const [placementUrl, setPlacementUrl] = useState('');
  const [trafficSource, setTrafficSource] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    Array.from(files).forEach((file) => {
      if (images.length >= 5) return;
      const reader = new FileReader();
      reader.onload = () => {
        setImages((prev) => [...prev, reader.result as string].slice(0, 5));
      };
      reader.readAsDataURL(file);
    });
    e.target.value = '';
  };

  const removeImage = (idx: number) => {
    setImages((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = async () => {
    if (!offer) return;
    if (images.length === 0 && !placementUrl) {
      toast({ title: 'Please add at least one screenshot or placement URL', variant: 'destructive' });
      return;
    }
    setSubmitting(true);
    try {
      await placementProofApi.submitProof({
        offer_id: offer.offer_id,
        offer_name: offer.name,
        description,
        placement_url: placementUrl,
        traffic_source: trafficSource,
        base64_images: images,
      });
      setSubmitted(true);
      toast({ title: 'Proof submitted', description: 'Your placement proof has been submitted for review.' });
      onSubmitted?.();
    } catch (err: any) {
      toast({ title: 'Failed to submit', description: err.message, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    setImages([]);
    setPlacementUrl('');
    setTrafficSource('');
    setDescription('');
    setSubmitted(false);
    onOpenChange(false);
  };

  if (!offer) return null;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent
        className="max-w-lg border-0 p-0 overflow-hidden"
        style={{
          background: 'rgba(255,255,255,0.12)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          border: '1px solid rgba(255,255,255,0.2)',
          boxShadow: '0 25px 50px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.15)',
        }}
      >
        {/* Gradient top bar */}
        <div className="h-1 w-full bg-gradient-to-r from-violet-500 via-purple-500 to-fuchsia-500" />

        <div className="p-6">
          <DialogHeader className="mb-5">
            <DialogTitle className="flex items-center gap-2 text-white">
              <div className="p-2 rounded-lg bg-violet-500/30 border border-violet-400/30">
                <Camera className="h-4 w-4 text-violet-300" />
              </div>
              Submit Placement Proof
            </DialogTitle>
            <DialogDescription className="text-white/60 text-sm">
              Show us where you're promoting{' '}
              <span className="text-violet-300 font-medium">{offer.name}</span>.
              Good proofs earn you a higher publisher score.
            </DialogDescription>
          </DialogHeader>

          {submitted ? (
            <div className="flex flex-col items-center py-8 gap-3">
              <div className="p-4 rounded-full bg-green-500/20 border border-green-400/30">
                <CheckCircle2 className="h-12 w-12 text-green-400" />
              </div>
              <p className="text-lg font-semibold text-white">Proof Submitted!</p>
              <p className="text-sm text-white/60 text-center max-w-xs">
                Our team will review your placement. Good placements earn you a higher score and priority access.
              </p>
              <div className="flex items-center gap-1 mt-2">
                {[1, 2, 3, 4, 5].map((s) => (
                  <Star key={s} className="h-4 w-4 text-yellow-400 fill-yellow-400" />
                ))}
                <span className="text-xs text-white/50 ml-1">Publisher Score</span>
              </div>
              <Button
                onClick={handleClose}
                className="mt-4 bg-violet-600 hover:bg-violet-700 text-white border-0"
              >
                Done
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Screenshots */}
              <div className="space-y-2">
                <Label className="text-white/80 text-sm">Screenshots (up to 5)</Label>
                <div className="flex flex-wrap gap-2">
                  {images.map((img, idx) => (
                    <div key={idx} className="relative w-20 h-20 rounded-xl overflow-hidden border border-white/20 group">
                      <img src={img} alt="" className="w-full h-full object-cover" />
                      <button
                        onClick={() => removeImage(idx)}
                        className="absolute top-0.5 right-0.5 bg-black/60 rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="h-3 w-3 text-white" />
                      </button>
                    </div>
                  ))}
                  {images.length < 5 && (
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="w-20 h-20 rounded-xl border-2 border-dashed border-white/20 flex flex-col items-center justify-center text-white/40 hover:border-violet-400/60 hover:text-violet-300 transition-all"
                    >
                      <ImagePlus className="h-5 w-5" />
                      <span className="text-[10px] mt-1">Add</span>
                    </button>
                  )}
                </div>
                <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleFileSelect} />
              </div>

              {/* Placement URL */}
              <div className="space-y-2">
                <Label className="text-white/80 text-sm">Placement URL</Label>
                <div className="relative">
                  <Link className="absolute left-3 top-2.5 h-4 w-4 text-white/40" />
                  <Input
                    placeholder="https://yoursite.com/offer-page"
                    value={placementUrl}
                    onChange={(e) => setPlacementUrl(e.target.value)}
                    className="pl-9 bg-white/10 border-white/20 text-white placeholder:text-white/30 focus:border-violet-400/60 focus:ring-violet-400/20"
                  />
                </div>
              </div>

              {/* Traffic Source */}
              <div className="space-y-2">
                <Label className="text-white/80 text-sm">Traffic Source</Label>
                <Select value={trafficSource} onValueChange={setTrafficSource}>
                  <SelectTrigger className="bg-white/10 border-white/20 text-white focus:border-violet-400/60">
                    <SelectValue placeholder="Where are you promoting?" className="text-white/40" />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-900/95 border-white/20 text-white">
                    <SelectItem value="website">Website / Blog</SelectItem>
                    <SelectItem value="social_media">Social Media</SelectItem>
                    <SelectItem value="email">Email Marketing</SelectItem>
                    <SelectItem value="push">Push Notifications</SelectItem>
                    <SelectItem value="native_ads">Native Ads</SelectItem>
                    <SelectItem value="search">Search / SEO</SelectItem>
                    <SelectItem value="app">Mobile App</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Notes */}
              <div className="space-y-2">
                <Label className="text-white/80 text-sm">Notes (optional)</Label>
                <Textarea
                  placeholder="Any additional details about your placement..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                  className="bg-white/10 border-white/20 text-white placeholder:text-white/30 focus:border-violet-400/60 resize-none"
                />
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-2 pt-2">
                <Button
                  variant="outline"
                  onClick={handleClose}
                  className="border-white/20 text-white/70 bg-white/5 hover:bg-white/10 hover:text-white"
                >
                  Skip
                </Button>
                <Button
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white border-0 shadow-lg shadow-violet-500/25"
                >
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Upload className="h-4 w-4 mr-2" />}
                  Submit Proof
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
