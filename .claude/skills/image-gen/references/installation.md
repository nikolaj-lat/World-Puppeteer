# Image Generation Setup

## 1. Gemini API Key

Get one at https://aistudio.google.com/apikey, then open `.claude/secrets.env` and paste it directly after the `=`:

```
GEMINI_API_KEY=your-key-here
```

The script auto-sources this at runtime on both platforms.

## 2. Install SDK

Install in your home directory so Node can resolve it from any project:

macOS / Linux:
```bash
cd ~ && npm install @google/genai
```

Windows (PowerShell):
```powershell
cd $HOME; npm install @google/genai
```