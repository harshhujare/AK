'use client';

import React, { useCallback, useEffect, useState } from 'react';
import useEmblaCarousel from 'embla-carousel-react';
import Autoplay from 'embla-carousel-autoplay';
import type { Announcement } from '@ajitsir/shared';

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

  return (
    <div className="slider-container">
      <div className="embla" ref={emblaRef}>
        <div className="embla__container">
          {announcements.map((ann) => (
            <div className="embla__slide" key={ann.id}>
              {ann.type === 'VIDEO' && ann.youtubeUrl ? (
                <div className="slide-video-wrapper">
                  <iframe
                    src={ann.youtubeUrl.replace('watch?v=', 'embed/')}
                    title={ann.title}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    className="slide-iframe"
                  />
                </div>
              ) : (
                <div className="slide-content">
                  <h2 className="slide-title font-serif">{ann.title}</h2>
                  {ann.description && <p className="slide-desc">{ann.description}</p>}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

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
          max-width: 1200px;
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
          aspect-ratio: 21/9;
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
        }
      `}</style>
    </div>
  );
}
