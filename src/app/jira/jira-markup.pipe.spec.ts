import { TestBed } from '@angular/core/testing';
import { JiraMarkupPipe } from './jira-markup.pipe';
import { SafeHtml } from '@angular/platform-browser';

function html(safe: SafeHtml): string {
  return (safe as unknown as { changingThisBreaksApplicationSecurity: string })
    .changingThisBreaksApplicationSecurity;
}

describe('JiraMarkupPipe', () => {
  let pipe: JiraMarkupPipe;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [JiraMarkupPipe],
    });

    pipe = TestBed.inject(JiraMarkupPipe);
  });

  it('should create an instance', () => {
    expect(pipe).toBeTruthy();
  });

  it('should convert plain URLs to clickable links', () => {
    const result = html(pipe.transform('Visit https://example.com for more info'));
    expect(result).toContain('href="https://example.com"');
    expect(result).toContain('class="jira-link"');
  });

  it('should handle multiple URLs', () => {
    const result = html(pipe.transform('Check https://first.com and https://second.com'));
    expect(result).toContain('href="https://first.com"');
    expect(result).toContain('href="https://second.com"');
  });

  it('should handle URLs in parentheses', () => {
    const result = html(pipe.transform('See documentation (https://docs.example.com)'));
    expect(result).toContain('href="https://docs.example.com"');
  });

  it('should handle URLs with trailing punctuation', () => {
    const result = html(pipe.transform('The site is https://example.com. Visit now!'));
    expect(result).toContain('href="https://example.com"');
  });

  it('should not double-process Jira link syntax', () => {
    const result = html(pipe.transform('Check [label|https://example.com]'));
    expect(result).toContain('href="https://example.com"');
    expect(result).toContain('>label<');
    const anchorCount = (result.match(/<a /g) ?? []).length;
    expect(anchorCount).toBe(1);
  });

  it('should handle long URLs that need wrapping', () => {
    const result = html(
      pipe.transform('Long URL: https://www.example.com/very/long/path/that/should/wrap/properly'),
    );
    expect(result).toContain(
      'href="https://www.example.com/very/long/path/that/should/wrap/properly"',
    );
    expect(result).toContain('class="jira-link"');
  });

  it('should handle URLs with query parameters', () => {
    const result = html(pipe.transform('Link: https://example.com/search?q=a&b=c'));
    expect(result).toContain('href="https://example.com/search?q=a&amp;b=c"');
    expect(result).toContain('class="jira-link"');
  });

  it('should handle a URL at the start of text', () => {
    const result = html(pipe.transform('https://example.com is the site'));
    expect(result).toContain('href="https://example.com"');
  });

  it('should not auto-link URLs inside code blocks', () => {
    const result = html(pipe.transform('{code}https://example.com{code}'));
    expect(result).not.toContain('jira-link');
    expect(result).toContain('jira-code-block');
  });

  it('should not auto-link URLs inside inline code', () => {
    const result = html(pipe.transform('Run {{https://example.com}}'));
    expect(result).toContain('jira-inline-code');
    const anchorCount = (result.match(/<a /g) ?? []).length;
    expect(anchorCount).toBe(0);
  });

  it('should handle Jira bare URL link syntax without double-wrapping', () => {
    const result = html(pipe.transform('[https://example.com]'));
    expect(result).toContain('href="https://example.com"');
    const anchorCount = (result.match(/<a /g) ?? []).length;
    expect(anchorCount).toBe(1);
  });

  it('should handle URL followed by comma', () => {
    const result = html(pipe.transform('See https://example.com, then continue'));
    expect(result).toContain('href="https://example.com"');
    expect(result).not.toContain('href="https://example.com,"');
  });

  it('should handle URL with fragment', () => {
    const result = html(pipe.transform('See https://example.com/page#section'));
    expect(result).toContain('href="https://example.com/page#section"');
  });
});
