import { NextRequest, NextResponse } from 'next/server';
import { Address, isAddress } from 'viem';
import { loadStandardJsonInput, loadContractArtifact } from '../../../../../lib/verification';
import { getPublicClient } from '../../../../../lib/viemClient';

const FILENAME_TOKEN = (token: string) => token.slice(0, 8);

const BSC_SCAN_ENDPOINT: Record<number, string> = {
  56: 'https://api.bscscan.com',
  97: 'https://api-testnet.bscscan.com',
};

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

type VerificationTarget = 'factory' | 'token';

type VerifyRequestBody = {
  chainId: number;
  factory: string;
  deploymentTx?: string;
  apiKey: string;
  target?: VerificationTarget;
};

type ArtifactKind =
  | 'token-standard-json'
  | 'token-constructor'
  | 'factory-standard-json'
  | 'factory-constructor';

type RouteContext = {
  params: {
    token: string;
  };
};

function badRequest(message: string): NextResponse {
  return NextResponse.json({ error: message }, { status: 400 });
}

function extractImplementationFromMinimalProxy(bytecode: string): string | null {
  if (!bytecode || bytecode === '0x') return null;
  const normalized = bytecode.toLowerCase().replace(/^0x/, '');
  const marker = '363d3d373d3d3d363d73';
  const markerIndex = normalized.indexOf(marker);
  if (markerIndex === -1) return null;
  const addressStart = markerIndex + marker.length;
  const candidate = normalized.slice(addressStart, addressStart + 40);
  return candidate.length === 40 ? `0x${candidate}` : null;
}

async function submitImplementationVerificationWithRetry(
  submitFn: () => Promise<{ status: 'success' | 'error'; guid?: string; message?: string }>,
): Promise<{ status: 'success' | 'error'; guid?: string; message?: string }> {
  const retries = 3;
  let attempt = 0;
  let lastError: { status: 'error'; message?: string } | null = null;
  while (attempt < retries) {
    const result = await submitFn();
    if (result.status === 'success') return result;
    const message = result.message ?? '';
    const rateLimited = message.includes('BscScan bloqueó la solicitud') || message.includes('Just a moment');
    if (!rateLimited) return result;
    lastError = { status: 'error', message };
    attempt += 1;
    if (attempt < retries) {
      await sleep(4000 * attempt);
    }
  }
  return lastError ?? { status: 'error', message: 'Verification failed after retries.' };
}

