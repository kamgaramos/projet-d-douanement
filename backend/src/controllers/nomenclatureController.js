const db = require('../config/db'); // Assure-toi que c'est le bon chemin vers ton fichier de config DB

exports.getAllNomenclature = async (req, res) => {
    try {
        const result = await db.query('SELECT * FROM nomenclature_tarifaire ORDER BY code_sh');
        res.status(200).json(result.rows);
    } catch (error) {
        console.error("Erreur lors de la récupération de la nomenclature :", error);
        res.status(500).json({ message: "Erreur serveur lors de la récupération des données" });
    }
};