'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase-client';
import { Save, Mail, Bot, Database } from 'lucide-react';
import type { OrganizationSettings } from '@/lib/types';

export default function ApiKeysClient({ initialSettings, embedded = false }: { initialSettings: OrganizationSettings; embedded?: boolean }) {
  const [settings, setSettings] = useState(initialSettings);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const supabase = createClient();

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setMessage(null);

    try {
      const { error } = await supabase
        .from('organization_settings')
        .upsert({
          organization_id: settings.organization_id,
          gemini_api_key: settings.gemini_api_key,
          apify_api_token: settings.apify_api_token,
          hunter_api_key: settings.hunter_api_key,
          smtp_host: settings.smtp_host,
          smtp_port: settings.smtp_port ? Number.parseInt(String(settings.smtp_port), 10) : null,
          smtp_user: settings.smtp_user,
          smtp_password: settings.smtp_password,
          from_email: settings.from_email,
          from_name: settings.from_name,
          postal_address: settings.postal_address,
        });

      if (error) throw error;
      setMessage({ type: 'success', text: 'API keys saved successfully.' });
    } catch (error: unknown) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Failed to save settings.' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSettings({ ...settings, [e.target.name]: e.target.value });
  };

  return (
    <div className={`${embedded ? '' : 'min-h-screen p-8'} bg-slate-950 text-slate-100`}>
      <div className="max-w-4xl mx-auto space-y-8">
        {!embedded && <div>
          <h1 className="text-4xl font-bold text-white tracking-tight">API Keys & Settings</h1>
          <p className="text-slate-400 mt-2">Configure your Bring Your Own Key (BYOK) integrations.</p>
        </div>}

        <form onSubmit={handleSave} className="space-y-8">
          {/* AI Settings */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
            <h2 className="text-xl font-semibold flex items-center gap-2 mb-4">
              <Bot className="w-5 h-5 text-indigo-400" />
              AI & Enrichment
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-slate-400 mb-1">Gemini API Key (Optional - Managed by System)</label>
                <input
                  type="password"
                  name="gemini_api_key"
                  value={settings.gemini_api_key || ''}
                  onChange={handleChange}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-indigo-500"
                  placeholder="Leave blank to use system defaults"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">Hunter API Key (Optional - Managed by System)</label>
                <input
                  type="password"
                  name="hunter_api_key"
                  value={settings.hunter_api_key || ''}
                  onChange={handleChange}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-indigo-500"
                  placeholder="Leave blank to use system defaults"
                />
              </div>
            </div>
          </div>

          {/* Scraper Settings */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
            <h2 className="text-xl font-semibold flex items-center gap-2 mb-4">
              <Database className="w-5 h-5 text-indigo-400" />
              Scraping Engine
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-slate-400 mb-1">Apify API Token (Optional - Managed by System)</label>
                <input
                  type="password"
                  name="apify_api_token"
                  value={settings.apify_api_token || ''}
                  onChange={handleChange}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-indigo-500"
                  placeholder="Leave blank to use system defaults"
                />
              </div>
            </div>
          </div>

          {/* SMTP Settings */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
            <h2 className="text-xl font-semibold flex items-center gap-2 mb-4">
              <Mail className="w-5 h-5 text-indigo-400" />
              SMTP Delivery
            </h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 md:col-span-1">
                <label className="block text-sm text-slate-400 mb-1">SMTP Host</label>
                <input
                  type="text"
                  name="smtp_host"
                  value={settings.smtp_host || ''}
                  onChange={handleChange}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-indigo-500"
                  placeholder="smtp.example.com"
                />
              </div>
              <div className="col-span-2 md:col-span-1">
                <label className="block text-sm text-slate-400 mb-1">SMTP Port</label>
                <input
                  type="number"
                  name="smtp_port"
                  value={settings.smtp_port || ''}
                  onChange={handleChange}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-indigo-500"
                  placeholder="465"
                />
              </div>
              <div className="col-span-2 md:col-span-1">
                <label className="block text-sm text-slate-400 mb-1">SMTP User</label>
                <input
                  type="text"
                  name="smtp_user"
                  value={settings.smtp_user || ''}
                  onChange={handleChange}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div className="col-span-2 md:col-span-1">
                <label className="block text-sm text-slate-400 mb-1">SMTP Password</label>
                <input
                  type="password"
                  name="smtp_password"
                  value={settings.smtp_password || ''}
                  onChange={handleChange}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div className="col-span-2 md:col-span-1">
                <label className="block text-sm text-slate-400 mb-1">From Name</label>
                <input
                  type="text"
                  name="from_name"
                  value={settings.from_name || ''}
                  onChange={handleChange}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-indigo-500"
                  placeholder="John Doe"
                />
              </div>
              <div className="col-span-2 md:col-span-1">
                <label className="block text-sm text-slate-400 mb-1">From Email</label>
                <input
                  type="email"
                  name="from_email"
                  value={settings.from_email || ''}
                  onChange={handleChange}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-indigo-500"
                  placeholder="john@example.com"
                />
              </div>
              <div className="col-span-2">
                <label className="block text-sm text-slate-400 mb-1">Physical Postal Address</label>
                <input
                  type="text"
                  name="postal_address"
                  value={settings.postal_address || ''}
                  onChange={handleChange}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-indigo-500"
                  placeholder="Required for compliant commercial email"
                />
                <p className="mt-1 text-xs text-slate-600">Included in every email footer. Sending is blocked when this is empty.</p>
              </div>
            </div>
          </div>

          {message && (
            <div className={`p-4 rounded-lg text-sm ${message.type === 'success' ? 'bg-emerald-900/30 text-emerald-400' : 'bg-rose-900/30 text-rose-400'}`}>
              {message.text}
            </div>
          )}

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={isSaving}
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-2.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {isSaving ? 'Saving...' : 'Save Settings'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
