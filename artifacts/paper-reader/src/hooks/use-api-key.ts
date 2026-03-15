import { useState, useCallback, useMemo } from 'react';

export type AiProvider = 'openai' | 'anthropic' | 'gemini' | 'deepseek';

export const PROVIDER_META: Record<AiProvider, { label: string; placeholder: string; model: string }> = {
  openai:    { label: 'OpenAI',    placeholder: 'sk-...',       model: 'gpt-4o' },
  anthropic: { label: 'Anthropic', placeholder: 'sk-ant-...',   model: 'claude-sonnet-4-5' },
  gemini:    { label: 'Gemini',    placeholder: 'AIza...',       model: 'gemini-2.5-flash' },
  deepseek:  { label: 'DeepSeek', placeholder: 'sk-...',        model: 'deepseek-chat' },
};

interface ApiKeyConfig {
  provider: AiProvider;
  apiKey: string;
}

const STORAGE_KEY = 'paper-reader-api-config';

function loadConfig(): ApiKeyConfig | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as ApiKeyConfig;
  } catch {
    return null;
  }
}

export function useApiKey() {
  const [config, setConfig] = useState<ApiKeyConfig | null>(loadConfig);

  const saveConfig = useCallback((provider: AiProvider, apiKey: string) => {
    const next = apiKey.trim() ? { provider, apiKey: apiKey.trim() } : null;
    if (next) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
    setConfig(next);
  }, []);

  const clearConfig = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setConfig(null);
  }, []);

  const headers = useMemo(
    () =>
      config
        ? {
            'x-api-key': config.apiKey,
            'x-provider': config.provider,
            'x-model': PROVIDER_META[config.provider].model,
          }
        : {},
    [config]
  );

  return { config, saveConfig, clearConfig, headers };
}
