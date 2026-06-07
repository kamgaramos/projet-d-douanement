import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { DeclarationService } from '../core/services/declaration.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css'
})
export class DashboardComponent implements OnInit {
  currentUser: any = null;
  declarations: any[] = [];
  cargaisonForm!: FormGroup;
  showFormModal: boolean = false;

  constructor(
    private router: Router, 
    private fb: FormBuilder,
    private declarationService: DeclarationService 
  ) {}

  ngOnInit(): void {
    // Récupération de l'utilisateur connecté depuis le localStorage
    const userJson = localStorage.getItem('user');
    
    // Valeur par défaut si le localStorage est vide (pour tes tests)
    this.currentUser = userJson ? JSON.parse(userJson) : { name: 'kamga', role: 'declarant' }; 

    this.loadRealData();
    this.initCargaisonForm();
  }

  initCargaisonForm() {
    this.cargaisonForm = this.fb.group({
      description: ['', [Validators.required, Validators.minLength(5)]],
      typeMarchandise: ['', [Validators.required]],
      poids: ['', [Validators.required, Validators.min(1)]],
      valeur: ['', [Validators.required, Validators.min(1)]]
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
}