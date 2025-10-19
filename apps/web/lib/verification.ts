import { promises as fs } from 'node:fs';
import path from 'node:path';

export type StandardJsonInputResult = {
  input: any;
  contractName: string;
  sourceName: string;
  solcVersion: string;
};

type ContractArtifactResult = {
  bytecode: string;
  deployedBytecode: string;
};

const standardJsonCache = new Map<string, StandardJsonInputResult>();
const artifactCache = new Map<string, ContractArtifactResult>();

export async function loadStandardJsonInput(contractName = 'ERC20Template'): Promise<StandardJsonInputResult> {
  if (standardJsonCache.has(contractName)) {
    return standardJsonCache.get(contractName)!;
  }

  const cwd = process.cwd();
  const candidateRoots = [
    cwd,
    path.resolve(cwd, '..'),
    path.resolve(cwd, '..', '..'),
    path.resolve(cwd, '..', '..', '..'),
  ];

  let buildInfoDir: string | undefined;
  let entries: string[] | undefined;

  for (const root of candidateRoots) {
    const candidate = path.join(root, 'packages', 'contracts', 'artifacts', 'build-info');
    if (buildInfoDir === candidate) continue;
    try {
      entries = await fs.readdir(candidate);
      buildInfoDir = candidate;
      break;
    } catch (error) {
      // try next root
    }
  }

  if (!buildInfoDir || !entries) {
    throw new Error(
      'No se encontró la carpeta build-info. Ejecuta `pnpm --filter contracts hardhat compile --force` para regenerar los artefactos en packages/contracts.',
    );
  }

  for (const entry of entries) {
    if (!entry.endsWith('.json')) continue;

    const fullPath = path.join(buildInfoDir, entry);
    const raw = await fs.readFile(fullPath, 'utf8');
    const json = JSON.parse(raw);
    const contracts = json?.output?.contracts as Record<string, Record<string, unknown>> | undefined;
    if (!contracts) continue;

    for (const [sourceName, contractGroup] of Object.entries(contracts)) {
      if (contractGroup && Object.prototype.hasOwnProperty.call(contractGroup, contractName)) {
        const result: StandardJsonInputResult = {
          input: json.input,
          contractName,
          sourceName,
          solcVersion: json.solcVersion ?? json.compiler?.version ?? '',
        };
        standardJsonCache.set(contractName, result);
        return result;
      }
    }
  }

  throw new Error(
    `No se encontró el Standard JSON para el contrato ${contractName}. Asegúrate de haber compilado y que el contrato exista en los artefactos generados por Hardhat.`,
  );
}

export async function loadContractArtifact(
  contractName: string,
  artifactRelativePath?: string,
): Promise<ContractArtifactResult> {
  if (artifactCache.has(contractName)) {
    return artifactCache.get(contractName)!;
  }

  const cwd = process.cwd();
  const candidateRoots = [
    cwd,
    path.resolve(cwd, '..'),
    path.resolve(cwd, '..', '..'),
    path.resolve(cwd, '..', '..', '..'),
  ];

  const relativePath = artifactRelativePath ?? path.join('contracts', `${contractName}.sol`, `${contractName}.json`);

  for (const root of candidateRoots) {
    const fullPath = path.join(root, 'packages', 'contracts', 'artifacts', relativePath);
    try {
      const raw = await fs.readFile(fullPath, 'utf8');
      const json = JSON.parse(raw);
      const bytecode = json?.bytecode as string | undefined;
      const deployedBytecode = json?.deployedBytecode as string | undefined;
      if (!bytecode || !deployedBytecode) {
        throw new Error(`Artifact ${contractName} is missing bytecode information at ${fullPath}`);
      }
      const result: ContractArtifactResult = { bytecode, deployedBytecode };
      artifactCache.set(contractName, result);
      return result;
    } catch (error) {
      // try next root
    }
  }

  throw new Error(
    `No se encontró el artefacto compilado para ${contractName}. Ejecuta \`pnpm --filter contracts hardhat compile --force\` para regenerar los artefactos en packages/contracts.`,
  );
}
