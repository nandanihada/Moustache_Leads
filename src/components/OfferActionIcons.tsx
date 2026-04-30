/**
 * OfferActionIcons — Inline action icons for each offer in email send modals
 * Uses existing ImagePickerComponent, DescriptionGeneratorComponent, VerticalSuggesterComponent
 * All pickers open in Dialog modals to avoid overflow/clipping issues.
 */
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { adminOfferApi } from '@/services/adminOfferApi';
import LinkMasker from '@/components/LinkMasker';
import { ImagePickerComponent } from '@/components/ImagePickerComponent';
import { DescriptionGeneratorComponent } from '@/components/DescriptionGeneratorComponent';
import { VerticalSuggesterComponent } from '@/components/VerticalSuggesterComponent';

interface OfferActionIconsProps {
  offerId: string;
  offerName: string;
  currentImageUrl?: string;
  currentDescription?: string;
  currentCategory?: string;
  currentPreviewUrl2?: string;
  onOfferUpdated?: (offerId: string, field: string, value: string) => void;
  onApplyPreviewToAll?: (maskedUrl: string) => void;
  showApplyToAll?: boolean;
}

type ActivePicker = 'image' | 'description' | 'vertical' | null;

export default function OfferActionIcons({
  offerId, offerName, currentImageUrl = '', currentDescription = '',
  currentCategory = '', currentPreviewUrl2 = '', onOfferUpdated,
  onApplyPreviewToAll, showApplyToAll = false,
}: OfferActionIconsProps) {
  const [activePicker, setActivePicker] = useState<ActivePicker>(null);

  return (
    <div className="shrink-0" onClick={e => e.stopPropagation()}>
      {/* Icon buttons row */}
      <div className="flex items-center gap-0.5">
        {/* Link Masker */}
        <LinkMasker offerId={offerId} offerName={offerName} label="Preview 2" size="sm"
          tooltip="Create tracked preview link (saved as Preview 2)"
          onMasked={async (maskedUrl) => {
            try {
              await adminOfferApi.updateOffer(offerId, { preview_url_2: maskedUrl } as any);
              toast.success('Preview link saved');
              if (onOfferUpdated) onOfferUpdated(offerId, 'preview_url_2', maskedUrl);
              if (showApplyToAll && onApplyPreviewToAll) {
                setTimeout(() => {
                  if (confirm('Apply this preview link to all selected offers?')) {
                    onApplyPreviewToAll(maskedUrl);
                  }
                }, 500);
              }
            } catch { toast.error('Failed to save preview link'); }
          }} />

        {/* Image */}
        <Button size="sm" variant="ghost" className="h-7 px-1.5 hover:bg-transparent hover:scale-110 transition-transform"
          onClick={() => setActivePicker('image')} title="Image">
          <img src="https://i.postimg.cc/rwr2vdT6/polaroid.png" alt="Image" className="w-5 h-5 object-contain" />
        </Button>

        {/* Description */}
        <Button size="sm" variant="ghost" className="h-7 px-1.5 hover:bg-transparent hover:scale-110 transition-transform"
          onClick={() => setActivePicker('description')} title="Description">
          <img src="https://i.postimg.cc/XB0zjj5r/description.png" alt="Description" className="w-5 h-5 object-contain" />
        </Button>

        {/* Vertical */}
        <Button size="sm" variant="ghost" className="h-7 px-1.5 hover:bg-transparent hover:scale-110 transition-transform"
          onClick={() => setActivePicker('vertical')} title="Vertical">
          <img src="https://i.postimg.cc/bw1GTwsg/categorization.png" alt="Vertical" className="w-5 h-5 object-contain" />
        </Button>

        {/* Preview 2 indicator */}
        {currentPreviewUrl2 && (
          <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-indigo-100 text-indigo-700 font-medium ml-0.5" title={currentPreviewUrl2}>🔗 P2</span>
        )}
      </div>

      {/* Image Picker Dialog */}
      <Dialog open={activePicker === 'image'} onOpenChange={v => { if (!v) setActivePicker(null); }}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-sm flex items-center gap-2">
              <img src="https://i.postimg.cc/rwr2vdT6/polaroid.png" alt="" className="w-5 h-5" />
              Image — {offerName}
            </DialogTitle>
          </DialogHeader>
          <ImagePickerComponent
            offerName={offerName}
            vertical={currentCategory}
            onImageSelected={async (url, source) => {
              try {
                await adminOfferApi.updateOffer(offerId, { image_url: url });
                adminOfferApi.logImageUpdate(offerId, offerName, url, source).catch(() => {});
                toast.success('Image updated');
                if (onOfferUpdated) onOfferUpdated(offerId, 'image', url);
                setActivePicker(null);
              } catch { toast.error('Failed to update image'); }
            }}
          />
        </DialogContent>
      </Dialog>

      {/* Description Generator Dialog */}
      <Dialog open={activePicker === 'description'} onOpenChange={v => { if (!v) setActivePicker(null); }}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-sm flex items-center gap-2">
              <img src="https://i.postimg.cc/XB0zjj5r/description.png" alt="" className="w-5 h-5" />
              Description — {offerName}
            </DialogTitle>
          </DialogHeader>
          <DescriptionGeneratorComponent
            offerName={offerName}
            existingDescription={currentDescription}
            vertical={currentCategory}
            onDescriptionSaved={async (newDesc) => {
              try {
                await adminOfferApi.updateOffer(offerId, { description: newDesc } as any);
                toast.success('Description updated');
                if (onOfferUpdated) onOfferUpdated(offerId, 'description', newDesc);
                setActivePicker(null);
              } catch { toast.error('Failed to update description'); }
            }}
          />
        </DialogContent>
      </Dialog>

      {/* Vertical Suggester Dialog */}
      <Dialog open={activePicker === 'vertical'} onOpenChange={v => { if (!v) setActivePicker(null); }}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-sm flex items-center gap-2">
              <img src="https://i.postimg.cc/bw1GTwsg/categorization.png" alt="" className="w-5 h-5" />
              Vertical — {offerName}
            </DialogTitle>
          </DialogHeader>
          <VerticalSuggesterComponent
            offerName={offerName}
            description={currentDescription}
            currentVertical={currentCategory}
            onVerticalSaved={async (newVertical) => {
              try {
                await adminOfferApi.updateOffer(offerId, { vertical: newVertical, category: newVertical } as any);
                toast.success('Vertical updated');
                if (onOfferUpdated) onOfferUpdated(offerId, 'category', newVertical);
                setActivePicker(null);
              } catch { toast.error('Failed to update vertical'); }
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
