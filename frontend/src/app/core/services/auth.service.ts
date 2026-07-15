import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Router } from '@angular/router';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private loginUrl = `${environment.apiUrl}/auth/login`;
  private registerUrl = `${environment.apiUrl}/auth/register`;
  private currentUserSubject = new BehaviorSubject<any>(null);

  constructor(private http: HttpClient, private router: Router) {
    const user = localStorage.getItem('user');
    if (user) this.currentUserSubject.next(JSON.parse(user));
  }

  // --- Méthodes exigées par les Guards/Interceptors ---
  isLoggedIn(): boolean {
    return !!localStorage.getItem('token');
  }

  getToken(): string | null {
    return localStorage.getItem('token');
  }

  getUserRole(): string | null {
    const userJson = localStorage.getItem('user');
    if (!userJson) return null;
    return JSON.parse(userJson).role;
  }

  // --- Méthodes Métier ---
  login(credentials: any): Observable<any> {
    return this.http.post(this.loginUrl, credentials).pipe(
      tap((res: any) => {
        localStorage.setItem('token', res.token);
        localStorage.setItem('user', JSON.stringify(res.user));
        this.currentUserSubject.next(res.user);
      })
    );
  }

  // CORRECTION : Accepte un objet unique (payload)
  register(userData: { username: string, email: string, password: string, role: string, num_agrement?: string }): Observable<any> {
    return this.http.post(this.registerUrl, userData);
  }

  getPendingTransitaires(): Observable<any> {
    return this.http.get(`${environment.apiUrl}/auth/transitaires/pending`);
  }

  validerTransitaire(id: number, action: 'APPROVED' | 'REJECTED'): Observable<any> {
    return this.http.post(`${environment.apiUrl}/auth/transitaires/${id}/valider`, { action });
  }

  logout(): void {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    this.currentUserSubject.next(null);
    this.router.navigate(['/login']);
  }
}