import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface DocumentInfo {
  id: number;
  nom_fichier: string;
  type_document: string;
  taille_fichier: number;
  mime_type: string;
  uploaded_by_name: string;
  uploaded_at: string;
}

export interface DocumentsResponse {
  message: string;
  declaration: any;
  statistiques: {
    total_documents: number;
    taille_totale_bytes: number;
    repartition_par_type: any[];
  };
  documents: DocumentInfo[];
}

@Injectable({
  providedIn: 'root'
})
export class DocumentService {
  private apiUrl = 'http://localhost:5000/api/documents';

  constructor(private http: HttpClient) {}

  /** Lister les documents d'une déclaration */
  getDocumentsByDeclaration(declarationId: number): Observable<DocumentsResponse> {
    return this.http.get<DocumentsResponse>(`${this.apiUrl}/declaration/${declarationId}`);
  }

  /** Uploader des documents */
  uploadDocuments(declarationId: number, typeDocument: string, files: File[]): Observable<any> {
    const formData = new FormData();
    formData.append('declaration_id', declarationId.toString());
    formData.append('type_document', typeDocument);

    for (const file of files) {
      formData.append('documents', file, file.name);
    }

    return this.http.post(`${this.apiUrl}/upload`, formData);
  }

  /** Télécharger un document */
  getDownloadUrl(documentId: number): string {
    return `${this.apiUrl}/download/${documentId}`;
  }

  /** Supprimer un document */
  supprimerDocument(documentId: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/${documentId}`);
  }
}
