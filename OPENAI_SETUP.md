# OpenAI API Configuration Guide

## Quick Setup

### Option 1: Environment Variable (Recommended)
```bash
export OPENAI_API_KEY="sk-your-api-key-here"
npm start
```

### Option 2: Create .env File
1. Create a file named `.env` in the project root
2. Add your API key:
```
OPENAI_API_KEY=sk-your-api-key-here
```
3. Run the server:
```bash
npm start
```

## Getting Your API Key

1. Go to [OpenAI Platform](https://platform.openai.com/api-keys)
2. Sign in or create an account
3. Click "Create new secret key"
4. Copy the key (starts with `sk-`)
5. Use it in one of the methods above

## Verification

After setting up your API key, you can verify it's working by:

1. Starting the server: `npm start`
2. Visiting: `http://localhost:3000/api/status`
3. Check that `openai.configured` is `true`

## Security Notes

- Never commit your API key to version control
- The `.env` file is already in `.gitignore`
- Keep your API key secure and don't share it publicly

## Troubleshooting

If you see "OpenAI API key not found":
1. Make sure you've set the environment variable correctly
2. Check that your API key is valid and active
3. Restart your terminal/server after setting the environment variable
4. Visit `/api/status` to check the configuration status
