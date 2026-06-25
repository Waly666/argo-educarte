import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import {
  mergePortalLanding,
  PORTAL_LANDING_DEFAULTS,
  PortalLandingConfig,
} from '../../core/constants/portal-landing-defaults';
import { PortalAulaConfig } from '../../core/services/aula-virtual-admin.service';

@Component({
  selector: 'argo-portal-landing-editor',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './portal-landing-editor.component.html',
  styleUrl: './portal-landing-editor.component.scss',
})
export class PortalLandingEditorComponent {
  @Input({ required: true }) landing!: PortalLandingConfig;
  @Output() portalConfigUpdated = new EventEmitter<PortalAulaConfig>();
  @Output() avNotice = new EventEmitter<{ message: string; error?: boolean }>();

  bloque = signal<string | null>('general');

  toggleBloque(id: string) {
    this.bloque.update((actual) => (actual === id ? null : id));
  }

  restaurarDefaults() {
    Object.assign(this.landing, mergePortalLanding(PORTAL_LANDING_DEFAULTS));
  }

  addOferta() {
    this.landing.ofertas.items.push({ icon: '💻', title: '', text: '' });
  }

  removeOferta(i: number) {
    this.landing.ofertas.items.splice(i, 1);
  }

  addBeneficio() {
    this.landing.beneficios.items.push({ icon: '✅', title: '', text: '' });
  }

  removeBeneficio(i: number) {
    this.landing.beneficios.items.splice(i, 1);
  }

  addServicio() {
    this.landing.servicios.items.push({ icon: '📋', title: '', url: '' });
  }

  removeServicio(i: number) {
    this.landing.servicios.items.splice(i, 1);
  }

  addValor() {
    this.landing.valores.items.push({ title: '', text: '' });
  }

  removeValor(i: number) {
    this.landing.valores.items.splice(i, 1);
  }

  addTestimonio() {
    this.landing.testimonios.items.push({ nombre: '', rol: '', texto: '' });
  }

  removeTestimonio(i: number) {
    this.landing.testimonios.items.splice(i, 1);
  }

  addPaso() {
    const n = String(this.landing.pasos.items.length + 1);
    this.landing.pasos.items.push({ paso: n, title: '', text: '' });
  }

  removePaso(i: number) {
    this.landing.pasos.items.splice(i, 1);
  }

  addAppMobileFeature() {
    this.landing.appMobile.features.push({ icon: '📱', title: '', text: '' });
  }

  removeAppMobileFeature(i: number) {
    this.landing.appMobile.features.splice(i, 1);
  }

  addFaq() {
    this.landing.faq.items.push({ pregunta: '', respuesta: '' });
  }

  removeFaq(i: number) {
    this.landing.faq.items.splice(i, 1);
  }

  addCarrera() {
    this.landing.carreras.items.push({
      titulo: '',
      cno: '',
      horas: 0,
      semestres: 1,
      jornadas: '',
    });
  }

  removeCarrera(i: number) {
    this.landing.carreras.items.splice(i, 1);
  }

  addPilar(tipo: 'capacitacion' | 'campanas') {
    this.landing.pilares[tipo].push('');
  }

  removePilar(tipo: 'capacitacion' | 'campanas', i: number) {
    this.landing.pilares[tipo].splice(i, 1);
  }

  addFooterServicio() {
    this.landing.footerServicios.push('');
  }

  removeFooterServicio(i: number) {
    this.landing.footerServicios.splice(i, 1);
  }
}
