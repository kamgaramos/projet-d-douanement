const express = require('express');
const router = express.Router();
const { getAllNomenclature } = require('../controllers/nomenclatureController');

// Cette route répondra à GET /api/nomenclature/
router.get('/', getAllNomenclature);

module.exports = router;