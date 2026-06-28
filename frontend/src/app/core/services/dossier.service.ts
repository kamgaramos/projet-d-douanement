import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class DossierService {
  private apiUrl = 'http://localhost:5000/api/dossiers';

  constructor(private http: HttpClient) {}

  private getHeaders(): any {
    const userJson = localStorage.getItem('user');
    const token = userJson ? JSON.parse(userJson)?.token : null;
    const headers: any = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
  }

  /** Détail d'un dossier douane */
  getDossier(id: number): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/${id}`, { headers: this.getHeaders() });
  }

  /** Mes dossiers douane (transitaire) */
  getMesDossiers(): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/mes-dossiers`, { headers: this.getHeaders() });
  }

  /** Dossiers en attente douane */
  getEnAttente(): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/en-attente`, { headers: this.getHeaders() });
  }

  /** Soumettre les documents d'un dossier */
  soumettreDeclaration(dossierId: number): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/${dossierId}/soumettre`, {}, { headers: this.getHeaders() });
  }
}
