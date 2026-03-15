import { inject, Pipe, PipeTransform } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

@Pipe({ name: 'jiraMarkup' })
export class JiraMarkupPipe implements PipeTransform {
  private readonly sanitizer = inject(DomSanitizer);
  transform(value: string | null | undefined): SafeHtml {
    if (!value) return '';
    return this.sanitizer.bypassSecurityTrustHtml(parseJiraMarkup(value));
  }
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function extractParam(params: string | undefined, key: string): string | null {
  if (!params) return null;
  const m = params.match(new RegExp(`(?:^|[|,])\\s*${key}=([^|,}]+)`));
  return m ? m[1].trim() : null;
}

function extractBlocks(text: string, stash: string[]): string {
  const protect = (html: string) => { stash.push(html); return `\x00BLOCK:${stash.length - 1}\x00`; };

  text = text.replace(/\{code(?::([^}]*))?\}([\s\S]*?)\{code\}/gi, (_, params, inner) => {
    const title = extractParam(params, 'title');
    const titleHtml = title ? `<div class="jira-code-title">${escapeHtml(title)}</div>` : '';
    return protect(`<pre class="jira-code-block">${titleHtml}<code>${escapeHtml(inner.trim())}</code></pre>`);
  });

  text = text.replace(/\{noformat[^}]*\}([\s\S]*?)\{noformat\}/gi, (_, inner) =>
    protect(`<pre class="jira-noformat">${escapeHtml(inner.trim())}</pre>`)
  );

  text = text.replace(/\{quote\}([\s\S]*?)\{quote\}/gi, (_, inner) =>
    protect(`<blockquote class="jira-quote">${parseJiraMarkup(inner.trim())}</blockquote>`)
  );

  text = text.replace(/\{panel(?::([^}]*))?\}([\s\S]*?)\{panel\}/gi, (_, params, inner) => {
    const title = extractParam(params, 'title');
    const titleHtml = title ? `<div class="jira-panel-title">${escapeHtml(title)}</div>` : '';
    return protect(`<div class="jira-panel">${titleHtml}${parseJiraMarkup(inner.trim())}</div>`);
  });

  text = text.replace(/\{anchor:[^}]*\}/gi, '');

  return text;
}

function applyInline(text: string): string {
  text = text.replace(/\{color:([^}]+)\}(.*?)\{color\}/gi,
    (_, color, inner) => `<span style="color:${color}">${inner}</span>`);

  text = text.replace(/\{\{(.*?)\}\}/g,
    (_, inner) => `<code class="jira-inline-code">${inner}</code>`);

  text = text.replace(/\?\?((?!\s).*?(?<!\s))\?\?/g, '<cite>$1</cite>');

  text = text.replace(/\[([^\]]+)\]/g, (_, content) => {
    if (content.startsWith('#')) return '';
    if (content.startsWith('~')) {
      const user = content.slice(1);
      return `<span class="jira-mention">@${user}</span>`;
    }
    const pipe = content.indexOf('|');
    if (pipe !== -1) {
      const label = content.slice(0, pipe).trim();
      const url = content.slice(pipe + 1).trim();
      return `<a href="${url}" target="_blank" rel="noopener noreferrer" class="jira-link">${label}</a>`;
    }
    return `<a href="${content}" target="_blank" rel="noopener noreferrer" class="jira-link">${content}</a>`;
  });

  text = text.replace(/!([^!|]+)(?:\|[^!]*)?!/g,
    (_, filename) => `<span class="jira-image-placeholder">🖼 ${filename}</span>`);

  text = text.replace(/\*(\S(?:[^*]*?\S)?)\*/g, '<strong>$1</strong>');
  text = text.replace(/_(\S(?:[^_]*?\S)?)_/g, '<em>$1</em>');
  text = text.replace(/(?<!\w)-(\S(?:[^-]*?\S)?)-(?!\w)/g, '<del>$1</del>');
  text = text.replace(/\+(\S(?:[^+]*?\S)?)\+/g, '<ins>$1</ins>');
  text = text.replace(/\^(\S(?:[^^]*?\S)?)\^/g, '<sup>$1</sup>');
  text = text.replace(/~(\S(?:[^~]*?\S)?)~/g, '<sub>$1</sub>');

  text = text.replace(/\\\\/g, '<br>');
  text = text.replace(/---/g, '—');
  text = text.replace(/--/g, '–');

  return text;
}

