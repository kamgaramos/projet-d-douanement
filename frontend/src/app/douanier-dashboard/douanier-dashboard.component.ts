import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { DeclarationService } from '../core/services/declaration.service';

@Component({
  selector: 'app-douanier-dashboard',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './douanier-dashboard.component.html',
  styleUrl: './douanier-dashboard.component.css'
})
export class DouanierDashboardComponent implements OnInit {
  currentUser: any = null;
  declarationsEnAttente: any[] = [];
  isLoading: boolean = false;

  constructor(
    private router: Router,
    private declarationService: DeclarationService
  ) {}

  ngOnInit(): void {
    const userJson = localStorage.getItem('user');
    this.currentUser = userJson ? JSON.parse(userJson) : { name: 'Douanier', role: 'douanier' };
    this.chargerDeclarationsEnAttente();
  }

  chargerDeclarationsEnAttente(): void {
    this.isLoading = true;

    this.declarationService.getDeclarations().subscribe({
      next: (data) => {
        this.declarationsEnAttente = data.filter(declaration => {
          const statut = (declaration.statut || '').trim().toUpperCase();
          return statut === 'DOSSIER_OUVERT' || statut === 'EN_ATTENTE_VALIDATION_DOUANE';
        });

        console.log(`🔍 ${this.declarationsEnAttente.length} déclarations en attente trouvées`);
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Erreur lors de la récupération des déclarations:', err);
        this.isLoading = false;
      }
    });
  }

  valider(id: number, nouveauStatut: string): void {
    const action = nouveauStatut === 'approuvée' ? 'approuver' : 'rejeter';

    if (confirm(`Êtes-vous sûr de vouloir ${action} cette déclaration ?`)) {
      this.declarationService.updateStatut(id, nouveauStatut).subscribe({
        next: (response) => {
          console.log(`Déclaration ${nouveauStatut} avec succès`);
          this.chargerDeclarationsEnAttente();
        },
        error: (err) => {
          console.error(`Erreur lors de la validation:`, err);
          alert(`Une erreur est survenue lors de la validation de la déclaration.`);
        }
      });
    }
  }

  onLogout(): void {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    this.router.navigate(['/login']);
  }

  voirDocuments(declarationId: number): void {
    this.router.navigate(['/declaration-details', declarationId]);
  }
}
