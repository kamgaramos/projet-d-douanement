import { Injectable } from '@angular/core';
import { CanActivate, Router } from '@angular/router';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class DouanierGuard implements CanActivate {
  
  constructor(private router: Router) {}

  canActivate(): Observable<boolean> | Promise<boolean> | boolean {
    const token = localStorage.getItem('token');
    
    if (!token) {
      this.router.navigate(['/login']);
      return false;
    }

    try {
      // Décoder le JWT pour récupérer le payload
      const payload = JSON.parse(atob(token.split('.')[1]));
      
      if (payload.role === 'douanier') {
        return true;
      } else {
        // Rediriger vers le tableau de bord standard si pas douanier
        this.router.navigate(['/dashboard']);
        return false;
      }
    } catch (error) {
      console.error('Erreur lors du décodage du token:', error);
      this.router.navigate(['/login']);
      return false;
    }
  }
}