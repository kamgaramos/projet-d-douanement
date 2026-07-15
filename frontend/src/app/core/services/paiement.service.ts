import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface TaxeDetail {
  id: number;
  dossier_id: number;
  declaration_id: number;
  valeur_marchandise: number;
  taux_droit: number;
  droits_douane: number;
  tva_montant: number;
  frais_accessoires: number;
  frais_magasinage: number;
  total_taxes: number;
  statut_paiement: string;
  reference_paiement: string | null;
  mode_paiement: string | null;
  date_paiement: string | null;
  transaction_id: string | null;
}

export interface PaiementInfo {
  dossier_id: number;
  dossier_reference: string;
  declaration_reference: string;
  taxe: TaxeDetail | null;
  statut: string;
  montant_taxes: number;
  reference_paiement: string | null;
  date_paiement: string | null;
  bae_reference: string | null;
}

export interface PaiementResponse {
  message: string;
  bae: { reference: string; url: string; date_generation: string };
  paiement: { reference: string; transaction_id: string; montant: number };
  dossier: any;
}

@Injectable({ providedIn: 'root' })
export class PaiementService {
  private apiUrl = `${environment.apiUrl}/douane`;

  constructor(private http: HttpClient) {}

  /** Récupérer le détail des taxes d'un dossier */
  getTaxes(dossierId: number): Observable<{ taxe: TaxeDetail }> {
    return this.http.get<{ taxe: TaxeDetail }>(`${this.apiUrl}/dossiers/${dossierId}/taxes`);
  }

  /** Effectuer le paiement e-GUCE */
  payer(dossierId: number): Observable<PaiementResponse> {
    return this.http.post<PaiementResponse>(`${this.apiUrl}/dossiers/${dossierId}/payer`, {});
  }

  /** Historique des paiements */
  getHistorique(): Observable<{ count: number; paiements: PaiementInfo[] }> {
    return this.http.get<{ count: number; paiements: PaiementInfo[] }>(`${this.apiUrl}/paiements/historique`);
  }
}
