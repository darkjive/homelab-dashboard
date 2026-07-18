import { spawn } from 'child_process';

export interface WeatherData {
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

export async function getWeather(location: string): Promise<WeatherData> {
  try {
    const url = `https://wttr.in/${encodeURIComponent(location)}?format=j1`;

    // Use spawn instead of exec to prevent command injection
    // Increased timeout to 15s for slow network connections
    const curlProcess = spawn('curl', ['-s', '-m', '15', url], {
      shell: false,
      timeout: 16000,
    });

    let stdout = '';
    let stderr = '';

    curlProcess.stdout.on('data', data => {
      stdout += data.toString();
    });

    curlProcess.stderr.on('data', data => {
      stderr += data.toString();
    });

    await new Promise<void>((resolve, reject) => {
      curlProcess.on('close', code => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`curl exited with code ${code}: ${stderr}`));
        }
      });

      curlProcess.on('error', err => {
        reject(err);
      });
    });

    const data = JSON.parse(stdout);
    return data;
  } catch (error) {
    console.error('Failed to fetch weather:', error);
    // Return fallback data instead of throwing
    return {
      current_condition: [
        {
          temp_C: '--',
          weatherDesc: [{ value: 'Unavailable' }],
          humidity: '--',
          windspeedKmph: '--',
          FeelsLikeC: '--',
        },
      ],
      nearest_area: [
        {
          areaName: [{ value: location }],
          country: [{ value: '--' }],
        },
      ],
    };
  }
}
