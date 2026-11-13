import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { AuthService } from '../core/services/auth.service';
import { UserRole } from '../core/models';

@Component({
  selector: 'app-main-layout',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="layout-container">
      <!-- Executive Navy Header -->
      <header class="executive-header no-print">
        <div class="header-left">
          <div class="brand-logo">
            <i class="credit card outline icon"></i>
            <div>
              <div class="brand-title">CORP-CREDIT POS</div>
              <div class="brand-subtitle">Plataforma Multi-Empresa de Crédito Corporativo</div>
            </div>
          </div>

          <nav class="nav-links">
            <a routerLink="/pos" routerLinkActive="active" class="nav-item">
              <i class="barcode icon"></i> Terminal POS
            </a>
            <a routerLink="/clients" routerLinkActive="active" class="nav-item" *ngIf="canManageCredit()">
              <i class="users icon"></i> Clientes
            </a>
            <a routerLink="/import-export" routerLinkActive="active" class="nav-item" *ngIf="canManageCredit()">
              <i class="file excel outline icon"></i> Importación Masiva
            </a>
            <a routerLink="/credit-requests" routerLinkActive="active" class="nav-item" *ngIf="canManageCredit()">
              <i class="chart line icon"></i> Solicitudes Límite
            </a>
            <a routerLink="/kiosk" target="_blank" class="nav-item kiosk-link">
              <i class="tablet alternate icon"></i> Kiosco Tótem
            </a>
          </nav>
        </div>

        <div class="header-right">
          <div class="terminal-badge">
            <span class="pulse-dot"></span>
            <span>CAJA: <strong>POS-CAJA-01</strong></span>
          </div>

          <div class="user-pill" *ngIf="auth.currentUser() as user">
            <i class="user circle icon"></i>
            <div class="user-meta">
              <span class="user-name">{{ user.full_name }}</span>
              <span class="role-tag">{{ user.role }}</span>
            </div>
            <button class="logout-btn" (click)="auth.logout()" title="Cerrar Sesión">
              <i class="sign-out alternate icon"></i>
            </button>
          </div>
        </div>
      </header>

      <!-- Main Canvas -->
      <main class="main-canvas">
        <router-outlet></router-outlet>
      </main>
    </div>
  `,
  styles: [
    `
      .layout-container {
        min-height: 100vh;
        display: flex;
        flex-direction: column;
        background-color: var(--gray-canvas);
      }

      .executive-header {
        background-color: var(--navy-900);
        color: #ffffff;
        padding: 0.75rem 2rem;
        display: flex;
        align-items: center;
        justify-content: space-between;
        box-shadow: 0 4px 12px rgba(15, 23, 42, 0.15);
        border-bottom: 1px solid var(--navy-800);
      }

      .header-left,
      .header-right {
        display: flex;
        align-items: center;
        gap: 2rem;
      }

      .brand-logo {
        display: flex;
        align-items: center;
        gap: 0.75rem;
      }

      .brand-logo i.icon {
        font-size: 1.85rem;
        color: var(--emerald-main);
        margin: 0;
      }

      .brand-title {
        font-weight: 800;
        font-size: 1.15rem;
        letter-spacing: 0.04em;
        line-height: 1.1;
      }

      .brand-subtitle {
        font-size: 0.7rem;
        color: #94A3B8;
        font-weight: 500;
      }

      .nav-links {
        display: flex;
        align-items: center;
        gap: 0.5rem;
      }

      .nav-item {
        color: #CBD5E1;
        text-decoration: none;
        padding: 0.5rem 0.85rem;
        border-radius: 0.5rem;
        font-size: 0.85rem;
        font-weight: 600;
        transition: all 0.15s ease;
        display: flex;
        align-items: center;
        gap: 0.4rem;
      }

      .nav-item:hover {
        background-color: var(--navy-800);
        color: #FFFFFF;
      }

      .nav-item.active {
        background-color: var(--navy-800);
        color: var(--emerald-main);
        border-bottom: 2px solid var(--emerald-main);
      }

      .kiosk-link {
        color: #FBBF24;
      }

      .terminal-badge {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        background-color: var(--navy-800);
        padding: 0.35rem 0.75rem;
        border-radius: 0.375rem;
        font-size: 0.8rem;
        color: #E2E8F0;
        border: 1px solid var(--navy-700);
      }

      .pulse-dot {
        width: 8px;
        height: 8px;
        background-color: var(--emerald-main);
        border-radius: 50%;
        display: inline-block;
        box-shadow: 0 0 6px var(--emerald-main);
      }

      .user-pill {
        display: flex;
        align-items: center;
        gap: 0.6rem;
        background-color: var(--navy-800);
        padding: 0.35rem 0.75rem;
        border-radius: 9999px;
        border: 1px solid var(--navy-700);
      }

      .user-meta {
        display: flex;
        flex-direction: column;
        line-height: 1.1;
      }

      .user-name {
        font-size: 0.8rem;
        font-weight: 700;
        color: #FFFFFF;
      }

      .role-tag {
        font-size: 0.65rem;
        color: var(--emerald-main);
        font-weight: 600;
      }

      .logout-btn {
        background: transparent;
        border: none;
        color: #94A3B8;
        cursor: pointer;
        padding: 0.2rem;
        display: flex;
        align-items: center;
        transition: color 0.15s;
      }

      .logout-btn:hover {
        color: #EF4444;
      }

      .main-canvas {
        flex: 1;
        padding: 1.75rem 2rem;
        max-width: 1600px;
        width: 100%;
        margin: 0 auto;
      }
    `,
  ],
})
export class MainLayoutComponent {
  readonly auth = inject(AuthService);

  canManageCredit(): boolean {
    return this.auth.hasRole(UserRole.CREDIT_MANAGER, UserRole.SUPER_ADMIN, UserRole.AUDITOR);
  }
}
