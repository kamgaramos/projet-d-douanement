import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface NomenclatureItem {
  code_sh: string;
  description: string;
  taux_droit: number;
  [key: string]: any;
}

@Injectable({ providedIn: 'root' })
export class NomenclatureService {
  private apiUrl = `${environment.apiUrl}/nomenclature`;

  constructor(private http: HttpClient) {}

  /** Récupérer toute la nomenclature douanière */
  getAll(): Observable<NomenclatureItem[]> {
    return this.http.get<NomenclatureItem[]>(this.apiUrl);
  }
}