function processLines(text: string): string {
  const lines = text.split('\n');
  const out: string[] = [];
  type Tag = 'ul' | 'ol';
  const listStack: Tag[] = [];
  const tableRows: string[] = [];
  let inTable = false;
  let paraLines: string[] = [];

  function flushParagraph(): void {
    if (!paraLines.length) return;
    const content = paraLines.join(' ');
    if (content.trim()) out.push(`<p class="jira-p">${applyInline(content)}</p>`);
    paraLines = [];
  }

  function closeAllLists(): void {
    while (listStack.length) out.push(`</${listStack.pop()}>`);
  }

  function flushTable(): void {
    if (!inTable) return;
    const headRows = tableRows.filter(r => r.includes('<th '));
    const bodyRows = tableRows.filter(r => !r.includes('<th '));
    let html = '<table class="jira-table">';
    if (headRows.length) html += `<thead>${headRows.join('')}</thead>`;
    if (bodyRows.length) html += `<tbody>${bodyRows.join('')}</tbody>`;
    html += '</table>';
    out.push(html);
    tableRows.length = 0;
    inTable = false;
  }

  for (const rawLine of lines) {
    if (/\x00BLOCK:\d+\x00/.test(rawLine)) {
      flushParagraph(); closeAllLists(); flushTable();
      out.push(rawLine);
      continue;
    }

    const hm = rawLine.match(/^\s*h([1-6])\.\s+(.*)/);
    if (hm) {
      flushParagraph(); closeAllLists(); flushTable();
      out.push(`<h${hm[1]} class="jira-h${hm[1]}">${applyInline(escapeHtml(hm[2]))}</h${hm[1]}>`);
      continue;
    }

    if (rawLine.trim() === '----') {
      flushParagraph(); closeAllLists(); flushTable();
      out.push('<hr class="jira-hr">');
      continue;
    }

    const bqm = rawLine.match(/^bq\.\s+(.*)/);
    if (bqm) {
      flushParagraph(); closeAllLists(); flushTable();
      out.push(`<blockquote class="jira-quote"><p>${applyInline(escapeHtml(bqm[1]))}</p></blockquote>`);
      continue;
    }

    if (/^\|/.test(rawLine.trim())) {
      flushParagraph(); closeAllLists();
      const isHeader = rawLine.trim().startsWith('||');
      const raw = rawLine.trim();
      const cells = isHeader
        ? raw.replace(/^\|\|/, '').replace(/\|\|$/, '').split('||')
        : raw.replace(/^\|/, '').replace(/\|$/, '').split('|');
      const tag = isHeader ? 'th' : 'td';
      const row = `<tr>${cells.map(c => `<${tag} class="jira-${tag}">${applyInline(escapeHtml(c.trim()))}</${tag}>`).join('')}</tr>`;
      tableRows.push(row);
      inTable = true;
      continue;
    } else if (inTable) {
      flushTable();
    }

    const lm = rawLine.match(/^\s*([*#\-]+) (.*)/);
    if (lm && !/^\s*-{2,}/.test(rawLine)) {
      flushParagraph(); flushTable();
      const prefix = lm[1];
      const depth = prefix.length;
      const lastChar = prefix[prefix.length - 1];
      const currentTag: Tag = lastChar === '#' ? 'ol' : 'ul';

      if (depth > listStack.length) {
        while (listStack.length < depth) {
          const levelChar = prefix[listStack.length];
          const levelTag: Tag = levelChar === '#' ? 'ol' : 'ul';
          out.push(`<${levelTag} class="jira-list">`);
          listStack.push(levelTag);
        }
      } else if (depth < listStack.length) {
        while (listStack.length > depth) out.push(`</${listStack.pop()}>`);
      } else if (listStack[depth - 1] !== currentTag) {
        out.push(`</${listStack.pop()}>`);
        out.push(`<${currentTag} class="jira-list">`);
        listStack.push(currentTag);
      }

      out.push(`<li class="jira-li">${applyInline(escapeHtml(lm[2]))}</li>`);
      continue;
    } else if (listStack.length) {
      closeAllLists();
    }

    if (!rawLine.trim()) {
      flushParagraph();
      continue;
    }

    paraLines.push(escapeHtml(rawLine));
  }

  flushParagraph(); closeAllLists(); flushTable();
  return out.join('\n');
}

function parseJiraMarkup(input: string): string {
  const stash: string[] = [];
  let text = input.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  text = extractBlocks(text, stash);
  let html = processLines(text);
  return html.replace(/\x00BLOCK:(\d+)\x00/g, (_, i) => stash[parseInt(i, 10)]);
}
