import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { DeclarationService } from '../core/services/declaration.service';
import { CargaisonService } from '../core/services/cargaison.service';
import { OffreService } from '../core/services/offre.service';
import { DossierService } from '../core/services/dossier.service';
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
  
  selectedDeclarationId: number | null = null;
  selectedDeclarationRef: string = '';
  showChatPanel: boolean = false;

  // Propriétés pour voir le détail de l'offre (transitaire)
  showOfferDetailsModal: boolean = false;
  selectedOfferDetails: any = null;

  // Propriétés pour voir le détail de la cargaison (transitaire avant offre)
  showCargoModal: boolean = false;
  selectedCargo: any = null;

  // Dossiers douane pour le transitaire
  dossiersDouane: any[] = [];
  
  // Modifié ici : utilisation de any[] pour plus de souplesse
  nomenclatures: any[] = [];
  nomenclatureLoading = false;
  nomenclatureError = '';

  constructor(
    private router: Router,
    private fb: FormBuilder,
    private declarationService: DeclarationService,
    private cargaisonService: CargaisonService,
    private offreService: OffreService,
    private dossierService: DossierService
  ) {}

  ngOnInit(): void {
    const userJson = localStorage.getItem('user');
    this.currentUser = userJson ? JSON.parse(userJson) : { name: 'kamga', role: 'declarant' };

    if (this.currentUser?.role === 'douanier') {
      this.router.navigate(['/douanier-dashboard']);
      return;
    }

    this.loadRealData();
    this.initCargaisonForm();
    this.loadNomenclature();
    this.initOfferForm();
    this.loadDossiersDouane();
  }

  initCargaisonForm() {
    this.cargaisonForm = this.fb.group({
      description: ['', [Validators.required, Validators.minLength(5)]],
      code_sh: ['', [Validators.required]],
      typeMarchandise: ['', [Validators.required]],
      poids: ['', [Validators.required, Validators.min(1)]],
      valeur: ['', [Validators.required, Validators.min(1)]]
    });
  }

  private loadNomenclature() {
    this.nomenclatureLoading = true;
    this.nomenclatureError = '';
    const apiUrl = 'http://localhost:5000/api/nomenclature';

    fetch(apiUrl)
      .then(async (res) => {
        if (!res.ok) throw new Error(await res.text());
        return res.json();
      })
      .then((data) => {
        // Ajout d'un log pour vérifier la structure exacte des données reçues
        console.log("Structure des nomenclatures reçues :", data);
        this.nomenclatures = Array.isArray(data) ? data : [];
        this.nomenclatureLoading = false;
      })
      .catch((err) => {
        console.error('Erreur GET /api/nomenclature:', err);
        this.nomenclatureError = 'Impossible de charger la nomenclature.';
        this.nomenclatureLoading = false;
      });
  }

  // --- Reste des méthodes inchangées ---
  chargerDeclarations() { this.loadRealData(); }

  soumettre(id: number) {
    this.cargaisonService.soumettreDeclaration(id).subscribe({
      next: () => this.chargerDeclarations(),
      error: (err) => { alert('Erreur lors de la soumission'); console.error(err); }
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
  }

  closeOfferModal(): void { this.showOfferModal = false; this.offerForm.reset(); }

  faireOffre(declaration: any) { this.openOfferModal(declaration); }

  /** Affiche les détails de l'offre soumise par le transitaire */
  voirMonOffre(declaration: any): void {
    if (declaration.mon_offre) {
      this.selectedOfferDetails = declaration.mon_offre;
      this.selectedOfferDeclarationRef = declaration.reference || ('DEC-' + declaration.id);
      this.showOfferDetailsModal = true;
    }
  }

  closeOfferDetailsModal(): void {
    this.showOfferDetailsModal = false;
    this.selectedOfferDetails = null;
  }

  /** Affiche le détail de la cargaison (transitaire avant soumission d'offre) */
  voirCargaison(declaration: any): void {
    this.selectedCargo = declaration;
    this.selectedOfferDeclarationRef = declaration.reference || ('DEC-' + declaration.id);
    this.showCargoModal = true;
  }

  closeCargoModal(): void {
    this.showCargoModal = false;
    this.selectedCargo = null;
  }

  soumettreOffre(): void {
    if (!this.selectedOfferDeclaration || this.offerForm.invalid) return;

    const payload = {
      declaration_id: this.selectedOfferDeclaration.id,
      ...this.offerForm.value
    };

    this.offreService.soumettreOffre(payload).subscribe({
      next: () => {
        this.closeOfferModal();
        this.loadRealData();
        // Ouvrir le chat avec le déclarant après soumission
        this.ouvrirChat(this.selectedOfferDeclaration);
      },
      error: (err) => { console.error(err); alert('Erreur envoi offre.'); }
    });
  }

  voirDetails(declaration: any): void { this.router.navigate(['/declaration-details', declaration.id]); }

  supprimerDeclaration(declaration: any): void {
    if (!confirm('Supprimer cette cargaison ?')) return;
    this.declarationService.supprimerDeclaration(declaration.id).subscribe({
      next: () => this.loadRealData(),
      error: (err) => console.error(err)
    });
  }

  loadRealData() {
    this.declarationService.getDeclarations().subscribe({
      next: (data) => {
        this.declarations = data.sort((a, b) => {
          const statusA = (a.statut || '').toLowerCase();
          return statusA === 'en attente' ? -1 : 1;
        });
      },
      error: (err) => console.error('Erreur chargement:', err)
    });
  }

  onUpdateStatus(id: number, status: string) {
    if (confirm(`Confirmer ${status} ?`)) {
      this.declarationService.updateStatut(id, status).subscribe(() => this.loadRealData());
    }
  }

  openModal() { this.showFormModal = true; }
  closeModal() { this.showFormModal = false; this.cargaisonForm.reset(); }

  onAddCargaison() {
    if (this.cargaisonForm.invalid) return;
    this.declarationService.createCargaison(this.cargaisonForm.value).subscribe({
      next: () => { this.loadRealData(); this.closeModal(); },
      error: (err) => console.error(err)
    });
  }

  getCountByStatus(status: string): number {
    return this.declarations.filter(d => (d.statut || '').toLowerCase() === status.toLowerCase()).length;
  }

  onLogout(): void {
    localStorage.clear();
    this.router.navigate(['/login']);
  }
  
  ouvrirChat(declaration: any): void {
    this.selectedDeclarationId = declaration.id;
    this.selectedDeclarationRef = declaration.reference || ('DEC-' + declaration.id);
    this.showChatPanel = true;
  }

  fermerChat(): void { this.showChatPanel = false; }

  
  get dashboardTitle(): string { return 'Tableau de bord'; }

  // Normalise les statuts pour comparer correctement même si la chaîne contient espaces/casse variés
  normalizeStatus(statut: any): string {
    return String(statut ?? '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .replace(/\s+/g, '_');
  }

  isOffresEnAttente(statut: any): boolean {
    // Support: EN_ATTENTE_OFFRES / En attente offres / en attente offres etc.
    const s = this.normalizeStatus(statut);
    return s === 'en_attente_offres';
  }

  /** Vérifie si le transitaire connecté a déjà soumis une offre pour cette déclaration */
  aDejaSoumisOffre(item: any): boolean {
    return item && item.mon_offre_id != null;
  }

  /** Affiche le nom du/des transitaire(s) ayant soumis une offre (côté déclarant) */
  getTransitaireLabel(item: any): string {
    if (item.transitaire_id) {
      return `Transitaire #${item.transitaire_id}`;
    }
    if (item.transitaires_offreurs && item.transitaires_offreurs.length > 0) {
      return item.transitaires_offreurs.join(', ');
    }
    return 'Non assigné';
  }

  /** Nombre d'offres reçues pour une déclaration */
  getOffreCount(item: any): number {
    return item?.offre_count || 0;
  }

  /** Charge les dossiers douane (pour transitaire) */
  loadDossiersDouane(): void {
    if (this.currentUser?.role !== 'transitaire') return;

    this.dossierService.getMesDossiers().subscribe({
      next: (data) => {
        this.dossiersDouane = data.dossiers || data || [];
      },
      error: (err) => console.error('Erreur chargement dossiers douane:', err)
    });
  }
}

