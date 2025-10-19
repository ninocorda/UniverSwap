'use client';

import { useState } from 'react';
import type { Address } from 'viem';
import type { FactoryTokenDetails } from '../../../../hooks/useFactoryTokens';
import { useToast } from '../../../../components/ui/Toast';

interface VerificationDownloadsProps {
  token: FactoryTokenDetails;
  chainId: number;
  factoryAddress?: Address;
}

type ArtifactKind = 'factory-standard-json' | 'factory-constructor';

type VerificationLogEntry = {
  step: string;
  status: 'pending' | 'success' | 'error';
  message?: string;
};

type VerifyResponse = {
  success: boolean;
  factoryAddress: string;
  implementationAddress: string;
  isProxy: boolean;
  logs: VerificationLogEntry[];
};

const ARTIFACT_LABEL: Record<ArtifactKind, string> = {
  'factory-standard-json': 'Factory Standard JSON',
  'factory-constructor': 'Factory Constructor Args',
};

const DESCRIPTION: Record<ArtifactKind, string> = {
  'factory-standard-json': 'Archivo Standard-Json-Input del TokenFactory listo para BscScan.',
  'factory-constructor':
    'Argumentos ABI del constructor del TokenFactory. Proporciona el hash de despliegue para obtener el valor exacto.',
};

function triggerBrowserDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

