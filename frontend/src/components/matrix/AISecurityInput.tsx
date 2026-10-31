import React, { useState } from 'react';
import { Shield, ArrowUp } from 'lucide-react';

export const AISecurityInput: React.FC = () => {
  const [input, setInput] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    
    setIsGenerating(true);
    setTimeout(() => {
      setIsGenerating(false);
      setInput('');
    }, 2000);
  };

  return (
    <div className="relative group">
      {/* Glow effect */}
      <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-500/10 to-blue-500/5 rounded-2xl blur opacity-0 group-hover:opacity-100 transition duration-1000" />
      
      <form onSubmit={handleSubmit} className="relative bg-surface rounded-2xl border border-ink/10 p-2 flex items-center">
        <div className="pl-4 pr-2">
          {isGenerating ? (
            <Shield className="w-5 h-5 text-blue-400 animate-pulse" />
          ) : (
            <Shield className="w-5 h-5 text-ink/30" />
          )}
        </div>
        
        <input 
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Describe your security concern..."
          disabled={isGenerating}
          className="flex-1 bg-transparent border-none outline-none text-ink placeholder-ink/30 text-sm py-3"
        />
        
        <button 
          type="submit"
          disabled={!input.trim() || isGenerating}
          className={`
            p-2 rounded-xl flex items-center justify-center transition-all
            ${input.trim() && !isGenerating ? 'bg-ink text-brand-ink hover:bg-ink/90' : 'bg-ink/5 text-ink/20'}
          `}
        >
          <ArrowUp className="w-5 h-5" />
        </button>
      </form>
    </div>
  );
};
