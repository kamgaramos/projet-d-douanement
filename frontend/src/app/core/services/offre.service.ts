import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class OffreService {
  private apiUrl = `${environment.apiUrl}/offres`;

  constructor(private http: HttpClient) {}

  /** Soumettre une offre (transitaire → déclarant) */
  soumettreOffre(offreData: any): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/soumettre`, offreData);
  }

  /** Lister les offres d'une déclaration */
  getOffresByDeclaration(declarationId: number): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/dossier/${declarationId}`);
  }

  /** Accepter une offre (déclarant → offre) */
  accepterOffre(offreId: number): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/${offreId}/accepter`, {});
  }

  /** Rejeter une offre */
  rejeterOffre(offreId: number, raison?: string): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/${offreId}/rejeter`, { raison });
  }

  /** Mes offres (transitaire) */
  getMesOffres(): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/mes-offres`);
  }
}
