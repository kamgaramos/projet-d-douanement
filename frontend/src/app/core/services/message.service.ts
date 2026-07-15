import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface Message {
  id: number;
  declaration_id: number;
  content: string;
  read_status: boolean;
  created_at: string;
  sender: {
    id: number;
    name: string;
    role: string;
    email: string;
  };
  is_own_message: boolean;
}

export interface MessageHistorique {
  message: string;
  declaration: {
    id: number;
    reference: string;
    statut: string;
    port_depart: string;
    port_arrivee: string;
  };
  statistiques: {
    total_messages: number;
    messages_non_lus: number;
  };
  messages: Message[];
}

export interface EnvoyerMessageRequest {
  declaration_id: number;
  content: string;
}

export interface EnvoyerMessageResponse {
  message: string;
  message_data: {
    id: number;
    declaration_id: number;
    content: string;
    created_at: string;
    sender: {
      id: number;
      username: string;
      role: string;
    };
  };
  declaration_reference: string;
}

@Injectable({
  providedIn: 'root'
})
export class MessageService {
  private apiUrl = `${environment.apiUrl}/messages`;

  constructor(private http: HttpClient) {}

  /**
   * Envoyer un message sur un dossier
   */
  envoyerMessage(data: EnvoyerMessageRequest): Observable<EnvoyerMessageResponse> {
    return this.http.post<EnvoyerMessageResponse>(`${this.apiUrl}/envoyer`, data);
  }

  /**
   * Récupérer l'historique des messages d'une déclaration
   */
  obtenirHistoriqueMessages(declarationId: number): Observable<MessageHistorique> {
    return this.http.get<MessageHistorique>(`${this.apiUrl}/dossier/${declarationId}`);
  }

  /**
   * Marquer un message comme lu
   */
  marquerMessageCommeLu(messageId: number): Observable<any> {
    return this.http.patch(`${this.apiUrl}/${messageId}/lu`, {});
  }

  /**
   * Obtenir un résumé de toutes les conversations
   */
  obtenirResumeMesConversations(): Observable<any> {
    return this.http.get(`${this.apiUrl}/mes-conversations`);
  }
}