# tcpcv — ANSI Color Fork 🖥️

> Fork de [zachflower/tcpcv](https://github.com/zachflower/tcpcv) avec des **couleurs**, de nouvelles commandes, et un setup personnalisé.

```bash
telnet benjaminbacle.fr 2468
```

---

## Ce qui change dans ce fork

| Feature |
|---|
| Couleurs ANSI |
| En-têtes de section colorés |
| Commande `clear` |
| Commande `whoami` |
| `!!` répète la dernière cmd |
| sécurité de base |

---

## Quick start

```bash
# Clone
git clone https://github.com/0xBenguii/tcpcv.git
cd tcpcv

# Install + build
npm install
npm run build

# Run
node dist/index.js --resume=resume.json --port=2468 --motd="Benjamin Bacle"

# Connect
telnet localhost 2468
```

---

## Deploy VPS (permanent)

```bash
npm install --global pm2
pm2 start "node dist/index.js --resume=resume.json --port=2468 --motd='Benjamin Bacle'" --name tcpcv
pm2 save && pm2 startup
sudo ufw allow 2468/tcp
```

---

## Schéma des couleurs

| Élément | Couleur |
|---|---|
| Titre de section | Bold cyan |
| Séparateur `───` | Dim gris |
| Header gauche | Bold blanc |
| Header droit | Dim gris |
| Subheader gauche | Vert |
| Body | Dim gris |
| Texte plain | Blanc |
| Label `---` | Jaune |
| Séparateur `:` | Cyan |
| Prompt `$` | Vert |
| Erreurs | Rouge |

---

## Crédits

- Projet original : [zachflower/tcpcv](https://github.com/zachflower/tcpcv) — MIT

## License

MIT
