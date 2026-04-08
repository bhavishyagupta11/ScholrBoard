# Server Setup Instructions

## Environment Setup

1. Copy `.env.example` to `.env` and fill in your MongoDB URI and other environment variables
2. Get your Firebase service account key:
   - Go to Firebase Console (https://console.firebase.google.com)
   - Select your project
   - Go to Project Settings > Service Accounts
   - Click "Generate New Private Key"
   - Save the downloaded file as `firebase-service-account.json` in the server directory

## Firebase Setup

1. Copy `firebase-service-account.template.json` to `firebase-service-account.json`
2. Replace the placeholder values with your actual Firebase service account credentials

## Important Security Notes

- Never commit `firebase-service-account.json` or `.env` files to version control
- Keep your Firebase service account key secure and private
- Regularly rotate your credentials for security