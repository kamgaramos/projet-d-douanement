import { Injectable } from '@angular/core';
import { CanActivate, ActivatedRouteSnapshot, RouterStateSnapshot, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

@Injectable({ providedIn: 'root' })
export class AuthGuard implements CanActivate {

  constructor(private authService: AuthService, private router: Router) {}

  /**
   * Vérifie si l'utilisateur est autorisé à accéder à une route protégée.
   * 
   * @param route - Contient les informations sur la route (incluant les data avec allowedRoles)
   * @param state - État du routeur
   * @returns true si l'accès est autorisé, false sinon
   */
  canActivate(route: ActivatedRouteSnapshot, state: RouterStateSnapshot): boolean {
    
    // Vérification de base : l'utilisateur est-il connecté ?
    if (!this.authService.isLoggedIn()) {
      // Redirection vers la page de connexion avec l'URL de destination
      this.router.navigate(['/login'], { 
        queryParams: { returnUrl: state.url } 
      });
      return false;
    }

    // Récupération des rôles autorisés depuis les données de la route
    const allowedRoles = route.data?.['allowedRoles'] as string[];
    
    // Si aucun rôle spécifique n'est requis, l'accès est autorisé
    if (!allowedRoles || allowedRoles.length === 0) {
      return true;
    }

    // Vérification du rôle de l'utilisateur connecté
    const userRole = this.authService.getUserRole();
    
    if (userRole && allowedRoles.includes(userRole)) {
      return true; // L'utilisateur a un rôle autorisé
    }

    // L'utilisateur n'a pas le bon rôle - redirection vers une page d'accès refusé
    this.router.navigate(['/access-denied']);
    return false;
  }
}