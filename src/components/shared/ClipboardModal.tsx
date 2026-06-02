/**
 * components/shared/ClipboardModal.tsx — Modal Premium con Copiado al Portapapeles
 * ===================================================================================
 * Un único modal estandarizado para toda la plataforma.
 * Incluye funciones nativas de copiado de datos y diseño uniforme.
 */

'use client';

import { useState, useCallback } from 'react';
import { X, Copy, Check } from 'lucide-react';

interface ClipboardField {
  label: string;
  value: string;
  copyable?: boolean;
}

interface ClipboardModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  fields: ClipboardField[];
  footer?: React.ReactNode;
}

export function ClipboardModal({ open, onClose, title, subtitle, fields, footer }: ClipboardModalProps) {
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const copyToClipboard = useCallback(async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(label);
      setTimeout(() => setCopiedField(null), 2000);
    } catch {
      // Fallback para navegadores que no soportan clipboard API
      const textarea = document.createElement('textarea');
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopiedField(label);
      setTimeout(() => setCopiedField(null), 2000);
    }
  }, []);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 animate-scale-in">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-[#e0e0f0]">
          <div>
            <h2 className="text-base font-semibold text-[#1a1030]">{title}</h2>
            {subtitle && (
              <p className="text-xs text-[#7c757c] mt-0.5">{subtitle}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-[#f0f0f8] text-[#868686] transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body — Campos copiables */}
        <div className="p-5 space-y-3">
          {fields.map((field) => (
            <div
              key={field.label}
              className="bg-[#f8f7fa] rounded-lg p-3 border border-[#e8dce6]"
            >
              <p className="text-[10px] font-semibold text-[#7c757c] uppercase tracking-wider mb-1">
                {field.label}
              </p>
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm text-[#1a1030] font-mono truncate">
                  {field.value}
                </span>
                {field.copyable !== false && (
                  <button
                    onClick={() => copyToClipboard(field.value, field.label)}
                    className="flex-shrink-0 p-1.5 rounded-lg hover:bg-purple-50 text-[#868686] hover:text-[#481163] transition-all"
                    title="Copiar al portapapeles"
                  >
                    {copiedField === field.label ? (
                      <Check size={14} className="text-emerald-500" />
                    ) : (
                      <Copy size={14} />
                    )}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        {footer && (
          <div className="px-5 pb-5 flex justify-end gap-3">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
