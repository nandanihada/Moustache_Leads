import { useEffect, useCallback, useRef } from 'react';

/**
 * useImagePaste - Reusable hook for Ctrl+V image paste functionality.
 * 
 * Listens for paste events and extracts image files from clipboard.
 * Works with both FormData-based uploads and Base64-based uploads.
 * 
 * @param onPaste - Callback receiving the pasted File
 * @param options - Configuration options
 * @param options.enabled - Whether paste listening is active (default: true)
 * @param options.targetRef - Optional ref to scope paste events to a specific element
 * @param options.maxSizeMB - Max file size in MB (default: 5)
 * @param options.allowedTypes - Allowed MIME types (default: common image types)
 * @param options.onError - Error callback
 */
interface UseImagePasteOptions {
  enabled?: boolean;
  targetRef?: React.RefObject<HTMLElement | null>;
  maxSizeMB?: number;
  allowedTypes?: string[];
  onError?: (message: string) => void;
}

export function useImagePaste(
  onPaste: (file: File) => void,
  options: UseImagePasteOptions = {}
) {
  const {
    enabled = true,
    targetRef,
    maxSizeMB = 5,
    allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp'],
    onError,
  } = options;

  const onPasteRef = useRef(onPaste);
  onPasteRef.current = onPaste;

  const handlePaste = useCallback((e: ClipboardEvent) => {
    if (!enabled) return;

    const items = e.clipboardData?.items;
    if (!items) return;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.kind === 'file' && item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (!file) continue;

        // Validate type
        if (!allowedTypes.includes(file.type)) {
          onError?.(`File type ${file.type} not allowed. Allowed: ${allowedTypes.join(', ')}`);
          return;
        }

        // Validate size
        const maxBytes = maxSizeMB * 1024 * 1024;
        if (file.size > maxBytes) {
          onError?.(`Image too large. Max ${maxSizeMB}MB`);
          return;
        }

        e.preventDefault();
        onPasteRef.current(file);
        return;
      }
    }
  }, [enabled, maxSizeMB, allowedTypes, onError]);

  useEffect(() => {
    if (!enabled) return;

    const target = targetRef?.current || document;
    target.addEventListener('paste', handlePaste as EventListener);
    return () => {
      target.removeEventListener('paste', handlePaste as EventListener);
    };
  }, [enabled, handlePaste, targetRef]);
}

/**
 * Helper: Convert a File to base64 data URL string
 */
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}
