import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from '../core/services/auth.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="dashboard-container">
      <header class="dashboard-header">
        <h1>Tableau de Bord - Plateforme de Dédouanement</h1>
        <div class="user-info">
          <span>Bienvenue, {{ user?.username }} ({{ user?.role }})</span>
          <button (click)="logout()" class="btn-logout">Déconnexion</button>
        </div>
      </header>
      
      <main class="dashboard-content">
        <div class="welcome-message">
          <h2>Connexion réussie !</h2>
          <p>Vous êtes connecté en tant que <strong>{{ user?.role }}</strong></p>
          <p>Cette interface sera développée dans les prochaines étapes.</p>
        </div>
      </main>
    </div>
  `,
  styles: [`
    .dashboard-container {
      min-height: 100vh;
      background: #f5f5f5;
    }
    
    .dashboard-header {
      background: white;
      padding: 1rem 2rem;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    
    .dashboard-header h1 {
      margin: 0;
      color: #333;
      font-size: 1.5rem;
    }
    
    .user-info {
      display: flex;
      align-items: center;
      gap: 1rem;
    }
    
    .btn-logout {
      background: #dc3545;
      color: white;
      border: none;
      padding: 0.5rem 1rem;
      border-radius: 4px;
      cursor: pointer;
    }
    
    .btn-logout:hover {
      background: #c82333;
    }
    
    .dashboard-content {
      padding: 2rem;
    }
    
    .welcome-message {
      background: white;
      padding: 2rem;
      border-radius: 8px;
      text-align: center;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
  `]
})
export class DashboardComponent {
  user = this.authService.getUser();

  constructor(private authService: AuthService) {}

  logout(): void {
    this.authService.logout();
  }
}