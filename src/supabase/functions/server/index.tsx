import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import { logger } from "npm:hono/logger";
import * as kv from "./kv_store.tsx";
const app = new Hono();

// Enable logger
app.use('*', logger(console.log));

// Enable CORS for all routes and methods
app.use(
  "/*",
  cors({
    origin: "*",
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    exposeHeaders: ["Content-Length"],
    maxAge: 600,
  }),
);

// Health check endpoint
app.get("/make-server-0cb63601/health", (c) => {
  return c.json({ status: "ok" });
});

// Unsplash image search endpoint
app.post("/make-server-0cb63601/unsplash", async (c) => {
  try {
    const { query } = await c.req.json();
    
    if (!query) {
      return c.json({ error: "Query is required" }, 400);
    }

    const unsplashAccessKey = Deno.env.get('UNSPLASH_ACCESS_KEY');
    
    if (!unsplashAccessKey) {
      console.log("[Unsplash API] ⚠️ No UNSPLASH_ACCESS_KEY found in environment");
      return c.json({ 
        error: "Unsplash API key not configured",
        fallback: true 
      }, 500);
    }

    // Use the detailed query from backend (e.g., "khaki field jacket spring")
    const searchQuery = query;
    
    // Fetch most relevant images (always page 1 for best results)
    const perPage = 10;
    const page = 1; // Always use page 1 for most relevant results
    
    // Call Unsplash API
    const unsplashUrl = `https://api.unsplash.com/search/photos?query=${encodeURIComponent(searchQuery)}&per_page=${perPage}&page=${page}`;
    console.log(`[Unsplash API] 🔍 Searching for: "${searchQuery}"`);
    
    const response = await fetch(unsplashUrl, {
      headers: {
        'Authorization': `Client-ID ${unsplashAccessKey}`,
      },
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error(`[Unsplash API] ❌ ERROR ${response.status}:`, errorData);
      return c.json({ 
        error: `Failed to fetch from Unsplash (HTTP ${response.status})`,
        details: errorData,
        fallback: true 
      }, response.status);
    }

    const data = await response.json();
    
    if (!data.results || data.results.length === 0) {
      console.log(`[Unsplash API] ⚠️ No results found for: "${searchQuery}"`);
      return c.json({ 
        error: "No images found",
        fallback: true 
      }, 404);
    }

    // Select from top 3 most relevant results for variety while maintaining relevance
    const topResults = Math.min(3, data.results.length);
    const randomIndex = Math.floor(Math.random() * topResults);
    const imageUrl = data.results[randomIndex].urls.regular;
    console.log(`[Unsplash API] ✅ Found image for "${searchQuery}" (result #${randomIndex + 1})`);

    return c.json({ imageUrl });
    
  } catch (error) {
    console.error("[Unsplash API] ❌ FETCH ERROR:", error);
    return c.json({ 
      error: error.message || "Internal server error",
      fallback: true 
    }, 500);
  }
});

// Weather and outfit recommendation endpoint
app.post("/make-server-0cb63601/weather", async (c) => {
  try {
    const { location } = await c.req.json();
    
    if (!location) {
      return c.json({ error: "Location is required" }, 400);
    }

    const apiKey = Deno.env.get('OPENWEATHER_API_KEY');
    
    // Debug logging
    console.log(`[Weather API] API key exists: ${!!apiKey}`);
    if (apiKey) {
      console.log(`[Weather API] API key length: ${apiKey.length} characters`);
    }
    
    // Try to fetch real weather data if API key exists
    if (apiKey) {
      try {
        const weatherUrl = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(location)}&appid=${apiKey}&units=metric`;
        console.log(`[Weather API] Requesting weather for: ${location}`);
        const weatherResponse = await fetch(weatherUrl);
        console.log(`[Weather API] Response status: ${weatherResponse.status} ${weatherResponse.statusText}`);
        
        if (weatherResponse.ok) {
          const weatherData = await weatherResponse.json();
          console.log(`[Weather API] ✅ SUCCESS - Got real data for ${weatherData.name}, ${weatherData.sys.country}`);
          const outfit = generateOutfitRecommendation(weatherData);
          
          return c.json({
            weather: {
              location: weatherData.name,
              country: weatherData.sys.country,
              temperature: Math.round(weatherData.main.temp),
              feelsLike: Math.round(weatherData.main.feels_like),
              condition: weatherData.weather[0].main,
              description: weatherData.weather[0].description,
              humidity: weatherData.main.humidity,
              windSpeed: weatherData.wind.speed,
            },
            outfit,
            demoMode: false,
          });
        } else if (weatherResponse.status === 401) {
          const errorData = await weatherResponse.json();
          console.log(`[Weather API] ⚠️ 401 UNAUTHORIZED - ${errorData.message || 'API key not activated yet'}`);
          console.log("[Weather API] Falling back to demo mode");
          // Fall through to demo mode
        } else {
          const errorData = await weatherResponse.json();
          console.error(`[Weather API] ❌ ERROR ${weatherResponse.status} for location ${location}:`, errorData);
          return c.json({ error: errorData.message || "Failed to fetch weather data" }, weatherResponse.status);
        }
      } catch (fetchError) {
        console.error("[Weather API] ❌ FETCH ERROR:", fetchError);
        // Fall through to demo mode on network errors
      }
    } else {
      console.log("[Weather API] ⚠️ No API key found in environment");
    }

    // Demo mode - return mock data with diagnostic info
    console.log(`Using demo mode for location: ${location}`);
    const mockWeatherData = generateMockWeather(location);
    const outfit = generateOutfitRecommendation(mockWeatherData);

    // Determine why we're in demo mode
    let demoReason = "Unknown reason";
    if (!apiKey) {
      demoReason = "No API key found in environment variables";
    } else {
      demoReason = "API key exists but returned 401 (likely not activated yet - takes 1-2 hours for new OpenWeatherMap accounts)";
    }

    return c.json({
      weather: {
        location: mockWeatherData.name,
        country: mockWeatherData.sys.country,
        temperature: Math.round(mockWeatherData.main.temp),
        feelsLike: Math.round(mockWeatherData.main.feels_like),
        condition: mockWeatherData.weather[0].main,
        description: mockWeatherData.weather[0].description,
        humidity: mockWeatherData.main.humidity,
        windSpeed: mockWeatherData.wind.speed,
      },
      outfit,
      demoMode: true,
      demoReason,
    });
  } catch (error) {
    console.error("Error in weather endpoint:", error);
    return c.json({ error: error.message || "Internal server error" }, 500);
  }
});

// Generate mock weather data for demo mode
function generateMockWeather(location: string): any {
  const locationLower = location.toLowerCase();
  
  // Realistic city weather profiles based on typical climate
  const cityProfiles: Record<string, any> = {
    // Europe - Temperate
    "london": { temp: 14, feels: 12, humidity: 72, wind: 4.2, condition: "Clouds", desc: "broken clouds", country: "GB" },
    "paris": { temp: 16, feels: 15, humidity: 68, wind: 3.8, condition: "Clear", desc: "clear sky", country: "FR" },
    "berlin": { temp: 13, feels: 11, humidity: 70, wind: 4.5, condition: "Clouds", desc: "overcast clouds", country: "DE" },
    "amsterdam": { temp: 12, feels: 10, humidity: 78, wind: 5.2, condition: "Rain", desc: "light rain", country: "NL" },
    "rome": { temp: 21, feels: 20, humidity: 62, wind: 2.8, condition: "Clear", desc: "clear sky", country: "IT" },
    "madrid": { temp: 19, feels: 18, humidity: 55, wind: 3.2, condition: "Clear", desc: "few clouds", country: "ES" },
    "barcelona": { temp: 20, feels: 19, humidity: 65, wind: 3.5, condition: "Clear", desc: "clear sky", country: "ES" },
    
    // Northern Europe - Cold
    "moscow": { temp: -2, feels: -6, humidity: 85, wind: 5.5, condition: "Snow", desc: "light snow", country: "RU" },
    "oslo": { temp: 3, feels: -1, humidity: 75, wind: 6.0, condition: "Clouds", desc: "overcast clouds", country: "NO" },
    "stockholm": { temp: 5, feels: 2, humidity: 72, wind: 4.8, condition: "Clouds", desc: "scattered clouds", country: "SE" },
    "helsinki": { temp: 1, feels: -3, humidity: 80, wind: 5.2, condition: "Snow", desc: "light snow", country: "FI" },
    "reykjavik": { temp: 4, feels: 0, humidity: 82, wind: 7.5, condition: "Rain", desc: "light rain", country: "IS" },
    
    // Asia - Varied
    "tokyo": { temp: 22, feels: 23, humidity: 68, wind: 3.5, condition: "Clear", desc: "clear sky", country: "JP" },
    "beijing": { temp: 18, feels: 17, humidity: 45, wind: 4.2, condition: "Clear", desc: "few clouds", country: "CN" },
    "shanghai": { temp: 24, feels: 25, humidity: 75, wind: 3.8, condition: "Clouds", desc: "scattered clouds", country: "CN" },
    "singapore": { temp: 31, feels: 36, humidity: 85, wind: 2.5, condition: "Rain", desc: "light rain", country: "SG" },
    "bangkok": { temp: 33, feels: 38, humidity: 80, wind: 2.2, condition: "Clear", desc: "clear sky", country: "TH" },
    "mumbai": { temp: 32, feels: 37, humidity: 82, wind: 3.8, condition: "Clouds", desc: "scattered clouds", country: "IN" },
    "delhi": { temp: 28, feels: 30, humidity: 60, wind: 4.0, condition: "Clear", desc: "haze", country: "IN" },
    "seoul": { temp: 17, feels: 16, humidity: 65, wind: 3.5, condition: "Clear", desc: "clear sky", country: "KR" },
    "hong kong": { temp: 27, feels: 29, humidity: 78, wind: 3.2, condition: "Clouds", desc: "few clouds", country: "HK" },
    
    // Middle East - Hot & Dry
    "dubai": { temp: 38, feels: 42, humidity: 55, wind: 4.5, condition: "Clear", desc: "clear sky", country: "AE" },
    "riyadh": { temp: 35, feels: 37, humidity: 25, wind: 5.0, condition: "Clear", desc: "clear sky", country: "SA" },
    "cairo": { temp: 30, feels: 32, humidity: 40, wind: 4.2, condition: "Clear", desc: "clear sky", country: "EG" },
    
    // Americas - North
    "new york": { temp: 18, feels: 17, humidity: 65, wind: 4.8, condition: "Clouds", desc: "scattered clouds", country: "US" },
    "los angeles": { temp: 24, feels: 23, humidity: 58, wind: 3.2, condition: "Clear", desc: "clear sky", country: "US" },
    "chicago": { temp: 15, feels: 13, humidity: 70, wind: 5.5, condition: "Clouds", desc: "broken clouds", country: "US" },
    "miami": { temp: 30, feels: 34, humidity: 78, wind: 4.0, condition: "Clear", desc: "few clouds", country: "US" },
    "san francisco": { temp: 17, feels: 16, humidity: 75, wind: 5.2, condition: "Clouds", desc: "fog", country: "US" },
    "seattle": { temp: 14, feels: 13, humidity: 80, wind: 3.8, condition: "Rain", desc: "light rain", country: "US" },
    "toronto": { temp: 16, feels: 14, humidity: 68, wind: 4.5, condition: "Clouds", desc: "overcast clouds", country: "CA" },
    "vancouver": { temp: 15, feels: 14, humidity: 78, wind: 3.5, condition: "Rain", desc: "moderate rain", country: "CA" },
    "calgary": { temp: 8, feels: 4, humidity: 55, wind: 5.8, condition: "Clouds", desc: "scattered clouds", country: "CA" },
    "mexico city": { temp: 22, feels: 21, humidity: 55, wind: 2.8, condition: "Clear", desc: "clear sky", country: "MX" },
    
    // Americas - South
    "buenos aires": { temp: 20, feels: 19, humidity: 72, wind: 4.2, condition: "Clear", desc: "clear sky", country: "AR" },
    "rio de janeiro": { temp: 28, feels: 30, humidity: 75, wind: 3.5, condition: "Clear", desc: "few clouds", country: "BR" },
    "sao paulo": { temp: 23, feels: 22, humidity: 68, wind: 3.0, condition: "Clouds", desc: "scattered clouds", country: "BR" },
    "lima": { temp: 21, feels: 20, humidity: 78, wind: 3.8, condition: "Clouds", desc: "overcast clouds", country: "PE" },
    
    // Oceania
    "sydney": { temp: 22, feels: 21, humidity: 65, wind: 4.5, condition: "Clear", desc: "clear sky", country: "AU" },
    "melbourne": { temp: 18, feels: 17, humidity: 68, wind: 5.0, condition: "Clouds", desc: "scattered clouds", country: "AU" },
    "auckland": { temp: 17, feels: 16, humidity: 75, wind: 4.8, condition: "Clouds", desc: "broken clouds", country: "NZ" },
    
    // Africa
    "cape town": { temp: 19, feels: 18, humidity: 70, wind: 5.5, condition: "Clear", desc: "clear sky", country: "ZA" },
    "nairobi": { temp: 24, feels: 23, humidity: 62, wind: 3.5, condition: "Clear", desc: "few clouds", country: "KE" },
  };
  
  // Find matching city profile
  let profile = null;
  for (const [city, data] of Object.entries(cityProfiles)) {
    if (locationLower.includes(city)) {
      profile = data;
      break;
    }
  }
  
  // If no specific city found, generate semi-random but realistic weather
  if (!profile) {
    // Use location string to seed "random" values for consistency
    const seed = location.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const tempBase = 15 + (seed % 20); // 15-35°C range
    const variation = (seed % 10) - 5; // -5 to +5 variation
    
    profile = {
      temp: tempBase + variation,
      feels: tempBase + variation + ((seed % 6) - 3),
      humidity: 50 + (seed % 40), // 50-90%
      wind: 2 + (seed % 5), // 2-7 m/s
      condition: ["Clear", "Clouds", "Rain"][seed % 3],
      desc: ["clear sky", "scattered clouds", "light rain"][seed % 3],
      country: "XX"
    };
  }
  
  // Add significant random variation to make each request visually different
  // This creates noticeable chart variations while staying realistic
  const tempVariation = (Math.random() * 6) - 3; // -3 to +3°C random variation
  const humidityVariation = (Math.random() * 30) - 15; // -15 to +15% variation
  const windVariation = (Math.random() * 4) - 2; // -2 to +2 m/s variation
  const feelsLikeVariation = (Math.random() * 8) - 4; // -4 to +4°C variation
  
  return {
    name: location.charAt(0).toUpperCase() + location.slice(1),
    sys: { country: profile.country },
    main: {
      temp: profile.temp + tempVariation,
      feels_like: profile.feels + feelsLikeVariation,
      humidity: Math.max(30, Math.min(100, profile.humidity + humidityVariation)),
    },
    weather: [{
      main: profile.condition,
      description: profile.desc,
    }],
    wind: {
      speed: Math.max(0.5, profile.wind + windVariation),
    },
  };
}

// Generate outfit recommendation based on weather conditions
function generateOutfitRecommendation(weatherData: any): any {
  const temp = weatherData.main.temp;
  const feelsLike = weatherData.main.feels_like;
  const condition = weatherData.weather[0].main.toLowerCase();
  const description = weatherData.weather[0].description;
  const windSpeed = weatherData.wind.speed;
  const humidity = weatherData.main.humidity;

  let outfitVariations = [];
  let note = "";

  // Temperature-based clothing with 3 style variations
  if (temp < 0) {
    // Extreme cold - 3 variations
    outfitVariations = [
      {
        style: "Winter Essential",
        items: [
          { name: "Heavy Puffer Coat", query: "black puffer jacket down coat" },
          { name: "Thermal Base Layer", query: "merino wool thermal shirt" },
          { name: "Insulated Boots", query: "snow boots waterproof" },
          { name: "Wool Scarf & Gloves", query: "wool scarf knit gloves set" },
        ],
      },
      {
        style: "Urban Winter",
        items: [
          { name: "Winter Jacket", query: "navy blue winter parka" },
          { name: "Warm Sweater", query: "cable knit sweater beige" },
          { name: "Snow Boots", query: "leather winter boots brown" },
          { name: "Beanie & Mittens", query: "beanie hat winter mittens" },
        ],
      },
      {
        style: "Classic Cold Weather",
        items: [
          { name: "Long Winter Coat", query: "long wool coat gray" },
          { name: "Layered Clothing", query: "turtleneck sweater black" },
          { name: "Leather Boots", query: "leather ankle boots black" },
          { name: "Knit Scarf Set", query: "cashmere scarf winter" },
        ],
      },
    ];
    note = "Freezing temperatures require heavy insulation and layering.";
  } else if (temp < 10) {
    // Cold weather - 3 variations
    outfitVariations = [
      {
        style: "Casual Cool",
        items: [
          { name: "Denim Jacket", query: "blue denim jacket classic" },
          { name: "Knit Sweater", query: "cream knit sweater cozy" },
          { name: "Ankle Boots", query: "suede ankle boots tan" },
          { name: "Warm Scarf", query: "plaid scarf wool" },
        ],
      },
      {
        style: "Modern Edge",
        items: [
          { name: "Bomber Jacket", query: "black bomber jacket leather" },
          { name: "Turtleneck", query: "gray turtleneck sweater" },
          { name: "Chelsea Boots", query: "black chelsea boots leather" },
          { name: "Light Scarf", query: "minimalist scarf black" },
        ],
      },
      {
        style: "Timeless Chic",
        items: [
          { name: "Wool Coat", query: "tan beige wool overcoat jacket" },
          { name: "Pullover Sweater", query: "burgundy knit pullover sweater crewneck" },
          { name: "Leather Boots", query: "brown leather boots vintage" },
          { name: "Knit Scarf", query: "chunky knit scarf beige" },
        ],
      },
    ];
    note = "Cold weather calls for warm layers and comfortable outerwear.";
  } else if (temp < 18) {
    // Mild cool - 3 variations
    outfitVariations = [
      {
        style: "Smart Casual",
        items: [
          { name: "Light Jacket", query: "khaki field jacket spring" },
          { name: "Long Sleeve Shirt", query: "white oxford shirt cotton" },
          { name: "Sneakers", query: "white leather sneakers clean" },
        ],
      },
      {
        style: "Relaxed Comfort",
        items: [
          { name: "Cardigan", query: "navy cardigan sweater knitwear menswear" },
          { name: "Polo Shirt", query: "striped polo shirt casual" },
          { name: "Casual Loafers", query: "brown suede loafers" },
        ],
      },
      {
        style: "Active Ready",
        items: [
          { name: "Windbreaker", query: "windbreaker jacket sports apparel clothing" },
          { name: "Henley Shirt", query: "gray henley shirt long sleeve" },
          { name: "Running Shoes", query: "running shoes athletic colorful" },
        ],
      },
    ];
    note = "Cool and pleasant - light layers work best.";
  } else if (temp < 25) {
    // Comfortable weather - 3 variations
    outfitVariations = [
      {
        style: "Everyday Casual",
        items: [
          { name: "Cotton T-Shirt", query: "white cotton tshirt mens fashion" },
          { name: "Light Cardigan", query: "cardigan sweater mens fashion knitwear" },
          { name: "Sneakers", query: "white canvas sneakers footwear" },
        ],
      },
      {
        style: "Business Casual",
        items: [
          { name: "Polo Shirt", query: "navy polo shirt menswear" },
          { name: "Chinos", query: "beige chino pants menswear" },
          { name: "Oxford Shoes", query: "brown leather oxford shoes footwear" },
        ],
      },
      {
        style: "Streetwear Vibe",
        items: [
          { name: "Graphic Tee", query: "black tshirt streetwear fashion" },
          { name: "Hoodie", query: "grey hoodie streetwear" },
          { name: "White Sneakers", query: "white sneakers street fashion" },
        ],
      },
    ];
    note = "Comfortable temperature - perfect for light, casual wear.";
  } else if (temp < 30) {
    // Warm weather - 3 variations
    outfitVariations = [
      {
        style: "Summer Breeze",
        items: [
          { name: "Light Cotton Tee", query: "blue cotton tshirt mens summer fashion" },
          { name: "Shorts", query: "navy shorts mens casual wear" },
          { name: "Slide Sandals", query: "leather sandals mens footwear" },
          { name: "Sunglasses", query: "aviator sunglasses accessory" },
        ],
      },
      {
        style: "Beach Ready",
        items: [
          { name: "Tank Top", query: "white tank top mens athletic wear" },
          { name: "Denim Shorts", query: "denim shorts mens casual" },
          { name: "Flip Flops", query: "flip flops mens beach footwear" },
          { name: "Aviator Sunglasses", query: "sunglasses mens accessory" },
        ],
      },
      {
        style: "Resort Casual",
        items: [
          { name: "Linen Shirt", query: "beige linen shirt mens summer wear" },
          { name: "Light Pants", query: "linen pants mens white" },
          { name: "Canvas Sneakers", query: "canvas sneakers white footwear" },
          { name: "Shades", query: "sunglasses mens fashion accessory" },
        ],
      },
    ];
    note = "Warm weather - light, breathable clothing recommended.";
  } else {
    // Hot weather - 3 variations
    outfitVariations = [
      {
        style: "Heat Wave",
        items: [
          { name: "Breathable Tank", query: "mesh tank top athletic black" },
          { name: "Athletic Shorts", query: "performance shorts athletic gray" },
          { name: "Sport Sandals", query: "sport sandals outdoor black" },
          { name: "Wide Brim Hat", query: "straw sun hat wide brim" },
        ],
      },
      {
        style: "Tropical Vibes",
        items: [
          { name: "Light Tank Top", query: "colorful tank top tropical print" },
          { name: "Swim Shorts", query: "swim trunks tropical pattern" },
          { name: "Beach Sandals", query: "flip flops beach colorful" },
          { name: "Baseball Cap", query: "baseball cap summer white" },
        ],
      },
      {
        style: "Desert Cool",
        items: [
          { name: "Moisture-Wicking Top", query: "technical tshirt outdoor beige" },
          { name: "Light Clothing", query: "cargo shorts outdoor khaki" },
          { name: "Open Sandals", query: "hiking sandals outdoor brown" },
          { name: "Bucket Hat", query: "bucket hat outdoor navy" },
        ],
      },
    ];
    note = "Very hot - stay cool with minimal, moisture-wicking fabrics.";
  }

  // Weather condition adjustments - apply to all variations
  if (condition.includes("rain") || condition.includes("drizzle")) {
    outfitVariations = outfitVariations.map(variation => ({
      ...variation,
      items: [...variation.items, { name: "Umbrella", query: "umbrella rain" }],
    }));
    note += "☔ Rain expected! ";
  }
  
  if (condition.includes("snow")) {
    outfitVariations = outfitVariations.map(variation => ({
      ...variation,
      items: [...variation.items, { name: "Snow Gear", query: "snow gear" }],
    }));
    note += "❄️ Snowy weather! ";
  }

  if (windSpeed > 8) {
    note += "💨 Windy conditions! ";
  }

  if (humidity > 80 && temp > 20) {
    note += "🌡️ High humidity - choose breathable fabrics! ";
  }

  const summary = `For ${Math.round(temp)}°C (feels like ${Math.round(feelsLike)}°C) with ${description}`;

  return {
    summary,
    note,
    variations: outfitVariations, // Return all 3 variations
  };
}

// Generate outfit image using Nano Banana API
app.post("/make-server-0cb63601/generate-outfit-image", async (c) => {
  console.log(`[Nano Banana API] 🔵 Received generate outfit image request`);
  
  try {
    console.log(`[Nano Banana API] 📦 Parsing request body...`);
    const requestBody = await c.req.json();
    console.log(`[Nano Banana API] 📦 Request body parsed:`, JSON.stringify(requestBody, null, 2));
    
    const { weather, style, items } = requestBody;
    
    if (!weather || !style || !items) {
      console.error(`[Nano Banana API] ❌ Missing required fields - weather: ${!!weather}, style: ${!!style}, items: ${!!items}`);
      return c.json({ error: "Weather data, style, and items are required" }, 400);
    }

    const apiKey = Deno.env.get('GENERATION_API_KEY');
    
    if (!apiKey) {
      console.log("[Nano Banana API] ⚠️ No GENERATION_API_KEY found in environment");
      return c.json({ 
        error: "Nano Banana API key not configured"
      }, 500);
    }

    console.log(`[Nano Banana API] 🔑 API key exists: ${apiKey.substring(0, 8)}...`);

    // Build a detailed prompt for the outfit image - fold ALL data into the prompt
    const itemNames = items.map((item: any) => item.name).join(", ");
    const prompt = `A complete outfit flat lay for ${weather.condition} weather at ${weather.temperature}°C. Style: ${style}. Items to emphasize: ${itemNames}. Professional fashion photography, clean white background, high quality editorial style, well-lit studio shot.`;
    
    console.log(`[Nano Banana API] 🎨 Generated prompt: "${prompt}"`);
    
    // Build the CORRECT NanoBanana payload according to their API spec
    const nanoPayload = {
      prompt: prompt,
      type: "TEXTTOIAMGE",  // Required: EXACTLY this spelling (note "IAMGE" typo in their API)
      callBackUrl: "https://example.com/callback",  // Required: must be a string URL (we'll poll instead)
      numImages: 1,  // Optional: generate 1 image
    };
    
    console.log(`[Nano Banana API] 📤 NanoBanana payload:`, JSON.stringify(nanoPayload, null, 2));
    
    const generateUrl = "https://api.nanobananaapi.ai/api/v1/nanobanana/generate";
    
    const response = await fetch(generateUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(nanoPayload),
    });

    console.log(`[Nano Banana API] 📥 Response status: ${response.status}`);
    
    const responseText = await response.text();
    console.log(`[Nano Banana API] 📄 Response body:`, responseText);

    let data;
    try {
      data = JSON.parse(responseText);
    } catch (parseError) {
      console.error(`[Nano Banana API] ❌ Failed to parse response:`, parseError);
      return c.json({ 
        error: "Invalid response from API",
        details: responseText,
      }, 500);
    }
    
    console.log(`[Nano Banana API] 📊 Parsed response data:`, JSON.stringify(data, null, 2));
    
    // Check if the response indicates an error (their API returns HTTP 200 with code !== 200 on errors)
    if (!response.ok || (data && typeof data.code === "number" && data.code !== 200)) {
      const msg = (data?.msg ?? `Upstream ${response.status}`) + " (NanoBanana)";
      console.error(`[Nano Banana API] ❌`, msg, "payload:", nanoPayload, "resp:", responseText);
      return c.json({ 
        error: data?.msg || `API Error (${response.status})`,
        code: data?.code || response.status,
        details: JSON.stringify(data || responseText),
      }, 502);
    }
    
    // Check if data.data exists and has taskId
    if (!data.data || !data.data.taskId) {
      console.error(`[Nano Banana API] ❌ Response missing taskId:`, JSON.stringify(data));
      return c.json({ 
        error: "API response missing taskId",
        details: JSON.stringify(data),
      }, 500);
    }

    const taskId = data.data.taskId;
    console.log(`[Nano Banana API] ✅ Task started with ID: ${taskId}`);

    return c.json({ 
      taskId: taskId,
      message: "Image generation started"
    });
    
  } catch (error) {
    console.error("[Nano Banana API] ❌ GENERATION ERROR:", error);
    return c.json({ 
      error: error.message || "Internal server error",
      stack: error.stack,
    }, 500);
  }
});

// Check outfit image generation status
app.get("/make-server-0cb63601/outfit-image-status", async (c) => {
  try {
    const taskId = c.req.query('taskId');
    
    if (!taskId) {
      return c.json({ error: "taskId is required" }, 400);
    }

    const apiKey = Deno.env.get('GENERATION_API_KEY');
    
    if (!apiKey) {
      console.log("[Nano Banana API] ⚠️ No GENERATION_API_KEY found in environment");
      return c.json({ 
        error: "Nano Banana API key not configured"
      }, 500);
    }

    // Check task status
    const statusUrl = `https://api.nanobananaapi.ai/api/v1/nanobanana/record-info?taskId=${taskId}`;
    console.log(`[Nano Banana API] 🔍 Checking status for taskId: ${taskId}`);
    
    const response = await fetch(statusUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
    });

    console.log(`[Nano Banana API] 📥 Status check response status: ${response.status}`);
    
    const responseText = await response.text();
    console.log(`[Nano Banana API] 📄 Status check raw response:`, responseText);

    if (!response.ok) {
      console.error(`[Nano Banana API] ❌ STATUS CHECK ERROR ${response.status}:`, responseText);
      return c.json({ 
        error: `Failed to check status (HTTP ${response.status})`,
        details: responseText,
      }, response.status);
    }

    let data;
    try {
      data = JSON.parse(responseText);
    } catch (parseError) {
      console.error(`[Nano Banana API] ❌ Failed to parse status response:`, parseError);
      return c.json({ 
        error: "Invalid response from API",
        details: responseText,
      }, 500);
    }
    
    console.log(`[Nano Banana API] 📊 Parsed status data:`, JSON.stringify(data, null, 2));
    
    // successFlag: 0 = generating, 1 = success, 2 = create failed, 3 = generation failed
    const statusMap: Record<number, string> = {
      0: 'generating',
      1: 'success',
      2: 'create_failed',
      3: 'generation_failed',
    };
    
    const successFlag = data?.successFlag ?? data?.data?.successFlag;
    const status = statusMap[successFlag] || 'unknown';
    console.log(`[Nano Banana API] 📊 Task ${taskId} successFlag: ${successFlag}, mapped status: ${status}`);
    
    const result: any = {
      status: status,
      successFlag: successFlag,
      rawData: data, // Include full response for debugging
    };
    
    if (status === 'success' && (data.response?.resultImageUrl || data.data?.response?.resultImageUrl)) {
      result.imageUrl = data.response?.resultImageUrl || data.data?.response?.resultImageUrl;
      console.log(`[Nano Banana API] ✅ Image ready: ${result.imageUrl}`);
    } else if (status === 'create_failed' || status === 'generation_failed') {
      result.error = data.errorMessage || data.data?.errorMessage || 'Generation failed';
      console.error(`[Nano Banana API] ❌ Failed: ${result.error}`);
    }

    return c.json(result);
    
  } catch (error) {
    console.error("[Nano Banana API] ❌ STATUS CHECK ERROR:", error);
    return c.json({ 
      error: error.message || "Internal server error"
    }, 500);
  }
});

Deno.serve(app.fetch);