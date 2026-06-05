import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../../core/services/auth.service';

/**
 * Placeholder pour /dashboard afin que l'application compile et que le Guard soit testable.
 * Remplace ensuite par ton vrai composant Dashboard.
 */
@Component({
  selector: 'app-dashboard-placeholder',
  standalone: true,
  imports: [CommonModule],
  template: `
    <section style="max-width:900px;margin:40px auto;padding:24px;">
      <h2>Dashboard (placeholder)</h2>
      <p>Rôle connecté : <b>{{ role }}</b></p>
      <p>Tu peux maintenant brancher tes fonctionnalités de déclarations.</p>
    </section>
  `,
})
export class DashboardPlaceholderComponent {
  role: string | null;

  constructor(private authService: AuthService) {
    this.role = this.authService.getUserRole();
  }
}

