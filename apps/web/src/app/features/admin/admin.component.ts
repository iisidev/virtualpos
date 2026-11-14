import { Component, HostListener, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Observable } from 'rxjs';
import { AdminService } from '../../core/services/admin.service';
import { StatusBannerComponent } from '../../shared/status-banner.component';
import {
  formatCatalogCategoryLabel,
  formatCompanyStatusLabel,
  formatRoleLabel,
} from '../../shared/ui-labels';
import {
  Company,
  CreateCompanyPayload,
  UpdateCompanyPayload,
  AdminUser,
  CreateUserPayload,
  UpdateUserPayload,
  UserRole,
  CatalogItem,
  CatalogCategory,
  CreateCatalogPayload,
  UpdateCatalogPayload,
} from '../../core/models';

type AdminTab = 'companies' | 'users' | 'catalogs';

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [CommonModule, FormsModule, StatusBannerComponent],
  template: `
    <div class="admin-page">
      <!-- Bento Header -->
      <div class="bento-card admin-header">
        <div class="header-info">
          <h1><i class="cogs icon" aria-hidden="true"></i> Panel de Administración Central</h1>
          <p>Gestión multi-empresa, control de acceso basado en roles (RBAC) y catálogos maestros</p>
        </div>

        <!-- Bento Tabs -->
        <div class="tab-pills" role="tablist" aria-label="Secciones de administración">
          <button
            type="button"
            role="tab"
            [attr.aria-selected]="activeTab === 'companies'"
            class="tab-btn"
            [class.active]="activeTab === 'companies'"
            (click)="setTab('companies')"
          >
            <i class="building icon" aria-hidden="true"></i> Empresas ({{ companies.length }})
          </button>
          <button
            type="button"
            role="tab"
            [attr.aria-selected]="activeTab === 'users'"
            class="tab-btn"
            [class.active]="activeTab === 'users'"
            (click)="setTab('users')"
          >
            <i class="users icon" aria-hidden="true"></i> Usuarios y Roles ({{ users.length }})
          </button>
          <button
            type="button"
            role="tab"
            [attr.aria-selected]="activeTab === 'catalogs'"
            class="tab-btn"
            [class.active]="activeTab === 'catalogs'"
            (click)="setTab('catalogs')"
          >
            <i class="tags icon" aria-hidden="true"></i> Catálogos Maestros ({{ catalogs.length }})
          </button>
        </div>
      </div>

      <app-status-banner
        [message]="feedbackMessage"
        [type]="feedbackType"
        (dismiss)="feedbackMessage = ''"
      ></app-status-banner>

      <!-- Pestaña de empresas -->
      <div *ngIf="activeTab === 'companies'" class="tab-content">
        <!-- Stats Ribbon -->
        <div class="bento-grid stats-grid">
          <div class="bento-card stat-item">
            <span class="stat-label">Total Empresas</span>
            <span class="stat-value">{{ companies.length }}</span>
          </div>
          <div class="bento-card stat-item">
            <span class="stat-label">Empresas Empleadoras</span>
            <span class="stat-value text-emerald">{{ employerCount }}</span>
          </div>
          <div class="bento-card stat-item">
            <span class="stat-label">Comercios Afiliados (POS)</span>
            <span class="stat-value text-accent">{{ merchantCount }}</span>
          </div>
        </div>

        <!-- Action Bar -->
        <div class="bento-card action-bar">
          <div class="search-box">
            <i class="search icon" aria-hidden="true"></i>
            <label for="admin-search-company" class="sr-only">Buscar empresa por razón social, código o RUC</label>
            <input
              id="admin-search-company"
              type="text"
              placeholder="Buscar por razón social, código o RUC..."
              [(ngModel)]="searchCompany"
            />
          </div>
          <button type="button" class="ui-btn primary-btn" (click)="openCompanyModal()">
            <i class="plus icon" aria-hidden="true"></i> Registrar Empresa
          </button>
        </div>

        <!-- Table -->
        <div class="bento-card table-card">
          <div *ngIf="loadingCompanies && companies.length === 0" class="ui-state-box" role="status">
            <i class="spinner loading icon" aria-hidden="true"></i>
            <span>Cargando empresas registradas...</span>
          </div>
          <div *ngIf="errorCompanies && companies.length === 0" class="ui-banner error" role="alert">
            <span class="ui-banner-msg">
              <i class="exclamation triangle icon" aria-hidden="true"></i> {{ errorCompanies }}
            </span>
            <button type="button" class="ui-btn primary-btn" (click)="loadCompanies()">Reintentar</button>
          </div>
          <div *ngIf="!errorCompanies && (companies.length > 0 || !loadingCompanies)" class="table-responsive">
            <table class="ui-table">
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Razón Social / Nombre</th>
                  <th>RUC</th>
                  <th>Teléfono</th>
                  <th>Tipo</th>
                  <th>Cajas POS</th>
                  <th>Estado</th>
                  <th class="text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                <tr *ngFor="let c of filteredCompanies">
                  <td><strong class="ui-mono">{{ c.code }}</strong></td>
                  <td>
                    <div class="main-name">{{ c.name }}</div>
                    <div class="sub-detail">{{ c.address || 'Sin dirección registrada' }}</div>
                  </td>
                  <td><code>{{ c.ruc }}</code></td>
                  <td class="ui-mono">{{ c.phone || 'N/A' }}</td>
                  <td>
                    <span *ngIf="c.is_employer" class="badge badge-employer">Empleadora</span>
                    <span *ngIf="c.is_merchant" class="badge badge-merchant">Comercio</span>
                  </td>
                  <td>
                    <span class="badge badge-subtle">{{ c.cash_registers?.length || 0 }} caja(s)</span>
                  </td>
                  <td>
                    <span class="badge-status" [class.active]="c.status === 'ACTIVE'" [class.blocked]="c.status !== 'ACTIVE'">
                      {{ formatCompanyStatusLabel(c.status) }}
                    </span>
                  </td>
                  <td class="text-right">
                    <button
                      type="button"
                      class="icon-btn"
                      (click)="openCompanyModal(c)"
                      title="Editar"
                      [attr.aria-label]="'Editar empresa ' + c.name"
                    >
                      <i class="edit outline icon" aria-hidden="true"></i>
                    </button>
                    <button
                      type="button"
                      class="icon-btn"
                      [title]="c.status === 'ACTIVE' ? 'Desactivar' : 'Activar'"
                      [attr.aria-label]="(c.status === 'ACTIVE' ? 'Desactivar ' : 'Activar ') + c.name"
                      (click)="toggleCompanyStatus(c)"
                    >
                      <i
                        class="power off icon"
                        [ngClass]="c.status === 'ACTIVE' ? 'ui-credit-danger' : 'ui-credit-ok'"
                        aria-hidden="true"
                      ></i>
                    </button>
                  </td>
                </tr>
                <tr *ngIf="filteredCompanies.length === 0">
                  <td colspan="8" class="empty-state">
                    <div>No se encontraron empresas registradas.</div>
                    <button
                      *ngIf="searchCompany"
                      type="button"
                      class="ui-btn secondary-btn empty-reset-btn"
                      (click)="searchCompany = ''"
                    >
                      Limpiar búsqueda
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- Pestaña de usuarios y roles -->
      <div *ngIf="activeTab === 'users'" class="tab-content">
        <!-- Stats Ribbon -->
        <div class="bento-grid stats-grid">
          <div class="bento-card stat-item">
            <span class="stat-label">Total Usuarios</span>
            <span class="stat-value">{{ users.length }}</span>
          </div>
          <div class="bento-card stat-item">
            <span class="stat-label">Super Admins</span>
            <span class="stat-value text-red">{{ countRole('SUPER_ADMIN') }}</span>
          </div>
          <div class="bento-card stat-item">
            <span class="stat-label">Analistas de Crédito</span>
            <span class="stat-value text-amber">{{ countRole('CREDIT_MANAGER') }}</span>
          </div>
          <div class="bento-card stat-item">
            <span class="stat-label">Cajeros POS</span>
            <span class="stat-value text-emerald">{{ countRole('CASHIER') }}</span>
          </div>
        </div>

        <!-- Action Bar -->
        <div class="bento-card action-bar">
          <div class="search-box">
            <i class="search icon" aria-hidden="true"></i>
            <label for="admin-search-user" class="sr-only">Buscar usuario por cuenta o nombre completo</label>
            <input
              id="admin-search-user"
              type="text"
              placeholder="Buscar por usuario o nombre completo..."
              [(ngModel)]="searchUser"
            />
          </div>
          <button type="button" class="ui-btn primary-btn" (click)="openUserModal()">
            <i class="user plus icon" aria-hidden="true"></i> Crear Usuario
          </button>
        </div>

        <!-- Table -->
        <div class="bento-card table-card">
          <div *ngIf="loadingUsers && users.length === 0" class="ui-state-box" role="status">
            <i class="spinner loading icon" aria-hidden="true"></i>
            <span>Cargando usuarios del sistema...</span>
          </div>
          <div *ngIf="errorUsers && users.length === 0" class="ui-banner error" role="alert">
            <span class="ui-banner-msg">
              <i class="exclamation triangle icon" aria-hidden="true"></i> {{ errorUsers }}
            </span>
            <button type="button" class="ui-btn primary-btn" (click)="loadUsers()">Reintentar</button>
          </div>
          <div *ngIf="!errorUsers && (users.length > 0 || !loadingUsers)" class="table-responsive">
            <table class="ui-table">
              <thead>
                <tr>
                  <th>Usuario</th>
                  <th>Nombre Completo</th>
                  <th>Rol Asignado</th>
                  <th>Empresa Asignada</th>
                  <th>Fecha Alta</th>
                  <th>Estado</th>
                  <th class="text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                <tr *ngFor="let u of filteredUsers">
                  <td><code>&#64;{{ u.username }}</code></td>
                  <td><strong>{{ u.full_name }}</strong></td>
                  <td>
                    <span class="role-badge" [ngClass]="getRoleBadgeClass(u.role)">
                      {{ formatRoleLabel(u.role) }}
                    </span>
                  </td>
                  <td>{{ u.company_name || 'Acceso Global / Grupo' }}</td>
                  <td class="ui-mono">{{ u.created_at | date: 'dd/MM/yyyy' }}</td>
                  <td>
                    <span class="badge-status" [class.active]="u.is_active" [class.blocked]="!u.is_active">
                      {{ u.is_active ? 'Activo' : 'Inactivo' }}
                    </span>
                  </td>
                  <td class="text-right">
                    <button
                      type="button"
                      class="icon-btn"
                      (click)="openUserModal(u)"
                      title="Editar / Cambiar Clave"
                      [attr.aria-label]="'Editar usuario ' + u.full_name"
                    >
                      <i class="edit outline icon" aria-hidden="true"></i>
                    </button>
                    <button
                      type="button"
                      class="icon-btn"
                      [title]="u.is_active ? 'Desactivar' : 'Activar'"
                      [attr.aria-label]="(u.is_active ? 'Desactivar ' : 'Activar ') + u.full_name"
                      (click)="toggleUserStatus(u)"
                    >
                      <i
                        class="power off icon"
                        [ngClass]="u.is_active ? 'ui-credit-danger' : 'ui-credit-ok'"
                        aria-hidden="true"
                      ></i>
                    </button>
                  </td>
                </tr>
                <tr *ngIf="filteredUsers.length === 0">
                  <td colspan="7" class="empty-state">
                    <div>No se encontraron usuarios.</div>
                    <button
                      *ngIf="searchUser"
                      type="button"
                      class="ui-btn secondary-btn empty-reset-btn"
                      (click)="searchUser = ''"
                    >
                      Limpiar búsqueda
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- Pestaña de catálogos maestros -->
      <div *ngIf="activeTab === 'catalogs'" class="tab-content">
        <!-- Sub Category Filter Pills -->
        <div class="bento-card action-bar">
          <div class="catalog-subtabs">
            <button
              type="button"
              class="subtab-btn"
              [class.active]="selectedCatalogCategory === ''"
              (click)="filterCategory('')"
            >
              Todos ({{ catalogs.length }})
            </button>
            <button
              type="button"
              class="subtab-btn"
              [class.active]="selectedCatalogCategory === 'JOB_TITLE'"
              (click)="filterCategory('JOB_TITLE')"
            >
              Cargos / Puestos ({{ countCatalogCat('JOB_TITLE') }})
            </button>
            <button
              type="button"
              class="subtab-btn"
              [class.active]="selectedCatalogCategory === 'GRADE_LEVEL'"
              (click)="filterCategory('GRADE_LEVEL')"
            >
              Grados Salariales ({{ countCatalogCat('GRADE_LEVEL') }})
            </button>
            <button
              type="button"
              class="subtab-btn"
              [class.active]="selectedCatalogCategory === 'CLASSIFICATION'"
              (click)="filterCategory('CLASSIFICATION')"
            >
              Tipificaciones ({{ countCatalogCat('CLASSIFICATION') }})
            </button>
          </div>

          <button type="button" class="ui-btn primary-btn" (click)="openCatalogModal()">
            <i class="plus icon" aria-hidden="true"></i> Nuevo Elemento
          </button>
        </div>

        <!-- Table -->
        <div class="bento-card table-card">
          <div *ngIf="loadingCatalogs && catalogs.length === 0" class="ui-state-box" role="status">
            <i class="spinner loading icon" aria-hidden="true"></i>
            <span>Cargando catálogos maestros...</span>
          </div>
          <div *ngIf="errorCatalogs && catalogs.length === 0" class="ui-banner error" role="alert">
            <span class="ui-banner-msg">
              <i class="exclamation triangle icon" aria-hidden="true"></i> {{ errorCatalogs }}
            </span>
            <button type="button" class="ui-btn primary-btn" (click)="loadCatalogs()">Reintentar</button>
          </div>
          <div *ngIf="!errorCatalogs && (catalogs.length > 0 || !loadingCatalogs)" class="table-responsive">
            <table class="ui-table">
              <thead>
                <tr>
                  <th>Categoría</th>
                  <th>Código</th>
                  <th>Nombre / Cargo / Grado</th>
                  <th>Descripción</th>
                  <th>Orden</th>
                  <th>Estado</th>
                  <th class="text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                <tr *ngFor="let cat of filteredCatalogs">
                  <td>
                    <span class="badge" [ngClass]="getCatalogCategoryClass(cat.category)">
                      {{ formatCatalogCategoryLabel(cat.category) }}
                    </span>
                  </td>
                  <td><code>{{ cat.code }}</code></td>
                  <td><strong>{{ cat.name }}</strong></td>
                  <td>{{ cat.description || '-' }}</td>
                  <td>{{ cat.order_index }}</td>
                  <td>
                    <span class="badge-status" [class.active]="cat.is_active" [class.blocked]="!cat.is_active">
                      {{ cat.is_active ? 'Activo' : 'Inactivo' }}
                    </span>
                  </td>
                  <td class="text-right">
                    <button
                      type="button"
                      class="icon-btn"
                      (click)="openCatalogModal(cat)"
                      title="Editar"
                      [attr.aria-label]="'Editar catálogo ' + cat.name"
                    >
                      <i class="edit outline icon" aria-hidden="true"></i>
                    </button>
                    <button
                      type="button"
                      class="icon-btn"
                      [title]="cat.is_active ? 'Desactivar' : 'Activar'"
                      [attr.aria-label]="(cat.is_active ? 'Desactivar ' : 'Activar ') + cat.name"
                      (click)="toggleCatalogStatus(cat)"
                    >
                      <i
                        class="power off icon"
                        [ngClass]="cat.is_active ? 'ui-credit-danger' : 'ui-credit-ok'"
                        aria-hidden="true"
                      ></i>
                    </button>
                  </td>
                </tr>
                <tr *ngIf="filteredCatalogs.length === 0">
                  <td colspan="7" class="empty-state">No hay elementos en esta categoría.</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- Modal empresa -->
      <div
        *ngIf="showCompanyModal"
        class="modal-backdrop"
        role="dialog"
        aria-modal="true"
        aria-labelledby="company-modal-title"
        (click)="!savingCompany && closeCompanyModal()"
      >
        <div class="bento-card modal-content" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h2 id="company-modal-title">{{ editingCompanyId ? 'Editar Empresa' : 'Registrar Nueva Empresa' }}</h2>
            <button type="button" class="close-btn" aria-label="Cerrar ventana" (click)="closeCompanyModal()">&times;</button>
          </div>

          <div *ngIf="modalError" class="ui-banner error modal-error-banner" role="alert">
            <span class="ui-banner-msg"><i class="exclamation circle icon" aria-hidden="true"></i> {{ modalError }}</span>
          </div>

          <form (ngSubmit)="saveCompany()" class="modal-form">
            <div class="form-row">
              <div class="form-group flex-1">
                <label for="company-code">Código Único *</label>
                <input
                  id="company-code"
                  type="text"
                  class="form-input"
                  [(ngModel)]="companyForm.code"
                  name="code"
                  placeholder="ej. EMP-02"
                  required
                />
              </div>
              <div class="form-group flex-2">
                <label for="company-name">Razón Social / Nombre *</label>
                <input
                  id="company-name"
                  type="text"
                  class="form-input"
                  [(ngModel)]="companyForm.name"
                  name="name"
                  placeholder="ej. Distribuidora del Norte S.A."
                  required
                />
              </div>
            </div>

            <div class="form-row">
              <div class="form-group flex-1">
                <label for="company-ruc">RUC Corporativo *</label>
                <input
                  id="company-ruc"
                  type="text"
                  class="form-input"
                  [(ngModel)]="companyForm.ruc"
                  name="ruc"
                  placeholder="ej. J0310000003033"
                  required
                />
              </div>
              <div class="form-group flex-1">
                <label for="company-phone">Teléfono</label>
                <input
                  id="company-phone"
                  type="text"
                  class="form-input"
                  [(ngModel)]="companyForm.phone"
                  name="phone"
                  placeholder="+505 2244-0000"
                />
              </div>
            </div>

            <div class="form-group">
              <label for="company-address">Dirección</label>
              <textarea
                id="company-address"
                class="form-input"
                rows="2"
                [(ngModel)]="companyForm.address"
                name="address"
                placeholder="Dirección física o sede corporativa..."
              ></textarea>
            </div>

            <div class="form-row checkboxes">
              <label class="checkbox-label" for="company-is-employer">
                <input
                  id="company-is-employer"
                  type="checkbox"
                  [(ngModel)]="companyForm.is_employer"
                  name="is_employer"
                />
                <span><strong>Empresa Empleadora</strong> (sus colaboradores reciben crédito)</span>
              </label>

              <label class="checkbox-label" for="company-is-merchant">
                <input
                  id="company-is-merchant"
                  type="checkbox"
                  [(ngModel)]="companyForm.is_merchant"
                  name="is_merchant"
                />
                <span><strong>Comercio Afiliado</strong> (acepta cobros mediante Terminal POS)</span>
              </label>
            </div>

            <div class="modal-actions">
              <button type="button" class="ui-btn secondary-btn" (click)="closeCompanyModal()" [disabled]="savingCompany">
                Cancelar
              </button>
              <button type="submit" class="ui-btn primary-btn" [disabled]="savingCompany">
                <i class="save icon" *ngIf="!savingCompany" aria-hidden="true"></i>
                {{ savingCompany ? 'Guardando...' : (editingCompanyId ? 'Actualizar' : 'Guardar Empresa') }}
              </button>
            </div>
          </form>
        </div>
      </div>

      <!-- Modal usuario -->
      <div
        *ngIf="showUserModal"
        class="modal-backdrop"
        role="dialog"
        aria-modal="true"
        aria-labelledby="user-modal-title"
        (click)="!savingUser && closeUserModal()"
      >
        <div class="bento-card modal-content" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h2 id="user-modal-title">{{ editingUserId ? 'Editar Usuario' : 'Crear Nuevo Usuario' }}</h2>
            <button type="button" class="close-btn" aria-label="Cerrar ventana" (click)="closeUserModal()">&times;</button>
          </div>

          <div *ngIf="modalError" class="ui-banner error modal-error-banner" role="alert">
            <span class="ui-banner-msg"><i class="exclamation circle icon" aria-hidden="true"></i> {{ modalError }}</span>
          </div>

          <form (ngSubmit)="saveUser()" class="modal-form">
            <div class="form-row">
              <div class="form-group flex-1">
                <label for="user-username">Nombre de Usuario (Login) *</label>
                <input
                  id="user-username"
                  type="text"
                  class="form-input"
                  [(ngModel)]="userForm.username"
                  name="username"
                  placeholder="ej. cajero2"
                  required
                />
              </div>
              <div class="form-group flex-1">
                <label for="user-password">Contraseña {{ editingUserId ? '(dejar vacío para no cambiar)' : '*' }}</label>
                <input
                  id="user-password"
                  type="password"
                  class="form-input"
                  [(ngModel)]="userForm.password"
                  name="password"
                  placeholder="Mínimo 6 caracteres"
                  [required]="!editingUserId"
                />
              </div>
            </div>

            <div class="form-group">
              <label for="user-fullname">Nombre Completo *</label>
              <input
                id="user-fullname"
                type="text"
                class="form-input"
                [(ngModel)]="userForm.full_name"
                name="full_name"
                placeholder="ej. Carlos Eduardo López"
                required
              />
            </div>

            <div class="form-row">
              <div class="form-group flex-1">
                <label for="user-role">Rol de Sistema *</label>
                <select id="user-role" class="form-input" [(ngModel)]="userForm.role" name="role" required>
                  <option value="SUPER_ADMIN">Super Administrador (Control Total)</option>
                  <option value="CREDIT_MANAGER">Gestor de Crédito (Analista)</option>
                  <option value="CASHIER">Cajero POS (Operador de Caja)</option>
                  <option value="AUDITOR">Auditor (Solo Lectura)</option>
                </select>
              </div>

              <div class="form-group flex-1">
                <label for="user-company">Empresa Asignada</label>
                <select id="user-company" class="form-input" [(ngModel)]="userForm.company_id" name="company_id">
                  <option [ngValue]="null">-- Acceso Global (Sin restricción) --</option>
                  <option *ngFor="let comp of companies" [value]="comp.id">
                    {{ comp.name }} ({{ comp.code }})
                  </option>
                </select>
              </div>
            </div>

            <div class="modal-actions">
              <button type="button" class="ui-btn secondary-btn" (click)="closeUserModal()" [disabled]="savingUser">
                Cancelar
              </button>
              <button type="submit" class="ui-btn primary-btn" [disabled]="savingUser">
                <i class="save icon" *ngIf="!savingUser" aria-hidden="true"></i>
                {{ savingUser ? 'Guardando...' : (editingUserId ? 'Actualizar Usuario' : 'Crear Usuario') }}
              </button>
            </div>
          </form>
        </div>
      </div>

      <!-- Modal catálogo -->
      <div
        *ngIf="showCatalogModal"
        class="modal-backdrop"
        role="dialog"
        aria-modal="true"
        aria-labelledby="catalog-modal-title"
        (click)="!savingCatalog && closeCatalogModal()"
      >
        <div class="bento-card modal-content" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h2 id="catalog-modal-title">{{ editingCatalogId ? 'Editar Catálogo' : 'Nuevo Elemento de Catálogo' }}</h2>
            <button type="button" class="close-btn" aria-label="Cerrar ventana" (click)="closeCatalogModal()">&times;</button>
          </div>

          <div *ngIf="modalError" class="ui-banner error modal-error-banner" role="alert">
            <span class="ui-banner-msg"><i class="exclamation circle icon" aria-hidden="true"></i> {{ modalError }}</span>
          </div>

          <form (ngSubmit)="saveCatalog()" class="modal-form">
            <div class="form-row">
              <div class="form-group flex-1">
                <label for="catalog-category">Categoría *</label>
                <select
                  id="catalog-category"
                  class="form-input"
                  [(ngModel)]="catalogForm.category"
                  name="category"
                  [disabled]="!!editingCatalogId"
                  required
                >
                  <option value="JOB_TITLE">Cargo / Puesto de Trabajo</option>
                  <option value="GRADE_LEVEL">Grado Salarial</option>
                  <option value="CLASSIFICATION">Tipificación de Cliente</option>
                </select>
              </div>

              <div class="form-group flex-1">
                <label for="catalog-code">Código Identificador *</label>
                <input
                  id="catalog-code"
                  type="text"
                  class="form-input"
                  [(ngModel)]="catalogForm.code"
                  name="code"
                  placeholder="ej. CARG-09 o GRD-7"
                  required
                />
              </div>
            </div>

            <div class="form-group">
              <label for="catalog-name">Nombre / Título *</label>
              <input
                id="catalog-name"
                type="text"
                class="form-input"
                [(ngModel)]="catalogForm.name"
                name="name"
                placeholder="ej. Coordinador de Logística"
                required
              />
            </div>

            <div class="form-group">
              <label for="catalog-description">Descripción / Alcance</label>
              <textarea
                id="catalog-description"
                class="form-input"
                rows="2"
                [(ngModel)]="catalogForm.description"
                name="description"
                placeholder="Descripción informativa del catálogo..."
              ></textarea>
            </div>

            <div class="form-group catalog-order-group">
              <label for="catalog-order">Orden Visual</label>
              <input
                id="catalog-order"
                type="number"
                class="form-input"
                [(ngModel)]="catalogForm.order_index"
                name="order_index"
              />
            </div>

            <div class="modal-actions">
              <button type="button" class="ui-btn secondary-btn" (click)="closeCatalogModal()" [disabled]="savingCatalog">
                Cancelar
              </button>
              <button type="submit" class="ui-btn primary-btn" [disabled]="savingCatalog">
                <i class="save icon" *ngIf="!savingCatalog" aria-hidden="true"></i>
                {{ savingCatalog ? 'Guardando...' : (editingCatalogId ? 'Actualizar' : 'Guardar') }}
              </button>
            </div>
          </form>
        </div>
      </div>

      <!-- Modal confirmar cambio de estado -->
      <div
        *ngIf="pendingStatusConfirm"
        class="modal-backdrop"
        role="dialog"
        aria-modal="true"
        aria-labelledby="admin-confirm-title"
        (click)="!confirmingStatus && closeStatusConfirm()"
      >
        <div class="bento-card modal-content" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h2 id="admin-confirm-title">Confirmar Cambio de Estado</h2>
            <button type="button" class="close-btn" aria-label="Cerrar ventana" (click)="closeStatusConfirm()">&times;</button>
          </div>

          <p class="sub-detail">{{ pendingStatusConfirm.summary }}</p>

          <div class="modal-actions">
            <button type="button" class="ui-btn secondary-btn" (click)="closeStatusConfirm()" [disabled]="confirmingStatus">
              Cancelar
            </button>
            <button type="button" class="ui-btn primary-btn" (click)="executeStatusToggle()" [disabled]="confirmingStatus">
              <i class="check icon" *ngIf="!confirmingStatus" aria-hidden="true"></i>
              {{ confirmingStatus ? 'Aplicando...' : 'Confirmar' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  `,
  styleUrl: './admin.component.css',
})
export class AdminComponent implements OnInit {
  private readonly adminService = inject(AdminService);
  readonly formatCatalogCategoryLabel = formatCatalogCategoryLabel;
  readonly formatCompanyStatusLabel = formatCompanyStatusLabel;
  readonly formatRoleLabel = formatRoleLabel;

