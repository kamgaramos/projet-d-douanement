import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { DeclarationService } from '../core/services/declaration.service';
import { CargaisonService } from '../core/services/cargaison.service';
import { OffreService } from '../core/services/offre.service';
import { ChatComponent } from '../chat/chat.component';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, ChatComponent],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css'
})
export class DashboardComponent implements OnInit {
  currentUser: any = null;
  declarations: any[] = [];
  cargaisonForm!: FormGroup;
  offerForm!: FormGroup;
  showFormModal: boolean = false;
  showOfferModal: boolean = false;
  selectedOfferDeclaration: any = null;
  selectedOfferDeclarationRef: string = '';
  
  // Propriétés pour le chat
  selectedDeclarationId: number | null = null;
  selectedDeclarationRef: string = '';
  showChatPanel: boolean = false;
  
  // Propriétés du dashboard
  // (dashboardTitle est fourni via le getter ci-dessous)


  constructor(
    private router: Router, 
    private fb: FormBuilder,
    private declarationService: DeclarationService,
    private cargaisonService: CargaisonService,
    private offreService: OffreService
  ) {}

  ngOnInit(): void {
    // Récupération de l'utilisateur connecté depuis le localStorage
    const userJson = localStorage.getItem('user');
    
    // Valeur par défaut si le localStorage est vide (pour tes tests)
    this.currentUser = userJson ? JSON.parse(userJson) : { name: 'kamga', role: 'declarant' }; 

    // Redirection automatique des douaniers vers leur interface spécialisée
    if (this.currentUser?.role === 'douanier') {
      this.router.navigate(['/douanier-dashboard']);
      return;
    }

    this.loadRealData();
    this.initCargaisonForm();
    this.loadNomenclature();
    this.initOfferForm();
  }

  nomenclatures: Array<{ code_sh: string; designation: string }> = [];
  nomenclatureLoading = false;
  nomenclatureError = '';

  initCargaisonForm() {
    this.cargaisonForm = this.fb.group({
      description: ['', [Validators.required, Validators.minLength(5)]],
      // Champ nomenclature
      code_sh: ['', [Validators.required]],
      typeMarchandise: ['', [Validators.required]],
      poids: ['', [Validators.required, Validators.min(1)]],
      valeur: ['', [Validators.required, Validators.min(1)]]
    });
  }

  private loadNomenclature() {
    this.nomenclatureLoading = true;
    this.nomenclatureError = '';

    // Ton backend (même host/port que les autres services du projet)
    const apiUrl = 'http://localhost:5000/api/nomenclature';

    // HttpClient n’est pas injecté pour l’instant dans ce composant.
    // On l’utilise via fetch pour ne pas changer le service existant.
    fetch(apiUrl)
      .then(async (res) => {
        if (!res.ok) throw new Error(await res.text());
        return res.json();
      })
      .then((data) => {
        this.nomenclatures = Array.isArray(data) ? data : [];
        this.nomenclatureLoading = false;
      })
      .catch((err) => {
        console.error('Erreur GET /api/nomenclature:', err);
        this.nomenclatureError = 'Impossible de charger la nomenclature.';
        this.nomenclatureLoading = false;
      });
  }

  // Méthode pour charger les déclarations (alias pour compatibilité)
  chargerDeclarations() {
    this.loadRealData();
  }

  // Méthode pour soumettre une déclaration
  soumettre(id: number) {
    this.cargaisonService.soumettreDeclaration(id).subscribe({
      next: (response) => {
        this.chargerDeclarations();
      },
      error: (err) => {
        alert('Erreur lors de la soumission de la déclaration');
        console.error(err);
      }
    });
  }

  initOfferForm() {
    this.offerForm = this.fb.group({
      mode_transport: ['', [Validators.required]],
      montant_prestation: ['', [Validators.required, Validators.min(1)]],
      delai_estime_jours: ['', [Validators.required, Validators.min(1)]],
      message: ['']
    });
  }

  openOfferModal(declaration: any): void {
    this.selectedOfferDeclaration = declaration;
    this.selectedOfferDeclarationRef = declaration.reference || ('DEC-' + declaration.id);
    this.showOfferModal = true;
    this.offerForm.reset({
      mode_transport: '',
      montant_prestation: '',
      delai_estime_jours: '',
      message: ''
    });
  }

  closeOfferModal(): void {
    this.showOfferModal = false;
    this.selectedOfferDeclaration = null;
    this.selectedOfferDeclarationRef = '';
    this.offerForm.reset();
  }

  faireOffre(declaration: any) {
    this.openOfferModal(declaration);
  }

  soumettreOffre(): void {
    if (!this.selectedOfferDeclaration || this.offerForm.invalid) {
      return;
    }

    const payload = {
      declaration_id: this.selectedOfferDeclaration.id,
      mode_transport: this.offerForm.value.mode_transport,
      montant_prestation: this.offerForm.value.montant_prestation,
      delai_estime_jours: this.offerForm.value.delai_estime_jours,
      message: this.offerForm.value.message
    };

    console.log('[DEBUG] soumettreOffre payload =>', payload);

    this.offreService.soumettreOffre(payload).subscribe({
      next: () => {
        alert('Offre envoyée avec succès.');
        this.closeOfferModal();
        this.loadRealData();
      },
      error: (err) => {
        // Interception spécifique 409 Conflict (offre déjà soumise)
        const status = err?.status ?? err?.error?.status;
        if (status === 409) {
          alert('Vous avez déjà soumis une offre pour cette déclaration');
          return;
        }

        console.error('Erreur lors de l\'envoi de l\'offre :', err);
        alert('Impossible d\'envoyer l\'offre.');
      }
    });
  }

