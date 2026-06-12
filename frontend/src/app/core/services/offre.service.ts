import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class OffreService {
  private apiUrl = 'http://localhost:5000/api/offres';

  constructor(private http: HttpClient) {}

  soumettreOffre(offreData: any): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/soumettre`, offreData);
  }
}
