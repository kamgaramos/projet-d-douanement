import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class DossierService {
  private apiUrl = `${environment.apiUrl}/dossiers`;

  constructor(private http: HttpClient) {}

  /** Détail d'un dossier douane */
  getDossier(id: number): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/${id}`);
  }

  /** Mes dossiers douane (transitaire) */
  getMesDossiers(): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/mes-dossiers`);
  }

  /** Dossiers en attente douane */
  getEnAttente(): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/en-attente`);
  }

  /** Soumettre les documents d'un dossier */
  soumettreDeclaration(dossierId: number): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/${dossierId}/soumettre`, {});
  }
}
