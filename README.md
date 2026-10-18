# Riftbound Tracker

Appli mobile (PWA, hors ligne) pour saisir ses matchs de tournoi Riftbound (Bo3) et analyser ses match-ups.
Les données restent sur le téléphone. L'export et l'import se font en fichier JSON.

## Lancer en local

```bash
npm install
npm run dev -- --host   # puis ouvrir l'adresse "Network" sur le téléphone (même Wi-Fi)
npm test                # tests du moteur de stats et de l'import/export
npm run build           # version de production dans dist/
```

## Installer sur le téléphone

Pour être installable et marcher hors ligne, l'appli doit être servie en HTTPS. Le plus simple est GitHub Pages :

1. Créer un dépôt GitHub et y pousser ce dossier (branche `main`).
2. Dans le dépôt : **Settings → Pages → Source : GitHub Actions**.
3. Le workflow `.github/workflows/deploy.yml` teste, construit et publie l'appli à chaque push.
4. Ouvrir l'URL sur le téléphone, puis l'ajouter à l'écran d'accueil (menu du navigateur → « Installer l'application » ou « Ajouter à l'écran d'accueil »).

## Sauvegarder ses données

Les données sont stockées dans le navigateur du téléphone (IndexedDB). Si on désinstalle l'appli ou qu'on vide les données du navigateur, elles sont perdues. Il faut donc exporter régulièrement (l'appli le rappelle après 14 jours) :

- **Sauvegarde complète** : fichier `.json` à réimporter (remplacer ou fusionner).
- **Pour une IA** : JSON lisible (noms en clair, résumé des stats, consigne d'analyse) à coller dans Claude ou une autre IA.

## Ajouter des infos à saisir

- **Sans code** : Réglages → Champs personnalisés (par match ou par game). Chaque champ devient automatiquement un critère dans Analyse → Explorer.
- **Dans le code** : ajouter le champ dans [src/data/schema.ts](src/data/schema.ts), incrémenter `CURRENT_SCHEMA_VERSION` dans [src/data/defaults.ts](src/data/defaults.ts) et écrire la migration dans [src/data/migrations.ts](src/data/migrations.ts). Ainsi, les anciennes sauvegardes restent importables.

## Structure

- `src/data/` : modèle, stockage, import/export, export IA, données de démo
- `src/stats/` : moteur de stats (fonctions pures testées), dimensions d'analyse, constats automatiques
- `src/screens/` : écrans (liste, saisie, détail, analyse, réglages)
- `src/components/` : composants d'interface
