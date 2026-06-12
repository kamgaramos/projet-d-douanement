import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { DeclarationService } from '../core/services/declaration.service';
import { ChatComponent } from '../chat/chat.component';

@Component({
  selector: 'app-douanier-dashboard',
  standalone: true,
  imports: [CommonModule, ChatComponent],
  templateUrl: './douanier-dashboard.component.html',
  styleUrl: './douanier-dashboard.component.css'
})
export class DouanierDashboardComponent implements OnInit {
  currentUser: any = null;
  declarationsEnAttente: any[] = [];
  isLoading: boolean = false;
  
  // Propriétés pour le chat
  selectedDeclarationId: number | null = null;
  selectedDeclarationRef: string = '';
  showChatPanel: boolean = false;

  constructor(
    private router: Router,
    private declarationService: DeclarationService
  ) {}

  ngOnInit(): void {
    // Récupération de l'utilisateur connecté
    const userJson = localStorage.getItem('user');
    this.currentUser = userJson ? JSON.parse(userJson) : { name: 'Douanier', role: 'douanier' };

    this.chargerDeclarationsEnAttente();
  }

  chargerDeclarationsEnAttente(): void {
    this.isLoading = true;
    
    this.declarationService.getDeclarations().subscribe({
      next: (data) => {
        // Filtrer uniquement les déclarations en attente
        this.declarationsEnAttente = data.filter(declaration => {
          const statut = (declaration.statut || '').toLowerCase();
          return statut === 'en attente';
        });
        
        console.log(`🔍 ${this.declarationsEnAttente.length} déclarations en attente trouvées`);
        console.log('Première déclaration:', this.declarationsEnAttente[0]);
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
          // Recharger la liste après validation
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

  // Méthodes pour le chat
  ouvrirChat(declaration: any): void {
    this.selectedDeclarationId = declaration.id;
    this.selectedDeclarationRef = declaration.reference || ('DEC-' + declaration.id);
    this.showChatPanel = true;
    console.log('💬 Ouverture du chat pour:', this.selectedDeclarationRef);
  }

  fermerChat(): void {
    this.showChatPanel = false;
    this.selectedDeclarationId = null;
    this.selectedDeclarationRef = '';
    console.log('🚫 Chat fermé');
  }
}