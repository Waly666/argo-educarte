import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  template: '<router-outlet />',
  styles:
    ':host { display: block; min-height: 100vh; font-family: var(--av-font-sans); }',
})
export class AppComponent {}
