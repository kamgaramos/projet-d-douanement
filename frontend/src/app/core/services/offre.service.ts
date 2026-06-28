import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class OffreService {
  private apiUrl = 'http://localhost:5000/api/offres';

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

  /** Soumettre une offre (transitaire → déclarant) */
  soumettreOffre(offreData: any): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/soumettre`, offreData, { headers: this.getHeaders() });
  }

  /** Lister les offres d'une déclaration */
  getOffresByDeclaration(declarationId: number): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/dossier/${declarationId}`, { headers: this.getHeaders() });
  }

  /** Accepter une offre (déclarant → offre) */
  accepterOffre(offreId: number): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/${offreId}/accepter`, {}, { headers: this.getHeaders() });
  }

  /** Rejeter une offre */
  rejeterOffre(offreId: number, raison?: string): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/${offreId}/rejeter`, { raison }, { headers: this.getHeaders() });
  }

  /** Mes offres (transitaire) */
  getMesOffres(): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/mes-offres`, { headers: this.getHeaders() });
  }
}
