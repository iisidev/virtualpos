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
            <i class="shield alternate icon" aria-hidden="true"></i>
          </div>
          <h2>CORP-CREDIT POS</h2>
          <p>Ingreso Seguro a la Plataforma Transaccional</p>
        </div>

        <div *ngIf="errorMessage" class="ui negative message login-error-alert">
          <div class="header">Error de Acceso</div>
          <p>{{ errorMessage }}</p>
        </div>

        <form (ngSubmit)="onSubmit()" class="login-form">
          <div class="form-group">
            <label>Usuario</label>
            <div class="input-icon-wrapper">
              <i class="user outline icon" aria-hidden="true"></i>
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
              <i class="lock icon" aria-hidden="true"></i>
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
            <span *ngIf="!loading">Ingresar al Sistema <i class="arrow right icon" aria-hidden="true"></i></span>
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
  styleUrl: './login.component.css',
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

    this.auth.login(this.username.trim(), this.password).subscribe({
      next: () => {
        this.loading = false;
        this.router.navigate(['/pos']);
      },
      error: (err) => {
        this.loading = false;
        if (err.status === 0) {
          this.errorMessage = 'No se pudo conectar con el servidor backend (HTTP 0). Verifique que el servicio corpcredit-api esté iniciado en el puerto 22300.';
        } else {
          this.errorMessage = err.error?.message || 'Usuario o contraseña inválidos';
        }
      },
    });
  }
}

