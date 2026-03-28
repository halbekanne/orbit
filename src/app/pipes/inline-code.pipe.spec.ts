import { InlineCodePipe } from './inline-code.pipe';

describe('InlineCodePipe', () => {
  const pipe = new InlineCodePipe();

  it('transforms backtick-wrapped text into <code> elements', () => {
    expect(pipe.transform('Use `ngOnInit` here')).toBe('Use <code>ngOnInit</code> here');
  });

  it('handles multiple backtick occurrences', () => {
    expect(pipe.transform('`foo` and `bar`')).toBe('<code>foo</code> and <code>bar</code>');
  });

  it('returns text unchanged when no backticks', () => {
    expect(pipe.transform('plain text')).toBe('plain text');
  });

  it('handles empty string', () => {
    expect(pipe.transform('')).toBe('');
  });

  it('escapes HTML tags in plain text', () => {
    expect(pipe.transform('Use a <button> element')).toBe('Use a &lt;button&gt; element');
  });

  it('escapes HTML but preserves backtick-to-code conversion', () => {
    expect(pipe.transform('Use `<button>` instead of <div>'))
      .toBe('Use <code>&lt;button&gt;</code> instead of &lt;div&gt;');
  });
});
