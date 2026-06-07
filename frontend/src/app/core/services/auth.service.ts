import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, BehaviorSubject } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Router } from '@angular/router';

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface AuthResponse {
  token: string;
  user: {
    id: number;
    name: string;
    email: string;
    role: string;
  };
  message?: string;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  // URL complète forcée pour éviter les ambiguïtés
  private loginUrl = 'http://localhost:5000/api/auth/login';
  private registerUrl = 'http://localhost:5000/api/auth/register';
  
  private currentUserSubject = new BehaviorSubject<any>(null);
  public currentUser$ = this.currentUserSubject.asObservable();

  constructor(
    private http: HttpClient,
    private router: Router
  ) {
    this.checkExistingAuth();
  }

  login(credentials: LoginCredentials): Observable<AuthResponse> {
    // Ajout explicite du header Content-Type pour le serveur Node.js
    const headers = new HttpHeaders({ 'Content-Type': 'application/json' });
    
    console.log("Service: Envoi de la requête de login vers", this.loginUrl);
    
    return this.http.post<AuthResponse>(this.loginUrl, credentials, { headers })
      .pipe(
        tap({
          next: (response) => {
            console.log("Service: Réponse reçue du serveur", response);
            if (response.token && response.user) {
              localStorage.setItem('token', response.token);
              localStorage.setItem('user', JSON.stringify(response.user));
              this.currentUserSubject.next(response.user);
            }
          },
          error: (err) => {
            console.error("Service: Erreur lors de la requête HTTP", err);
          }
        })
      );
  }

  register(userData: any): Observable<any> {
    const headers = new HttpHeaders({ 'Content-Type': 'application/json' });
    return this.http.post<any>(this.registerUrl, userData, { headers });
  }

  logout(): void {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    this.currentUserSubject.next(null);
    this.router.navigate(['/login']);
  }

  isAuthenticated(): boolean {
    return !!localStorage.getItem('token');
  }

  getCurrentUser(): any {
    const userJson = localStorage.getItem('user');
    return userJson ? JSON.parse(userJson) : null;
  }

  private checkExistingAuth(): void {
    const user = this.getCurrentUser();
    if (user) {
      this.currentUserSubject.next(user);
    }
  }
}