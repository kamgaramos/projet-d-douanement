import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { DeclarationService } from '../core/services/declaration.service';
import { OffreService } from '../core/services/offre.service';
import { DossierService } from '../core/services/dossier.service';
import { DocumentService, DocumentInfo } from '../core/services/document.service';
import { ChatComponent } from '../chat/chat.component';

@Component({
  selector: 'app-declaration-details',
  standalone: true,
  imports: [CommonModule, FormsModule, ChatComponent],
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

  documents: DocumentInfo[] = [];
  offres: any[] = [];
  notifications: any[] = [];
  historique: any[] = [];

  // Upload
  showUploadForm: boolean = false;
  selectedFiles: File[] = [];
  uploadType: string = 'other';
  isUploading: boolean = false;
  uploadError: string = '';
  uploadSuccess: string = '';

  // Dossier douane associé (après acceptation d'une offre)
  dossierDouane: any = null;

  // État de chargement pour l'acceptation
  acceptingOfferId: number | null = null;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private declarationService: DeclarationService,
    private offreService: OffreService,
    private dossierService: DossierService,
    private documentService: DocumentService
  ) {}

  ngOnInit(): void {
    const userJson = localStorage.getItem('user');
    this.currentUser = userJson ? JSON.parse(userJson) : null;

    // Le douanier ne doit pas voir le chat (réservé déclarant/transitaire)
    if (this.currentUser?.role === 'douanier') {
      this.showChat = false;
    }

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
        // Si la déclaration a un transitaire assigné (offre acceptée),
        // charger le dossier douane associé
        if (declaration.transitaire_id && declaration.statut === 'DOSSIER_OUVERT') {
          this.chargerDossierDouane(id);
        }
      },
      error: (error) => {
        console.error('Erreur chargement déclaration:', error);
        this.errorMessage = 'Erreur lors du chargement de la déclaration';
        this.isLoading = false;
      }
    });
  }

  /**
   * Charge le dossier douane associé à cette déclaration.
   */
  chargerDossierDouane(declarationId: number): void {
    this.dossierService.getMesDossiers().subscribe({
      next: (data) => {
        const dossiers = data.dossiers || data;
        if (Array.isArray(dossiers)) {
          this.dossierDouane = dossiers.find((d: any) => d.declaration_id === declarationId) || null;
        }
      },
      error: (err) => console.error('Erreur chargement dossier douane:', err)
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
      'DOSSIER_OUVERT': 'statut-approuve',
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
      'DOSSIER_OUVERT': '📂 Dossier ouvert',
      'EN_COURS_DE_TRANSPORT': '🚚 En cours de transport',
      'approuvée': '✅ Approuvée',
      'rejetée': '❌ Rejetée'
    };
    return statusDisplay[statut?.toLowerCase()] || statut;
  }

  // ── Documents ─────────────────────────────────────────────────────────────

  afficherDocuments(): void {
    this.showDocuments = !this.showDocuments;
    if (this.showDocuments && this.documents.length === 0) {
      this.chargerDocuments();
    }
  }

  chargerDocuments(): void {
    if (!this.declaration?.id) return;

    this.documentService.getDocumentsByDeclaration(this.declaration.id).subscribe({
      next: (data) => {
        this.documents = data.documents || [];
      },
      error: (err) => {
        console.error('Erreur chargement documents:', err);
        this.documents = [];
      }
    });
  }

  // ── Upload de documents ─────────────────────────────────────────────────────

  /** Type de document pour l'upload */
  readonly documentTypes: { key: string; label: string }[] = [
    { key: 'facture', label: 'Facture commerciale' },
    { key: 'bill_of_lading', label: 'Connaissement (B/L)' },
    { key: 'packing_list', label: 'Liste de colisage' },
    { key: 'certificate_origin', label: "Certificat d'origine" },
    { key: 'insurance', label: "Police d'assurance" },
    { key: 'invoice', label: 'Facture proforma' },
    { key: 'customs_declaration', label: 'Déclaration en douane' },
    { key: 'transport_document', label: 'Document de transport' },
    { key: 'quality_certificate', label: 'Certificat de qualité' },
    { key: 'other', label: 'Autre document' }
  ];

  toggleUploadForm(): void {
    this.showUploadForm = !this.showUploadForm;
    if (!this.showUploadForm) {
      this.selectedFiles = [];
      this.uploadError = '';
      this.uploadSuccess = '';
    }
  }

  onFileSelected(event: any): void {
    this.selectedFiles = [];
    this.uploadError = '';
    const files: FileList = event.target.files;
    if (files.length > 5) {
      this.uploadError = 'Maximum 5 fichiers à la fois';
      return;
    }
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (file.size > 10 * 1024 * 1024) {
        this.uploadError = `Le fichier "${file.name}" dépasse 10 MB`;
        return;
      }
      this.selectedFiles.push(file);
    }
  }

  removeFile(index: number): void {
    this.selectedFiles.splice(index, 1);
  }

  uploadDocuments(): void {
    if (!this.selectedFiles.length || !this.declaration?.id) return;

    this.isUploading = true;
    this.uploadError = '';
    this.uploadSuccess = '';

    this.documentService.uploadDocuments(
      this.declaration.id,
      this.uploadType,
      this.selectedFiles
    ).subscribe({
      next: (res) => {
        this.isUploading = false;
        this.uploadSuccess = `${res.documents_created?.length || 0} fichier(s) uploadé(s) avec succès`;
        this.selectedFiles = [];
        this.showUploadForm = false;
        // Recharger la liste
        this.chargerDocuments();
        setTimeout(() => this.uploadSuccess = '', 4000);
      },
      error: (err) => {
        this.isUploading = false;
        this.uploadError = err.error?.details || err.error?.error || 'Erreur lors de l\'upload';
        console.error('Erreur upload:', err);
      }
    });
  }

  /** URL de téléchargement */
  getDocumentDownloadUrl(docId: number): string {
    return this.documentService.getDownloadUrl(docId);
  }

  /** Formater la taille */
  formatFileSize(bytes: number): string {
    if (!bytes) return '0 o';
    if (bytes < 1024) return bytes + ' o';
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' Ko';
    return (bytes / 1048576).toFixed(1) + ' Mo';
  }

  /** Icône selon le type MIME */
  getFileIcon(mimeType: string): string {
    if (mimeType?.includes('pdf')) return '📄';
    if (mimeType?.includes('image')) return '🖼️';
    if (mimeType?.includes('word') || mimeType?.includes('document')) return '📝';
    if (mimeType?.includes('excel') || mimeType?.includes('spreadsheet')) return '📊';
    if (mimeType?.includes('text')) return '📃';
    return '📁';
  }

  // ── Offres (chargées depuis l'API) ─────────────────────────────────────────

  afficherOffres(): void {
    this.showOffers = !this.showOffers;
    if (this.showOffers && this.offres.length === 0 && this.declaration) {
      this.chargerOffres();
    }
  }

  /** Charge les vraies offres depuis l'API */
  chargerOffres(): void {
    if (!this.declaration?.id) return;

    this.offreService.getOffresByDeclaration(this.declaration.id).subscribe({
      next: (data) => {
        this.offres = data.offres || [];
      },
      error: (err) => {
        console.error('Erreur chargement offres:', err);
        this.offres = [];
      }
    });
  }

  // ── Accepter une offre (déclarant) ─────────────────────────────────────────

  /** Accepte une offre avec gestion d'erreur */
  accepterOffre(offreId: number): void {
    if (!confirm('Voulez-vous accepter cette offre ? Cette action est irréversible.')) {
      return;
    }

    this.acceptingOfferId = offreId;

    this.offreService.accepterOffre(offreId).subscribe({
      next: (response) => {
        alert('✅ Offre acceptée ! Le dossier de dédouanement a été créé.');
        this.acceptingOfferId = null;
        // Recharger la déclaration et les offres pour voir le nouveau statut
        this.chargerDeclaration(this.declaration.id);
        this.offres = [];
        this.showOffers = false;
      },
      error: (err) => {
        this.acceptingOfferId = null;
        const errorMsg = err.error?.details || err.error?.error || 'Erreur lors de l\'acceptation';
        alert('❌ ' + errorMsg);
        console.error('Erreur acceptation offre:', err);
      }
    });
  }

  // ── Historique ─────────────────────────────────────────────────────────────

  afficherHistorique(): void {
    this.showHistory = !this.showHistory;
    if (this.showHistory && this.historique.length === 0) {
      this.chargerHistorique();
    }
  }

  chargerHistorique(): void {
    this.historique = [
      { date: new Date(Date.now() - 86400000), action: 'Déclaration créée', utilisateur: 'Vous' },
      { date: new Date(Date.now() - 43200000), action: 'Déclaration publiée', utilisateur: 'Vous' }
    ];
  }

  // ── Notifications ──────────────────────────────────────────────────────────

  afficherNotifications(): void {
    this.showNotifications = !this.showNotifications;
    if (this.showNotifications && this.notifications.length === 0) {
      this.chargerNotifications();
    }
  }

  chargerNotifications(): void {
    this.notifications = [
      { id: 1, titre: 'Bienvenue', message: 'Module de notifications actif', date: new Date() }
    ];
  }
}