  contacterDeclarant(declaration: any): void {
    this.ouvrirChat(declaration);
  }

  // Ouvrir les détails d'une déclaration
  ouvrirDeclaration(id: number): void {
    this.router.navigate(['/declaration-details', id]);
  }

  // Alias pour compatibilité avec le template
  voirDetails(declaration: any): void {
    this.ouvrirDeclaration(declaration.id);
  }

  supprimerDeclaration(declaration: any): void {
    if (!confirm('Voulez-vous vraiment supprimer cette cargaison ? Cette action est irréversible.')) {
      return;
    }

    this.declarationService.supprimerDeclaration(declaration.id).subscribe({
      next: () => {
        alert('Cargaison supprimée avec succès.');
        this.loadRealData();
      },
      error: (err) => {
        console.error('Erreur lors de la suppression:', err);
        alert('Impossible de supprimer cette cargaison.');
      }
    });
  }

  loadRealData() {
    this.declarationService.getDeclarations().subscribe({
      next: (data) => {
        // --- INTERCEPTEUR AUTOMATIQUE DE DÉBOGAGE ---
        if (data && data.length > 0) {
          console.log("%c--- STRUCTURE DÉTECTÉE DE TON BACKEND ---", "color: #3b82f6; font-weight: bold; font-size: 14px;");
          console.log("Voici la liste complète des clés réelles de ta base de données :", Object.keys(data[0]));
          console.log("Objet témoin complet :", data[0]);
        } else {
          console.log("Le backend renvoie un tableau vide []");
        }

        // Tri : met les dossiers "En attente" ou "en attente" en haut de liste
        this.declarations = data.sort((a, b) => {
          const statusA = (a.status || a.statut || '').toLowerCase();
          const statusB = (b.status || b.statut || '').toLowerCase();
          return statusA === 'en attente' ? -1 : 1;
        });
      },
      error: (err) => {
        console.error('Erreur lors de la récupération des cargaisons:', err);
      }
    });
  }

  // --- ACTIONS DU DOUANIER ---
  onUpdateStatus(id: number, status: string) {
    const actionVerbe = status === 'Approuvé' ? 'approuver' : 'rejeter';
    
    if (confirm(`Êtes-vous sûr de vouloir ${actionVerbe} cette cargaison ?`)) {
      this.declarationService.updateStatut(id, status).subscribe({
        next: (response) => {
          console.log(`Cargaison mise à jour avec succès : ${status}`);
          this.loadRealData(); // Recharge le tableau et met à jour les compteurs
        },
        error: (err) => {
          console.error("Erreur lors du changement de statut :", err);
          alert("Une erreur est survenue lors de l'évaluation du dossier.");
        }
      });
    }
  }

  openModal() {
    this.showFormModal = true;
  }

  closeModal() {
    this.showFormModal = false;
    this.cargaisonForm.reset();
  }

  onAddCargaison() {
    if (this.cargaisonForm.invalid) return;

    const payload = {
      description: this.cargaisonForm.value.description,
      code_sh: this.cargaisonForm.value.code_sh,
      // optionnel: si ton backend attend aussi une designation
      // (sinon, il peut l’ignorer)
      designation: this.nomenclatures.find(n => n.code_sh === this.cargaisonForm.value.code_sh)?.designation,
      typeMarchandise: this.cargaisonForm.value.typeMarchandise,
      poids: this.cargaisonForm.value.poids,
      valeur: this.cargaisonForm.value.valeur
    };

    this.declarationService.createCargaison(payload).subscribe({
      next: (response) => {
        this.loadRealData();
        this.closeModal();
      },
      error: (err) => {
        console.error("Erreur lors de l'enregistrement de la cargaison:", err);
      }
    });
  }

  // Amélioration de la méthode pour ignorer les problèmes de MAJUSCULES/minuscules (ex: 'brouillon' vs 'Brouillon')
  getCountByStatus(status: string): number {
    if (!this.declarations) return 0;
    return this.declarations.filter(d => {
      const currentStatus = (d.status || d.statut || '').toLowerCase();
      return currentStatus === status.toLowerCase();
    }).length;
  }

  onLogout(): void {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    this.router.navigate(['/login']);
  }

  // Ouvrir le chat pour une déclaration spécifique
  ouvrirChat(declaration: any): void {
    this.selectedDeclarationId = declaration.id;
    this.selectedDeclarationRef = declaration.reference || ('DEC-' + declaration.id);
    this.showChatPanel = true;
  }

  // Fermer le chat
  fermerChat(): void {
    this.showChatPanel = false;
    this.selectedDeclarationId = null;
    this.selectedDeclarationRef = '';
  }

  get dashboardTitle(): string {
    if (this.currentUser?.role === 'douanier') {
      return 'Dossiers à Traiter & Historique';
    }
    if (this.currentUser?.role === 'transitaire') {
      return 'Offres en attente';
    }
    if (this.currentUser?.role === 'declarant') {
      return 'Mes déclarations & cargaisons';
    }
    return 'Liste de mes déclarations';
  }

  getTransitaireLabel(declaration: any): string {
    return declaration?.transitaire_id ? `Transitaire #${declaration.transitaire_id}` : 'Non assigné';
  }

  /**
   * Normalise un statut : trim, suppression espaces multiples, passage en minuscule.
   * Utile pour éviter les problèmes de format (ex: "EN_ATTENTE_OFFRES ", "en attente offres", etc.)
   */
  normalizeStatus(statut: any): string {
    return String(statut ?? '')
      .trim()
      .replace(/\s+/g, '_')
      .toLowerCase();
  }

}
