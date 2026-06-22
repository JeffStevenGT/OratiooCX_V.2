/**
 * components/shared/ClipboardModal.tsx — Modal Premium con Copiado al Portapapeles
 * ===================================================================================
 * Modal unificado para toda la plataforma. Funcionalidad premium:
 *   - Copiado individual por campo con confirmación animada
 *   - Botón "Copiar todo" para copiar todos los campos de una vez
 *   - Soporte para mostrar plan/tier (futuro: modales de pago y suscripción)
 *   - Diseño premium con gradiente dorado en header
 */

'use client';

import { useState, useCallback } from 'react';
import { X, Copy, Check, CopyCheck, Crown } from 'lucide-react';

interface ClipboardField {
  label: string;
  value: string;
  copyable?: boolean;
  mono?: boolean;
}

interface ClipboardModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  fields: ClipboardField[];
  footer?: React.ReactNode;
  /** Modo premium: muestra badge de corona y gradiente dorado */
  premium?: boolean;
  /** Texto del badge premium (ej: "Plan Pro", "Empresarial") */
  premiumBadge?: string;
}

export function ClipboardModal({ open, onClose, title, subtitle, fields, footer, premium, premiumBadge }: ClipboardModalProps) {
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);

  const copyToClipboard = useCallback(async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Fallback para navegadores sin clipboard API
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
    }
    setCopiedField(label);
    setTimeout(() => setCopiedField(null), 2000);
  }, []);

  const copyAll = useCallback(async () => {
    const text = fields
      .filter(f => f.copyable !== false)
      .map(f => `${f.label}: ${f.value}`)
      .join('\n');
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
    }
    setCopiedAll(true);
    setTimeout(() => setCopiedAll(false), 2500);
  }, [fields]);

  if (!open) return null;

  const copyableFields = fields.filter(f => f.copyable !== false);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
      />

      {/* Modal */}
      <div className={`relative w-full max-w-md animate-scale-in rounded-2xl shadow-2xl overflow-hidden ${
        premium
          ? 'bg-gradient-to-b from-[#1a1030] to-[#2d1f4a] border border-[#e8c547]/30'
          : 'bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700'
      }`}>
        {/* Header premium */}
        <div className={`flex items-center justify-between p-5 border-b ${
          premium
            ? 'bg-gradient-to-r from-[#e8c547]/10 to-[#c9a830]/5 border-[#e8c547]/20'
            : 'border-gray-200 dark:border-gray-700'
        }`}>
          <div>
            <div className="flex items-center gap-2">
              {premium && <Crown size={16} className="text-[#e8c547]" />}
              <h2 className={`text-base font-semibold ${premium ? 'text-[#e8c547]' : 'text-gray-900 dark:text-white'}`}>
                {title}
              </h2>
              {premium && premiumBadge && (
                <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#e8c547]/20 text-[#e8c547] border border-[#e8c547]/30">
                  {premiumBadge}
                </span>
              )}
            </div>
            {subtitle && (
              <p className={`text-xs mt-0.5 ${premium ? 'text-gray-400' : 'text-gray-500 dark:text-gray-400'}`}>
                {subtitle}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className={`p-1.5 rounded-lg transition-colors ${
              premium
                ? 'hover:bg-white/10 text-gray-400 hover:text-white'
                : 'hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400'
            }`}
          >
            <X size={18} />
          </button>
        </div>

        {/* Body — Campos copiables */}
        <div className="p-5 space-y-3">
          {fields.map((field) => (
            <div
              key={field.label}
              className={`rounded-lg p-3 border ${
                premium
                  ? 'bg-white/5 border-white/10'
                  : 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700'
              }`}
            >
              <p className={`text-[10px] font-semibold uppercase tracking-wider mb-1 ${
                premium ? 'text-[#e8c547]/70' : 'text-gray-500 dark:text-gray-400'
              }`}>
                {field.label}
              </p>
              <div className="flex items-center justify-between gap-2">
                <span className={`text-sm truncate ${
                  premium ? 'text-white' : 'text-gray-900 dark:text-white'
                } ${field.mono ? 'font-mono' : ''}`}>
                  {field.value}
                </span>
                {field.copyable !== false && (
                  <button
                    onClick={() => copyToClipboard(field.value, field.label)}
                    className={`flex-shrink-0 p-1.5 rounded-lg transition-all ${
                      premium
                        ? 'hover:bg-[#e8c547]/10 text-gray-400 hover:text-[#e8c547]'
                        : 'hover:bg-purple-50 dark:hover:bg-purple-900/20 text-gray-400 hover:text-[#481163]'
                    }`}
                    title="Copiar al portapapeles"
                  >
                    {copiedField === field.label ? (
                      <Check size={14} className="text-emerald-400" />
                    ) : (
                      <Copy size={14} />
                    )}
                  </button>
                )}
              </div>
            </div>
          ))}

          {/* Botón Copiar Todo */}
          {copyableFields.length > 1 && (
            <button
              onClick={copyAll}
              className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-medium transition-all ${
                copiedAll
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  : premium
                    ? 'bg-[#e8c547]/10 text-[#e8c547] border border-[#e8c547]/20 hover:bg-[#e8c547]/20'
                    : 'bg-purple-50 dark:bg-purple-900/20 text-[#481163] dark:text-purple-300 border border-purple-200 dark:border-purple-800 hover:bg-purple-100 dark:hover:bg-purple-900/30'
              }`}
            >
              {copiedAll ? (
                <>
                  <CopyCheck size={14} />
                  ¡Todo copiado!
                </>
              ) : (
                <>
                  <Copy size={14} />
                  Copiar todo ({copyableFields.length} campos)
                </>
              )}
            </button>
          )}
        </div>

        {/* Footer */}
        {footer && (
          <div className={`px-5 pb-5 flex justify-end gap-3 ${
            premium ? 'border-t border-white/5 pt-4' : ''
          }`}>
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
