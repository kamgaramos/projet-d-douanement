import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { DeclarationService } from '../core/services/declaration.service'; // <-- Importation du service

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
    private declarationService: DeclarationService // <-- Injection du service
  ) {}

  ngOnInit(): void {
    // Récupération dynamique de l'utilisateur connecté depuis le stockage local
    const userJson = localStorage.getItem('user');
    this.currentUser = userJson ? JSON.parse(userJson) : { name: 'Kamga', role: 'declarant' }; 

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

  // Chargement des données réelles depuis l'API Node.js
  loadRealData() {
    this.declarationService.getDeclarations().subscribe({
      next: (data) => {
        this.declarations = data;
      },
      error: (err) => {
        console.error('Erreur lors de la récupération des cargaisons:', err);
      }
    });
  }

  openModal() {
    this.showFormModal = true;
  }

  closeModal() {
    this.showFormModal = false;
    this.cargaisonForm.reset();
  }

  // Envoi de la nouvelle cargaison en base de données
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
        console.log('Cargaison enregistrée avec succès !', response);
        this.loadRealData(); // Recharge les données fraîches depuis PostgreSQL
        this.closeModal();
      },
      error: (err) => {
        console.error("Erreur lors de l'enregistrement de la cargaison:", err);
      }
    });
  }

  getCountByStatus(status: string): number {
    return this.declarations.filter(d => d.status === status).length;
  }

  onLogout(): void {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    this.router.navigate(['/login']);
  }
}