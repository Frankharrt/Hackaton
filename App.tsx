import React, { useState, useEffect } from 'react';
import { Photo, AppState, DEFAULT_FILTERS, DEMO_AUDIO_URL, ImageCategory } from './types';
import Gallery from './components/Gallery';
import ImageEditor from './components/ImageEditor';
import Slideshow from './components/Slideshow';
import AudioPanel from './components/AudioPanel';
import { suggestCategory } from './services/geminiService';
import { Layout, Images, PlayCircle, Music, Settings, User } from 'lucide-react';

const App: React.FC = () => {
  const [state, setState] = useState<AppState>(() => {
    try {
      const saved = localStorage.getItem('cineMemories_state');
      if (saved) {
        const parsed = JSON.parse(saved);
        return { 
          ...parsed, 
          currentView: 'gallery', 
          editingPhotoId: null, 
          isAudioPlaying: false 
        };
      }
    } catch (e) {
      console.warn("Failed to load state", e);
    }
    return {
      photos: [],
      currentView: 'gallery',
      editingPhotoId: null,
      selectedAudio: DEMO_AUDIO_URL,
      isAudioPlaying: false,
      audioVolume: 50,
    };
  });
  
  const [showAudioPanel, setShowAudioPanel] = useState(false);
  const [customCategories, setCustomCategories] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('cineMemories_categories');
      return saved ? JSON.parse(saved) : [];
    } catch (e) { return []; }
  });

  useEffect(() => {
    try {
      localStorage.setItem('cineMemories_state', JSON.stringify(state));
    } catch (e) {
      console.warn("State save failed (likely quota exceeded)", e);
    }
  }, [state]);

  useEffect(() => {
    localStorage.setItem('cineMemories_categories', JSON.stringify(customCategories));
  }, [customCategories]);

  // Helpers
  const generateId = () => Math.random().toString(36).substr(2, 9);

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = error => reject(error);
    });
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newPhotos: Photo[] = [];
      const files = Array.from(e.target.files) as File[];

      for (const file of files) {
        try {
          const url = await fileToBase64(file);
          const photo: Photo = {
            id: generateId(),
            url,
            originalUrl: url,
            name: file.name,
            category: ImageCategory.UNCATEGORIZED,
            narration: '',
            filters: { ...DEFAULT_FILTERS },
            rotation: 0
          };
          newPhotos.push(photo);
        } catch (err) {
          console.error("Error reading file", err);
        }
      }

      setState(prev => ({ ...prev, photos: [...prev.photos, ...newPhotos] }));

      // Process Categories in background with Gemini
      const processCategoriesQueue = async () => {
        for (const p of newPhotos) {
          try {
            const cat = await suggestCategory(p.url);
            setState(prev => ({
              ...prev,
              photos: prev.photos.map(existing => 
                existing.id === p.id ? { ...existing, category: cat } : existing
              )
            }));
            await new Promise(resolve => setTimeout(resolve, 1000));
          } catch (err) {
            console.warn(`Categorization skipped for ${p.name}`);
          }
        }
      };

      processCategoriesQueue();
    }
  };

  const handleReorder = (fromId: string, toId: string) => {
    setState(prev => {
      const photos = [...prev.photos];
      const fromIndex = photos.findIndex(p => p.id === fromId);
      const toIndex = photos.findIndex(p => p.id === toId);
      
      if (fromIndex === -1 || toIndex === -1 || fromIndex === toIndex) return prev;
      
      const [movedItem] = photos.splice(fromIndex, 1);
      // Recalculate insertion index because removal might affect it
      const newToIndex = photos.findIndex(p => p.id === toId);
      // If we are moving down the list, we insert after the target. 
      // If we are moving up, we insert before.
      // However, simplified splice insertion at the target's current index works well for direct swaps or inserts.
      // But standard drag behavior usually implies inserting 'at' the location, pushing others down.
      // Let's just insert at newToIndex.
      photos.splice(newToIndex, 0, movedItem);
      
      return { ...prev, photos };
    });
  };

  const handleAddDemo = () => {
    const demoData = [
      { url: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=800&q=80", cat: ImageCategory.PEOPLE, text: "In the quiet moments of the afternoon, her gaze held a thousand unspoken stories, reflecting a wisdom far beyond her years." },
      { url: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=800&q=80", cat: ImageCategory.PEOPLE, text: "A rugged determination etched into his features, marking the end of a long journey and the beginning of a legacy." },
      { url: "https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=800&q=80", cat: ImageCategory.LANDSCAPES, text: "The mist rolled over the hills like a soft blanket, whispering secrets to the ancient trees that stood guard over the valley." },
      { url: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800&q=80", cat: ImageCategory.PEOPLE, text: "His laughter echoed through the city streets, a candid moment of pure joy caught in the golden hour light." },
      { url: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=800&q=80", cat: ImageCategory.PEOPLE, text: "With the wind in his hair and the horizon ahead, he knew that this was the freedom he had always been searching for." },
      { url: "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=800&q=80", cat: ImageCategory.LANDSCAPES, text: "Sunlight pierced through the dense canopy, illuminating the forest floor in a dance of shadows and emerald light." },
      { url: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=800&q=80", cat: ImageCategory.PEOPLE, text: "There is a quiet strength in her eyes, a resilience built from storms weathered and sunrises witnessed." },
      { url: "https://images.unsplash.com/photo-1501785888041-af3ef285b470?w=800&q=80", cat: ImageCategory.LANDSCAPES, text: "The ocean crashed against the cliffs with a rhythmic lullaby, reminding us of the timeless power of the tides." },
      { url: "https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=800&q=80", cat: ImageCategory.PEOPLE, text: "Caught in a moment of reflection, she found peace amidst the chaos of the bustling world around her." },
      { url: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=800&q=80", cat: ImageCategory.PEOPLE, text: "A smile that could light up the darkest room, carrying the warmth of summer wherever she went." }
    ];

    const newPhotos = demoData.map((item, i) => ({
      id: generateId(),
      url: item.url,
      originalUrl: item.url,
      name: `Demo Photo ${i + 1}`,
      category: item.cat,
      narration: item.text,
      filters: { ...DEFAULT_FILTERS },
      rotation: 0
    }));

    setState(prev => ({ ...prev, photos: [...prev.photos, ...newPhotos] }));
  };

  const saveEditedPhoto = (updatedPhoto: Photo) => {
    setState(prev => ({
      ...prev,
      photos: prev.photos.map(p => p.id === updatedPhoto.id ? updatedPhoto : p),
      currentView: 'gallery',
      editingPhotoId: null
    }));
  };

  const deletePhoto = (id: string) => {
    setState(prev => ({ ...prev, photos: prev.photos.filter(p => p.id !== id) }));
  };

  const handleDeleteCustomCategory = (category: string) => {
    setCustomCategories(prev => prev.filter(c => c !== category));
    setState(prev => ({
      ...prev,
      photos: prev.photos.map(p => 
        p.category === category ? { ...p, category: ImageCategory.UNCATEGORIZED } : p
      )
    }));
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 font-sans selection:bg-indigo-500 selection:text-white">
      {/* Top Navigation */}
      <nav className="fixed top-0 left-0 right-0 h-16 bg-slate-900/80 backdrop-blur-md border-b border-slate-800 flex items-center justify-between px-6 z-40">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-gradient-to-tr from-indigo-500 to-purple-500 rounded-lg flex items-center justify-center">
            <Layout className="text-white" size={18} />
          </div>
          <h1 className="text-xl font-serif font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-200 to-purple-200">
            CineMemories
          </h1>
        </div>

        <div className="flex items-center gap-2 md:gap-6">
          <button 
             onClick={() => document.getElementById('main-upload')?.click()} 
             className="text-sm font-medium hover:text-white transition-colors"
          >
            Upload Photo
          </button>
          {/* Hidden input for nav button */}
          <input id="main-upload" type="file" multiple accept="image/*" className="hidden" onChange={handleUpload} />

          <button onClick={handleAddDemo} className="text-sm font-medium hover:text-white transition-colors">
            +Demo
          </button>
          
          <button onClick={() => setShowAudioPanel(true)} className="text-sm font-medium hover:text-white transition-colors flex items-center gap-1">
             <Music size={16} /> Audio
          </button>

          <button 
            onClick={() => setState(p => ({ ...p, currentView: 'slideshow' }))}
            disabled={state.photos.length === 0}
            className="bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2 rounded-full font-medium transition-all transform hover:scale-105 shadow-lg shadow-indigo-600/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <PlayCircle size={18} /> Start Slide
          </button>
        </div>
      </nav>

      {/* Main Content Area */}
      <main className="pt-20">
        {state.currentView === 'gallery' && (
          <Gallery 
            photos={state.photos} 
            onUpload={handleUpload}
            onDelete={deletePhoto}
            onEdit={(id) => setState(p => ({ ...p, currentView: 'editor', editingPhotoId: id }))}
            onReorder={handleReorder}
            onAddDemo={handleAddDemo}
            onUpdateCategory={(id, cat) => {
              setState(p => ({
                ...p,
                photos: p.photos.map(photo => photo.id === id ? { ...photo, category: cat } : photo)
              }))
            }}
            customCategories={customCategories}
            onAddCustomCategory={(c) => setCustomCategories(p => [...p, c])}
            onDeleteCustomCategory={handleDeleteCustomCategory}
          />
        )}

        {state.currentView === 'editor' && state.editingPhotoId && (
          <ImageEditor 
            photo={state.photos.find(p => p.id === state.editingPhotoId)!}
            onSave={saveEditedPhoto}
            onCancel={() => setState(p => ({ ...p, currentView: 'gallery', editingPhotoId: null }))}
          />
        )}
      </main>

      {/* Overlays */}
      {state.currentView === 'slideshow' && (
        <Slideshow 
          photos={state.photos} 
          onClose={() => setState(p => ({ ...p, currentView: 'gallery' }))} 
          audioUrl={state.selectedAudio || DEMO_AUDIO_URL}
          volume={state.audioVolume}
        />
      )}

      {showAudioPanel && (
        <AudioPanel 
          onSelectAudio={(url) => setState(p => ({ ...p, selectedAudio: url }))}
          currentAudio={state.selectedAudio}
          volume={state.audioVolume}
          setVolume={(v) => setState(p => ({ ...p, audioVolume: v }))}
          onClose={() => setShowAudioPanel(false)}
        />
      )}
    </div>
  );
};

export default App;