import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

import { ConfigPasarela, PasarelaService } from '../../core/services/pasarela.service';
import { ArgoSwitchComponent } from '../../shared/argo-switch/argo-switch.component';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'argo-config-pasarela',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, ArgoSwitchComponent],
  templateUrl: './config-pasarela.component.html',
  styleUrls: ['./config-pasarela.component.scss'],
})
export class ConfigPasarelaComponent implements OnInit {
  private pasSvc = inject(PasarelaService);

  form = signal<ConfigPasarela>({ ambiente: 'sandbox', activo: false });
  loading = signal(true);
  saving = signal(false);
  msg = signal<string | null>(null);
  msgError = signal(false);
  webhookUrl = signal('');
  showPrivateKey = signal(false);
  showEventsSecret = signal(false);
  showIntegritySecret = signal(false);
  copyMsg = signal<string | null>(null);

  modoPruebas = computed(() => this.form().ambiente !== 'production');

  ngOnInit(): void {
    this.pasSvc.obtenerConfig().subscribe({
      next: (c) => {
        this.form.set(c);
        this.webhookUrl.set(c.webhookUrlSugerida || `${environment.apiUrl}/webhooks/wompi`);
        this.loading.set(false);
      },
      error: () => {
        this.webhookUrl.set(`${environment.apiUrl}/webhooks/wompi`);
        this.loading.set(false);
        this.msgError.set(true);
        this.msg.set('No se pudo cargar la configuración de pasarela.');
      },
    });
  }

  patch<K extends keyof ConfigPasarela>(key: K, value: ConfigPasarela[K]): void {
    this.form.update((f) => {
      const next = { ...f, [key]: value };
      if (key === 'publicKey') {
        const k = String(value || '').trim();
        if (k.startsWith('pub_prod_')) next.ambiente = 'production';
        else if (k.startsWith('pub_test_')) next.ambiente = 'sandbox';
      }
      return next;
    });
  }

  toggleSecret(field: 'privateKey' | 'eventsSecret' | 'integritySecret'): void {
    if (field === 'privateKey') this.showPrivateKey.update((v) => !v);
    if (field === 'eventsSecret') this.showEventsSecret.update((v) => !v);
    if (field === 'integritySecret') this.showIntegritySecret.update((v) => !v);
  }

  async copiarWebhook(): Promise<void> {
    const url = this.webhookUrl();
    try {
      await navigator.clipboard.writeText(url);
      this.copyMsg.set('URL copiada');
      setTimeout(() => this.copyMsg.set(null), 2500);
    } catch {
      this.copyMsg.set('No se pudo copiar');
    }
  }

  guardar(): void {
    this.saving.set(true);
    this.msg.set(null);
    this.msgError.set(false);
    const dto = { ...this.form(), webhookUrl: this.webhookUrl() };
    this.pasSvc.guardarConfig(dto).subscribe({
      next: (c) => {
        this.form.set(c);
        if (c.webhookUrlSugerida) this.webhookUrl.set(c.webhookUrlSugerida);
        this.saving.set(false);
        this.msg.set('Configuración Wompi guardada.');
      },
      error: (e) => {
        this.saving.set(false);
        this.msgError.set(true);
        this.msg.set(e?.error?.message || 'No se pudo guardar.');
      },
    });
  }
}
