import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminService } from '../../core/services/admin.service';
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
  imports: [CommonModule, FormsModule],
  template: `
    <div class="admin-page">
      <!-- Bento Header -->
      <div class="bento-card admin-header">
        <div class="header-info">
          <h2><i class="cogs icon"></i> Panel de Administración Central</h2>
          <p>Gestión multi-empresa, control de acceso basado en roles (RBAC) y catálogos maestros</p>
        </div>

        <!-- Bento Tabs -->
        <div class="tab-pills">
          <button
            class="tab-btn"
            [class.active]="activeTab === 'companies'"
            (click)="setTab('companies')"
          >
            <i class="building icon"></i> Empresas ({{ companies.length }})
          </button>
          <button
            class="tab-btn"
            [class.active]="activeTab === 'users'"
            (click)="setTab('users')"
          >
            <i class="users icon"></i> Usuarios y Roles ({{ users.length }})
          </button>
          <button
            class="tab-btn"
            [class.active]="activeTab === 'catalogs'"
            (click)="setTab('catalogs')"
          >
            <i class="tags icon"></i> Catálogos Maestros ({{ catalogs.length }})
          </button>
        </div>
      </div>

      <!-- TAB 1: EMPRESAS -->
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
            <span class="stat-value text-blue">{{ merchantCount }}</span>
          </div>
        </div>

        <!-- Action Bar -->
        <div class="bento-card action-bar">
          <div class="search-box">
            <i class="search icon"></i>
            <input
              type="text"
              placeholder="Buscar por razón social, código o RUC..."
              [(ngModel)]="searchCompany"
            />
          </div>
          <button class="ui-btn primary-btn" (click)="openCompanyModal()">
            <i class="plus icon"></i> Registrar Empresa
          </button>
        </div>

        <!-- Table -->
        <div class="bento-card table-card">
          <div class="table-responsive">
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
                      {{ c.status }}
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
                  <td colspan="8" class="empty-state">No se encontraron empresas registradas.</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- TAB 2: USUARIOS Y ROLES (RBAC) -->
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
            <i class="search icon"></i>
            <input
              type="text"
              placeholder="Buscar por usuario o nombre completo..."
              [(ngModel)]="searchUser"
            />
          </div>
          <button class="ui-btn primary-btn" (click)="openUserModal()">
            <i class="user plus icon"></i> Crear Usuario
          </button>
        </div>

        <!-- Table -->
        <div class="bento-card table-card">
          <div class="table-responsive">
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
                      {{ u.role }}
                    </span>
                  </td>
                  <td>{{ u.company_name || 'Acceso Global / Grupo' }}</td>
                  <td class="ui-mono">{{ u.created_at | date: 'dd/MM/yyyy' }}</td>
                  <td>
                    <span class="badge-status" [class.active]="u.is_active" [class.blocked]="!u.is_active">
                      {{ u.is_active ? 'ACTIVO' : 'INACTIVO' }}
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
                  <td colspan="7" class="empty-state">No se encontraron usuarios.</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- TAB 3: CATALOGOS MAESTROS -->
      <div *ngIf="activeTab === 'catalogs'" class="tab-content">
        <!-- Sub Category Filter Pills -->
        <div class="bento-card action-bar">
          <div class="catalog-subtabs">
            <button
              class="subtab-btn"
              [class.active]="selectedCatalogCategory === ''"
              (click)="filterCategory('')"
            >
              Todos ({{ catalogs.length }})
            </button>
            <button
              class="subtab-btn"
              [class.active]="selectedCatalogCategory === 'JOB_TITLE'"
              (click)="filterCategory('JOB_TITLE')"
            >
              Cargos / Puestos ({{ countCatalogCat('JOB_TITLE') }})
            </button>
            <button
              class="subtab-btn"
              [class.active]="selectedCatalogCategory === 'GRADE_LEVEL'"
              (click)="filterCategory('GRADE_LEVEL')"
            >
              Grados Salariales ({{ countCatalogCat('GRADE_LEVEL') }})
            </button>
            <button
              class="subtab-btn"
              [class.active]="selectedCatalogCategory === 'CLASSIFICATION'"
              (click)="filterCategory('CLASSIFICATION')"
            >
              Tipificaciones ({{ countCatalogCat('CLASSIFICATION') }})
            </button>
          </div>

          <button class="ui-btn primary-btn" (click)="openCatalogModal()">
            <i class="plus icon"></i> Nuevo Elemento
          </button>
        </div>

        <!-- Table -->
        <div class="bento-card table-card">
          <div class="table-responsive">
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
                      {{ cat.category }}
                    </span>
                  </td>
                  <td><code>{{ cat.code }}</code></td>
                  <td><strong>{{ cat.name }}</strong></td>
                  <td>{{ cat.description || '-' }}</td>
                  <td>{{ cat.order_index }}</td>
                  <td>
                    <span class="badge-status" [class.active]="cat.is_active" [class.blocked]="!cat.is_active">
                      {{ cat.is_active ? 'ACTIVO' : 'INACTIVO' }}
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

      <!-- MODAL: EMPRESA -->
      <div *ngIf="showCompanyModal" class="modal-backdrop">
        <div class="bento-card modal-content">
          <div class="modal-header">
            <h3>{{ editingCompanyId ? 'Editar Empresa' : 'Registrar Nueva Empresa' }}</h3>
            <button class="close-btn" (click)="closeCompanyModal()">&times;</button>
          </div>

          <form (ngSubmit)="saveCompany()" class="modal-form">
            <div class="form-row">
              <div class="form-group flex-1">
                <label>Código Único *</label>
                <input
                  type="text"
                  class="form-input"
                  [(ngModel)]="companyForm.code"
                  name="code"
                  placeholder="ej. EMP-02"
                  required
                />
              </div>
              <div class="form-group flex-2">
                <label>Razón Social / Nombre *</label>
                <input
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
                <label>RUC Corporativo *</label>
                <input
                  type="text"
                  class="form-input"
                  [(ngModel)]="companyForm.ruc"
                  name="ruc"
                  placeholder="ej. J0310000003033"
                  required
                />
              </div>
              <div class="form-group flex-1">
                <label>Teléfono</label>
                <input
                  type="text"
                  class="form-input"
                  [(ngModel)]="companyForm.phone"
                  name="phone"
                  placeholder="+505 2244-0000"
                />
              </div>
            </div>

            <div class="form-group">
              <label>Dirección</label>
              <textarea
                class="form-input"
                rows="2"
                [(ngModel)]="companyForm.address"
                name="address"
                placeholder="Dirección física o sede corporativa..."
              ></textarea>
            </div>

            <div class="form-row checkboxes">
              <label class="checkbox-label">
                <input
                  type="checkbox"
                  [(ngModel)]="companyForm.is_employer"
                  name="is_employer"
                />
                <span><strong>Empresa Empleadora</strong> (sus colaboradores reciben crédito)</span>
              </label>

              <label class="checkbox-label">
                <input
                  type="checkbox"
                  [(ngModel)]="companyForm.is_merchant"
                  name="is_merchant"
                />
                <span><strong>Comercio Afiliado</strong> (acepta cobros mediante Terminal POS)</span>
              </label>
            </div>

            <div class="modal-actions">
              <button type="button" class="ui-btn secondary-btn" (click)="closeCompanyModal()">
                Cancelar
              </button>
              <button type="submit" class="ui-btn primary-btn" [disabled]="savingCompany">
                {{ savingCompany ? 'Guardando...' : (editingCompanyId ? 'Actualizar' : 'Guardar Empresa') }}
              </button>
            </div>
          </form>
        </div>
      </div>

      <!-- MODAL: USUARIO -->
      <div *ngIf="showUserModal" class="modal-backdrop">
        <div class="bento-card modal-content">
          <div class="modal-header">
            <h3>{{ editingUserId ? 'Editar Usuario' : 'Crear Nuevo Usuario' }}</h3>
            <button class="close-btn" (click)="closeUserModal()">&times;</button>
          </div>

          <form (ngSubmit)="saveUser()" class="modal-form">
            <div class="form-row">
              <div class="form-group flex-1">
                <label>Nombre de Usuario (Login) *</label>
                <input
                  type="text"
                  class="form-input"
                  [(ngModel)]="userForm.username"
                  name="username"
                  placeholder="ej. cajero2"
                  required
                />
              </div>
              <div class="form-group flex-1">
                <label>Contraseña {{ editingUserId ? '(dejar vacío para no cambiar)' : '*' }}</label>
                <input
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
              <label>Nombre Completo *</label>
              <input
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
                <label>Rol de Sistema *</label>
                <select class="form-input" [(ngModel)]="userForm.role" name="role" required>
                  <option value="SUPER_ADMIN">SUPER_ADMIN (Control Total)</option>
                  <option value="CREDIT_MANAGER">CREDIT_MANAGER (Analista de Crédito)</option>
                  <option value="CASHIER">CASHIER (Operador de Caja POS)</option>
                  <option value="AUDITOR">AUDITOR (Auditor Solo Lectura)</option>
                </select>
              </div>

              <div class="form-group flex-1">
                <label>Empresa Asignada</label>
                <select class="form-input" [(ngModel)]="userForm.company_id" name="company_id">
                  <option [ngValue]="null">-- Acceso Global (Sin restricción) --</option>
                  <option *ngFor="let comp of companies" [value]="comp.id">
                    {{ comp.name }} ({{ comp.code }})
                  </option>
                </select>
              </div>
            </div>

            <div class="modal-actions">
              <button type="button" class="ui-btn secondary-btn" (click)="closeUserModal()">
                Cancelar
              </button>
              <button type="submit" class="ui-btn primary-btn" [disabled]="savingUser">
                {{ savingUser ? 'Guardando...' : (editingUserId ? 'Actualizar Usuario' : 'Crear Usuario') }}
              </button>
            </div>
          </form>
        </div>
      </div>

      <!-- MODAL: CATALOGO -->
      <div *ngIf="showCatalogModal" class="modal-backdrop">
        <div class="bento-card modal-content">
          <div class="modal-header">
            <h3>{{ editingCatalogId ? 'Editar Catálogo' : 'Nuevo Elemento de Catálogo' }}</h3>
            <button class="close-btn" (click)="closeCatalogModal()">&times;</button>
          </div>

          <form (ngSubmit)="saveCatalog()" class="modal-form">
            <div class="form-row">
              <div class="form-group flex-1">
                <label>Categoría *</label>
                <select
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
                <label>Código Identificador *</label>
                <input
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
              <label>Nombre / Título *</label>
              <input
                type="text"
                class="form-input"
                [(ngModel)]="catalogForm.name"
                name="name"
                placeholder="ej. Coordinador de Logística"
                required
              />
            </div>

            <div class="form-group">
              <label>Descripción / Alcance</label>
              <textarea
                class="form-input"
                rows="2"
                [(ngModel)]="catalogForm.description"
                name="description"
                placeholder="Descripción informativa del catálogo..."
              ></textarea>
            </div>

            <div class="form-group catalog-order-group">
              <label>Orden Visual</label>
              <input
                type="number"
                class="form-input"
                [(ngModel)]="catalogForm.order_index"
                name="order_index"
              />
            </div>

            <div class="modal-actions">
              <button type="button" class="ui-btn secondary-btn" (click)="closeCatalogModal()">
                Cancelar
              </button>
              <button type="submit" class="ui-btn primary-btn" [disabled]="savingCatalog">
                {{ savingCatalog ? 'Guardando...' : (editingCatalogId ? 'Actualizar' : 'Guardar') }}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  `,
  styleUrl: './admin.component.css',
})
export class AdminComponent implements OnInit {
  private readonly adminService = inject(AdminService);

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

