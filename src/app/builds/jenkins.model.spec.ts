import { describe, it, expect } from 'vitest';
import { createDefaultSettings } from '../settings/settings.model';

describe('settings model — Jenkins defaults', () => {
  it('includes jenkins connection with empty defaults', () => {
    const settings = createDefaultSettings();
    expect(settings.connections.jenkins).toEqual({
      baseUrl: '',
      username: '',
      apiToken: '',
      jobs: [],
    });
  });
});
