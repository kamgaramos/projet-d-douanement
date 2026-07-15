import { Component } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './register.component.html',
  styleUrls: ['./register.component.css']
})
export class RegisterComponent {

  availableRoles = [
    { value: 'declarant', label: 'Déclarant' },
    { value: 'douanier', label: 'Douanier' },
    { value: 'transitaire', label: 'Transitaire' }
  ];

  registerForm: FormGroup;
  errorMessage: string = '';
  successMessage: string = '';
  isLoading: boolean = false;

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router
  ) {
    this.registerForm = this.fb.group({
      username: ['', [Validators.required, Validators.minLength(3)]],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]],
      role: ['declarant', Validators.required],
      num_agrement: ['']
    });

    // Rendre le numéro d'agrément requis uniquement pour le rôle transitaire
    this.registerForm.get('role')?.valueChanges.subscribe(role => {
      const agrementControl = this.registerForm.get('num_agrement');
      if (role === 'transitaire') {
        agrementControl?.setValidators([Validators.required, Validators.minLength(4)]);
      } else {
        agrementControl?.clearValidators();
        agrementControl?.setValue('');
      }
      agrementControl?.updateValueAndValidity();
    });
  }

  get f() { return this.registerForm.controls; }

  onSubmit(): void {
    this.errorMessage = '';
    this.successMessage = '';

    if (this.registerForm.invalid) return;

    this.isLoading = true;

    // MODIFICATION : On envoie l'objet entier au service au lieu de 4 arguments séparés
    this.authService.register(this.registerForm.value).subscribe({
      next: () => {
        this.isLoading = false;
        this.successMessage = 'Compte créé avec succès ! Redirection...';
        setTimeout(() => this.router.navigate(['/login']), 1500);
      },
      error: (error) => {
        this.isLoading = false;
        if (error.status === 409) {
          this.errorMessage = 'Cet email est déjà utilisé';
        } else if (error.error && error.error.message) {
          this.errorMessage = error.error.message;
        } else {
          this.errorMessage = 'Une erreur est survenue. Veuillez réessayer';
        }
      }
    });
  }

  goToLogin(): void {
    this.router.navigate(['/login']);
  }
}