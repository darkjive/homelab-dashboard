import { useState, useEffect } from 'react';
import { Cloud, CloudRain, Sun, Wind, Droplets, MapPin, Edit2 } from 'lucide-react';

interface WeatherData {
  current_condition: Array<{
    temp_C: string;
    weatherDesc: Array<{ value: string }>;
    humidity: string;
    windspeedKmph: string;
    FeelsLikeC: string;
  }>;
  nearest_area: Array<{
    areaName: Array<{ value: string }>;
    country: Array<{ value: string }>;
  }>;
}

export function WeatherWidget({ location: initialLocation = 'Munich' }: { location?: string }) {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(true);
  const [location, setLocation] = useState(() => {
    return localStorage.getItem('weather-location') || initialLocation;
  });
  const [editingLocation, setEditingLocation] = useState(false);
  const [tempLocation, setTempLocation] = useState(location);

  const saveLocation = () => {
    setLocation(tempLocation);
    localStorage.setItem('weather-location', tempLocation);
    setEditingLocation(false);
  };

  useEffect(() => {
    const fetchWeather = async () => {
      try {
        const res = await fetch(`/api/weather?location=${location}`);
        const data = await res.json();
        setWeather(data);
        setLoading(false);
      } catch (error) {
        console.error('Failed to fetch weather:', error);
        setLoading(false);
      }
    };

    fetchWeather();
    const interval = setInterval(fetchWeather, 600000); // Update every 10 minutes
    return () => clearInterval(interval);
  }, [location]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-cyber-cyan">
          FETCHING WEATHER DATA<span className="blink-cursor"></span>
        </div>
      </div>
    );
  }

  if (!weather || !weather.current_condition || !weather.current_condition[0]) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-red-500">Weather data unavailable</div>
      </div>
    );
  }

  const current = weather.current_condition[0];
  const area = weather.nearest_area[0];
  const temp = current.temp_C === '--' ? '--' : parseInt(current.temp_C);
  const desc = current.weatherDesc[0].value.toLowerCase();

  const getWeatherIcon = () => {
    if (desc.includes('rain')) return <CloudRain className="w-12 h-12 text-cyber-cyan" />;
    if (desc.includes('cloud')) return <Cloud className="w-12 h-12 text-gray-400" />;
    return <Sun className="w-12 h-12 text-cyber-orange" />;
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-xl font-bold cyber-glow">WEATHER</h3>
          {editingLocation ? (
            <div className="flex items-center gap-2 mt-1">
              <input
                type="text"
                value={tempLocation}
                onChange={e => setTempLocation(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && saveLocation()}
                className="px-2 py-1 bg-cyber-darkbg border border-cyber-cyan text-xs rounded text-gray-300"
                placeholder="City name"
                autoFocus
              />
              <button
                onClick={saveLocation}
                className="px-2 py-1 bg-cyber-cyan text-black text-xs rounded hover:bg-cyber-orange transition-colors"
              >
                Save
              </button>
              <button
                onClick={() => {
                  setTempLocation(location);
                  setEditingLocation(false);
                }}
                className="px-2 py-1 bg-gray-700 text-gray-300 text-xs rounded hover:bg-gray-600 transition-colors"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => setEditingLocation(true)}
              className="flex items-center gap-2 px-3 py-1.5 bg-cyber-darkbg border border-cyber-cyan/30 rounded text-xs text-cyber-cyan mt-1 hover:border-cyber-cyan hover:bg-cyber-cyan/10 transition-all group"
            >
              <MapPin className="w-3 h-3" />
              <span>
                {area.areaName[0].value}, {area.country[0].value}
              </span>
              <Edit2 className="w-3 h-3 opacity-50 group-hover:opacity-100" />
            </button>
          )}
        </div>
        {getWeatherIcon()}
      </div>

      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="text-5xl font-bold cyber-glow">{temp}°C</div>
          <div className="text-sm text-gray-400 mt-1">
            {current.FeelsLikeC !== '--'
              ? `Feels like ${current.FeelsLikeC}°C`
              : 'Service unavailable'}
          </div>
        </div>
      </div>

      <div className="text-lg text-cyber-cyan mb-4 capitalize">{desc}</div>

      <div className="grid grid-cols-2 gap-4 pt-4 border-t border-cyber-border">
        <div className="flex items-center gap-2">
          <Droplets className="w-4 h-4 text-cyber-cyan" />
          <div>
            <div className="text-xs text-gray-400">Humidity</div>
            <div className="text-sm font-bold">{current.humidity}%</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Wind className="w-4 h-4 text-cyber-cyan" />
          <div>
            <div className="text-xs text-gray-400">Wind</div>
            <div className="text-sm font-bold">{current.windspeedKmph} km/h</div>
          </div>
        </div>
      </div>
    </div>
  );
}
