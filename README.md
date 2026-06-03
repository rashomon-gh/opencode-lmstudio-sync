# opencode-lmstudio-sync

An opencode plugin to sync the model list from lmstudio and inject them at run time in opencode, which you can access using the `/models` command. 

## usage

> [!IMPORTANT]
> Your LMStudio API server must be running for this to work!
> e.g. at http://127.0.0.1:1234

```bash
# clone the repo
git clone 
cd opencode-lmstudio-sync

# then copy the plugin file to your opencode config directory
cp ./lmstudio-sync.ts ~/.config/opencode/plugins/lmstudio-sync.ts
```

Then add the following to your opencode config file (`~/.config/opencode/opencode.json`).

```json
{
    ...
    "plugin": ["./plugins/lmstudio-sync.ts"],
     "provider": {
        "lmstudio": {
        "npm": "@ai-sdk/openai-compatible",
        "name": "LM Studio (local)",
        "options": {
            "baseURL": "http://127.0.0.1:1234/v1"
        }
    },
    ...
    // any other providers you may have
}
```

An example `opencode.json` file using only lmstudio endpoints:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugin": ["./plugins/lmstudio-sync.ts"],
  "provider": {
    "lmstudio": {
      "npm": "@ai-sdk/openai-compatible",
      "name": "LM Studio (local)",
      "options": {
        "baseURL": "http://127.0.0.1:1234/v1"
      }
    }
  }
}
```
