import { Component, Input, OnInit, OnChanges, SimpleChanges, ViewChild, ElementRef, AfterViewChecked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, AbstractControl, ValidationErrors } from '@angular/forms';
import { MessageService, Message, MessageHistorique } from '../core/services/message.service';

// Validateur personnalisé pour les messages non vides après trim
function nonEmptyMessageValidator(control: AbstractControl): ValidationErrors | null {
  const value = control.value ? control.value.trim() : '';
  return value.length > 0 ? null : { 'emptyMessage': true };
}

@Component({
  selector: 'app-chat',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './chat.component.html',
  styleUrl: './chat.component.css'
})
export class ChatComponent implements OnInit, OnChanges, AfterViewChecked {
  @Input() declarationId: number | null = null;
  @Input() declarationReference: string = '';
  @ViewChild('messagesContainer') messagesContainer!: ElementRef;

  messages: Message[] = [];
  messageForm: FormGroup;
  isLoading: boolean = false;
  isLoadingMessages: boolean = false;
  isSending: boolean = false;
  errorMessage: string = '';
  currentUser: any = null;
  declaration: any = null;
  statistiques: any = null;

  private shouldScrollToBottom: boolean = false;

  constructor(
    private messageService: MessageService,
    private fb: FormBuilder
  ) {
    this.messageForm = this.fb.group({
      content: ['', [Validators.required, Validators.maxLength(2000), nonEmptyMessageValidator]]
    });
  }

  ngOnInit(): void {
    // Récupérer l'utilisateur connecté
    const userJson = localStorage.getItem('user');
    this.currentUser = userJson ? JSON.parse(userJson) : null;
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['declarationId'] && this.declarationId) {
      this.chargerMessages();
    }
  }

  ngAfterViewChecked(): void {
    if (this.shouldScrollToBottom) {
      this.scrollToBottom();
      this.shouldScrollToBottom = false;
    }
  }

  chargerMessages(): void {
    if (!this.declarationId) return;

    this.isLoadingMessages = true;
    this.errorMessage = '';

    this.messageService.obtenirHistoriqueMessages(this.declarationId).subscribe({
      next: (response: MessageHistorique) => {
        this.messages = response.messages;
        this.declaration = response.declaration;
        this.statistiques = response.statistiques;
        this.isLoadingMessages = false;
        this.shouldScrollToBottom = true;
        
        console.log(`💬 ${this.messages.length} messages chargés pour la déclaration ${this.declarationReference}`);
      },
      error: (error) => {
        console.error('Erreur lors du chargement des messages:', error);
        this.errorMessage = 'Erreur lors du chargement des messages';
        this.isLoadingMessages = false;
        
        if (error.status === 403) {
          this.errorMessage = 'Vous n\'êtes pas autorisé à voir ces messages';
        } else if (error.status === 404) {
          this.errorMessage = 'Déclaration non trouvée';
        }
      }
    });
  }

  envoyerMessage(): void {
    if (this.messageForm.invalid || !this.declarationId || this.isSending) {
      return;
    }

    const content = this.messageForm.get('content')?.value?.trim();
    if (!content) return;

    this.isSending = true;
    this.errorMessage = '';

    const messageData = {
      declaration_id: this.declarationId,
      content: content
    };

    this.messageService.envoyerMessage(messageData).subscribe({
      next: (response) => {
        // Ajouter le nouveau message à la liste
        const nouveauMessage: Message = {
          id: response.message_data.id,
          declaration_id: response.message_data.declaration_id,
          content: response.message_data.content,
          read_status: true,
          created_at: response.message_data.created_at,
          sender: {
            id: response.message_data.sender.id,
            name: response.message_data.sender.username,
            role: response.message_data.sender.role,
            email: ''
          },
          is_own_message: true
        };

        this.messages.push(nouveauMessage);
        this.messageForm.reset();
        this.isSending = false;
        this.shouldScrollToBottom = true;

        // Mettre à jour les statistiques
        if (this.statistiques) {
          this.statistiques.total_messages++;
        }

        console.log('✅ Message envoyé avec succès');
      },
      error: (error) => {
        console.error('Erreur lors de l\'envoi du message:', error);
        this.isSending = false;
        
        if (error.status === 403) {
          this.errorMessage = 'Vous n\'êtes pas autorisé à envoyer des messages sur ce dossier';
        } else if (error.status === 400) {
          this.errorMessage = error.error?.details || 'Données invalides';
        } else {
          this.errorMessage = 'Erreur lors de l\'envoi du message';
        }
      }
    });
  }

  private scrollToBottom(): void {
    try {
      if (this.messagesContainer) {
        const container = this.messagesContainer.nativeElement;
        container.scrollTop = container.scrollHeight;
      }
    } catch (err) {
      console.error('Erreur lors du scroll:', err);
    }
  }

  formatDate(dateString: string): string {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = Math.abs(now.getTime() - date.getTime()) / (1000 * 60 * 60);

    if (diffInHours < 1) {
      return 'À l\'instant';
    } else if (diffInHours < 24) {
      return `Il y a ${Math.floor(diffInHours)}h`;
    } else {
      return date.toLocaleDateString('fr-FR', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      });
    }
  }

  getRoleDisplayName(role: string): string {
    const roleMap: { [key: string]: string } = {
      'declarant': 'Importateur',
      'transitaire': 'Transitaire',
      'douanier': 'Douanier',
      'admin': 'Administrateur'
    };
    return roleMap[role] || role;
  }

  getRoleClass(role: string): string {
    const classMap: { [key: string]: string } = {
      'declarant': 'role-declarant',
      'transitaire': 'role-transitaire',
      'douanier': 'role-douanier',
      'admin': 'role-admin'
    };
    return classMap[role] || 'role-default';
  }

  actualiserMessages(): void {
    this.chargerMessages();
  }

  get messageContent() {
    return this.messageForm.get('content');
  }
}