  setTab(tab: AdminTab): void {
    this.activeTab = tab;
  }

  // ================= EMPRESAS =================
  loadCompanies(): void {
    this.adminService.getCompanies().subscribe({
      next: (data) => (this.companies = data),
      error: (err) => console.error('Error cargando empresas:', err),
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
    this.showCompanyModal = true;
  }

  closeCompanyModal(): void {
    this.showCompanyModal = false;
    this.editingCompanyId = null;
  }

  saveCompany(): void {
    if (!this.companyForm.code || !this.companyForm.name || !this.companyForm.ruc) {
      alert('Por favor complete todos los campos obligatorios (*)');
      return;
    }

    this.savingCompany = true;
    if (this.editingCompanyId) {
      this.adminService.updateCompany(this.editingCompanyId, this.companyForm).subscribe({
        next: () => {
          this.savingCompany = false;
          this.closeCompanyModal();
          this.loadCompanies();
        },
        error: (err) => {
          this.savingCompany = false;
          alert(err.error?.message || 'Error al actualizar empresa');
        },
      });
    } else {
      this.adminService.createCompany(this.companyForm).subscribe({
        next: () => {
          this.savingCompany = false;
          this.closeCompanyModal();
          this.loadCompanies();
        },
        error: (err) => {
          this.savingCompany = false;
          alert(err.error?.message || 'Error al registrar empresa');
        },
      });
    }
  }

  toggleCompanyStatus(comp: Company): void {
    if (!confirm(`¿Desea cambiar el estado de la empresa ${comp.name}?`)) return;
    this.adminService.toggleCompanyStatus(comp.id).subscribe({
      next: () => this.loadCompanies(),
      error: (err) => alert(err.error?.message || 'Error al cambiar estado'),
    });
  }

  // ================= USUARIOS =================
  loadUsers(): void {
    this.adminService.getUsers().subscribe({
      next: (data) => (this.users = data),
      error: (err) => console.error('Error cargando usuarios:', err),
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
    this.showUserModal = true;
  }

  closeUserModal(): void {
    this.showUserModal = false;
    this.editingUserId = null;
  }

  saveUser(): void {
    if (!this.userForm.username || !this.userForm.full_name) {
      alert('Nombre de usuario y nombre completo son requeridos');
      return;
    }
    if (!this.editingUserId && !this.userForm.password) {
      alert('La contraseña es requerida para nuevos usuarios');
      return;
    }

    this.savingUser = true;
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
          this.loadUsers();
        },
        error: (err) => {
          this.savingUser = false;
          alert(err.error?.message || 'Error al actualizar usuario');
        },
      });
    } else {
      this.adminService.createUser(this.userForm).subscribe({
        next: () => {
          this.savingUser = false;
          this.closeUserModal();
          this.loadUsers();
        },
        error: (err) => {
          this.savingUser = false;
          alert(err.error?.message || 'Error al crear usuario');
        },
      });
    }
  }

