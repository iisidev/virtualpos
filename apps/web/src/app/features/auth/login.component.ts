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
    <main class="login-page">
      <div class="login-card bento-card">
        <div class="login-header">
          <div class="icon-circle" aria-hidden="true">
            <i class="shield alternate icon"></i>
          </div>
          <h1>POS VIRTUAL</h1>
          <p>Ingreso Seguro a la Plataforma Transaccional</p>
        </div>

        <div *ngIf="errorMessage" class="ui negative message login-error-alert" role="alert">
          <div class="header">Error de Acceso</div>
          <p>{{ errorMessage }}</p>
        </div>

        <form (ngSubmit)="onSubmit()" class="login-form">
          <div class="form-group">
            <label for="login-username">Usuario</label>
            <div class="input-icon-wrapper">
              <i class="user outline icon" aria-hidden="true"></i>
              <input
                id="login-username"
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
            <label for="login-password">Contraseña</label>
            <div class="input-icon-wrapper">
              <i class="lock icon" aria-hidden="true"></i>
              <input
                id="login-password"
                type="password"
                [(ngModel)]="password"
                name="password"
                placeholder="Ingrese su contraseña"
                required
                autocomplete="current-password"
              />
            </div>
          </div>

          <button type="submit" class="submit-btn" [disabled]="loading">
            <span *ngIf="!loading">Ingresar al Sistema <i class="arrow right icon" aria-hidden="true"></i></span>
            <span *ngIf="loading"><i class="spinner loading icon" aria-hidden="true"></i> Autenticando...</span>
          </button>
        </form>
      </div>
    </main>
  `,
  styleUrl: './login.component.css',
})
export class LoginComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  username = '';
  password = '';
  loading = false;
  errorMessage = '';

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
          this.errorMessage = 'No se pudo conectar con el servidor backend (HTTP 0). Verifique que la API de POS VIRTUAL esté activa en el puerto 22300.';
        } else {
          this.errorMessage = err.error?.message || 'Usuario o contraseña inválidos';
        }
      },
    });
  }
}

