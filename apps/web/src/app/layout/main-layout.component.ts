import {
  Component,
  DestroyRef,
  ElementRef,
  HostListener,
  PLATFORM_ID,
  ViewChild,
  inject,
  signal,
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { RouterModule } from '@angular/router';
import { AuthService } from '../core/services/auth.service';
import { UserRole } from '../core/models';

@Component({
  selector: 'app-main-layout',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './main-layout.component.html',
  styleUrl: './main-layout.component.css',
})
export class MainLayoutComponent {
  readonly auth = inject(AuthService);

  readonly menuOpen = signal(false);
  readonly isSmallScreen = signal(false);

  @ViewChild('menuPanel') menuPanel?: ElementRef<HTMLElement>;
  @ViewChild('menuToggle') menuToggle?: ElementRef<HTMLButtonElement>;

  private readonly destroyRef = inject(DestroyRef);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly browser = isPlatformBrowser(this.platformId);
  private bodyOverflowBeforeMenu = '';
  private menuLocksBody = false;
  private menuFocusTimer: number | undefined;

  constructor() {
    if (!this.browser) return;

    const media = window.matchMedia('(max-width: 760px)');
    let currentMode = media.matches;
    this.isSmallScreen.set(currentMode);
    this.menuOpen.set(!currentMode);

    const onModeChange = () => {
      const nextMode = media.matches;
      if (nextMode === currentMode) return;
      currentMode = nextMode;
      this.isSmallScreen.set(nextMode);
      this.setMenuOpen(!nextMode);
    };

    media.addEventListener('change', onModeChange);
    this.destroyRef.onDestroy(() => {
      media.removeEventListener('change', onModeChange);
      window.clearTimeout(this.menuFocusTimer);
      if (this.menuLocksBody) {
        document.body.style.overflow = this.bodyOverflowBeforeMenu;
      }
    });
  }

  toggleMenu(): void {
    this.setMenuOpen(!this.menuOpen());
  }

  closeMenu(): void {
    if (!this.menuOpen()) return;
    this.setMenuOpen(false);
  }

  onNavLinkClick(): void {
    if (this.isSmallScreen()) {
      this.closeMenu();
    }
  }

  private setMenuOpen(open: boolean): void {
    this.menuOpen.set(open);
    if (!this.browser) return;

    const modal = open && this.isSmallScreen();
    if (modal && !this.menuLocksBody) {
      this.bodyOverflowBeforeMenu = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      this.menuLocksBody = true;
    } else if (!modal && this.menuLocksBody) {
      document.body.style.overflow = this.bodyOverflowBeforeMenu;
      this.menuLocksBody = false;
    }

    window.clearTimeout(this.menuFocusTimer);
    this.menuFocusTimer = window.setTimeout(() => {
      if (modal) {
        this.visibleMenuControls()[0]?.focus();
      } else if (!open) {
        this.menuToggle?.nativeElement.focus();
      }
    }, 0);
  }

  private visibleMenuControls(): HTMLElement[] {
    const nodes = this.menuPanel?.nativeElement.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
    );
    return Array.from(nodes ?? []).filter((node) => node.getClientRects().length > 0);
  }

  @HostListener('document:keydown', ['$event'])
  onMenuKeydown(event: KeyboardEvent): void {
    if (!this.isSmallScreen() || !this.menuOpen()) return;
    // Evita que F2/F4/F8 lleguen al POS detrás del menú modal.
    event.stopPropagation();

    if (event.key === 'Escape') {
      event.preventDefault();
      this.closeMenu();
      return;
    }
    if (event.key !== 'Tab') return;

    const controls = this.visibleMenuControls();
    const first = controls[0];
    const last = controls[controls.length - 1];
    if (!first || !last) return;

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  canManageCredit(): boolean {
    return this.auth.hasRole(UserRole.CREDIT_MANAGER, UserRole.SUPER_ADMIN, UserRole.AUDITOR);
  }

  isAdmin(): boolean {
    return this.auth.hasRole(UserRole.SUPER_ADMIN, UserRole.CREDIT_MANAGER);
  }
}