export default function VerificationDownloads({ token, chainId, factoryAddress }: VerificationDownloadsProps) {
  const { addToast } = useToast();
  const [downloading, setDownloading] = useState<ArtifactKind | null>(null);
  const [deploymentTx, setDeploymentTx] = useState<string>('');
  const [apiKey, setApiKey] = useState<string>('');
  const [verifying, setVerifying] = useState<boolean>(false);
  const [verificationLogs, setVerificationLogs] = useState<VerificationLogEntry[]>([]);

  const handleDownload = async (artifact: ArtifactKind) => {
    if (!factoryAddress) {
      addToast({
        kind: 'error',
        title: 'Factory address requerida',
        message: 'Configura una TokenFactory válida para exportar los artefactos.',
      });
      return;
    }
    setDownloading(artifact);
    try {
      const params = new URLSearchParams({
        chainId: String(chainId),
        factory: factoryAddress,
        artifact,
      });
      const trimmedTx = deploymentTx.trim();
      if (artifact === 'factory-constructor' && trimmedTx) {
        params.set('deploymentTx', trimmedTx);
      }
      const endpoint = `/api/factory/${token.address}/verification?${params.toString()}`;
      const response = await fetch(endpoint);
      if (!response.ok) {
        throw new Error(`Request failed with status ${response.status}`);
      }
      const blob = await response.blob();
      const extension = artifact === 'factory-standard-json' ? 'json' : 'txt';
      const label = ARTIFACT_LABEL[artifact];
      const safeSymbol = token.symbol?.trim() || token.address.slice(0, 8);
      const filename = `${label}-${safeSymbol}.${extension}`;
      triggerBrowserDownload(blob, filename);
      addToast({ kind: 'success', title: `${label} listo`, message: filename });
      if (artifact === 'factory-constructor' && !trimmedTx) {
        addToast({
          kind: 'info',
          title: 'Constructor generado con fallback',
          message:
            'Sin hash de despliegue se usa la dirección de implementación actual. Introduce el hash para reproducir la transacción exacta.',
        });
      }
    } catch (error: any) {
      addToast({
        kind: 'error',
        title: 'Descarga fallida',
        message: error?.message ?? 'Unexpected error while downloading verification files.',
      });
    } finally {
      setDownloading(null);
    }
  };

  const extractErrorMessage = (responseBody: any): string => {
    if (!responseBody) return 'Verification failed.';
    const logs = Array.isArray(responseBody.logs) ? (responseBody.logs as VerificationLogEntry[]) : [];
    const explicitError = logs.find((entry) => entry.status === 'error');
    if (explicitError?.message) return explicitError.message;
    if (typeof responseBody.message === 'string') return responseBody.message;
    return 'Verification failed.';
  };

  const handleVerify = async () => {
    if (!factoryAddress) {
      addToast({
        kind: 'error',
        title: 'Factory address requerida',
        message: 'Configura una TokenFactory válida para verificar en BscScan.',
      });
      return;
    }

    const trimmedKey = apiKey.trim();
    if (!trimmedKey) {
      addToast({
        kind: 'error',
        title: 'API key requerida',
        message: 'Introduce tu API key de BscScan para continuar.',
      });
      return;
    }

    const trimmedTx = deploymentTx.trim();

    setVerifying(true);
    setVerificationLogs([]);
    try {
      const endpoint = `/api/factory/${token.address}/verification`;
      const payload = {
        chainId,
        factory: factoryAddress,
        apiKey: trimmedKey,
        deploymentTx: trimmedTx ? trimmedTx : undefined,
      };

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      let json: VerifyResponse | undefined;
      try {
        json = (await response.json()) as VerifyResponse;
      } catch (parseError) {
        throw new Error('La respuesta de BscScan no pudo interpretarse.');
      }

      if (json.logs) {
        setVerificationLogs(json.logs);
      }

      if (!response.ok || !json.success) {
        throw new Error(extractErrorMessage(json));
      }

      const proxySuffix = json.isProxy ? ` (proxy enlazado a ${json.implementationAddress})` : '';
      addToast({
        kind: 'success',
        title: 'Verificación completada',
        message: `TokenFactory ${json.factoryAddress}${proxySuffix}`,
      });
    } catch (error: any) {
      const message = error?.message ?? 'No se pudo completar la verificación automática.';
      addToast({ kind: 'error', title: 'Verificación fallida', message });
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div className="grid gap-3 rounded border border-neutral-light/15 bg-neutral-dark/30 p-3 text-xs">
      <span className="text-neutral-light/80">Descarga los dos archivos necesarios para verificar el TokenFactory en BscScan.</span>
      <div className="grid gap-2">
        {(['factory-standard-json', 'factory-constructor'] as ArtifactKind[]).map((artifact) => (
          <div key={artifact} className="grid gap-1 rounded border border-neutral-light/10 bg-neutral-dark/40 p-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-semibold text-neutral-light/90">{ARTIFACT_LABEL[artifact]}</span>
              <button
                type="button"
                onClick={() => handleDownload(artifact)}
                disabled={!factoryAddress || downloading === artifact}
                className="rounded bg-primary px-3 py-1 text-[11px] font-semibold text-neutral-dark disabled:opacity-50"
              >
                {downloading === artifact ? 'Descargando…' : 'Descargar'}
              </button>
            </div>
            <span className="text-[11px] text-neutral-light/70">{DESCRIPTION[artifact]}</span>
            {artifact === 'factory-constructor' && (
              <label className="grid gap-1 text-[11px] text-neutral-light/70">
                Hash de despliegue del TokenFactory (opcional)
                <input
                  value={deploymentTx}
                  onChange={(event) => setDeploymentTx(event.target.value)}
                  placeholder="0x..."
                  className="rounded bg-neutral-dark/50 px-2 py-1 text-xs text-neutral-light outline-none"
                />
              </label>
            )}
          </div>
        ))}
      </div>
      {!factoryAddress && (
        <span className="text-[11px] text-red-200">
          Establece una dirección de TokenFactory válida para habilitar las descargas.
        </span>
      )}
      <div className="grid gap-2 rounded border border-primary/40 bg-primary/5 p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="grid gap-1">
            <span className="text-[12px] font-semibold text-neutral-light/90">Verificar automáticamente en BscScan</span>
            <span className="text-[11px] text-neutral-light/70">
              Proporciona tu API key de BscScan. Usaremos el hash de despliegue para reconstruir el constructor si lo indicas.
            </span>
          </div>
          <button
            type="button"
            onClick={handleVerify}
            disabled={!factoryAddress || verifying}
            className="rounded bg-primary px-3 py-1 text-[11px] font-semibold text-neutral-dark disabled:opacity-50"
          >
            {verifying ? 'Verificando…' : 'Verificar en BscScan'}
          </button>
        </div>
        <label className="grid gap-1 text-[11px] text-neutral-light/70">
          API key de BscScan
          <input
            value={apiKey}
            onChange={(event) => setApiKey(event.target.value)}
            placeholder="BSCSCAN_API_KEY"
            className="rounded bg-neutral-dark/50 px-2 py-1 text-xs text-neutral-light outline-none"
          />
        </label>
        <label className="grid gap-1 text-[11px] text-neutral-light/70">
          Hash de despliegue del TokenFactory (opcional)
          <input
            value={deploymentTx}
            onChange={(event) => setDeploymentTx(event.target.value)}
            placeholder="0x..."
            className="rounded bg-neutral-dark/50 px-2 py-1 text-xs text-neutral-light outline-none"
          />
        </label>
        {verificationLogs.length > 0 && (
          <div className="grid gap-1 text-[11px] text-neutral-light/70">
            <span className="font-semibold text-neutral-light/80">Registro de verificación</span>
            <ul className="grid gap-1">
              {verificationLogs.map((entry, index) => (
                <li key={`${entry.step}-${index}`} className="flex flex-wrap gap-2">
                  <span className="font-semibold text-neutral-light/90">{entry.step}</span>
                  <span
                    className={
                      entry.status === 'success'
                        ? 'text-[11px] text-emerald-300'
                        : entry.status === 'error'
                          ? 'text-[11px] text-red-300'
                          : 'text-[11px] text-neutral-light/60'
                    }
                  >
                    {entry.status}
                  </span>
                  {entry.message && <span className="text-[11px] text-neutral-light/70">— {entry.message}</span>}
                </li>
              ))}
            </ul>
          </div>
        )}
        <span className="text-[10px] text-neutral-light/50">
          No almacenamos la API key. Solo se usa para esta solicitud. Puedes seguir usando las descargas manuales si prefieres verificar por tu cuenta.
        </span>
      </div>
      <p className="text-[11px] text-neutral-light/60">
        Introduce el hash de despliegue si deseas reproducir exactamente los argumentos codificados. Si lo omites, se usará la
        dirección de implementación actualmente configurada en el TokenFactory.
      </p>
    </div>
  );
}
