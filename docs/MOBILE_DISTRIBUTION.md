# Nikki — Guia de Distribuição Multiplataforma (Web, Android APK & iOS PWA)

## 1. Web & iOS PWA (Vercel + Supabase)

A aplicação web e o PWA iOS são servidos diretamente pela **Vercel** com backend no **Supabase**.

### Instalação no iPhone (iOS 16.4+)
1. Abra o Nikki no **Safari**.
2. Toque no ícone de **Compartilhar**.
3. Selecione **Adicionar à Tela de Início** (*Add to Home Screen*).
4. Abra o Nikki pelo ícone instalado para executar em modo `standalone` com suporte a safe areas (`viewport-fit=cover`), Service Worker (`/sw.js`) e Web Push.

### Variáveis de Ambiente para Web Push Remoto (Opcional)
Para envio remoto de notificações Web Push com o app fechado, configure na Vercel:
- `NEXT_PUBLIC_VAPID_PUBLIC_KEY`
- `VAPID_PRIVATE_KEY`

---

## 2. Android via Capacitor (Distribuição por APK)

O arquivo `capacitor.config.ts` define `webDir: "mobile-shell"` (sem `server.url` apontando para a Vercel).

### Pré-requisitos Locais
- Node.js 20+
- JDK 17+
- Android Studio + Android SDK (API 34+)

### Inicialização e Sync
```bash
npm install @capacitor/core @capacitor/cli @capacitor/android @capacitor/app @capacitor/status-bar @capacitor/keyboard @capacitor/local-notifications @capacitor/push-notifications
npx cap add android
npx cap sync android
```

### Assinatura e Keystore (Nunca commitar no Git!)
1. Gere sua keystore privada fora do repositório:
```bash
keytool -genkey -v -keystore ~/nikki-release.jks -keyalg RSA -keysize 2048 -validity 10000 -alias nikki
```
2. Configure `android/keystore.properties` (adicionado ao `.gitignore`) com `storeFile`, `storePassword`, `keyAlias` e `keyPassword`.

### Compilação de APK
- **Debug APK:** `cd android && ./gradlew assembleDebug` -> `android/app/build/outputs/apk/debug/app-debug.apk`
- **Release APK Assinado:** `cd android && ./gradlew assembleRelease` -> `android/app/build/outputs/apk/release/app-release.apk`
- **AAB (opcional para loja):** `cd android && ./gradlew bundleRelease`

### Atualizações sem Desinstalar
- Incremente `versionCode` (inteiro) e `versionName` (ex.: `"0.2.1"`) em `android/app/build.gradle`.
- Assine sempre com a **mesma keystore** para permitir atualização direta por cima do APK já instalado pelos seus amigos.

### Push Notifications Android (FCM)
- Adicione `google-services.json` do projeto Firebase no diretório `android/app/` (fora do Git se privado) e configure `FCM_SERVER_KEY` no backend para envio remoto aos tokens salvos em `notification_subscriptions`.
