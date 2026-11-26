import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Camera, CameraOff, Maximize2, RotateCcw, X, ShieldAlert } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';

export interface EvidenceImageProps {
  src?: string | null;
  alt?: string;
  violationCode?: string;
  timestamp?: string | Date;
  className?: string;
  containerClassName?: string;
  aspectRatio?: '4/3' | '16/9' | 'square' | 'auto' | 'video' | string;
  maxHeight?: number | string;
  enableLightbox?: boolean;
  onError?: () => void;
  onLoad?: () => void;
}

export function EvidenceImage({
  src,
  alt,
  violationCode,
  timestamp,
  className = '',
  containerClassName = '',
  aspectRatio = 'auto',
  maxHeight,
  enableLightbox = true,
  onError,
  onLoad,
}: EvidenceImageProps) {
  const token = useAuthStore((s) => s.token);
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<boolean>(false);
  const [retryCount, setRetryCount] = useState<number>(0);
  const [isLightboxOpen, setIsLightboxOpen] = useState<boolean>(false);

  // Natural aspect ratio detected from image once loaded (default 4/3 per Phase 20 spec)
  const [naturalRatio, setNaturalRatio] = useState<string>('4/3');
  const [ratioMultiplier, setRatioMultiplier] = useState<number>(4 / 3);

  const activeBlobUrlRef = useRef<string | null>(null);

  const cleanupObjectUrl = useCallback(() => {
    if (activeBlobUrlRef.current) {
      URL.revokeObjectURL(activeBlobUrlRef.current);
      activeBlobUrlRef.current = null;
    }
  }, []);

  const fetchImage = useCallback(async () => {
    if (src === undefined || src === null) {
      setLoading(true);
      setError(false);
      return;
    }
    if (typeof src !== 'string' || !src.trim()) {
      setLoading(false);
      setError(true);
      onError?.();
      return;
    }

    const trimmed = src.trim();

    // Data URLs can be rendered directly
    if (trimmed.startsWith('data:image/')) {
      cleanupObjectUrl();
      setObjectUrl(trimmed);
      setLoading(false);
      setError(false);
      return;
    }

    setLoading(true);
    setError(false);

    try {
      const headers: Record<string, string> = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      // Resolve backend base URL if relative path
      const backendBase =
        import.meta.env.VITE_BACKEND_ORIGIN ||
        (import.meta.env.VITE_API_URL ? import.meta.env.VITE_API_URL.replace(/\/api\/?$/, '') : '');
      const targetUrl =
        trimmed.startsWith('http://') || trimmed.startsWith('https://')
          ? trimmed
          : backendBase
            ? `${backendBase}${trimmed.startsWith('/') ? trimmed : `/${trimmed}`}`
            : trimmed;

      const res = await fetch(targetUrl, {
        method: 'GET',
        headers,
      });

      if (!res.ok) {
        throw new Error(`Failed to load evidence snapshot: ${res.status} ${res.statusText}`);
      }

      const blob = await res.blob();
      cleanupObjectUrl();
      const url = URL.createObjectURL(blob);
      activeBlobUrlRef.current = url;
      setObjectUrl(url);
      setLoading(false);
      setError(false);
    } catch {
      cleanupObjectUrl();
      setObjectUrl(null);
      setLoading(false);
      setError(true);
      onError?.();
    }
  }, [src, token, cleanupObjectUrl, onError]);

  useEffect(() => {
    fetchImage();
    return () => {
      cleanupObjectUrl();
    };
  }, [fetchImage, retryCount, cleanupObjectUrl]);

  // Handle escape to close lightbox
  useEffect(() => {
    if (!isLightboxOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        setIsLightboxOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [isLightboxOpen]);

  const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    if (img.naturalWidth > 0 && img.naturalHeight > 0) {
      setNaturalRatio(`${img.naturalWidth} / ${img.naturalHeight}`);
      setRatioMultiplier(img.naturalWidth / img.naturalHeight);
    }
    setLoading(false);
    setError(false);
    onLoad?.();
  };

  const handleImageError = () => {
    setLoading(false);
    setError(true);
    onError?.();
  };

  const meaningfulAlt =
    alt ||
    `Violation evidence snapshot${violationCode ? ` for ${violationCode.replace(/_/g, ' ')}` : ''
    }${timestamp ? ` at ${new Date(timestamp).toLocaleTimeString()}` : ''}`;

  // Determine aspect ratio to apply
  let resolvedAspectRatio = naturalRatio;
  if (aspectRatio === 'square') {
    resolvedAspectRatio = '1 / 1';
  } else if (aspectRatio === '16/9' || aspectRatio === 'video') {
    resolvedAspectRatio = naturalRatio !== '4/3' ? naturalRatio : '16 / 9';
  } else if (aspectRatio === '4/3') {
    resolvedAspectRatio = '4 / 3';
  } else if (aspectRatio !== 'auto') {
    resolvedAspectRatio = aspectRatio;
  }

  // Detect custom dimension constraints from containerClassName
  const hasFixedW = /\b(w-\d+|w-\[.+\])\b/.test(containerClassName);
  const hasFixedH = /\b(h-\d+|h-\[.+\])\b/.test(containerClassName);

  // Parse maxHeight prop if passed
  const parsedMaxHeightPx =
    typeof maxHeight === 'number'
      ? maxHeight
      : typeof maxHeight === 'string' && maxHeight.endsWith('px')
        ? parseInt(maxHeight, 10)
        : undefined;

  // Exact width calculation when maxHeight is capped to keep the frame matching the image without black bars
  let computedWidth: string | undefined = hasFixedW ? undefined : '100%';
  if (parsedMaxHeightPx && !hasFixedW) {
    computedWidth = `min(100%, ${Math.round(parsedMaxHeightPx * ratioMultiplier)}px)`;
  }

  return (
    <>
      <div
        data-testid="evidence-image-container"
        className={`evidence-image-wrapper relative overflow-hidden rounded-[12px] border border-border bg-[#0c0d12] dark:bg-[#090a0f] text-foreground flex items-center justify-center min-w-0 max-w-full ${enableLightbox ? 'group cursor-zoom-in' : ''
          } ${containerClassName}`}
        onClick={enableLightbox ? () => setIsLightboxOpen(true) : undefined}
        style={{
          aspectRatio: hasFixedH ? undefined : resolvedAspectRatio,
          maxHeight: maxHeight ? (typeof maxHeight === 'number' ? `${maxHeight}px` : maxHeight) : undefined,
          width: computedWidth,
          marginLeft: 'auto',
          marginRight: 'auto',
        }}
      >
        {/* Loading Skeleton */}
        {loading && (
          <div
            data-testid="evidence-image-loading"
            className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 bg-surface-elevated/70 animate-pulse text-muted-foreground p-3 z-10 pointer-events-none"
          >
            <Camera className="w-5 h-5 text-brand/70 animate-bounce" />
            <span className="text-[10px] font-mono tracking-wider uppercase">
              Loading optical evidence...
            </span>
          </div>
        )}

        {/* Error Placeholder */}
        {!loading && error && (
          <div
            data-testid="evidence-image-error"
            className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-3 text-center text-muted-foreground select-none w-full h-full z-10"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-2 rounded-xl bg-rose-500/10 text-rose-500 border border-rose-500/20">
              <CameraOff className="w-4 h-4" />
            </div>
            <div className="space-y-0.5">
              <p className="text-xs font-semibold text-foreground">Snapshot unavailable</p>
              <p className="text-[10px] font-mono text-muted-foreground">
                Optical frame could not be retrieved
              </p>
            </div>
            <button
              type="button"
              data-testid="evidence-image-retry-btn"
              onClick={(e) => {
                e.stopPropagation();
                setRetryCount((c) => c + 1);
              }}
              className="mt-1 flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-mono font-medium border border-border bg-surface hover:bg-muted text-foreground transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Retry</span>
            </button>
          </div>
        )}

        {/* Successfully Loaded Snapshot */}
        {objectUrl && (
          <img
            src={objectUrl}
            alt={meaningfulAlt}
            onLoad={handleImageLoad}
            onError={handleImageError}
            className={`absolute inset-0 w-full h-full object-contain block m-auto select-none transition-transform duration-200 ${enableLightbox ? 'group-hover:scale-[1.02]' : ''
              } ${className}`}
            style={{
              maxWidth: '100%',
              maxHeight: '100%',
            }}
          />
        )}

        {/* Hover Zoom Overlay */}
        {enableLightbox && !loading && !error && (
          <div
            title="Click to view enlarged snapshot"
            className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none z-10"
          >
            <div className="p-2 rounded-xl bg-black/70 backdrop-blur-md text-white border border-border shadow-xl flex items-center gap-1.5 text-xs font-mono">
              <Maximize2 className="w-3.5 h-3.5 text-brand" />
              <span>Enlarge Snapshot</span>
            </div>
          </div>
        )}
      </div>

      {/* Lightbox Modal Portal */}
      {isLightboxOpen &&
        objectUrl &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            data-testid="evidence-image-lightbox"
            role="dialog"
            aria-modal="true"
            aria-label="Enlarged Evidence Snapshot"
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-black/85 backdrop-blur-md animate-in fade-in duration-150"
            onClick={() => setIsLightboxOpen(false)}
          >
            <div
              className="relative max-w-4xl w-full bg-surface dark:bg-[#11121c] border border-border rounded-2xl p-4 sm:p-5 shadow-2xl space-y-3.5 text-foreground"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Lightbox Header */}
              <div className="flex items-center justify-between border-b border-border pb-3">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-rose-500/10 text-rose-500 border border-rose-500/20">
                    <ShieldAlert className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-foreground">
                      {violationCode
                        ? violationCode.replace(/_/g, ' ')
                        : 'Optical Evidence Snapshot'}
                    </h3>
                    <p className="text-[11px] font-mono text-muted-foreground">
                      ProctorIQ Forensic Evidence Stream • High Resolution Capture
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  data-testid="evidence-lightbox-close-btn"
                  onClick={() => setIsLightboxOpen(false)}
                  className="p-1.5 rounded-xl border border-border hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                  aria-label="Close enlarged snapshot"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Lightbox Image Container */}
              <div className="relative rounded-xl border border-border bg-black/60 overflow-hidden max-h-[75vh] flex items-center justify-center p-1">
                <img
                  src={objectUrl}
                  alt={meaningfulAlt}
                  className="max-h-[72vh] w-auto max-w-full object-contain block mx-auto rounded-lg"
                />
              </div>

              {/* Lightbox Footer metadata */}
              <div className="flex items-center justify-between text-[11px] font-mono text-muted-foreground pt-1">
                <span>
                  Captured Frame •{' '}
                  {timestamp
                    ? new Date(timestamp).toLocaleString()
                    : new Date().toLocaleDateString()}
                </span>
                <span className="text-brand font-semibold">Verified Optical Capture</span>
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
