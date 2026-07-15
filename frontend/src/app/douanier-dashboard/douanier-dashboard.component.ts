import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { DeclarationService } from '../core/services/declaration.service';
import { DocumentService, DocumentInfo } from '../core/services/document.service';
import { AuthService } from '../core/services/auth.service';

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
  selectedDeclarationId: number | null = null;
  selectedDeclarationDocuments: DocumentInfo[] = [];
  documentsLoading: boolean = false;
  documentsError: string = '';
  selectedDeclaration: any = null;

  // KYC Transitaires
  transitairesEnAttente: any[] = [];
  transitairesLoading: boolean = false;

  constructor(
    private router: Router,
    private declarationService: DeclarationService,
    private documentService: DocumentService,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    const userJson = localStorage.getItem('user');
    if (!userJson) {
      this.router.navigate(['/login']);
      return;
    }
    this.currentUser = JSON.parse(userJson);
    this.chargerDeclarationsEnAttente();
    this.chargerTransitairesEnAttente();
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

  downloadDocument(docId: number, filename: string): void {
    this.documentService.downloadDocument(docId).subscribe({
      next: (blob) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
      },
      error: (err) => {
        console.error('Erreur téléchargement document:', err);
        alert('Impossible de télécharger le document. Vérifiez vos autorisations et réessayez.');
      }
    });
  }

  formatFileSize(bytes: number): string {
    if (!bytes) return '0 o';
    if (bytes < 1024) return bytes + ' o';
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' Ko';
    return (bytes / 1048576).toFixed(1) + ' Mo';
  }

  /** Groupe les documents par uploadeur */
  getDocumentsGroupedByUploader(): { [key: string]: DocumentInfo[] } {
    const grouped: { [key: string]: DocumentInfo[] } = {};
    
    this.selectedDeclarationDocuments.forEach(doc => {
      const uploader = doc.uploaded_by_name || 'Inconnu';
      if (!grouped[uploader]) {
        grouped[uploader] = [];
      }
      grouped[uploader].push(doc);
    });

    return grouped;
  }

  voirDocuments(declarationId: number): void {
    if (this.selectedDeclarationId === declarationId) {
      this.selectedDeclarationId = null;
      this.selectedDeclarationDocuments = [];
      this.selectedDeclaration = null;
      this.documentsError = '';
      return;
    }

    this.selectedDeclarationId = declarationId;
    this.selectedDeclarationDocuments = [];
    this.selectedDeclaration = this.declarationsEnAttente.find(d => d.id === declarationId) || null;
    this.documentsError = '';
    this.documentsLoading = true;

    this.documentService.getDocumentsByDeclaration(declarationId).subscribe({
      next: (response) => {
        this.selectedDeclarationDocuments = response.documents || [];
        this.documentsLoading = false;
      },
      error: (err) => {
        this.documentsLoading = false;
        this.documentsError = err.error?.details || err.error?.error || 'Impossible de charger les documents';
        console.error('Erreur chargement documents douanier:', err);
      }
    });
  }

  chargerTransitairesEnAttente(): void {
    this.transitairesLoading = true;
    this.authService.getPendingTransitaires().subscribe({
      next: (data) => {
        this.transitairesEnAttente = data || [];
        this.transitairesLoading = false;
      },
      error: (err) => {
        console.error('Erreur chargement transitaires en attente:', err);
        this.transitairesLoading = false;
      }
    });
  }

  validerTransitaire(id: number, action: 'APPROVED' | 'REJECTED'): void {
    const actionStr = action === 'APPROVED' ? 'approuver' : 'rejeter';
    if (confirm(`Êtes-vous sûr de vouloir ${actionStr} ce transitaire ?`)) {
      this.authService.validerTransitaire(id, action).subscribe({
        next: () => {
          alert(`Transitaire ${action === 'APPROVED' ? 'approuvé' : 'rejeté'} avec succès.`);
          this.chargerTransitairesEnAttente();
        },
        error: (err) => {
          console.error('Erreur lors de la validation du transitaire:', err);
          alert('Impossible de valider ou rejeter ce transitaire.');
        }
      });
    }
  }
}
