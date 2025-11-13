import { useState, useRef, useEffect } from "react";
import { ChatMessage } from "./components/ChatMessage";
import { WeatherChart } from "./components/WeatherChart";
import { OutfitCard } from "./components/OutfitCard";
import { GeneratedOutfitCard } from "./components/GeneratedOutfitCard";
import { Input } from "./components/ui/input";
import { Button } from "./components/ui/button";
import { ScrollArea } from "./components/ui/scroll-area";
import { Send, Cloud, Sparkles } from "lucide-react";
import { projectId, publicAnonKey } from './utils/supabase/info';

interface WeatherData {
  location: string;
  country: string;
  temperature: number;
  feelsLike: number;
  condition: string;
  description: string;
  humidity: number;
  windSpeed: number;
}

interface OutfitItem {
  name: string;
  query: string;
}

interface OutfitVariation {
  style: string;
  items: OutfitItem[];
}

interface OutfitData {
  summary: string;
  note?: string;
  variations: OutfitVariation[];
}

interface OutfitItemWithImage {
  name: string;
  imageUrl: string;
}

interface OutfitVariationWithImages {
  style: string;
  items: OutfitItemWithImage[];
}

interface Message {
  id: string;
  text?: string;
  isUser: boolean;
  timestamp: string;
  weatherData?: WeatherData;
  outfitData?: {
    summary: string;
    note?: string;
    variations: OutfitVariationWithImages[];
  };
  comparisonData?: {
    city1: {
      weather: WeatherData;
      outfit: {
        summary: string;
        note?: string;
        variations: OutfitVariationWithImages[];
      };
    };
    city2: {
      weather: WeatherData;
      outfit: {
        summary: string;
        note?: string;
        variations: OutfitVariationWithImages[];
      };
    };
  };
  generatedOutfit?: {
    cityName: string;
    imageUrl?: string;
    isGenerating: boolean;
    error?: string;
    taskId?: string;
  };
  demoMode?: boolean;
}

