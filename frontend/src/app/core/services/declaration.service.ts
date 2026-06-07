import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AuthService } from './auth.service';

@Injectable({
  providedIn: 'root'
})
export class DeclarationService {
  // L'URL de ton backend Node.js
  private apiUrl = 'http://localhost:5000/api/declarations';

  constructor(
    private http: HttpClient,
    private authService: AuthService
  ) {}

  // Récupérer toutes les déclarations/cargaisons
  getDeclarations(): Observable<any[]> {
    return this.http.get<any[]>(this.apiUrl);
  }

  // Créer une nouvelle cargaison
  createCargaison(cargaisonData: any): Observable<any> {
    return this.http.post<any>(this.apiUrl, cargaisonData);
  }

  // Mettre à jour le statut (utile pour le douanier plus tard)
  updateStatut(id: number, status: string): Observable<any> {
    return this.http.patch<any>(`${this.apiUrl}/${id}/statut`, { statut: status });
  }
}