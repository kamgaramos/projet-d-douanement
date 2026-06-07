import { Component, OnInit } from '@angular/core'; // <-- Ajout de OnInit ici
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
export class LoginComponent implements OnInit { // <-- Implémentation de OnInit ici

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

  /**
   * Se déclenche dès que l'utilisateur arrive sur la page de connexion
   */
  ngOnInit(): void {
    // NETTOYAGE CRUCIAL : Supprime le token et l'ancien utilisateur pour éviter les conflits de reconnexion
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.clear(); 
  }

  /**
   * Getter pour accéder facilement aux contrôles du formulaire dans le template
   */
  get f() { return this.loginForm.controls; }

  /**
   * Soumission du formulaire de connexion
   */
  onSubmit(): void {
    // Réinitialisation du message d'erreur
    this.errorMessage = '';

    // Vérification de la validité du formulaire
    if (this.loginForm.invalid) {
      return;
    }

    // Activation du spinner de chargement
    this.isLoading = true;

    // Récupération des valeurs du formulaire
    const { email, password } = this.loginForm.value;

    // Appel du service d'authentification
    this.authService.login(email, password).subscribe({
      next: (response) => {
        this.isLoading = false;
        
        // Connexion réussie - Redirection selon le rôle
        this.redirectUserByRole(response.user.role);
      },
      error: (error) => {
        this.isLoading = false;
        
        // Gestion des erreurs de connexion
        if (error.status === 401) {
          this.errorMessage = 'Email ou mot de passe incorrect';
        } else if (error.status === 500) {
          this.errorMessage = 'Erreur serveur. Veuillez réessayer plus tard';
        } else {
          this.errorMessage = 'Une erreur inattendue s\'est produite';
        }
      }
    });
  }

  /**
   * Redirige l'utilisateur vers le tableau de bord approprié selon son rôle
   */
  private redirectUserByRole(role: string): void {
    // Redirection vers /dashboard pour tous les rôles
    this.router.navigate(['/dashboard']);
  }

  /**
   * Navigation vers la page d'inscription (Gardée au cas où pour compatibilité)
   */
  goToRegister(): void {
    this.router.navigate(['/register']);
  }
}