export interface OrbitSettings {
  connections: {
    jira: {
      baseUrl: string;
      apiKey: string;
    };
    bitbucket: {
      baseUrl: string;
      apiKey: string;
      userSlug: string;
    };
    vertexAi: {
      url: string;
      customHeaders: { name: string; value: string }[];
    };
  };
  features: {
    pomodoro: {
      enabled: boolean;
      focusMinutes: number;
      breakMinutes: number;
    };
    aiReviews: {
      enabled: boolean;
    };
    dayCalendar: {
      enabled: boolean;
    };
  };
  appearance: {
    theme: 'light' | 'dark' | 'system';
  };
}

export function createDefaultSettings(): OrbitSettings {
  return {
    connections: {
      jira: { baseUrl: '', apiKey: '' },
      bitbucket: { baseUrl: '', apiKey: '', userSlug: '' },
      vertexAi: { url: '', customHeaders: [] },
    },
    features: {
      pomodoro: { enabled: true, focusMinutes: 25, breakMinutes: 5 },
      aiReviews: { enabled: false },
      dayCalendar: { enabled: true },
    },
    appearance: { theme: 'system' },
  };
}
