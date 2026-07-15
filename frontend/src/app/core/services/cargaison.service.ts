import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class CargaisonService {
  private apiUrl = `${environment.apiUrl}/declarations`;

  constructor(private http: HttpClient) {}

  soumettreDeclaration(id: number, statut?: string): Observable<any> {
    const statutFinal = statut || 'EN_ATTENTE_OFFRES';
    return this.http.patch<any>(`${this.apiUrl}/${id}/statut`, { statut: statutFinal });
  }

  getDeclarations(): Observable<any[]> {
    return this.http.get<any[]>(this.apiUrl);
  }
}