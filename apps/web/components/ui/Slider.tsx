'use client';

import React, { useCallback, useEffect, useState } from 'react';
import useEmblaCarousel from 'embla-carousel-react';
import Autoplay from 'embla-carousel-autoplay';
import type { Announcement } from '@ajitsir/shared';

// ─── YouTube URL Parser ────────────────────────────────────────────────────────
// Handles all YouTube URL formats:
//   https://youtu.be/VIDEO_ID
//   https://www.youtube.com/watch?v=VIDEO_ID
//   https://www.youtube.com/watch?v=VIDEO_ID&feature=share
//   https://www.youtube.com/shorts/VIDEO_ID
//   https://www.youtube.com/embed/VIDEO_ID (passthrough)
function extractYouTubeId(url: string): string | null {
  const patterns = [
    /youtu\.be\/([\w-]+)/,
    /youtube\.com\/watch\?.*v=([\w-]+)/,
    /youtube\.com\/shorts\/([\w-]+)/,
    /youtube\.com\/embed\/([\w-]+)/,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match?.[1]) return match[1];
  }
  return null;
}

function buildEmbedUrl(youtubeUrl: string): string | null {
  const id = extractYouTubeId(youtubeUrl);
  if (!id) return null;
  return `https://www.youtube.com/embed/${id}?rel=0&modestbranding=1`;
}

interface SliderProps {
  announcements: Announcement[];
}

export default function Slider({ announcements }: SliderProps) {
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: true }, [
    Autoplay({ delay: 5000, stopOnInteraction: true }),
  ]);
  const [selectedIndex, setSelectedIndex] = useState(0);

  const onSelect = useCallback(() => {
    if (!emblaApi) return;
    setSelectedIndex(emblaApi.selectedScrollSnap());
  }, [emblaApi, setSelectedIndex]);

  useEffect(() => {
    if (!emblaApi) return;
    onSelect();
    emblaApi.on('select', onSelect);
    emblaApi.on('reInit', onSelect);
  }, [emblaApi, onSelect]);

  if (!announcements || announcements.length === 0) return null;

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

  return (
    <div className="slider-container">
      <div className="embla" ref={emblaRef}>
        <div className="embla__container">
          {announcements.map((ann) => (
            <div className="embla__slide" key={ann.id}>
              {ann.type === 'VIDEO' && ann.youtubeUrl ? (
                <div className="slide-video-wrapper">
                  {buildEmbedUrl(ann.youtubeUrl) ? (
                    <iframe
                      src={buildEmbedUrl(ann.youtubeUrl)!}
                      title={ann.title}
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                      className="slide-iframe"
                      loading="lazy"
                    />
                  ) : (
                    // Fallback for invalid / unrecognised YouTube URLs
                    <div className="slide-content">
                      <h2 className="slide-title font-serif">{ann.title}</h2>
                      {ann.description && <p className="slide-desc">{ann.description}</p>}
                      <p className="slide-desc" style={{ opacity: 0.5, fontSize: '0.8rem', marginTop: '0.5rem' }}>Video unavailable — invalid URL</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="slide-image-wrapper">
                  <img 
                    src={`${apiUrl}/api/announcements/${ann.id}/image`} 
                    alt={ann.title} 
                    className="slide-image" 
                    loading="lazy" 
                  />
                  <div className="slide-image-overlay">
                    <h2 className="slide-title font-serif">{ann.title}</h2>
                    {ann.description && <p className="slide-desc">{ann.description}</p>}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Manual Controls */}
      <button className="slider-btn slider-btn--prev" onClick={() => emblaApi?.scrollPrev()} aria-label="Previous slide">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
      </button>
      <button className="slider-btn slider-btn--next" onClick={() => emblaApi?.scrollNext()} aria-label="Next slide">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
      </button>

      {/* Dots */}
      <div className="slider-dots">
        {announcements.map((_, index) => (
          <button
            key={index}
            className={`slider-dot ${index === selectedIndex ? 'is-selected' : ''}`}
            onClick={() => emblaApi?.scrollTo(index)}
            aria-label={`Go to slide ${index + 1}`}
          />
        ))}
      </div>

      <style>{`
        .slider-container {
          position: relative;
          width: 100%;
          max-width: 1350px;
          margin: 0 auto;
          border-radius: 20px;
          overflow: hidden;
          background: #111;
          box-shadow: 0 10px 40px rgba(0,0,0,0.5);
          border: 1px solid rgba(255,255,255,0.05);
        }
        .embla {
          overflow: hidden;
        }
        .embla__container {
          display: flex;
        }
        .embla__slide {
          flex: 0 0 100%;
          min-width: 0;
          position: relative;
          aspect-ratio: 16/7;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .slide-content {
          padding: 2rem;
          text-align: center;
          width: 100%;
          height: 100%;
          display: flex;
          flex-direction: column;
          justify-content: center;
          background: linear-gradient(135deg, rgba(255,255,255,0.05) 0%, rgba(0,0,0,0) 100%);
        }
        .slide-title {
          font-size: clamp(1.5rem, 4vw, 3rem);
          font-weight: 700;
          color: white;
          margin-bottom: 1rem;
        }
        .slide-desc {
          font-size: clamp(0.9rem, 1.5vw, 1.2rem);
          color: rgba(255,255,255,0.7);
          max-width: 800px;
          margin: 0 auto;
        }
        .slide-video-wrapper {
          width: 100%;
          height: 100%;
        }
        .slide-iframe {
          width: 100%;
          height: 100%;
          border: none;
        }
        .slide-image-wrapper {
          width: 100%;
          height: 100%;
          position: relative;
        }
        .slide-image {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
        }
        .slide-image-overlay {
          position: absolute;
          bottom: 0; left: 0; right: 0;
          padding: 3rem 2rem 2rem 2rem;
          background: linear-gradient(to top, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0) 100%);
          text-align: center;
        }
        .slider-btn {
          position: absolute;
          top: 50%;
          transform: translateY(-50%);
          background: rgba(0,0,0,0.4);
          color: white;
          border: none;
          width: 48px;
          height: 48px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          backdrop-filter: blur(4px);
          transition: background 0.2s, transform 0.2s;
          z-index: 10;
        }
        .slider-btn:hover {
          background: rgba(0,0,0,0.7);
          transform: translateY(-50%) scale(1.1);
        }
        .slider-btn--prev { left: 1rem; }
        .slider-btn--next { right: 1rem; }

        .slider-dots {
          position: absolute;
          bottom: 1rem;
          left: 0;
          right: 0;
          display: flex;
          justify-content: center;
          gap: 0.5rem;
          padding: 0.5rem;
          pointer-events: none;
        }
        .slider-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: rgba(255,255,255,0.3);
          border: none;
          cursor: pointer;
          pointer-events: auto;
          transition: background 0.2s, transform 0.2s;
        }
        .slider-dot.is-selected {
          background: white;
          transform: scale(1.2);
        }
        @media (max-width: 768px) {
          .embla__slide { aspect-ratio: 16/9; }
          .slider-btn { display: none; }
        }
      `}</style>
    </div>
  );
}
