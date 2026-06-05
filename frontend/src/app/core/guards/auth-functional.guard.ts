import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const authGuard = (allowedRoles: string[] = []) => {
  return () => {
    const authService = inject(AuthService);
    const router = inject(Router);

    // Vérification de base : l'utilisateur est-il connecté ?
    if (!authService.isLoggedIn()) {
      router.navigate(['/login']);
      return false;
    }

    // Si aucun rôle spécifique requis, accès autorisé
    if (allowedRoles.length === 0) {
      return true;
    }

    // Vérification du rôle
    const userRole = authService.getUserRole();
    if (userRole && allowedRoles.includes(userRole)) {
      return true;
    }

    // Rôle non autorisé
    router.navigate(['/login']);
    return false;
  };
};