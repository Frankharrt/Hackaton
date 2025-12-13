import React, { useRef, useState, useEffect } from 'react';
import { Music, Upload, Play, Check, Pause, Loader2, Download, RefreshCw, Sparkles, AlertCircle, Wand2 } from 'lucide-react';
import { generateAiTrack } from '../services/geminiService';

interface AudioPanelProps {
  onSelectAudio: (url: string) => void;
  currentAudio: string | null;
  volume: number;
  setVolume: (v: number) => void;
  onClose: () => void;
}

interface Track {
  name: string;
  url: string;
  desc: string;
  isAi?: boolean;
}

// Verified Pixabay Tracks
const CLASSIC_TRACKS: Record<string, Track[]> = {
  Default: [
    { name: "Morning Garden", url: "https://cdn.pixabay.com/audio/2022/05/27/audio_1808fbf07a.mp3", desc: "Acoustic Chill" },
    { name: "Lofi Study", url: "https://cdn.pixabay.com/audio/2022/01/18/audio_d0a13f69d2.mp3", desc: "Relaxing Beats" },
  ],
  Cinematic: [
    { name: "Epic Cinematic", url: "https://cdn.pixabay.com/audio/2022/03/24/audio_1456d6b8e8.mp3", desc: "Dramatic Build" },
    { name: "Inspiring Emotional", url: "https://cdn.pixabay.com/audio/2022/08/02/audio_884fe92c21.mp3", desc: "Piano & Strings" },
  ],
  Upbeat: [
    { name: "Upbeat Corporate", url: "https://cdn.pixabay.com/audio/2022/10/25/audio_550dca0747.mp3", desc: "Motivational" },
    { name: "Summer Party", url: "https://cdn.pixabay.com/audio/2022/09/16/audio_0e54d7d983.mp3", desc: "Fun & Energetic" },
  ]
};

const CATEGORIES = ['Default', 'Cinematic', 'Upbeat'];

