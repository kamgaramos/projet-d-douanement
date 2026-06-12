import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ChatComponent } from '../chat/chat.component';

@Component({
  selector: 'app-test-chat',
  standalone: true,
  imports: [CommonModule, ChatComponent],
  template: `
    <div style="padding: 2rem; background: #f0f0f0; min-height: 100vh;">
      <h1>🧪 TEST CHAT</h1>
      <p>Si vous voyez ce composant, Angular fonctionne !</p>
      
      <div style="margin: 2rem 0; padding: 1rem; background: white; border: 2px solid #007acc; border-radius: 8px;">
        <h2>Test du Chat</h2>
        <button 
          class="btn-test" 
          (click)="toggleChat()" 
          style="padding: 1rem 2rem; background: #007acc; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 1rem;">
          {{ showChat ? '❌ Fermer Chat' : '💬 Ouvrir Chat' }}
        </button>
        
        <div *ngIf="showChat" style="margin-top: 2rem; height: 600px; border: 2px solid #ccc; border-radius: 8px;">
          <app-chat 
            [declarationId]="testDeclarationId"
            [declarationReference]="testDeclarationRef">
          </app-chat>
        </div>
      </div>
      
      <div style="margin-top: 2rem; padding: 1rem; background: #fff3cd; border: 1px solid #856404; border-radius: 4px;">
        <h3>🔧 Informations de debug :</h3>
        <p><strong>ID Déclaration:</strong> {{ testDeclarationId }}</p>
        <p><strong>Référence:</strong> {{ testDeclarationRef }}</p>
        <p><strong>Chat visible:</strong> {{ showChat ? 'OUI' : 'NON' }}</p>
        <p><strong>Utilisateur:</strong> {{ getCurrentUser() }}</p>
        <p><strong>Token:</strong> {{ getToken() ? 'PRÉSENT' : 'ABSENT' }}</p>
      </div>
    </div>
  `,
  styles: [`
    .btn-test:hover {
      background: #005999 !important;
    }
  `]
})
export class TestChatComponent {
  showChat = false;
  testDeclarationId = 1;
  testDeclarationRef = 'TEST-DEC-001';

  toggleChat() {
    this.showChat = !this.showChat;
    console.log('🧪 Chat toggle:', this.showChat);
  }

  getCurrentUser() {
    const user = localStorage.getItem('user');
    return user ? JSON.parse(user).username || JSON.parse(user).name : 'Non connecté';
  }

  getToken() {
    return localStorage.getItem('token');
  }
}