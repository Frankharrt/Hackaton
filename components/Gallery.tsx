import React, { useState, useMemo, useEffect } from 'react';
import { Photo, ImageCategory } from '../types';
import { Trash2, Edit, Plus, FolderPlus, X } from 'lucide-react';

interface GalleryProps {
  photos: Photo[];
  onUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onDelete: (id: string) => void;
  onEdit: (id: string) => void;
  onAddDemo: () => void;
  onUpdateCategory: (id: string, newCategory: string) => void;
  customCategories: string[];
  onAddCustomCategory: (cat: string) => void;
  onDeleteCustomCategory: (cat: string) => void;
}

const Gallery: React.FC<GalleryProps> = ({ 
  photos, 
  onUpload, 
  onDelete, 
  onEdit, 
  onAddDemo, 
  onUpdateCategory,
  customCategories,
  onAddCustomCategory,
  onDeleteCustomCategory
}) => {
  const [activeCategory, setActiveCategory] = useState<string>('All');
  const [isDragging, setIsDragging] = useState(false);
  const [newCatName, setNewCatName] = useState('');

  // Stable reference for built-in categories
  const builtInCategories = useMemo(() => ['All', ...Object.values(ImageCategory)], []);

  // Merge built-in categories with custom ones
  const allCategories = useMemo(() => {
    return [...builtInCategories, ...customCategories];
  }, [customCategories, builtInCategories]);

  // Safety: If active category is deleted, switch back to All
  useEffect(() => {
    if (!allCategories.includes(activeCategory)) {
      setActiveCategory('All');
    }
  }, [allCategories, activeCategory]);

  const filteredPhotos = useMemo(() => {
    if (activeCategory === 'All') return photos;
    return photos.filter(p => p.category === activeCategory);
  }, [photos, activeCategory]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      const dataTransfer = new DataTransfer();
      Array.from(files).forEach((file) => dataTransfer.items.add(file as File));
      
      const input = document.createElement('input');
      input.type = 'file';
      input.files = dataTransfer.files;
      
      const syntheticEvent = {
        target: input,
      } as unknown as React.ChangeEvent<HTMLInputElement>;
      
      onUpload(syntheticEvent);
    }
  };

  const handleCreateCategory = () => {
    if (newCatName.trim()) {
      const name = newCatName.trim();
      if (!allCategories.includes(name)) {
        onAddCustomCategory(name);
        setNewCatName('');
        setActiveCategory(name);
      } else {
        alert("Category already exists!");
      }
    }
  };

  const handleDeleteCategory = (cat: string) => {
    if (window.confirm(`Delete category "${cat}"? Photos will be moved to Uncategorized.`)) {
      onDeleteCustomCategory(cat);
    }
  };

  return (
    <div 
      className={`min-h-[80vh] p-6 transition-colors duration-300 ${isDragging ? 'bg-slate-800' : ''}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Category Bar */}
      <div className="flex flex-wrap items-center gap-2 mb-8 overflow-x-auto pb-4 scrollbar-hide">
        {allCategories.map(cat => {
          const isCustom = customCategories.includes(cat);
          const isActive = activeCategory === cat;
          
          return (
            <div
              key={cat}
              className={`flex items-center rounded-full text-sm font-medium transition-all select-none border group ${
                isActive 
                  ? 'bg-indigo-500 text-white border-indigo-400 shadow-lg shadow-indigo-500/30' 
                  : 'bg-slate-800 text-slate-400 border-transparent hover:bg-slate-700 hover:text-white'
              }`}
            >
              <div 
                onClick={() => setActiveCategory(cat)}
                className={`cursor-pointer px-4 py-2 ${isCustom ? 'pr-2' : ''}`}
              >
                {cat}
              </div>
              
              {isCustom && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteCategory(cat);
                  }}
                  className={`mr-1 p-1 rounded-full transition-colors flex items-center justify-center ${
                    isActive 
                      ? 'hover:bg-red-500/80 text-indigo-200 hover:text-white' 
                      : 'hover:bg-red-500/80 text-slate-500 hover:text-white'
                  }`}
                  title="Delete Category"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          );
        })}
        
        <div className="flex items-center bg-slate-800 rounded-full px-2 ml-4 border border-transparent focus-within:border-indigo-500 transition-colors h-9">
          <input 
            type="text" 
            value={newCatName}
            onChange={(e) => setNewCatName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreateCategory()}
            placeholder="New Category..."
            className="bg-transparent border-none text-sm text-white focus:ring-0 w-32 px-2 placeholder-slate-500"
          />
          <button onClick={handleCreateCategory} className="p-1 text-slate-400 hover:text-indigo-400">
            <Plus size={16} />
          </button>
        </div>
      </div>

      {photos.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-96 border-2 border-dashed border-slate-700 rounded-2xl text-slate-500">
          <FolderPlus size={64} className="mb-4 opacity-50" />
          <h2 className="text-2xl font-serif mb-2">Your Gallery is Empty</h2>
          <p className="mb-6">Upload photos or try the demo experience.</p>
          <div className="flex gap-4">
            <label className="cursor-pointer bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-3 rounded-lg font-medium transition-colors">
              Upload Photos
              <input type="file" multiple accept="image/*" className="hidden" onChange={onUpload} />
            </label>
            <button 
              onClick={onAddDemo}
              className="px-6 py-3 rounded-lg border border-slate-600 hover:border-slate-400 text-slate-300 transition-all"
            >
              + Load Demo
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
          {filteredPhotos.map((photo) => (
            <div 
              key={photo.id} 
              className="group relative bg-slate-800 rounded-xl overflow-hidden shadow-xl aspect-square cursor-pointer transition-transform hover:-translate-y-1"
              onClick={() => onEdit(photo.id)}
            >
              <img 
                src={photo.url} 
                alt={photo.name} 
                className="w-full h-full object-cover transition-all duration-500 group-hover:scale-110"
                style={{
                  filter: `
                    brightness(${photo.filters.brightness}%) 
                    contrast(${photo.filters.contrast}%) 
                    saturate(${photo.filters.saturation}%) 
                    blur(${photo.filters.blur}px) 
                    sepia(${photo.filters.sepia}%) 
                    grayscale(${photo.filters.grayscale}%)
                  `,
                  transform: `rotate(${photo.rotation}deg)`
                }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-4">
                <p className="text-white font-medium truncate mb-1">{photo.name}</p>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-slate-300 bg-slate-700/50 px-2 py-1 rounded">{photo.category}</span>
                  <div className="flex gap-2">
                    <button 
                      onClick={(e) => { e.stopPropagation(); onEdit(photo.id); }}
                      className="p-2 bg-white/10 hover:bg-white/20 rounded-full backdrop-blur-sm"
                    >
                      <Edit size={16} className="text-white" />
                    </button>
                    <button 
                      onClick={(e) => { e.stopPropagation(); onDelete(photo.id); }}
                      className="p-2 bg-red-500/20 hover:bg-red-500/40 rounded-full backdrop-blur-sm"
                    >
                      <Trash2 size={16} className="text-red-400" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
          
          {/* Add card */}
          <label className="flex flex-col items-center justify-center bg-slate-800/50 border-2 border-dashed border-slate-700 rounded-xl cursor-pointer hover:border-indigo-500 hover:bg-slate-800 transition-all aspect-square">
             <Plus size={48} className="text-slate-600 mb-2" />
             <span className="text-slate-500 text-sm">Add Photos</span>
             <input type="file" multiple accept="image/*" className="hidden" onChange={onUpload} />
          </label>
        </div>
      )}
    </div>
  );
};

export default Gallery;