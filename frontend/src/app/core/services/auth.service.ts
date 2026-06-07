import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, tap } from 'rxjs';

/**
 * Types de rôles gérés côté frontend.
 * (backend: 'declarant' et 'douanier')
 */
export type AppRole = 'declarant' | 'douanier';

// Structure de la réponse renvoyée par POST /api/auth/login
export interface LoginResponse {
  token: string;
  user: {
    id: number;
    username: string;
    email: string;
    role: AppRole | string;
  };
}

// Structure de la réponse renvoyée par POST /api/auth/register
export interface RegisterResponse {
  id: number;
  username: string;
  email: string;
  role: string;
  created_at: string;
}

@Injectable({ providedIn: 'root' })
export class AuthService {

  private readonly API_URL = 'http://localhost:5000/api/auth';

  // Clés utilisées pour le stockage dans localStorage
  private readonly TOKEN_KEY = 'token';
  private readonly USER_KEY  = 'user';

  constructor(private http: HttpClient, private router: Router) {}

  /**
   * Envoie les identifiants au backend et stocke le token + user en localStorage.
   */
  login(email: string, password: string): Observable<LoginResponse> {
    // Sécurité : on nettoie tout AVANT de stocker le nouveau token
    localStorage.clear();

    return this.http.post<LoginResponse>(`${this.API_URL}/login`, { email, password }).pipe(
      tap((response) => {
        localStorage.setItem(this.TOKEN_KEY, response.token);
        localStorage.setItem(this.USER_KEY, JSON.stringify(response.user));
      })
    );
  }

  /**
   * Inscrit un nouvel utilisateur (déclarant ou douanier).
   */
  register(
    username: string,
    email: string,
    password: string,
    role: AppRole = 'declarant'
  ): Observable<RegisterResponse> {
    return this.http.post<RegisterResponse>(`${this.API_URL}/register`, {
      username, email, password, role,
    });
  }

  // ─── Méthodes utilitaires ───────────────────────────────────────────────────

  /** Récupère le token JWT depuis le localStorage. */
  getToken(): string | null {
    return localStorage.getItem(this.TOKEN_KEY);
  }

  /** Récupère le rôle de l'utilisateur connecté. */
  getUserRole(): string | null {
    const user = localStorage.getItem(this.USER_KEY);
    return user ? JSON.parse(user).role : null;
  }

  /** Récupère l'objet utilisateur complet. */
  getUser(): LoginResponse['user'] | null {
    const user = localStorage.getItem(this.USER_KEY);
    return user ? JSON.parse(user) : null;
  }

  /** Retourne true si un token est présent en localStorage. */
  isLoggedIn(): boolean {
    return !!this.getToken();
  }

  /**
   * Supprime TOUTES les données de session et redirige proprement.
   * Version optimisée sans rechargement lourd du navigateur.
   */
  logout(): void {
    // 1. Nettoyage complet et immédiat du localStorage
    localStorage.removeItem(this.TOKEN_KEY);
    localStorage.removeItem(this.USER_KEY);
    localStorage.clear();

    // 2. Redirection fluide gérée par le routeur d'Angular
    this.router.navigate(['/login']);
  }
}