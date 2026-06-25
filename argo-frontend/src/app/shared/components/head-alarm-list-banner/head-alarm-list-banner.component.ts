import { CommonModule } from '@angular/common';
import { Component, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';

import type { HeadAlarmListRow } from './head-alarm-list.types';

@Component({
  selector: 'argo-head-alarm-list-banner',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './head-alarm-list-banner.component.html',
  styleUrls: ['./head-alarm-list-banner.component.scss'],
})
export class HeadAlarmListBannerComponent {
  visible = input(false);
  title = input('');
  hint = input('');
  icon = input('');
  theme = input('hal-theme-default');
  items = input<HeadAlarmListRow[]>([]);
  itemDismissible = input(false);

  closed = output<Event>();
  itemClick = output<HeadAlarmListRow>();
  itemDismiss = output<HeadAlarmListRow>();

  onClose(ev: Event) {
    ev.stopPropagation();
    this.closed.emit(ev);
  }

  onItemClick(item: HeadAlarmListRow, ev: Event) {
    ev.stopPropagation();
    this.itemClick.emit(item);
  }

  onDismissItem(item: HeadAlarmListRow, ev: Event) {
    ev.stopPropagation();
    this.itemDismiss.emit(item);
  }
}
