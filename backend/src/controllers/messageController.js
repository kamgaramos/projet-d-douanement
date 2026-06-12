const Message = require('../models/Message');
const Declaration = require('../models/Declaration');
const { creerNotification, NOTIFICATION_TYPES } = require('../utils/notificationHelper');

const envoyerMessage = async (req, res) => {
    // ... ton code envoyerMessage reste inchangé
    try {
        const { declaration_id, content } = req.body;
        const sender_id = req.user.id;
        const sender_role = req.user.role;

        const declarationResult = await Declaration.findById(declaration_id);
        if (declarationResult.rows.length === 0) return res.status(404).json({ error: 'Déclaration non trouvée' });
        const declaration = declarationResult.rows[0];

        const canSendMessage = (sender_role === 'admin' || sender_role === 'douanier' || declaration.declarant_id === sender_id || declaration.transitaire_id === sender_id);
        if (!canSendMessage) return res.status(403).json({ error: 'Accès refusé' });

        const messageResult = await Message.create({ declaration_id: parseInt(declaration_id), sender_id, content: content.trim() });
        const row = messageResult.rows[0];

        const message_data = {
            id: row.id,
            declaration_id: row.declaration_id,
            content: row.content,
            read_status: row.read_status,
            created_at: row.created_at,
            sender: {
                id: row.sender_id_user || row.sender_id,
                username: row.username || row.sender_name,
                role: row.role || row.sender_role,
                email: row.email || row.sender_email
            }
        };

        res.status(201).json({ message: 'Message envoyé', message_data });
    } catch (error) {
        res.status(500).json({ error: 'Erreur serveur', details: error.message });
    }
};

const obtenirHistoriqueMessages = async (req, res) => {
    // ... ton code obtenirHistoriqueMessages reste inchangé
    try {
        const { declaration_id } = req.params;
        const user_id = req.user.id;
        const declarationResult = await Declaration.findById(declaration_id);
        if (declarationResult.rows.length === 0) return res.status(404).json({ error: 'Déclaration non trouvée' });
        const declaration = declarationResult.rows[0];
        
        const canView = (req.user.role === 'admin' || req.user.role === 'douanier' || declaration.declarant_id === user_id || declaration.transitaire_id === user_id);
        if (!canView) return res.status(403).json({ error: 'Accès refusé' });

        const messagesResult = await Message.findByDeclaration(declaration_id);
        // Marquer les messages reçus comme lus pour l'utilisateur courant
        await Message.markAllAsReadForUser(declaration_id, user_id);

        const messages = messagesResult.rows.map(row => ({
            id: row.id,
            declaration_id: row.declaration_id,
            content: row.content,
            read_status: row.read_status,
            created_at: row.created_at,
            sender: {
                id: row.sender_id,
                name: row.sender_name || row.username,
                role: row.sender_role || row.role,
                email: row.sender_email || row.email
            },
            is_own_message: row.sender_id === user_id
        }));

        // Statistiques basiques pour le frontend
        const unreadResult = await Message.countUnreadForDeclaration(declaration_id, user_id);
        const statistiques = {
            total_messages: messages.length,
            messages_non_lus: parseInt(unreadResult.rows[0]?.unread_count || 0, 10)
        };

        res.status(200).json({ messages, declaration, statistiques });
    } catch (error) {
        res.status(500).json({ error: 'Erreur serveur', details: error.message });
    }
};

// AJOUT DE LA FONCTION MANQUANTE
const marquerMessageCommeLu = async (req, res) => {
    try {
        const { message_id } = req.params;
        await Message.markAsRead(message_id);
        res.status(200).json({ message: 'Message marqué comme lu' });
    } catch (error) {
        res.status(500).json({ error: 'Erreur serveur' });
    }
};

const obtenirResumeMesConversations = async (req, res) => {
    try {
        const conversations = await Message.getLastMessagesByUser(req.user.id);
        res.status(200).json({ conversations: conversations.rows });
    } catch (error) {
        res.status(500).json({ error: 'Erreur serveur' });
    }
};

// EXPORT CORRECT
module.exports = {
    envoyerMessage,
    obtenirHistoriqueMessages,
    marquerMessageCommeLu,
    obtenirResumeMesConversations
};