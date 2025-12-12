import React, { useRef, useState, useEffect } from 'react';
import { Music, Upload, Play, Check, Pause, Loader2, Download, RefreshCw, Sparkles } from 'lucide-react';
import { generateSpeech } from '../services/geminiService';

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

const TRACK_POOLS: Record<string, Track[]> = {
  Default: [
    { name: "Forest Lullaby", url: "https://cdn.pixabay.com/audio/2022/02/22/audio_d1718ab41b.mp3", desc: "Acoustic, Nature, Calm" },
    { name: "The Cradle of Your Soul", url: "https://cdn.pixabay.com/audio/2022/03/10/audio_502937d571.mp3", desc: "Relaxing, Emotional, Piano" },
    { name: "Once In Paris", url: "https://cdn.pixabay.com/audio/2022/10/25/audio_97f4b82d96.mp3", desc: "Jazz, Soft, Evening" },
    { name: "Lofi Study", url: "https://cdn.pixabay.com/audio/2022/05/27/audio_1808fbf07a.mp3", desc: "Beats, Chill, Modern" }
  ],
  Cinematic: [
    { name: "Cinematic Atmosphere", url: "https://cdn.pixabay.com/audio/2022/03/15/audio_c8c8a73467.mp3", desc: "Epic, Wide, Soundscape" },
    { name: "Ambient Piano", url: "https://cdn.pixabay.com/audio/2021/09/06/audio_9c0f9e102f.mp3", desc: "Emotional, Soft, Touching" },
    { name: "Documentary", url: "https://cdn.pixabay.com/audio/2023/01/01/audio_816821e227.mp3", desc: "Serious, Building, Story" },
    { name: "Epic Heart", url: "https://cdn.pixabay.com/audio/2021/08/09/audio_03d6e32637.mp3", desc: "Trailer, Powerful, String" }
  ],
  Upbeat: [
    { name: "Good Vibes", url: "https://cdn.pixabay.com/audio/2022/04/27/audio_67bcf729cb.mp3", desc: "Happy, Summer, Party" },
    { name: "The Podcast Intro", url: "https://cdn.pixabay.com/audio/2022/01/18/audio_d0a13f69d2.mp3", desc: "Groovy, Fun, Short" },
    { name: "Motivation", url: "https://cdn.pixabay.com/audio/2022/05/16/audio_db6591201e.mp3", desc: "Corporate, Success, Bright" },
    { name: "Tropical Sun", url: "https://cdn.pixabay.com/audio/2022/09/02/audio_72596b6b78.mp3", desc: "Dance, Beach, Energetic" }
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
  const [generatedTracks, setGeneratedTracks] = useState<Track[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [downloadingUrl, setDownloadingUrl] = useState<string | null>(null);
  const [playingPreview, setPlayingPreview] = useState<string | null>(null);
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

  const loadTracks = async (regenerateAI = false) => {
      setIsGenerating(true);
      setPlayingPreview(null);
      if (previewAudioRef.current) {
        previewAudioRef.current.pause();
      }

      // 1. Get Curated tracks for this category (random selection)
      const pool = TRACK_POOLS[activeTab] || TRACK_POOLS['Default'];
      // Deterministic shuffle for stability unless regenerating
      const curated = [...pool].sort(() => 0.5 - Math.random()).slice(0, 3);

      // 2. Generate AI Voiceover Track (Real Generation)
      if (regenerateAI) {
        try {
          let prompt = "";
          if (activeTab === 'Cinematic') prompt = "Say in a deep, epic voice: Prepare to witness a journey through time and memory.";
          else if (activeTab === 'Upbeat') prompt = "Say cheerfully and energetically: Let's celebrate these amazing moments! Here we go!";
          else prompt = "Say calmly and warmly: Welcome to this collection of cherished memories.";

          // Call the actual Gemini service
          const aiUrl = await generateSpeech(prompt);
          
          if (aiUrl && mountedRef.current) {
              curated.unshift({
                  name: `AI Intro (${activeTab})`,
                  url: aiUrl,
                  desc: "Generated Voiceover",
                  isAi: true
              });
          }
        } catch (e) {
            console.error("AI Generation failed", e);
        }
      }

      if (mountedRef.current) {
        setGeneratedTracks(curated);
        setIsGenerating(false);
      }
  };

  // Initial load when tab changes (don't auto-generate AI to save quota, user must click regenerate)
  useEffect(() => {
    loadTracks(false);
  }, [activeTab]);

  const togglePreview = (url: string) => {
    if (!url) return; 

    if (playingPreview === url) {
      previewAudioRef.current?.pause();
      setPlayingPreview(null);
    } else {
      // Robust audio switching logic
      if (!previewAudioRef.current) {
        previewAudioRef.current = new Audio();
      }
      
      previewAudioRef.current.pause();
      previewAudioRef.current.src = url;
      
      // Attempt to play with error handling
      const playPromise = previewAudioRef.current.play();
      if (playPromise !== undefined) {
        playPromise.catch(error => {
          console.warn("Playback prevented:", error);
          // If error is "NotSupportedError", it might be a bad Blob or codec
        });
      }
      
      setPlayingPreview(url);
    }
  };

  const handleSelectTrack = async (track: Track) => {
    setDownloadingUrl(track.url);
    try {
      if (track.url.startsWith('blob:')) {
          // It's already a local blob (AI generated)
          onSelectAudio(track.url);
      } else {
          // Fetch remote file to cache it as local blob
          const response = await fetch(track.url);
          const blob = await response.blob();
          const localUrl = URL.createObjectURL(blob);
          onSelectAudio(localUrl);
      }
    } catch (e) {
      console.error("Download failed, falling back to remote URL", e);
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
            <p className="text-slate-400 text-sm mt-1">Select background music or generate an AI intro.</p>
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
          
          {isGenerating ? (
            <div className="h-48 flex flex-col items-center justify-center text-slate-500 space-y-4">
              <Loader2 size={32} className="animate-spin text-indigo-500" />
              <p className="text-sm animate-pulse">Consulting the AI Director...</p>
            </div>
          ) : (
            <div className="space-y-3">
               <div className="flex justify-between items-center mb-2">
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Tracks</span>
                  <button 
                    onClick={() => loadTracks(true)}
                    className="text-xs flex items-center gap-1 text-indigo-400 hover:text-indigo-300 transition-colors bg-indigo-500/10 px-2 py-1 rounded-full border border-indigo-500/20"
                  >
                    <Sparkles size={12} /> Generate AI Intro
                  </button>
               </div>
               
               {generatedTracks.map((track) => {
                 const isSelected = currentAudio === track.url || (currentAudio && currentAudio.startsWith('blob:') && downloadingUrl === track.url);
                 const isDownloading = downloadingUrl === track.url;
                 const isAi = track.isAi;

                 return (
                   <div 
                    key={track.url}
                    className={`flex items-center justify-between p-4 rounded-xl border transition-all ${
                      isSelected 
                        ? 'bg-indigo-500/10 border-indigo-500/50' 
                        : isAi ? 'bg-indigo-900/10 border-indigo-500/30' : 'bg-slate-900 border-slate-800 hover:border-slate-600'
                    }`}
                   >
                     <div className="flex items-center gap-4">
                        <button 
                          onClick={() => togglePreview(track.url)}
                          className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                            playingPreview === track.url ? 'bg-indigo-500 text-white' : 'bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700'
                          }`}
                        >
                          {playingPreview === track.url ? <Pause size={16} /> : <Play size={16} />}
                        </button>
                        
                        <div>
                          <h4 className={`font-medium flex items-center gap-2 ${isSelected ? 'text-indigo-300' : 'text-slate-200'}`}>
                              {track.name}
                              {isAi && <Sparkles size={12} className="text-amber-400" />}
                          </h4>
                          <p className="text-xs text-slate-500">{track.desc}</p>
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
                          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors border border-slate-700"
                        >
                          <Download size={16} />
                          <span className="text-sm">Select</span>
                        </button>
                     )}
                   </div>
                 );
               })}
            </div>
          )}

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