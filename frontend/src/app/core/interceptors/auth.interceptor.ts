import { Injectable } from '@angular/core';
import { HttpInterceptor, HttpRequest, HttpHandler, HttpEvent } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AuthService } from '../services/auth.service';

@Injectable()
export class AuthInterceptor implements HttpInterceptor {

  constructor(private authService: AuthService) {}

  /**
   * Intercepte toutes les requêtes HTTP sortantes et ajoute automatiquement
   * l'en-tête Authorization avec le token JWT s'il est disponible.
   */
  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    
    // Récupération du token depuis le service d'authentification
    const token = this.authService.getToken();

    // Si aucun token n'est disponible, on laisse passer la requête telle quelle
    if (!token) {
      return next.handle(req);
    }

    // Clone de la requête avec l'ajout de l'en-tête Authorization
    const authReq = req.clone({
      headers: req.headers.set('Authorization', `Bearer ${token}`)
    });

    // Transmission de la requête modifiée au handler suivant
    return next.handle(authReq);
  }
}