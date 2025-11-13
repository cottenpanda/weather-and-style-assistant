import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

interface WeatherChartProps {
  temperature: number;
  feelsLike: number;
  humidity: number;
  windSpeed: number;
  location: string;
  country: string;
  condition: string;
  description: string;
  demoMode?: boolean;
  color?: string; // Custom color for city comparison
}

export function WeatherChart({
  temperature,
  feelsLike,
  humidity,
  windSpeed,
  location,
  country,
  condition,
  description,
  demoMode = false,
  color, // Custom color prop
}: WeatherChartProps) {
  // Default color logic (used for single city view)
  const defaultColor = temperature > 25 ? '#EF4444' : temperature > 15 ? '#F59E0B' : '#3B82F6';
  
  // Use custom color if provided (for comparison), otherwise use default logic
  const barColor = color || defaultColor;
  
  const data = [
    {
      name: 'Temp',
      value: temperature,
      unit: '°C',
      color: barColor, // Same color for all bars
    },
    {
      name: 'Feels Like',
      value: feelsLike,
      unit: '°C',
      color: barColor, // Same color for all bars
    },
    {
      name: 'Humidity',
      value: humidity,
      unit: '%',
      color: barColor, // Same color for all bars
    },
    {
      name: 'Wind',
      value: Math.round(windSpeed * 10) / 10,
      unit: 'm/s',
      color: barColor, // Same color for all bars
    },
  ];

  return (
    <div className="bg-white rounded-xl p-4">
      {/* Header */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h3 className="md-title-medium text-[#111827]">
              {location}, {country}
            </h3>
            <p className="md-body-small text-[#6B7280] capitalize">{description}</p>
          </div>
          {demoMode && (
            <span className="md-label-small bg-[#FEF3C7] text-[#92400E] px-3 py-1.5 rounded-full border border-[#F59E0B]">
              ⚠️ Demo Data
            </span>
          )}
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-[48px] text-[#111827]">{temperature}°</span>
          <span className="md-body-medium text-[#6B7280]">feels like {feelsLike}°C</span>
        </div>
      </div>

      {/* Chart */}
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
          <XAxis 
            dataKey="name" 
            tick={{ fill: '#6B7280', fontSize: 12 }}
            axisLine={{ stroke: '#E5E7EB' }}
          />
          <YAxis 
            tick={{ fill: '#6B7280', fontSize: 12 }}
            axisLine={{ stroke: '#E5E7EB' }}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#FFFFFF',
              border: '1px solid #E5E7EB',
              borderRadius: '8px',
              fontSize: '14px',
            }}
            formatter={(value: any, name: any, props: any) => [
              `${value}${props.payload.unit}`,
              name,
            ]}
          />
          <Bar dataKey="value" radius={[8, 8, 0, 0]}>
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}