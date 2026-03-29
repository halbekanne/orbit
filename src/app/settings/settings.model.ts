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
    jenkins: {
      baseUrl: string;
      username: string;
      apiToken: string;
      jobs: JenkinsJobConfig[];
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

export interface JenkinsJobConfig {
  displayName: string;
  jobPath: string;
}

export function createDefaultSettings(): OrbitSettings {
  return {
    connections: {
      jira: { baseUrl: '', apiKey: '' },
      bitbucket: { baseUrl: '', apiKey: '', userSlug: '' },
      vertexAi: { url: '', customHeaders: [] },
      jenkins: { baseUrl: '', username: '', apiToken: '', jobs: [] },
    },
    features: {
      pomodoro: { enabled: true, focusMinutes: 25, breakMinutes: 5 },
      aiReviews: { enabled: false },
      dayCalendar: { enabled: true },
    },
    appearance: { theme: 'system' },
  };
}
