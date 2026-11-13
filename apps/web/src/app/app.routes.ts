import { Routes } from '@angular/router';
import { LoginComponent } from './features/auth/login.component';
import { KioskComponent } from './features/kiosk/kiosk.component';
import { MainLayoutComponent } from './layout/main-layout.component';
import { PosComponent } from './features/pos/pos.component';
import { ClientsListComponent } from './features/clients/clients-list.component';
import { ImportExportComponent } from './features/import-export/import-export.component';
import { CreditRequestsComponent } from './features/credit-requests/credit-requests.component';
import { authGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  { path: 'login', component: LoginComponent },
  { path: 'kiosk', component: KioskComponent },
  {
    path: '',
    component: MainLayoutComponent,
    canActivate: [authGuard],
    children: [
      { path: 'pos', component: PosComponent },
      { path: 'clients', component: ClientsListComponent },
      { path: 'import-export', component: ImportExportComponent },
      { path: 'credit-requests', component: CreditRequestsComponent },
      { path: '', redirectTo: 'pos', pathMatch: 'full' },
    ],
  },
  { path: '**', redirectTo: 'pos' },
];
