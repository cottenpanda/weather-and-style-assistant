import { useState } from 'react';
import { ImageWithFallback } from './figma/ImageWithFallback';
import { ChevronLeft, ChevronRight, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface OutfitItem {
  name: string;
  imageUrl: string;
}

interface OutfitVariation {
  style: string;
  items: OutfitItem[];
}

interface OutfitCardProps {
  summary: string;
  note?: string;
  variations: OutfitVariation[];
  demoMode?: boolean;
  matchHeight?: boolean; // For comparison mode to match heights
  onGenerateOutfit?: () => void; // Callback for generate outfit button
  color?: string; // Color for the generate button to match weather chart
  location?: string; // City name to display in headline
}

export function OutfitCard({ summary, note, variations, demoMode = false, matchHeight = false, onGenerateOutfit, color = '#3B82F6', location }: OutfitCardProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [direction, setDirection] = useState(0); // 1 for next, -1 for prev

  const handlePrev = () => {
    setDirection(-1);
    setCurrentIndex((prev) => (prev === 0 ? variations.length - 1 : prev - 1));
  };

  const handleNext = () => {
    setDirection(1);
    setCurrentIndex((prev) => (prev === variations.length - 1 ? 0 : prev + 1));
  };

  const currentVariation = variations[currentIndex];

  // Animation variants for smooth slide transitions
  const slideVariants = {
    enter: (direction: number) => ({
      x: direction > 0 ? 300 : -300,
      opacity: 0,
    }),
    center: {
      x: 0,
      opacity: 1,
    },
    exit: (direction: number) => ({
      x: direction > 0 ? -300 : 300,
      opacity: 0,
    }),
  };

  return (
    <div className={`bg-white rounded-xl overflow-hidden flex flex-col ${matchHeight ? 'h-full' : ''}`}>
      {/* Header */}
      <div className="p-4">
        <div className="flex items-center justify-between mb-2 gap-2">
          <h3 className="md-title-medium text-[#111827]">
            {location || 'Outfit Recommendation'}
          </h3>
          <div className="flex items-center gap-2">
            {onGenerateOutfit && (
              <button
                onClick={onGenerateOutfit}
                className="md-label-large bg-[#111111] hover:bg-[#333333] active:bg-[#555555] text-white px-4 py-2 rounded-full transition-colors duration-200 whitespace-nowrap flex items-center gap-2"
                style={{ backgroundColor: color }}
              >
                <Sparkles className="w-4 h-4" />
                Generate Outfit
              </button>
            )}
            {demoMode && (
              <span className="md-label-small bg-[#FEF3C7] text-[#92400E] px-3 py-1.5 rounded-full border border-[#F59E0B]">
                ⚠️ Demo Data
              </span>
            )}
          </div>
        </div>
        <p className="md-body-medium text-[#6B7280]">{summary}</p>
        {note && (
          <p className="md-body-small text-[rgb(107,114,128)] mt-2 truncate">
            {note.replace(/[☔❄️💨🌡️]/g, '').trim()}
          </p>
        )}
      </div>

      {/* Style Selector with Arrows */}
      {variations.length > 1 && (
        <div className="px-4 pb-3 flex items-center justify-between gap-3">
          <button
            onClick={handlePrev}
            className="w-8 h-8 rounded-full bg-[#F3F4F6] hover:bg-[#E5E7EB] active:bg-[#D1D5DB] flex items-center justify-center transition-colors duration-200"
            aria-label="Previous style"
          >
            <ChevronLeft className="w-5 h-5 text-[#111827]" />
          </button>
          
          <div className="flex-1 text-center">
            <p className="md-label-large text-[rgb(134,134,134)]">{currentVariation.style}</p>
            <div className="flex items-center justify-center gap-1.5 mt-1 bg-[rgba(17,17,17,0)]">
              {variations.map((_, index) => (
                <div
                  key={index}
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    index === currentIndex
                      ? 'w-6 bg-[#111827]'
                      : 'w-1.5 bg-[#E5E7EB]'
                  }`}
                />
              ))}
            </div>
          </div>

          <button
            onClick={handleNext}
            className="w-8 h-8 rounded-full bg-[#F3F4F6] hover:bg-[#E5E7EB] active:bg-[#D1D5DB] flex items-center justify-center transition-colors duration-200"
            aria-label="Next style"
          >
            <ChevronRight className="w-5 h-5 text-[#111827]" />
          </button>
        </div>
      )}

      {/* Outfit Items Grid with Transition */}
      <div className="relative overflow-hidden">
        <AnimatePresence initial={false} custom={direction} mode="popLayout">
          <motion.div
            key={currentIndex}
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{
              x: { type: "spring", stiffness: 400, damping: 40 },
              opacity: { duration: 0.2 }
            }}
            className={`grid grid-cols-3 gap-2 p-3 ${matchHeight ? 'absolute inset-0' : ''}`}
          >
            {currentVariation.items.map((item, index) => (
              <div
                key={index}
                className="bg-[#F8F9FA] rounded-lg overflow-hidden"
              >
                {/* Image */}
                <div className="aspect-square w-full bg-[#E5E7EB] relative">
                  <ImageWithFallback
                    src={item.imageUrl}
                    alt={item.name}
                    className="w-full h-full object-cover"
                  />
                </div>
                {/* Label */}
                <div className="p-1.5">
                  <p className="md-label-medium text-[#111827] text-center">{item.name}</p>
                </div>
              </div>
            ))}
          </motion.div>
        </AnimatePresence>
        {/* Invisible placeholder to maintain height - only needed in comparison mode */}
        {matchHeight && (
          <div className="grid grid-cols-3 gap-2 p-3 invisible">
            {currentVariation.items.map((item, index) => (
              <div key={index} className="bg-[#F8F9FA] rounded-lg overflow-hidden">
                <div className="aspect-square w-full bg-[#E5E7EB] relative"></div>
                <div className="p-1.5">
                  <p className="md-label-medium text-[#111827] text-center">{item.name}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}