export async function GET(request: NextRequest, { params }: RouteContext) {
  const token = params.token;
  if (!isAddress(token)) {
    return badRequest('Invalid token address.');
  }

  const search = request.nextUrl.searchParams;
  const artifactParam = (search.get('artifact') ?? 'token-standard-json').toLowerCase();
  const artifact = artifactParam as ArtifactKind;
  if (!['token-standard-json', 'token-constructor', 'factory-standard-json', 'factory-constructor'].includes(artifact)) {
    return badRequest('Unsupported artifact type.');
  }

  const chainIdParam = search.get('chainId');
  const chainId = chainIdParam ? Number(chainIdParam) : undefined;
  if (!chainId || Number.isNaN(chainId)) {
    return badRequest('Invalid or missing chainId.');
  }

  const factory = search.get('factory');
  if (factory && !isAddress(factory)) {
    return badRequest('Invalid factory address.');
  }

  const requiresFactory = artifact !== 'token-standard-json' && artifact !== 'token-constructor';
  if (requiresFactory && !factory) {
    return badRequest('Missing factory parameter for this artifact.');
  }

  if (artifact === 'token-standard-json') {
    const result = await loadStandardJsonInput('ERC20Template');
    const body = JSON.stringify(result.input, null, 2);
    return new NextResponse(body, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename=TokenStandardJson-${FILENAME_TOKEN(token)}.json`,
      },
    });
  }

  if (artifact === 'factory-standard-json') {
    const result = await loadStandardJsonInput('TokenFactory');
    const body = JSON.stringify(result.input, null, 2);
    return new NextResponse(body, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename=FactoryStandardJson-${chainId}.json`,
      },
    });
  }

  if (artifact === 'token-constructor') {
    const body = '0x';
    return new NextResponse(body, {
      status: 200,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Content-Disposition': `attachment; filename=TokenConstructor-${FILENAME_TOKEN(token)}.txt`,
      },
    });
  }

  if (artifact === 'factory-constructor') {
    if (!factory) {
      return badRequest('Missing factory parameter.');
    }

    const deploymentTx = (search.get('deploymentTx') ?? '').trim();
    const hasDeploymentTx = /^0x[a-fA-F0-9]{64}$/.test(deploymentTx);

    if (hasDeploymentTx) {
      const client = getPublicClient(chainId);
      const [transaction, receipt] = await Promise.all([
        client.getTransaction({ hash: deploymentTx as `0x${string}` }),
        client.getTransactionReceipt({ hash: deploymentTx as `0x${string}` }).catch(() => null),
      ]);

      if (!transaction) {
        return NextResponse.json({ error: 'Deployment transaction not found on this chain.' }, { status: 404 });
      }

      if (transaction.to) {
        return NextResponse.json({ error: 'Provided transaction is not a contract deployment.' }, { status: 400 });
      }

      if (receipt && receipt.contractAddress && receipt.contractAddress.toLowerCase() !== factory.toLowerCase()) {
        return NextResponse.json(
          { error: 'Deployment transaction does not match the provided factory address.' },
          { status: 400 },
        );
      }

      const txInput = transaction.input ?? '0x';
      if (!txInput || txInput === '0x') {
        return NextResponse.json({ error: 'Transaction has no constructor data.' }, { status: 400 });
      }

      const artifact = await loadContractArtifact('TokenFactory');
      const txInputHex = txInput.startsWith('0x') ? txInput.slice(2) : txInput;
      const artifactBytecodeHex = artifact.bytecode.startsWith('0x') ? artifact.bytecode.slice(2) : artifact.bytecode;

      if (!txInputHex.startsWith(artifactBytecodeHex)) {
        return NextResponse.json(
          {
            error:
              'Transaction input does not match TokenFactory bytecode. Ensure the compilation artifacts are up to date with the deployed contract.',
          },
          { status: 400 },
        );
      }

      const constructorHex = txInputHex.slice(artifactBytecodeHex.length);
      const body = constructorHex.length > 0 ? `0x${constructorHex}` : '0x';

      return new NextResponse(body, {
        status: 200,
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'Content-Disposition': `attachment; filename=FactoryConstructor-${FILENAME_TOKEN(factory)}.txt`,
        },
      });
    }

    return new NextResponse('0x', {
      status: 200,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Content-Disposition': `attachment; filename=FactoryConstructor-${FILENAME_TOKEN(factory)}.txt`,
      },
    });
  }
}

function ensureSolcVersion(version: string): string {
  if (!version) return '';
  return version.startsWith('v') ? version : `v${version}`;
}

async function sleep(ms: number) {
  await new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function pollVerificationStatus(
  apiBase: string,
  apiKey: string,
  guid: string,
  chainId: number,
): Promise<{ success: boolean; message: string }>
{
  const maxAttempts = 15;
  const delayMs = 4000;
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    if (attempt > 0) {
      await sleep(delayMs);
    }
    const params = new URLSearchParams({
      apikey: apiKey,
      chainid: String(chainId),
      module: 'contract',
      action: 'checkverifystatus',
      guid,
    });
    const response = await fetch(`${apiBase}/v2/api?${params.toString()}`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
    });
    const raw = await response.text();
    if (!response.ok) {
      return {
        success: false,
        message: `BscScan responded with status ${response.status}: ${raw.slice(0, 160)}`,
      };
    }

    let result: any;
    try {
      result = JSON.parse(raw);
    } catch (parseError) {
      return {
        success: false,
        message: `BscScan returned an unexpected response: ${raw.slice(0, 160)}`,
      };
    }
    const status: string | undefined = result?.status;
    const message: string = result?.result ?? '';
    if (status === '1') {
      return { success: true, message: message || 'Verified' };
    }
    if (status === '0' && message && message !== 'Pending in queue') {
      return { success: false, message };
    }
  }
  return { success: false, message: 'Verification timed out while waiting for BscScan.' };
}

