import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-status-banner',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div
      *ngIf="message"
      class="ui-banner"
      [class.success]="type === 'success'"
      [class.error]="type === 'error'"
      [class.info]="type === 'info'"
      [attr.role]="type === 'error' ? 'alert' : 'status'"
    >
      <span class="ui-banner-msg">
        <i
          class="icon"
          [ngClass]="type === 'error' ? 'exclamation circle' : type === 'info' ? 'info circle' : 'check circle'"
          aria-hidden="true"
        ></i>
        {{ message }}
      </span>
      <button type="button" class="ui-btn secondary-btn" (click)="dismiss.emit()">Ocultar</button>
    </div>
  `,
})
export class StatusBannerComponent {
  @Input() message = '';
  @Input() type: 'success' | 'error' | 'info' = 'success';
  @Output() dismiss = new EventEmitter<void>();
}
