import { motion } from 'motion/react';
import { ImageWithFallback } from './figma/ImageWithFallback';
import { Shirt, Cloud, Droplets, Sun, Snowflake } from 'lucide-react';
import { useState, useEffect } from 'react';

interface GeneratedOutfitCardProps {
  cityName: string;
  imageUrl?: string;
  isGenerating: boolean;
  error?: string;
}

export function GeneratedOutfitCard({ cityName, imageUrl, isGenerating, error }: GeneratedOutfitCardProps) {
  const [currentIconIndex, setCurrentIconIndex] = useState(0);
  const icons = [Shirt, Cloud, Droplets, Sun, Snowflake];
  
  useEffect(() => {
    if (!isGenerating) return;
    
    const interval = setInterval(() => {
      setCurrentIconIndex((prev) => (prev + 1) % icons.length);
    }, 800);
    
    return () => clearInterval(interval);
  }, [isGenerating]);
  
  const CurrentIcon = icons[currentIconIndex];
  
  return (
    <div className="bg-[#FFFFFF] rounded-2xl p-4 border border-[#E5E7EB]">
      <h3 className="text-[#111827] mb-3">
        Outfit in {cityName}
      </h3>
      
      {isGenerating && (
        <div className="flex flex-col items-center justify-center py-12">
          {/* Animated Icon */}
          <motion.div
            key={currentIconIndex}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ duration: 0.4 }}
            className="mb-4"
          >
            <CurrentIcon className="w-16 h-16 text-[#9CA3AF]" strokeWidth={1.5} />
          </motion.div>
          
          {/* Loading text with animation */}
          <motion.div
            className="flex items-center gap-1"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
          >
            <span className="text-[#6B7280]">Generating your perfect outfit</span>
            <motion.span
              animate={{ opacity: [0, 1, 0] }}
              transition={{ duration: 1.5, repeat: Infinity }}
            >
              .
            </motion.span>
            <motion.span
              animate={{ opacity: [0, 1, 0] }}
              transition={{ duration: 1.5, repeat: Infinity, delay: 0.2 }}
            >
              .
            </motion.span>
            <motion.span
              animate={{ opacity: [0, 1, 0] }}
              transition={{ duration: 1.5, repeat: Infinity, delay: 0.4 }}
            >
              .
            </motion.span>
          </motion.div>
        </div>
      )}
      
      {error && (
        <div className="flex flex-col items-center justify-center py-8">
          <div className="w-16 h-16 mb-3 flex items-center justify-center bg-[#FEE2E2] rounded-full">
            <span className="text-2xl">⚠️</span>
          </div>
          <p className="text-[#DC2626] text-center">{error}</p>
        </div>
      )}
      
      {imageUrl && !isGenerating && !error && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4 }}
          className="rounded-xl overflow-hidden"
        >
          <ImageWithFallback
            src={imageUrl}
            alt={`AI-generated outfit for ${cityName}`}
            className="w-full h-auto object-cover"
          />
        </motion.div>
      )}
    </div>
  );
}