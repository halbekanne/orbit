
import { TestBed } from '@angular/core/testing';
import { JiraMarkupPipe } from './jira-markup.pipe';
import { DomSanitizer } from '@angular/platform-browser';

describe('JiraMarkupPipe', () => {
  let pipe: JiraMarkupPipe;
  let sanitizer: DomSanitizer;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [JiraMarkupPipe],
    });

    pipe = TestBed.inject(JiraMarkupPipe);
    sanitizer = TestBed.inject(DomSanitizer);
  });

  it('should create an instance', () => {
    expect(pipe).toBeTruthy();
  });

  it('should convert plain URLs to clickable links', () => {
    const input = 'Visit https://example.com for more info';
    const result = pipe.transform(input);
    expect(result).toContain('href="https://example.com"');
    expect(result).toContain('class="jira-link"');
  });

  it('should handle multiple URLs', () => {
    const input = 'Check https://first.com and https://second.com';
    const result = pipe.transform(input);
    expect(result).toContain('href="https://first.com"');
    expect(result).toContain('href="https://second.com"');
  });

  it('should handle URLs in parentheses', () => {
    const input = 'See documentation (https://docs.example.com)';
    const result = pipe.transform(input);
    expect(result).toContain('href="https://docs.example.com"');
  });

  it('should handle URLs with trailing punctuation', () => {
    const input = 'The site is https://example.com. Visit now!';
    const result = pipe.transform(input);
    expect(result).toContain('href="https://example.com"');
  });

  it('should handle FTP URLs', () => {
    const input = 'Download from ftp://files.example.com';
    const result = pipe.transform(input);
    expect(result).toContain('href="ftp://files.example.com"');
  });

  it('should not double-process Jira link syntax', () => {
    const input = 'Check [label|https://example.com]';
    const result = pipe.transform(input);
    // Should have the Jira link syntax processed, not double-wrapped
    expect(result).toContain('href="https://example.com"');
    expect(result).toContain('>label<');
  });

  it('should handle long URLs that need wrapping', () => {
    const input = 'Long URL: https://www.example.com/very/long/path/that/should/wrap/properly';
    const result = pipe.transform(input);
    expect(result).toContain('href="https://www.example.com/very/long/path/that/should/wrap/properly"');
    expect(result).toContain('class="jira-link"');
  });
});
