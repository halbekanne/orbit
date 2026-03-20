import { Pipe, PipeTransform } from '@angular/core';

@Pipe({ name: 'inlineCode' })
export class InlineCodePipe implements PipeTransform {
  transform(value: string): string {
    return value.replace(/`([^`]+)`/g, '<code>$1</code>');
  }
}
