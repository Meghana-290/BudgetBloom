import React, { useState, useEffect } from 'react';

interface TransparentCutoutProps {
  src: string;
  alt: string;
  className?: string;
  threshold?: number; // 0-255, defaults to 242
}

export default function TransparentCutout({
  src,
  alt,
  className = '',
  threshold = 242,
}: TransparentCutoutProps) {
  const [processedSrc, setProcessedSrc] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const img = new Image();
    img.crossOrigin = 'anonymous'; // Safe to use as it is local root resource
    img.src = src;

    img.onload = () => {
      try {
        // Create offscreen canvas to process the pixels
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          setProcessedSrc(src);
          setLoading(false);
          return;
        }

        ctx.drawImage(img, 0, 0);

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;

        // Dynamic Chroma-Keying for White/Light Backgrounds with Soft Alpha Falloff
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];

          // Ensure we only key out pixels where all red, green, and blue are very close to white
          if (r >= threshold && g >= threshold && b >= threshold) {
            const avg = (r + g + b) / 3;
            // Calculate linear alpha scale from the threshold to 255
            const alphaRange = 255 - threshold;
            const alpha = alphaRange > 0 
              ? Math.max(0, Math.min(255, Math.round(((255 - avg) / alphaRange) * 255)))
              : 0;

            // Set the alpha channel to be the minimum of original and keyed value
            data[i + 3] = Math.min(data[i + 3], alpha);
          }
        }

        ctx.putImageData(imageData, 0, 0);
        const dataUrl = canvas.toDataURL('image/png');
        setProcessedSrc(dataUrl);
      } catch (e) {
        console.warn("Failed to process cutout, falling back to original image", e);
        setProcessedSrc(src);
      }
      setLoading(false);
    };

    img.onerror = () => {
      setProcessedSrc(src);
      setLoading(false);
    };
  }, [src, threshold]);

  if (loading) {
    // Elegant minor low-profile pulse state while loading/processing
    return <div className={`animate-pulse bg-slate-100/5 rounded-2xl ${className}`} />;
  }

  return (
    <img
      src={processedSrc || src}
      alt={alt}
      referrerPolicy="no-referrer"
      className={`${className} transition-opacity duration-500 ease-out`}
    />
  );
}
