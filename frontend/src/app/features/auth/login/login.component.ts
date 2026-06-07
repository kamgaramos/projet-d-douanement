import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css']
})
export class LoginComponent implements OnInit {

  loginForm: FormGroup;
  errorMessage: string = '';
  isLoading: boolean = false;

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router
  ) {
    // Initialisation du formulaire réactif avec validators
    this.loginForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]]
    });
  }

  ngOnInit(): void {
    // Nettoyage du localStorage pour éviter les conflits
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  }

  get f() { return this.loginForm.controls; }

  onSubmit(): void {
    this.errorMessage = '';

    if (this.loginForm.invalid) {
      return;
    }

    this.isLoading = true;

    // Utilisation du nouveau service d'authentification
    this.authService.login(this.loginForm.value).subscribe({
      next: (response) => {
        this.isLoading = false;
        console.log('Connexion réussie:', response);
        
        // Redirection selon le rôle utilisateur
        if (response.user.role === 'douanier') {
          this.router.navigate(['/douanier-dashboard']);
        } else {
          this.router.navigate(['/dashboard']);
        }
      },
      error: (error) => {
        this.isLoading = false;
        console.error('Erreur de connexion:', error);
        
        // Affichage détaillé de l'erreur dans la console
        if (error.error && error.error.message) {
          console.error('Message d\'erreur serveur:', error.error.message);
          this.errorMessage = error.error.message;
        } else if (error.status === 401) {
          this.errorMessage = 'Email ou mot de passe incorrect';
        } else if (error.status === 500) {
          this.errorMessage = 'Erreur serveur. Veuillez réessayer plus tard';
        } else {
          this.errorMessage = 'Une erreur de connexion s\'est produite';
          console.error('Erreur complète:', error);
        }
      }
    });
  }

  goToRegister(): void {
    this.router.navigate(['/register']);
  }
}