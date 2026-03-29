import { Pipe, PipeTransform } from '@angular/core';

@Pipe({ name: 'inlineCode' })
export class InlineCodePipe implements PipeTransform {
  transform(value: string): string {
    const escaped = value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return escaped.replace(/`([^`]+)`/g, '<code>$1</code>');
  }
}
