import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms'; // <-- Ajout des modules de formulaire

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule], // <-- Ajout de ReactiveFormsModule ici
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css'
})
export class DashboardComponent implements OnInit {
  currentUser: any = null;
  declarations: any[] = [];
  
  // Variables pour la gestion du formulaire de cargaison
  cargaisonForm!: FormGroup;
  showFormModal: boolean = false;

  constructor(private router: Router, private fb: FormBuilder) {}

  ngOnInit(): void {
    this.currentUser = { name: 'Kamga', role: 'declarant' }; 
    this.loadMockData();
    this.initCargaisonForm();
  }

  // Initialisation du formulaire réactif avec validations
  initCargaisonForm() {
    this.cargaisonForm = this.fb.group({
      description: ['', [Validators.required, Validators.minLength(5)]],
      typeMarchandise: ['', [Validators.required]],
      poids: ['', [Validators.required, Validators.min(1)]],
      valeur: ['', [Validators.required, Validators.min(1)]]
    });
  }

  // Ouvre la boîte de dialogue
  openModal() {
    this.showFormModal = true;
  }

  // Ferme la boîte de dialogue et réinitialise le formulaire
  closeModal() {
    this.showFormModal = false;
    this.cargaisonForm.reset();
  }

  // Soumission du formulaire
  onAddCargaison() {
    if (this.cargaisonForm.invalid) {
      return;
    }

    // Création de l'objet cargaison avec une référence générée automatiquement
    const newCargaison = {
      reference: `DEC-2026-00${this.declarations.length + 1}`,
      description: this.cargaisonForm.value.description,
      typeMarchandise: this.cargaisonForm.value.typeMarchandise,
      poids: this.cargaisonForm.value.poids,
      valeur: this.cargaisonForm.value.valeur,
      status: 'En attente'
    };

    // On l'ajoute au début de notre liste locale pour simuler l'insertion
    this.declarations.unshift(newCargaison);

    // On ferme le formulaire
    this.closeModal();
  }

  loadMockData() {
    this.declarations = [
      {
        reference: 'DEC-2026-001',
        description: 'Conteneur de matériel informatique',
        typeMarchandise: 'Électronique',
        poids: 4500,
        valeur: 75000,
        status: 'En attente'
      },
      {
        reference: 'DEC-2026-002',
        description: 'Sacs de riz importés',
        typeMarchandise: 'Alimentaire',
        poids: 12000,
        valeur: 18000,
        status: 'Approuvé'
      },
      {
        reference: 'DEC-2026-003',
        description: 'Pièces de rechange automobiles',
        typeMarchandise: 'Mécanique',
        poids: 1800,
        valeur: 32000,
        status: 'Rejeté'
      }
    ];
  }

  getCountByStatus(status: string): number {
    return this.declarations.filter(d => d.status === status).length;
  }

  onLogout(): void {
    this.router.navigate(['/login']);
  }
}