async function submitImplementationVerification(
  apiBase: string,
  apiKey: string,
  chainId: number,
  contractAddress: string,
  sourceCode: string,
  contractFullName: string,
  compilerVersion: string,
  optimizationUsed: boolean,
  runs: number,
  constructorArgs: string,
  evmVersion?: string,
): Promise<{ status: 'success' | 'error'; guid?: string; message?: string }>
{
  const payload = new URLSearchParams({
    apikey: apiKey,
    chainid: String(chainId),
    module: 'contract',
    action: 'verifysourcecode',
    contractaddress: contractAddress,
    sourceCode,
    codeformat: 'solidity-standard-json-input',
    contractname: contractFullName,
    compilerversion: compilerVersion,
    optimizationUsed: optimizationUsed ? '1' : '0',
    runs: optimizationUsed ? String(runs ?? 200) : '0',
    constructorArguments: constructorArgs,
    licenseType: '3',
    evmversion: evmVersion ?? '',
  });

  const response = await fetch(`${apiBase}/v2/api`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body: payload.toString(),
  });

  const raw = await response.text();
  if (!response.ok) {
    const sanitized = raw.replace(/\s+/g, ' ').trim().slice(0, 200);
    const rateLimited = response.status === 403 && sanitized.includes('Just a moment');
    const message = rateLimited
      ? 'BscScan bloqueó la solicitud (HTTP 403). Espera unos segundos y vuelve a intentar con tu API key válida.'
      : `BscScan respondió con estado ${response.status}: ${sanitized}`;
    return { status: 'error', message };
  }

  let result: any;
  try {
    result = JSON.parse(raw);
  } catch (parseError) {
    return { status: 'error', message: `BscScan returned an unexpected response: ${raw.slice(0, 160)}` };
  }
  const status: string | undefined = result?.status;
  const message: string = result?.result ?? '';

  if (status === '1' && message) {
    return { status: 'success', guid: message, message };
  }

  if (message && message.includes('already verified')) {
    return { status: 'success', message: 'Contract source code already verified.' };
  }

  return { status: 'error', message: message || 'Unknown error while submitting verification.' };
}

