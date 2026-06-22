# TODO

- [ ] Fix core workflow: in `backend/src/controllers/declarationController.js` update `accepterOffre` to transition `EN_ATTENTE_OFFRES` -> `EN_ATTENTE_VALIDATION_DOUANE` (instead of `EN_COURS_DE_TRANSPORT`).
- [ ] Security fix in `accepterOffre`: ensure role check allows transitaire (current check appears inconsistent).
- [ ] Add notification trigger on transition to `EN_ATTENTE_VALIDATION_DOUANE` for douaniers.
- [ ] Ensure douanier dashboard visual notification indicator works with notification payload/declaration id.
- [ ] Run backend + frontend verification steps.