async function getWeatherResponse(userMessage: string, fetchImage: (query: string) => Promise<string>): Promise<{ message?: Message; error?: string }> {
  const message = userMessage.toLowerCase();
  
  // Check if this is a comparison request
  const comparisonPatterns = [
    /compare\s+(.+?)\s+(?:and|vs|versus)\s+(.+)/i,
    /(.+?)\s+vs\s+(.+)/i,
    /(.+?)\s+versus\s+(.+)/i,
  ];
  
  for (const pattern of comparisonPatterns) {
    const match = userMessage.match(pattern);
    if (match && match[1] && match[2]) {
      // Clean city names
      let city1 = match[1].trim()
        .replace(/compare/gi, '')
        .replace(/weather in/gi, '')
        .replace(/weather for/gi, '')
        .replace(/weather/gi, '')
        .replace(/the/gi, '')
        .replace(/\?/g, '')
        .trim();
      
      let city2 = match[2].trim()
        .replace(/weather in/gi, '')
        .replace(/weather for/gi, '')
        .replace(/weather/gi, '')
        .replace(/the/gi, '')
        .replace(/\?/g, '')
        .trim();
      
      console.log(`[COMPARISON] Detected comparison: "${city1}" vs "${city2}"`);
      
      // Fetch weather for both cities in parallel
      try {
        const url = `https://${projectId}.supabase.co/functions/v1/make-server-0cb63601/weather`;
        
        const [response1, response2] = await Promise.all([
          fetch(url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${publicAnonKey}`,
            },
            body: JSON.stringify({ location: city1 }),
          }),
          fetch(url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${publicAnonKey}`,
            },
            body: JSON.stringify({ location: city2 }),
          }),
        ]);
        
        if (!response1.ok || !response2.ok) {
          const error1 = !response1.ok ? await response1.json() : null;
          const error2 = !response2.ok ? await response2.json() : null;
          return { 
            error: `I'm sorry, I couldn't fetch weather data. ${error1?.error || ''} ${error2?.error || ''}`.trim() 
          };
        }
        
        const [data1, data2] = await Promise.all([
          response1.json(),
          response2.json(),
        ]);
        
        console.log(`[COMPARISON] Got data for both cities`);
        
        // Fetch images for both outfit sets
        const outfitVariations1 = await Promise.all(
          data1.outfit.variations.map(async (variation: OutfitVariation, varIndex: number) => ({
            style: variation.style,
            items: await Promise.all(
              variation.items.map(async (item: OutfitItem) => ({
                name: item.name,
                imageUrl: await fetchImage(item.query),
              }))
            ),
          }))
        );
        
        const outfitVariations2 = await Promise.all(
          data2.outfit.variations.map(async (variation: OutfitVariation) => ({
            style: variation.style,
            items: await Promise.all(
              variation.items.map(async (item: OutfitItem) => ({
                name: item.name,
                imageUrl: await fetchImage(item.query),
              }))
            ),
          }))
        );
        
        return {
          message: {
            id: (Date.now() + 1).toString(),
            isUser: false,
            timestamp: getCurrentTime(),
            comparisonData: {
              city1: {
                weather: data1.weather,
                outfit: {
                  summary: data1.outfit.summary,
                  note: data1.outfit.note,
                  variations: outfitVariations1,
                },
              },
              city2: {
                weather: data2.weather,
                outfit: {
                  summary: data2.outfit.summary,
                  note: data2.outfit.note,
                  variations: outfitVariations2,
                },
              },
            },
            demoMode: data1.demoMode || data2.demoMode,
          }
        };
      } catch (error) {
        console.error("[COMPARISON] ❌ FETCH ERROR:", error);
        return { error: `I'm having trouble comparing cities right now. Please try again in a moment.` };
      }
    }
  }
  
  // Not a comparison request, continue with single city logic
  // Extract location from message
  let location = "";
  
  // Try to extract location from common patterns with prepositions
  const prepositionPatterns = [
    /(?:in|for|at)\s+([a-z\s]+?)(?:\s+today|\s+tomorrow|\s+tonight|\s+right now|\s+currently|\s*\?|$)/i,
  ];
  
  for (const pattern of prepositionPatterns) {
    const match = userMessage.match(pattern);
    if (match && match[1]) {
      location = match[1].trim();
      break;
    }
  }
  
  // If no preposition pattern matched, try to extract just the city name
  // Look for patterns like "london", "weather london", "london weather"
  if (!location) {
    // Remove common weather-related words and time references
    const cleanedMessage = userMessage
      .toLowerCase()
      .replace(/what's/gi, '')
      .replace(/what is/gi, '')
      .replace(/the/gi, '')
      .replace(/weather/gi, '')
      .replace(/forecast/gi, '')
      .replace(/wear/gi, '')
      .replace(/should i/gi, '')
      .replace(/today/gi, '')
      .replace(/tomorrow/gi, '')
      .replace(/tonight/gi, '')
      .replace(/this week/gi, '')
      .replace(/next week/gi, '')
      .replace(/this month/gi, '')
      .replace(/right now/gi, '')
      .replace(/currently/gi, '')
      .replace(/\?/g, '')
      .trim();
    
    // What's left should be the location
    if (cleanedMessage) {
      location = cleanedMessage;
    }
  }
  
  // If still no location, use default
  if (!location) {
    location = "New York";
  }
  
  // Final cleanup: remove any time words that might have been captured
  location = location
    .replace(/\btoday\b/gi, '')
    .replace(/\btomorrow\b/gi, '')
    .replace(/\btonight\b/gi, '')
    .replace(/\bright now\b/gi, '')
    .replace(/\bcurrently\b/gi, '')
    .replace(/\bthis week\b/gi, '')
    .replace(/\bnext week\b/gi, '')
    .replace(/\bthis month\b/gi, '')
    .replace(/\bforecast\b/gi, '')
    .trim();

  try {
    const url = `https://${projectId}.supabase.co/functions/v1/make-server-0cb63601/weather`;
    console.log(`[CLIENT] 🚀 Requesting weather for: ${location}`);
    console.log(`[CLIENT] 📍 URL: ${url}`);
    
    const response = await fetch(
      url,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${publicAnonKey}`,
        },
        body: JSON.stringify({ location }),
      }
    );

    console.log(`[CLIENT] 📥 Response status: ${response.status} ${response.statusText}`);

    if (!response.ok) {
      const errorData = await response.json();
      console.error("[CLIENT] ❌ Weather API error:", errorData);
      
      // If it's a setup error, provide detailed instructions
      if (errorData.setupInstructions) {
        return { error: errorData.error };
      }
      
      return { error: `I'm sorry, I couldn't fetch the weather data. ${errorData.error || 'Please try again.'}` };
    }

    const data = await response.json();
    console.log(`[CLIENT] 📦 Received data:`, data);
    const { weather, outfit, demoMode, demoReason } = data;

    if (demoMode) {
      console.log(`[CLIENT] ⚠️ DEMO MODE - Using mock weather data`);
      console.log(`[CLIENT] 🔍 Reason: ${demoReason}`);
      console.log(`[CLIENT] 💡 Solution: ${
        demoReason.includes("No API key") 
          ? "Set OPENWEATHER_API_KEY in Supabase Edge Function secrets"
          : "Wait 1-2 hours for your OpenWeatherMap API key to activate, then try again"
      }`);
    } else {
      console.log(`[CLIENT] ✅ REAL DATA - Got weather for ${weather.location}, ${weather.country}`);
    }

    // Check if outfit has structured data with variations (new format)
    const hasStructuredOutfit = outfit && typeof outfit === 'object' && outfit.variations;
    
    // Fetch images for all outfit variations if available
    const outfitVariations = await Promise.all(
      data.outfit.variations.map(async (variation: OutfitVariation) => ({
        style: variation.style,
        items: await Promise.all(
          variation.items.map(async (item: OutfitItem) => ({
            name: item.name,
            imageUrl: await fetchImage(item.query),
          }))
        ),
      }))
    );
    
    // Always show both weather chart and outfit card together
    return {
      message: {
        id: (Date.now() + 1).toString(),
        isUser: false,
        timestamp: getCurrentTime(),
        weatherData: weather,
        outfitData: outfitVariations ? {
          summary: outfit.summary,
          note: outfit.note,
          variations: outfitVariations,
        } : undefined,
        demoMode,
      }
    };
    
  } catch (error) {
    console.error("[CLIENT] ❌ FETCH ERROR:", error);
    console.error("[CLIENT] Error details:", {
      message: error.message,
      name: error.name,
      stack: error.stack,
    });
    return { error: `I'm having trouble connecting to the weather service right now. Please try again in a moment.` };
  }
}

function getCurrentTime(): string {
  const now = new Date();
  return now.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function App() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      text: "Hi! I'm your Weather & Style Assistant.\n\nAsk about any city and I'll show you:\n• Live weather with charts\n• Smart outfit picks + styled images\n• City-to-city comparisons\n\nTry:\n• Weather in Seattle\n• Compare Tokyo and New York",
      isUser: false,
      timestamp: getCurrentTime(),
    },
  ]);
  const [inputValue, setInputValue] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  // Image cache with diverse Unsplash images for each query
  const imageCache: Record<string, string> = {
    // Extreme cold
    "black puffer jacket down coat": "https://images.unsplash.com/photo-1521681867701-9962f648c1b6?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxibGFjayUyMHB1ZmZlciUyMGphY2tldHxlbnwxfHx8fDE3NjI4ODg5NjZ8MA&ixlib=rb-4.1.0&q=80&w=1080",
    "merino wool thermal shirt": "https://images.unsplash.com/photo-1673168869484-dce7ec2d0499?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxtZXJpbm8lMjB3b29sJTIwdGhlcm1hbHxlbnwxfHx8fDE3NjI4ODg5NjZ8MA&ixlib=rb-4.1.0&q=80&w=1080",
    "snow boots waterproof": "https://images.unsplash.com/photo-1690702692894-110f6e88c390?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxzbm93JTIwYm9vdHMlMjB3YXRlcnByb29mfGVufDF8fHx8MTc2Mjg4ODk2N3ww&ixlib=rb-4.1.0&q=80&w=1080",
    "wool scarf knit gloves set": "https://images.unsplash.com/photo-1639654827521-cb4f5edf8675?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHx3b29sJTIwc2NhcmYlMjBnbG92ZXN8ZW58MXx8fHwxNzYyODg4OTY3fDA&ixlib=rb-4.1.0&q=80&w=1080",
    "navy blue winter parka": "https://images.unsplash.com/photo-1610636359791-bdac02d318b5?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxuYXZ5JTIwd2ludGVyJTIwcGFya2F8ZW58MXx8fHwxNzYyODg4OTY4fDA&ixlib=rb-4.1.0&q=80&w=1080",
    "cable knit sweater beige": "https://images.unsplash.com/photo-1758537698215-af1e35acb911?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjYWJsZSUyMGtuaXQlMjBzd2VhdGVyfGVufDF8fHx8MTc2Mjg4ODk2OHww&ixlib=rb-4.1.0&q=80&w=1080",
    "leather winter boots brown": "https://images.unsplash.com/photo-1639270602419-6392f0723174?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxsZWF0aGVyJTIwd2ludGVyJTIwYm9vdHN8ZW58MXx8fHwxNzYyODg4OTY4fDA&ixlib=rb-4.1.0&q=80&w=1080",
    "beanie hat winter mittens": "https://images.unsplash.com/photo-1740381698754-3920d7407365?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxiZWFuaWUlMjB3aW50ZXIlMjBtaXR0ZW5zfGVufDF8fHx8MTc2Mjg4ODk2OXww&ixlib=rb-4.1.0&q=80&w=1080",
    "long wool coat gray": "https://images.unsplash.com/photo-1608227611229-4f8d1d5339b6?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxsb25nJTIwd29vbCUyMGNvYXR8ZW58MXx8fHwxNzYyODg4OTY5fDA&ixlib=rb-4.1.0&q=80&w=1080",
    "turtleneck sweater black": "https://images.unsplash.com/photo-1591470481729-2bcc11e3acb8?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHx0dXJ0bGVuZWNrJTIwc3dlYXRlciUyMGJsYWNrfGVufDF8fHx8MTc2Mjg4ODk2OXww&ixlib=rb-4.1.0&q=80&w=1080",
    "leather ankle boots black": "https://images.unsplash.com/photo-1571489555750-c932b569ef5d?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxibGFjayUyMGFua2xlJTIwYm9vdHN8ZW58MXx8fHwxNzYyODg4OTcwfDA&ixlib=rb-4.1.0&q=80&w=1080",
    "cashmere scarf winter": "https://images.unsplash.com/photo-1551381912-4e2e29c7fd17?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjYXNobWVyZSUyMHNjYXJmfGVufDF8fHx8MTc2MjgyOTA5Mnww&ixlib=rb-4.1.0&q=80&w=1080",
    // Cold weather
    "blue denim jacket classic": "https://images.unsplash.com/photo-1580644228275-2b826dbec5bf?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxibHVlJTIwZGVuaW0lMjBqYWNrZXR8ZW58MXx8fHwxNzYyNzkzNTQxfDA&ixlib=rb-4.1.0&q=80&w=1080",
    "cream knit sweater cozy": "https://images.unsplash.com/photo-1603906650843-b58e94d9df4d?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjcmVhbSUyMGtuaXQlMjBzd2VhdGVyfGVufDF8fHx8MTc2Mjg4ODk3MXww&ixlib=rb-4.1.0&q=80&w=1080",
    "suede ankle boots tan": "https://images.unsplash.com/photo-1761052720710-32349209f6b4?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxzdWVkZSUyMGFua2xlJTIwYm9vdHN8ZW58MXx8fHwxNzYyODg4OTcxfDA&ixlib=rb-4.1.0&q=80&w=1080",
    "plaid scarf wool": "https://images.unsplash.com/photo-1609803384069-19f3e5a70e75?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxwbGFpZCUyMHdvb2wlMjBzY2FyZnxlbnwxfHx8fDE3NjI4ODg5NzJ8MA&ixlib=rb-4.1.0&q=80&w=1080",
    "black bomber jacket leather": "https://images.unsplash.com/photo-1635588773098-7b365495e2f1?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxibGFjayUyMGJvbWJlciUyMGphY2tldHxlbnwxfHx8fDE3NjI4MTM0MDh8MA&ixlib=rb-4.1.0&q=80&w=1080",
    "gray turtleneck sweater": "https://images.unsplash.com/photo-1603906650843-b58e94d9df4d?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxncmF5JTIwdHVydGxlbmVja3xlbnwxfHx8fDE3NjI4ODg5NzJ8MA&ixlib=rb-4.1.0&q=80&w=1080",
    "black chelsea boots leather": "https://images.unsplash.com/photo-1608629601270-a0007becead3?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjaGVsc2VhJTIwYm9vdHMlMjBsZWF0aGVyfGVufDF8fHx8MTc2MjgwMTkwOXww&ixlib=rb-4.1.0&q=80&w=1080",
    "minimalist scarf black": "https://images.unsplash.com/photo-1644483518975-1a74bff3ab94?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxibGFjayUyMG1pbmltYWxpc3QlMjBzY2FyZnxlbnwxfHx8fDE3NjI4ODg5NzN8MA&ixlib=rb-4.1.0&q=80&w=1080",
    "tan beige wool overcoat jacket": "https://images.unsplash.com/photo-1539533018447-63fcce2678e3?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHx0YW4lMjB3b29sJTIwb3ZlcmNvYXR8ZW58MXx8fHwxNzYyOTAyMzgxfDA&ixlib=rb-4.1.0&q=80&w=1080",
    "burgundy knit pullover sweater crewneck": "https://images.unsplash.com/photo-1620799140188-3b2a02fd9a77?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxidXJndW5keSUyMGtuaXQlMjBwdWxsb3ZlcnxlbnwxfHx8fDE3NjI5MDIzODF8MA&ixlib=rb-4.1.0&q=80&w=1080",
    "brown leather boots vintage": "https://images.unsplash.com/photo-1638158980051-f7e67291efed?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxicm93biUyMGxlYXRoZXIlMjBib290c3xlbnwxfHx8fDE3NjI4ODg5NzR8MA&ixlib=rb-4.1.0&q=80&w=1080",
    "chunky knit scarf beige": "https://images.unsplash.com/photo-1670080589800-6416c8ce8a14?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxiZWlnZSUyMGtuaXQlMjBzY2FyZnxlbnwxfHx8fDE3NjI4ODg5NzR8MA&ixlib=rb-4.1.0&q=80&w=1080",
    // Mild cool
    "khaki field jacket spring": "https://images.unsplash.com/photo-1650594506500-c87c4c82bb43?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxraGFraSUyMGZpZWxkJTIwamFja2V0fGVufDF8fHx8MTc2Mjg4ODk3NXww&ixlib=rb-4.1.0&q=80&w=1080",
    "white oxford shirt cotton": "https://images.unsplash.com/photo-1644860588182-0998b4ef5587?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHx3aGl0ZSUyMG94Zm9yZCUyMHNoaXJ0fGVufDF8fHx8MTc2Mjg4ODk3NXww&ixlib=rb-4.1.0&q=80&w=1080",
    "white leather sneakers clean": "https://images.unsplash.com/photo-1722489291778-cb2a414d6ee0?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHx3aGl0ZSUyMGxlYXRoZXIlMjBzbmVha2Vyc3xlbnwxfHx8fDE3NjI4NTY5Mzl8MA&ixlib=rb-4.1.0&q=80&w=1080",
    "navy cardigan button front": "https://images.unsplash.com/photo-1758981400268-1181291b9503?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxidXR0b24lMjBjYXJkaWdhbiUyMHN3ZWF0ZXJ8ZW58MXx8fHwxNzYyOTAxMDcwfDA&ixlib=rb-4.1.0&q=80&w=1080",
    "striped polo shirt casual": "https://images.unsplash.com/photo-1760287363713-a864ca9b1b1f?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxzdHJpcGVkJTIwcG9sbyUyMHNoaXJ0fGVufDF8fHx8MTc2Mjg4ODk3Nnww&ixlib=rb-4.1.0&q=80&w=1080",
    "brown suede loafers": "https://images.unsplash.com/photo-1664095885197-fdff6611560c?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxicm93biUyMHN1ZWRlJTIwbG9hZmVyc3xlbnwxfHx8fDE3NjI4ODg5Nzd8MA&ixlib=rb-4.1.0&q=80&w=1080",
    "blue windbreaker jacket athletic": "https://images.unsplash.com/photo-1548126032-079a0fb0099d?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHx3aW5kYnJlYWtlciUyMGphY2tldHxlbnwxfHx8fDE3NjI4OTExODN8MA&ixlib=rb-4.1.0&q=80&w=1080",
    "gray henley shirt long sleeve": "https://images.unsplash.com/photo-1693443688057-85f57b872a3c?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxncmF5JTIwaGVubGV5JTIwc2hpcnR8ZW58MXx8fHwxNzYyODg4OTgxfDA&ixlib=rb-4.1.0&q=80&w=1080",
    "running shoes athletic colorful": "https://images.unsplash.com/photo-1739132268718-53d64165d29a?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjb2xvcmZ1bCUyMHJ1bm5pbmclMjBzaG9lc3xlbnwxfHx8fDE3NjI3ODIzODZ8MA&ixlib=rb-4.1.0&q=80&w=1080",
    // Comfortable weather
    "plain white tshirt cotton": "https://images.unsplash.com/photo-1644860588182-0998b4ef5587?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHx3aGl0ZSUyMGNvdHRvbiUyMHRzaGlydHxlbnwxfHx8fDE3NjI4ODg5ODJ8MA&ixlib=rb-4.1.0&q=80&w=1080",
    "gray cardigan lightweight spring": "https://images.unsplash.com/photo-1611780748105-42c40cdc8eae?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjYXJkaWdhbiUyMGJ1dHRvbnMlMjBvcGVufGVufDB8fHx8MTc2MjkwMTA3MXww&ixlib=rb-4.1.0&q=80&w=1080",
    "canvas sneakers blue casual": "https://images.unsplash.com/photo-1758443909732-2c4201e5b590?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxibHVlJTIwY2FudmFzJTIwc25lYWtlcnN8ZW58MXx8fHwxNzYyODAxNzIzfDA&ixlib=rb-4.1.0&q=80&w=1080",
    "navy polo shirt classic": "https://images.unsplash.com/photo-1692195400719-81a66b4fde89?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxuYXZ5JTIwcG9sbyUyMHNoaXJ0fGVufDF8fHx8MTc2Mjg4NjAzNXww&ixlib=rb-4.1.0&q=80&w=1080",
    "beige chino pants casual": "https://images.unsplash.com/photo-1756009531697-51da316bfa3a?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxiZWlnZSUyMGNoaW5vJTIwcGFudHN8ZW58MXx8fHwxNzYyODg4OTgzfDA&ixlib=rb-4.1.0&q=80&w=1080",
    "leather oxford shoes brown": "https://images.unsplash.com/photo-1616663308968-58162d332720?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxicm93biUyMG94Zm9yZCUyMHNob2VzfGVufDF8fHx8MTc2Mjg4ODk4M3ww&ixlib=rb-4.1.0&q=80&w=1080",
    "graphic tshirt black streetwear": "https://images.unsplash.com/photo-1662103627854-ae7551d1eddb?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxibGFjayUyMGdyYXBoaWMlMjB0c2hpcnR8ZW58MXx8fHwxNzYyNzk3MTc1fDA&ixlib=rb-4.1.0&q=80&w=1080",
    "oversized hoodie gray urban": "https://images.unsplash.com/photo-1580159851546-833dd8f26318?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxncmF5JTIwb3ZlcnNpemVkJTIwaG9vZGllfGVufDF8fHx8MTc2Mjg4ODk4NHww&ixlib=rb-4.1.0&q=80&w=1080",
    "high top sneakers white street": "https://images.unsplash.com/photo-1759527588071-e143b4a451b0?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHx3aGl0ZSUyMGhpZ2glMjB0b3AlMjBzbmVha2Vyc3xlbnwxfHx8fDE3NjI4ODg5ODV8MA&ixlib=rb-4.1.0&q=80&w=1080",
    // Warm weather
    "light blue tshirt cotton summer": "https://images.unsplash.com/photo-1680469975417-a7e5b6ad0784?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxsaWdodCUyMGJsdWUlMjB0c2hpcnR8ZW58MXx8fHwxNzYyODg4OTg1fDA&ixlib=rb-4.1.0&q=80&w=1080",
    "navy blue shorts casual summer": "https://images.unsplash.com/photo-1624378439140-20d221f1b36d?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxuYXZ5JTIwYmx1ZSUyMHNob3J0c3xlbnwxfHx8fDE3NjI4ODg5ODV8MA&ixlib=rb-4.1.0&q=80&w=1080",
    "leather slide sandals brown": "https://images.unsplash.com/photo-1663693586817-f7e0ceb27bd7?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxicm93biUyMGxlYXRoZXIlMjBzYW5kYWxzfGVufDF8fHx8MTc2Mjg4ODk4Nnww&ixlib=rb-4.1.0&q=80&w=1080",
    "aviator sunglasses gold": "https://images.unsplash.com/photo-1732139637229-4be95d41cce8?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxnb2xkJTIwYXZpYXRvciUyMHN1bmdsYXNzZXN8ZW58MXx8fHwxNzYyODg4OTg2fDA&ixlib=rb-4.1.0&q=80&w=1080",
    "white tank top athletic summer": "https://images.unsplash.com/photo-1759365485726-cfe4166bbfe7?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHx3aGl0ZSUyMGF0aGxldGljJTIwdGFua3xlbnwxfHx8fDE3NjI4ODg5ODd8MA&ixlib=rb-4.1.0&q=80&w=1080",
    "light wash denim shorts": "https://images.unsplash.com/photo-1620231619471-b28081fc3509?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxsaWdodCUyMGRlbmltJTIwc2hvcnRzfGVufDF8fHx8MTc2Mjg4ODk4N3ww&ixlib=rb-4.1.0&q=80&w=1080",
    "rubber flip flops beach black": "https://images.unsplash.com/photo-1760612887190-ea94041f1920?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxibGFjayUyMGZsaXAlMjBmbG9wc3xlbnwxfHx8fDE3NjI4ODg5ODd8MA&ixlib=rb-4.1.0&q=80&w=1080",
    "classic aviator sunglasses silver": "https://images.unsplash.com/photo-1589782182703-2aaa69037b5b?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxzaWx2ZXIlMjBhdmlhdG9yJTIwc3VuZ2xhc3Nlc3xlbnwxfHx8fDE3NjI4ODg5ODh8MA&ixlib=rb-4.1.0&q=80&w=1080",
    "beige linen shirt short sleeve": "https://images.unsplash.com/photo-1651895884377-5f631be84282?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxiZWlnZSUyMGxpbmVuJTIwc2hpcnR8ZW58MXx8fHwxNzYyODg4OTg4fDA&ixlib=rb-4.1.0&q=80&w=1080",
    "white linen pants summer": "https://images.unsplash.com/photo-1614539655719-256312070de7?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHx3aGl0ZSUyMGxpbmVuJTIwcGFudHN8ZW58MXx8fHwxNzYyODg4OTg5fDA&ixlib=rb-4.1.0&q=80&w=1080",
    "cream canvas sneakers summer": "https://images.unsplash.com/photo-1663151860122-4890a08dc22b?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjcmVhbSUyMGNhbnZhcyUyMHNuZWFrZXJzfGVufDF8fHx8MTc2Mjg4ODk4OXww&ixlib=rb-4.1.0&q=80&w=1080",
    "round sunglasses tortoise": "https://images.unsplash.com/photo-1681147768015-c6d3702f5e4f?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHx0b3J0b2lzZSUyMHJvdW5kJTIwc3VuZ2xhc3Nlc3xlbnwxfHx8fDE3NjI4ODg5ODl8MA&ixlib=rb-4.1.0&q=80&w=1080",
    // Hot weather
    "mesh tank top athletic black": "https://images.unsplash.com/photo-1557437173-01f7fd66bf94?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxibGFjayUyMG1lc2glMjB0YW5rfGVufDF8fHx8MTc2Mjg4ODk5MHww&ixlib=rb-4.1.0&q=80&w=1080",
    "performance shorts athletic gray": "https://images.unsplash.com/photo-1723972405511-e3785a045721?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxncmF5JTIwYXRobGV0aWMlMjBzaG9ydHN8ZW58MXx8fHwxNzYyODg4OTkwfDA&ixlib=rb-4.1.0&q=80&w=1080",
    "sport sandals outdoor black": "https://images.unsplash.com/photo-1593548826648-0357b8c884a9?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxibGFjayUyMHNwb3J0JTIwc2FuZGFsc3xlbnwxfHx8fDE3NjI4ODg5OTB8MA&ixlib=rb-4.1.0&q=80&w=1080",
    "straw sun hat wide brim": "https://images.unsplash.com/photo-1759935937415-49099042fa91?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxzdHJhdyUyMHdpZGUlMjBicmltJTIwaGF0fGVufDF8fHx8MTc2Mjg4ODk5MXww&ixlib=rb-4.1.0&q=80&w=1080",
    "colorful tank top tropical print": "https://images.unsplash.com/photo-1751024049983-4b1105eb1678?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjb2xvcmZ1bCUyMHRyb3BpY2FsJTIwdGFua3xlbnwxfHx8fDE3NjI4ODg5OTF8MA&ixlib=rb-4.1.0&q=80&w=1080",
    "swim trunks tropical pattern": "https://images.unsplash.com/photo-1536685409149-2ca88666aa47?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHx0cm9waWNhbCUyMHN3aW0lMjBzaG9ydHN8ZW58MXx8fHwxNzYyODg4OTkyfDA&ixlib=rb-4.1.0&q=80&w=1080",
    "flip flops beach colorful": "https://images.unsplash.com/photo-1550980451-ef715ac3ef01?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjb2xvcmZ1bCUyMGJlYWNoJTIwc2FuZGFsc3xlbnwxfHx8fDE3NjI4ODg5OTV8MA&ixlib=rb-4.1.0&q=80&w=1080",
    "baseball cap summer white": "https://images.unsplash.com/photo-1611692370244-aebb15c17941?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHx3aGl0ZSUyMGJhc2ViYWxsJTIwY2FwfGVufDF8fHx8MTc2Mjg4ODk5NXww&ixlib=rb-4.1.0&q=80&w=1080",
    "technical tshirt outdoor beige": "https://images.unsplash.com/photo-1742210903945-e41b61e5d9d7?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxiZWlnZSUyMG91dGRvb3IlMjB0c2hpcnR8ZW58MXx8fHwxNzYyODg4OTk2fDA&ixlib=rb-4.1.0&q=80&w=1080",
    "cargo shorts outdoor khaki": "https://images.unsplash.com/photo-1719473448126-eb1159ec5242?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxraGFraSUyMGNhcmdvJTIwc2hvcnRzfGVufDF8fHx8MTc2Mjg4ODk5Nnww&ixlib=rb-4.1.0&q=80&w=1080",
    "hiking sandals outdoor brown": "https://images.unsplash.com/photo-1632078646266-236c777374d4?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxicm93biUyMGhpa2luZyUyMHNhbmRhbHN8ZW58MXx8fHwxNzYyODg4OTk3fDA&ixlib=rb-4.1.0&q=80&w=1080",
    "bucket hat outdoor navy": "https://images.unsplash.com/photo-1682623762727-59194bd4c85b?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxuYXZ5JTIwYnVja2V0JTIwaGF0fGVufDF8fHx8MTc2Mjg4ODk5N3ww&ixlib=rb-4.1.0&q=80&w=1080",
    // Weather accessories
    "umbrella rain": "https://images.unsplash.com/photo-1757548710136-66a371811d1c?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxibGFjayUyMHVtYnJlbGxhJTIwcmFpbnxlbnwxfHx8fDE3NjI4ODg5OTd8MA&ixlib=rb-4.1.0&q=80&w=1080",
  };

  const fetchUnsplashImage = async (query: string): Promise<string> => {
    // Try dynamic Unsplash API FIRST with simple, direct queries
    try {
      console.log(`[Unsplash] 🔍 Fetching dynamic image for: "${query}"`);
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-0cb63601/unsplash`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${publicAnonKey}`,
          },
          body: JSON.stringify({ query }),
        }
      );

      if (response.ok) {
        const data = await response.json();
        if (data.imageUrl) {
          console.log(`[Unsplash] ✅ Got dynamic image for: "${query}"`);
          return data.imageUrl;
        }
      } else {
        const errorData = await response.json();
        console.warn(`[Unsplash] ⚠️ API error for "${query}":`, errorData);
      }
    } catch (error) {
      console.error(`[Unsplash] ❌ Fetch error for "${query}":`, error);
    }
    
    // Fallback to cache if API failed
    if (imageCache[query]) {
      console.log(`[Cache] 📦 Using cached fallback image for: "${query}"`);
      return imageCache[query];
    }
    
    // Try to find a similar match in cache (smart partial matching)
    const cacheKeys = Object.keys(imageCache);
    const queryWords = query.toLowerCase().split(' ');
    
    // Score each cache key by how many words match
    const scoredKeys = cacheKeys.map(key => {
      const keyWords = key.toLowerCase().split(' ');
      const matchCount = queryWords.filter(qWord => 
        keyWords.some(kWord => kWord.includes(qWord) || qWord.includes(kWord))
      ).length;
      return { key, score: matchCount };
    });
    
    // Find the best match (highest score)
    scoredKeys.sort((a, b) => b.score - a.score);
    const bestMatch = scoredKeys[0];
    
    if (bestMatch && bestMatch.score >= 2) {
      console.log(`[Cache] 📦 Using similar cached image for "${query}" (matched: "${bestMatch.key}" with score ${bestMatch.score})`);
      return imageCache[bestMatch.key];
    }
    
    // Final fallback - use a generic fashion/clothing photo
    console.warn(`[Unsplash] 🔄 No image found for query: "${query}". Using generic fallback.`);
    return "https://images.unsplash.com/photo-1489987707025-afc232f7ea0f?w=400&h=400&fit=crop";
  };

  const handleGenerateOutfit = async (weather: WeatherData, outfit: { variations: OutfitVariationWithImages[] }) => {
    const currentVariation = outfit.variations[0]; // Use the first variation
    const cityName = weather.location;

    // Create a new message with generating state
    const generatedOutfitMessage: Message = {
      id: `generated-${Date.now()}`,
      isUser: false,
      timestamp: getCurrentTime(),
      generatedOutfit: {
        cityName,
        isGenerating: true,
      },
    };

    setMessages((prev) => [...prev, generatedOutfitMessage]);

    try {
      // Start image generation
      console.log(`[Generate Outfit] 🎨 Starting generation for ${cityName}`);
      const generateResponse = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-0cb63601/generate-outfit-image`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${publicAnonKey}`,
          },
          body: JSON.stringify({
            weather: {
              temperature: weather.temperature,
              condition: weather.condition,
              description: weather.description,
            },
            style: currentVariation.style,
            items: currentVariation.items,
          }),
        }
      );

      console.log(`[Generate Outfit] 📥 Response status: ${generateResponse.status}`);
      
      // Try to parse response as JSON
      let responseData;
      const responseText = await generateResponse.text();
      console.log(`[Generate Outfit] 📄 Response body:`, responseText);
      
      try {
        responseData = JSON.parse(responseText);
      } catch (parseError) {
        console.error('[Generate Outfit] ❌ Failed to parse response:', parseError);
        throw new Error(`Invalid response from server: ${responseText.substring(0, 100)}`);
      }

      if (!generateResponse.ok) {
        console.error('[Generate Outfit] ❌ API Error:', responseData);
        throw new Error(responseData.error || responseData.details || 'Failed to start generation');
      }

      const { taskId } = responseData;
      if (!taskId) {
        console.error('[Generate Outfit] ❌ No taskId in response:', responseData);
        throw new Error('Server response missing taskId');
      }
      
      console.log(`[Generate Outfit] ✅ Task started: ${taskId}`);

      // Update message with taskId
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === generatedOutfitMessage.id
            ? { ...msg, generatedOutfit: { ...msg.generatedOutfit!, taskId } }
            : msg
        )
      );

      // Poll for status
      const maxAttempts = 120; // 120 attempts * 5 seconds = 10 minutes max (AI generation can be slow)
      let attempts = 0;

      const pollStatus = async (): Promise<void> => {
        if (attempts >= maxAttempts) {
          throw new Error('Generation timeout - please try again');
        }

        attempts++;
        console.log(`[Generate Outfit] 📊 Polling status (attempt ${attempts}/${maxAttempts})`);

        const statusResponse = await fetch(
          `https://${projectId}.supabase.co/functions/v1/make-server-0cb63601/outfit-image-status?taskId=${taskId}`,
          {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${publicAnonKey}`,
            },
          }
        );

        if (!statusResponse.ok) {
          throw new Error('Failed to check status');
        }

        const statusData = await statusResponse.json();
        console.log(`[Generate Outfit] 📊 Status response:`, statusData);

        if (statusData.status === 'success' && statusData.imageUrl) {
          console.log(`[Generate Outfit] 🎉 Generation complete!`);
          // Update message with final image
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === generatedOutfitMessage.id
                ? {
                    ...msg,
                    generatedOutfit: {
                      cityName,
                      imageUrl: statusData.imageUrl,
                      isGenerating: false,
                    },
                  }
                : msg
            )
          );
        } else if (statusData.status === 'create_failed' || statusData.status === 'generation_failed') {
          throw new Error(statusData.error || 'Generation failed');
        } else {
          // Still generating, poll again after 5 seconds
          console.log(`[Generate Outfit] ⏳ Still generating (status: ${statusData.status}), waiting 5 seconds...`);
          await new Promise((resolve) => setTimeout(resolve, 5000));
          return pollStatus();
        }
      };

      await pollStatus();
    } catch (error: any) {
      console.error('[Generate Outfit] ❌ Error:', error);
      // Update message with error
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === generatedOutfitMessage.id
            ? {
                ...msg,
                generatedOutfit: {
                  cityName,
                  isGenerating: false,
                  error: error.message || 'Failed to generate outfit image',
                },
              }
            : msg
        )
      );
    }
  };

  const handleSend = async () => {
    if (!inputValue.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      text: inputValue,
      isUser: true,
      timestamp: getCurrentTime(),
    };

    setMessages((prev) => [...prev, userMessage]);
    const userInput = inputValue;
    setInputValue("");
    setIsTyping(true);

    try {
      const result = await getWeatherResponse(userInput, fetchUnsplashImage);
      
      setTimeout(() => {
        if (result.error) {
          const aiResponse: Message = {
            id: (Date.now() + 1).toString(),
            text: result.error,
            isUser: false,
            timestamp: getCurrentTime(),
          };
          setMessages((prev) => [...prev, aiResponse]);
        } else if (result.message) {
          setMessages((prev) => [...prev, result.message!]);
        }
        setIsTyping(false);
      }, 1000);
    } catch (error) {
      console.error("Error getting response:", error);
      setTimeout(() => {
        const aiResponse: Message = {
          id: (Date.now() + 1).toString(),
          text: "I'm sorry, something went wrong. Please try again.",
          isUser: false,
          timestamp: getCurrentTime(),
        };
        setMessages((prev) => [...prev, aiResponse]);
        setIsTyping(false);
      }, 1000);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="h-screen bg-[#F8F9FA] flex flex-col">
      {/* App Bar: Glassmorphism with subtle glow - Sticky */}
      <div className="sticky top-0 z-50 py-6 bg-[#111111]/95 backdrop-blur-xl text-white px-4 flex items-center px-[16px] py-[14px] shadow-[0_4px_20px_rgba(59,130,246,0.08)] border-b border-white/10">
        {/* Subtle gradient glow overlay */}
        <div className="absolute inset-0 bg-gradient-to-r from-[#3B82F6]/10 via-transparent to-[#A855F7]/10 pointer-events-none"></div>
        
        <div className="relative z-10">
          {/* Title Large (22px, 0px letter-spacing) */}
          <h1 className="md-title-large text-[rgb(17,17,17)] text-[20px] font-bold">Weather & Style Assistant</h1>
          {/* Body Medium (14px, 0.25px letter-spacing) with 90% opacity */}
          <p className="md-body-medium text-[#666666]">Ask about weather and outfit recommendations</p>
        </div>
      </div>

      {/* Scrollable content area */}
      <ScrollArea className="flex-1 px-4 py-4">
        {/* Max width 4xl (896px) centered, M3 spacing (16px gap), bottom padding for fixed input */}
        <div className="max-w-4xl mx-auto space-y-4 pb-40">
          {messages.map((message) => (
            <div key={message.id}>
              {message.comparisonData ? (
                // City comparison view
                <div className="flex gap-3">
                  <div className="bg-[#E5E7EB] rounded-full w-10 h-10 flex items-center justify-center flex-shrink-0">
                    <Cloud className="w-5 h-5 text-[#6B7280]" />
                  </div>
                  <div className="flex-1 space-y-3">
                    {/* Title */}
                    <div className="bg-[#F3F4F6] rounded-2xl px-4 py-3">
                      <p className="md-title-medium text-[#111827]">
                        {message.comparisonData.city1.weather.location} vs {message.comparisonData.city2.weather.location}
                      </p>
                    </div>
                    
                    {/* Side by side comparison */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* City 1 - Blue */}
                      <div className="space-y-3 flex flex-col h-full">
                        <WeatherChart
                          temperature={message.comparisonData.city1.weather.temperature}
                          feelsLike={message.comparisonData.city1.weather.feelsLike}
                          humidity={message.comparisonData.city1.weather.humidity}
                          windSpeed={message.comparisonData.city1.weather.windSpeed}
                          location={message.comparisonData.city1.weather.location}
                          country={message.comparisonData.city1.weather.country}
                          condition={message.comparisonData.city1.weather.condition}
                          description={message.comparisonData.city1.weather.description}
                          demoMode={message.demoMode}
                          color="#3B82F6"
                        />
                        <div className="flex-1">
                          <OutfitCard
                            summary={message.comparisonData.city1.outfit.summary}
                            note={message.comparisonData.city1.outfit.note}
                            variations={message.comparisonData.city1.outfit.variations}
                            demoMode={message.demoMode}
                            matchHeight={true}
                            location={message.comparisonData.city1.weather.location}
                            color="#3B82F6"
                            onGenerateOutfit={() => {
                              const city1Data = message.comparisonData!.city1;
                              handleGenerateOutfit(
                                city1Data.weather,
                                city1Data.outfit
                              );
                            }}
                          />
                        </div>
                      </div>
                      
                      {/* City 2 - Green */}
                      <div className="space-y-3 flex flex-col h-full">
                        <WeatherChart
                          temperature={message.comparisonData.city2.weather.temperature}
                          feelsLike={message.comparisonData.city2.weather.feelsLike}
                          humidity={message.comparisonData.city2.weather.humidity}
                          windSpeed={message.comparisonData.city2.weather.windSpeed}
                          location={message.comparisonData.city2.weather.location}
                          country={message.comparisonData.city2.weather.country}
                          condition={message.comparisonData.city2.weather.condition}
                          description={message.comparisonData.city2.weather.description}
                          demoMode={message.demoMode}
                          color="#10B981"
                        />
                        <div className="flex-1">
                          <OutfitCard
                            summary={message.comparisonData.city2.outfit.summary}
                            note={message.comparisonData.city2.outfit.note}
                            variations={message.comparisonData.city2.outfit.variations}
                            demoMode={message.demoMode}
                            matchHeight={true}
                            location={message.comparisonData.city2.weather.location}
                            color="#10B981"
                            onGenerateOutfit={() => {
                              const city2Data = message.comparisonData!.city2;
                              handleGenerateOutfit(
                                city2Data.weather,
                                city2Data.outfit
                              );
                            }}
                          />
                        </div>
                      </div>
                    </div>
                    
                    <p className="md-label-small text-[#6B7280]">{message.timestamp}</p>
                  </div>
                </div>
              ) : message.generatedOutfit ? (
                // Generated Outfit visual message
                <div className="flex gap-3">
                  <div className="bg-[#E5E7EB] rounded-full w-10 h-10 flex items-center justify-center flex-shrink-0">
                    <Cloud className="w-5 h-5 text-[#6B7280]" />
                  </div>
                  <div className="flex-1 max-w-[80%] space-y-3">
                    <GeneratedOutfitCard
                      cityName={message.generatedOutfit.cityName}
                      imageUrl={message.generatedOutfit.imageUrl}
                      isGenerating={message.generatedOutfit.isGenerating}
                      error={message.generatedOutfit.error}
                    />
                    <p className="md-label-small text-[#6B7280]">{message.timestamp}</p>
                  </div>
                </div>
              ) : message.weatherData || message.outfitData ? (
                // Weather/Outfit visual message
                <div className="flex gap-3">
                  <div className="bg-[#E5E7EB] rounded-full w-10 h-10 flex items-center justify-center flex-shrink-0">
                    <Cloud className="w-5 h-5 text-[#6B7280]" />
                  </div>
                  <div className="flex-1 max-w-[80%] space-y-3">
                    {message.generatedOutfit && (
                      <GeneratedOutfitCard
                        cityName={message.generatedOutfit.cityName}
                        imageUrl={message.generatedOutfit.imageUrl}
                        isGenerating={message.generatedOutfit.isGenerating}
                        error={message.generatedOutfit.error}
                      />
                    )}
                    {message.weatherData && (
                      <WeatherChart
                        temperature={message.weatherData.temperature}
                        feelsLike={message.weatherData.feelsLike}
                        humidity={message.weatherData.humidity}
                        windSpeed={message.weatherData.windSpeed}
                        location={message.weatherData.location}
                        country={message.weatherData.country}
                        condition={message.weatherData.condition}
                        description={message.weatherData.description}
                        demoMode={message.demoMode}
                      />
                    )}
                    {message.outfitData && (
                      <OutfitCard
                        summary={message.outfitData.summary}
                        note={message.outfitData.note}
                        variations={message.outfitData.variations}
                        demoMode={message.demoMode}
                        location={message.weatherData?.location}
                        color={message.weatherData 
                          ? (message.weatherData.temperature > 25 ? '#EF4444' : message.weatherData.temperature > 15 ? '#F59E0B' : '#3B82F6')
                          : '#3B82F6'
                        }
                        onGenerateOutfit={
                          message.weatherData
                            ? () => handleGenerateOutfit(message.weatherData!, message.outfitData!)
                            : undefined
                        }
                      />
                    )}
                    {message.text && (
                      <div className="bg-[#F3F4F6] rounded-2xl px-4 py-3">
                        <p className="md-body-large text-[#111827] whitespace-pre-wrap">{message.text}</p>
                      </div>
                    )}
                    <p className="md-label-small text-[#6B7280]">{message.timestamp}</p>
                  </div>
                </div>
              ) : (
                // Regular text message
                <ChatMessage
                  message={message.text || ""}
                  isUser={message.isUser}
                  timestamp={message.timestamp}
                />
              )}
            </div>
          ))}
          
          {/* Typing indicator */}
          {isTyping && (
            <div className="flex gap-3">
              {/* Avatar: 40x40px with 20px icon */}
              <div className="bg-[#E5E7EB] rounded-full w-10 h-10 flex items-center justify-center flex-shrink-0">
                <Cloud className="w-5 h-5 text-[#6B7280]" />
              </div>
              {/* Typing bubble: Large corners (16px), surface container color */}
              <div className="bg-[#F3F4F6] rounded-2xl px-4 py-3">
                <div className="flex gap-1">
                  {/* Animated dots */}
                  <div className="w-2 h-2 bg-[#6B7280] rounded-full animate-bounce" style={{ animationDelay: "0ms" }}></div>
                  <div className="w-2 h-2 bg-[#6B7280] rounded-full animate-bounce" style={{ animationDelay: "150ms" }}></div>
                  <div className="w-2 h-2 bg-[#6B7280] rounded-full animate-bounce" style={{ animationDelay: "300ms" }}></div>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      {/* Bottom input area: Surface background with top border (M3 outline) */}
      <div className="fixed bottom-0 left-0 right-0 px-4 py-4 bg-[#F8F9FA]">
        <div className="max-w-4xl mx-auto relative">
          {/* Text field: 64px height (increased from M3 standard), small corners (8px) */}
          <Input
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyPress}
            placeholder="Ask about weather or what to wear..."
            className="w-full h-16 pl-4 pr-16 rounded-lg border-[#E5E7EB] bg-white md-body-large focus-visible:border-[#111827] focus-visible:ring-0 focus-visible:outline-none"
          />
          {/* Filled button: 56px (48px min touch target + padding), rounded-full, primary color */}
          <Button
            onClick={handleSend}
            disabled={!inputValue.trim()}
            className="absolute right-2 top-2 h-12 w-12 rounded-full bg-[#3B82F6] hover:bg-[#3B82F6]/90 active:bg-[#3B82F6]/80 disabled:bg-[#E5E7EB] disabled:text-[#6B7280] transition-all duration-200 flex items-center justify-center"
          >
            {/* Icon: 24px (M3 standard) */}
            <Send className="w-6 h-6" />
          </Button>
        </div>
      </div>
    </div>
  );
}