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
import { Badge } from '@/components/ui/badge';
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
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Camera className="h-5 w-5 text-primary" />
            Submit Placement Proof
          </DialogTitle>
          <DialogDescription>
            Show us where you're promoting <span className="font-medium">{offer.name}</span>. Good proofs earn you a higher publisher score.
          </DialogDescription>
        </DialogHeader>

        {submitted ? (
          <div className="flex flex-col items-center py-8 gap-3">
            <CheckCircle2 className="h-16 w-16 text-green-500" />
            <p className="text-lg font-medium">Proof Submitted</p>
            <p className="text-sm text-muted-foreground text-center">
              Our team will review your placement. Good placements earn you a higher score and priority access.
            </p>
            <div className="flex items-center gap-1 mt-2">
              {[1, 2, 3, 4, 5].map((s) => (
                <Star key={s} className="h-4 w-4 text-yellow-400 fill-yellow-400" />
              ))}
              <span className="text-xs text-muted-foreground ml-1">Publisher Score</span>
            </div>
            <Button onClick={handleClose} className="mt-4">Done</Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Screenshots (up to 5)</Label>
              <div className="flex flex-wrap gap-2">
                {images.map((img, idx) => (
                  <div key={idx} className="relative w-20 h-20 rounded-lg overflow-hidden border group">
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
                    className="w-20 h-20 rounded-lg border-2 border-dashed flex flex-col items-center justify-center text-muted-foreground hover:border-primary hover:text-primary transition-colors"
                  >
                    <ImagePlus className="h-5 w-5" />
                    <span className="text-[10px] mt-1">Add</span>
                  </button>
                )}
              </div>
              <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleFileSelect} />
            </div>

            <div className="space-y-2">
              <Label>Placement URL</Label>
              <div className="relative">
                <Link className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="https://yoursite.com/offer-page"
                  value={placementUrl}
                  onChange={(e) => setPlacementUrl(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Traffic Source</Label>
              <Select value={trafficSource} onValueChange={setTrafficSource}>
                <SelectTrigger>
                  <SelectValue placeholder="Where are you promoting?" />
                </SelectTrigger>
                <SelectContent>
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

            <div className="space-y-2">
              <Label>Notes (optional)</Label>
              <Textarea
                placeholder="Any additional details about your placement..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={handleClose}>Skip</Button>
              <Button onClick={handleSubmit} disabled={submitting}>
                {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Upload className="h-4 w-4 mr-2" />}
                Submit Proof
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
