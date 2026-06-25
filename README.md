# JitBitBar

Application **macOS menu bar** pour [Jitbit Helpdesk](https://www.jitbit.com/helpdesk/).
Voir ses demandes en un coup d'œil, y répondre, et basculer une demande en tâche
**Asana** (avec lien vers le ticket) directement depuis la barre de menu.

> Fork de [BugSnagBar](https://github.com/yoanbernabeu/BugSnagBar) de Yoan Bernabeu (MIT).
> La structure Electron + le design sont réutilisés ; la couche données est réécrite
> pour l'API Jitbit + Asana.

## Fonctionnalités

- 🎫 Liste des tickets qui te concernent (`mode=handledbyme` par défaut, configurable)
- 💬 Répondre à un ticket sans quitter la barre de menu
- ✅ Clôturer un ticket (avec réponse finale optionnelle)
- 🔗 **→ Asana** : créer une tâche liée au ticket en un clic ; clôturer le ticket
  complète automatiquement la tâche Asana liée
- 🔔 Notifications natives sur nouvelle demande
- 🎨 Pastille colorée dans la barre (gris = rien, vert/orange/rouge selon l'urgence)
- 🌙 Compatible dark / light mode

## Configuration

Tout se passe dans **Réglages** (icône ⚙️ du popover) :

| Onglet | Champs |
|--------|--------|
| **Jitbit** | URL du helpdesk (`https://masociete.jitbit.com/helpdesk`), token API, type de demandes à afficher |
| **Asana** | Personal Access Token, projet cible (recherche) |
| **Général** | Intervalle de rafraîchissement, notifications |

Les tokens sont stockés chiffrés via `safeStorage` (Keychain macOS), jamais en clair
dans la config.

### Où trouver les tokens

- **Jitbit** : ton avatar → *Token API* (ou page `/User/Token/`).
- **Asana** : *Settings → Apps → Personal access tokens*.

## Développement

```sh
npm install
npm start          # lance l'app en mode dev (electron-forge + vite)
npm run lint       # eslint
npm run make       # build le .app / .dmg dans out/
```

> ⚠️ Nécessite Node 18+. Pas besoin de Xcode complet pour `npm start` ;
> `npm run make` (DMG) peut en demander selon la signature.

## Architecture

```
src/
  main.ts                 # bootstrap Electron (single instance, dock hidden)
  main/
    tray.ts               # icône barre de menu + popover + fenêtre réglages
    api/jitbit.ts         # client REST Jitbit (tickets, comments, reply, close)
    api/asana.ts          # client REST Asana (createTask, complete)
    services/polling.ts   # boucle de rafraîchissement + calcul du statut
    services/notifications.ts
    store/config.ts       # electron-store (URL, projet, intervalle, liens…)
    store/keychain.ts     # tokens chiffrés (safeStorage)
    ipc/handlers.ts       # pont IPC (jitbit / asana / config / app)
  preload.ts              # expose window.jitbitbar au renderer
  renderer/
    index.html            # popover (liste tickets + actions)
    preferences.html      # fenêtre réglages
  shared/
    types/                # Ticket, TicketComment, AppConfig
    constants/ipcChannels.ts
```

## Licence

MIT — voir [LICENSE](LICENSE).
