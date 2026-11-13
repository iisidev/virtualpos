import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="login-page">
      <div class="login-card bento-card">
        <div class="login-header">
          <div class="icon-circle">
            <i class="shield alternate icon"></i>
          </div>
          <h2>CORP-CREDIT POS</h2>
          <p>Ingreso Seguro a la Plataforma Transaccional</p>
        </div>

        <div *ngIf="errorMessage" class="ui negative message" style="padding: 0.75rem 1rem; border-radius: 0.75rem;">
          <div class="header">Error de Acceso</div>
          <p style="font-size: 0.85rem;">{{ errorMessage }}</p>
        </div>

        <form (ngSubmit)="onSubmit()" class="login-form">
          <div class="form-group">
            <label>Usuario</label>
            <div class="input-icon-wrapper">
              <i class="user outline icon"></i>
              <input
                type="text"
                [(ngModel)]="username"
                name="username"
                placeholder="Ej. admin o caja1"
                required
                autocomplete="username"
              />
            </div>
          </div>

          <div class="form-group">
            <label>Contraseña</label>
            <div class="input-icon-wrapper">
              <i class="lock icon"></i>
              <input
                type="password"
                [(ngModel)]="password"
                name="password"
                placeholder="••••••••"
                required
                autocomplete="current-password"
              />
            </div>
          </div>

          <button type="submit" class="submit-btn" [disabled]="loading">
            <span *ngIf="!loading">Ingresar al Sistema <i class="arrow right icon"></i></span>
            <span *ngIf="loading">Autenticando...</span>
          </button>
        </form>

        <!-- Quick Access Demo Users -->
        <div class="demo-accounts">
          <div class="demo-title">Accesos Rápidos Demo:</div>
          <div class="demo-chips">
            <button type="button" class="demo-chip" (click)="fill('caja1', 'caja123')">
              🛒 Cajero
            </button>
            <button type="button" class="demo-chip" (click)="fill('manager', 'manager123')">
              📊 Gerente
            </button>
            <button type="button" class="demo-chip" (click)="fill('admin', 'admin123')">
              👑 Admin
            </button>
            <button type="button" class="demo-chip" (click)="fill('auditor', 'auditor123')">
              ⚖️ Auditor
            </button>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [
    `
      .login-page {
        min-height: 100vh;
        display: flex;
        align-items: center;
        justify-content: center;
        background: radial-gradient(circle at 50% 20%, #1E293B 0%, #0F172A 100%);
        padding: 1.5rem;
      }

      .login-card {
        width: 100%;
        max-width: 440px;
        background: #FFFFFF;
        padding: 2.5rem;
      }

      .login-header {
        text-align: center;
        margin-bottom: 2rem;
      }

      .icon-circle {
        width: 60px;
        height: 60px;
        background-color: var(--navy-900);
        color: var(--emerald-main);
        border-radius: 50%;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        font-size: 1.75rem;
        margin-bottom: 1rem;
        box-shadow: 0 4px 14px rgba(16, 185, 129, 0.25);
      }

      .login-header h2 {
        margin: 0;
        font-weight: 800;
        color: var(--navy-950);
        font-size: 1.5rem;
      }

      .login-header p {
        margin: 0.35rem 0 0;
        color: var(--gray-text);
        font-size: 0.85rem;
      }

      .login-form {
        display: flex;
        flex-direction: column;
        gap: 1.25rem;
      }

      .form-group {
        display: flex;
        flex-direction: column;
        gap: 0.4rem;
      }

      .form-group label {
        font-size: 0.8rem;
        font-weight: 700;
        color: var(--navy-800);
      }

      .input-icon-wrapper {
        position: relative;
        display: flex;
        align-items: center;
      }

      .input-icon-wrapper i.icon {
        position: absolute;
        left: 0.85rem;
        color: var(--gray-text);
      }

      .input-icon-wrapper input {
        width: 100%;
        padding: 0.75rem 0.85rem 0.75rem 2.5rem;
        border: 1px solid var(--gray-border);
        border-radius: 0.75rem;
        font-size: 0.95rem;
        font-family: inherit;
        outline: none;
        transition: border-color 0.15s;
      }

      .input-icon-wrapper input:focus {
        border-color: var(--navy-800);
        box-shadow: 0 0 0 3px rgba(30, 41, 59, 0.1);
      }

      .submit-btn {
        background-color: var(--navy-900);
        color: #FFFFFF;
        border: none;
        padding: 0.85rem;
        border-radius: 0.75rem;
        font-size: 0.95rem;
        font-weight: 700;
        cursor: pointer;
        transition: all 0.15s ease;
        margin-top: 0.5rem;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 0.5rem;
      }

      .submit-btn:hover:not(:disabled) {
        background-color: var(--navy-800);
        transform: translateY(-1px);
      }

      .submit-btn:disabled {
        opacity: 0.7;
        cursor: not-allowed;
      }

      .demo-accounts {
        margin-top: 2rem;
        padding-top: 1.25rem;
        border-top: 1px solid var(--gray-border);
      }

      .demo-title {
        font-size: 0.75rem;
        color: var(--gray-text);
        font-weight: 600;
        margin-bottom: 0.5rem;
        text-align: center;
      }

      .demo-chips {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 0.5rem;
      }

      .demo-chip {
        background: var(--gray-subtle);
        border: 1px solid var(--gray-border);
        border-radius: 0.5rem;
        padding: 0.4rem 0.5rem;
        font-size: 0.75rem;
        font-weight: 600;
        color: var(--navy-800);
        cursor: pointer;
        transition: all 0.15s;
      }

      .demo-chip:hover {
        background: #E2E8F0;
        border-color: #CBD5E1;
      }
    `,
  ],
})
export class LoginComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  username = 'caja1';
  password = 'caja123';
  loading = false;
  errorMessage = '';

  fill(u: string, p: string): void {
    this.username = u;
    this.password = p;
    this.errorMessage = '';
  }

  onSubmit(): void {
    if (!this.username || !this.password) return;
    this.loading = true;
    this.errorMessage = '';

    this.auth.login(this.username, this.password).subscribe({
      next: () => {
        this.loading = false;
        this.router.navigate(['/pos']);
      },
      error: (err) => {
        this.loading = false;
        this.errorMessage = err.error?.message || 'Usuario o contraseña inválidos';
      },
    });
  }
}