  activeTab: AdminTab = 'companies';

  // Data
  companies: Company[] = [];
  users: AdminUser[] = [];
  catalogs: CatalogItem[] = [];

  // Search/Filters
  searchCompany = '';
  searchUser = '';
  selectedCatalogCategory: string = '';

  // Modals state
  loadingCompanies = false;
  loadingUsers = false;
  loadingCatalogs = false;
  errorCompanies = '';
  errorUsers = '';
  errorCatalogs = '';
  feedbackMessage = '';
  feedbackType: 'success' | 'error' = 'success';
  modalError = '';

  pendingStatusConfirm: {
    kind: 'company' | 'user' | 'catalog';
    id: string;
    summary: string;
  } | null = null;
  confirmingStatus = false;

  showCompanyModal = false;
  editingCompanyId: string | null = null;
  savingCompany = false;
  companyForm: CreateCompanyPayload = {
    code: '',
    name: '',
    ruc: '',
    address: '',
    phone: '',
    is_employer: true,
    is_merchant: false,
  };

  showUserModal = false;
  editingUserId: string | null = null;
  savingUser = false;
  userForm: CreateUserPayload = {
    username: '',
    password: '',
    full_name: '',
    role: UserRole.CASHIER,
    company_id: null,
  };

  showCatalogModal = false;
  editingCatalogId: string | null = null;
  savingCatalog = false;
  catalogForm: CreateCatalogPayload = {
    category: CatalogCategory.JOB_TITLE,
    code: '',
    name: '',
    description: '',
    order_index: 0,
  };