  toggleUserStatus(user: AdminUser): void {
    if (!confirm(`¿Desea cambiar el estado del usuario @${user.username}?`)) return;
    this.adminService.toggleUserStatus(user.id).subscribe({
      next: () => this.loadUsers(),
      error: (err) => alert(err.error?.message || 'Error al cambiar estado'),
    });
  }

  // ================= CATALOGOS =================
  loadCatalogs(): void {
    this.adminService.getCatalogs().subscribe({
      next: (data) => (this.catalogs = data),
      error: (err) => console.error('Error cargando catálogos:', err),
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
    this.showCatalogModal = true;
  }

  closeCatalogModal(): void {
    this.showCatalogModal = false;
    this.editingCatalogId = null;
  }

  saveCatalog(): void {
    if (!this.catalogForm.code || !this.catalogForm.name) {
      alert('Código y nombre son obligatorios');
      return;
    }

    this.savingCatalog = true;
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
          this.loadCatalogs();
        },
        error: (err) => {
          this.savingCatalog = false;
          alert(err.error?.message || 'Error al actualizar catálogo');
        },
      });
    } else {
      this.adminService.createCatalog(this.catalogForm).subscribe({
        next: () => {
          this.savingCatalog = false;
          this.closeCatalogModal();
          this.loadCatalogs();
        },
        error: (err) => {
          this.savingCatalog = false;
          alert(err.error?.message || 'Error al crear elemento de catálogo');
        },
      });
    }
  }

  toggleCatalogStatus(cat: CatalogItem): void {
    if (!confirm(`¿Desea cambiar el estado de ${cat.name}?`)) return;
    this.adminService.toggleCatalogStatus(cat.id).subscribe({
      next: () => this.loadCatalogs(),
      error: (err) => alert(err.error?.message || 'Error al cambiar estado'),
    });
  }
}
