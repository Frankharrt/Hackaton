import React, { useState, useEffect, useRef } from 'react';
import { Photo } from '../types';
import { X, Play, Pause, FastForward, Rewind, Volume2, VolumeX } from 'lucide-react';

interface SlideshowProps {
  photos: Photo[];
  onClose: () => void;
  audioUrl: string | null;
  volume: number;
}

const Slideshow: React.FC<SlideshowProps> = ({ photos, onClose, audioUrl, volume }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [splitRatio, setSplitRatio] = useState(25); 
  const [isDragging, setIsDragging] = useState(false);
  
  const audioRef = useRef<HTMLAudioElement>(null);
  const voiceRef = useRef<HTMLAudioElement>(null);

  const currentPhoto = photos[currentIndex];

  // Derived state for layout
  const showSingleColumn = splitRatio < 20;

  // Split photos for columns
  const evenPhotos = photos.filter((_, i) => i % 2 === 0);
  const oddPhotos = photos.filter((_, i) => i % 2 !== 0);

  // Auto-advance
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (isPlaying) {
      interval = setInterval(() => {
        setCurrentIndex((prev) => (prev + 1) % photos.length);
      }, 6000);
    }
    return () => clearInterval(interval);
  }, [isPlaying, photos.length]);

  // Audio Sync (Background Music)
  useEffect(() => {
    const playAudio = async () => {
      if (audioRef.current) {
        audioRef.current.volume = volume / 100;
        
        // Music plays if not muted, ignoring isPlaying state (slideshow pause) to keep ambiance
        if (!isAudioMuted) {
          try {
            await audioRef.current.play();
          } catch (e) {
            console.warn("Autoplay prevented or interrupted:", e);
          }
        } else {
          audioRef.current.pause();
        }
      }
    };
    playAudio();
  }, [isAudioMuted, volume, audioUrl]); // Removed isPlaying to keep music going when paused

  // Voice Sync (Narration)
  useEffect(() => {
    const playVoice = async () => {
      // Only attempt to play if we have the ref (meaning element is mounted due to valid URL)
      if (voiceRef.current && currentPhoto?.audioNarrationUrl) {
        if (isPlaying && !isAudioMuted) {
           try {
             await voiceRef.current.play();
           } catch (e) {
             console.warn("Voice autoplay prevented:", e);
           }
        } else {
           voiceRef.current.pause();
        }
      }
    };
    playVoice();
  }, [currentIndex, isPlaying, isAudioMuted, currentPhoto]);

  // Drag Resizer
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      const newRatio = (e.clientX / window.innerWidth) * 100;
      // Allow a wider range, but clamp
      setSplitRatio(Math.max(10, Math.min(50, newRatio)));
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      document.body.style.cursor = 'default';
    };

    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'col-resize';
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') setCurrentIndex(p => (p + 1) % photos.length);
      if (e.key === 'ArrowLeft') setCurrentIndex(p => (p - 1 + photos.length) % photos.length);
      if (e.key === ' ') setIsPlaying(p => !p);
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [photos.length, onClose]);

  if (!currentPhoto) return null;

  // Static Perforation Strip (Vertical)
  const PerforationStrip = () => (
    <div className="w-5 h-full bg-[#111] z-30 flex flex-col items-center overflow-hidden border-x border-slate-800/50 flex-shrink-0 shadow-lg relative">
       <div className="flex flex-col gap-3 py-1 w-full items-center h-full absolute top-0 bottom-0 justify-between">
          {Array.from({ length: 40 }).map((_, i) => (
            <div key={i} className="w-2.5 h-3.5 bg-white/20 rounded-[2px] flex-shrink-0" />
          ))}
       </div>
    </div>
  );

  // Horizontal Divider between frames (Moving - Matches Vertical Style)
  const FrameDivider = () => (
    <div className="h-6 w-full bg-[#111] z-20 flex items-center justify-center gap-3 border-y border-slate-800 shadow-md">
        {/* Horizontal holes matching the style of vertical ones */}
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i} className="w-3.5 h-2.5 bg-white/20 rounded-[2px]" />
        ))}
    </div>
  );

  // Animated Scroll Column
  const ScrollColumn = ({ 
    items, 
    direction, 
    allPhotos 
  }: { 
    items: Photo[], 
    direction: 'up' | 'down', 
    allPhotos: Photo[] 
  }) => {
    // Ensure we have enough items to scroll smoothly
    const displayItems = items.length > 0 ? [...items, ...items, ...items, ...items] : [];
    
    return (
      <div className="relative overflow-hidden h-full flex-1 bg-black group/col">
        <div 
          className={`flex flex-col w-full absolute left-0 right-0 ${direction === 'up' ? 'animate-scroll-up' : 'animate-scroll-down'} group-hover/col:play-state-paused`}
        >
          {displayItems.map((photo, i) => {
            const originalIndex = allPhotos.findIndex(p => p.id === photo.id);
            const isActive = originalIndex === currentIndex;
            
            return (
              <React.Fragment key={`${photo.id}-${i}`}>
                <div 
                  onClick={() => setCurrentIndex(originalIndex)}
                  className={`relative cursor-pointer transition-all duration-300 hover:z-10 bg-[#050505] p-1 ${
                    isActive 
                      ? 'ring-2 ring-inset ring-slate-200 shadow-[0_0_12px_rgba(255,255,255,0.6)] opacity-100 z-10' 
                      : 'opacity-60 hover:opacity-100'
                  }`}
                >
                  <img 
                    src={photo.url} 
                    className="w-full aspect-[3/4] object-cover bg-slate-900 border border-slate-800"
                    loading="lazy"
                    style={{ filter: isActive ? 'none' : 'grayscale(100%) brightness(70%)' }}
                  />
                </div>
                <FrameDivider />
              </React.Fragment>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-black z-50 flex overflow-hidden font-sans select-none">
      {/* 
        CRITICAL FIX: Added 'key={audioUrl}'
        This forces React to destroy and recreate the Audio element whenever the URL changes.
        This prevents the "No supported source was found" error that occurs when swapping 
        between Remote URLs and Blob URLs on the same recycled audio element.
        Added autoPlay to ensure music starts.
      */}
      {audioUrl && (
        <audio 
          ref={audioRef} 
          src={audioUrl} 
          key={audioUrl} 
          loop 
          autoPlay
          style={{ display: 'none' }} 
        />
      )}
      
      {currentPhoto.audioNarrationUrl && (
        <audio 
          ref={voiceRef} 
          src={currentPhoto.audioNarrationUrl} 
          key={currentPhoto.id} // Re-mounts component when photo changes to ensure fresh state
        />
      )}

      {/* Close Button */}
      <button 
        onClick={onClose}
        className="absolute top-4 right-4 z-[60] text-white/50 hover:text-white bg-black/20 hover:bg-black/50 p-2 rounded-full backdrop-blur-md transition-all border border-white/10"
      >
        <X size={24} />
      </button>

      {/* LEFT PANEL: Responsive Stack */}
      <div 
        style={{ width: `${splitRatio}%` }} 
        className="relative bg-[#050505] flex h-full flex-shrink-0 z-20 shadow-[5px_0_30px_rgba(0,0,0,0.5)] overflow-hidden transition-[width] duration-75 ease-linear"
      >
        {showSingleColumn ? (
          // Single Column Layout (Contains ALL photos)
          <>
            <PerforationStrip />
            <ScrollColumn items={photos} direction="up" allPhotos={photos} />
            <PerforationStrip />
          </>
        ) : (
          // Dual Column Layout (Split photos)
          <>
            <PerforationStrip />
            <ScrollColumn items={evenPhotos} direction="up" allPhotos={photos} />
            <PerforationStrip />
            <ScrollColumn items={oddPhotos} direction="down" allPhotos={photos} />
            <PerforationStrip />
          </>
        )}
      </div>

      {/* DRAGGABLE HANDLE */}
      <div 
        className="w-1.5 bg-[#0a0a0a] hover:bg-indigo-500 cursor-col-resize z-50 flex items-center justify-center transition-colors shadow-[0_0_15px_rgba(0,0,0,0.8)] border-x border-slate-800"
        onMouseDown={() => setIsDragging(true)}
      >
        <div className="h-8 w-0.5 bg-slate-500 rounded-full" />
      </div>

      {/* RIGHT PANEL: Cinematic Slide */}
      <div className="flex-1 relative bg-black flex flex-col h-full overflow-hidden group/slide">
        
        {/* Background Blur - Brighter to fill dark space */}
        <div 
          className="absolute inset-0 bg-cover bg-center transition-all duration-1000 blur-3xl opacity-70 z-0 scale-110"
          style={{ backgroundImage: `url(${currentPhoto.url})` }} 
        />

        {/* Cinematic Vignette - Reduced opacity to let background show */}
        <div className="absolute inset-0 bg-radial-gradient from-transparent via-black/10 to-black/70 z-0 pointer-events-none" />

        {/* Main Content Container */}
        <div className="relative w-full h-full flex flex-col z-10">
          
          {/* Image Display Area - Maximized & Animated */}
          <div className="flex-1 min-h-0 flex items-center justify-center p-0 overflow-hidden relative">
             {/* Slide Background Container - Lighter overlay */}
             <div className="relative w-full h-full flex items-center justify-center bg-black/10 backdrop-blur-[1px] shadow-[inset_0_0_50px_rgba(0,0,0,0.3)]">
               <img 
                 key={currentPhoto.id}
                 src={currentPhoto.url} 
                 className="w-full h-full object-contain shadow-2xl drop-shadow-2xl animate-ken-burns"
                 style={{
                   filter: `
                    brightness(${currentPhoto.filters.brightness}%) 
                    contrast(${currentPhoto.filters.contrast}%) 
                    saturate(${currentPhoto.filters.saturation}%) 
                    blur(${currentPhoto.filters.blur}px) 
                    sepia(${currentPhoto.filters.sepia}%) 
                    grayscale(${currentPhoto.filters.grayscale}%)
                  `,
                  transformOrigin: 'center center' // Important for zoom
                 }}
               />
             </div>
          </div>

          {/* Floating Overlay: Narration & Hidden Controls - Lighter Gradient */}
          <div className="absolute bottom-0 left-0 right-0 z-50 flex flex-col items-center justify-end pb-2 pt-20 bg-gradient-to-t from-black/90 via-black/40 to-transparent group/overlay pointer-events-none">
            
            {/* Narration Text - Always Visible & Styled */}
            <div className="max-w-4xl mx-auto text-center px-6 mb-6 transition-all duration-500 group-hover/overlay:translate-y-[-10px] group-hover/overlay:scale-95 origin-bottom pointer-events-auto">
                 {currentPhoto.narration ? (
                   <div key={currentPhoto.id} className="animate-slide-up">
                     <p className="font-great-vibes text-4xl md:text-5xl text-amber-50/95 leading-relaxed tracking-wide drop-shadow-md font-medium" 
                        style={{ textShadow: '0 2px 4px rgba(0,0,0,0.8)' }}>
                       "{currentPhoto.narration}"
                     </p>
                   </div>
                 ) : (
                   <p className="text-white/30 text-sm italic">...</p>
                 )}
            </div>

            {/* Controls - Hidden until hovered */}
            <div className="absolute bottom-6 opacity-0 group-hover/overlay:opacity-100 transition-all duration-300 translate-y-4 group-hover/overlay:translate-y-0 pointer-events-auto">
                <div className="bg-black/50 backdrop-blur-md border border-white/10 rounded-full px-6 py-3 flex items-center gap-6 shadow-2xl hover:bg-black/70 transition-colors">
                    <button onClick={() => setCurrentIndex((prev) => (prev - 1 + photos.length) % photos.length)} className="text-white/70 hover:text-white transition-colors hover:scale-110">
                      <Rewind size={24} />
                    </button>
                    
                    <button 
                      onClick={() => setIsPlaying(!isPlaying)}
                      className="w-12 h-12 bg-white text-black rounded-full flex items-center justify-center hover:scale-105 transition-transform shadow-lg shadow-white/20"
                    >
                      {isPlaying ? <Pause size={20} fill="black" /> : <Play size={20} fill="black" className="ml-1" />}
                    </button>

                    <button onClick={() => setCurrentIndex((prev) => (prev + 1) % photos.length)} className="text-white/70 hover:text-white transition-colors hover:scale-110">
                      <FastForward size={24} />
                    </button>

                    <div className="w-px h-8 bg-white/20 mx-2" />
                    
                    <button onClick={() => setIsAudioMuted(!isAudioMuted)} className="text-white/70 hover:text-white transition-colors hover:scale-110">
                      {isAudioMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
                    </button>
                </div>
            </div>
            
          </div>

        </div>
      </div>

      <style>{`
        @keyframes scrollUp {
          from { transform: translateY(0); }
          to { transform: translateY(-50%); }
        }
        @keyframes scrollDown {
          from { transform: translateY(-50%); }
          to { transform: translateY(0); }
        }
        .animate-scroll-up {
          animation: scrollUp 60s linear infinite;
        }
        .animate-scroll-down {
          animation: scrollDown 60s linear infinite;
        }
        .group-hover\\/col:play-state-paused:hover {
          animation-play-state: paused;
        }
        @keyframes kenBurns {
          0% { transform: scale(1); }
          100% { transform: scale(1.15); }
        }
        .animate-ken-burns {
          animation: kenBurns 6s ease-out forwards;
        }
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-slide-up {
          animation: slideUp 1s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
      `}</style>
    </div>
  );
};

export default Slideshow;