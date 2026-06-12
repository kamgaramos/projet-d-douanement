import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { DeclarationService } from '../core/services/declaration.service';
import { ChatComponent } from '../chat/chat.component';

@Component({
  selector: 'app-declaration-details',
  standalone: true,
  imports: [CommonModule, ChatComponent],
  templateUrl: './declaration-details.component.html',
  styleUrl: './declaration-details.component.css'
})
export class DeclarationDetailsComponent implements OnInit {
  declaration: any = null;
  isLoading: boolean = false;
  errorMessage: string = '';
  currentUser: any = null;
  
  // Propriétés pour le chat
  showChat: boolean = true;
  
  // Propriétés pour les onglets
  showDocuments: boolean = false;
  showOffers: boolean = false;
  showHistory: boolean = false;
  showNotifications: boolean = false;
  
  documents: any[] = [];
  offres: any[] = [];
  notifications: any[] = [];
  historique: any[] = [];
  
  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private declarationService: DeclarationService
  ) {}

  ngOnInit(): void {
    // Récupérer l'utilisateur connecté
    const userJson = localStorage.getItem('user');
    this.currentUser = userJson ? JSON.parse(userJson) : null;

    // Récupérer l'ID de la déclaration depuis l'URL
    this.route.paramMap.subscribe(params => {
      const declarationId = params.get('id');
      if (declarationId) {
        this.chargerDeclaration(parseInt(declarationId));
      }
    });
  }

  chargerDeclaration(id: number): void {
    this.isLoading = true;
    this.errorMessage = '';

    this.declarationService.getDeclarationById(id).subscribe({
      next: (declaration) => {
        this.declaration = declaration;
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Erreur lors du chargement de la déclaration:', error);
        this.errorMessage = 'Erreur lors du chargement de la déclaration';
        this.isLoading = false;
      }
    });
  }

  toggleChat(): void {
    this.showChat = !this.showChat;
  }

  retourAuDashboard(): void {
    this.router.navigate(['/dashboard']);
  }

  getStatutClass(statut: string): string {
    const statusClasses: { [key: string]: string } = {
      'brouillon': 'statut-brouillon',
      'en attente': 'statut-en-attente',
      'EN_ATTENTE_OFFRES': 'statut-marketplace',
      'approuvée': 'statut-approuve',
      'rejetée': 'statut-rejete'
    };
    return statusClasses[statut?.toLowerCase()] || 'statut-default';
  }

  getStatutDisplay(statut: string): string {
    const statusDisplay: { [key: string]: string } = {
      'brouillon': '📝 Brouillon',
      'en attente': '⏳ En attente',
      'EN_ATTENTE_OFFRES': '🏪 Sur Marketplace',
      'EN_COURS_DE_TRANSPORT': '🚚 En cours de transport',
      'approuvée': '✅ Approuvée',
      'rejetée': '❌ Rejetée'
    };
    return statusDisplay[statut?.toLowerCase()] || statut;
  }

  // Afficher/masquer les documents
  afficherDocuments(): void {
    this.showDocuments = !this.showDocuments;
    if (this.showDocuments && this.documents.length === 0) {
      this.chargerDocuments();
    }
  }

  // Charger les documents (placeholder)
  chargerDocuments(): void {
    this.documents = [
      { id: 1, nom: 'Facture commerciale', date: new Date(), type: 'PDF' },
      { id: 2, nom: 'Certificate d\'origine', date: new Date(), type: 'PDF' },
      { id: 3, nom: 'Bill of Lading', date: new Date(), type: 'PDF' }
    ];
  }

  // Afficher/masquer les offres
  afficherOffres(): void {
    this.showOffers = !this.showOffers;
    if (this.showOffers && this.offres.length === 0) {
      this.chargerOffres();
    }
  }

  // Charger les offres (placeholder)
  chargerOffres(): void {
    this.offres = [
      { id: 1, transitaire: 'Transitaire A', montant: 1500, delai: 5 },
      { id: 2, transitaire: 'Transitaire B', montant: 1200, delai: 7 }
    ];
  }

  // Afficher/masquer l'historique
  afficherHistorique(): void {
    this.showHistory = !this.showHistory;
    if (this.showHistory && this.historique.length === 0) {
      this.chargerHistorique();
    }
  }

  // Charger l'historique (placeholder)
  chargerHistorique(): void {
    this.historique = [
      { date: new Date(Date.now() - 86400000), action: 'Déclaration créée', utilisateur: 'Vous' },
      { date: new Date(Date.now() - 43200000), action: 'Déclaration publiée', utilisateur: 'Vous' }
    ];
  }

  // Afficher/masquer les notifications
  afficherNotifications(): void {
    this.showNotifications = !this.showNotifications;
    if (this.showNotifications && this.notifications.length === 0) {
      this.chargerNotifications();
    }
  }

  // Charger les notifications (placeholder)
  chargerNotifications(): void {
    this.notifications = [
      { id: 1, titre: 'Nouvelle offre reçue', message: 'Un transitaire a soumis une offre', date: new Date(Date.now() - 3600000) },
      { id: 2, titre: 'Document mis à jour', message: 'Votre facture a été acceptée', date: new Date(Date.now() - 7200000) }
    ];
  }
}