  ngOnInit(): void {
    this.loadCompanies();
    this.loadUsers();
    this.loadCatalogs();
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.pendingStatusConfirm && !this.confirmingStatus) {
      this.closeStatusConfirm();
    } else if (this.showCompanyModal && !this.savingCompany) {
      this.closeCompanyModal();
    } else if (this.showUserModal && !this.savingUser) {
      this.closeUserModal();
    } else if (this.showCatalogModal && !this.savingCatalog) {
      this.closeCatalogModal();
    }
  }

  setTab(tab: AdminTab): void {
    this.activeTab = tab;
  }

  loadCompanies(): void {
    this.loadingCompanies = true;
    this.errorCompanies = '';
    this.adminService.getCompanies().subscribe({
      next: (data) => {
        this.companies = data;
        this.loadingCompanies = false;
      },
      error: (err) => {
        this.loadingCompanies = false;
        this.errorCompanies = err.error?.message || 'Error cargando empresas.';
      },
    });
  }

  get employerCount(): number {
    return this.companies.filter((c) => c.is_employer).length;
  }

  get merchantCount(): number {
    return this.companies.filter((c) => c.is_merchant).length;
  }

  get filteredCompanies(): Company[] {
    const term = this.searchCompany.toLowerCase().trim();
    if (!term) return this.companies;
    return this.companies.filter(
      (c) =>
        c.name.toLowerCase().includes(term) ||
        c.code.toLowerCase().includes(term) ||
        c.ruc.toLowerCase().includes(term),
    );
  }

  openCompanyModal(company?: Company): void {
    if (company) {
      this.editingCompanyId = company.id;
      this.companyForm = {
        code: company.code,
        name: company.name,
        ruc: company.ruc,
        address: company.address,
        phone: company.phone,
        is_employer: company.is_employer,
        is_merchant: company.is_merchant,
      };
    } else {
      this.editingCompanyId = null;
      this.companyForm = {
        code: '',
        name: '',
        ruc: '',
        address: '',
        phone: '',
        is_employer: true,
        is_merchant: false,
      };
    }
    this.modalError = '';
    this.showCompanyModal = true;
  }

  closeCompanyModal(): void {
    this.showCompanyModal = false;
    this.editingCompanyId = null;
    this.modalError = '';
  }

  saveCompany(): void {
    if (!this.companyForm.code || !this.companyForm.name || !this.companyForm.ruc) {
      this.modalError = 'Por favor complete todos los campos obligatorios (*).';
      return;
    }

    this.savingCompany = true;
    this.modalError = '';
    if (this.editingCompanyId) {
      this.adminService.updateCompany(this.editingCompanyId, this.companyForm).subscribe({
        next: () => {
          this.savingCompany = false;
          this.closeCompanyModal();
          this.feedbackType = 'success';
          this.feedbackMessage = 'Empresa actualizada correctamente.';
          this.loadCompanies();
        },
        error: (err) => {
          this.savingCompany = false;
          this.modalError = err.error?.message || 'Error al actualizar empresa';
        },
      });
    } else {
      this.adminService.createCompany(this.companyForm).subscribe({
        next: () => {
          this.savingCompany = false;
          this.closeCompanyModal();
          this.feedbackType = 'success';
          this.feedbackMessage = 'Empresa registrada correctamente.';
          this.loadCompanies();
        },
        error: (err) => {
          this.savingCompany = false;
          this.modalError = err.error?.message || 'Error al registrar empresa';
        },
      });
    }
  }

  toggleCompanyStatus(comp: Company): void {
    this.pendingStatusConfirm = {
      kind: 'company',
      id: comp.id,
      summary: `¿Desea cambiar el estado de la empresa ${comp.name}?`,
    };
  }

  loadUsers(): void {
    this.loadingUsers = true;
    this.errorUsers = '';
    this.adminService.getUsers().subscribe({
      next: (data) => {
        this.users = data;
        this.loadingUsers = false;
      },
      error: (err) => {
        this.loadingUsers = false;
        this.errorUsers = err.error?.message || 'Error cargando usuarios.';
      },
    });
  }

  countRole(role: string): number {
    return this.users.filter((u) => u.role === role).length;
  }

  get filteredUsers(): AdminUser[] {
    const term = this.searchUser.toLowerCase().trim();
    if (!term) return this.users;
    return this.users.filter(
      (u) =>
        u.username.toLowerCase().includes(term) ||
        u.full_name.toLowerCase().includes(term),
    );
  }

  getRoleBadgeClass(role: string): string {
    switch (role) {
      case 'SUPER_ADMIN':
        return 'role-admin';
      case 'CREDIT_MANAGER':
        return 'role-manager';
      case 'CASHIER':
        return 'role-cashier';
      default:
        return 'role-auditor';
    }
  }

  openUserModal(user?: AdminUser): void {
    if (user) {
      this.editingUserId = user.id;
      this.userForm = {
        username: user.username,
        password: '',
        full_name: user.full_name,
        role: user.role,
        company_id: user.company_id || null,
      };
    } else {
      this.editingUserId = null;
      this.userForm = {
        username: '',
        password: '',
        full_name: '',
        role: UserRole.CASHIER,
        company_id: null,
      };
    }
    this.modalError = '';
    this.showUserModal = true;
  }

  closeUserModal(): void {
    this.showUserModal = false;
    this.editingUserId = null;
    this.modalError = '';
  }

  saveUser(): void {
    if (!this.userForm.username || !this.userForm.full_name) {
      this.modalError = 'Nombre de usuario y nombre completo son requeridos.';
      return;
    }
    if (!this.editingUserId && !this.userForm.password) {
      this.modalError = 'La contraseña es requerida para nuevos usuarios.';
      return;
    }

    this.savingUser = true;
    this.modalError = '';
    if (this.editingUserId) {
      const payload: UpdateUserPayload = {
        username: this.userForm.username,
        full_name: this.userForm.full_name,
        role: this.userForm.role,
        company_id: this.userForm.company_id,
      };
      if (this.userForm.password && this.userForm.password.trim()) {
        payload.password = this.userForm.password.trim();
      }

      this.adminService.updateUser(this.editingUserId, payload).subscribe({
        next: () => {
          this.savingUser = false;
          this.closeUserModal();
          this.feedbackType = 'success';
          this.feedbackMessage = 'Usuario actualizado correctamente.';
          this.loadUsers();
        },
        error: (err) => {
          this.savingUser = false;
          this.modalError = err.error?.message || 'Error al actualizar usuario';
        },
      });
    } else {
      this.adminService.createUser(this.userForm).subscribe({
        next: () => {
          this.savingUser = false;
          this.closeUserModal();
          this.feedbackType = 'success';
          this.feedbackMessage = 'Usuario creado correctamente.';
          this.loadUsers();
        },
        error: (err) => {
          this.savingUser = false;
          this.modalError = err.error?.message || 'Error al crear usuario';
        },
      });
    }
  }

  toggleUserStatus(user: AdminUser): void {
    this.pendingStatusConfirm = {
      kind: 'user',
      id: user.id,
      summary: `¿Desea cambiar el estado del usuario @${user.username}?`,
    };
  }

  loadCatalogs(): void {
    this.loadingCatalogs = true;
    this.errorCatalogs = '';
    this.adminService.getCatalogs().subscribe({
      next: (data) => {
        this.catalogs = data;
        this.loadingCatalogs = false;
      },
      error: (err) => {
        this.loadingCatalogs = false;
        this.errorCatalogs = err.error?.message || 'Error cargando catálogos.';
      },
    });
  }

  filterCategory(category: string): void {
    this.selectedCatalogCategory = category;
  }

  countCatalogCat(cat: string): number {
    return this.catalogs.filter((c) => c.category === cat).length;
  }

  get filteredCatalogs(): CatalogItem[] {
    if (!this.selectedCatalogCategory) return this.catalogs;
    return this.catalogs.filter((c) => c.category === this.selectedCatalogCategory);
  }

  getCatalogCategoryClass(category: string): string {
    switch (category) {
      case 'JOB_TITLE':
        return 'badge-employer';
      case 'GRADE_LEVEL':
        return 'badge-merchant';
      default:
        return 'badge-subtle';
    }
  }

  openCatalogModal(catalog?: CatalogItem): void {
    if (catalog) {
      this.editingCatalogId = catalog.id;
      this.catalogForm = {
        category: catalog.category,
        code: catalog.code,
        name: catalog.name,
        description: catalog.description,
        order_index: catalog.order_index,
      };
    } else {
      this.editingCatalogId = null;
      const initialCat = (this.selectedCatalogCategory as CatalogCategory) || CatalogCategory.JOB_TITLE;
      this.catalogForm = {
        category: initialCat,
        code: '',
        name: '',
        description: '',
        order_index: this.catalogs.length + 1,
      };
    }
    this.modalError = '';
    this.showCatalogModal = true;
  }

  closeCatalogModal(): void {
    this.showCatalogModal = false;
    this.editingCatalogId = null;
    this.modalError = '';
  }

  saveCatalog(): void {
    if (!this.catalogForm.code || !this.catalogForm.name) {
      this.modalError = 'Código y nombre son obligatorios.';
      return;
    }

    this.savingCatalog = true;
    this.modalError = '';
    if (this.editingCatalogId) {
      const payload: UpdateCatalogPayload = {
        code: this.catalogForm.code,
        name: this.catalogForm.name,
        description: this.catalogForm.description,
        order_index: this.catalogForm.order_index,
      };
      this.adminService.updateCatalog(this.editingCatalogId, payload).subscribe({
        next: () => {
          this.savingCatalog = false;
          this.closeCatalogModal();
          this.feedbackType = 'success';
          this.feedbackMessage = 'Elemento de catálogo actualizado correctamente.';
          this.loadCatalogs();
        },
        error: (err) => {
          this.savingCatalog = false;
          this.modalError = err.error?.message || 'Error al actualizar catálogo';
        },
      });
    } else {
      this.adminService.createCatalog(this.catalogForm).subscribe({
        next: () => {
          this.savingCatalog = false;
          this.closeCatalogModal();
          this.feedbackType = 'success';
          this.feedbackMessage = 'Elemento de catálogo creado correctamente.';
          this.loadCatalogs();
        },
        error: (err) => {
          this.savingCatalog = false;
          this.modalError = err.error?.message || 'Error al crear elemento de catálogo';
        },
      });
    }
  }

  toggleCatalogStatus(cat: CatalogItem): void {
    this.pendingStatusConfirm = {
      kind: 'catalog',
      id: cat.id,
      summary: `¿Desea cambiar el estado de ${cat.name}?`,
    };
  }

  closeStatusConfirm(): void {
    this.pendingStatusConfirm = null;
  }

  executeStatusToggle(): void {
    if (!this.pendingStatusConfirm) return;
    const { kind, id } = this.pendingStatusConfirm;
    this.confirmingStatus = true;

    const req$: Observable<unknown> =
      kind === 'company'
        ? this.adminService.toggleCompanyStatus(id)
        : kind === 'user'
          ? this.adminService.toggleUserStatus(id)
          : this.adminService.toggleCatalogStatus(id);

    req$.subscribe({
      next: () => {
        this.confirmingStatus = false;
        this.closeStatusConfirm();
        this.feedbackType = 'success';
        this.feedbackMessage = 'Estado actualizado correctamente.';
        if (kind === 'company') this.loadCompanies();
        else if (kind === 'user') this.loadUsers();
        else this.loadCatalogs();
      },
      error: (err: { error?: { message?: string } }) => {
        this.confirmingStatus = false;
        this.closeStatusConfirm();
        this.feedbackType = 'error';
        this.feedbackMessage = err.error?.message || 'Error al cambiar estado';
      },
    });
  }
}