async function submitProxyVerification(
  apiBase: string,
  apiKey: string,
  proxyAddress: string,
  implementationAddress: string,
  chainId: number,
): Promise<{ status: 'success' | 'error'; message?: string }>
{
  const payload = {
    apikey: apiKey,
    chainid: String(chainId),
    module: 'contract',
    action: 'verifyproxycontract',
    address: proxyAddress,
    expectedimplementation: implementationAddress,
  };

  const response = await fetch(`${apiBase}/v2/api`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const result = await response.json();
  const status: string | undefined = result?.status;
  const message: string = result?.result ?? '';

  if (status === '1') {
    return { status: 'success', message: message || 'Proxy verification submitted.' };
  }

  if (message && message.includes('already verified')) {
    return { status: 'success', message: 'Proxy already verified.' };
  }

  return { status: 'error', message: message || 'Unknown proxy verification error.' };
}

function normalizeConstructorArg(arg: string): string {
  if (!arg) return '';
  return arg.startsWith('0x') ? arg.slice(2) : arg;
}

export async function POST(request: NextRequest, { params }: RouteContext) {
  const token = params.token;
  if (!isAddress(token)) {
    return badRequest('Invalid token address.');
  }

  let body: VerifyRequestBody;
  try {
    body = await request.json();
  } catch (error) {
    return badRequest('Invalid JSON body.');
  }

  const { chainId, factory, deploymentTx, apiKey } = body;
  if (!chainId || Number.isNaN(chainId)) {
    return badRequest('Invalid or missing chainId.');
  }
  if (!factory || !isAddress(factory)) {
    return badRequest('Factory parameter missing or invalid.');
  }
  if (!apiKey || apiKey.trim().length === 0) {
    return badRequest('BscScan API key is required.');
  }

  const target: VerificationTarget = body.target ?? 'factory';

  const apiBase = BSC_SCAN_ENDPOINT[chainId];
  if (!apiBase) {
    return badRequest('Unsupported chainId for automatic verification.');
  }

  const logs: VerificationLogEntry[] = [];

  try {
    const client = getPublicClient(chainId);
    const tokenAddress = params.token as Address;

    const targetAddress = target === 'factory' ? (factory as Address) : tokenAddress;
    const substring = target === 'factory' ? 'fetch-factory-bytecode' : 'fetch-token-bytecode';
    logs.push({ step: substring, status: 'pending' });
    const bytecode = await client.getBytecode({ address: targetAddress });
    if (!bytecode || bytecode === '0x') {
      logs.push({
        step: substring,
        status: 'error',
        message: 'Contract has no bytecode on-chain.',
      });
      return NextResponse.json(<VerifyResponse>{
        success: false,
        factoryAddress: targetAddress,
        implementationAddress: targetAddress,
        isProxy: false,
        logs,
      }, { status: 400 });
    }
    logs[logs.length - 1] = { step: substring, status: 'success' };

    const proxyImplementation = target === 'token' ? extractImplementationFromMinimalProxy(bytecode) : null;
    const isProxy = Boolean(proxyImplementation);
    const implementationAddress = target === 'factory' ? factory : (proxyImplementation ?? tokenAddress);

    logs.push({
      step: 'detect-proxy',
      status: 'success',
      message: isProxy ? `Proxy detected → ${implementationAddress}` : 'Standalone contract detected.',
    });

    const contractKey = target === 'factory' ? 'TokenFactory' : 'ERC20Template';
    logs.push({ step: 'load-standard-json', status: 'pending' });
    const standardJson = await loadStandardJsonInput(contractKey);
    logs[logs.length - 1] = { step: 'load-standard-json', status: 'success' };

    const sourceCode = JSON.stringify(standardJson.input, null, 2);
    const contractFullName = `${standardJson.sourceName}:${standardJson.contractName}`;
    const compilerVersion = ensureSolcVersion(standardJson.solcVersion);

    const optimizerSettings = standardJson.input?.settings?.optimizer ?? {};
    const optimizationUsed = Boolean(optimizerSettings.enabled);
    const runs = typeof optimizerSettings.runs === 'number' ? optimizerSettings.runs : 200;
    const evmVersion = standardJson.input?.settings?.evmVersion as string | undefined;

    let constructorArgs = '0x';
    if (target === 'factory') {
      const trimmedDeploymentTx = (deploymentTx ?? '').trim();
      const hasDeploymentTx = /^0x[a-fA-F0-9]{64}$/.test(trimmedDeploymentTx);
      if (hasDeploymentTx) {
        logs.push({ step: 'fetch-deployment-tx', status: 'pending' });
        const [transaction, receipt] = await Promise.all([
          client.getTransaction({ hash: trimmedDeploymentTx as `0x${string}` }),
          client.getTransactionReceipt({ hash: trimmedDeploymentTx as `0x${string}` }).catch(() => null),
        ]);

        if (!transaction) {
          logs.push({ step: 'fetch-deployment-tx', status: 'error', message: 'Deployment transaction not found.' });
          return NextResponse.json(<VerifyResponse>{
            success: false,
            factoryAddress: factory,
            implementationAddress,
            isProxy,
            logs,
          }, { status: 404 });
        }
        if (transaction.to) {
          logs.push({
            step: 'fetch-deployment-tx',
            status: 'error',
            message: 'Provided hash is not a contract deployment transaction.',
          });
          return NextResponse.json(<VerifyResponse>{
            success: false,
            factoryAddress: factory,
            implementationAddress,
            isProxy,
            logs,
          }, { status: 400 });
        }

        if (receipt && receipt.contractAddress && receipt.contractAddress.toLowerCase() !== implementationAddress.toLowerCase()) {
          logs.push({
            step: 'fetch-deployment-tx',
            status: 'error',
            message: 'Deployment transaction does not correspond to the implementation address.',
          });
          return NextResponse.json(<VerifyResponse>{
            success: false,
            factoryAddress: factory,
            implementationAddress,
            isProxy,
            logs,
          }, { status: 400 });
        }

        const txInput = transaction.input ?? '0x';
        if (!txInput || txInput === '0x') {
          logs.push({ step: 'fetch-deployment-tx', status: 'error', message: 'Transaction has no constructor data.' });
          return NextResponse.json(<VerifyResponse>{
            success: false,
            factoryAddress: factory,
            implementationAddress,
            isProxy,
            logs,
          }, { status: 400 });
        }

        const artifact = await loadContractArtifact('TokenFactory');
        const txInputHex = txInput.startsWith('0x') ? txInput.slice(2) : txInput;
        const artifactBytecodeHex = artifact.bytecode.startsWith('0x') ? artifact.bytecode.slice(2) : artifact.bytecode;

        if (!txInputHex.startsWith(artifactBytecodeHex)) {
          logs.push({
            step: 'fetch-deployment-tx',
            status: 'error',
            message: 'Transaction input does not match TokenFactory bytecode.',
          });
          return NextResponse.json(<VerifyResponse>{
            success: false,
            factoryAddress: factory,
            implementationAddress,
            isProxy,
            logs,
          }, { status: 400 });
        }

        const constructorHex = txInputHex.slice(artifactBytecodeHex.length);
        constructorArgs = constructorHex.length > 0 ? `0x${constructorHex}` : '0x';
        logs[logs.length - 1] = { step: 'fetch-deployment-tx', status: 'success' };
      }
    }

    const constructorArgsNormalized = normalizeConstructorArg(constructorArgs);

    logs.push({ step: 'submit-implementation', status: 'pending' });
    const submitResult = await submitImplementationVerificationWithRetry(() =>
      submitImplementationVerification(
        apiBase,
        apiKey,
        chainId,
        implementationAddress,
        sourceCode,
        contractFullName,
        compilerVersion,
        optimizationUsed,
        runs,
        constructorArgsNormalized,
        evmVersion,
      ),
    );

    if (submitResult.status === 'error') {
      logs[logs.length - 1] = {
        step: 'submit-implementation',
        status: 'error',
        message: submitResult.message ?? 'Failed to submit verification.',
      };
      return NextResponse.json(<VerifyResponse>{
        success: false,
        factoryAddress: target === 'factory' ? factory : tokenAddress,
        implementationAddress,
        isProxy,
        logs,
      }, { status: 400 });
    }

    logs[logs.length - 1] = {
      step: 'submit-implementation',
      status: 'success',
      message: submitResult.message,
    };

    if (submitResult.guid) {
      logs.push({ step: 'poll-implementation', status: 'pending' });
      const pollResult = await pollVerificationStatus(apiBase, apiKey, submitResult.guid, chainId);
      if (!pollResult.success) {
        logs[logs.length - 1] = {
          step: 'poll-implementation',
          status: 'error',
          message: pollResult.message,
        };
        return NextResponse.json(<VerifyResponse>{
          success: false,
          factoryAddress: target === 'factory' ? factory : tokenAddress,
          implementationAddress,
          isProxy,
          logs,
        }, { status: 408 });
      }
      logs[logs.length - 1] = {
        step: 'poll-implementation',
        status: 'success',
        message: pollResult.message,
      };
    }

    if (isProxy) {
      logs.push({ step: 'link-proxy', status: 'pending' });
      const proxyResult = await submitProxyVerification(apiBase, apiKey, tokenAddress, implementationAddress, chainId);
      if (proxyResult.status === 'error') {
        logs[logs.length - 1] = {
          step: 'link-proxy',
          status: 'error',
          message: proxyResult.message ?? 'Failed to link proxy.',
        };
        return NextResponse.json(<VerifyResponse>{
          success: false,
          factoryAddress: target === 'factory' ? factory : tokenAddress,
          implementationAddress,
          isProxy,
          logs,
        }, { status: 400 });
      }
      logs[logs.length - 1] = {
        step: 'link-proxy',
        status: 'success',
        message: proxyResult.message,
      };
    }

    return NextResponse.json(<VerifyResponse>{
      success: true,
      factoryAddress: target === 'factory' ? factory : tokenAddress,
      implementationAddress,
      isProxy,
      logs,
    });
  } catch (error: any) {
    logs.push({ step: 'unexpected', status: 'error', message: error?.message ?? 'Unexpected error.' });
    return NextResponse.json(<VerifyResponse>{
      success: false,
      factoryAddress: factory,
      implementationAddress: factory,
      isProxy: false,
      logs,
    }, { status: 500 });
  }
}
