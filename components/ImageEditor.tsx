import React, { useState, useRef, useEffect } from 'react';
import { Photo, DEFAULT_FILTERS, ImageFilter } from '../types';
import { generateAutoNarration, stylizeImage, transcribeAudio, generateSpeech, removeObject, removeObjectAtPoint } from '../services/geminiService';
import { 
  ArrowLeft, Save, RotateCw, Wand2, Mic, Play, StopCircle, 
  RotateCcw, GitCompare, Type, Eraser, Palette, Loader2, MoreVertical, FileText, Sparkles, X, Target
} from 'lucide-react';

interface ImageEditorProps {
  photo: Photo;
  onSave: (updatedPhoto: Photo) => void;
  onCancel: () => void;
}

const ImageEditor: React.FC<ImageEditorProps> = ({ photo, onSave, onCancel }) => {
  const [editedPhoto, setEditedPhoto] = useState<Photo>({ ...photo });
  const [isComparing, setIsComparing] = useState(false);
  const [activeTab, setActiveTab] = useState<'adjust' | 'filters' | 'stylize' | 'narrate'>('adjust');
  const [isRecording, setIsRecording] = useState(false);
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [isStylizing, setIsStylizing] = useState(false);
  const [isEraserActive, setIsEraserActive] = useState(false);
  const [isGeneratingSpeech, setIsGeneratingSpeech] = useState(false);
  const [objectToRemove, setObjectToRemove] = useState('');
  const [clickMarker, setClickMarker] = useState<{x: number, y: number} | null>(null);
  
  // Audio Menu state
  const [showAudioMenu, setShowAudioMenu] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);

  // Refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const imgRef = useRef<HTMLImageElement>(null);

  // Apply changes to local state
  const updateFilter = (key: keyof ImageFilter, value: number) => {
    setEditedPhoto(prev => ({
      ...prev,
      filters: { ...prev.filters, [key]: value }
    }));
  };

  const handleRotate = () => {
    setEditedPhoto(prev => ({ ...prev, rotation: (prev.rotation + 90) % 360 }));
  };

  const handleReset = () => {
    setEditedPhoto({ ...photo, filters: { ...DEFAULT_FILTERS }, rotation: 0 });
    setIsEraserActive(false);
    setObjectToRemove('');
    setClickMarker(null);
  };

  const handleAutoEnhance = () => {
    // Simulated auto-enhance
    setEditedPhoto(prev => ({
      ...prev,
      filters: {
        ...prev.filters,
        brightness: 110,
        contrast: 115,
        saturation: 120,
        blur: 0,
        sepia: 0,
        grayscale: 0
      }
    }));
  };

  const handleAINarration = async (tone: string) => {
    setIsGeneratingAI(true);
    const text = await generateAutoNarration(editedPhoto.url, tone);
    setEditedPhoto(prev => ({ ...prev, narration: text }));
    setIsGeneratingAI(false);
  };

  const handleGenerateSpeech = async () => {
    if (!editedPhoto.narration) return;
    setIsGeneratingSpeech(true);
    try {
      const audioUrl = await generateSpeech(editedPhoto.narration);
      if (audioUrl) {
        setEditedPhoto(prev => ({ ...prev, audioNarrationUrl: audioUrl }));
      } else {
        alert("Could not generate audio.");
      }
    } catch (e) {
      console.error(e);
      alert("Error generating speech.");
    } finally {
      setIsGeneratingSpeech(false);
    }
  };

  const handleStylize = async (style: string) => {
    setIsStylizing(true);
    try {
      const newImageUrl = await stylizeImage(editedPhoto.url, style);
      if (newImageUrl) {
        setEditedPhoto(prev => ({
          ...prev,
          url: newImageUrl,
        }));
      } else {
        alert("Could not generate stylized image. Please check your connection and API limits.");
      }
    } catch (e) {
      console.error(e);
      alert("Error generating image.");
    } finally {
      setIsStylizing(false);
    }
  };

  const handleTranscribe = async () => {
    if (!editedPhoto.audioNarrationUrl) return;
    
    setIsTranscribing(true);
    setShowAudioMenu(false);
    
    try {
        const text = await transcribeAudio(editedPhoto.audioNarrationUrl);
        if (text) {
             setEditedPhoto(prev => ({ 
                 ...prev, 
                 narration: prev.narration ? `${prev.narration}\n${text}` : text 
             }));
        } else {
            alert("Could not transcribe audio.");
        }
    } catch (e) {
        console.error(e);
        alert("Transcription failed.");
    } finally {
        setIsTranscribing(false);
    }
  };

  // Voice Recording Logic
  const toggleRecording = async () => {
    if (isRecording) {
      mediaRecorderRef.current?.stop();
      setIsRecording(false);
    } else {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mediaRecorder = new MediaRecorder(stream);
        mediaRecorderRef.current = mediaRecorder;
        audioChunksRef.current = [];

        mediaRecorder.ondataavailable = (event) => {
          audioChunksRef.current.push(event.data);
        };

        mediaRecorder.onstop = () => {
          const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
          const audioUrl = URL.createObjectURL(audioBlob);
          setEditedPhoto(prev => ({ ...prev, audioNarrationUrl: audioUrl }));
        };

        mediaRecorder.start();
        setIsRecording(true);
      } catch (err) {
        console.error("Error accessing microphone:", err);
        alert("Microphone access denied or not available.");
      }
    }
  };

  const handleRemoveObject = async () => {
    if (!objectToRemove.trim()) return;
      
    setIsStylizing(true); 
    try {
        const newImageUrl = await removeObject(editedPhoto.url, objectToRemove);
        if (newImageUrl) {
            setEditedPhoto(prev => ({
                ...prev,
                url: newImageUrl
            }));
            setObjectToRemove(''); 
        } else {
            alert("Could not remove the object. Please try a different description.");
        }
    } catch (e) {
        console.error(e);
        alert("Error removing object.");
    } finally {
        setIsStylizing(false);
    }
  };

  const handleImageClick = async (e: React.MouseEvent<HTMLImageElement>) => {
    if (!isEraserActive || isStylizing || isComparing) return;

    const img = imgRef.current;
    if (!img) return;

    // Get click coordinates relative to the DOM element
    const rect = img.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    // The image might be letterboxed due to object-fit: contain.
    // We need to find the dimensions of the actual rendered image.
    const imageAspectRatio = img.naturalWidth / img.naturalHeight;
    const elementAspectRatio = rect.width / rect.height;

    let renderWidth, renderHeight, startX, startY;

    if (elementAspectRatio > imageAspectRatio) {
      // Image is constrained by height (bars on left/right)
      renderHeight = rect.height;
      renderWidth = renderHeight * imageAspectRatio;
      startX = (rect.width - renderWidth) / 2;
      startY = 0;
    } else {
      // Image is constrained by width (bars on top/bottom)
      renderWidth = rect.width;
      renderHeight = renderWidth / imageAspectRatio;
      startX = 0;
      startY = (rect.height - renderHeight) / 2;
    }

    // Check if click is within the actual image
    if (
      clickX >= startX && 
      clickX <= startX + renderWidth && 
      clickY >= startY && 
      clickY <= startY + renderHeight
    ) {
      // Calculate normalized coordinates (0-1)
      const normX = (clickX - startX) / renderWidth;
      const normY = (clickY - startY) / renderHeight;

      // Show marker animation
      setClickMarker({ x: clickX, y: clickY });
      setTimeout(() => setClickMarker(null), 1000);

      setIsStylizing(true);
      try {
        const newImageUrl = await removeObjectAtPoint(editedPhoto.url, normX, normY);
        if (newImageUrl) {
          setEditedPhoto(prev => ({ ...prev, url: newImageUrl }));
        } else {
          alert("Could not remove object at this location.");
        }
      } catch (err) {
        console.error(err);
        alert("Error removing object.");
      } finally {
        setIsStylizing(false);
      }
    }
  };

  const filterStyle = {
    filter: `
      brightness(${editedPhoto.filters.brightness}%) 
      contrast(${editedPhoto.filters.contrast}%) 
      saturate(${editedPhoto.filters.saturation}%) 
      blur(${editedPhoto.filters.blur}px) 
      sepia(${editedPhoto.filters.sepia}%) 
      grayscale(${editedPhoto.filters.grayscale}%)
    `,
    transform: `rotate(${editedPhoto.rotation}deg)`
  };

  const originalStyle = {
    transform: `rotate(0deg)`
  };

  const STYLES = [
    { id: 'clay', label: 'Clay', desc: 'Stop-motion' },
    { id: 'anime', label: 'Anime', desc: 'Japanese animation' },
    { id: '3d-render', label: '3D Render', desc: 'Glossy 3D' },
    { id: 'watercolor', label: 'Watercolor', desc: 'Artistic painting' },
    { id: 'pencil-sketch', label: 'Sketch', desc: 'Pencil drawing' },
    { id: 'oil-painting', label: 'Oil Paint', desc: 'Textured canvas' },
    { id: 'pixel-art', label: 'Pixel Art', desc: 'Retro 8-bit' },
    { id: 'cyberpunk', label: 'Cyberpunk', desc: 'Neon futuristic' },
  ];

  return (
    <div className="flex flex-col h-screen bg-slate-900 overflow-hidden">
      {/* Header */}
      <div className="h-16 border-b border-slate-700 flex items-center justify-between px-6 bg-slate-900/90 backdrop-blur z-20">
        <button onClick={onCancel} className="text-slate-400 hover:text-white flex items-center gap-2">
          <ArrowLeft size={20} /> Back to Gallery
        </button>
        <h2 className="text-xl font-serif text-white hidden md:block">Enhance & Narrate</h2>
        <div className="flex gap-4">
          <button onClick={handleReset} className="text-sm text-slate-400 hover:text-white px-3 py-1">
            Reset
          </button>
          <button 
            onClick={() => onSave(editedPhoto)} 
            className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-full flex items-center gap-2"
          >
            <Save size={18} /> Save
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Main Image Area */}
        <div className="flex-1 relative bg-slate-950 flex items-center justify-center p-8 select-none">
          <div className="relative max-w-full max-h-full shadow-2xl overflow-hidden rounded-md group">
            {isStylizing && (
              <div className="absolute inset-0 z-50 bg-black/70 flex flex-col items-center justify-center backdrop-blur-sm">
                <Loader2 size={48} className="text-indigo-500 animate-spin mb-4" />
                <p className="text-indigo-200 font-medium animate-pulse">
                  {isEraserActive ? "Processing Removal..." : "Generating Masterpiece..."}
                </p>
              </div>
            )}
            
            <img 
              ref={imgRef}
              src={isComparing ? editedPhoto.originalUrl : editedPhoto.url} 
              className={`max-w-full max-h-[80vh] object-contain transition-all duration-300 ${isEraserActive && !isComparing && !isStylizing ? 'cursor-crosshair' : 'cursor-default'}`}
              style={isComparing ? originalStyle : filterStyle}
              alt="Editing"
              onClick={handleImageClick}
            />

            {/* Click Ripple Effect */}
            {clickMarker && (
              <div 
                className="absolute w-8 h-8 rounded-full border-2 border-red-500 bg-red-500/30 animate-ping pointer-events-none z-40"
                style={{ 
                  left: clickMarker.x - 16, 
                  top: clickMarker.y - 16,
                }}
              />
            )}
            
            {/* Compare Button */}
            {!isEraserActive && !isStylizing && (
              <button
                onMouseDown={() => setIsComparing(true)}
                onMouseUp={() => setIsComparing(false)}
                onMouseLeave={() => setIsComparing(false)}
                onTouchStart={() => setIsComparing(true)}
                onTouchEnd={() => setIsComparing(false)}
                className="absolute bottom-4 right-4 bg-black/50 hover:bg-black/70 text-white px-4 py-2 rounded-full backdrop-blur-md flex items-center gap-2 select-none z-20 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <GitCompare size={18} /> Hold to Compare
              </button>
            )}
          </div>
        </div>

        {/* Tools Panel */}
        <div className="w-80 md:w-96 bg-slate-900 border-l border-slate-700 flex flex-col z-10">
          <div className="flex border-b border-slate-700">
            <button 
              onClick={() => setActiveTab('adjust')}
              className={`flex-1 py-4 text-sm font-medium border-b-2 transition-colors ${activeTab === 'adjust' ? 'border-indigo-500 text-white' : 'border-transparent text-slate-500'}`}
            >
              Adjust
            </button>
            <button 
              onClick={() => setActiveTab('stylize')}
              className={`flex-1 py-4 text-sm font-medium border-b-2 transition-colors ${activeTab === 'stylize' ? 'border-indigo-500 text-white' : 'border-transparent text-slate-500'}`}
            >
              Stylize
            </button>
            <button 
              onClick={() => setActiveTab('filters')}
              className={`flex-1 py-4 text-sm font-medium border-b-2 transition-colors ${activeTab === 'filters' ? 'border-indigo-500 text-white' : 'border-transparent text-slate-500'}`}
            >
              Filters
            </button>
            <button 
              onClick={() => setActiveTab('narrate')}
              className={`flex-1 py-4 text-sm font-medium border-b-2 transition-colors ${activeTab === 'narrate' ? 'border-indigo-500 text-white' : 'border-transparent text-slate-500'}`}
            >
              Narrate
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-6 scrollbar-hide">
            {activeTab === 'adjust' && (
              <div className="space-y-6">
                 <button 
                  onClick={handleAutoEnhance}
                  className="w-full py-3 bg-gradient-to-r from-indigo-600 to-purple-600 rounded-lg text-white font-medium flex items-center justify-center gap-2 mb-4"
                >
                  <Wand2 size={18} /> AI Auto-Enhance
                </button>

                {/* Enhanced Object Remover UI */}
                <div className="mb-6">
                  <button 
                    onClick={() => setIsEraserActive(!isEraserActive)}
                    className={`w-full py-3 rounded-lg font-medium flex items-center justify-center gap-2 transition-colors ${isEraserActive ? 'bg-slate-700 text-white mb-2' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}
                  >
                    <Eraser size={18} /> Object Remover
                  </button>

                  {isEraserActive && (
                    <div className="bg-slate-800/50 p-4 rounded-lg border border-slate-700 animate-in fade-in slide-in-from-top-2">
                      <div className="flex items-center gap-2 text-xs text-indigo-300 mb-3 bg-indigo-500/10 p-2 rounded">
                        <Target size={14} />
                        <span>Click the image to remove object, OR describe below:</span>
                      </div>
                      
                      <div className="flex gap-2">
                        <input 
                          type="text" 
                          value={objectToRemove}
                          onChange={(e) => setObjectToRemove(e.target.value)}
                          placeholder="e.g. the red car"
                          className="flex-1 bg-slate-900 border border-slate-700 rounded-md px-3 py-2 text-sm text-white focus:ring-1 focus:ring-indigo-500 outline-none"
                          onKeyDown={(e) => e.key === 'Enter' && handleRemoveObject()}
                        />
                        <button 
                          onClick={handleRemoveObject}
                          disabled={!objectToRemove.trim() || isStylizing}
                          className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white px-3 rounded-md flex items-center justify-center"
                        >
                           {isStylizing ? <Loader2 size={16} className="animate-spin" /> : 'Go'}
                        </button>
                      </div>
                      <p className="text-[10px] text-slate-500 mt-2">
                        The AI will attempt to remove the selected area or described object.
                      </p>
                    </div>
                  )}
                </div>

                {[
                  { label: 'Brightness', key: 'brightness', min: 0, max: 200 },
                  { label: 'Contrast', key: 'contrast', min: 0, max: 200 },
                  { label: 'Saturation', key: 'saturation', min: 0, max: 200 },
                  { label: 'Blur', key: 'blur', min: 0, max: 20 },
                  { label: 'Sepia', key: 'sepia', min: 0, max: 100 },
                ].map((control) => (
                  <div key={control.key}>
                    <div className="flex justify-between text-xs text-slate-400 mb-2">
                      <span>{control.label}</span>
                      <span>{editedPhoto.filters[control.key as keyof ImageFilter]}</span>
                    </div>
                    <input
                      type="range"
                      min={control.min}
                      max={control.max}
                      value={editedPhoto.filters[control.key as keyof ImageFilter]}
                      onChange={(e) => updateFilter(control.key as keyof ImageFilter, parseInt(e.target.value))}
                      className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                    />
                  </div>
                ))}

                <div className="pt-4 border-t border-slate-700">
                  <span className="text-xs text-slate-400 block mb-3">Rotation</span>
                  <div className="flex gap-2">
                    <button onClick={handleRotate} className="flex-1 py-2 bg-slate-800 rounded hover:bg-slate-700 text-slate-300 flex justify-center">
                      <RotateCw size={18} />
                    </button>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'stylize' && (
              <div className="space-y-4">
                 <div className="flex items-center gap-2 mb-4 text-indigo-300 bg-indigo-500/10 p-3 rounded-lg border border-indigo-500/20">
                   <Palette size={16} />
                   <p className="text-xs">AI-powered transformations. This will generate a new image based on the style.</p>
                 </div>
                 
                 <div className="grid grid-cols-2 gap-3">
                   {STYLES.map(style => (
                     <button
                        key={style.id}
                        disabled={isStylizing}
                        onClick={() => handleStylize(style.label)}
                        className={`h-24 bg-slate-800 rounded-lg border border-slate-700 hover:border-indigo-500 transition-all flex flex-col items-center justify-center gap-2 text-slate-300 disabled:opacity-50 disabled:cursor-wait hover:bg-slate-750`}
                     >
                       <span className="text-sm font-medium">{style.label}</span>
                       <span className="text-[10px] text-slate-500">{style.desc}</span>
                     </button>
                   ))}
                 </div>
              </div>
            )}

            {activeTab === 'filters' && (
              <div className="space-y-4">
                 <p className="text-sm text-slate-400 mb-2">Color Presets (CSS)</p>
                 <div className="grid grid-cols-2 gap-3">
                   {['None', 'Grayscale', 'Sepia', 'Warm', 'Cool'].map(style => (
                     <button
                        key={style}
                        onClick={() => {
                          if (style === 'None') handleReset();
                          if (style === 'Grayscale') setEditedPhoto(p => ({...p, filters: {...p.filters, grayscale: 100, sepia: 0}}));
                          if (style === 'Sepia') setEditedPhoto(p => ({...p, filters: {...p.filters, sepia: 100, grayscale: 0}}));
                          if (style === 'Warm') setEditedPhoto(p => ({...p, filters: {...p.filters, brightness: 110, sepia: 30}}));
                          if (style === 'Cool') setEditedPhoto(p => ({...p, filters: {...p.filters, contrast: 120, brightness: 90}}));
                        }}
                        className="h-20 bg-slate-800 rounded-lg border border-slate-700 hover:border-indigo-500 transition-all flex items-center justify-center text-sm text-slate-300"
                     >
                       {style}
                     </button>
                   ))}
                 </div>
              </div>
            )}

            {activeTab === 'narrate' && (
              <div className="space-y-6">
                <div>
                  <label className="block text-xs text-slate-400 mb-2 flex items-center gap-2">
                    <Type size={14} /> Written Narration
                  </label>
                  <textarea
                    value={editedPhoto.narration}
                    onChange={(e) => setEditedPhoto(p => ({ ...p, narration: e.target.value }))}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg p-3 text-sm text-white focus:ring-1 focus:ring-indigo-500 outline-none h-32 resize-none"
                    placeholder="Type the story behind this photo..."
                  />
                  {editedPhoto.narration && (
                    <button 
                      onClick={handleGenerateSpeech}
                      disabled={isGeneratingSpeech}
                      className="mt-2 text-xs flex items-center gap-1.5 text-indigo-400 hover:text-indigo-300 disabled:opacity-50"
                    >
                      {isGeneratingSpeech ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                      Generate Audio Narration
                    </button>
                  )}
                </div>

                <div>
                   <label className="block text-xs text-slate-400 mb-2 flex items-center gap-2">
                    <Wand2 size={14} /> AI Auto-Narration
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {['Cinematic', 'Emotional', 'Humorous'].map(tone => (
                      <button
                        key={tone}
                        disabled={isGeneratingAI}
                        onClick={() => handleAINarration(tone)}
                        className="px-3 py-1 bg-slate-800 hover:bg-slate-700 rounded text-xs text-indigo-300 border border-slate-700"
                      >
                        {tone}
                      </button>
                    ))}
                  </div>
                  {isGeneratingAI && <p className="text-xs text-indigo-400 mt-2 animate-pulse">Generating...</p>}
                </div>

                <div className="pt-4 border-t border-slate-700">
                  <label className="block text-xs text-slate-400 mb-2 flex items-center gap-2">
                    <Mic size={14} /> Voice Narration
                  </label>
                  
                  <div className="flex items-center gap-4">
                    <button
                      onClick={toggleRecording}
                      className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${
                        isRecording ? 'bg-red-500 animate-pulse' : 'bg-slate-700 hover:bg-slate-600'
                      }`}
                    >
                      {isRecording ? <StopCircle className="text-white" /> : <Mic className="text-slate-300" />}
                    </button>
                    <div className="flex-1">
                      {isRecording ? (
                        <span className="text-red-400 text-sm">Recording...</span>
                      ) : editedPhoto.audioNarrationUrl ? (
                         <div className="flex items-center gap-2 bg-slate-800 p-2 rounded-lg relative group">
                           {/* Conditionally render audio only if URL is present to prevent errors */}
                           {editedPhoto.audioNarrationUrl && (
                             <audio src={editedPhoto.audioNarrationUrl} controls className="h-8 w-full" />
                           )}
                           <button 
                             onClick={() => setShowAudioMenu(!showAudioMenu)}
                             className="p-1.5 hover:bg-slate-700 rounded-full text-slate-400 hover:text-white transition-colors"
                             title="More options"
                           >
                             <MoreVertical size={16} />
                           </button>

                           {/* Dropdown Menu */}
                           {showAudioMenu && (
                             <div className="absolute right-0 top-12 bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-20 w-48 overflow-hidden">
                               <button 
                                 onClick={handleTranscribe}
                                 disabled={isTranscribing}
                                 className="w-full px-4 py-3 text-left text-sm text-slate-300 hover:bg-slate-700 hover:text-white flex items-center gap-2 transition-colors disabled:opacity-50"
                               >
                                 {isTranscribing ? <Loader2 size={14} className="animate-spin" /> : <FileText size={14} />}
                                 Transcribe to Text
                               </button>
                             </div>
                           )}
                         </div>
                      ) : (
                        <span className="text-slate-500 text-xs">No recording yet</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ImageEditor;