const AudioPanel: React.FC<AudioPanelProps> = ({ 
  onSelectAudio, 
  currentAudio, 
  volume, 
  setVolume, 
  onClose 
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeTab, setActiveTab] = useState('Default');
  const [tracks, setTracks] = useState<Track[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [downloadingUrl, setDownloadingUrl] = useState<string | null>(null);
  const [playingPreview, setPlayingPreview] = useState<string | null>(null);
  const [errorTracks, setErrorTracks] = useState<Set<string>>(new Set());
  
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);
  const mountedRef = useRef(true);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      mountedRef.current = false;
      if (previewAudioRef.current) {
        previewAudioRef.current.pause();
        previewAudioRef.current = null;
      }
    };
  }, []);

  const loadTracks = (category: string) => {
    // Start with Classics
    const classics = CLASSIC_TRACKS[category] || CLASSIC_TRACKS['Default'];
    setTracks(classics);
  };

  // Initial load when tab changes
  useEffect(() => {
    loadTracks(activeTab);
  }, [activeTab]);

  const handleComposeAiTrack = async () => {
    setIsGenerating(true);
    // Stop any preview
    if (previewAudioRef.current) {
        previewAudioRef.current.pause();
        setPlayingPreview(null);
    }

    try {
        const result = await generateAiTrack(activeTab);
        if (result && mountedRef.current) {
            const newTrack: Track = {
                name: result.name,
                url: result.url,
                desc: `AI Generated ${activeTab} Track`,
                isAi: true
            };
            // Add to top of list
            setTracks(prev => [newTrack, ...prev]);
        }
    } catch (e) {
        console.error("Failed to compose track", e);
    } finally {
        if (mountedRef.current) setIsGenerating(false);
    }
  };

  const handleTrackError = (failedTrackUrl: string) => {
    console.warn(`Track failed to load: ${failedTrackUrl}`);
    setErrorTracks(prev => new Set(prev).add(failedTrackUrl));
    setPlayingPreview(null);
  };

  const togglePreview = (url: string) => {
    if (!url) return; 

    if (playingPreview === url) {
      previewAudioRef.current?.pause();
      setPlayingPreview(null);
    } else {
      if (!previewAudioRef.current) {
        previewAudioRef.current = new Audio();
      }
      
      previewAudioRef.current.onerror = () => handleTrackError(url);
      previewAudioRef.current.pause();
      previewAudioRef.current.src = url;
      
      const playPromise = previewAudioRef.current.play();
      if (playPromise !== undefined) {
        playPromise.catch(error => {
          if (error.name !== 'AbortError' && error.name !== 'NotAllowedError') {
             console.warn("Playback failed:", error);
             handleTrackError(url);
          }
        });
      }
      setPlayingPreview(url);
    }
  };

  const handleSelectTrack = async (track: Track) => {
    setDownloadingUrl(track.url);
    try {
      if (track.url.startsWith('blob:')) {
          onSelectAudio(track.url);
      } else {
          // Verify it's fetchable (optional, but good for UI feedback)
          onSelectAudio(track.url);
      }
    } catch (e) {
      console.warn("Error selecting track", e);
      onSelectAudio(track.url);
    } finally {
      setDownloadingUrl(null);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      onSelectAudio(url);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="p-6 border-b border-slate-800 bg-slate-900 flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-serif text-white flex items-center gap-2">
              <Music className="text-indigo-400" /> Soundtrack
            </h2>
            <div className="flex flex-col gap-0.5 mt-1">
              <p className="text-slate-400 text-sm">Select background music or generate an AI soundscape.</p>
              <p className="text-[10px] text-slate-500">Powered by Google GenAI Music Node (TTS)</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white px-3 py-1 rounded hover:bg-slate-800 transition-colors">
            Done
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-800 bg-slate-900/50">
          {CATEGORIES.map(cat => (
            <button
              key={cat}
              onClick={() => setActiveTab(cat)}
              className={`flex-1 py-4 text-sm font-medium transition-colors relative ${
                activeTab === cat ? 'text-indigo-400' : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              {cat}
              {activeTab === cat && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-500 shadow-[0_0_10px_rgba(99,102,241,0.5)]" />
              )}
            </button>
          ))}
        </div>

        {/* Main Content */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-950">
          
          {/* AI Generator Button */}
          <button
            onClick={handleComposeAiTrack}
            disabled={isGenerating}
            className="w-full mb-6 py-4 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 rounded-xl flex flex-col items-center justify-center text-white shadow-lg shadow-indigo-500/20 transition-all transform hover:scale-[1.01] active:scale-[0.99] disabled:opacity-70 disabled:cursor-not-allowed group"
          >
             {isGenerating ? (
               <>
                 <Loader2 size={24} className="animate-spin mb-2" />
                 <span className="font-medium animate-pulse">Composing {activeTab} Track...</span>
               </>
             ) : (
               <>
                 <div className="flex items-center gap-2 mb-1">
                   <Wand2 size={24} className="group-hover:rotate-12 transition-transform" />
                   <span className="text-lg font-serif">Compose New {activeTab} Track</span>
                 </div>
                 <span className="text-xs text-indigo-200">Generate a unique AI song for your mood</span>
               </>
             )}
          </button>

          <div className="space-y-3">
               <div className="flex justify-between items-center mb-2">
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Available Tracks</span>
               </div>
               
               {tracks.map((track) => {
                 const isSelected = currentAudio === track.url || (currentAudio && currentAudio.startsWith('blob:') && downloadingUrl === track.url);
                 const isDownloading = downloadingUrl === track.url;
                 const isAi = track.isAi;
                 const isError = errorTracks.has(track.url);

                 return (
                   <div 
                    key={track.url}
                    className={`flex items-center justify-between p-4 rounded-xl border transition-all ${
                      isSelected 
                        ? 'bg-indigo-500/10 border-indigo-500/50' 
                        : isAi ? 'bg-indigo-900/10 border-indigo-500/30' : 'bg-slate-900 border-slate-800 hover:border-slate-600'
                    } ${isError ? 'opacity-50 pointer-events-none grayscale' : ''}`}
                   >
                     <div className="flex items-center gap-4">
                        <button 
                          onClick={() => togglePreview(track.url)}
                          disabled={isError}
                          className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                            playingPreview === track.url ? 'bg-indigo-500 text-white' : 'bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700'
                          }`}
                        >
                          {playingPreview === track.url ? <Pause size={16} /> : <Play size={16} />}
                        </button>
                        
                        <div>
                          <h4 className={`font-medium flex items-center gap-2 ${isSelected ? 'text-indigo-300' : 'text-slate-200'}`}>
                              {track.name}
                              {isAi && <span className="text-[10px] bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded border border-amber-500/30 flex items-center gap-1"><Sparkles size={8} /> AI Generated</span>}
                          </h4>
                          <p className="text-xs text-slate-500">
                             {isError ? <span className="text-red-400 flex items-center gap-1"><AlertCircle size={10} /> Unavailable</span> : track.desc}
                          </p>
                        </div>
                     </div>

                     {isDownloading ? (
                        <div className="flex items-center gap-2 text-indigo-400 px-4">
                           <Loader2 size={16} className="animate-spin" />
                           <span className="text-sm">Saving...</span>
                        </div>
                     ) : isSelected ? (
                        <div className="flex items-center gap-2 text-indigo-400 px-4 bg-indigo-500/10 py-2 rounded-lg">
                           <Check size={16} />
                           <span className="text-sm font-medium">Selected</span>
                        </div>
                     ) : (
                        <button 
                          onClick={() => handleSelectTrack(track)}
                          disabled={isError}
                          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors border border-slate-700 disabled:opacity-50"
                        >
                          <Download size={16} />
                          <span className="text-sm">Select</span>
                        </button>
                     )}
                   </div>
                 );
               })}
            </div>

          {/* Local Upload Fallback */}
          <div className="mt-8 pt-6 border-t border-slate-800">
             <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-4">Custom Upload</span>
             <div 
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center justify-center p-6 rounded-xl border-2 border-dashed border-slate-800 text-slate-400 cursor-pointer hover:border-indigo-500/50 hover:bg-indigo-500/5 hover:text-indigo-400 transition-all group"
              >
                <div className="flex flex-col items-center gap-2">
                  <div className="p-3 bg-slate-800 rounded-full group-hover:bg-indigo-500/20 transition-colors">
                    <Upload size={20} />
                  </div>
                  <span className="text-sm font-medium">Click to upload local audio file</span>
                </div>
                <input 
                  ref={fileInputRef} 
                  type="file" 
                  accept="audio/*" 
                  className="hidden" 
                  onChange={handleFileUpload} 
                />
              </div>
          </div>

        </div>

        {/* Footer Volume Control */}
        <div className="p-4 bg-slate-900 border-t border-slate-800 flex items-center gap-4">
           <span className="text-xs text-slate-400 font-medium w-24">Master Volume</span>
           <input 
            type="range" 
            min="0" 
            max="100" 
            value={volume} 
            onChange={(e) => setVolume(Number(e.target.value))}
            className="flex-1 h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500 hover:accent-indigo-400"
          />
          <span className="text-xs text-slate-400 w-8 text-right">{volume}%</span>
        </div>
      </div>
    </div>
  );
};

export default AudioPanel;