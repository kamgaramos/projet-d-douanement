import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface NotificationItem {
  id: number;
  message: string;
  type: string;
  is_read: boolean;
  created_at: string;
  read_at: string | null;
  declaration: {
    id: number;
    reference: string;
    port_depart?: string;
    port_arrivee?: string;
  };
  metadata: any;
}

export interface NotificationsResponse {
  message: string;
  statistiques: {
    total_notifications: number;
    non_lues: number;
    repartition_par_type: any[];
  };
  notifications: NotificationItem[];
}

@Injectable({ providedIn: 'root' })
export class NotificationService {
  private apiUrl = `${environment.apiUrl}/notifications`;

  constructor(private http: HttpClient) {}

  /** Récupérer toutes ses notifications */
  obtenirMesAlertes(limit: number = 50, unreadOnly: boolean = false): Observable<NotificationsResponse> {
    return this.http.get<NotificationsResponse>(
      `${this.apiUrl}/mes-alertes?limit=${limit}&unread_only=${unreadOnly}`
    );
  }

  /** Marquer une notification comme lue */
  marquerCommeLue(notificationId: number): Observable<any> {
    return this.http.patch(`${this.apiUrl}/${notificationId}/lu`, {});
  }

  /** Marquer toutes les notifications comme lues */
  marquerToutesCommeLues(): Observable<any> {
    return this.http.patch(`${this.apiUrl}/marquer-toutes-lues`, {});
  }
}
